import { Event, Venue } from './events';
import type { VenueTable } from './tables';
import type { User } from './users';

export type ReservationUser = Pick<User, 'id' | 'name' | 'email' | 'phone'>;

export type Reservation = {
  id: string;
  user_id: string;
  event_id: string;
  venue_table_id?: string | null;
  type: 'table' | 'entry';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  guests: number;
  total_amount?: number | string | null;
  qr_token?: string | null;
  qr_payload?: string | null;
  checked_in_at?: string | null;
  checked_in_by_staff_id?: string | null;
  checkin_entry_id?: string | null;
  created_at?: string;
  updated_at?: string;
  // Relations
  event?: Event;
  venue?: Venue;
  venue_table?: VenueTable | null;
  user?: ReservationUser;
};

export type CreateReservationDto = {
  event_id: string;
  type: Reservation['type'];
  guests: number;
  venue_table_id?: string | null;
  status?: Reservation['status'];
  total_amount?: number;
};

export type UpdateReservationDto = Partial<CreateReservationDto> & {
  status?: Reservation['status'];
};
