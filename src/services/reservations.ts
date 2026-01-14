import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'reservations_v1';

export async function getReservations() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch(e) { return []; }
}

export async function saveReservations(list: any[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function createReservation(res: any) {
  const all = await getReservations();
  all.unshift(res);
  await saveReservations(all);
  return res;
}

export async function getReservation(id: string) {
  const all = await getReservations();
  return all.find((r:any) => r.id === id);
}

export async function cancelReservation(id: string) {
  let all = await getReservations();
  all = all.map((r:any) => r.id === id ? { ...r, status: 'cancelled' } : r);
  await saveReservations(all);
  return await getReservation(id);
}
