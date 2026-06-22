/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'cabin': {
          900: '#06080d',
          800: '#0a0e17',
          700: '#101825',
          600: '#1a2538',
          500: '#253550',
        },
        'titanium': {
          dark: '#1a1d23',
          DEFAULT: '#3a3f47',
          light: '#6b7280',
          accent: '#8b93a1',
        },
        'o2': {
          low: '#dc2626',
          warn: '#f59e0b',
          safe: '#10b981',
          high: '#3b82f6',
        },
        'co2': {
          safe: '#22d3ee',
          warn: '#fb923c',
          danger: '#ef4444',
        },
        'neon': {
          cyan: '#06f0ff',
          green: '#39ff14',
          amber: '#ffbf00',
          pink: '#ff2d95',
          violet: '#b24bff',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        display: ['Orbitron', 'Exo 2', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scanline 3s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor, 0 0 10px currentColor' },
          '100%': { boxShadow: '0 0 15px currentColor, 0 0 30px currentColor' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
