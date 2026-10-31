/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a', // GovTech Royal Indigo
          950: '#0f172a',
        },
        voice: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981', // WhatsApp Voice Emerald
          600: '#059669',
          700: '#047857',
        },
        alert: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706', // Rural Alert Amber
        },
        slate: {
          850: '#111827',
          900: '#0f172a',
          950: '#020617',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        indic: ['"Noto Sans Devanagari"', 'Mukta', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'ambient': '0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave': 'waveform 1.2s ease-in-out infinite',
      },
      keyframes: {
        waveform: {
          '0%, 100%': { height: '8px' },
          '50%': { height: '28px' },
        }
      }
    },
  },
  plugins: [],
}
