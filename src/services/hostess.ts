import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';

export type HostessTable = {
  id: string;
  event_id?: string;
  venue_table_id?: string;
  nome: string; // PR name or table group name
  prenotati: number; // total booked
  entrati: number; // people entered
  numero?: number | null; // table number
  zona?: string | null; // zone/area in venue
  per_testa: number; // spend per person (e.g., 30)
  stato?: 'attesa' | 'parziale' | 'completo';
  // Campi pagamento (per cameriere)
  pagato_iniziale?: number | null;
  pagato_totale?: number | null;
  stato_pagamento?: string | null;
  is_saldato?: boolean;
};

type BackendVenueTable = {
  id: string;
  venue_id: string;
  nome: string;
  zona?: string | null;
  numero?: number | null;
  per_testa?: any;
};

type BackendEventTable = {
  id: string;
  event_id: string;
  venue_table_id: string;
  prenotati: number;
  entrati: number;
  pagato_totale: any;
  stato: string;
  venue_table?: BackendVenueTable;
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

function mapEventTableToHostessTable(t: BackendEventTable): HostessTable {
  const prenotati = Number(t.prenotati ?? 0);
  const entrati = Number(t.entrati ?? 0);
  const per_testa = toNumber(t.venue_table?.per_testa);
  const pagato_totale = toNumber(t.pagato_totale);

  const stato: HostessTable['stato'] =
    entrati >= prenotati
      ? 'completo'
      : entrati > 0
        ? 'parziale'
        : 'attesa';

  const is_saldato = (t.stato ?? '').toLowerCase() === 'saldato';
  const stato_pagamento = is_saldato
    ? 'saldato'
    : pagato_totale > 0
      ? 'parziale'
      : 'in_attesa';

  return {
    id: t.id,
    event_id: t.event_id,
    venue_table_id: t.venue_table_id,
    nome: t.venue_table?.nome ?? 'Tavolo',
    prenotati,
    entrati,
    numero: t.venue_table?.numero ?? null,
    zona: t.venue_table?.zona ?? null,
    per_testa,
    stato,
    pagato_iniziale: null,
    pagato_totale,
    stato_pagamento,
    is_saldato,
  };
}

export async function listHostessTables(params?: { eventId?: string; venueId?: string; onlyBooked?: boolean }) {
  const { data } = await api.get<BackendEventTable[]>(API_ENDPOINTS.STAFF.HOSTESS_TABLES, {
    params,
  });
  return (data ?? []).map(mapEventTableToHostessTable);
}

export async function updateHostessTableEntrati(
  tableId: string,
  delta: number,
) {
  const { data } = await api.patch<BackendEventTable>(
    API_ENDPOINTS.STAFF.HOSTESS_TABLE_DETAIL(tableId),
    { action: 'update_entrati', delta },
  );
  return mapEventTableToHostessTable(data);
}

export async function assignHostessTableNumber(
  tableId: string,
  numero: number,
) {
  const { data } = await api.patch<BackendEventTable>(
    API_ENDPOINTS.STAFF.HOSTESS_TABLE_DETAIL(tableId),
    { action: 'assign_number', numero },
  );
  return mapEventTableToHostessTable(data);
}
