/**
 * Shop AI Typography System
 * Consistent text styles throughout the app
 */

export const typography = {
  // Headings
  h1: 'text-[28px] font-bold leading-tight',
  h2: 'text-[24px] font-bold leading-tight',
  h3: 'text-[20px] font-semibold leading-snug',
  h4: 'text-[18px] font-semibold leading-snug',
  
  // Body
  body: 'text-[16px] font-normal leading-normal',
  bodySmall: 'text-[14px] font-normal leading-normal',
  
  // Caption
  caption: 'text-[12px] font-medium leading-tight',
  captionSmall: 'text-[11px] font-medium leading-tight',
  
  // Labels
  label: 'text-[14px] font-medium leading-tight',
  labelSmall: 'text-[12px] font-medium leading-tight',
  
  // Button text
  button: 'text-[16px] font-semibold leading-none',
  buttonSmall: 'text-[14px] font-semibold leading-none',
} as const;

export type TypographyToken = keyof typeof typography;
