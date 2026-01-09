/**
 * Shop AI TypeScript Interfaces
 */

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarUrl?: string;
  isPremium: boolean;
  createdAt: string;
}

// Shop/Scan result types
export interface Shop {
  id: string;
  userId: string;
  imageUrl: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  products: ProductLink[];
  recommendation?: ProductLink;
}

export interface ProductLink {
  id: string;
  shopId: string;
  title: string;
  price: string;
  imageUrl?: string;
  affiliateUrl: string;
  source: string; // e.g., "Amazon", "Target", etc.
  isRecommended: boolean;
  rating?: number;
  reviewCount?: number;
}

// Settings types
export interface SettingsItem {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
}

export interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

// Camera types
export interface CameraState {
  isFlashOn: boolean;
  zoom: 0.5 | 1;
  isCapturing: boolean;
}

// Navigation param types
export type RootStackParamList = {
  index: undefined;
  '(auth)/sign-in': undefined;
  '(app)/home': undefined;
  '(app)/profile': undefined;
  '(app)/snap': undefined;
  '(app)/shop/[id]': { id: string };
  '(app)/fix-issue/[id]': { id: string };
};
