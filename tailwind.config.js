/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter_400Regular'],
        'inter-light': ['Inter_300Light'],
        'inter-medium': ['Inter_500Medium'],
        'inter-semibold': ['Inter_600SemiBold'],
        'inter-bold': ['Inter_700Bold'],
      },
      colors: {
        background: {
          DEFAULT: '#FFFFFF',
          secondary: '#F5F5F7',
          tertiary: '#E8E8ED',
        },
        foreground: {
          DEFAULT: '#000000',
          muted: '#6B7280',
          subtle: '#9CA3AF',
        },
        border: {
          DEFAULT: '#E5E5EA',
          light: '#F0F0F2',
        },
        accent: {
          DEFAULT: '#000000',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        success: {
          DEFAULT: '#22C55E',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#F59E0B',
          foreground: '#000000',
        },
        card: {
          DEFAULT: '#FFFFFF',
          hover: '#FAFAFA',
        },
        camera: {
          bg: '#1A1A1A',
          overlay: 'rgba(0, 0, 0, 0.6)',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
