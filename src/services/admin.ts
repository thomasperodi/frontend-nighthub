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
} from "../types/admin";
import {
  MOCK_ALERTS,
  MOCK_ADMIN,
  MOCK_METRICS,
  MOCK_REVENUE,
  MOCK_USERS,
  MOCK_VENUES,
} from "../screens/admin/adminData";

/**
 * Admin Service - Handles all admin-related API calls
 * TODO: Replace mock responses with real API calls once backend is ready
 */

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  // TODO: Implement API call
  // const { data } = await api.get(API_ENDPOINTS.ADMIN.DASHBOARD);
  // return data;
  
  return {
    metrics: MOCK_METRICS as AdminMetrics,
    revenue: MOCK_REVENUE as AdminRevenuePoint[],
    alerts: MOCK_ALERTS as AdminAlert[],
  };
}

export async function fetchAdminVenues(): Promise<AdminVenue[]> {
  // TODO: Implement API call
  // const { data } = await api.get(API_ENDPOINTS.ADMIN.VENUES);
  // return data;
  
  return MOCK_VENUES as AdminVenue[];
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  // TODO: Implement API call
  // const { data } = await api.get(API_ENDPOINTS.ADMIN.USERS);
  // return data;
  
  return MOCK_USERS as AdminUser[];
}

export async function fetchAdminReports(): Promise<AdminReportsData> {
  // TODO: Implement API call
  // const { data } = await api.get(API_ENDPOINTS.ADMIN.REPORTS);
  // return data;
  
  return {
    revenue: MOCK_REVENUE as AdminRevenuePoint[],
    monthTotal: MOCK_METRICS.revenueMonth,
    monthHint: "Transazioni +18% vs mese scorso",
  };
}

export async function fetchAdminProfile(): Promise<AdminProfile> {
  // TODO: Implement API call
  // const { data } = await api.get(API_ENDPOINTS.ADMIN.PROFILE);
  // return data;
  
  return MOCK_ADMIN as AdminProfile;
}

export async function logoutAdmin(): Promise<void> {
  // TODO: Implement API call
  // await api.post(API_ENDPOINTS.ADMIN.LOGOUT);
  
  await api.post(API_ENDPOINTS.AUTH.LOGOUT);
}
