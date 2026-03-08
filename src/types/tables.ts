export type VenueTable = {
  id: string;
  venue_id: string;
  nome: string;
  zona?: string | null;
  numero?: number | null;
  per_testa?: number | string | null;
  costo_minimo?: number | string | null;
  persone_max?: number | null;
};

export type CreateVenueTableInput = {
  nome: string;
  zona?: string;
  per_testa?: number;
  costo_minimo?: number;
  persone_max?: number;
};
