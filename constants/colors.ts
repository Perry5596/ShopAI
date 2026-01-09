/**
 * Shop AI Color Palette
 * Cal AI-inspired, Shadcn-compatible design tokens
 */

export const colors = {
  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F7',
  backgroundTertiary: '#E8E8ED',
  
  // Foreground / Text
  foreground: '#000000',
  foregroundMuted: '#6B7280',
  foregroundSubtle: '#9CA3AF',
  
  // Borders
  border: '#E5E5EA',
  borderLight: '#F0F0F2',
  
  // Accent (Primary actions)
  accent: '#000000',
  accentForeground: '#FFFFFF',
  
  // Destructive
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  
  // Success
  success: '#22C55E',
  successForeground: '#FFFFFF',
  
  // Warning
  warning: '#F59E0B',
  warningForeground: '#000000',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  
  // Card
  card: '#FFFFFF',
  cardHover: '#FAFAFA',
  
  // Camera specific
  cameraBackground: '#1A1A1A',
  cameraOverlay: 'rgba(0, 0, 0, 0.6)',
  viewfinderBorder: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof colors;
