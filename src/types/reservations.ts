import { Event, Venue } from './events';
import type { VenueTable } from './tables';
import type { User } from './users';

export type ReservationUser = Pick<User, 'id' | 'name' | 'email' | 'phone'>;

export type ReservationInvitationStatus = 'pending' | 'accepted' | 'declined';

export type ReservationTableInvite = {
  user_id: string;
  status: ReservationInvitationStatus;
  source: 'direct' | 'group';
  invited_group_ids?: string[];
  responded_at?: string | null;
};

export type ReservationMeta = {
  booking_mode?: string;
  zone_label?: string;
  invited_friend_ids?: string[];
  invited_group_ids?: string[];
  inviter_user_id?: string;
  inviter_name?: string;
  table_invites?: ReservationTableInvite[];
};

export type Reservation = {
  id: string;
  user_id: string;
  event_id: string;
  venue_zone_id?: string | null;
  venue_table_id?: string | null;
  table_name?: string | null;
  meta?: ReservationMeta | null;
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
  venue_zone_id?: string | null;
  venue_table_id?: string | null;
  table_name?: string | null;
  status?: Reservation['status'];
  total_amount?: number;
  meta?: Partial<ReservationMeta> & {
    zona?: string;
    invited_groups?: string[];
  };
};

export type UpdateReservationDto = Partial<CreateReservationDto> & {
  status?: Reservation['status'];
};
