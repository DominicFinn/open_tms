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
 * Canonical POLARIS Global logo lockup.
 *
 * The mark is a Polaris star; the wordmark is "POLARIS Global".
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

  const globalColor =
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
            d="M12 2.5 15 9l6.5 3-6.5 3-3 6.5L9 15l-6.5-3L9 9l3-6.5Z"
          />
          <circle cx="12" cy="12" r="1.25" fill="none" stroke="currentColor" strokeWidth={1.5} />
        </svg>
      </span>
      {showWordmark && (
        <span className={cn(dims.text, wordmarkColor, 'leading-none')}>
          {wordmark ?? (
            <>
              POLARIS <span className={globalColor}>Global</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
