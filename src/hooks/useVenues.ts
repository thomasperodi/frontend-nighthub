import { useAsync } from './useAsync';
import { fetchVenues, fetchVenueById, fetchVenueStats } from '../services/venues';

/**
 * Fetch all venues
 */
export function useVenues() {
  return useAsync(() => fetchVenues());
}

/**
 * Fetch single venue by ID
 */
export function useVenue(id: string) {
  return useAsync(
    () => fetchVenueById(id),
    { 
      immediate: !!id,
      deps: [id] 
    }
  );
}

/**
 * Fetch venue statistics
 */
export function useVenueStats(id: string) {
  return useAsync(
    () => fetchVenueStats(id),
    { 
      immediate: !!id,
      deps: [id] 
    }
  );
}
