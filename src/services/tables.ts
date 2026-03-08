import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';
import { CreateVenueTableInput, VenueTable } from '../types/tables';

type TablesListResponse =
  | VenueTable[]
  | { data: VenueTable[] }
  | { tables: VenueTable[] };

function normalizeTablesResponse(data: TablesListResponse): VenueTable[] {
  if (Array.isArray(data)) return data;
  const anyData = data as any;
  if (Array.isArray(anyData?.data)) return anyData.data;
  if (Array.isArray(anyData?.tables)) return anyData.tables;
  return [];
}

export async function listVenueTables(venueId: string): Promise<VenueTable[]> {
  const { data } = await api.get<TablesListResponse>(API_ENDPOINTS.VENUES.TABLES(venueId));
  return normalizeTablesResponse(data);
}

export async function upsertVenueTablesBulk(
  venueId: string,
  tables: CreateVenueTableInput[],
): Promise<VenueTable[]> {
  const { data } = await api.post<TablesListResponse>(API_ENDPOINTS.VENUES.TABLES(venueId), { tables });
  return normalizeTablesResponse(data);
}

export async function deleteVenueTable(venueId: string, tableId: string): Promise<void> {
  try {
    await api.delete(API_ENDPOINTS.VENUES.TABLE_DELETE(venueId, tableId));
  } catch (error: any) {
    const message = error?.response?.data?.message;
    if (Array.isArray(message) && message.length) {
      throw new Error(String(message[0]));
    }
    if (typeof message === 'string' && message.trim().length) {
      throw new Error(message);
    }
    throw error;
  }
}

export async function updateVenueTable(
  venueId: string,
  tableId: string,
  updates: Partial<CreateVenueTableInput> & { nome?: string | null },
): Promise<VenueTable> {
  const { data } = await api.patch(
    API_ENDPOINTS.VENUES.TABLE_UPDATE(venueId, tableId),
    updates,
  );
  return data;
}
