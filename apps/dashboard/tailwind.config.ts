import type { Config } from 'tailwindcss';

/** Tokens pinned by idea.md §14 — see docs/DESIGN.md. Do not restyle. */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#111312',
        panel: '#1c1c1c',
        panel2: '#232323',
        hoverline: '#1a1a1a',
        line: '#2e2e2e',
        brand: { DEFAULT: '#3ECF8E', hover: '#36ba80', tint: 'rgba(62,207,142,0.12)' },
        fg: '#ededed',
        muted: '#8b8d91',
        danger: '#ef4444',
        warn: '#f5a623',
        oktext: '#0d1f17',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Roboto Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      animation: { pulseDot: 'pulseDot 2s ease-in-out infinite' },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
