import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

export const LOCATION_TASK_NAME = "nightapp-location-tracking";
export const GEOFENCE_TASK_NAME = "nightapp-venue-geofence";
const STORAGE_KEY = "lastLocationUpdate";
const GEOFENCE_STATE_KEY = "venueGeofenceState";
const GEOFENCE_LOG_KEY = "venueGeofenceLog";
const TOKEN_KEY = "auth_token";
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export type StoredLocation = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
  timestamp: number;
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

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

    await persistLocation(locations[0]);
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

    const raw = await AsyncStorage.getItem(GEOFENCE_STATE_KEY);
    const state = raw ? (JSON.parse(raw) as Record<string, number>) : {};

    if (eventType === Location.GeofencingEventType.Enter) {
      state[region.identifier] = Date.now();
      await AsyncStorage.setItem(GEOFENCE_STATE_KEY, JSON.stringify(state));
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
        await AsyncStorage.setItem(GEOFENCE_STATE_KEY, JSON.stringify(state));

        const stay = {
          venueId: region.identifier,
          enteredAt,
          exitedAt: Date.now(),
          durationMs: Date.now() - enteredAt,
        };

        const historyRaw = await AsyncStorage.getItem(GEOFENCE_LOG_KEY);
        const history = historyRaw ? (JSON.parse(historyRaw) as typeof stay[]) : [];
        history.unshift(stay);
        await AsyncStorage.setItem(GEOFENCE_LOG_KEY, JSON.stringify(history.slice(0, 100)));

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
};

export const getLastStoredLocation = async (): Promise<StoredLocation | null> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredLocation;
  } catch {
    return null;
  }
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
  const raw = await AsyncStorage.getItem(GEOFENCE_LOG_KEY);
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
