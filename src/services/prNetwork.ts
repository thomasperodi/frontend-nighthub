import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';

export type PrNetworkRole = 'RESPONSABILE' | 'CAPO_SQUADRA' | 'PR';

export type VenuePrMember = {
  id: string;
  venueId: string;
  userId: string;
  role: PrNetworkRole;
  parentId: string | null;
  refCode: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
  name: string;
  userEmail: string;
  userUsername: string | null;
  userName: string | null;
  userRole: string;
};

export type AssignableVenueUser = {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  role: string;
  venue_id: string | null;
  is_associated_to_venue: boolean;
  already_assigned: boolean;
  display_name: string;
};

export type MyPrNetworkMembership = {
  venue_id: string;
  can_access_dashboard: boolean;
  can_manage_team: boolean;
  membership: {
    id: string;
    user_id: string;
    role: PrNetworkRole;
    parent_membership_id: string | null;
    ref_code: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  } | null;
};

export type MyPrVenueMembership = {
  membership_id: string;
  venue_id: string;
  venue_name: string;
  venue_city: string | null;
  role: PrNetworkRole;
  parent_membership_id: string | null;
  ref_code: string;
  is_active: boolean;
  can_manage_team: boolean;
  created_at: string;
  updated_at: string;
};

export type PrEventAssignment = {
  id: string;
  venue_id: string;
  event_id: string;
  pr_membership_id: string;
  is_active: boolean;
  assigned_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  membership: {
    id: string;
    role: PrNetworkRole;
    ref_code: string;
    parent_membership_id: string | null;
    display_name: string;
    user: {
      name: string | null;
      username: string | null;
      email: string;
    };
  };
};

export type PrQrScan = {
  id: string;
  venue_id: string;
  event_id: string;
  pr_membership_id: string;
  scanned_by_user_id: string | null;
  guest_user_id: string | null;
  referral_code: string;
  scanned_at: string;
  entry_id: string | null;
  entered_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PrDashboardMember = {
  id: string;
  user_id: string;
  role: PrNetworkRole;
  parent_membership_id: string | null;
  ref_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  display_name: string;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    email: string;
    role: string;
  };
  stats: {
    scans: number;
    entries: number;
  };
  team_stats: {
    scans: number;
    entries: number;
  };
};

export type PrDashboardStats = {
  venue_id: string;
  event_id: string | null;
  scope: 'OWNER' | PrNetworkRole;
  can_manage_team: boolean;
  totals: {
    scans: number;
    entries: number;
  };
  members: PrDashboardMember[];
  generated_at: string;
};

type BackendPrMember = {
  id: string;
  venue_id: string;
  user_id: string;
  role: PrNetworkRole | string;
  parent_membership_id: string | null;
  ref_code: string;
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  display_name: string;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    email: string;
    role: string;
  };
};

const normalizeRole = (value: string): PrNetworkRole => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'RESPONSABILE') return 'RESPONSABILE';
  if (normalized === 'CAPO_SQUADRA') return 'CAPO_SQUADRA';
  return 'PR';
};

const mapMember = (row: BackendPrMember): VenuePrMember => ({
  id: row.id,
  venueId: row.venue_id,
  userId: row.user_id,
  role: normalizeRole(row.role),
  parentId: row.parent_membership_id,
  refCode: row.ref_code,
  active: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdByUserId: row.created_by_user_id,
  name: row.display_name,
  userEmail: row.user?.email ?? '',
  userUsername: row.user?.username ?? null,
  userName: row.user?.name ?? null,
  userRole: String(row.user?.role || '').toLowerCase(),
});

export async function listVenuePrMembers(venueId: string): Promise<VenuePrMember[]> {
  const { data } = await api.get<BackendPrMember[]>(API_ENDPOINTS.VENUES.PR_NETWORK(venueId));
  const list = Array.isArray(data) ? data : [];
  return list.map(mapMember);
}

export async function searchVenueAssignableUsers(
  venueId: string,
  search?: string,
): Promise<AssignableVenueUser[]> {
  const { data } = await api.get<AssignableVenueUser[]>(API_ENDPOINTS.VENUES.USERS(venueId), {
    params: search?.trim() ? { search: search.trim() } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

export async function getMyVenuePrMembership(
  venueId: string,
): Promise<MyPrNetworkMembership> {
  const { data } = await api.get<MyPrNetworkMembership>(API_ENDPOINTS.VENUES.PR_NETWORK_ME(venueId));
  return data;
}

export async function listMyPrVenueMemberships(): Promise<MyPrVenueMembership[]> {
  const { data } = await api.get<MyPrVenueMembership[]>(API_ENDPOINTS.VENUES.PR_NETWORK_MY_VENUES);
  return Array.isArray(data)
    ? data.map((item) => ({
        ...item,
        role: normalizeRole(item.role),
      }))
    : [];
}

export async function createVenuePrMember(
  venueId: string,
  payload: {
    user_id: string;
    role: PrNetworkRole;
    parent_membership_id?: string | null;
    ref_code?: string;
  },
): Promise<VenuePrMember> {
  const { data } = await api.post<BackendPrMember>(
    API_ENDPOINTS.VENUES.PR_NETWORK(venueId),
    payload,
  );
  return mapMember(data);
}

export async function updateVenuePrMember(
  venueId: string,
  memberId: string,
  payload: {
    role?: PrNetworkRole;
    parent_membership_id?: string | null;
    is_active?: boolean;
    ref_code?: string;
  },
): Promise<VenuePrMember> {
  const { data } = await api.patch<BackendPrMember>(
    API_ENDPOINTS.VENUES.PR_NETWORK_MEMBER(venueId, memberId),
    payload,
  );
  return mapMember(data);
}

export async function deleteVenuePrMember(
  venueId: string,
  memberId: string,
): Promise<void> {
  await api.delete(API_ENDPOINTS.VENUES.PR_NETWORK_MEMBER(venueId, memberId));
}

export async function assignPrMemberToEvent(
  venueId: string,
  payload: {
    event_id: string;
    pr_membership_id: string;
    is_active?: boolean;
  },
): Promise<PrEventAssignment> {
  const { data } = await api.post<PrEventAssignment>(
    API_ENDPOINTS.VENUES.PR_EVENT_ASSIGN(venueId),
    payload,
  );
  return {
    ...data,
    membership: {
      ...data.membership,
      role: normalizeRole(data.membership.role),
    },
  };
}

export async function listPrEventAssignments(
  venueId: string,
  eventId: string,
): Promise<PrEventAssignment[]> {
  const { data } = await api.get<PrEventAssignment[]>(
    API_ENDPOINTS.VENUES.PR_EVENT_ASSIGNMENTS(venueId, eventId),
  );
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    ...item,
    membership: {
      ...item.membership,
      role: normalizeRole(item.membership.role),
    },
  }));
}

export async function registerPrQrScan(
  venueId: string,
  payload: {
    event_id: string;
    pr_membership_id?: string;
    ref_code?: string;
    guest_user_id?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<PrQrScan> {
  const { data } = await api.post<PrQrScan>(API_ENDPOINTS.VENUES.PR_SCANS(venueId), payload);
  return data;
}

export async function registerPrEntryFromScan(
  venueId: string,
  scanId: string,
  payload?: {
    guest_user_id?: string;
    station_id?: string;
    entry_type?: 'male' | 'female' | 'free';
  },
): Promise<{
  already_registered: boolean;
  scan: PrQrScan;
  entry: {
    id: string;
    event_id: string;
    user_id: string | null;
    staff_id: string | null;
    station_id: string | null;
    pr_membership_id: string | null;
    method: string;
    sesso: string;
    price: number;
    created_at: string;
  } | null;
}> {
  const { data } = await api.post(
    API_ENDPOINTS.VENUES.PR_SCAN_ENTRY(venueId, scanId),
    payload ?? {},
  );
  return data;
}

export async function fetchPrDashboardStats(
  venueId: string,
  params?: { eventId?: string; membershipId?: string },
): Promise<PrDashboardStats> {
  const { data } = await api.get<PrDashboardStats>(API_ENDPOINTS.VENUES.PR_DASHBOARD(venueId), {
    params: {
      eventId: params?.eventId,
      membershipId: params?.membershipId,
    },
  });

  return {
    ...data,
    scope: data.scope === 'OWNER' ? 'OWNER' : normalizeRole(data.scope),
    members: Array.isArray(data.members)
      ? data.members.map((member) => ({
          ...member,
          role: normalizeRole(member.role),
        }))
      : [],
  };
}
