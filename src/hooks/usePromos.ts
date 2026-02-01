import { useAsync, useLazyAsync } from './useAsync';
import {
  fetchPromos,
  fetchPromoById,
  fetchPromosByEvent,
  fetchPromosByVenue,
  fetchUserPromos,
  collectPromo,
} from '../services/promos';

/**
 * Fetch all promos
 */
export function usePromos() {
  return useAsync(() => fetchPromos());
}

/**
 * Fetch single promo by ID
 */
export function usePromo(id: string) {
  return useAsync(
    () => fetchPromoById(id),
    { 
      immediate: !!id,
      deps: [id] 
    }
  );
}

/**
 * Fetch promos by event
 */
export function usePromosByEvent(eventId: string) {
  return useAsync(
    () => fetchPromosByEvent(eventId),
    { 
      immediate: !!eventId,
      deps: [eventId] 
    }
  );
}

/**
 * Fetch promos by venue
 */
export function usePromosByVenue(venueId: string) {
  return useAsync(
    () => fetchPromosByVenue(venueId),
    { 
      immediate: !!venueId,
      deps: [venueId] 
    }
  );
}

/**
 * Fetch user's collected promos
 */
export function useUserPromos() {
  return useAsync(() => fetchUserPromos());
}

/**
 * Collect/save a promo (lazy - call execute when needed)
 */
export function useCollectPromo() {
  return useLazyAsync((promoId: string) => collectPromo(promoId));
}
