export const MOCK_METRICS = {
  activeVenues: 12,
  totalUsers: 18420,
  revenueMonth: 42850,
  reservationsToday: 312,
};

export const MOCK_VENUES = [
  { id: 1, name: "Club Luna", city: "Milano", status: "Attivo", occupancy: 78, revenue: 6420 },
  { id: 2, name: "The Club", city: "Roma", status: "Attivo", occupancy: 64, revenue: 5280 },
  { id: 3, name: "Paradise", city: "Torino", status: "In revisione", occupancy: 0, revenue: 0 },
];

export const MOCK_USERS = [
  { id: 101, name: "Marco Rossi", role: "Cliente", status: "Attivo" },
  { id: 102, name: "Giulia Bianchi", role: "Staff", status: "Attivo" },
  { id: 103, name: "Alessandro Verdi", role: "Venue", status: "Sospeso" },
];

export const MOCK_REVENUE = [
  { label: "Lun", value: 4200 },
  { label: "Mar", value: 5100 },
  { label: "Mer", value: 3800 },
  { label: "Gio", value: 6200 },
  { label: "Ven", value: 8400 },
  { label: "Sab", value: 11200 },
  { label: "Dom", value: 6900 },
];

export const MOCK_ALERTS = [
  { id: 1, title: "Richieste locali", detail: "2 nuove richieste in attesa" },
  { id: 2, title: "Segnalazioni utenti", detail: "3 segnalazioni da verificare" },
  { id: 3, title: "Pagamenti in sospeso", detail: "5 payout da processare" },
];

export const MOCK_ADMIN = {
  name: "Admin",
  email: "admin@example.com",
  role: "Super Admin",
};
