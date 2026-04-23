import { MaterialCommunityIcons } from '@expo/vector-icons';

export type BarPriceKey =
  | 'water'
  | 'shot'
  | 'coca_cola'
  | 'beer'
  | 'red_bull'
  | 'cocktail'
  | 'premium';

export type BarMenuItem = {
  key: BarPriceKey;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  defaultPrice: number;
};

export const DEFAULT_BAR_MENU: BarMenuItem[] = [
  { key: 'water', label: 'Acqua', defaultPrice: 3, icon: 'water', color: '#3B82F6' },
  { key: 'shot', label: 'Shot', defaultPrice: 4, icon: 'fire', color: '#EF4444' },
  { key: 'coca_cola', label: 'Coca Cola', defaultPrice: 5, icon: 'bottle-capped', color: '#1F2937' },
  { key: 'beer', label: 'Birra', defaultPrice: 6, icon: 'beer', color: '#D97706' },
  { key: 'red_bull', label: 'Red Bull', defaultPrice: 6, icon: 'lightning-bolt', color: '#9333EA' },
  { key: 'cocktail', label: 'Cocktail', defaultPrice: 10, icon: 'glass-cocktail', color: '#EC4899' },
  { key: 'premium', label: 'Premium', defaultPrice: 12, icon: 'crown', color: '#F59E0B' },
];
