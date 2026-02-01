import { useAsync, useLazyAsync } from './useAsync';
import {
  fetchReservations,
  fetchReservationById,
  createReservation,
  cancelReservation,
} from '../services/reservations';
import { CreateReservationDto } from '../types/reservations';
import { useAuth } from '../providers/AuthProvider';

/**
 * Fetch all user's reservations
 */
export function useReservations() {
  const { user } = useAuth();
  return useAsync(() => fetchReservations(user?.id), { deps: [user?.id] });
}

/**
 * Fetch single reservation by ID
 */
export function useReservation(id: string) {
  return useAsync(
    () => fetchReservationById(id),
    { 
      immediate: !!id,
      deps: [id] 
    }
  );
}

/**
 * Create new reservation (lazy - call execute when needed)
 */
export function useCreateReservation() {
  const { user } = useAuth();
  return useLazyAsync((data: CreateReservationDto) => {
    if (!user?.id) throw new Error('Not authenticated');
    return createReservation({
      ...data,
      user_id: user.id,
      venue_id: user.venue_id ?? undefined,
    });
  });
}

/**
 * Cancel reservation (lazy - call execute when needed)
 */
export function useCancelReservation() {
  return useLazyAsync((id: string) => cancelReservation(id));
}
