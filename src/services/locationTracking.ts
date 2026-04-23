import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

export const LOCATION_TASK_NAME = "nightapp-location-tracking";
export const GEOFENCE_TASK_NAME = "nightapp-venue-geofence";
const STORAGE_KEY = "lastLocationUpdate";
const LOCATION_SYNC_KEY = "friendLocationLastSyncAt";
const LOCATION_PERMISSION_SYNC_KEY = "friendLocationPermissionState";
const GEOFENCE_STATE_KEY = "venueGeofenceState";
const GEOFENCE_LOG_KEY = "venueGeofenceLog";
const VENUE_STAY_ACTIVE_KEY = "venueStayActive";
const VENUE_STAY_LOG_KEY = "venueStayLog";
const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const API_URL = process.env.EXPO_PUBLIC_API_URL;
const LOCATION_SYNC_INTERVAL_MS = 45 * 1000;

export type StoredLocation = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
  timestamp: number;
};

type ActiveVenueStay = {
  venue_id: string;
  latitude: number;
  longitude: number;
  radius: number;
  entered_at: number;
};

const getCurrentLocationScope = async () => {
  try {
    const rawUser = await SecureStore.getItemAsync(USER_KEY);
    if (!rawUser) {
      return "anonymous";
    }

    const user = JSON.parse(rawUser) as { id?: string | null };
    const userId = String(user?.id ?? "").trim();
    return userId.length > 0 ? userId : "anonymous";
  } catch {
    return "anonymous";
  }
};

const getScopedStorageKey = async (baseKey: string) => {
  const scope = await getCurrentLocationScope();
  return `${baseKey}:${scope}`;
};

const getScopedItem = async (baseKey: string) => {
  const scopedKey = await getScopedStorageKey(baseKey);
  return AsyncStorage.getItem(scopedKey);
};

const setScopedItem = async (baseKey: string, value: string) => {
  const scopedKey = await getScopedStorageKey(baseKey);
  await AsyncStorage.setItem(scopedKey, value);
};

const removeScopedItem = async (baseKey: string) => {
  const scopedKey = await getScopedStorageKey(baseKey);
  await AsyncStorage.removeItem(scopedKey);
};

const persistLocation = async (location: Location.LocationObject) => {
  const payload: StoredLocation = {
    coords: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    },
    timestamp: location.timestamp || Date.now(),
  };

  await setScopedItem(STORAGE_KEY, JSON.stringify(payload));
};

const sendFriendLocationUpdate = async (payload: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: number;
}) => {
  if (!API_URL) return false;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return false;

  try {
    await fetch(`${API_URL}/friends/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy ?? undefined,
        timestamp: payload.timestamp ? new Date(payload.timestamp).toISOString() : undefined,
      }),
    });
    return true;
  } catch {
    return false;
  }
};

const sendLocationSharingPreference = async (enabled: boolean) => {
  if (!API_URL) return false;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return false;

  try {
    await fetch(`${API_URL}/friends/location-sharing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled }),
    });
    return true;
  } catch {
    return false;
  }
};

export const getSystemLocationSharingEnabled = async (): Promise<boolean> => {
  try {
    const [foreground, servicesEnabled] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.hasServicesEnabledAsync(),
    ]);
    return foreground.status === "granted" && servicesEnabled;
  } catch {
    return false;
  }
};

export const syncSystemLocationSharingToBackend = async (enabled?: boolean) => {
  const sharingEnabled = typeof enabled === "boolean"
    ? enabled
    : await getSystemLocationSharingEnabled();
  const normalized = sharingEnabled ? "1" : "0";

  try {
    const previous = await getScopedItem(LOCATION_PERMISSION_SYNC_KEY);
    if (previous === normalized) {
      if (!sharingEnabled) {
        await removeScopedItem(LOCATION_SYNC_KEY);
      }
      return sharingEnabled;
    }

    const synced = await sendLocationSharingPreference(sharingEnabled);
    if (synced) {
      await setScopedItem(LOCATION_PERMISSION_SYNC_KEY, normalized);
      if (!sharingEnabled) {
        await removeScopedItem(LOCATION_SYNC_KEY);
      }
    }
  } catch {
    // Ignore sync cache errors and fall back to the current OS permission state.
  }

  return sharingEnabled;
};

const shouldSkipLocationSync = async (force: boolean) => {
  if (force) return false;
  const raw = await getScopedItem(LOCATION_SYNC_KEY);
  const lastSyncAt = raw ? Number(raw) : 0;
  return Number.isFinite(lastSyncAt) && Date.now() - lastSyncAt < LOCATION_SYNC_INTERVAL_MS;
};

const syncLocationPayloadToBackend = async (
  payload: StoredLocation,
  options?: { force?: boolean },
) => {
  const sharingEnabled = await syncSystemLocationSharingToBackend();
  if (!sharingEnabled) return false;
  if (await shouldSkipLocationSync(Boolean(options?.force))) return false;

  const synced = await sendFriendLocationUpdate({
    latitude: payload.coords.latitude,
    longitude: payload.coords.longitude,
    accuracy: payload.coords.accuracy,
    timestamp: payload.timestamp,
  });

  if (synced) {
    await setScopedItem(LOCATION_SYNC_KEY, String(Date.now()));
  }

  return synced;
};

const sendVenueStayCheckpoint = async (payload: {
  venue_id: string;
  event_type: "enter" | "exit";
  timestamp: string;
}) => {
  if (!API_URL) return;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;

  try {
    await fetch(`${API_URL}/venue-stays/checkpoint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best-effort: ignore network errors in background.
  }
};

const calculateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getActiveVenueStay = async (): Promise<ActiveVenueStay | null> => {
  const raw = await getScopedItem(VENUE_STAY_ACTIVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveVenueStay;
  } catch {
    return null;
  }
};

const setActiveVenueStay = async (stay: ActiveVenueStay) => {
  await setScopedItem(VENUE_STAY_ACTIVE_KEY, JSON.stringify(stay));
};

const clearActiveVenueStay = async () => {
  await removeScopedItem(VENUE_STAY_ACTIVE_KEY);
};

const logVenueStay = async (stay: {
  venueId: string;
  enteredAt: number;
  exitedAt: number;
  durationMs: number;
}) => {
  const historyRaw = await getScopedItem(VENUE_STAY_LOG_KEY);
  const history = historyRaw ? (JSON.parse(historyRaw) as typeof stay[]) : [];
  history.unshift(stay);
  await setScopedItem(VENUE_STAY_LOG_KEY, JSON.stringify(history.slice(0, 100)));
};

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async (task: any) => {
    const { data, error } = task ?? {};
    if (error) {
      return;
    }

    const { locations } = (data ?? {}) as {
      locations?: Location.LocationObject[];
    };
    if (!locations || locations.length === 0) {
      return;
    }

    const latest = locations[0];
    await persistLocation(latest);

    const activeStay = await getActiveVenueStay();
    if (!activeStay) {
      return;
    }

    const distanceKm = calculateDistanceKm(
      latest.coords.latitude,
      latest.coords.longitude,
      activeStay.latitude,
      activeStay.longitude
    );
    const outsideVenue = distanceKm * 1000 > activeStay.radius;

    if (outsideVenue) {
      const exitedAt = latest.timestamp || Date.now();
      await clearActiveVenueStay();
      await stopBackgroundLocationUpdates();

      await logVenueStay({
        venueId: activeStay.venue_id,
        enteredAt: activeStay.entered_at,
        exitedAt,
        durationMs: Math.max(0, exitedAt - activeStay.entered_at),
      });

      await sendVenueStayCheckpoint({
        venue_id: activeStay.venue_id,
        event_type: "exit",
        timestamp: new Date(exitedAt).toISOString(),
      });
    }
  });
}

if (!TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
  TaskManager.defineTask(GEOFENCE_TASK_NAME, async (task: any) => {
    const { data, error } = task ?? {};
    if (error) {
      return;
    }

    const { eventType, region } = (data ?? {}) as {
      eventType?: number;
      region?: { identifier?: string };
    };

    if (!region?.identifier || typeof eventType !== "number") {
      return;
    }

    const raw = await getScopedItem(GEOFENCE_STATE_KEY);
    const state = raw ? (JSON.parse(raw) as Record<string, number>) : {};

    if (eventType === Location.GeofencingEventType.Enter) {
      state[region.identifier] = Date.now();
      await setScopedItem(GEOFENCE_STATE_KEY, JSON.stringify(state));
      await sendVenueStayCheckpoint({
        venue_id: region.identifier,
        event_type: "enter",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (eventType === Location.GeofencingEventType.Exit) {
      const enteredAt = state[region.identifier];
      if (enteredAt) {
        delete state[region.identifier];
        await setScopedItem(GEOFENCE_STATE_KEY, JSON.stringify(state));

        const stay = {
          venueId: region.identifier,
          enteredAt,
          exitedAt: Date.now(),
          durationMs: Date.now() - enteredAt,
        };

        const historyRaw = await getScopedItem(GEOFENCE_LOG_KEY);
        const history = historyRaw ? (JSON.parse(historyRaw) as typeof stay[]) : [];
        history.unshift(stay);
        await setScopedItem(GEOFENCE_LOG_KEY, JSON.stringify(history.slice(0, 100)));

        await sendVenueStayCheckpoint({
          venue_id: region.identifier,
          event_type: "exit",
          timestamp: new Date().toISOString(),
        });
      }
    }
  });
}

export const persistLocationUpdate = async (location: Location.LocationObject) => {
  await persistLocation(location);
  const stored: StoredLocation = {
    coords: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    },
    timestamp: location.timestamp || Date.now(),
  };
  await syncLocationPayloadToBackend(stored);
};

export const getLastStoredLocation = async (): Promise<StoredLocation | null> => {
  const raw = await getScopedItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredLocation;
  } catch {
    return null;
  }
};

export const syncStoredLocationToBackend = async (force = false) => {
  const stored = await getLastStoredLocation();
  if (!stored) return false;
  return syncLocationPayloadToBackend(stored, { force });
};

export const hasBackgroundLocationUpdates = async (): Promise<boolean> => {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
};

export const startBackgroundLocationUpdates = async (): Promise<{
  started: boolean;
  status: "started" | "foreground-denied" | "background-denied" | "error";
}> => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return { started: false, status: "foreground-denied" };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    return { started: false, status: "background-denied" };
  }

  try {
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!alreadyStarted) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 25,
        pausesUpdatesAutomatically: true,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "NightHub sta usando la posizione",
          notificationBody: "Aggiorniamo la tua posizione per la mappa e gli amici vicini.",
          notificationColor: "#6D5BFF",
        },
      });
    }

    return { started: true, status: "started" };
  } catch {
    return { started: false, status: "error" };
  }
};

export const startVenueStayMonitoring = async (params: {
  venue_id: string;
  latitude: number;
  longitude: number;
  radius?: number;
}): Promise<{ started: boolean; status: "started" | "foreground-denied" | "background-denied" | "error" }> => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return { started: false, status: "foreground-denied" };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    return { started: false, status: "background-denied" };
  }

  try {
    await stopBackgroundLocationUpdates();

    const enteredAt = Date.now();
    await setActiveVenueStay({
      venue_id: params.venue_id,
      latitude: params.latitude,
      longitude: params.longitude,
      radius: params.radius ?? 100,
      entered_at: enteredAt,
    });

    await sendVenueStayCheckpoint({
      venue_id: params.venue_id,
      event_type: "enter",
      timestamp: new Date(enteredAt).toISOString(),
    });

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15 * 60 * 1000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "NightHub: controllo permanenza",
        notificationBody: "Verifichiamo se sei ancora nel locale.",
        notificationColor: "#6D5BFF",
      },
    });

    return { started: true, status: "started" };
  } catch {
    return { started: false, status: "error" };
  }
};

export const stopVenueStayMonitoring = async () => {
  await clearActiveVenueStay();
  await stopBackgroundLocationUpdates();
};

export const stopBackgroundLocationUpdates = async () => {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch {
    // Ignore stop errors to avoid blocking UI.
  }
};

export const startVenueGeofencing = async (regions: {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
}[]) => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return { started: false, status: "foreground-denied" as const };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    return { started: false, status: "background-denied" as const };
  }

  try {
    await Location.startGeofencingAsync(
      GEOFENCE_TASK_NAME,
      regions.map((region) => ({
        ...region,
        notifyOnEnter: true,
        notifyOnExit: true,
      }))
    );
    return { started: true, status: "started" as const };
  } catch {
    return { started: false, status: "error" as const };
  }
};

export const stopVenueGeofencing = async () => {
  try {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  } catch {
    // Ignore stop errors to avoid blocking UI.
  }
};

export const getVenueStayHistory = async () => {
  const raw = await getScopedItem(GEOFENCE_LOG_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as {
      venueId: string;
      enteredAt: number;
      exitedAt: number;
      durationMs: number;
    }[];
  } catch {
    return [];
  }
};

export const getVenueStayMonitoringHistory = async () => {
  const raw = await getScopedItem(VENUE_STAY_LOG_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as {
      venueId: string;
      enteredAt: number;
      exitedAt: number;
      durationMs: number;
    }[];
  } catch {
    return [];
  }
};
