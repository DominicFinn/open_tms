import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  // Honor the existing data-theme attribute set by ThemeProvider in addition
  // to the shadcn-style .dark class so both can drive the new tokens.
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--shadcn-border) / <alpha-value>)',
        input: 'hsl(var(--shadcn-input) / <alpha-value>)',
        ring: 'hsl(var(--shadcn-ring) / <alpha-value>)',
        background: 'hsl(var(--shadcn-background) / <alpha-value>)',
        foreground: 'hsl(var(--shadcn-foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--shadcn-primary) / <alpha-value>)',
          foreground: 'hsl(var(--shadcn-primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--shadcn-secondary) / <alpha-value>)',
          foreground: 'hsl(var(--shadcn-secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--shadcn-destructive) / <alpha-value>)',
          foreground: 'hsl(var(--shadcn-destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--shadcn-muted) / <alpha-value>)',
          foreground: 'hsl(var(--shadcn-muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--shadcn-accent) / <alpha-value>)',
          foreground: 'hsl(var(--shadcn-accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--shadcn-popover) / <alpha-value>)',
          foreground: 'hsl(var(--shadcn-popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--shadcn-card) / <alpha-value>)',
          foreground: 'hsl(var(--shadcn-card-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--shadcn-success) / <alpha-value>)',
          foreground: 'hsl(var(--shadcn-success-foreground) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--shadcn-warning) / <alpha-value>)',
          foreground: 'hsl(var(--shadcn-warning-foreground) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--shadcn-info) / <alpha-value>)',
          foreground: 'hsl(var(--shadcn-info-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--shadcn-radius)',
        md: 'calc(var(--shadcn-radius) - 2px)',
        sm: 'calc(var(--shadcn-radius) - 4px)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, hsl(217 91% 60%), hsl(258 90% 66%))',
        'shell-gradient':
          'linear-gradient(135deg, hsl(222 84% 5%) 0%, hsl(229 84% 21%) 50%, hsl(222 47% 11%) 100%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
