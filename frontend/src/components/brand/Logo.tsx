import * as React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'default' | 'mono-light' | 'mono-dark';
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
  /** Override the wordmark text (e.g., "Carrier Portal", "Warehouse"). */
  wordmark?: React.ReactNode;
}

const SIZES = {
  sm: { mark: 'h-7 w-7', icon: 'h-4 w-4', text: 'text-base' },
  md: { mark: 'h-9 w-9', icon: 'h-5 w-5', text: 'text-xl' },
  lg: { mark: 'h-12 w-12', icon: 'h-7 w-7', text: 'text-3xl' },
};

/**
 * Canonical Open TMS logo lockup, per marketing/brand-guidelines.html.
 *
 * Replaces the legacy Material Icons `hub` glyph used in vnext-layout.tsx
 * and the old sidebar chrome. The mark is the swap-arrows SVG; the wordmark
 * is "Open TMS" with "TMS" in the primary colour.
 */
export function Logo({
  variant = 'default',
  size = 'md',
  showWordmark = true,
  wordmark,
  className,
}: LogoProps) {
  const dims = SIZES[size];

  const markClasses = cn(
    'inline-flex items-center justify-center rounded-[10px]',
    dims.mark,
    variant === 'default' && 'bg-primary text-primary-foreground',
    variant === 'mono-light' && 'border border-foreground bg-transparent text-foreground',
    variant === 'mono-dark' && 'border border-white bg-transparent text-white',
  );

  const wordmarkColor =
    variant === 'default'
      ? 'text-foreground'
      : variant === 'mono-dark'
        ? 'text-white'
        : 'text-foreground';

  const tmsColor =
    variant === 'default'
      ? 'text-primary'
      : variant === 'mono-dark'
        ? 'text-white'
        : 'text-foreground';

  return (
    <span className={cn('inline-flex items-center gap-3 font-bold tracking-tight', className)}>
      <span className={markClasses} aria-hidden>
        <svg
          className={dims.icon}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className={cn(dims.text, wordmarkColor, 'leading-none')}>
          {wordmark ?? (
            <>
              Open <span className={tmsColor}>TMS</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
