export type EventStatus = 'DRAFT' | 'LIVE' | 'CLOSED';

export type EventStats = {
  event_id: string;
  total_entries: number;
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

export type Event = {
  id: string;
  venue_id?: string;
  name: string;
  date: string; // YYYY-MM-DD
  start_time?: string; // HH:MM[:SS]
  end_time?: string;   // HH:MM[:SS]
  status?: EventStatus;
  description?: string;
  image?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  // Relations
  venue?: Venue;
  promos?: Promo[];
  entry_prices?: EventEntryPrice[];
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
  status?: 'active' | 'inactive' | 'pending';
  occupancy?: number;
  revenue?: number;
  capacity?: number;
  created_at?: string;
  updated_at?: string;
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
  total_bar: number;
  total_cloakroom: number;
  total_tables: number;
  events: EventStats[];
};
