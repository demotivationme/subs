/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ground: { DEFAULT: '#F5F6F8', dark: '#0E1013' },
        surface: { DEFAULT: '#FFFFFF', dark: '#171A1F' },
        surface2: { DEFAULT: '#EEF0F3', dark: '#20242B' },
        line: { DEFAULT: '#E3E6EA', dark: '#2A2F37' },
        ink: { DEFAULT: '#14171C', dark: '#F1F3F5' },
        muted: { DEFAULT: '#5B6370', dark: '#9AA3AF' },
        accent: { DEFAULT: '#0B7A57', dark: '#34C08E', soft: '#E2F3EB', 'soft-dark': '#12382A', strong: '#075A40' },
        warn: { DEFAULT: '#9A4A06', soft: '#FDF1DD', ink: '#5A2E04' },
        danger: { DEFAULT: '#B42F25', dark: '#F07A70' },
        hero: { dark: '#13402F', 'border-dark': '#1F5A43', 'label-dark': '#B9E9D5' },
        badge: { DEFAULT: '#D9342B' },
        cat: { 1: '#0B7A57', 2: '#2F6FDB', 3: '#E39B2B', 4: '#7A5AE0', 5: '#D2497A', rest: '#9AA3AF' },
      },
      fontFamily: {
        display: ['Manrope_800ExtraBold'],
        heading: ['Manrope_700Bold'],
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
      },
      borderRadius: { card: '20px', tile: '16px' },
    },
  },
  plugins: [],
};
