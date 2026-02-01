import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';
import { Venue } from '../types/events';

/**
 * Venues Service - Handles all venue-related API calls
 */

/**
 * Fetch all venues
 */
export async function fetchVenues(): Promise<Venue[]> {
  const { data } = await api.get(API_ENDPOINTS.VENUES.LIST);
  return data;
}

/**
 * Fetch single venue by ID
 */
export async function fetchVenueById(id: string): Promise<Venue | null> {
  const { data } = await api.get(API_ENDPOINTS.VENUES.DETAIL(id));
  return data || null;
}

/**
 * Fetch venue statistics (for venue owners)
 */
export async function fetchVenueStats(id: string): Promise<any> {
  const { data } = await api.get(API_ENDPOINTS.VENUES.STATS(id));
  return data;
}

/**
 * Create new venue (admin only)
 */
export async function createVenue(venueData: Partial<Venue>): Promise<Venue> {
  const { data } = await api.post(API_ENDPOINTS.VENUES.CREATE, venueData);
  return data;
}

/**
 * Update venue (venue owner or admin)
 */
export async function updateVenue(id: string, updates: Partial<Venue>): Promise<Venue> {
  const { data } = await api.patch(API_ENDPOINTS.VENUES.UPDATE(id), updates);
  return data;
}

/**
 * Delete venue (admin only)
 */
export async function deleteVenue(id: string): Promise<void> {
  await api.delete(API_ENDPOINTS.VENUES.DELETE(id));
}
