import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import FilterModal from "../../../components/FilterModal";
import SearchBar from "../../../components/SearchBar";
import { useTheme } from "../../../theme/ThemeProvider";
import { useEvents } from "../../../hooks/useEvents";
import { usePromos } from "../../../hooks/usePromos";
import { useVenues } from "../../../hooks/useVenues";
import { useAuth } from "../../../providers/AuthProvider";
import type { Event as ApiEvent, Promo as ApiPromo, Venue as ApiVenue } from "../../../types/events";
import type { HomeFilters } from "../../../types/ui";
import { resolveEventImageUri } from "../../../utils/media";

interface HomeTabProps {
  query: string;
  onQueryChange: (q: string) => void;
  filters: HomeFilters;
  userPromos: string[];
  promoFilter: string | null;
  onPromoFilterChange: (id: string | null) => void;
  onFiltersChange: React.Dispatch<React.SetStateAction<HomeFilters>>;
  onEventPress: (item: any) => void;
  onPromoPress: (promo: any) => void;
  onToggleTheme: () => void;
  isDark: boolean;
}

export default function HomeTab({
  query,
  onQueryChange,
  filters,
  userPromos,
  promoFilter,
  onPromoFilterChange,
  onFiltersChange,
  onEventPress,
  onPromoPress,
  onToggleTheme,
  isDark,
}: HomeTabProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buongiorno,';
    if (hour < 18) return 'Buon pomeriggio,';
    return 'Buonasera,';
  };

  const isEventVisibleByStatus = (status?: string) => {
    const normalized = String(status ?? '').trim().toUpperCase();
    if (!normalized) return true;
    if (normalized === 'CLOSED') return false;
    return normalized === 'LIVE' || normalized === 'SCHEDULED' || normalized === 'DRAFT';
  };

  const {
    data: eventsData,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useEvents();

  const {
    data: promosData,
    loading: promosLoading,
    refetch: refetchPromos,
  } = usePromos();

  const {
    data: venuesData,
    loading: venuesLoading,
    error: venuesError,
    refetch: refetchVenues,
  } = useVenues();

  type UiPromo = {
    id: string;
    title: string;
    details: string;
    discount: string;
    until: string;
    image?: string;
    accentColor: string;
    scope: 'event' | 'venue';
    eventId?: string;
    eventTitle?: string;
    eventDate?: string;
    venueName?: string;
    _raw?: ApiPromo;
  };

  type UiEvent = {
    id: string;
    title: string;
    date: string;
    time: string;
    venue: string;
    city: string;
    tags: string[];
    promos: UiPromo[];
    image: string;
    venueId?: string;
    statusLabel: string;
    accentColor: string;
    _raw?: ApiEvent;
  };

  const fallbackImage = (seed: string) =>
    `https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3&s=${encodeURIComponent(seed)}`;

  const formatShortDate = (value?: string) => {
    if (!value) return '';
    const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
    if (Number.isNaN(d.getTime())) return value;
    const s = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    const parts = s.split(' ');
    if (parts.length >= 2) {
      parts[1] = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    }
    return parts.join(' ');
  };

  const formatTime = (start?: string, end?: string) => {
    const clean = (t?: string) => {
      if (!t) return '';
      // already HH:MM or HH:MM:SS
      if (/^\d{2}:\d{2}/.test(t)) return t.slice(0, 5);
      const d = new Date(t);
      if (!Number.isNaN(d.getTime())) {
        try {
          return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        } catch {
          return d.toISOString().slice(11, 16);
        }
      }
      return '';
    };

    const s = clean(start);
    const e = clean(end);
    if (s && e) return `${s}-${e}`;
    return s || e || '';
  };

  const formatDiscount = (p: ApiPromo) => {
    const type = (p.discount_type || '').toLowerCase();
    const value = p.discount_value;
    if (type === 'percentage' && typeof value === 'number') return `${value}%`;
    if (type === 'fixed' && typeof value === 'number') return `€${value}`;
    if (type === 'free') return 'Gratis';
    return 'Offerta';
  };

  const accentPalette = ["#9B5CFF", "#3DD9B3", "#58A6FF", "#F5B942", "#FF6B8A"];

  const getAccentColor = (seed: string) => {
    const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return accentPalette[total % accentPalette.length];
  };

  const getStatusLabel = (event: ApiEvent, promoCount: number) => {
    const rawStatus = String((event as any)?.status ?? "").toUpperCase();
    const isTonight = isEventTonight(event);
    if (rawStatus === "LIVE") return "Live ora";
    if ((event as any)?.is_featured) return "In evidenza";
    if (isTonight) return "Stasera";
    if (promoCount >= 3) return "Molto richiesto";
    if (promoCount > 0) return "In evidenza";
    return "Consigliato";
  };

  const isSameLocalDay = (date: Date, compare: Date) =>
    date.getFullYear() === compare.getFullYear() &&
    date.getMonth() === compare.getMonth() &&
    date.getDate() === compare.getDate();

  const isEventTonight = (event: ApiEvent) => {
    if (!event?.date) return false;
    const raw = String(event.date).trim();
    const parsed = new Date(raw.length === 10 ? `${raw}T20:00:00` : raw);
    if (Number.isNaN(parsed.getTime())) return false;
    return isSameLocalDay(parsed, new Date());
  };

  const promosUi = useMemo<UiPromo[]>(() => {
    const list = promosData ?? [];
    const events = eventsData ?? [];
    const venues = venuesData ?? [];
    const eventById = new Map(events.map((e) => [e.id, e] as const));
    const venueById = new Map(venues.map((v) => [v.id, v] as const));
    const mapped = list
      .map((p): UiPromo | null => {
      const linkedEvent = p.event_id ? eventById.get(p.event_id) : undefined;
      if (linkedEvent && !isEventVisibleByStatus((linkedEvent as any)?.status)) return null;

      const venue = p.venue_id
        ? venueById.get(p.venue_id)
        : (linkedEvent?.venue_id ? venueById.get(linkedEvent.venue_id) : undefined);

      const untilRaw = (p as any).validUntil || p.valid_to || (p as any).validUntil || p.validUntil;
      const until = formatShortDate(untilRaw) || formatShortDate(linkedEvent?.date) || '';

      const scope: 'event' | 'venue' = p.event_id ? 'event' : 'venue';

      return {
        id: p.id,
        title: p.title,
        details: p.details || p.description || '',
        discount: formatDiscount(p),
        until,
        accentColor: getAccentColor(p.id),
        scope,
        eventId: linkedEvent?.id,
        eventTitle: linkedEvent?.name,
        eventDate: formatShortDate(linkedEvent?.date),
        venueName: (venue as any)?.name || '',
        _raw: p,
      };
    })
    .filter((p): p is UiPromo => p !== null);

    // de-dup by id
    const seen = new Set<string>();
    return mapped.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [promosData, eventsData, venuesData]);

  const eventsUi = useMemo<UiEvent[]>(() => {
    const events = eventsData ?? [];
    const allPromos = promosData ?? [];
    const venues: ApiVenue[] = venuesData ?? [];
    const venueById = new Map(venues.map((v) => [v.id, v] as const));

    // index promos by event_id and venue_id (venue-only promos apply to all venue events)
    const promosByEvent = new Map<string, ApiPromo[]>();
    const promosByVenue = new Map<string, ApiPromo[]>();
    for (const p of allPromos) {
      if (p.event_id) promosByEvent.set(p.event_id, [...(promosByEvent.get(p.event_id) ?? []), p]);
      if (!p.event_id && p.venue_id) {
        promosByVenue.set(p.venue_id, [...(promosByVenue.get(p.venue_id) ?? []), p]);
      }
    }

    const mapPromo = (p: ApiPromo, event?: ApiEvent, venue?: ApiVenue): UiPromo => {
      const img = (event as any)?.image || (venue as any)?.image || fallbackImage(p.id);
      const untilRaw = (p as any).validUntil || p.valid_to || (p as any).validUntil || p.validUntil;
      const until = formatShortDate(untilRaw) || formatShortDate(event?.date) || '';
      return {
        id: p.id,
        title: p.title,
        details: p.details || p.description || '',
        discount: formatDiscount(p),
        until,
        accentColor: getAccentColor(p.id),
        scope: p.event_id || event?.id ? 'event' : 'venue',
        image: resolveEventImageUri(img) || img,
        _raw: p,
      };
    };

    return events
      .filter((e) => isEventVisibleByStatus((e as any)?.status))
      .map((e) => {
      const venue = e.venue_id ? venueById.get(e.venue_id) : undefined;
      const mergedPromos: ApiPromo[] = [
        ...(e.promos ?? []),
        ...(promosByEvent.get(e.id) ?? []),
        ...(e.venue_id ? (promosByVenue.get(e.venue_id) ?? []) : []),
      ];
      const uniquePromos = Array.from(new Map(mergedPromos.map((p) => [p.id, p] as const)).values());
      const tags = (e.tags && e.tags.length ? e.tags : ['Serata']).map((t) => String(t));
      const accentColor = getAccentColor(e.id);
      return {
        id: e.id,
        title: e.name,
        date: formatShortDate(e.date),
        time: formatTime(e.start_time, e.end_time),
        venue: (venue as any)?.name || e.venue_id || 'Locale',
        venueId: e.venue_id,
        city: (venue as any)?.city || '',
        tags,
        promos: uniquePromos.map((p) => mapPromo(p, e, venue)),
        image: resolveEventImageUri((e as any).image || (venue as any)?.image) || fallbackImage(e.id),
        statusLabel: getStatusLabel(e, uniquePromos.length),
        accentColor,
        _raw: e,
      };
    });
  }, [eventsData, promosData, venuesData]);

  const hasPromos = promosUi.length > 0;
  const blockingError = eventsError || venuesError;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedCategories = new Set(filters.categories.map((category) => category.toLowerCase()));
    const selectedPromoTypes = new Set(filters.promoTypes.map((promoType) => promoType.toLowerCase()));

    let list = eventsUi.filter((e) => {
      if (selectedCategories.size > 0) {
        const eventTags = new Set(e.tags.map((tag) => tag.toLowerCase()));
        const hasMatchingCategory = Array.from(selectedCategories).some((category) => eventTags.has(category));
        if (!hasMatchingCategory) return false;
      }

      if (!q) return true;

      return (
        e.title.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        e.tags.join(" ").toLowerCase().includes(q)
      );
    });

    if (promoFilter && hasPromos) {
      list = list.filter((e) => e.promos && e.promos.some((p: any) => p.id === promoFilter));
    }

    if (filters.onlyMyPromos && hasPromos) {
      const userSet = new Set(userPromos);
      list = list.filter((e) => e.promos && e.promos.some((p: any) => userSet.has(p.id)));
    }

    if (selectedPromoTypes.size > 0 && hasPromos) {
      list = list.filter((e) =>
        e.promos && e.promos.some((p: any) => selectedPromoTypes.has(String(p.title ?? "").toLowerCase())),
      );
    }

    return list;
  }, [query, filters, promoFilter, userPromos, eventsUi, hasPromos]);

  const dbFeaturedEvents = useMemo(
    () => filtered.filter((event) => Boolean((event._raw as any)?.is_featured)),
    [filtered],
  );

  const featuredEvents = dbFeaturedEvents.slice(0, 5);
  const curatedEvents = filtered.filter((event) => !featuredEvents.some((featured) => featured.id === event.id)).slice(0, 6);
  const fallbackCuratedEvents = featuredEvents.slice(0, 2);
  const curatedFeed = curatedEvents.length ? curatedEvents : fallbackCuratedEvents;
  const userPromoSet = useMemo(() => new Set(userPromos), [userPromos]);
  const sortedPromos = useMemo(
    () => [...promosUi].sort((left, right) => Number(userPromoSet.has(right.id)) - Number(userPromoSet.has(left.id))),
    [promosUi, userPromoSet],
  );
  const topPromoChips = sortedPromos.slice(0, 8);

  const availableCategories = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const event of eventsUi) {
      for (const tag of event.tags) {
        const normalized = String(tag).trim();
        const key = normalized.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        ordered.push(normalized);
      }
    }
    return ordered.sort((left, right) => left.localeCompare(right, "it"));
  }, [eventsUi]);

  const availablePromoTypes = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const promo of promosUi) {
      const normalized = String(promo.title).trim();
      const key = normalized.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      ordered.push(normalized);
    }
    return ordered.sort((left, right) => left.localeCompare(right, "it"));
  }, [promosUi]);

  const displayName = useMemo(() => {
    const raw = (user as any)?.name || (user as any)?.username || user?.email?.split('@')[0] || 'Guest';
    return String(raw)
      .split(/[._\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, [user]);

  const headerGreeting = useMemo(() => getGreeting(), []);

  const avatarLabel = displayName.charAt(0).toUpperCase() || 'G';

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvents(), refetchPromos(), refetchVenues()]);
    } finally {
      // small delay to avoid flicker
      await new Promise((res) => setTimeout(res, 250));
    }
    setRefreshing(false);
  };

  const activePromo = promoFilter ? promosUi.find((item) => item.id === promoFilter) : null;
  const activeFilterCount = Number(Boolean(filters.onlyMyPromos)) + (filters.categories?.length ?? 0) + (filters.promoTypes?.length ?? 0);

  const renderHeroCard = (item: UiEvent) => {
    const promoCount = item.promos.length;
    const topPromos = item.promos.slice(0, 3);

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.9}
        onPress={() => onEventPress(item)}
        style={styles.heroCard}
      >
        <Image source={{ uri: item.image }} style={styles.heroImage} />
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "rgba(4,4,8,0.75)", "#09090D"]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={[item.accentColor + "00", item.accentColor + "44"]}
          start={{ x: 0.5, y: 0.2 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroTint}
        />

        <View style={styles.heroTopRow}>
          <View style={[styles.heroBadge, { backgroundColor: item.accentColor + "33", borderColor: item.accentColor + "77" }]}>
            <Text style={[styles.heroBadgeText, { color: item.accentColor }]}>{item.statusLabel}</Text>
          </View>
        </View>

        <View style={styles.heroBottom}>
          <Text style={[styles.heroEyebrow, { color: item.accentColor }]} numberOfLines={1}>
            {(item.tags[0] || 'Night Select').toUpperCase()}
          </Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={14} color={item.accentColor} />
            <Text style={styles.heroMetaText} numberOfLines={1}>{item.venue} • {item.time || item.date}</Text>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.avatarStack}>
              {topPromos.length ? topPromos.map((promo, chipIndex) => (
                <View
                  key={promo.id}
                  style={[
                    styles.avatarBubble,
                    { marginLeft: chipIndex === 0 ? 0 : -12, borderColor: "#09090D", backgroundColor: promo.accentColor + "44" },
                  ]}
                >
                  <Text style={styles.avatarBubbleText}>{promo.discount}</Text>
                </View>
              )) : (
                <View style={[styles.avatarBubble, { marginLeft: 0, borderColor: "#09090D", backgroundColor: item.accentColor + "44" }]}>
                  <Text style={styles.avatarBubbleText}>{item.tags[0]?.slice(0, 2).toUpperCase() || 'EV'}</Text>
                </View>
              )}
              {promoCount > 0 ? (
                <View style={[styles.avatarBubble, styles.avatarCounter, { marginLeft: topPromos.length ? -12 : 8 }]}>
                  <Text style={styles.avatarCounterText}>+{promoCount}</Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onEventPress(item)}
              style={styles.primaryCta}
            >
              <Text style={styles.primaryCtaText}>{promoCount > 0 ? 'Apri evento' : 'Scopri evento'}</Text>
              <Feather name="arrow-up-right" size={16} color="#050505" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCuratedCard = (item: UiEvent) => {
    const primaryPromo = item.promos[0];

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.88}
        onPress={() => onEventPress(item)}
        style={[styles.curatedCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)" }]}
      >
        <View style={styles.curatedImageWrap}>
          <Image source={{ uri: item.image }} style={styles.curatedImage} />
          <View style={styles.curatedImageBadge}>
            <Text style={styles.curatedImageBadgeText}>{item.date || 'STASERA'}</Text>
          </View>
        </View>

        <View style={styles.curatedContent}>
          <View style={styles.curatedTopRow}>
            <Text style={[styles.curatedGenre, { color: item.accentColor }]} numberOfLines={1}>
              {(item.tags[0] || 'Serata').toUpperCase()}
            </Text>
          </View>

          <Text style={[styles.curatedTitle, { color: theme.colors.text }]} numberOfLines={2}>{item.title}</Text>

          <View style={styles.metaRowCompact}>
            <Feather name="map-pin" size={13} color={theme.colors.muted} />
            <Text style={[styles.curatedMetaText, { color: theme.colors.muted }]} numberOfLines={1}>
              {item.venue} • {item.time || item.date}
            </Text>
          </View>

          <View style={styles.curatedTagsRow}>
            {primaryPromo ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onPromoPress(primaryPromo)}
                style={[styles.miniTag, { backgroundColor: primaryPromo.accentColor + "18", borderColor: primaryPromo.accentColor + "3D" }]}
              >
                <Text style={[styles.miniTagText, { color: primaryPromo.accentColor }]}>{userPromoSet.has(primaryPromo.id) ? 'Promo per te' : primaryPromo.title}</Text>
              </TouchableOpacity>
            ) : null}
            <View style={[styles.miniTag, styles.neutralMiniTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,12,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,12,0.08)' }]}>
              <Text style={[styles.neutralMiniTagText, { color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(12,12,12,0.62)' }]}>{item.city || 'Top Venue'}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ["#0B0B0E", "#12101D", "#08080B"] : ["#F7F3FF", "#EEF4FF", "#F8F8FB"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.identityRow}>
            <View style={[styles.avatarShell, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.78)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)" }]}>
              <LinearGradient
                colors={[theme.colors.primary, isDark ? "#2DE0C1" : "#8AC8FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>{avatarLabel}</Text>
              </LinearGradient>
            </View>
            <View>
              <Text style={[styles.headerGreeting, { color: isDark ? "rgba(255,255,255,0.68)" : "rgba(11,11,11,0.58)" }]}>{headerGreeting}</Text>
              <Text style={[styles.headerName, { color: theme.colors.text }]} numberOfLines={1}>{displayName}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onToggleTheme}
              accessibilityRole="button"
              accessibilityLabel={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
              style={[styles.headerIconButton, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.82)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)" }]}
            >
              <Feather name={isDark ? "moon" : "sun"} size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchRow}>
          <SearchBar
            value={query}
            onChange={onQueryChange}
            onOpenFilters={() => setFilterModalVisible(true)}
            placeholder="Cerca eventi, locali o artisti..."
            activeFilterCount={activeFilterCount}
          />
        </View>

        <View style={styles.filtersHeadingRow}>
          <Text style={[styles.filtersHeading, { color: theme.colors.text }]}>Filtri rapidi</Text>
          <Text style={[styles.filtersSummary, { color: theme.colors.muted }]}>
            {activeFilterCount > 0 ? `${activeFilterCount} attivi` : 'Nessun filtro attivo'}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => onPromoFilterChange(null)}
            style={[styles.chipButton, promoFilter === null && !filters.onlyMyPromos ? styles.chipButtonActive : null, { borderColor: promoFilter === null && !filters.onlyMyPromos ? theme.colors.primary + "66" : isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)", backgroundColor: promoFilter === null && !filters.onlyMyPromos ? theme.colors.primary + "22" : isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)" }]}
          >
            <Feather name="zap" size={15} color={promoFilter === null && !filters.onlyMyPromos ? theme.colors.primary : theme.colors.muted} />
            <Text style={[styles.chipText, { color: promoFilter === null && !filters.onlyMyPromos ? theme.colors.text : theme.colors.text }]}>Tutti</Text>
          </TouchableOpacity>

          {userPromos.length > 0 ? (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => onFiltersChange((prev) => ({ ...prev, onlyMyPromos: !prev.onlyMyPromos }))}
              style={[styles.chipButton, filters.onlyMyPromos ? styles.chipButtonActive : null, { borderColor: filters.onlyMyPromos ? theme.colors.primary + "66" : isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)", backgroundColor: filters.onlyMyPromos ? theme.colors.primary + "22" : isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)" }]}
            >
              <Feather name="star" size={15} color={filters.onlyMyPromos ? theme.colors.primary : theme.colors.muted} />
              <Text style={[styles.chipText, { color: theme.colors.text }]}>Solo per te</Text>
            </TouchableOpacity>
          ) : null}

          {topPromoChips.map((promo) => {
            const selected = promoFilter === promo.id;
            const isForUser = userPromoSet.has(promo.id);
            return (
              <TouchableOpacity
                key={promo.id}
                activeOpacity={0.82}
                onPress={() => onPromoFilterChange(selected ? null : promo.id)}
                style={[
                  styles.chipButton,
                  {
                    borderColor: selected ? promo.accentColor + "88" : isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
                    backgroundColor: selected ? promo.accentColor + "26" : isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)",
                  },
                ]}
              >
                <Feather name="tag" size={15} color={selected ? promo.accentColor : theme.colors.muted} />
                <Text style={[styles.chipText, { color: theme.colors.text }]} numberOfLines={1}>{isForUser ? `${promo.title} · per te` : promo.title}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activePromo ? (
          <View style={[styles.activeFilterBanner, { backgroundColor: activePromo.accentColor + "14", borderColor: activePromo.accentColor + "44" }]}>
            <Feather name="tag" size={16} color={activePromo.accentColor} />
            <View style={styles.activeFilterCopy}>
              <Text style={[styles.activeFilterTitle, { color: theme.colors.text }]}>{userPromoSet.has(activePromo.id) ? 'Promo riservata a te' : 'Promo attiva'}</Text>
              <Text style={[styles.activeFilterSubtitle, { color: theme.colors.muted }]} numberOfLines={1}>
                {userPromoSet.has(activePromo.id) ? `${activePromo.title} · selezionata per il tuo profilo` : activePromo.title}
              </Text>
            </View>
            <TouchableOpacity activeOpacity={0.8} onPress={() => onPromoFilterChange(null)} style={[styles.clearChip, { borderColor: activePromo.accentColor + "44" }]}>
              <Feather name="x" size={14} color={activePromo.accentColor} />
            </TouchableOpacity>
          </View>
        ) : null}

        {(eventsLoading || promosLoading || venuesLoading) && !eventsUi.length ? (
          <View style={styles.centerPanel}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.centerPanelText, { color: theme.colors.muted }]}>Caricamento eventi…</Text>
          </View>
        ) : null}

        {blockingError ? (
          <View style={[styles.errorBox, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.82)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)" }]}>
            <View style={styles.errorHeader}>
              <View style={[styles.errorIconWrap, { backgroundColor: theme.colors.error + "1A" }]}>
                <Feather name="alert-circle" size={16} color={theme.colors.error} />
              </View>
              <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Errore nel caricamento</Text>
            </View>
            <Text style={[styles.errorBody, { color: theme.colors.muted }]}>{blockingError}</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={onRefresh} style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}>
              <Feather name="refresh-cw" size={14} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Riprova</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {featuredEvents.length ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Eventi consigliati</Text>
              <Text style={[styles.sectionAction, { color: theme.colors.primary }]}>{`${featuredEvents.length} selezionati`}</Text>
            </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroRow}>
            {featuredEvents.map(renderHeroCard)}
          </ScrollView>
          </>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Scelti per te</Text>
          <Text style={[styles.sectionAction, { color: theme.colors.primary }]}>{curatedFeed.length ? `${curatedFeed.length} proposte` : ''}</Text>
        </View>

        {curatedFeed.length ? curatedFeed.map(renderCuratedCard) : !(eventsLoading || promosLoading || venuesLoading) ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.82)" }]}>
              <Feather name="calendar" size={30} color={theme.colors.muted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nessun evento trovato</Text>
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Prova a cambiare ricerca o filtri per riempire la home.</Text>
          </View>
        ) : null}
      </ScrollView>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={(nextFilters) => onFiltersChange(nextFilters)}
        initial={filters}
        categories={availableCategories}
        promoTypes={availablePromoTypes}
        enablePromoFilters={hasPromos}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingTop: 14,
    paddingBottom: 128,
  },
  headerRow: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  avatarShell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 3,
    borderWidth: 1,
    marginRight: 14,
  },
  avatarGradient: {
    flex: 1,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  headerGreeting: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    flexShrink: 0,
  },
  headerIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  searchRow: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInputWrap: {
    flex: 1,
    height: 56,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    flexDirection: 'row',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  filterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterCountBubble: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: {
    color: '#050505',
    fontSize: 10,
    fontWeight: '800',
  },
  chipsRow: {
    paddingLeft: 24,
    paddingRight: 16,
    gap: 10,
    paddingBottom: 4,
    marginBottom: 14,
  },
  filtersHeadingRow: {
    paddingHorizontal: 24,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersHeading: {
    fontSize: 15,
    fontWeight: '800',
  },
  filtersSummary: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipButton: {
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipButtonActive: {
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 110,
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  activeFilterCopy: {
    flex: 1,
  },
  activeFilterTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 1,
  },
  activeFilterSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  clearChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPanel: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  centerPanelText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroRow: {
    paddingLeft: 24,
    paddingRight: 16,
    gap: 18,
    marginBottom: 28,
  },
  heroCard: {
    width: 300,
    height: 404,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#111114',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  heroTint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  heroTopRow: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '72%',
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 10,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 6,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  heroFooter: {
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 16,
    gap: 14,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 8,
    minHeight: 38,
  },
  avatarBubble: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBubbleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  avatarCounter: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderColor: '#09090D',
  },
  avatarCounterText: {
    color: '#050505',
    fontSize: 10,
    fontWeight: '900',
  },
  primaryCta: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  primaryCtaText: {
    color: '#050505',
    fontSize: 14,
    fontWeight: '800',
  },
  curatedCard: {
    marginHorizontal: 24,
    marginBottom: 14,
    padding: 12,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  curatedImageWrap: {
    width: 102,
    height: 102,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  curatedImage: {
    width: '100%',
    height: '100%',
  },
  curatedImageBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(8,8,10,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  curatedImageBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  curatedContent: {
    flex: 1,
    paddingVertical: 4,
  },
  curatedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  curatedGenre: {
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginRight: 8,
  },
  curatedIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  curatedTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 8,
  },
  metaRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  curatedMetaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  curatedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniTag: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  neutralMiniTag: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  neutralMiniTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  errorBox: {
    marginHorizontal: 24,
    marginBottom: 18,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '800',
  },
  errorBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  empty: { paddingTop: 46, paddingBottom: 40, alignItems: "center", paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 19, opacity: 0.7 },
});
