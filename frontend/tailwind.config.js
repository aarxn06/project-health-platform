/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        sidebar: 'var(--bg-sidebar)',
        card: {
          DEFAULT: 'var(--bg-card)',
          hover: 'var(--bg-card-hover)',
        },
        input: 'var(--bg-input)',
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          violet: 'var(--accent-violet)',
          blue: 'var(--accent-blue)',
        },
        semantic: {
          success: 'var(--success)',
          yellow: 'var(--warning-yellow)',
          orange: 'var(--warning-orange)',
          danger: 'var(--danger)',
        },
        kz: {
          bg: 'var(--bg-app)',
          sidebar: 'var(--bg-sidebar)',
          dashboard: 'var(--bg-app)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
          'card-sec': 'var(--bg-input)',
          input: 'var(--bg-input)',
          border: 'var(--border)',
          'border-strong': 'var(--border-strong)',
          text: 'var(--text-primary)',
          'text-sec': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          mint: 'var(--accent-violet)',
          violet: 'var(--accent-violet)',
          blue: 'var(--accent-blue)',
          success: 'var(--success)',
          warning: 'var(--warning-orange)',
          yellow: 'var(--warning-yellow)',
          orange: 'var(--warning-orange)',
          critical: 'var(--danger)',
          danger: 'var(--danger)',
          medium: 'var(--warning-yellow)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Fira Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
};
