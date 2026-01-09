/**
 * Shop AI Typography System
 * Consistent text styles throughout the app using Inter font
 */

export const typography = {
  // Headings - using lighter weights for modern look
  h1: 'text-[28px] font-inter-semibold leading-tight',
  h2: 'text-[24px] font-inter-semibold leading-tight',
  h3: 'text-[20px] font-inter-medium leading-snug',
  h4: 'text-[18px] font-inter-medium leading-snug',
  
  // Body - using regular/light weights
  body: 'text-[16px] font-inter leading-normal',
  bodySmall: 'text-[14px] font-inter leading-normal',
  bodyLight: 'text-[16px] font-inter-light leading-normal',
  
  // Caption
  caption: 'text-[12px] font-inter leading-tight',
  captionSmall: 'text-[11px] font-inter leading-tight',
  
  // Labels
  label: 'text-[14px] font-inter-medium leading-tight',
  labelSmall: 'text-[12px] font-inter leading-tight',
  
  // Button text
  button: 'text-[16px] font-inter-medium leading-none',
  buttonSmall: 'text-[14px] font-inter-medium leading-none',
  
  // Stats/Numbers - lighter weight for modern look
  statLarge: 'text-[48px] font-inter-semibold leading-none',
  statMedium: 'text-[20px] font-inter-semibold leading-none',
  statLabel: 'text-[12px] font-inter leading-tight',
} as const;

export type TypographyToken = keyof typeof typography;
