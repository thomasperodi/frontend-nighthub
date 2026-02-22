import { api } from "./api";
import { API_ENDPOINTS } from "../constants/endpoints";
import {
  AdminAlert,
  AdminDashboardData,
  AdminMetrics,
  AdminProfile,
  AdminReportsData,
  AdminRevenuePoint,
  AdminUser,
  AdminVenue,
  CreateAdminVenuePayload,
  UpdateUserAssignmentPayload,
  UpdateVenueContractPayload,
} from "../types/admin";

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const defaultMetrics: AdminMetrics = {
  totalVenues: 0,
  activeVenues: 0,
  totalUsers: 0,
  totalTicketsSold: 0,
  totalReservations: 0,
  activeUsers30d: 0,
  eventsCompletedMonth: 0,
  eventsActiveToday: 0,
  contractsExpiringIn30d: 0,
  contractsMissingData: 0,
  revenueMonth: 0,
  reservationsToday: 0,
  newUsers30d: 0,
  avgOrderValue: 0,
  sessions30d: 0,
  avgStayMinutes30d: 0,
};

const normalizeRevenue = (input: unknown): AdminRevenuePoint[] => {
  if (!Array.isArray(input)) return [];
  return input.map((row: any) => ({
    label: String(row?.label ?? "-"),
    value: safeNumber(row?.value),
  }));
};

const normalizeAlerts = (input: unknown): AdminAlert[] => {
  if (!Array.isArray(input)) return [];
  return input.map((alert: any, index: number) => ({
    id: alert?.id ?? index,
    title: String(alert?.title ?? "Segnalazione"),
    detail: String(alert?.detail ?? ""),
    severity: alert?.severity,
  }));
};

const normalizeTopVenues = (input: unknown) => {
  if (!Array.isArray(input)) return [];
  return input.map((venue: any) => ({
    id: String(venue?.id ?? ""),
    name: String(venue?.name ?? "Locale"),
    revenue: safeNumber(venue?.revenue),
  }));
};

const normalizeExpiringContracts = (input: unknown) => {
  if (!Array.isArray(input)) return [];
  return input
    .map((row: any) => ({
      venueId: String(row?.venueId ?? ""),
      venueName: String(row?.venueName ?? "Locale"),
      city: String(row?.city ?? "N/D"),
      expiresAt: String(row?.expiresAt ?? ""),
      daysLeft: safeNumber(row?.daysLeft),
      estimated: Boolean(row?.estimated),
      status: row?.status ? String(row.status) : undefined,
      monthlyFee:
        row?.monthlyFee === null || row?.monthlyFee === undefined
          ? null
          : safeNumber(row.monthlyFee),
      autoRenew: Boolean(row?.autoRenew),
      notes: row?.notes ? String(row.notes) : null,
      eventsActive: safeNumber(row?.eventsActive),
      eventsCompletedMonth: safeNumber(row?.eventsCompletedMonth),
    }))
    .filter((row) => row.venueId && row.expiresAt);
};

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.DASHBOARD);

  const rawMetrics = data?.metrics ?? {};

  return {
    metrics: {
      ...defaultMetrics,
      totalVenues: safeNumber(rawMetrics.totalVenues),
      activeVenues: safeNumber(rawMetrics.activeVenues),
      totalUsers: safeNumber(rawMetrics.totalUsers),
      totalTicketsSold: safeNumber(rawMetrics.totalTicketsSold),
      totalReservations: safeNumber(rawMetrics.totalReservations),
      activeUsers30d: safeNumber(rawMetrics.activeUsers30d),
      eventsCompletedMonth: safeNumber(rawMetrics.eventsCompletedMonth),
      eventsActiveToday: safeNumber(rawMetrics.eventsActiveToday),
      contractsExpiringIn30d: safeNumber(rawMetrics.contractsExpiringIn30d),
      contractsMissingData: safeNumber(rawMetrics.contractsMissingData),
      revenueMonth: safeNumber(rawMetrics.revenueMonth),
      reservationsToday: safeNumber(rawMetrics.reservationsToday),
      newUsers30d: safeNumber(rawMetrics.newUsers30d),
      avgOrderValue: safeNumber(rawMetrics.avgOrderValue),
      sessions30d: safeNumber(rawMetrics.sessions30d),
      avgStayMinutes30d: safeNumber(rawMetrics.avgStayMinutes30d),
    },
    revenue: normalizeRevenue(data?.revenue),
    alerts: normalizeAlerts(data?.alerts),
    topVenues: normalizeTopVenues(data?.topVenues),
    ordersMonth: {
      total: safeNumber(data?.ordersMonth?.total),
      paid: safeNumber(data?.ordersMonth?.paid),
    },
    expiringContracts: normalizeExpiringContracts(data?.expiringContracts),
  };
}

export async function fetchAdminVenues(): Promise<AdminVenue[]> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.VENUES);
  if (!Array.isArray(data)) return [];

  return data.map((venue: any) => ({
    id: String(venue?.id ?? ""),
    name: String(venue?.name ?? "Locale"),
    city: String(venue?.city ?? "N/D"),
    status: String(venue?.status ?? "N/D"),
    occupancy: safeNumber(venue?.occupancy),
    activeGuests: safeNumber(venue?.activeGuests),
    revenue: safeNumber(venue?.revenue),
    eventsActive: safeNumber(venue?.eventsActive),
    eventsCompletedMonth: safeNumber(venue?.eventsCompletedMonth),
    contractExpiresAt: venue?.contractExpiresAt ? String(venue.contractExpiresAt) : null,
    contractDaysLeft:
      venue?.contractDaysLeft === null || venue?.contractDaysLeft === undefined
        ? null
        : safeNumber(venue.contractDaysLeft),
    contractEstimated: Boolean(venue?.contractEstimated),
    contractStartAt: venue?.contractStartAt ? String(venue.contractStartAt) : null,
    contractStatus: venue?.contractStatus ? String(venue.contractStatus) : null,
    contractMonthlyFee:
      venue?.contractMonthlyFee === null || venue?.contractMonthlyFee === undefined
        ? null
        : safeNumber(venue.contractMonthlyFee),
    contractAutoRenew: Boolean(venue?.contractAutoRenew),
    contractNotes: venue?.contractNotes ? String(venue.contractNotes) : null,
    managerUserId: venue?.managerUserId ? String(venue.managerUserId) : null,
    managerName: venue?.managerName ? String(venue.managerName) : null,
    managerEmail: venue?.managerEmail ? String(venue.managerEmail) : null,
  }));
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.USERS);
  if (!Array.isArray(data)) return [];

  return data.map((user: any) => ({
    id: String(user?.id ?? ""),
    name: String(user?.name ?? "Utente"),
    email: user?.email ? String(user.email) : undefined,
    role: String(user?.role ?? "-"),
    roleKey: user?.roleKey ? String(user.roleKey) : undefined,
    venueId: user?.venueId ? String(user.venueId) : null,
    venueName: user?.venueName ? String(user.venueName) : null,
    status: String(user?.status ?? "Attivo"),
    joinedAt: user?.joinedAt ? String(user.joinedAt) : undefined,
    lastActivityAt: user?.lastActivityAt ? String(user.lastActivityAt) : null,
    sessions30d: safeNumber(user?.sessions30d),
    avgStayMinutes30d: safeNumber(user?.avgStayMinutes30d),
  }));
}

export async function createAdminVenue(payload: CreateAdminVenuePayload): Promise<void> {
  await api.post(API_ENDPOINTS.ADMIN.CREATE_VENUE, payload);
}

export async function updateAdminVenueContract(
  venueId: string,
  payload: UpdateVenueContractPayload,
): Promise<void> {
  await api.patch(API_ENDPOINTS.ADMIN.UPDATE_VENUE_CONTRACT(venueId), payload);
}

export async function updateAdminUserAssignment(
  userId: string,
  payload: UpdateUserAssignmentPayload,
): Promise<void> {
  await api.patch(API_ENDPOINTS.ADMIN.UPDATE_USER_ASSIGNMENT(userId), payload);
}

export async function fetchAdminReports(): Promise<AdminReportsData> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.REPORTS);

  return {
    revenue: normalizeRevenue(data?.revenue),
    monthTotal: safeNumber(data?.monthTotal),
    monthHint: String(data?.monthHint ?? "Nessun confronto disponibile"),
    monthVsPrevious: safeNumber(data?.monthVsPrevious),
    channelBreakdown: data?.channelBreakdown
      ? {
          entries: safeNumber(data.channelBreakdown.entries),
          tables: safeNumber(data.channelBreakdown.tables),
        }
      : undefined,
    paidOrders: safeNumber(data?.paidOrders),
  };
}

export async function fetchAdminProfile(): Promise<AdminProfile> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.PROFILE);
  return {
    name: String(data?.name ?? "Admin"),
    email: String(data?.email ?? ""),
    role: String(data?.role ?? "admin"),
  };
}

export async function logoutAdmin(): Promise<void> {
  await api.post(API_ENDPOINTS.AUTH.LOGOUT);
}
