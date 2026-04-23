import { api } from './api';

export async function searchUsers(query: string) {
  const res = await api.get('/friends/search', { params: { query } });
  return res.data as Array<{
    id: string;
    username?: string;
    name?: string;
    avatar?: string;
    mutual_friends_count?: number;
    mutualFriendsCount?: number;
    mutual_friends_ids?: string[];
    mutualFriendsIds?: string[];
    mutual_friends?: Array<{ id: string; username?: string; name?: string; avatar?: string }>;
    mutualFriends?: Array<{ id: string; username?: string; name?: string; avatar?: string }>;
  }>;
}

export type FriendListItem = {
  id: string;
  username?: string | null;
  name?: string | null;
  avatar?: string | null;
  online: boolean;
  current_venue?: string | null;
  presence_type?: 'inside' | 'nearby' | null;
  status?: string | null;
  last_active_at?: string | null;
  last_seen_at?: string | null;
  last_seen_minutes_ago?: number | null;
  sharing_enabled?: boolean;
  is_stale?: boolean;
};

export async function listFriends() {
  const res = await api.get('/friends');
  return res.data as FriendListItem[];
}

export type FriendMapPresenceFriend = {
  id: string;
  username?: string;
  name?: string;
  avatar?: string;
  sharing_enabled: boolean;
  last_seen_at?: string | null;
  last_seen_minutes_ago?: number | null;
  is_stale: boolean;
  position?: {
    latitude: number;
    longitude: number;
    accuracy_meters?: number | null;
  } | null;
  venue_presence?: {
    type: 'inside' | 'nearby';
    venue_id: string;
    venue_name: string;
    radius_meters: number;
    distance_meters?: number | null;
    entered_at?: string | null;
  } | null;
};

export type FriendMapHotspot = {
  venue_id: string;
  venue_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  friend_count: number;
  active_event_count: number;
  upcoming_event_count: number;
  vibe: 'hot' | 'warm';
  friends: Array<{ id: string; name: string; avatar?: string | null }>;
};

export type FriendMapPresenceResponse = {
  sharing_enabled: boolean;
  my_last_location_updated_at?: string | null;
  friends: FriendMapPresenceFriend[];
  hotspots: FriendMapHotspot[];
};

export async function fetchFriendMapPresence() {
  const res = await api.get('/friends/map');
  return res.data as FriendMapPresenceResponse;
}

export async function updateFriendLocationSharing(enabled: boolean) {
  const res = await api.post('/friends/location-sharing', { enabled });
  return res.data as {
    user_id: string;
    sharing_enabled: boolean;
    last_location_updated_at?: string | null;
  };
}

export async function listFriendRequests() {
  const res = await api.get('/friends/requests');
  return res.data as {
    incoming: Array<{ id: string; from_user: { id: string; username?: string; name?: string; avatar?: string } }>;
    outgoing: Array<{ id: string; to_user: { id: string; username?: string; name?: string; avatar?: string } }>;
  };
}

export async function sendFriendRequest(payload: { username?: string; user_id?: string }) {
  const res = await api.post('/friends/requests', payload);
  return res.data;
}

export async function acceptFriendRequest(id: string) {
  const res = await api.post(`/friends/requests/${id}/accept`);
  return res.data;
}

export async function rejectFriendRequest(id: string) {
  const res = await api.post(`/friends/requests/${id}/reject`);
  return res.data;
}

export async function removeFriend(id: string) {
  const res = await api.delete(`/friends/${id}`);
  return res.data;
}

export async function listFriendGroups() {
  const res = await api.get('/friend-groups');
  return res.data as Array<{
    id: string;
    name: string;
    owner_id?: string;
    members: Array<{ user: { id: string; username?: string; name?: string; avatar?: string } }>;
  }>;
}

export async function createFriendGroup(payload: { name: string; member_ids?: string[] }) {
  const res = await api.post('/friend-groups', payload);
  return res.data;
}

export async function addFriendGroupMember(groupId: string, user_id: string) {
  const res = await api.post(`/friend-groups/${groupId}/members`, { user_id });
  return res.data;
}

export async function removeFriendGroupMember(groupId: string, userId: string) {
  const res = await api.delete(`/friend-groups/${groupId}/members/${userId}`);
  return res.data;
}

export async function updateFriendGroup(groupId: string, payload: { name?: string }) {
  const res = await api.post(`/friend-groups/${groupId}`, payload);
  return res.data;
}

export async function deleteFriendGroup(groupId: string) {
  const res = await api.delete(`/friend-groups/${groupId}`);
  return res.data;
}

export type GroupTableProposal = {
  id: string;
  group_id: string;
  status: 'voting' | 'ready' | 'booked' | 'cancelled';
  guests: number;
  note?: string | null;
  created_at: string;
  updated_at: string;
  created_by_user: { id: string; username?: string; name?: string; avatar?: string };
  event: { id: string; name: string; date: string; start_time?: string | null; end_time?: string | null; status?: string };
  venue: { id: string; name: string; city?: string | null };
  booked_reservation?: { id: string; status: string; guests: number; created_at: string } | null;
  votes: Array<{
    id: string;
    user_id: string;
    vote: 'yes' | 'no' | 'pending';
    updated_at: string;
    user: { id: string; username?: string; name?: string; avatar?: string };
  }>;
  vote_stats: { yes: number; no: number; pending: number };
};

export async function listGroupTableProposals(groupId: string) {
  const res = await api.get(`/friend-groups/${groupId}/table-proposals`);
  return res.data as GroupTableProposal[];
}

export async function createGroupTableProposal(
  groupId: string,
  payload: { venue_id: string; event_id?: string; guests: number; note?: string },
) {
  const res = await api.post(`/friend-groups/${groupId}/table-proposals`, payload);
  return res.data as GroupTableProposal;
}

export async function voteGroupTableProposal(
  groupId: string,
  proposalId: string,
  payload: { vote: 'yes' | 'no' },
) {
  const res = await api.post(`/friend-groups/${groupId}/table-proposals/${proposalId}/vote`, payload);
  return res.data as GroupTableProposal;
}

export async function bookGroupTableProposal(
  groupId: string,
  proposalId: string,
  payload?: { table_name?: string },
) {
  const res = await api.post(`/friend-groups/${groupId}/table-proposals/${proposalId}/book`, payload ?? {});
  return res.data as {
    reservation: { id: string; status: string; guests: number };
    proposal_id: string;
    booked_guests?: number;
    already_booked?: boolean;
  };
}

export async function cancelGroupTableProposal(groupId: string, proposalId: string) {
  const res = await api.post(`/friend-groups/${groupId}/table-proposals/${proposalId}/cancel`);
  return res.data as GroupTableProposal;
}
