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
  venue_table_id?: string | null;
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

  const venue_table_id: string | null | undefined =
    input?.venue_table_id ?? input?.venueTableId ?? input?.table_id ?? null;

  const status = normalizeStatus(input?.status);

  return {
    user_id,
    event_id,
    type,
    guests,
    status,
    total_amount: Number.isFinite(totalAmountNum as number) ? (totalAmountNum as number) : undefined,
    venue_table_id,
  };
}

/**
 * Fetch all user's reservations
 */
export async function fetchReservations(userId?: string): Promise<Reservation[]> {
  const { data } = await api.get<Reservation[]>(API_ENDPOINTS.RESERVATIONS.LIST, {
    params: userId ? { user_id: userId } : undefined,
  });
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
