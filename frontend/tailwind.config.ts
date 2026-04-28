import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  // While we coexist with theme.css, disable Tailwind's preflight so it does
  // not reset existing global styles. Re-enable in phase 12 when theme.css and
  // vnext.css are deleted.
  corePlugins: {
    preflight: false,
  },
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
        border: 'hsl(var(--shadcn-border))',
        input: 'hsl(var(--shadcn-input))',
        ring: 'hsl(var(--shadcn-ring))',
        background: 'hsl(var(--shadcn-background))',
        foreground: 'hsl(var(--shadcn-foreground))',
        primary: {
          DEFAULT: 'hsl(var(--shadcn-primary))',
          foreground: 'hsl(var(--shadcn-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--shadcn-secondary))',
          foreground: 'hsl(var(--shadcn-secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--shadcn-destructive))',
          foreground: 'hsl(var(--shadcn-destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--shadcn-muted))',
          foreground: 'hsl(var(--shadcn-muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--shadcn-accent))',
          foreground: 'hsl(var(--shadcn-accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--shadcn-popover))',
          foreground: 'hsl(var(--shadcn-popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--shadcn-card))',
          foreground: 'hsl(var(--shadcn-card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--shadcn-success))',
          foreground: 'hsl(var(--shadcn-success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--shadcn-warning))',
          foreground: 'hsl(var(--shadcn-warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--shadcn-info))',
          foreground: 'hsl(var(--shadcn-info-foreground))',
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
