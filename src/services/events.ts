import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';
import {
  Event,
  EventFilters,
  EventStats,
  PaginatedResponse,
  VenueStats,
} from '../types/events';

// Helper per trovare l'evento attivo (LIVE) del venue corrente
export async function fetchActiveEventForVenue(venueId: string): Promise<Event | null> {
  console.log('[events] fetchActiveEventForVenue venue', venueId);

  // Ask backend to filter computed status when possible.
  // Backend supports `GET /venues/:id/events?status=LIVE`.
  const { data } = await api.get<Event[]>(API_ENDPOINTS.EVENTS.BY_VENUE(venueId), {
    params: { status: 'LIVE' },
  });
  const list = Array.isArray(data) ? data : [];
  const normalizeStatus = (s?: string) => (s ?? '').trim().toUpperCase();

  // Primary: rely on backend-computed status when available
  let liveEvents = list.filter((e) => normalizeStatus(e.status) === 'LIVE');

  // Fallback: compute time-window client-side (in case backend returns raw DB status)
  if (liveEvents.length === 0) {
    const parseDatePart = (value?: unknown) => {
      const raw = String(value ?? '');
      if (!raw) return null;
      const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
      const parts = datePart.split('-').map((x) => parseInt(x, 10));
      if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
      return { y: parts[0], m: parts[1], d: parts[2] };
    };

    const parseHHMM = (value?: unknown) => {
      const raw = String(value ?? '').trim();
      if (!raw) return null;

      // Accept "HH:MM" / "HH:MM:SS" or ISO (extract HH:MM)
      const timePart = raw.includes('T') ? raw.split('T')[1] : raw;
      const hhmm = timePart.split(':');
      if (hhmm.length < 2) return null;
      const hh = parseInt(hhmm[0], 10);
      const mm = parseInt(hhmm[1], 10);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
      return { hh, mm };
    };

    const now = new Date();
    liveEvents = list.filter((e) => {
      const d = parseDatePart((e as any)?.date);
      const st = parseHHMM((e as any)?.start_time);
      const en = parseHHMM((e as any)?.end_time);
      if (!d || !st || !en) return false;

      const start = new Date(d.y, d.m - 1, d.d, st.hh, st.mm, 0, 0);
      const end = new Date(d.y, d.m - 1, d.d, en.hh, en.mm, 0, 0);
      if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
      return now.getTime() >= start.getTime() && now.getTime() < end.getTime();
    });
  }

  console.log('[events] fetchActiveEventForVenue response', {
    venueId,
    total: list.length,
    live: liveEvents.length,
    statuses: list.slice(0, 10).map((e) => ({ id: e.id, status: normalizeStatus(e.status), date: e.date })),
  });

  if (liveEvents.length === 0) return null;

  // Se ci sono più LIVE, scegli quello più recente.
  // `date` può essere YYYY-MM-DD oppure ISO: per sicurezza facciamo parse.
  liveEvents.sort((a, b) => {
    const da = Date.parse(a.date ?? '');
    const db = Date.parse(b.date ?? '');
    if (!Number.isNaN(da) && !Number.isNaN(db) && da !== db) return db - da;
    if (!Number.isNaN(da) && Number.isNaN(db)) return -1;
    if (Number.isNaN(da) && !Number.isNaN(db)) return 1;

    const ua = a.updated_at ?? a.created_at ?? '';
    const ub = b.updated_at ?? b.created_at ?? '';
    return ub.localeCompare(ua);
  });

  return liveEvents[0];
}

// Se non esiste un evento LIVE, ne crea uno con data odierna
export async function ensureActiveEventForVenue(venueId: string): Promise<Event> {
  const existing = await fetchActiveEventForVenue(venueId);
  if (existing) {
    console.log('[events] ensureActiveEventForVenue found existing', existing.id);
    return existing;
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const toHHMM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  // Create an event whose time window includes "now", so backend will report it as LIVE automatically.
  const start = new Date(now.getTime() - 5 * 60 * 1000);
  const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  console.log('[events] ensureActiveEventForVenue creating new DRAFT (auto-LIVE) for venue', venueId, 'date', today);
  const { data } = await api.post<Event>(API_ENDPOINTS.EVENTS.CREATE, {
    venue_id: venueId,
    name: 'Serata Live',
    date: today,
    start_time: toHHMM(start),
    end_time: toHHMM(end),
    status: 'DRAFT',
  });
  return data;
}

/**
 * Events Service - Handles all event-related API calls
 */

function normalizeListResponse(data: Event[] | PaginatedResponse<Event>): Event[] {
  if (Array.isArray(data)) return data;
  return data.data;
}

function normalizePaginatedResponse(
  data: Event[] | PaginatedResponse<Event>,
  page: number,
  pageSize: number,
): PaginatedResponse<Event> {
  if (!Array.isArray(data)) return data;
  return {
    data,
    total: data.length,
    page,
    pageSize,
    hasMore: data.length > page * pageSize,
  };
}

/**
 * Fetch all events with optional filters
 */
export async function fetchEvents(filters?: EventFilters): Promise<Event[]> {
  const { data } = await api.get<Event[] | PaginatedResponse<Event>>(
    API_ENDPOINTS.EVENTS.LIST,
    { params: filters },
  );
  return normalizeListResponse(data);
}

/**
 * Fetch paginated events
 */
export async function fetchEventsPaginated(
  page: number = 1,
  pageSize: number = 10,
  filters?: EventFilters,
): Promise<PaginatedResponse<Event>> {
  const { data } = await api.get<Event[] | PaginatedResponse<Event>>(
    API_ENDPOINTS.EVENTS.LIST,
    { params: { page, pageSize, ...filters } },
  );

  return normalizePaginatedResponse(data, page, pageSize);
}

/**
 * Fetch single event by ID
 */
export async function fetchEventById(id: string): Promise<Event | null> {
  const { data } = await api.get<Event>(API_ENDPOINTS.EVENTS.DETAIL(id));
  return data ?? null;
}

/**
 * Fetch events by venue
 */
export async function fetchEventsByVenue(venueId: string): Promise<Event[]> {
  const url = API_ENDPOINTS.EVENTS.BY_VENUE(venueId);
  console.log('[events] fetchEventsByVenue request', { venueId, url });
  const { data } = await api.get<Event[]>(url);
  console.log('[events] fetchEventsByVenue response', {
    venueId,
    total: Array.isArray(data) ? data.length : 0,
    sample: Array.isArray(data)
      ? data.slice(0, 8).map((e) => ({ id: e.id, status: (e.status ?? '').toString(), date: e.date }))
      : [],
  });
  return data;
}

/**
 * Create new event (requires authentication)
 */
export async function createEvent(eventData: Partial<Event>): Promise<Event> {
  const { data } = await api.post<Event>(API_ENDPOINTS.EVENTS.CREATE, eventData);
  return data;
}

/**
 * Update existing event (requires authentication)
 */
export async function updateEvent(id: string, updates: Partial<Event>): Promise<Event> {
  const { data } = await api.patch<Event>(API_ENDPOINTS.EVENTS.UPDATE(id), updates);
  return data;
}

/**
 * Delete event (requires authentication)
 */
export async function deleteEvent(id: string): Promise<void> {
  await api.delete(API_ENDPOINTS.EVENTS.DELETE(id));
}

/**
 * Get stats for a single event
 */
export async function fetchEventStats(eventId: string): Promise<EventStats> {
  const { data } = await api.get<EventStats>(API_ENDPOINTS.EVENTS.STATS(eventId));
  return data;
}

/**
 * Get aggregated stats for a venue
 */
export async function fetchVenueStats(venueId: string): Promise<VenueStats> {
  const { data } = await api.get<VenueStats>(
    API_ENDPOINTS.EVENTS.VENUE_STATS(venueId),
  );
  return data;
}
