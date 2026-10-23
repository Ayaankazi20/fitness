/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './screens/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './navigation/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: { extend: { colors: { brand: { DEFAULT: '#16a34a', dark: '#15803d', soft: '#dcfce7' }, protein: '#3b82f6', carbs: '#f59e0b', fat: '#ec4899' } } },
  plugins: [],
};
