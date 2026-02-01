export type AdminMetrics = {
  activeVenues: number;
  totalUsers: number;
  revenueMonth: number;
  reservationsToday: number;
};

export type AdminVenue = {
  id: number;
  name: string;
  city: string;
  status: string;
  occupancy: number;
  revenue: number;
};

export type AdminUser = {
  id: number;
  name: string;
  role: string;
  status: string;
};

export type AdminRevenuePoint = {
  label: string;
  value: number;
};

export type AdminAlert = {
  id: number;
  title: string;
  detail: string;
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
};

export type AdminReportsData = {
  revenue: AdminRevenuePoint[];
  monthTotal: number;
  monthHint: string;
};
