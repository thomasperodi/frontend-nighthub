import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';
import { EventStats } from '../types/events';

type BackendEntry = {
  id: string;
  event_id: string;
  user_id?: string | null;
  staff_id?: string | null;
  sesso?: 'M' | 'F' | 'ALTRO' | null;
  price?: any;
  method?: string | null;
  created_at?: string;
};

type BackendBarSale = {
  id: string;
  event_id: string;
  amount: any;
  created_at?: string;
};

type BackendCloakroomSale = BackendBarSale;

type BackendTableSale = {
  id: string;
  event_table_id: string;
  amount: any;
  created_at?: string;
};

const toNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
    try {
      return value.toNumber();
    } catch {
      return 0;
    }
  }
  return 0;
};

export type StaffEntry = {
  id: string;
  event_id: string;
  staff_id?: string | null;
  quantity: number; // compat: backend stores 1 row per person
  entry_type?: 'male' | 'female' | 'free' | null; // derived from `sesso`
  created_at?: string;
};

export type StaffSale = {
  id: string;
  event_id?: string;
  event_table_id?: string;
  staff_id?: string | null;
  amount: number;
  created_at?: string;
};

function mapEntry(e: BackendEntry): StaffEntry {
  const entry_type: StaffEntry['entry_type'] =
    e.sesso === 'M' ? 'male' : e.sesso === 'F' ? 'female' : 'free';

  return {
    id: e.id,
    event_id: e.event_id,
    staff_id: e.staff_id ?? null,
    quantity: 1,
    entry_type,
    created_at: e.created_at,
  };
}

function mapSale(s: BackendBarSale, eventId?: string): StaffSale {
  return {
    id: s.id,
    event_id: s.event_id ?? eventId,
    amount: toNumber(s.amount),
    created_at: s.created_at,
  };
}

function mapTableSale(s: BackendTableSale, eventId?: string): StaffSale {
  return {
    id: s.id,
    event_id: eventId,
    event_table_id: s.event_table_id,
    amount: toNumber(s.amount),
    created_at: s.created_at,
  };
}

export async function recordEntry(input: {
  event_id: string;
  staff_id?: string;
  quantity?: number;
  entry_type?: 'male' | 'female' | 'free';
}): Promise<{ success: boolean; created: number; stats: EventStats }>
{
  const { data } = await api.post<{ success: boolean; created: number; stats: EventStats }>(
    API_ENDPOINTS.STAFF.ENTRIES,
    input,
  );
  return data;
}

export async function listEntries(eventId?: string): Promise<StaffEntry[]> {
  const { data } = await api.get<BackendEntry[]>(API_ENDPOINTS.STAFF.ENTRIES, {
    params: eventId ? { eventId } : undefined,
  });
  return (data ?? []).map(mapEntry);
}

export async function recordBarSale(input: {
  event_id: string;
  staff_id?: string;
  amount: number;
}): Promise<{ sale: StaffSale; stats: EventStats }>
{
  const { data } = await api.post<{ sale: StaffSale; stats: EventStats }>(
    API_ENDPOINTS.STAFF.BAR_SALES,
    input,
  );
  return data;
}

export async function listBarSales(eventId?: string): Promise<StaffSale[]> {
  const { data } = await api.get<BackendBarSale[]>(API_ENDPOINTS.STAFF.BAR_SALES, {
    params: eventId ? { eventId } : undefined,
  });
  return (data ?? []).map((s) => mapSale(s, eventId));
}

export async function recordCloakroomSale(input: {
  event_id: string;
  staff_id?: string;
  amount: number;
}): Promise<{ sale: StaffSale; stats: EventStats }>
{
  const { data } = await api.post<{ sale: StaffSale; stats: EventStats }>(
    API_ENDPOINTS.STAFF.CLOAKROOM_SALES,
    input,
  );
  return data;
}

export async function listCloakroomSales(eventId?: string): Promise<StaffSale[]> {
  const { data } = await api.get<BackendCloakroomSale[]>(
    API_ENDPOINTS.STAFF.CLOAKROOM_SALES,
    { params: eventId ? { eventId } : undefined },
  );
  return (data ?? []).map((s) => mapSale(s, eventId));
}

export async function recordTableSale(input: {
  event_table_id: string;
  event_id?: string;
  staff_id?: string;
  amount: number;
}): Promise<{ sale: StaffSale; stats: EventStats }>
{
  const { data } = await api.post<{ sale: StaffSale; stats: EventStats }>(
    API_ENDPOINTS.STAFF.TABLE_SALES,
    input,
  );
  return data;
}

export async function listTableSales(eventId?: string): Promise<StaffSale[]> {
  const { data } = await api.get<BackendTableSale[]>(API_ENDPOINTS.STAFF.TABLE_SALES, {
    params: eventId ? { eventId } : undefined,
  });
  return (data ?? []).map((s) => mapTableSale(s, eventId));
}

export async function fetchStaffEventStats(eventId: string): Promise<EventStats> {
  const { data } = await api.get<EventStats>(
    API_ENDPOINTS.STAFF.EVENT_STATS(eventId),
  );
  return data;
}

// Waiter Tables
export type WaiterTable = {
  id: string;
  event_id?: string | null;
  venue_id?: string | null;
  nome: string; // PR/gruppo name
  zona?: string | null;
  per_testa: number; // spend per person
  prenotati: number; // total booked
  entrati: number; // people entered
  numero?: number | null; // table number
  pagato_iniziale?: number | null;
  pagato_totale?: number | null;
  stato_pagamento?: string | null; // 'in_attesa', 'parziale', 'saldato'
  is_saldato: boolean;
  created_at?: string;
  table_waiters?: Array<{ user_id: string; users: { id: string; email: string; role: string } }>;
  table_sales?: Array<{ id: string; amount: number; created_at: string }>;
};

export async function getWaiterTables(
  userId: string,
  eventId?: string,
  options?: { onlyBooked?: boolean; venueId?: string },
): Promise<WaiterTable[]> {
  const { data } = await api.get<WaiterTable[]>('/staff/waiter/tables', {
    params: { userId, eventId, ...options },
  });
  return data;
}

export async function addTablePayment(
  tableId: string,
  amount: number,
  staffId?: string,
  eventId?: string,
): Promise<{ table: WaiterTable; sale: StaffSale }> {
  const { data } = await api.post<{ table: WaiterTable; sale: StaffSale }>(
    `/staff/waiter/tables/${tableId}/payment`,
    { amount },
    { params: { staffId, eventId } },
  );
  return data;
}

export async function settleTable(tableId: string): Promise<WaiterTable> {
  const { data } = await api.post<WaiterTable>(`/staff/waiter/tables/${tableId}/settle`);
  return data;
}
