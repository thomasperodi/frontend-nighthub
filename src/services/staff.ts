import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';
import { EventStats } from '../types/events';

type BackendEntry = {
  id: string;
  event_id: string;
  user_id?: string | null;
  staff_id?: string | null;
  sesso?: 'M' | 'F' | 'ALTRO' | null;
  is_complimentary?: boolean;
  age_bucket?:
    | 'AGE_18_20'
    | 'AGE_21_24'
    | 'AGE_25_29'
    | 'AGE_30_34'
    | 'AGE_35_PLUS'
    | 'UNKNOWN'
    | null;
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
  gender?: 'M' | 'F' | 'ALTRO' | null;
  is_complimentary?: boolean;
  age_bucket?:
    | 'AGE_18_20'
    | 'AGE_21_24'
    | 'AGE_25_29'
    | 'AGE_30_34'
    | 'AGE_35_PLUS'
    | 'UNKNOWN'
    | null;
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

export type TableBottleOrderStatus = 'requested' | 'preparing' | 'delivered';

export type TableBottleOrder = {
  id: string;
  event_table_id: string;
  bottle_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: TableBottleOrderStatus;
  note?: string | null;
  created_at?: string;
  prepared_at?: string | null;
  delivered_at?: string | null;
  requested_by_staff_id?: string | null;
  prepared_by_staff_id?: string | null;
  delivered_by_staff_id?: string | null;
  is_table_saldato?: boolean;
  table?: {
    id: string;
    event_id?: string;
    numero?: number | null;
    nome: string;
    table_name?: string | null;
    zona?: string | null;
    prenotati?: number;
    entrati?: number;
  } | null;
};

export type ScanEntryQrResult = {
  success: boolean;
  alreadyCheckedIn: boolean;
  reservation?: {
    id: string;
    user_id: string;
    event_id: string;
    checked_in_at?: string | null;
  };
  entry?: {
    id: string;
    event_id: string;
    user_id?: string | null;
  };
};

function mapEntry(e: BackendEntry): StaffEntry {
  const entry_type: StaffEntry['entry_type'] = e.is_complimentary
    ? 'free'
    : e.sesso === 'M'
      ? 'male'
      : e.sesso === 'F'
        ? 'female'
        : 'free';

  return {
    id: e.id,
    event_id: e.event_id,
    staff_id: e.staff_id ?? null,
    quantity: 1,
    entry_type,
    gender: e.sesso ?? null,
    is_complimentary: Boolean(e.is_complimentary),
    age_bucket: e.age_bucket ?? null,
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
  user_id?: string;
  quantity?: number;
  entry_type?: 'male' | 'female' | 'free';
  gender?: 'M' | 'F' | 'ALTRO';
  is_complimentary?: boolean;
  age_bucket?:
    | 'AGE_18_20'
    | 'AGE_21_24'
    | 'AGE_25_29'
    | 'AGE_30_34'
    | 'AGE_35_PLUS'
    | 'UNKNOWN';
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

export async function scanEntryQr(input: {
  event_id: string;
  qr_data: string;
  staff_id?: string;
}): Promise<ScanEntryQrResult> {
  const { data } = await api.post<ScanEntryQrResult>(
    API_ENDPOINTS.RESERVATIONS.SCAN_ENTRY_QR,
    input,
  );
  return data;
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
  table_name?: string | null;
  zona?: string | null;
  per_testa: number; // spend per person
  costo_minimo?: number | null;
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
  bottle_orders?: TableBottleOrder[];
};

type BackendTableBottleOrder = Omit<
  TableBottleOrder,
  'quantity' | 'unit_price' | 'total_price' | 'table'
> & {
  quantity: any;
  unit_price: any;
  total_price: any;
  table?: {
    id: string;
    event_id?: string;
    numero?: any;
    nome: string;
    table_name?: string | null;
    zona?: string | null;
    prenotati?: any;
    entrati?: any;
  } | null;
};

function mapBottleOrder(order: BackendTableBottleOrder): TableBottleOrder {
  return {
    ...order,
    quantity: Number(order.quantity ?? 0),
    unit_price: toNumber(order.unit_price),
    total_price: toNumber(order.total_price),
    status: (String(order.status ?? 'requested').toLowerCase() as TableBottleOrderStatus),
    table: order.table
      ? {
          ...order.table,
          numero:
            order.table.numero === null || order.table.numero === undefined
              ? null
              : Number(order.table.numero),
          prenotati: Number(order.table.prenotati ?? 0),
          entrati: Number(order.table.entrati ?? 0),
        }
      : null,
  };
}

type BackendWaiterTable = Omit<WaiterTable, 'per_testa' | 'costo_minimo' | 'prenotati' | 'entrati' | 'pagato_iniziale' | 'pagato_totale' | 'table_sales'> & {
  per_testa: any;
  costo_minimo?: any;
  prenotati: any;
  entrati: any;
  pagato_iniziale?: any;
  pagato_totale?: any;
  table_sales?: Array<{ id: string; amount: any; created_at: string }>;
  bottle_orders?: BackendTableBottleOrder[];
};

function mapWaiterTable(t: BackendWaiterTable): WaiterTable {
  return {
    ...t,
    per_testa: toNumber(t.per_testa),
    costo_minimo: t.costo_minimo === null || t.costo_minimo === undefined ? null : toNumber(t.costo_minimo),
    prenotati: Number(t.prenotati ?? 0),
    entrati: Number(t.entrati ?? 0),
    pagato_iniziale:
      t.pagato_iniziale === null || t.pagato_iniziale === undefined
        ? null
        : toNumber(t.pagato_iniziale),
    pagato_totale:
      t.pagato_totale === null || t.pagato_totale === undefined
        ? null
        : toNumber(t.pagato_totale),
    table_sales: (t.table_sales ?? []).map((s) => ({
      ...s,
      amount: toNumber(s.amount),
    })),
    bottle_orders: (t.bottle_orders ?? []).map(mapBottleOrder),
  };
}

export async function getWaiterTables(
  userId: string,
  eventId?: string,
  options?: { onlyBooked?: boolean; venueId?: string },
): Promise<WaiterTable[]> {
  const { data } = await api.get<BackendWaiterTable[]>('/staff/waiter/tables', {
    params: { userId, eventId, ...options },
  });
  return (data ?? []).map(mapWaiterTable);
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

export async function createTableBottleOrder(
  tableId: string,
  input: {
    bottle_key?: string;
    bottle_name?: string;
    quantity: number;
    unit_price?: number;
    note?: string;
    auto_settle?: boolean;
    station_id?: string;
  },
): Promise<TableBottleOrder> {
  const { data } = await api.post<BackendTableBottleOrder>(
    API_ENDPOINTS.STAFF.WAITER_TABLE_BOTTLE_ORDERS(tableId),
    input,
  );
  return mapBottleOrder(data);
}

export async function listBottleOrders(
  eventId?: string,
  options?: { venueId?: string; status?: TableBottleOrderStatus },
): Promise<TableBottleOrder[]> {
  const { data } = await api.get<BackendTableBottleOrder[]>(
    API_ENDPOINTS.STAFF.BOTTLE_ORDERS,
    {
      params: {
        ...(eventId ? { eventId } : {}),
        ...(options?.venueId ? { venueId: options.venueId } : {}),
        ...(options?.status ? { status: options.status } : {}),
      },
    },
  );
  return (data ?? []).map(mapBottleOrder);
}

export async function prepareBottleOrder(orderId: string): Promise<TableBottleOrder> {
  const { data } = await api.post<BackendTableBottleOrder>(
    API_ENDPOINTS.STAFF.BOTTLE_ORDER_PREPARE(orderId),
  );
  return mapBottleOrder(data);
}

export async function dispatchBottleOrder(orderId: string): Promise<TableBottleOrder> {
  const { data } = await api.post<BackendTableBottleOrder>(
    API_ENDPOINTS.STAFF.BOTTLE_ORDER_DISPATCH(orderId),
  );
  return mapBottleOrder(data);
}
