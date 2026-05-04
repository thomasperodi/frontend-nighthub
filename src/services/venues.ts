import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';
import { Venue, VenueAnalytics, VenuePricing } from '../types/events';

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

export async function fetchVenueAnalytics(id: string): Promise<VenueAnalytics> {
  const { data } = await api.get<VenueAnalytics>(API_ENDPOINTS.VENUES.ANALYTICS(id));
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

export type StripeConnectStatus = {
  venue_id: string;
  connected: boolean;
  stripe_account_id?: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_due?: string[];
};

export async function createVenueStripeOnboardingLink(params: {
  venueId: string;
  refresh_url?: string;
  return_url?: string;
  email?: string;
}): Promise<{
  venue_id: string;
  stripe_account_id: string;
  onboarding_url: string;
  expires_at: number;
}> {
  const { data } = await api.post(
    API_ENDPOINTS.VENUES.STRIPE_CONNECT_ONBOARDING(params.venueId),
    {
      refresh_url: params.refresh_url,
      return_url: params.return_url,
      email: params.email,
    },
  );
  return data;
}

export async function fetchVenueStripeConnectStatus(
  venueId: string,
): Promise<StripeConnectStatus> {
  const { data } = await api.get<StripeConnectStatus>(
    API_ENDPOINTS.VENUES.STRIPE_CONNECT_STATUS(venueId),
  );
  return data;
}

export async function fetchVenuePricing(venueId: string): Promise<VenuePricing> {
  const { data } = await api.get<VenuePricing>(API_ENDPOINTS.VENUES.PRICING(venueId));
  return data;
}

export async function updateVenuePricing(
  venueId: string,
  updates: Partial<Pick<VenuePricing, 'cloakroom_unit_price' | 'bar_price_list' | 'bottle_price_list'>>,
): Promise<VenuePricing> {
  const { data } = await api.patch<VenuePricing>(
    API_ENDPOINTS.VENUES.PRICING(venueId),
    updates,
  );
  return data;
}
