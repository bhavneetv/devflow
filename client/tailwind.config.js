/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#0B0B0C',
          border: '#27272A',
          hover: '#1C1C1F',
          active: '#1C1C1F',
          text: '#D4D4D8',
          'text-active': '#FFFFFF',
          'text-muted': '#8B8B95',
          icon: '#A1A1AA',
          'icon-active': '#F4F4F5',
        },
        header: {
          DEFAULT: '#0F1012',
          border: '#27272A',
          search: '#141416',
        },
        brand: {
          500: '#5E6AD2',
          600: '#4F59BD',
        },
        surface: {
          dark: '#0B0B0C',
          header: '#0F1012',
          panel: '#121215',
          popover: '#18181B',
          hover: '#1C1C1F',
          border: '#27272A',
          subtle: '#222225',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        'sidebar': '250px',
        'sidebar-collapsed': '64px',
        'header': '56px',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      }
    },
  },
  plugins: [],
}
