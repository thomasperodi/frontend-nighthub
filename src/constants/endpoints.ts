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
    ANALYTICS: (id: string) => `/venues/${id}/analytics`,
    PRICING: (id: string) => `/venues/${id}/pricing`,
    USERS: (id: string) => `/venues/${id}/users`,
    PR_NETWORK: (id: string) => `/venues/${id}/pr-network`,
    PR_NETWORK_ME: (id: string) => `/venues/${id}/pr-network/me`,
    PR_NETWORK_MY_VENUES: '/venues/pr-network/me',
    PR_NETWORK_MEMBER: (id: string, memberId: string) =>
      `/venues/${id}/pr-network/${memberId}`,
    PR_EVENT_ASSIGNMENTS: (id: string, eventId: string) =>
      `/venues/${id}/pr-events/${eventId}/assignments`,
    PR_EVENT_ASSIGN: (id: string) => `/venues/${id}/pr-events/assignments`,
    PR_SCANS: (id: string) => `/venues/${id}/pr-scans`,
    PR_SCAN_ENTRY: (id: string, scanId: string) => `/venues/${id}/pr-scans/${scanId}/entry`,
    PR_DASHBOARD: (id: string) => `/venues/${id}/pr-dashboard`,
    TABLES: (id: string) => `/venues/${id}/tables`,
    STRIPE_CONNECT_ONBOARDING: (id: string) =>
      `/venues/${id}/stripe/connect/onboarding`,
    STRIPE_CONNECT_STATUS: (id: string) =>
      `/venues/${id}/stripe/connect/status`,
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

  PAYMENTS: {
    CREATE_CHECKOUT_SESSION: '/payments/checkout-session',
    CONFIRM_CHECKOUT_SESSION: (sessionId: string) =>
      `/payments/checkout-session/${sessionId}/confirm`,
    CREATE_PAYMENT_SHEET_INTENT: '/payments/payment-sheet-intent',
    CONFIRM_PAYMENT_INTENT: (paymentIntentId: string) =>
      `/payments/payment-intent/${paymentIntentId}/confirm`,
    VENUE_TRANSACTIONS: '/payments/venue/transactions',
    VENUE_ORDER_REFUND: (orderId: string) => `/payments/venue/orders/${orderId}/refund`,
    VENUE_ORDERS_REFUND_BULK: '/payments/venue/orders/refund-bulk',
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
    CREATE_VENUE: '/admin/venues',
    UPDATE_VENUE_CONTRACT: (id: string) => `/admin/venues/${id}/contract`,
    USERS: '/admin/users',
    UPDATE_USER_ASSIGNMENT: (id: string) => `/admin/users/${id}/assignment`,
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
