/**
 * Shop AI Icon Mappings
 * Centralized icon definitions using @expo/vector-icons
 */

import { Ionicons, MaterialIcons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export type IconFamily = 'ionicons' | 'material' | 'feather' | 'materialCommunity';

export const icons = {
  // Navigation
  back: { family: 'ionicons' as const, name: 'chevron-back' as const },
  close: { family: 'ionicons' as const, name: 'close' as const },
  menu: { family: 'ionicons' as const, name: 'ellipsis-horizontal' as const },
  chevronRight: { family: 'ionicons' as const, name: 'chevron-forward' as const },
  
  // Actions
  add: { family: 'ionicons' as const, name: 'add' as const },
  share: { family: 'ionicons' as const, name: 'share-outline' as const },
  bookmark: { family: 'ionicons' as const, name: 'bookmark-outline' as const },
  bookmarkFilled: { family: 'ionicons' as const, name: 'bookmark' as const },
  heart: { family: 'ionicons' as const, name: 'heart-outline' as const },
  heartFilled: { family: 'ionicons' as const, name: 'heart' as const },
  
  // Camera
  flash: { family: 'ionicons' as const, name: 'flash' as const },
  flashOff: { family: 'ionicons' as const, name: 'flash-off' as const },
  cameraFlip: { family: 'ionicons' as const, name: 'camera-reverse-outline' as const },
  image: { family: 'ionicons' as const, name: 'image-outline' as const },
  help: { family: 'ionicons' as const, name: 'help-circle-outline' as const },
  
  // Profile & Settings
  person: { family: 'ionicons' as const, name: 'person-outline' as const },
  personFilled: { family: 'ionicons' as const, name: 'person' as const },
  settings: { family: 'ionicons' as const, name: 'settings-outline' as const },
  language: { family: 'ionicons' as const, name: 'language-outline' as const },
  mail: { family: 'ionicons' as const, name: 'mail-outline' as const },
  document: { family: 'ionicons' as const, name: 'document-text-outline' as const },
  shield: { family: 'ionicons' as const, name: 'shield-checkmark-outline' as const },
  sync: { family: 'ionicons' as const, name: 'sync-outline' as const },
  logout: { family: 'ionicons' as const, name: 'log-out-outline' as const },
  trash: { family: 'ionicons' as const, name: 'trash-outline' as const },
  bulb: { family: 'ionicons' as const, name: 'bulb-outline' as const },
  card: { family: 'ionicons' as const, name: 'card-outline' as const },
  
  // Social
  instagram: { family: 'ionicons' as const, name: 'logo-instagram' as const },
  tiktok: { family: 'ionicons' as const, name: 'logo-tiktok' as const },
  
  // Auth
  apple: { family: 'ionicons' as const, name: 'logo-apple' as const },
  google: { family: 'ionicons' as const, name: 'logo-google' as const },
  
  // Misc
  sparkles: { family: 'ionicons' as const, name: 'sparkles' as const },
  dollar: { family: 'ionicons' as const, name: 'cash-outline' as const },
  link: { family: 'ionicons' as const, name: 'link-outline' as const },
  externalLink: { family: 'ionicons' as const, name: 'open-outline' as const },
  checkmark: { family: 'ionicons' as const, name: 'checkmark' as const },
  star: { family: 'ionicons' as const, name: 'star' as const },
  starOutline: { family: 'ionicons' as const, name: 'star-outline' as const },
  bag: { family: 'ionicons' as const, name: 'bag-outline' as const },
  bagFilled: { family: 'ionicons' as const, name: 'bag' as const },
  crown: { family: 'ionicons' as const, name: 'diamond-outline' as const },
} as const;

export type IconName = keyof typeof icons;
