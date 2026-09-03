import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          950: '#05070d',
          900: '#0a0e17',
          850: '#0d1220',
          800: '#111827',
          700: '#1a2436',
          600: '#26334a',
        },
        accent: {
          400: '#5eb1ff',
          500: '#2f8bf5',
          600: '#1c6fdc',
          700: '#1557ad',
        },
        police: {
          500: '#3b82f6',
          glow: '#60a5fa',
        },
        danger: {
          500: '#ef4444',
          600: '#dc2626',
        },
        success: {
          500: '#22c55e',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        hud: '0 0 0 1px rgba(94,177,255,0.15), 0 8px 30px -8px rgba(0,0,0,0.6)',
        glow: '0 0 24px rgba(59,130,246,0.35)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(94,177,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(94,177,255,0.06) 1px, transparent 1px)',
      },
      keyframes: {
        flipIn: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        bootPulse: {
          '0%,100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        bootPulse: 'bootPulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
