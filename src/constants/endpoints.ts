/**
 * API Endpoints - Centralized endpoint definitions
 * Update baseURL in services/api.ts
 */

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REGISTER: '/auth/register',
    ME: '/auth/me',
    DELETE_ACCOUNT: '/auth/me',
  },

  // Events
  EVENTS: {
    LIST: '/events',
    DETAIL: (id: string) => `/events/${id}`,
    CREATE: '/events',
    UPLOAD_POSTER: '/events/poster',
    SIGNED_UPLOAD_POSTER: '/events/poster/signed',
    UPDATE: (id: string) => `/events/${id}`,
    DELETE: (id: string) => `/events/${id}`,
    BY_VENUE: (venueId: string) => `/venues/${venueId}/events`,
    STATS: (id: string) => `/events/${id}/stats`,
    VENUE_STATS: (venueId: string) => `/venues/${venueId}/stats`,
  },

  // Venues
  VENUES: {
    LIST: '/venues',
    DETAIL: (id: string) => `/venues/${id}`,
    CREATE: '/venues',
    UPDATE: (id: string) => `/venues/${id}`,
    DELETE: (id: string) => `/venues/${id}`,
    EVENTS: (id: string) => `/venues/${id}/events`,
    STATS: (id: string) => `/venues/${id}/stats`,
    TABLES: (id: string) => `/venues/${id}/tables`,
    TABLE_DELETE: (venueId: string, tableId: string) =>
      `/venues/${venueId}/tables/${tableId}`,
    TABLE_UPDATE: (venueId: string, tableId: string) =>
      `/venues/${venueId}/tables/${tableId}`,
  },

  // Promos
  PROMOS: {
    LIST: '/promos',
    ACTIVE_LIST: '/promos/active',
    DETAIL: (id: string) => `/promos/${id}`,
    CREATE: '/promos',
    UPDATE: (id: string) => `/promos/${id}`,
    DELETE: (id: string) => `/promos/${id}`,
    BY_EVENT: (eventId: string) => `/events/${eventId}/promos`,
    BY_VENUE: (venueId: string) => `/venues/${venueId}/promos`,
  },

  // Reservations
  RESERVATIONS: {
    LIST: '/reservations',
    DETAIL: (id: string) => `/reservations/${id}`,
    CREATE: '/reservations',
    SCAN_ENTRY_QR: '/reservations/scan-entry-qr',
    UPDATE: (id: string) => `/reservations/${id}`,
    CANCEL: (id: string) => `/reservations/${id}/cancel`,
    MY_RESERVATIONS: '/reservations/me',
  },

  // Users
  USERS: {
    LIST: '/users',
    DETAIL: (id: string) => `/users/${id}`,
    CREATE: '/users',
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
    PROFILE: '/users/me',
    UPDATE_PROFILE: '/users/me',
  },

  // User Promos (collected promos)
  USER_PROMOS: {
    MY_PROMOS: '/user-promos/me',
    COLLECT: (promoId: string) => `/user-promos/${promoId}/collect`,
    USE: (promoId: string) => `/user-promos/${promoId}/use`,
  },

  // Admin
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    VENUES: '/admin/venues',
    USERS: '/admin/users',
    REPORTS: '/admin/reports',
    PROFILE: '/admin/profile',
    LOGOUT: '/admin/logout',
  },

  // Staff (for venue staff tracking sales/entries)
  STAFF: {
    BAR_SALES: '/staff/bar-sales',
    CLOAKROOM_SALES: '/staff/cloakroom-sales',
    ENTRIES: '/staff/entries',
    TABLE_SALES: '/staff/table-sales',
    // Hostess (Ragazza Immagine) - tables overview with per-head spend and zones
    HOSTESS_TABLES: '/staff/hostess-tables',
    HOSTESS_TABLE_DETAIL: (id: string) => `/staff/hostess-tables/${id}`,
    EVENT_STATS: (eventId: string) => `/staff/events/${eventId}/stats`,
  },
} as const;
