import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Alert,
  AppState,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  TextInput,
  Animated,
  Share,
  Linking,
  Platform,
  type AppStateStatus,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from "react-native-maps";
import { useTheme } from "../../../theme/ThemeProvider";
import { MOCK_EVENTS } from "../../../data/mockEvents";
import { fetchVenues } from "../../../services/venues";
import { fetchEventsByVenue } from "../../../services/events";
import {
  fetchFriendMapPresence,
  type FriendMapHotspot,
  type FriendMapPresenceFriend,
} from "../../../services/friends";
import type { Event, Venue as ApiVenue } from "../../../types/events";
import {
  getSystemLocationSharingEnabled,
  getLastStoredLocation,
  persistLocationUpdate,
  syncSystemLocationSharingToBackend,
  syncStoredLocationToBackend,
} from "../../../services/locationTracking";

interface MapTabProps {
  isActive?: boolean;
  onEventPress?: (event: any) => void;
}

interface Friend {
  id: string;
  name: string;
  color: string;
  latitude?: number | null;
  longitude?: number | null;
  venue?: string;
  avatar?: string | null;
  sharingEnabled?: boolean;
  lastSeenAt?: string | null;
  lastSeenMinutesAgo?: number | null;
  lastSeenLabel?: string;
  isStale?: boolean;
  venuePresence?: {
    type: "inside" | "nearby";
    venueId: string;
    venueName: string;
    distanceMeters?: number | null;
    radiusMeters: number;
  } | null;
}

interface Venue {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  color: string;
  events?: number[];
  capacity?: number;
  rating?: number;
}

interface VenueEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  endTime?: string;
  status?: string;
}

interface HotZone {
  venueId: string;
  venueName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  friendCount: number;
  activeEventCount: number;
  upcomingEventCount: number;
  vibe: "hot" | "warm";
  friends: Array<{ id: string; name: string; avatar?: string | null }>;
}

const FILTER_OPTIONS = [
  { key: "all", label: "Tutto", icon: "grid" },
  { key: "venues", label: "Locali", icon: "map-pin" },
  { key: "friends", label: "Amici", icon: "users" },
] as const;

// Helper: calcola distanza tra due coordinate (km)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Raggio terrestre in km
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

// Helper: crea cluster di zone di interesse quando zoomato out
interface ZoneCluster {
  latitude: number;
  longitude: number;
  venuesCount: number;
  friendsCount: number;
  venues: Venue[];
}

const createZoneClusters = (
  venues: Venue[],
  friendsByVenue: { [key: string]: Friend[] },
  zoomDelta: number
): ZoneCluster[] => {
  const getGridSizeForZoom = (delta: number): number => {
    if (delta > 0.5) return 0.3;
    if (delta > 0.2) return 0.18;
    if (delta > 0.1) return 0.1;
    if (delta > 0.06) return 0.06;
    if (delta > 0.03) return 0.03;
    if (delta > 0.018) return 0.015;
    return 0.008;
  };

  const gridSize = getGridSizeForZoom(zoomDelta);
  const clusterMap: { [key: string]: ZoneCluster } = {};

  venues.forEach((venue) => {
    const gridLat = Math.floor(venue.latitude / gridSize) * gridSize;
    const gridLon = Math.floor(venue.longitude / gridSize) * gridSize;
    const key = `${gridLat},${gridLon}`;

    if (!clusterMap[key]) {
      clusterMap[key] = {
        latitude: venue.latitude,
        longitude: venue.longitude,
        venuesCount: 0,
        friendsCount: 0,
        venues: [],
      };
    }

    clusterMap[key].venuesCount += 1;
    clusterMap[key].friendsCount += (friendsByVenue[venue.name]?.length || 0);
    clusterMap[key].venues.push(venue);
  });

  return Object.values(clusterMap).map((cluster) => {
    if (!cluster.venues.length) {
      return cluster;
    }

    const sumLat = cluster.venues.reduce((acc, venue) => acc + venue.latitude, 0);
    const sumLon = cluster.venues.reduce((acc, venue) => acc + venue.longitude, 0);

    return {
      ...cluster,
      latitude: sumLat / cluster.venues.length,
      longitude: sumLon / cluster.venues.length,
    };
  });
};

const IT_MONTH_TO_INDEX: Record<string, number> = {
  gen: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  mag: 4,
  giu: 5,
  lug: 6,
  ago: 7,
  set: 8,
  ott: 9,
  nov: 10,
  dic: 11,
};

const parseVenueEventDateTime = (event: VenueEvent): Date | null => {
  if (!event?.date) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
    const [yearRaw, monthRaw, dayRaw] = event.date.split("-");
    const year = Number.parseInt(yearRaw, 10);
    const month = Number.parseInt(monthRaw, 10);
    const day = Number.parseInt(dayRaw, 10);

    const [hourRaw, minuteRaw] = (event.time || "00:00").split(":");
    const hour = Number.parseInt(hourRaw, 10);
    const minute = Number.parseInt(minuteRaw, 10);

    const parsed = new Date(
      year,
      month - 1,
      day,
      Number.isFinite(hour) ? hour : 0,
      Number.isFinite(minute) ? minute : 0,
      0,
      0
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const [dayRaw, monthRaw] = event.date.trim().split(/\s+/);
  const day = Number.parseInt(dayRaw, 10);
  const monthToken = (monthRaw || "").toLowerCase().slice(0, 3);
  const month = IT_MONTH_TO_INDEX[monthToken];

  if (!Number.isFinite(day) || month === undefined) {
    return null;
  }

  const now = new Date();
  const [hourRaw, minuteRaw] = (event.time || "00:00").split(":");
  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);

  const eventDate = new Date(
    now.getFullYear(),
    month,
    day,
    Number.isFinite(hour) ? hour : 0,
    Number.isFinite(minute) ? minute : 0,
    0,
    0
  );

  return Number.isNaN(eventDate.getTime()) ? null : eventDate;
};

const splitActiveAndUpcomingEvents = (events: VenueEvent[]) => {
  const now = new Date();
  const activeWindowMs = 4 * 60 * 60 * 1000;
  const normalizeStatus = (status?: string) => (status ?? "").trim().toUpperCase();

  const withDate = events
    .map((event) => ({
      event,
      startsAt: parseVenueEventDateTime(event),
    }))
    .filter((item) => Boolean(item.startsAt));

  const active = withDate
    .filter((item) => {
      const st = normalizeStatus(item.event.status);
      if (st === "LIVE") return true;
      if (st === "CLOSED") return false;

      const startsAt = item.startsAt as Date;
      const [endHourRaw, endMinuteRaw] = (item.event.endTime || "").split(":");
      const endHour = Number.parseInt(endHourRaw, 10);
      const endMinute = Number.parseInt(endMinuteRaw, 10);

      const endsAt =
        Number.isFinite(endHour) && Number.isFinite(endMinute)
          ? new Date(
              startsAt.getFullYear(),
              startsAt.getMonth(),
              startsAt.getDate(),
              endHour,
              endMinute,
              0,
              0
            )
          : new Date(startsAt.getTime() + activeWindowMs);

      if (endsAt.getTime() <= startsAt.getTime()) {
        endsAt.setDate(endsAt.getDate() + 1);
      }

      return startsAt <= now && now <= endsAt;
    })
    .sort((a, b) => (a.startsAt as Date).getTime() - (b.startsAt as Date).getTime())
    .map((item) => item.event);

  const upcoming = withDate
    .filter((item) => {
      const st = normalizeStatus(item.event.status);
      if (st === "CLOSED") return false;
      if (st === "LIVE") return false;
      return (item.startsAt as Date).getTime() > now.getTime() || st === "DRAFT";
    })
    .sort((a, b) => (a.startsAt as Date).getTime() - (b.startsAt as Date).getTime())
    .map((item) => item.event);

  return { active, upcoming };
};

const mapApiEventToVenueEvent = (event: Event): VenueEvent => ({
  id: String(event.id),
  title: event.name,
  date: String(event.date ?? ""),
  time: event.start_time ? String(event.start_time).slice(0, 5) : undefined,
  endTime: event.end_time ? String(event.end_time).slice(0, 5) : undefined,
  status: event.status,
});

const formatFriendLastSeen = (minutes?: number | null) => {
  if (minutes === null || minutes === undefined) return "offline";
  if (minutes <= 1) return "ora";
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  return `${days} g fa`;
};

const avatarSeedFromId = (value: string) => {
  const normalized = String(value || "friend");
  const total = normalized.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (total % 60) + 1;
};

export default function MapTab({ isActive = true, onEventPress }: MapTabProps) {
  const { theme } = useTheme();

  // State
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredVenues, setFilteredVenues] = useState<any[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "friends" | "venues">("all");
  const [mapZoom, setMapZoom] = useState(0.08); // Track zoom level
  const mapRef = useRef<MapView>(null);
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapInitializedRef = useRef(false); // Track if map was already initialized
  const [mapRegion, setMapRegion] = useState<any>(null); // Store initial map region only
  const currentZoomRef = useRef(0.08); // Ref per tracciare lo zoom senza causare re-render
  const currentRegionRef = useRef<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const isMountedRef = useRef(true);
  const pendingInitialFocusRef = useRef(false);
  const [apiVenues, setApiVenues] = useState<ApiVenue[]>([]);
  const [venueEventsFromDb, setVenueEventsFromDb] = useState<VenueEvent[]>([]);
  const [venueEventsLoading, setVenueEventsLoading] = useState(false);
  const [friendPresence, setFriendPresence] = useState<FriendMapPresenceFriend[]>([]);
  const [hotZones, setHotZones] = useState<HotZone[]>([]);
  const [friendMapLoading, setFriendMapLoading] = useState(false);
  const [deviceLocationSharingEnabled, setDeviceLocationSharingEnabled] = useState<boolean | null>(null);

  // Animation refs per gli amici
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Mock friends data with locations
  // Mock venues with events
  const mockVenues: Venue[] = [
    {
      id: "v1",
      name: "Club Centrale",
      latitude: 45.4642,
      longitude: 9.1900,
      color: "#facc15",
      events: [1, 2, 5],
      capacity: 250,
      rating: 4.8,
    },
    {
      id: "v2",
      name: "Night Lounge",
      latitude: 45.4660,
      longitude: 9.1885,
      color: "#ec4899",
      events: [3, 4],
      capacity: 180,
      rating: 4.5,
    },
  ];

  const venuePalette = [
    "#facc15",
    "#ec4899",
    "#22c55e",
    "#06b6d4",
    "#f59e0b",
    "#8b5cf6",
  ];

  const friendPalette = ["#8b5cf6", "#22c55e", "#f59e0b", "#06b6d4", "#ec4899", "#f97316"];

  const friends = useMemo<Friend[]>(() => {
    return friendPresence.map((friend, index) => ({
      id: friend.id,
      name: friend.name || friend.username || "Amico",
      color: friendPalette[index % friendPalette.length],
      latitude: friend.position?.latitude ?? null,
      longitude: friend.position?.longitude ?? null,
      venue: friend.venue_presence?.venue_name,
      avatar: friend.avatar,
      sharingEnabled: friend.sharing_enabled,
      lastSeenAt: friend.last_seen_at ?? null,
      lastSeenMinutesAgo: friend.last_seen_minutes_ago ?? null,
      lastSeenLabel: formatFriendLastSeen(friend.last_seen_minutes_ago),
      isStale: friend.is_stale,
      venuePresence: friend.venue_presence
        ? {
            type: friend.venue_presence.type,
            venueId: friend.venue_presence.venue_id,
            venueName: friend.venue_presence.venue_name,
            distanceMeters: friend.venue_presence.distance_meters ?? null,
            radiusMeters: friend.venue_presence.radius_meters,
          }
        : null,
    }));
  }, [friendPresence]);

  const friendsWithPosition = useMemo(
    () =>
      friends.filter(
        (friend) =>
          typeof friend.latitude === "number" &&
          typeof friend.longitude === "number" &&
          Number.isFinite(friend.latitude) &&
          Number.isFinite(friend.longitude)
      ),
    [friends]
  );

  const visibleFriendsOnMap = useMemo(() => {
    return [...friendsWithPosition].sort((left, right) => {
      const leftPresenceScore = left.venuePresence?.type === "inside"
        ? 0
        : left.venuePresence?.type === "nearby"
          ? 1
          : 2;
      const rightPresenceScore = right.venuePresence?.type === "inside"
        ? 0
        : right.venuePresence?.type === "nearby"
          ? 1
          : 2;

      if (leftPresenceScore !== rightPresenceScore) {
        return leftPresenceScore - rightPresenceScore;
      }

      if (Boolean(left.isStale) !== Boolean(right.isStale)) {
        return left.isStale ? 1 : -1;
      }

      const leftSeen = left.lastSeenMinutesAgo ?? Number.MAX_SAFE_INTEGER;
      const rightSeen = right.lastSeenMinutesAgo ?? Number.MAX_SAFE_INTEGER;
      return leftSeen - rightSeen;
    });
  }, [friendsWithPosition]);

  const venues = useMemo<Venue[]>(() => {
    if (!apiVenues.length) return mockVenues;

    const mapped = apiVenues
      .map((venue, index) => {
        const latitude = Number(venue.latitude);
        const longitude = Number(venue.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return {
          id: venue.id,
          name: venue.name,
          latitude,
          longitude,
          color: venuePalette[index % venuePalette.length],
          capacity: venue.capacity ?? undefined,
        } as Venue;
      })
      .filter((venue): venue is Venue => Boolean(venue));

    return mapped.length ? mapped : mockVenues;
  }, [apiVenues]);

  // Animazione pulse per venue con molti amici
  useEffect(() => {
    if (!isActive) {
      setVenueModalOpen(false);
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
    };
  }, []);

  const loadFriendMapRef = useRef<(options?: { syncStoredLocation?: boolean }) => Promise<void>>(
    async () => {}
  );

  loadFriendMapRef.current = async (options) => {
    try {
      if (isMountedRef.current) {
        setFriendMapLoading(true);
      }

      const permissionEnabled = await getSystemLocationSharingEnabled();
      if (!isMountedRef.current) return;

      setDeviceLocationSharingEnabled(permissionEnabled);
      await syncSystemLocationSharingToBackend(permissionEnabled);
      if (!isMountedRef.current) return;

      if (permissionEnabled && options?.syncStoredLocation !== false) {
        await syncStoredLocationToBackend(true);
        if (!isMountedRef.current) return;
      }

      const response = await fetchFriendMapPresence();
      if (!isMountedRef.current) return;

      setFriendPresence(Array.isArray(response.friends) ? response.friends : []);
      setHotZones(
        Array.isArray(response.hotspots)
          ? response.hotspots.map((hotspot: FriendMapHotspot) => ({
              venueId: hotspot.venue_id,
              venueName: hotspot.venue_name,
              latitude: hotspot.latitude,
              longitude: hotspot.longitude,
              radiusMeters: hotspot.radius_meters,
              friendCount: hotspot.friend_count,
              activeEventCount: hotspot.active_event_count,
              upcomingEventCount: hotspot.upcoming_event_count,
              vibe: hotspot.vibe,
              friends: hotspot.friends,
            }))
          : []
      );
    } catch {
      if (!isMountedRef.current) return;
      setFriendPresence([]);
      setHotZones([]);
    } finally {
      if (isMountedRef.current) {
        setFriendMapLoading(false);
      }
    }
  };

  useEffect(() => {
    let disposed = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stopRefresh = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const runRefresh = (syncStoredLocation = false) => {
      if (disposed || !isActive) return;
      void loadFriendMapRef.current({ syncStoredLocation });
    };

    const startRefresh = () => {
      stopRefresh();
      runRefresh(true);
      intervalId = setInterval(() => {
        runRefresh(false);
      }, 45000);
    };

    if (isActive && AppState.currentState === "active") {
      startRefresh();
    }

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (!isActive) {
        stopRefresh();
        return;
      }

      if (nextState === "active") {
        startRefresh();
        return;
      }

      stopRefresh();
    });

    return () => {
      disposed = true;
      stopRefresh();
      subscription.remove();
    };
  }, [isActive]);

  const animateMapToRegion = (
    region: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    },
    duration: number
  ) => {
      if (!isMountedRef.current || !isActive || !mapRef.current) {
      return;
    }

    try {
      mapRef.current.animateToRegion(region, duration);
    } catch {
      // Prevent native map animation errors when the tab unmounts mid-transition.
    }
  };

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  // Verifica se amico è veramente nel locale (raggio < 100m)
  const isFriendInVenue = (friend: any, venue: any): boolean => {
    if (
      typeof friend?.latitude !== "number" ||
      typeof friend?.longitude !== "number" ||
      typeof venue?.latitude !== "number" ||
      typeof venue?.longitude !== "number"
    ) {
      return false;
    }
    const distance = calculateDistance(
      friend.latitude,
      friend.longitude,
      venue.latitude,
      venue.longitude
    );
    return distance < 0.1; // 100 metri
  };

  const refreshUserLocation = async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    try {
      const currentPermission = await Location.getForegroundPermissionsAsync();
      const permissionResponse =
        currentPermission.status === "granted" || !currentPermission.canAskAgain
          ? currentPermission
          : await Location.requestForegroundPermissionsAsync();
      const permissionEnabled =
        permissionResponse.status === "granted" &&
        (await getSystemLocationSharingEnabled());

      setDeviceLocationSharingEnabled(permissionEnabled);
      await syncSystemLocationSharingToBackend(permissionEnabled);

      if (!permissionEnabled) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      const nextRegion = {
        ...coords,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      };

      if (!isMountedRef.current) {
        return null;
      }

      setUserLocation(coords);
      setMapRegion(nextRegion);
      mapInitializedRef.current = true;
      pendingInitialFocusRef.current = true;

      if (isActive) {
        animateMapToRegion(nextRegion, 600);
        pendingInitialFocusRef.current = false;
      }

      await persistLocationUpdate(location);
      return coords;
    } catch {
      return null;
    }
  };

  // Get user location on mount
  useEffect(() => {
    let effectActive = true;

    const loadLocation = async () => {
      try {
        const stored = await getLastStoredLocation();
        if (!effectActive || !isMountedRef.current) {
          return;
        }

        const permissionEnabled = await getSystemLocationSharingEnabled();
        if (!effectActive || !isMountedRef.current) {
          return;
        }
        setDeviceLocationSharingEnabled(permissionEnabled);

        if (stored?.coords) {
          const storedRegion = {
            ...stored.coords,
            latitudeDelta: 0.025,
            longitudeDelta: 0.025,
          };

          setUserLocation(stored.coords);
          setMapRegion(storedRegion);
          pendingInitialFocusRef.current = true;
          mapInitializedRef.current = true;

          if (isActive) {
            animateMapToRegion(storedRegion, 800);
            pendingInitialFocusRef.current = false;
          }
        }

        const coords = await refreshUserLocation();
        if (!effectActive || !isMountedRef.current || !coords) {
          return;
        }

      } catch {
      }
    };

    loadLocation();

    return () => {
      effectActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isActive || !mapRegion || !pendingInitialFocusRef.current) {
      return;
    }

    animateMapToRegion(mapRegion, 0);
    pendingInitialFocusRef.current = false;
  }, [isActive, mapRegion]);

  useEffect(() => {
    let effectActive = true;

    const getVenuesRegion = (items: { latitude: number; longitude: number }[]) => {
      if (!items.length) return null;
      const lats = items.map((r) => r.latitude);
      const lons = items.map((r) => r.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);

      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;
      const latDelta = Math.max(0.02, (maxLat - minLat) * 1.6);
      const lonDelta = Math.max(0.02, (maxLon - minLon) * 1.6);

      return {
        latitude: centerLat,
        longitude: centerLon,
        latitudeDelta: latDelta,
        longitudeDelta: lonDelta,
      };
    };

    const loadVenues = async () => {
      try {
        const venues = await fetchVenues();
        if (!effectActive || !isMountedRef.current) return;
        setApiVenues(Array.isArray(venues) ? venues : []);
        const coordinates = venues
          .map((venue) => {
            const latitude = Number(venue.latitude);
            const longitude = Number(venue.longitude);
            if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
              return null;
            }
            return { latitude, longitude };
          })
          .filter((item): item is { latitude: number; longitude: number } => Boolean(item));

        if (!mapInitializedRef.current && !userLocation) {
          const region = getVenuesRegion(coordinates);
          if (region) {
            setMapRegion(region);
            mapInitializedRef.current = true;
            pendingInitialFocusRef.current = true;

            if (isActive) {
              animateMapToRegion(region, 800);
              pendingInitialFocusRef.current = false;
            }
          }
        }
      } catch {
        // Ignore to avoid blocking the map UI.
      }
    };

    loadVenues();

    return () => {
      effectActive = false;
    };
  }, []);

  const handleRecenter = async () => {
    if (!isMountedRef.current || !isActive || !mapRef.current) return;
    const coords = await refreshUserLocation();
    if (!isMountedRef.current || !isActive || !coords) {
      if (deviceLocationSharingEnabled === false) {
        Alert.alert(
          "Posizione disattivata",
          "Attiva i permessi e i servizi di localizzazione dalle impostazioni del dispositivo per aggiornare la mappa e sincronizzare il database."
        );
      }
      return;
    }
    animateMapToRegion(
      {
        ...coords,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      600
    );
  };

  const getCurrentMapRegion = () => {
    if (currentRegionRef.current) {
      return currentRegionRef.current;
    }

    if (mapRegion) {
      return mapRegion;
    }

    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      };
    }

    if (venues.length > 0) {
      return {
        latitude: venues[0].latitude,
        longitude: venues[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    return null;
  };

  const zoomMapBy = (factor: number) => {
    const region = getCurrentMapRegion();
    if (!region || !isMountedRef.current || !isActive) {
      return;
    }

    const nextRegion = {
      ...region,
      latitudeDelta: Math.min(1.2, Math.max(0.008, region.latitudeDelta * factor)),
      longitudeDelta: Math.min(1.2, Math.max(0.008, region.longitudeDelta * factor)),
    };

    currentRegionRef.current = nextRegion;
    currentZoomRef.current = nextRegion.latitudeDelta;
    setMapZoom(nextRegion.latitudeDelta);
    animateMapToRegion(nextRegion, 250);
  };

  const fitMapToVenueGroups = () => {
    if (!venues.length || !isMountedRef.current || !isActive) {
      return;
    }

    const lats = venues.map((venue) => venue.latitude);
    const lons = venues.map((venue) => venue.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const nextRegion = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.045, (maxLat - minLat) * 1.9),
      longitudeDelta: Math.max(0.045, (maxLon - minLon) * 1.9),
    };

    currentRegionRef.current = nextRegion;
    currentZoomRef.current = nextRegion.latitudeDelta;
    setMapZoom(nextRegion.latitudeDelta);
    animateMapToRegion(nextRegion, 450);
  };

  const fitMapToFriends = () => {
    if (!visibleFriendsOnMap.length || !isMountedRef.current || !isActive) {
      return;
    }

    const points = [
      ...visibleFriendsOnMap.map((friend) => ({
        latitude: Number(friend.latitude),
        longitude: Number(friend.longitude),
      })),
      ...(userLocation
        ? [
            {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            },
          ]
        : []),
    ];

    const lats = points.map((point) => point.latitude);
    const lons = points.map((point) => point.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const nextRegion = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.03, (maxLat - minLat) * 1.45),
      longitudeDelta: Math.max(0.03, (maxLon - minLon) * 1.45),
    };

    currentRegionRef.current = nextRegion;
    currentZoomRef.current = nextRegion.latitudeDelta;
    setMapZoom(nextRegion.latitudeDelta);
    animateMapToRegion(nextRegion, 450);
  };

  const venueMeta = (venue?: Venue | null) => {
    if (!venue) return "";
    const parts: string[] = [];
    if (venue.rating !== undefined && venue.rating !== null) {
      parts.push(`⭐ ${venue.rating}`);
    }
    if (venue.capacity !== undefined && venue.capacity !== null) {
      parts.push(`${venue.capacity} posti`);
    }
    return parts.join(" • ");
  };

  // Group friends by venue (solo se effettivamente nel locale)
  const friendsByVenue = useMemo(() => {
    const grouped: { [key: string]: Friend[] } = {};
    friends.forEach((friend) => {
      const venueName = friend.venue;
      if (!venueName) {
        return;
      }

      const venue = venues.find((v) => v.name === venueName);
      if (venue && isFriendInVenue(friend, venue)) {
        if (!grouped[venueName]) {
          grouped[venueName] = [];
        }
        grouped[venueName].push(friend);
      }
    });
    return grouped;
  }, [friends, venues]);

  // Crea cluster di zone quando zoomato out
  const zoneClusters = useMemo(() => {
    return createZoneClusters(venues, friendsByVenue, mapZoom);
  }, [friendsByVenue, mapZoom, venues]);

  // Determina se mostrare cluster o marker singoli.
  // I cluster restano attivi finché non siamo molto vicini, così si "aprono" gradualmente in più zone.
  const showClusters = mapZoom > 0.018;
  const totalFriendsOnline = visibleFriendsOnMap.filter((friend) => !friend.isStale).length;
  const totalHotZones = hotZones.length;
  const searchHasResults = filteredVenues.length > 0 || filteredFriends.length > 0;

  // Get events for a venue
  const getVenueEvents = (venueId?: string): VenueEvent[] => {
    if (!venueId) return [];
    const venue = venues.find((v) => v.id === venueId);
    if (!venue || !venue.events || venue.events.length === 0) return [];
    return MOCK_EVENTS.filter((e) => venue.events?.includes(parseInt(e.id))).map((e) => ({
      id: String(e.id),
      title: e.title,
      date: e.date,
      time: e.time,
    }));
  };

  useEffect(() => {
    let isMounted = true;

    const loadVenueEventsFromDb = async () => {
      if (!venueModalOpen || !selectedVenue?.id) {
        setVenueEventsFromDb([]);
        setVenueEventsLoading(false);
        return;
      }

      try {
        setVenueEventsLoading(true);
        const response = await fetchEventsByVenue(String(selectedVenue.id));
        if (!isMounted) return;
        const mapped = Array.isArray(response) ? response.map(mapApiEventToVenueEvent) : [];
        setVenueEventsFromDb(mapped);
      } catch {
        if (!isMounted) return;
        setVenueEventsFromDb([]);
      } finally {
        if (isMounted) setVenueEventsLoading(false);
      }
    };

    loadVenueEventsFromDb();

    return () => {
      isMounted = false;
    };
  }, [selectedVenue?.id, venueModalOpen]);

  const selectedVenueEvents = useMemo(() => {
    if (venueEventsFromDb.length > 0) {
      return venueEventsFromDb;
    }
    return getVenueEvents(selectedVenue?.id);
  }, [selectedVenue?.id, venueEventsFromDb, venues]);

  const selectedVenueEventSections = useMemo(() => {
    return splitActiveAndUpcomingEvents(selectedVenueEvents);
  }, [selectedVenueEvents]);

  // Get friends at a venue
  const getFriendsAtVenue = (venueName: string) => {
    return friendsByVenue[venueName] || [];
  };

  // Conta amici per venue
  const getCountFriendsAtVenue = (venueName: string): number => {
    return getFriendsAtVenue(venueName).length;
  };

  useEffect(() => {
    if (!searchQuery.length) return;
    const results = filterResults(searchQuery, selectedFilter);
    setFilteredVenues(results.venues);
    setFilteredFriends(results.friends);
  }, [friends, searchQuery, selectedFilter, venues]);

  // Logica di ricerca con filtri
  const filterResults = (query: string, filter: string) => {
    if (query.length === 0) {
      return { venues: [], friends: [] };
    }

    const lowerQuery = query.toLowerCase();
    let filteredVenues: Venue[] = [];
    let filteredFriends: Friend[] = [];

    if (filter === "all" || filter === "venues") {
      filteredVenues = venues.filter((v) =>
        v.name.toLowerCase().includes(lowerQuery)
      );
    }

    if (filter === "all" || filter === "friends") {
      filteredFriends = friends.filter((f) =>
        f.name.toLowerCase().includes(lowerQuery)
      );
    }

    return { venues: filteredVenues, friends: filteredFriends };
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setIsSearching(query.length > 0);
    const results = filterResults(query, selectedFilter);
    setFilteredVenues(results.venues);
    setFilteredFriends(results.friends);
  };

  const handleFilterChange = (newFilter: string) => {
    const validFilter = (newFilter === "all" || newFilter === "venues" || newFilter === "friends") 
      ? newFilter 
      : "all";
    setSelectedFilter(validFilter as any);
    const results = filterResults(searchQuery, validFilter);
    setFilteredVenues(results.venues);
    setFilteredFriends(results.friends);

    if (validFilter === "friends") {
      fitMapToFriends();
      return;
    }

    if (validFilter === "venues") {
      fitMapToVenueGroups();
    }
  };

  // Funzione per navigare verso un luogo
  const navigateToVenue = (venue: any) => {
    if (isMountedRef.current && isActive && mapRef.current) {
      animateMapToRegion(
        {
          latitude: venue.latitude,
          longitude: venue.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        800
      );
    }
    setSearchQuery("");
    setIsSearching(false);
    setSelectedVenue(venue);
    setVenueModalOpen(true);
  };

  // Funzione per navigare verso un amico
  const navigateToFriend = (friend: Friend) => {
    if (
      typeof friend.latitude !== "number" ||
      typeof friend.longitude !== "number" ||
      !Number.isFinite(friend.latitude) ||
      !Number.isFinite(friend.longitude)
    ) {
      Alert.alert(
        "Posizione non disponibile",
        `${friend.name} non sta condividendo una posizione recente.`
      );
      return;
    }

    if (isMountedRef.current && isActive && mapRef.current) {
      animateMapToRegion(
        {
          latitude: friend.latitude,
          longitude: friend.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        800
      );
    }
    setSearchQuery("");
    setIsSearching(false);
  };

  const selectedVenueFriends = getFriendsAtVenue(selectedVenue?.name);
  const glassPanel = "rgba(9, 12, 24, 0.74)";
  const glassPanelStrong = "rgba(8, 10, 18, 0.92)";
  const glassBorder = "rgba(255,255,255,0.12)";
  const softText = "rgba(226,232,240,0.78)";
  const activeEventsCount = selectedVenueEventSections.active.length;
  const upcomingEventsCount = selectedVenueEventSections.upcoming.length;
  const selectedVenueDistanceKm =
    selectedVenue && userLocation
      ? calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          selectedVenue.latitude,
          selectedVenue.longitude
        )
      : null;
  const selectedVenueStatus = activeEventsCount > 0 ? "Live" : upcomingEventsCount > 0 ? "Upcoming" : "Open";
  const selectedVenuePreviewEvents = [
    ...selectedVenueEventSections.active,
    ...selectedVenueEventSections.upcoming,
  ].slice(0, 6);

  const openVenueInMaps = async () => {
    if (!selectedVenue) return;

    const addressLabel = selectedVenue.name || "Locale";
    const encodedDestination = encodeURIComponent(addressLabel);
    const coordinateQuery = `${selectedVenue.latitude},${selectedVenue.longitude}`;
    const googleMapsAppUrl = Platform.select({
      ios: `comgooglemaps://?center=${coordinateQuery}&q=${coordinateQuery}`,
      android: `google.navigation:q=${coordinateQuery}`,
      default: undefined,
    });
    const googleMapsWebUrl = `https://www.google.com/maps/search/?api=1&query=${coordinateQuery}`;

    try {
      if (googleMapsAppUrl) {
        const supported = await Linking.canOpenURL(googleMapsAppUrl);
        if (supported) {
          await Linking.openURL(googleMapsAppUrl);
          return;
        }
      }

      await Linking.openURL(googleMapsWebUrl);
      return;
    } catch {
      try {
        await Linking.openURL(googleMapsWebUrl);
        return;
      } catch {
        // fall through to alert below
      }
    }

    Alert.alert(
      "Impossibile aprire la mappa",
      `Non sono riuscito ad aprire Google Maps per ${decodeURIComponent(encodedDestination)}.`,
    );
  };

  const handleShareVenue = async () => {
    if (!selectedVenue) return;

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${selectedVenue.latitude},${selectedVenue.longitude}`;
    const details = [venueMeta(selectedVenue), `${activeEventsCount} eventi attivi`, `${selectedVenueFriends.length} amici qui`]
      .filter(Boolean)
      .join(" • ");

    try {
      await Share.share({
        message: `${selectedVenue.name}${details ? `\n${details}` : ""}\n${mapsUrl}`,
      });
    } catch {
      // Ignore share errors to avoid breaking the modal UX.
    }
  };

  const shouldShowVenueLayer = selectedFilter === "all" || selectedFilter === "venues";
  const shouldShowFriendLayer = selectedFilter === "all" || selectedFilter === "friends";

  const userMarkerElements: React.ReactElement[] = [];
  if (deviceLocationSharingEnabled !== false && userLocation) {
    userMarkerElements.push(
      <Marker key="user-location" coordinate={userLocation}>
        <View style={styles.userDotOuter}>
          <View style={styles.userDotInner} />
        </View>
      </Marker>
    );
  }

  const venueMarkerElements: React.ReactElement[] = [];
  if (shouldShowVenueLayer) {
    if (showClusters) {
      zoneClusters
        .filter((cluster) => cluster && cluster.latitude != null && cluster.longitude != null)
        .forEach((cluster, idx) => {
          venueMarkerElements.push(
            <Marker
              key={`cluster-${idx}-${cluster.latitude}-${cluster.longitude}`}
              coordinate={{
                latitude: cluster.latitude,
                longitude: cluster.longitude,
              }}
              onPress={() => {
                if (isMountedRef.current && mapRef.current) {
                  const clusterLats = cluster.venues.map((venue) => venue.latitude);
                  const clusterLons = cluster.venues.map((venue) => venue.longitude);

                  const minLat = Math.min(...clusterLats);
                  const maxLat = Math.max(...clusterLats);
                  const minLon = Math.min(...clusterLons);
                  const maxLon = Math.max(...clusterLons);

                  const centerLat = (minLat + maxLat) / 2;
                  const centerLon = (minLon + maxLon) / 2;

                  const latSpan = maxLat - minLat;
                  const lonSpan = maxLon - minLon;

                  const fitLatDelta = Math.max(0.012, latSpan * 1.8);
                  const fitLonDelta = Math.max(0.012, lonSpan * 1.8);

                  const nextLatDelta = Math.min(mapZoom * 0.75, fitLatDelta);
                  const nextLonDelta = Math.min(mapZoom * 0.75, fitLonDelta);

                  animateMapToRegion(
                    {
                      latitude: centerLat,
                      longitude: centerLon,
                      latitudeDelta: nextLatDelta,
                      longitudeDelta: nextLonDelta,
                    },
                    600
                  );
                }
              }}
            >
              <View
                style={[
                  styles.clusterMarker,
                  {
                    backgroundColor: glassPanelStrong,
                    borderColor: `${theme.colors.primary}88`,
                    shadowColor: theme.colors.primary,
                  },
                ]}
              >
                <View
                  style={[
                    styles.clusterMarkerInner,
                    { backgroundColor: `${theme.colors.primary}22` },
                  ]}
                >
                  <Text style={styles.clusterMarkerValue}>{cluster.venuesCount}</Text>
                  <Text style={styles.clusterMarkerLabel}>spots</Text>
                </View>
                {cluster.friendsCount > 0 ? (
                  <View
                    style={[
                      styles.clusterFriendBadge,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <Feather name="users" size={10} color="#fff" />
                    <Text style={styles.clusterFriendBadgeText}>{cluster.friendsCount}</Text>
                  </View>
                ) : null}
              </View>
            </Marker>
          );
        });
    } else {
      venues
        .filter((venue) => venue && venue.latitude != null && venue.longitude != null)
        .forEach((venue) => {
          const friendCount = getCountFriendsAtVenue(venue.name);
          const hasLotOfFriends = friendCount >= 3;
          const friendsAtVenue = getFriendsAtVenue(venue.name);
          const friendColor = friendsAtVenue.length > 0 ? friendsAtVenue[0].color : "#999";

          if (selectedFilter === "all") {
            venueMarkerElements.push(
              <Marker
                key={`venue-${venue.id}`}
                coordinate={{
                  latitude: venue.latitude,
                  longitude: venue.longitude,
                }}
                anchor={{ x: 0.5, y: 1 }}
                onPress={() => {
                  setSelectedVenue(venue);
                  setVenueModalOpen(true);
                }}
              >
                <View style={styles.liveVenueMarkerWrap}>
                  <View
                    style={[
                      styles.liveVenueLabel,
                      {
                        backgroundColor: glassPanelStrong,
                        borderColor: `${venue.color}55`,
                        shadowColor: venue.color,
                      },
                    ]}
                  >
                    <View style={[styles.liveVenueIndicator, { backgroundColor: venue.color }]} />
                    <Text style={styles.liveVenueLabelText}>{venue.name}</Text>
                  </View>
                  {friendCount > 0 ? (
                    <View
                      style={[
                        styles.liveVenueFriendBubble,
                        { backgroundColor: friendColor, shadowColor: friendColor },
                      ]}
                    >
                      <Feather name="users" size={11} color="#fff" />
                      <Text style={styles.liveVenueFriendText}>{friendCount}</Text>
                    </View>
                  ) : null}
                </View>
              </Marker>
            );
            return;
          }

          venueMarkerElements.push(
            <Marker
              key={`venue-${venue.id}`}
              coordinate={{
                latitude: venue.latitude,
                longitude: venue.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => {
                setSelectedVenue(venue);
                setVenueModalOpen(true);
              }}
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: hasLotOfFriends ? pulseAnim : 1,
                    },
                  ],
                }}
              >
                <View style={styles.pinPointerWrap}>
                  <View
                    style={[
                      styles.pinHead,
                      {
                        backgroundColor: glassPanelStrong,
                        borderColor: `${venue.color}88`,
                        shadowColor: venue.color,
                      },
                    ]}
                  >
                    <View style={[styles.pinCore, { backgroundColor: venue.color }]}>
                      <Feather
                        name="map-pin"
                        size={16}
                        color={venue.color === "#facc15" ? "#111827" : "#fff"}
                      />
                    </View>
                  </View>
                  <View
                    style={[
                      styles.pinTag,
                      {
                        backgroundColor: glassPanelStrong,
                        borderColor: glassBorder,
                      },
                    ]}
                  >
                    <Text style={styles.pinTagTitle}>{venue.name}</Text>
                    {friendCount > 0 ? (
                      <Text style={[styles.pinTagMeta, { color: softText }]}> 
                        {friendCount} amici qui
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Animated.View>
            </Marker>
          );
        });
    }
  }

  const hotZoneMarkerElements: React.ReactElement[] = [];
  if (shouldShowFriendLayer) {
    hotZones
      .filter((zone) => Number.isFinite(zone.latitude) && Number.isFinite(zone.longitude))
      .forEach((zone) => {
        hotZoneMarkerElements.push(
          <Marker
            key={`hot-${zone.venueId}`}
            coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => {
              const venue = venues.find((item) => item.id === zone.venueId);
              if (venue) {
                setSelectedVenue(venue);
                setVenueModalOpen(true);
              }
            }}
          >
            <View
              style={[
                styles.hotZoneMarker,
                {
                  backgroundColor:
                    zone.vibe === "hot" ? "rgba(239,68,68,0.18)" : "rgba(250,204,21,0.16)",
                  borderColor:
                    zone.vibe === "hot" ? "rgba(239,68,68,0.45)" : "rgba(250,204,21,0.38)",
                },
              ]}
            >
              <View
                style={[
                  styles.hotZoneCore,
                  {
                    backgroundColor:
                      zone.vibe === "hot" ? "rgba(239,68,68,0.88)" : "rgba(250,204,21,0.88)",
                  },
                ]}
              >
                <Feather name="zap" size={14} color="#111827" />
              </View>
              <Text style={styles.hotZoneValue}>{zone.friendCount} amici</Text>
              <Text style={styles.hotZoneMeta}>
                {zone.activeEventCount > 0
                  ? `${zone.activeEventCount} live`
                  : `${zone.upcomingEventCount} in arrivo`}
              </Text>
            </View>
          </Marker>
        );
      });
  }

  const friendMarkerElements: React.ReactElement[] = [];
  if (shouldShowFriendLayer) {
    visibleFriendsOnMap.forEach((friend) => {
      friendMarkerElements.push(
        <Marker
          key={`friend-${friend.id}`}
          coordinate={{
            latitude: Number(friend.latitude),
            longitude: Number(friend.longitude),
          }}
          anchor={{ x: 0.5, y: 1 }}
          onPress={() => navigateToFriend(friend)}
        >
          <Animated.View
            style={{
              transform: [
                {
                  scale:
                    friend.venuePresence?.type === "inside" && !friend.isStale
                      ? pulseAnim
                      : 1,
                },
              ],
            }}
          >
            <View style={styles.friendPresenceMarkerWrap}>
              <View
                style={[
                  styles.friendLastSeenPill,
                  {
                    backgroundColor: friend.isStale
                      ? "rgba(15,23,42,0.8)"
                      : glassPanelStrong,
                    borderColor: friend.isStale
                      ? "rgba(148,163,184,0.28)"
                      : `${friend.color}4d`,
                  },
                ]}
              >
                <Text style={styles.friendLastSeenText}>{friend.lastSeenLabel || "ora"}</Text>
              </View>

              <View
                style={[
                  styles.friendMapAvatarWrap,
                  {
                    borderColor: friend.color,
                    shadowColor: friend.color,
                    opacity: friend.isStale ? 0.72 : 1,
                  },
                ]}
              >
                <Image
                  source={{
                    uri:
                      friend.avatar ||
                      `https://i.pravatar.cc/150?img=${avatarSeedFromId(friend.id)}`,
                  }}
                  style={styles.friendMapAvatar}
                />
              </View>

              <View
                style={[
                  styles.friendMarkerTag,
                  {
                    backgroundColor: glassPanelStrong,
                    borderColor: glassBorder,
                  },
                ]}
              >
                <Text style={styles.friendMarkerTagTitle} numberOfLines={1}>
                  {friend.name}
                </Text>
                <Text style={[styles.friendMarkerTagMeta, { color: softText }]} numberOfLines={1}>
                  {friend.venuePresence?.type === "inside"
                    ? `Nel locale ${friend.venuePresence.venueName}`
                    : friend.venuePresence?.type === "nearby"
                      ? `Vicino a ${friend.venuePresence.venueName}`
                      : `Ultima posizione ${friend.lastSeenLabel}`}
                </Text>
              </View>
            </View>
          </Animated.View>
        </Marker>
      );
    });
  }

  return (
    <View style={styles.screenRoot}>
      <View style={styles.mapFrame}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_DEFAULT}
          initialRegion={
            mapRegion || {
              latitude: 45.4642,
              longitude: 9.1900,
              latitudeDelta: 0.025,
              longitudeDelta: 0.025,
            }
          }
          onRegionChangeComplete={(region) => {
            if (!isMountedRef.current || !isActive) {
              return;
            }

            currentRegionRef.current = region;
            currentZoomRef.current = region.latitudeDelta;

            if (zoomTimeoutRef.current) {
              clearTimeout(zoomTimeoutRef.current);
            }
            zoomTimeoutRef.current = setTimeout(() => {
              if (!isMountedRef.current || !isActive) {
                return;
              }

              if (Math.abs(region.latitudeDelta - mapZoom) > 0.005) {
                setMapZoom(region.latitudeDelta);
              }
            }, 100);
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          scrollEnabled={isActive}
          zoomEnabled={isActive}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {userMarkerElements}
          <UrlTile
            urlTemplate="https://{s}.basemaps.cartocdn.com/dark/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
          />
          {venueMarkerElements}
          {hotZoneMarkerElements}
          {friendMarkerElements}
        </MapView>

        <View style={styles.topOverlay}>
          <View style={styles.topMetricsRow}>
            <View
              style={[
                styles.topMetricPill,
                { backgroundColor: glassPanel, borderColor: glassBorder },
              ]}
            >
              <Feather
                name={deviceLocationSharingEnabled === false ? "slash" : "navigation"}
                size={12}
                color={deviceLocationSharingEnabled === false ? "#f87171" : theme.colors.primary}
              />
              <Text style={styles.topMetricPillText}>
                {friendMapLoading
                  ? "Sync mappa..."
                  : deviceLocationSharingEnabled === false
                    ? "Posizione off"
                    : "Posizione on"}
              </Text>
            </View>

            <View
              style={[
                styles.topMetricPill,
                { backgroundColor: glassPanel, borderColor: glassBorder },
              ]}
            >
              <Feather name="users" size={12} color={theme.colors.primary} />
              <Text style={styles.topMetricPillText}>{totalFriendsOnline} amici live</Text>
            </View>

            {totalHotZones > 0 ? (
              <View
                style={[
                  styles.topMetricPill,
                  { backgroundColor: glassPanel, borderColor: glassBorder },
                ]}
              >
                <Feather name="zap" size={12} color="#facc15" />
                <Text style={styles.topMetricPillText}>{totalHotZones} hot zone</Text>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.liveSearchBar,
              { backgroundColor: glassPanelStrong, borderColor: glassBorder },
            ]}
          >
            <View style={[styles.searchIconWrap, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
              <Feather name="search" size={16} color={softText} />
            </View>
            <TextInput
              style={[styles.searchInput, { color: "#fff" }]}
              placeholder="Cerca locali, amici o una zona..."
              placeholderTextColor={softText}
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRailContent}
          >
            {FILTER_OPTIONS.map((option) => {
              const isActiveFilter = selectedFilter === option.key;

              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => handleFilterChange(option.key)}
                  style={[
                    styles.liveFilterChip,
                    {
                      backgroundColor: isActiveFilter ? `${theme.colors.primary}20` : glassPanel,
                      borderColor: isActiveFilter ? `${theme.colors.primary}66` : glassBorder,
                    },
                  ]}
                >
                  <Feather
                    name={option.icon}
                    size={14}
                    color={isActiveFilter ? theme.colors.primary : softText}
                  />
                  <Text
                    style={[
                      styles.liveFilterChipText,
                      { color: isActiveFilter ? "#fff" : softText },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {isSearching && searchHasResults && (
            <View
              style={[
                styles.floatingSearchResults,
                { backgroundColor: glassPanelStrong, borderColor: glassBorder },
              ]}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                {filteredVenues.length > 0 && (
                  <>
                    <View style={styles.resultSectionHeader}>
                      <Feather name="map-pin" size={14} color={theme.colors.primary} />
                      <Text style={[styles.resultLabel, { color: theme.colors.text }]}>Locali</Text>
                    </View>
                    {filteredVenues.map((venue) => {
                      const friendCount = getCountFriendsAtVenue(venue.name);
                      const events = getVenueEvents(venue.id);
                      const venueInfo = venueMeta(venue);
                      const subtitleParts = [
                        venueInfo,
                        events.length > 0 ? `${events.length} eventi` : "",
                      ].filter(Boolean);

                      return (
                        <TouchableOpacity
                          key={venue.id}
                          onPress={() => navigateToVenue(venue)}
                          style={[
                            styles.resultItem,
                            {
                              backgroundColor: "rgba(255,255,255,0.05)",
                              borderColor: "rgba(255,255,255,0.08)",
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.resultItemName, { color: "#fff" }]}>{venue.name}</Text>
                            <Text style={[styles.resultItemMeta, { color: softText }]}>
                              {subtitleParts.length > 0 ? subtitleParts.join(" • ") : "Apri il dettaglio del locale"}
                            </Text>
                          </View>
                          <View style={styles.resultTrailingWrap}>
                            {friendCount > 0 && (
                              <View
                                style={[
                                  styles.countBadge,
                                  { backgroundColor: `${theme.colors.primary}20` },
                                ]}
                              >
                                <Feather name="users" size={12} color={theme.colors.primary} />
                                <Text
                                  style={[
                                    styles.countBadgeText,
                                    { color: theme.colors.primary },
                                  ]}
                                >
                                  {friendCount}
                                </Text>
                              </View>
                            )}
                            <Feather name="chevron-right" size={18} color={softText} />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {filteredFriends.length > 0 && (
                  <>
                    <View
                      style={[
                        styles.resultSectionHeader,
                        { marginTop: filteredVenues.length > 0 ? 12 : 0 },
                      ]}
                    >
                      <Feather name="users" size={14} color={theme.colors.primary} />
                      <Text style={[styles.resultLabel, { color: theme.colors.text }]}>Amici</Text>
                    </View>
                    {filteredFriends.map((friend) => {
                      const friendVenueName = friend.venue ?? friend.venuePresence?.venueName;
                      const venue = friendVenueName
                        ? venues.find((item) => item.name === friendVenueName)
                        : undefined;
                      const inVenue = Boolean(venue && isFriendInVenue(friend, venue));
                      const friendPresenceLabel = friend.venuePresence?.type === "inside"
                        ? `Nel locale ${friend.venuePresence.venueName}`
                        : friend.venuePresence?.type === "nearby"
                          ? `Vicino a ${friend.venuePresence.venueName}`
                          : friend.sharingEnabled
                            ? `Ultima posizione ${friend.lastSeenLabel}`
                            : "Posizione privata";

                      return (
                        <TouchableOpacity
                          key={friend.id}
                          onPress={() => navigateToFriend(friend)}
                          style={[
                            styles.resultItem,
                            {
                              backgroundColor: "rgba(255,255,255,0.05)",
                              borderColor: "rgba(255,255,255,0.08)",
                            },
                          ]}
                        >
                          <Image
                            source={{
                              uri:
                                friend.avatar ||
                                `https://i.pravatar.cc/150?img=${avatarSeedFromId(friend.id)}`,
                            }}
                            style={[styles.friendAvatar, { borderColor: friend.color }]}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.resultItemName, { color: "#fff" }]}>{friend.name}</Text>
                            <Text style={[styles.resultItemMeta, { color: softText }]}>
                              {inVenue && friendVenueName
                                ? `Nel locale ${friendVenueName}`
                                : friendPresenceLabel}
                            </Text>
                          </View>
                          {(inVenue || friend.venuePresence) && (
                            <View
                              style={[
                                styles.onlineIndicator,
                                { backgroundColor: friend.color },
                              ]}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </ScrollView>
            </View>
          )}

        {isSearching && !searchHasResults && (
          <View
            style={[
              styles.floatingSearchResults,
              styles.emptySearchContainer,
              { backgroundColor: glassPanelStrong, borderColor: glassBorder },
            ]}
          >
          <View
            style={[
              styles.emptySearchIcon,
              { backgroundColor: `${theme.colors.primary}12` },
            ]}
          >
            <Feather name="search" size={18} color={theme.colors.primary} />
          </View>
          <Text style={[styles.emptySearchTitle, { color: theme.colors.text }]}>Nessun risultato</Text>
          <Text style={[styles.emptySearchSubtitle, { color: theme.colors.muted }]}>
            Prova con un altro nome oppure cambia filtro per allargare la ricerca.
          </Text>
        </View>
        )}

        </View>

        <View style={styles.mapControls}>
          <TouchableOpacity
            onPress={handleRecenter}
            disabled={!userLocation}
            style={[
              styles.mapControlButton,
              {
                backgroundColor: theme.colors.primary,
                borderColor: `${theme.colors.primary}55`,
                opacity: userLocation ? 1 : 0.6,
              },
            ]}
          >
            <Feather name="navigation" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL PER MOSTRARE EVENTO E AMICI NEL LOCALE */}
      <Modal
        visible={venueModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setVenueModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "rgba(12, 15, 24, 0.98)",
              borderTopLeftRadius: 34,
              borderTopRightRadius: 34,
              maxHeight: "78%",
              paddingTop: 18,
              paddingHorizontal: 18,
              paddingBottom: 34,
              overflow: "hidden",
            }}
          >
            <View style={[styles.modalGlow, { backgroundColor: "rgba(255,255,255,0.04)" }]} />
            <View style={styles.modalInnerSheen} />
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: "rgba(255,255,255,0.18)" },
              ]}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 18,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: "800", color: "#fff" }}>
                    {selectedVenue?.name}
                  </Text>
                  {selectedVenue?.rating !== undefined && selectedVenue?.rating !== null && (
                    <View style={styles.modalRatingPill}>
                      <Feather name="star" size={11} color="#facc15" />
                      <Text style={styles.modalRatingText}>{selectedVenue.rating}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.modalMetaRow}>
                  <Feather name="navigation" size={14} color={softText} />
                  <Text style={styles.modalMetaText}>
                    {selectedVenueDistanceKm !== null
                      ? `${selectedVenueDistanceKm.toFixed(1)} km da te`
                      : venueMeta(selectedVenue) || "Scopri cosa succede stasera"}
                  </Text>
                </View>
                <Text style={[styles.sheetHelperText, { color: softText }]}> 
                  {activeEventsCount > 0
                    ? `${activeEventsCount} eventi attivi stasera`
                    : `${selectedVenueFriends.length} amici presenti ora`}
                </Text>
              </View>

              <View style={styles.modalHeaderActions}>
                <View
                  style={[
                    styles.modalStatusBadge,
                    {
                      backgroundColor:
                        selectedVenueStatus === "Live"
                          ? "rgba(239,68,68,0.14)"
                          : `${theme.colors.primary}18`,
                      borderColor:
                        selectedVenueStatus === "Live"
                          ? "rgba(239,68,68,0.34)"
                          : `${theme.colors.primary}3d`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.modalStatusDot,
                      {
                        backgroundColor:
                          selectedVenueStatus === "Live" ? "#ef4444" : theme.colors.primary,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.modalStatusText,
                      {
                        color:
                          selectedVenueStatus === "Live" ? "#f87171" : theme.colors.primary,
                      },
                    ]}
                  >
                    {selectedVenueStatus === "Live"
                      ? "In corso"
                      : selectedVenueStatus === "Upcoming"
                        ? "In arrivo"
                        : "Aperto"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setVenueModalOpen(false)}
                  style={styles.modalCloseButton}
                >
                  <Feather name="x" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={() => {
                  setVenueModalOpen(false);
                  void openVenueInMaps();
                }}
                style={styles.primaryModalAction}
              >
                <Feather name="navigation" size={18} color="#fff" />
                <Text style={styles.primaryModalActionText}>Indicazioni</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShareVenue} style={styles.secondaryModalAction}>
                <Feather name="share-2" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.sectionHeaderRow}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: "rgba(255,255,255,0.78)",
                    marginBottom: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.9,
                  }}
                >
                  In programma 
                </Text>
                <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: "600" }}>
                  {selectedVenuePreviewEvents.length} eventi
                </Text>
              </View>
              {venueEventsLoading ? (
                <Text style={{ color: softText, marginBottom: 16, fontStyle: "italic" }}>
                  Caricamento eventi...
                </Text>
              ) : selectedVenuePreviewEvents.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.modalEventRail}
                >
                  {selectedVenuePreviewEvents.map((event, index) => {
                    const isActiveEvent = selectedVenueEventSections.active.some(
                      (activeEvent) => activeEvent.id === event.id
                    );

                    return (
                      <TouchableOpacity
                        key={`preview-${event.id}`}
                        onPress={() => {
                          setVenueModalOpen(false);
                          onEventPress?.(event);
                        }}
                        style={styles.previewEventCard}
                      >
                        <View
                          style={[
                            styles.previewEventArtwork,
                            {
                              backgroundColor:
                                index % 2 === 0 ? "rgba(255,255,255,0.08)" : `${theme.colors.primary}20`,
                            },
                          ]}
                        >
                          <View style={styles.previewEventArtworkShade} />
                          <Text style={styles.previewEventTitle} numberOfLines={2}>
                            {event.title}
                          </Text>

                          <View style={styles.previewEventMetaStack}>
                            {event.date ? (
                              <View style={styles.previewEventMetaRow}>
                                <Feather
                                  name="calendar"
                                  size={12}
                                  color={isActiveEvent ? theme.colors.primary : "rgba(255,255,255,0.7)"}
                                />
                                <Text
                                  style={[
                                    styles.previewEventMetaText,
                                    { color: isActiveEvent ? theme.colors.primary : "rgba(255,255,255,0.82)" },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {event.date}
                                </Text>
                              </View>
                            ) : null}

                            <View style={styles.previewEventMetaRow}>
                              <Feather name="clock" size={12} color="rgba(255,255,255,0.72)" />
                              <Text style={styles.previewEventMetaText} numberOfLines={1}>
                                {event.time ? `${event.time}${event.endTime ? ` - ${event.endTime}` : ""}` : "Orario da confermare"}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={{ color: softText, marginBottom: 16, fontStyle: "italic" }}>
                  Nessun evento disponibile per questa venue
                </Text>
              )}

              <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}> 
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: "rgba(255,255,255,0.78)",
                    marginBottom: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.9,
                  }}
                >
                  Amici qui
                </Text>
              </View>
              {selectedVenueFriends.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.modalFriendsRail}
                >
                  {selectedVenueFriends.map((friend) => (
                    <View key={friend.id} style={styles.friendPresenceCard}>
                      <Image
                        source={{
                          uri:
                            friend.avatar ||
                            `https://i.pravatar.cc/150?img=${avatarSeedFromId(friend.id)}`,
                        }}
                        style={styles.friendPresenceAvatar}
                      />
                      <Text style={styles.friendPresenceName} numberOfLines={1}>
                        {friend.name}
                      </Text>
                      <View style={styles.friendPresenceStatusRow}>
                        <View
                          style={[
                            styles.friendPresenceDot,
                            { backgroundColor: friend.color },
                          ]}
                        />
                        <Text style={styles.friendPresenceStatusText}>
                          {friend.venuePresence?.type === "inside"
                            ? "Presenti ora"
                            : `Visti ${friend.lastSeenLabel}`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ color: softText, marginBottom: 16, fontStyle: "italic" }}>
                  Nessun amico presente al momento
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
  },
  mapFrame: {
    flex: 1,
    marginHorizontal: 0,
    borderRadius: 0,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#05070c",
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -40,
    top: -70,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    fontWeight: "500",
    maxWidth: "90%",
  },
  heroSummaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroSummaryText: {
    fontSize: 11,
    fontWeight: "700",
  },
  heroCompass: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  searchIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    fontWeight: "500",
  },
  clearSearchButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  liveSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  searchResultsContainer: {
    borderWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginHorizontal: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  floatingSearchResults: {
    position: "absolute",
    top: 214,
    left: 16,
    right: 16,
    zIndex: 30,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  emptySearchContainer: {
    alignItems: "center",
    paddingVertical: 22,
    paddingHorizontal: 24,
  },
  emptySearchIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptySearchTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySearchSubtitle: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  resultSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  resultCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  resultLeadingWrap: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  resultItemName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  resultItemMeta: {
    fontSize: 11,
    lineHeight: 16,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorDotLarge: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  resultTrailingWrap: {
    alignItems: "flex-end",
    gap: 8,
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  mapTopOverlay: {
    position: "absolute",
    top: 176,
    left: 14,
    right: 14,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  mapStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  mapStatusPillRight: {
    minWidth: 72,
    justifyContent: "center",
  },
  mapStatusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  mapStatusValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  mapStatusSubtext: {
    color: "rgba(226,232,240,0.72)",
    fontSize: 10,
    fontWeight: "600",
  },
  mapControls: {
    position: "absolute",
    right: 12,
    bottom: 124,
    alignItems: "flex-end",
    gap: 10,
  },
  mapInfoBadge: {
    minWidth: 72,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  mapInfoBadgeValue: {
    fontSize: 17,
    fontWeight: "800",
  },
  mapInfoBadgeLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  mapControlButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  userDotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.25)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
  },
  userDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#3b82f6",
    borderWidth: 2,
    borderColor: "#fff",
  },
  mapAtmosphereOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  mapTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: "rgba(4,6,12,0.56)",
  },
  mapBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
    backgroundColor: "rgba(4,6,12,0.48)",
  },
  topOverlay: {
    position: "absolute",
    top: 18,
    left: 16,
    right: 16,
    zIndex: 20,
    gap: 12,
  },
  topOverlayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  topMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  topMetricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  topMetricPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  filterRailContent: {
    paddingRight: 6,
    paddingLeft: 0,
    gap: 10,
  },
  liveFilterChip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveFilterChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  clusterMarker: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.36,
    shadowRadius: 18,
    elevation: 12,
  },
  clusterMarkerInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  clusterMarkerValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  clusterMarkerLabel: {
    color: "rgba(226,232,240,0.7)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  clusterFriendBadge: {
    position: "absolute",
    right: -6,
    bottom: -4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  clusterFriendBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  hotZoneMarker: {
    minWidth: 88,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  hotZoneCore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  hotZoneValue: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  hotZoneMeta: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  liveVenueMarkerWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  liveVenueLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  liveVenueIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  liveVenueLabelText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  liveVenueFriendBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  liveVenueFriendText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  pinPointerWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pinHead: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.36,
    shadowRadius: 18,
    elevation: 12,
  },
  pinCore: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  pinTag: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  pinTagTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  pinTagMeta: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  friendMarkerShell: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,10,18,0.9)",
    borderWidth: 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  friendMarkerGrid: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  friendMarkerGridCell: {
    width: "50%",
    height: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  friendMarkerOverflow: {
    borderRadius: 16,
  },
  friendMarkerOverflowText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  friendPresenceMarkerWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  friendLastSeenPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  friendLastSeenText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  friendMapAvatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    padding: 4,
    backgroundColor: "rgba(8,10,18,0.94)",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 10,
  },
  friendMapAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  friendMarkerTag: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    maxWidth: 156,
  },
  friendMarkerTagTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  friendMarkerTagMeta: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 14,
  },
  modalGlow: {
    position: "absolute",
    width: 360,
    height: 220,
    borderRadius: 120,
    top: -110,
    left: 0,
    right: 0,
    alignSelf: "center",
  },
  modalInnerSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  modalStatRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  modalStatCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  modalRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  modalRatingText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  modalMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalMetaText: {
    color: "rgba(226,232,240,0.78)",
    fontSize: 13,
    fontWeight: "500",
  },
  modalHeaderActions: {
    alignItems: "flex-end",
    gap: 10,
  },
  modalStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  modalStatusText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },
  primaryModalAction: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 6,
  },
  primaryModalActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryModalAction: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalEventRail: {
    paddingRight: 10,
    gap: 12,
  },
  previewEventCard: {
    width: 172,
    height: 112,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  previewEventArtwork: {
    flex: 1,
    padding: 14,
    justifyContent: "flex-end",
  },
  previewEventArtworkShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  previewEventRoom: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  previewEventTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 18,
    marginBottom: 10,
  },
  previewEventMetaStack: {
    gap: 4,
  },
  previewEventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewEventMetaText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "600",
    flex: 1,
  },
  previewEventTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  previewEventTimeText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "500",
  },
  modalFriendsRail: {
    paddingRight: 10,
    gap: 12,
  },
  friendPresenceCard: {
    width: 92,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  friendPresenceAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 10,
  },
  friendPresenceName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  friendPresenceStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  friendPresenceDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  friendPresenceStatusText: {
    color: "rgba(226,232,240,0.72)",
    fontSize: 10,
    fontWeight: "600",
  },
  sheetStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  sheetStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  sheetStatText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sheetHelperText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    fontWeight: "500",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionCountPill: {
    minWidth: 30,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: "center",
  },
  sectionCountPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  eventCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  eventLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eventLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventLiveBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  eventUpcomingBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eventUpcomingBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  eventStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  eventStatusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
});
