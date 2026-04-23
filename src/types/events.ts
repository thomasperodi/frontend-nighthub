export type EventStatus = 'DRAFT' | 'LIVE' | 'CLOSED';
export type EventAccessMode = 'LIST' | 'PRE_SALE';

export type EventStats = {
  event_id: string;
  total_entries: number;
  total_entries_revenue: number;
  total_bar: number;
  total_cloakroom: number;
  total_tables: number;
  last_updated?: string;
};

export type EventEntryPrice = {
  id: string;
  event_id: string;
  label?: string;
  gender?: 'M' | 'F' | 'ALTRO';
  start_time?: string; // HH:MM[:SS]
  end_time?: string;   // HH:MM[:SS]
  price: number;
  created_at?: string;
};

export type EventTablePricing = {
  event_table_id?: string;
  venue_table_id: string;
  nome: string;
  zona?: string | null;
  label: string;
  per_testa?: number | null;
  costo_minimo?: number | null;
  persone_max?: number | null;
  base_per_testa?: number | null;
  base_costo_minimo?: number | null;
  base_persone_max?: number | null;
  override_per_testa?: number | null;
  override_costo_minimo?: number | null;
  override_persone_max?: number | null;
  has_override?: boolean;
};

export type Event = {
  id: string;
  venue_id?: string;
  name: string;
  is_featured?: boolean;
  date: string; // YYYY-MM-DD
  start_time?: string; // HH:MM[:SS]
  end_time?: string;   // HH:MM[:SS]
  status?: EventStatus;
  access_mode?: EventAccessMode;
  presale_price?: number | null;
  presale_currency?: string;
  presale_capacity?: number | null;
  presale_sold?: number;
  description?: string;
  image?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  // Relations
  venue?: Venue;
  promos?: Promo[];
  entry_prices?: EventEntryPrice[];
  table_pricing?: EventTablePricing[];
  // Legacy: the backend no longer embeds stats inside event payloads.
  // Use /events/:id/stats or /venues/:id/stats instead.
  event_stats?: EventStats | null;
};

export type Venue = {
  id: string;
  name: string;
  city: string;
  address?: string;
  description?: string;
  image?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  radius_geofence?: number | null;
  stripe_account_id?: string | null;
  stripe_charges_enabled?: boolean;
  stripe_payouts_enabled?: boolean;
  stripe_onboarding_completed_at?: string | null;
  cloakroom_unit_price?: number | null;
  bar_price_list?: Array<{ key: string; label?: string; price: number }>;
  status?: 'active' | 'inactive' | 'pending';
  occupancy?: number;
  revenue?: number;
  capacity?: number;
  created_at?: string;
  updated_at?: string;
};

export type VenuePricing = {
  venue_id: string;
  cloakroom_unit_price: number;
  bar_price_list: Array<{ key: string; label: string; price: number }>;
};

export type Promo = {
  id: string;
  event_id?: string;
  venue_id?: string;
  title: string;
  // Legacy UI fields (optional)
  details?: string;
  validUntil?: string;
  valid_from?: string;
  valid_to?: string;
  max_uses?: number;
  current_uses?: number;

  // Backend-aligned fields
  description?: string;
  discount_type?: 'percentage' | 'fixed' | 'free';
  discount_value?: number;
  status?: 'active' | 'inactive' | 'expired';
  created_at?: string;
};

// List responses with pagination
export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

// Filters for events
export type EventFilters = {
  city?: string;
  date?: string;
  tags?: string[];
  venue_id?: string;
  status?: EventStatus;
};

export type VenueStats = {
  venue_id: string;
  total_entries: number;
  total_entries_revenue: number;
  total_bar: number;
  total_cloakroom: number;
  total_tables: number;
  events: EventStats[];
};

export type VenueAnalyticsDistribution = {
  label: string;
  count?: number;
  value?: number;
  share?: number;
};

export type VenueAnalyticsEvent = {
  event_id: string;
  name: string;
  date: string;
  status: string;
  totalRevenue: number;
  entriesRevenue: number;
  barRevenue: number;
  cloakroomRevenue: number;
  tablesRevenue: number;
  totalEntries: number;
  totalReservations: number;
  totalTableGuests: number;
  totalPresences: number;
  avgSpendPerPresence: number;
  averageAge: number | null;
  topEntryHour: string | null;
  women: number;
  men: number;
  other: number;
  unknown: number;
};

export type VenueAnalytics = {
  venue_id: string;
  venue_name: string;
  generated_at: string;
  overview: {
    totalRevenue: number;
    totalEntries: number;
    totalReservations: number;
    totalTableGuests: number;
    totalPresences: number;
    avgRevenuePerEvent: number;
    avgRevenuePerPresence: number;
    avgStayMinutes: number;
  };
  audience: {
    uniqueCustomers: number;
    repeatCustomers: number;
    repeatRate: number;
    averageAge: number | null;
    genderSplit: VenueAnalyticsDistribution[];
    ageBuckets: VenueAnalyticsDistribution[];
    ageEntryWindows: Array<{
      label: string;
      count: number;
      avgEntryHour: string | null;
      peakEntryHour: string | null;
    }>;
  };
  bookings: {
    avgLeadDays: number;
    bestEventWeekday: { label: string; count: number } | null;
    bestBookingWeekday: { label: string; count: number } | null;
    bestBookingHour: { label: string; count: number } | null;
    busiestEntryHour: { label: string; count: number } | null;
    byEventWeekday: VenueAnalyticsDistribution[];
    byBookingWeekday: VenueAnalyticsDistribution[];
    byBookingHour: VenueAnalyticsDistribution[];
    leadTimeBuckets: VenueAnalyticsDistribution[];
  };
  revenue: {
    channelMix: Array<{ label: string; value: number; share: number }>;
    averagePerClosedEvent: {
      revenue: number;
      entriesRevenue: number;
      barRevenue: number;
      cloakroomRevenue: number;
      tablesRevenue: number;
      entries: number;
      presences: number;
    };
    weekdayBenchmarks: Array<{
      label: string;
      eventCount: number;
      avgRevenue: number;
      avgEntries: number;
      avgPresences: number;
    }>;
  };
  historical: {
    totalEvents: number;
    closedEvents: number;
    topEvent: VenueAnalyticsEvent | null;
  };
  events: VenueAnalyticsEvent[];
};
