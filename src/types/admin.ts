export type AdminMetrics = {
  totalVenues: number;
  activeVenues: number;
  totalUsers: number;
  totalTicketsSold: number;
  totalReservations: number;
  activeUsers30d: number;
  eventsCompletedMonth: number;
  eventsActiveToday: number;
  contractsExpiringIn30d: number;
  contractsMissingData: number;
  revenueMonth: number;
  reservationsToday: number;
  newUsers30d: number;
  avgOrderValue: number;
  sessions30d: number;
  avgStayMinutes30d: number;
};

export type AdminVenue = {
  id: string;
  name: string;
  city: string;
  status: string;
  occupancy: number;
  activeGuests?: number;
  revenue: number;
  eventsActive?: number;
  eventsCompletedMonth?: number;
  analyzedPeopleMonth?: number;
  contractExpiresAt?: string | null;
  contractDaysLeft?: number | null;
  contractEstimated?: boolean;
  contractStartAt?: string | null;
  contractStatus?: string | null;
  contractMonthlyFee?: number | null;
  contractAutoRenew?: boolean;
  contractNotes?: string | null;
  managerUserId?: string | null;
  managerName?: string | null;
  managerEmail?: string | null;
};

export type AdminUser = {
  id: string;
  name: string;
  email?: string;
  role: string;
  roleKey?: string;
  venueId?: string | null;
  venueName?: string | null;
  status: string;
  joinedAt?: string;
  lastActivityAt?: string | null;
  sessions30d?: number;
  avgStayMinutes30d?: number;
};

export type AdminRevenuePoint = {
  label: string;
  value: number;
};

export type AdminAlert = {
  id: number | string;
  title: string;
  detail: string;
  severity?: "info" | "warning" | "critical";
};

export type AdminProfile = {
  name: string;
  email: string;
  role: string;
};

export type AdminDashboardData = {
  metrics: AdminMetrics;
  revenue: AdminRevenuePoint[];
  alerts: AdminAlert[];
  topVenues: Array<{
    id: string;
    name: string;
    revenue: number;
  }>;
  ordersMonth: {
    total: number;
    paid: number;
  };
  expiringContracts: Array<{
    venueId: string;
    venueName: string;
    city: string;
    expiresAt: string;
    daysLeft: number;
    estimated: boolean;
    status?: string;
    monthlyFee?: number | null;
    autoRenew?: boolean;
    notes?: string | null;
    eventsActive: number;
    eventsCompletedMonth: number;
  }>;
};

export type CreateAdminVenuePayload = {
  name: string;
  city?: string;
  radius_geofence?: number;
  contract_start_at?: string;
  contract_end_at?: string;
  contract_status?: string;
  contract_monthly_fee?: number;
  contract_auto_renew?: boolean;
  contract_notes?: string;
  manager_user_id?: string;
};

export type UpdateVenueContractPayload = {
  contract_start_at?: string | null;
  contract_end_at?: string | null;
  contract_status?: string | null;
  contract_monthly_fee?: number | null;
  contract_auto_renew?: boolean;
  contract_notes?: string | null;
};

export type UpdateUserAssignmentPayload = {
  role: "client" | "staff" | "venue" | "admin";
  venue_id?: string | null;
};

export type AdminReportsData = {
  revenue: AdminRevenuePoint[];
  monthTotal: number;
  monthHint: string;
  monthVsPrevious?: number;
  channelBreakdown?: {
    entries: number;
    tables: number;
  };
  paidOrders?: number;
};
