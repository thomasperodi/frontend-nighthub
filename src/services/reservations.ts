import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';
import { Reservation, CreateReservationDto, UpdateReservationDto } from '../types/reservations';

/**
 * Reservations Service - Handles all reservation-related API calls
 */

type CreateReservationInput = CreateReservationDto & {
  user_id: string;
  venue_id?: string;
};

type BackendReservationCreateInput = {
  user_id: string;
  event_id: string;
  type: 'table' | 'entry';
  guests: number;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  total_amount?: number;
  venue_zone_id?: string | null;
  venue_table_id?: string | null;
  table_name?: string | null;
  meta?: unknown;
};

export type IncomingTableInvitation = {
  reservation_id: string;
  invitation_status: 'pending' | 'accepted' | 'declined';
  reservation_status: Reservation['status'];
  invited_at: string;
  responded_at?: string | null;
  guests: number;
  table_name?: string | null;
  zone_label?: string | null;
  total_amount?: number | null;
  inviter: { id: string; name: string };
  event: {
    id: string;
    name: string;
    date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
  } | null;
  venue: { id: string; name: string; city?: string | null } | null;
  invited_group_names: string[];
  can_respond: boolean;
};

function normalizeStatus(status: unknown): BackendReservationCreateInput['status'] | undefined {
  const s = String(status ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (s === 'reserved') return 'confirmed';
  if (s === 'pending' || s === 'confirmed' || s === 'cancelled' || s === 'completed') return s;
  return undefined;
}

function normalizeCreateReservationPayload(input: any): BackendReservationCreateInput {
  const user_id: string | undefined = input?.user_id ?? input?.userId;
  const event_id: string | undefined = input?.event_id ?? input?.eventId;
  const type: 'table' | 'entry' | undefined = input?.type;

  const guestsRaw =
    input?.guests ??
    input?.guests_count ??
    input?.guestsCount ??
    input?.seats ??
    input?.seatsCount;

  const guests = Number(guestsRaw ?? (type === 'entry' ? 1 : undefined));

  if (!user_id) throw new Error('user_id required');
  if (!event_id) throw new Error('event_id required');
  if (type !== 'table' && type !== 'entry') throw new Error('type required');
  if (!Number.isFinite(guests) || !Number.isInteger(guests) || guests < 1) {
    throw new Error('guests must be an integer >= 1');
  }

  const total_amount = input?.total_amount ?? input?.totalAmount;
  const totalAmountNum = total_amount === null || total_amount === undefined ? undefined : Number(total_amount);

  const venue_zone_id: string | null | undefined =
    input?.venue_zone_id ?? input?.venueZoneId ?? null;

  const venue_table_id: string | null | undefined =
    input?.venue_table_id ?? input?.venueTableId ?? input?.table_id ?? null;

  const status = normalizeStatus(input?.status);
  const table_name_raw = input?.table_name ?? input?.tableName;
  const table_name =
    table_name_raw === null || table_name_raw === undefined
      ? undefined
      : String(table_name_raw).trim() || null;
  const meta = input?.meta;

  return {
    user_id,
    event_id,
    type,
    guests,
    status,
    total_amount: Number.isFinite(totalAmountNum as number) ? (totalAmountNum as number) : undefined,
    venue_zone_id,
    venue_table_id: venue_table_id ?? venue_zone_id,
    table_name,
    meta,
  };
}

/**
 * Fetch all user's reservations
 */
export async function fetchReservations(userId?: string): Promise<Reservation[]> {
  // New API behavior:
  // - Auth required
  // - For client role, backend always scopes to current user
  // - For venue/staff role, event_id is required (use fetchReservationsByEvent)
  // Keep signature for backward compatibility; userId is ignored.
  const { data } = await api.get<Reservation[]>(API_ENDPOINTS.RESERVATIONS.LIST);
  return data;
}

/**
 * Fetch reservations for a specific event
 */
export async function fetchReservationsByEvent(eventId: string): Promise<Reservation[]> {
  const { data } = await api.get<Reservation[]>(API_ENDPOINTS.RESERVATIONS.LIST, {
    params: { event_id: eventId },
  });
  return data;
}

/**
 * Fetch booked table IDs for a specific event (availability check).
 * This does not return reservation/user details.
 */
export async function fetchBookedTableIdsByEvent(eventId: string): Promise<string[]> {
  const { data } = await api.get<string[]>('/reservations/booked-tables', {
    params: { event_id: eventId },
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch single reservation by ID
 */
export async function fetchReservationById(id: string): Promise<Reservation | null> {
  const { data } = await api.get<Reservation>(API_ENDPOINTS.RESERVATIONS.DETAIL(id));
  return data ?? null;
}

/**
 * Create new reservation
 */
export async function createReservation(reservationData: CreateReservationInput): Promise<Reservation> {
  const payload = normalizeCreateReservationPayload(reservationData);
  const { data } = await api.post<Reservation>(
    API_ENDPOINTS.RESERVATIONS.CREATE,
    payload,
  );
  return data;
}

/**
 * Update reservation
 */
export async function updateReservation(
  id: string,
  updates: UpdateReservationDto
): Promise<Reservation | null> {
  const { data } = await api.patch<Reservation>(API_ENDPOINTS.RESERVATIONS.UPDATE(id), updates);
  return data ?? null;
}

/**
 * Cancel reservation
 */
export async function cancelReservation(id: string): Promise<Reservation | null> {
  const { data } = await api.post<Reservation>(API_ENDPOINTS.RESERVATIONS.CANCEL(id));
  return data ?? null;
}

export async function listIncomingTableInvitations(): Promise<IncomingTableInvitation[]> {
  const { data } = await api.get<IncomingTableInvitation[]>('/reservations/table-invitations/incoming');
  return Array.isArray(data) ? data : [];
}

export async function respondToTableInvitation(
  reservationId: string,
  response: 'accepted' | 'declined',
): Promise<IncomingTableInvitation> {
  const { data } = await api.post<IncomingTableInvitation>(
    `/reservations/${reservationId}/table-invitations/respond`,
    { response },
  );
  return data;
}

// ========================================
// Deprecated functions (keep for backward compatibility)
// ========================================

/**
 * @deprecated Use fetchReservations() instead
 */
export async function getReservations() {
  return fetchReservations();
}

/**
 * @deprecated Use fetchReservationById() instead
 */
export async function getReservation(id: string) {
  return fetchReservationById(id);
}
