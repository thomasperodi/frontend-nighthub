export type UserRole = 'client' | 'staff' | 'venue' | 'admin';

export type User = {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  phone?: string;
  avatar?: string;
  venue_id?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
  created_at?: string;
  updated_at?: string;
};

export type PublicUser = Pick<User, 'id' | 'email' | 'role' | 'venue_id'>;

export type UserProfile = User & {
  total_reservations?: number;
  favorite_venues?: string[];
  promos_collected?: string[];
};

export type UpdateUserDto = {
  name?: string;
  phone?: string;
  avatar?: string;
};

// User Promos (saved/collected promos)
export type UserPromo = {
  id: string;
  user_id: string;
  promo_id: string;
  collected_at: string;
  used_at?: string;
  status: 'collected' | 'used' | 'expired';
};
