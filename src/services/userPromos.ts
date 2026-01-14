import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'user_promos_v1';

export async function getUserPromos() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch(e) { return []; }
}

export async function addUserPromo(id: string) {
  const list = await getUserPromos();
  if (!list.includes(id)) {
    list.push(id);
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  }
  return list;
}
