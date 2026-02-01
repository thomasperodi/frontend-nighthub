import { useAsync, useLazyAsync } from './useAsync';
import { fetchEvents, fetchEventById, fetchEventsByVenue } from '../services/events';
import { Event, EventFilters } from '../types/events';

/**
 * Fetch all events with optional filters
 */
export function useEvents(filters?: EventFilters) {
  return useAsync(
    () => fetchEvents(filters),
    { deps: [JSON.stringify(filters)] }
  );
}

/**
 * Fetch single event by ID
 */
export function useEvent(id: string) {
  return useAsync(
    () => fetchEventById(id),
    { 
      immediate: !!id,
      deps: [id] 
    }
  );
}

/**
 * Fetch events by venue
 */
export function useEventsByVenue(venueId: string) {
  return useAsync(
    () => fetchEventsByVenue(venueId),
    { 
      immediate: !!venueId,
      deps: [venueId] 
    }
  );
}

/**
 * Lazy event fetching (call execute when needed)
 */
export function useLazyEvent() {
  return useLazyAsync((id: string) => fetchEventById(id));
}
