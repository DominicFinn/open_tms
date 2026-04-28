import * as React from 'react';
import { cn } from '@/lib/utils';

interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: keyof JSX.IntrinsicElements;
}

export function GradientText({ className, as: Tag = 'span', ...props }: GradientTextProps) {
  const Component = Tag as any;
  return (
    <Component
      className={cn('bg-brand-gradient bg-clip-text text-transparent', className)}
      {...props}
    />
  );
}
