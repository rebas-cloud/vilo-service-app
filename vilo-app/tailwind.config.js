/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  		  vilo: {
  		    base: 'var(--vilo-bg-base)',
  		    surface: 'var(--vilo-bg-surface)',
  		    card: 'var(--vilo-bg-card)',
  		    'card-alt': 'var(--vilo-bg-card-alt)',
  		    panel: 'var(--vilo-bg-panel)',
  		    elevated: 'var(--vilo-bg-elevated)',
  		    interactive: 'var(--vilo-bg-interactive)',
  		    'interactive-hover': 'var(--vilo-bg-interactive-hover)',
  		    accent: 'var(--vilo-accent)',
  		    'accent-hover': 'var(--vilo-accent-hover)',
  		    'accent-light': 'var(--vilo-accent-light)',
  		    success: 'var(--vilo-success)',
  		    warning: 'var(--vilo-warning)',
  		    danger: 'var(--vilo-danger)',
  		    'btn-secondary': 'var(--vilo-bg-btn-secondary)',
  		    'btn-danger': 'var(--vilo-bg-btn-danger)',
  		  },
  		  'vilo-text': {
  		    primary: 'var(--vilo-text-primary)',
  		    soft: 'var(--vilo-text-soft)',
  		    secondary: 'var(--vilo-text-secondary)',
  		    muted: 'var(--vilo-text-muted)',
  		    dim: 'var(--vilo-text-dim)',
  		    danger: 'var(--vilo-text-danger)',
  		  },
  		  'vilo-border': {
  		    subtle: 'var(--vilo-border-subtle)',
  		    strong: 'var(--vilo-border-strong)',
  		    soft: 'var(--vilo-border-soft)',
  		  },
  		}
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

