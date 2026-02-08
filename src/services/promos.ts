import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';
import { Promo } from '../types/events';
import { UserPromo } from '../types/users';

/**
 * Promos Service - Handles all promo-related API calls
 */

/**
 * Fetch all promos
 */
export async function fetchPromos(): Promise<Promo[]> {
  const { data } = await api.get(API_ENDPOINTS.PROMOS.ACTIVE_LIST);
  return data;
}

/**
 * Fetch promos by event
 */
export async function fetchPromosByEvent(eventId: string): Promise<Promo[]> {
  const { data } = await api.get(API_ENDPOINTS.PROMOS.BY_EVENT(eventId));
  return data;
}

/**
 * Fetch promos by venue
 */
export async function fetchPromosByVenue(venueId: string): Promise<Promo[]> {
  const { data } = await api.get(API_ENDPOINTS.PROMOS.BY_VENUE(venueId));
  return data;
}

/**
 * Fetch single promo by ID
 */
export async function fetchPromoById(id: string): Promise<Promo | null> {
  const { data } = await api.get(API_ENDPOINTS.PROMOS.DETAIL(id));
  return data || null;
}

/**
 * Create new promo (venue owner or admin)
 */
export async function createPromo(promoData: Partial<Promo>): Promise<Promo> {
  const { data } = await api.post(API_ENDPOINTS.PROMOS.CREATE, promoData);
  return data;
}

/**
 * Update promo (venue owner or admin)
 */
export async function updatePromo(id: string, updates: Partial<Promo>): Promise<Promo> {
  const { data } = await api.patch(API_ENDPOINTS.PROMOS.UPDATE(id), updates);
  return data;
}

/**
 * Delete promo (venue owner or admin)
 */
export async function deletePromo(id: string): Promise<void> {
  await api.delete(API_ENDPOINTS.PROMOS.DELETE(id));
}

// ========================================
// User Promos (Collected/Saved Promos)
// ========================================

/**
 * Fetch user's collected promos
 */
export async function fetchUserPromos(): Promise<string[]> {
  const { data } = await api.get(API_ENDPOINTS.USER_PROMOS.MY_PROMOS);
  return data;
}

/**
 * Collect/save a promo
 */
export async function collectPromo(promoId: string): Promise<void> {
  await api.post(API_ENDPOINTS.USER_PROMOS.COLLECT(promoId));
}

/**
 * Mark promo as used
 */
export async function usePromo(promoId: string): Promise<void> {
  await api.post(API_ENDPOINTS.USER_PROMOS.USE(promoId));
}
