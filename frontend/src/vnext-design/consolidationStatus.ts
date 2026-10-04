type Variant = 'muted' | 'info' | 'warning' | 'success' | 'destructive';

const VARIANTS: Record<string, Variant> = {
  draft: 'muted',
  ready: 'info',
  in_progress: 'warning',
  complete: 'success',
  cancelled: 'destructive',
};

export const consolidationStatusVariant = (status: string): Variant => VARIANTS[status] ?? 'muted';
