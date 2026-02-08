import { api } from './api';

export async function searchUsers(query: string) {
  const res = await api.get('/friends/search', { params: { query } });
  return res.data as Array<{ id: string; username?: string; name?: string; avatar?: string }>;
}

export async function listFriends() {
  const res = await api.get('/friends');
  return res.data as Array<{ id: string; username?: string; name?: string; avatar?: string }>;
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
