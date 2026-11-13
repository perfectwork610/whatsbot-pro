import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eaf8f0',
          100: '#d2f1df',
          500: '#16a34a',
          600: '#12813d',
          700: '#0b6535',
          900: '#052f22',
        },
      },
      boxShadow: { soft: '0 8px 30px rgba(15, 23, 42, .06)' },
    },
  },
  plugins: [forms],
};
export default config;
