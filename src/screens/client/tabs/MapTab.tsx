import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from "react-native-maps";
import { useTheme } from "../../../theme/ThemeProvider";
import { MOCK_EVENTS } from "../../../data/mockEvents";

interface MapTabProps {
  onEventPress?: (event: any) => void;
}

interface Friend {
  id: string;
  name: string;
  color: string;
  latitude: number;
  longitude: number;
  venue: string;
}

interface Venue {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  color: string;
  events: number[];
  capacity: number;
  rating: number;
}

interface FriendGroup {
  latitude: number;
  longitude: number;
  friends: Friend[];
  venue: string;
}

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

// Helper: raggruppa amici per venue
const groupFriendsByVenue = (
  friends: Friend[],
  venues: Venue[]
): FriendGroup[] => {
  const groupMap: { [key: string]: FriendGroup } = {};

  friends.forEach((friend) => {
    const venue = venues.find((v) => v.name === friend.venue);
    if (venue) {
      const key = `${venue.latitude},${venue.longitude}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          latitude: venue.latitude,
          longitude: venue.longitude,
          friends: [],
          venue: friend.venue,
        };
      }
      groupMap[key].friends.push(friend);
    }
  });

  return Object.values(groupMap);
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
  friendsByVenue: { [key: string]: Friend[] }
): ZoneCluster[] => {
  // Divide la mappa in griglie di 0.05 gradi (approssimativamente 5km x 5km)
  const gridSize = 0.05;
  const clusterMap: { [key: string]: ZoneCluster } = {};

  venues.forEach((venue) => {
    const gridLat = Math.floor(venue.latitude / gridSize) * gridSize;
    const gridLon = Math.floor(venue.longitude / gridSize) * gridSize;
    const key = `${gridLat},${gridLon}`;

    if (!clusterMap[key]) {
      clusterMap[key] = {
        latitude: gridLat + gridSize / 2,
        longitude: gridLon + gridSize / 2,
        venuesCount: 0,
        friendsCount: 0,
        venues: [],
      };
    }

    clusterMap[key].venuesCount += 1;
    clusterMap[key].friendsCount += (friendsByVenue[venue.name]?.length || 0);
    clusterMap[key].venues.push(venue);
  });

  return Object.values(clusterMap);
};

export default function MapTab({ onEventPress }: MapTabProps) {
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
  const [filteredFriends, setFilteredFriends] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "friends" | "venues">("all");
  const [mapZoom, setMapZoom] = useState(0.08); // Track zoom level
  const mapRef = useRef<MapView>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapInitializedRef = useRef(false); // Track if map was already initialized
  const [mapRegion, setMapRegion] = useState<any>(null); // Store initial map region only
  const currentZoomRef = useRef(0.08); // Ref per tracciare lo zoom senza causare re-render

  // Animation refs per gli amici
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Mock friends data with locations
  const mockFriends: Friend[] = [
    {
      id: "1",
      name: "Marco",
      color: "#8b5cf6",
      latitude: 45.4642,
      longitude: 9.1900,
      venue: "Club Centrale",
    },
    {
      id: "2",
      name: "Giulia",
      color: "#22c55e",
      latitude: 45.4642,
      longitude: 9.1900,
      venue: "Club Centrale",
    },
    {
      id: "3",
      name: "Andrea",
      color: "#f59e0b",
      latitude: 45.4660,
      longitude: 9.1885,
      venue: "Night Lounge",
    },
    {
      id: "4",
      name: "Sofia",
      color: "#06b6d4",
      latitude: 45.4642,
      longitude: 9.1900,
      venue: "Club Centrale",
    },
    {
      id: "5",
      name: "Luca",
      color: "#ec4899",
      latitude: 45.4660,
      longitude: 9.1885,
      venue: "Night Lounge",
    },
    {
      id: "6",
      name: "Luca",
      color: "#ec4899",
      latitude: 45.4660,
      longitude: 9.1885,
      venue: "Night Lounge",
    },
    {
      id: "7",
      name: "Luca",
      color: "#ec4899",
      latitude: 45.4660,
      longitude: 9.1885,
      venue: "Night Lounge",
    },
  ];

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

  // Animazione pulse per venue con molti amici
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
    const distance = calculateDistance(
      friend.latitude,
      friend.longitude,
      venue.latitude,
      venue.longitude
    );
    return distance < 0.1; // 100 metri
  };

  // Get user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Permission to access location was denied");
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setUserLocation(coords);

        // Inizializza la mappa UNA SOLA VOLTA con la posizione dell'utente
        if (!mapInitializedRef.current) {
          setMapRegion({
            ...coords,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          });
          mapInitializedRef.current = true;

          // Animate map to user location
          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                ...coords,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              },
              1000
            );
          }
        }
      } catch (err) {
        console.log("Error getting location:", err);
      }
    })();
  }, []);

  // Group friends by venue (solo se effettivamente nel locale)
  const friendsByVenue = useMemo(() => {
    const grouped: { [key: string]: Friend[] } = {};
    mockFriends.forEach((friend) => {
      const venue = mockVenues.find((v) => v.name === friend.venue);
      if (venue && isFriendInVenue(friend, venue)) {
        if (!grouped[friend.venue]) {
          grouped[friend.venue] = [];
        }
        grouped[friend.venue].push(friend);
      }
    });
    return grouped;
  }, []);

  // Raggruppa amici per localizzazione
  const friendGroups = useMemo(() => {
    const groups = groupFriendsByVenue(
      mockFriends.filter((f) => {
        const venue = mockVenues.find((v) => v.name === f.venue);
        return venue && isFriendInVenue(f, venue);
      }),
      mockVenues
    );
    // Filtra solo i gruppi con coordinate valide
    return groups.filter(
      (group) =>
        group.latitude !== null &&
        group.latitude !== undefined &&
        group.longitude !== null &&
        group.longitude !== undefined &&
        group.friends.length > 0
    );
  }, []);

  // Crea cluster di zone quando zoomato out
  const zoneClusters = useMemo(() => {
    return createZoneClusters(mockVenues, friendsByVenue);
  }, [friendsByVenue]);

  // Determina se mostrare cluster o marker singoli (zoom > 0.10 = cluster, zoom <= 0.10 = marker dettagliati)
  // 0.10 = visuale a livello di città (50-100km), mostra locali e amici in dettaglio
  const showClusters = mapZoom > 0.12;

  // Get events for a venue
  const getVenueEvents = (venueId: string) => {
    const venue = mockVenues.find((v) => v.id === venueId);
    if (!venue) return [];
    return MOCK_EVENTS.filter((e) => venue.events.includes(parseInt(e.id)));
  };

  // Get friends at a venue
  const getFriendsAtVenue = (venueName: string) => {
    return friendsByVenue[venueName] || [];
  };

  // Conta amici per venue
  const getCountFriendsAtVenue = (venueName: string): number => {
    return getFriendsAtVenue(venueName).length;
  };

  // Logica di ricerca con filtri
  const filterResults = (query: string, filter: string) => {
    if (query.length === 0) {
      return { venues: [], friends: [] };
    }

    const lowerQuery = query.toLowerCase();
    let filteredVenues: Venue[] = [];
    let filteredFriends: Friend[] = [];

    if (filter === "all" || filter === "venues") {
      filteredVenues = mockVenues.filter((v) =>
        v.name.toLowerCase().includes(lowerQuery)
      );
    }

    if (filter === "all" || filter === "friends") {
      filteredFriends = mockFriends.filter((f) =>
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
  };

  // Funzione per navigare verso un luogo
  const navigateToVenue = (venue: any) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
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
  const navigateToFriend = (friend: any) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
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

  return (
    <View style={{ flex: 1, marginTop: 12 }}>
      {/* Titolo e Filtri */}
      <View style={{ paddingHorizontal: 4, marginBottom: 12 }}>
        <Text style={[styles.placeholderTitle, { color: theme.colors.text, marginBottom: 12 }]}>
          Mappa
        </Text>

        {/* Filtri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12, marginLeft: -4 }}
        >
          {["all", "venues", "friends"].map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => {
                handleFilterChange(filter);
              }}
              style={[
                styles.filterButton,
                {
                  backgroundColor:
                    selectedFilter === filter
                      ? theme.colors.primary
                      : theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    selectedFilter === filter
                      ? "#fff"
                      : theme.colors.text,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {filter === "all" && "Tutto"}
                {filter === "venues" && "📍 Locali"}
                {filter === "friends" && "👥 Amici"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Feather name="search" size={18} color={theme.colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Cerca un locale o un amico..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Feather name="x" size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Risultati Ricerca */}
      {isSearching && (filteredVenues.length > 0 || filteredFriends.length > 0) && (
        <View
          style={[
            styles.searchResultsContainer,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 280 }}
          >
            {/* Locali trovati */}
            {filteredVenues.length > 0 && (
              <>
                <Text style={[styles.resultLabel, { color: theme.colors.text }]}>
                  📍 Locali ({filteredVenues.length})
                </Text>
                {filteredVenues.map((venue) => {
                  const friendCount = getCountFriendsAtVenue(venue.name);
                  return (
                    <TouchableOpacity
                      key={venue.id}
                      onPress={() => navigateToVenue(venue)}
                      style={[
                        styles.resultItem,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <View style={[styles.colorDot, { backgroundColor: venue.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultItemName, { color: theme.colors.text }]}>
                          {venue.name}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <Text style={[styles.resultItemMeta, { color: theme.colors.muted }]}>
                            ⭐ {venue.rating}
                          </Text>
                          <Text style={[styles.resultItemMeta, { color: theme.colors.muted }]}>
                            {venue.capacity} posti
                          </Text>
                          {friendCount > 0 && (
                            <Text style={[styles.resultItemMeta, { color: theme.colors.primary, fontWeight: "700" }]}>
                              👥 {friendCount}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Feather name="chevron-right" size={18} color={theme.colors.muted} />
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Amici trovati */}
            {filteredFriends.length > 0 && (
              <>
                <Text
                  style={[
                    styles.resultLabel,
                    {
                      color: theme.colors.text,
                      marginTop: filteredVenues.length > 0 ? 12 : 0,
                    },
                  ]}
                >
                  👥 Amici ({filteredFriends.length})
                </Text>
                {filteredFriends.map((friend) => {
                  const venue = mockVenues.find((v) => v.name === friend.venue);
                  const inVenue = venue && isFriendInVenue(friend, venue);

                  return (
                    <TouchableOpacity
                      key={friend.id}
                      onPress={() => navigateToFriend(friend)}
                      style={[
                        styles.resultItem,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Image
                        source={{
                          uri: `https://i.pravatar.cc/150?img=${parseInt(friend.id) + 2}`,
                        }}
                        style={[styles.friendAvatar, { borderColor: friend.color }]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultItemName, { color: theme.colors.text }]}>
                          {friend.name}
                        </Text>
                        <Text style={[styles.resultItemMeta, { color: theme.colors.muted }]}>
                          {inVenue ? `✓ ${friend.venue}` : "Offline"}
                        </Text>
                      </View>
                      {inVenue && (
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

      {/* Mappa */}
      <View
        style={{
          flex: isSearching ? 0 : 1,
          height: isSearching ? 250 : undefined,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: theme.colors.card,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 5,
          marginHorizontal: 4,
        }}
      >
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_DEFAULT}
          initialRegion={
            mapRegion || {
              latitude: 45.4642,
              longitude: 9.1900,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }
          }
          onRegionChangeComplete={(region) => {
            // Traccia lo zoom usando ref (non causa re-render)
            currentZoomRef.current = region.latitudeDelta;
            
            // Aggiorna lo state immediatamente per cambio cluster/marker istantaneo
            if (zoomTimeoutRef.current) {
              clearTimeout(zoomTimeoutRef.current);
            }
            zoomTimeoutRef.current = setTimeout(() => {
              // Solo aggiorna se il cambio è significativo (almeno 0.005 di differenza)
              if (Math.abs(region.latitudeDelta - mapZoom) > 0.005) {
                setMapZoom(region.latitudeDelta);
              }
            }, 100); // Cambio veloce e istantaneo
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={false}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {/* TILE MAPPA CARTODB DARK - GRATUITO E MINIMALIST */}
          <UrlTile
            urlTemplate="https://{s}.basemaps.cartocdn.com/dark/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
          />

          {/* 🟡 MARKER LOCALI O CLUSTER - DIPENDE DAL ZOOM */}
          {(selectedFilter === "all" || selectedFilter === "venues") &&
            (showClusters
              ? // Mostra cluster di zone quando zoomato out
                zoneClusters
                  .filter((cluster) => cluster && cluster.latitude != null && cluster.longitude != null)
                  .map((cluster, idx) => (
                  <Marker
                    key={`cluster-${idx}-${cluster.latitude}-${cluster.longitude}`}
                    coordinate={{
                      latitude: cluster.latitude,
                      longitude: cluster.longitude,
                    }}
                    onPress={() => {
                      // Zoom meno aggressivo quando clicca sul cluster
                      if (mapRef.current) {
                        mapRef.current.animateToRegion(
                          {
                            latitude: cluster.latitude,
                            longitude: cluster.longitude,
                            latitudeDelta: 0.06,
                            longitudeDelta: 0.06,
                          },
                          600
                        );
                      }
                    }}
                  >
                    <View
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: theme.colors.primary,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 2,
                        borderColor: "#fff",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.5,
                        shadowRadius: 8,
                        elevation: 1000,
                      }}
                    >
                      <View style={{ alignItems: "center" }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "800",
                            color: "#fff",
                            textAlign: "center",
                          }}
                        >
                          {cluster.venuesCount}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: "#fff",
                            marginTop: 1,
                          }}
                        >
                          📍
                        </Text>
                      </View>
                      {cluster.friendsCount > 0 && (
                        <View
                          style={{
                            position: "absolute",
                            bottom: -8,
                            right: -8,
                            backgroundColor: "#ec4899",
                            borderRadius: 12,
                            paddingHorizontal: 5,
                            paddingVertical: 2,
                            borderWidth: 1,
                            borderColor: "#fff",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "700",
                              color: "#fff",
                            }}
                          >
                            {cluster.friendsCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Marker>
                ))
              : // Mostra marker singoli quando zoomato in
                mockVenues
                  .filter((venue) => venue && venue.latitude != null && venue.longitude != null)
                  .map((venue) => {
                  const friendCount = getCountFriendsAtVenue(venue.name);
                  const hasLotOfFriends = friendCount >= 3;
                  const friendsAtVenue = getFriendsAtVenue(venue.name);
                  const friendColor = friendsAtVenue.length > 0 ? friendsAtVenue[0].color : "#999";

                  // Quando filtro è "tutto", mostra nome + pallino amici
                  if (selectedFilter === "all") {
                    return (
                      <Marker
                        key={`venue-${venue.id}`}
                        coordinate={{
                          latitude: venue.latitude,
                          longitude: venue.longitude,
                        }}
                        onPress={() => {
                          setSelectedVenue(venue);
                          setVenueModalOpen(true);
                        }}
                      >
                        <View
                          style={{
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {/* Nome locale */}
                          <View
                            style={{
                              backgroundColor: venue.color,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 16,
                              borderWidth: 2,
                              borderColor: "#000",
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 3 },
                              shadowOpacity: 0.4,
                              shadowRadius: 5,
                              elevation: 100,
                              marginBottom: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontWeight: "700",
                                fontSize: 10,
                                color: venue.color === "#facc15" ? "#000" : "#fff",
                              }}
                            >
                              {venue.name}
                            </Text>
                          </View>
                          {/* Pallino amici sotto */}
                          {friendCount > 0 && (
                            <View
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: friendColor,
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 2,
                                borderColor: "#fff",
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 4,
                                elevation: 50,
                              }}
                            >
                              <Text
                                style={{
                                  fontWeight: "800",
                                  fontSize: 12,
                                  color: "#fff",
                                }}
                              >
                                {friendCount}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Marker>
                    );
                  }

                  // Quando filtro è "locali", mostra UI originale
                  return (
                    <Marker
                      key={`venue-${venue.id}`}
                      coordinate={{
                        latitude: venue.latitude,
                        longitude: venue.longitude,
                      }}
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
                        <View
                          style={{
                            backgroundColor: venue.color,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 18,
                            borderWidth: 2,
                            borderColor: "#000",
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.4,
                            shadowRadius: 6,
                            elevation: 100,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "700",
                              fontSize: 11,
                              color: venue.color === "#facc15" ? "#000" : "#fff",
                              marginBottom: friendCount > 0 ? 2 : 0,
                            }}
                          >
                            {venue.name}
                          </Text>
                          {friendCount > 0 && (
                            <View
                              style={{
                                backgroundColor:
                                  venue.color === "#facc15"
                                    ? "rgba(0, 0, 0, 0.1)"
                                    : "rgba(255, 255, 255, 0.2)",
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 6,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 8,
                                  fontWeight: "700",
                                  color: venue.color === "#facc15" ? "#000" : "#fff",
                                }}
                              >
                                👥 {friendCount}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Animated.View>
                    </Marker>
                  );
                }))}

          {/* 🟣 MARKER AMICI RAGGRUPPATI - MOSTRA SOLO SE FILTRO È "friends" E NON IN CLUSTER VIEW */}
          {!showClusters &&
            selectedFilter === "friends" &&
            friendGroups
              .filter(
                (group) =>
                  group &&
                  group.latitude != null &&
                  group.longitude != null &&
                  group.friends.length > 0
              )
              .map((group, index) => {
              const visibleFriends = group.friends.slice(0, 3);
              const hiddenCount = Math.max(0, group.friends.length - 3);
              
              // Nessun offset quando filtro è solo "friends"
              const friendMarkerLat = group.latitude;
              const friendMarkerLon = group.longitude;

              return (
                <Marker
                  key={`friend-group-${group.latitude}-${group.longitude}-${group.friends.length}`}
                  coordinate={{
                    latitude: Number(friendMarkerLat),
                    longitude: Number(friendMarkerLon),
                  }}
                  onPress={() => {
                    if (mapRef.current) {
                      mapRef.current.animateToRegion(
                        {
                          latitude: group.latitude,
                          longitude: group.longitude,
                          latitudeDelta: 0.04,
                          longitudeDelta: 0.04,
                        },
                        500
                      );
                    }
                  }}
                >
                  <Animated.View
                    style={{
                      transform: [{ scale: group.friends.length > 1 ? pulseAnim : 1 }],
                    }}
                  >
                    <View
                      style={{
                        width: group.friends.length === 1 ? 50 : 75,
                        height: group.friends.length === 1 ? 50 : 75,
                        borderRadius: group.friends.length === 1 ? 25 : 40,
                        backgroundColor: "#fff",
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.4,
                        shadowRadius: 8,
                        elevation: 50,
                        borderWidth: 3,
                        borderColor: group.friends[0].color,
                        overflow: "hidden",
                      }}
                    >
                      {group.friends.length === 1 ? (
                        <Image
                          source={{
                            uri: `https://i.pravatar.cc/150?img=${parseInt(group.friends[0].id) + 2}`,
                          }}
                          style={{ width: 44, height: 44, borderRadius: 22 }}
                        />
                      ) : (
                        <View
                          style={{
                            width: "100%",
                            height: "100%",
                            flexDirection: "row",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {visibleFriends.map((friend, idx) => (
                            <View
                              key={friend.id}
                              style={{
                                width: "50%",
                                height: "50%",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Image
                                source={{
                                  uri: `https://i.pravatar.cc/150?img=${parseInt(friend.id) + 2}`,
                                }}
                                style={{
                                  width: hiddenCount > 0 ? 24 : 28,
                                  height: hiddenCount > 0 ? 24 : 28,
                                  borderRadius: hiddenCount > 0 ? 12 : 14,
                                }}
                              />
                            </View>
                          ))}
                          {hiddenCount > 0 && (
                            <View
                              style={{
                                width: "50%",
                                height: "50%",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: theme.colors.primary,
                                borderRadius: 14,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: "700",
                                  color: "#fff",
                                }}
                              >
                                +{hiddenCount}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </Animated.View>
                </Marker>
              );
            })}
        </MapView>
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
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: "85%",
              paddingTop: 20,
              paddingHorizontal: 18,
              paddingBottom: 30,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 16,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <View
                    style={[
                      styles.colorDot,
                      {
                        backgroundColor: selectedVenue?.color,
                        marginRight: 10,
                      },
                    ]}
                  />
                  <Text style={{ fontSize: 20, fontWeight: "700", color: theme.colors.text }}>
                    {selectedVenue?.name}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: theme.colors.muted, marginLeft: 35 }}>
                  ⭐ {selectedVenue?.rating} • {selectedVenue?.capacity} posti
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setVenueModalOpen(false)}
                style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: 12,
                  padding: 8,
                }}
              >
                <Feather name="x" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* EVENTI NEL LOCALE */}
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: theme.colors.text,
                  marginBottom: 12,
                }}
              >
                🎉 Eventi
              </Text>
              {getVenueEvents(selectedVenue?.id).length > 0 ? (
                getVenueEvents(selectedVenue?.id).map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => {
                      setVenueModalOpen(false);
                      onEventPress?.(event);
                    }}
                    style={{
                      backgroundColor: theme.colors.card,
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 10,
                      borderLeftWidth: 4,
                      borderLeftColor: theme.colors.primary,
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        color: theme.colors.text,
                        marginBottom: 6,
                        fontSize: 14,
                      }}
                    >
                      {event.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.colors.muted }}>
                      📅 {event.date}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text
                  style={{
                    color: theme.colors.muted,
                    marginBottom: 16,
                    fontStyle: "italic",
                  }}
                >
                  Nessun evento disponibile
                </Text>
              )}

              {/* AMICI NEL LOCALE */}
              {getFriendsAtVenue(selectedVenue?.name).length > 0 && (
                <>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: theme.colors.text,
                      marginBottom: 12,
                      marginTop: 20,
                    }}
                  >
                    👥 Amici qui ({getFriendsAtVenue(selectedVenue?.name).length})
                  </Text>
                  {getFriendsAtVenue(selectedVenue?.name).map((friend) => (
                    <View
                      key={friend.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: theme.colors.card,
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 10,
                        borderLeftWidth: 4,
                        borderLeftColor: friend.color,
                      }}
                    >
                      <Image
                        source={{
                          uri: `https://i.pravatar.cc/150?img=${parseInt(friend.id) + 2}`,
                        }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          marginRight: 14,
                          borderWidth: 2,
                          borderColor: friend.color,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontWeight: "700",
                            color: theme.colors.text,
                            marginBottom: 2,
                          }}
                        >
                          {friend.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: theme.colors.muted,
                          }}
                        >
                          Online
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.onlineIndicator,
                          { backgroundColor: friend.color },
                        ]}
                      />
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholderTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
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
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    fontWeight: "500",
  },
  searchResultsContainer: {
    borderWidth: 1,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginHorizontal: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
    marginLeft: 4,
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
  resultItemName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  resultItemMeta: {
    fontSize: 11,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
});
