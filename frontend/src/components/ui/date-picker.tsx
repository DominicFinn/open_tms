import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type DateMode = 'date' | 'datetime-local';

const FORMATS: Record<DateMode, { value: string; display: string }> = {
  date: { value: 'yyyy-MM-dd', display: 'PP' },
  'datetime-local': { value: "yyyy-MM-dd'T'HH:mm", display: 'PP, HH:mm' },
};

function parseValue(value: string | undefined, mode: DateMode): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, FORMATS[mode].value, new Date());
  return isValid(parsed) ? parsed : undefined;
}

function formatValue(date: Date | undefined, mode: DateMode): string {
  if (!date) return '';
  return format(date, FORMATS[mode].value);
}

export interface DatePickerProps {
  type?: DateMode;
  value?: string;
  defaultValue?: string;
  onChange?: (event: { target: { value: string } }) => void;
  min?: string;
  max?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  'aria-label'?: string;
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      type = 'date',
      value,
      defaultValue,
      onChange,
      min,
      max,
      id,
      className,
      disabled,
      placeholder,
      'aria-label': ariaLabel,
    },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const [internal, setInternal] = React.useState<string>(defaultValue ?? '');
    const current = isControlled ? value ?? '' : internal;

    const selectedDate = parseValue(current, type);
    const minDate = parseValue(min, type);
    const maxDate = parseValue(max, type);
    const [open, setOpen] = React.useState(false);

    const emit = (next: string) => {
      if (!isControlled) setInternal(next);
      onChange?.({ target: { value: next } });
    };

    const handleSelect = (day: Date | undefined) => {
      if (!day) {
        emit('');
        return;
      }
      if (type === 'datetime-local') {
        const existing = selectedDate;
        const merged = new Date(day);
        if (existing) {
          merged.setHours(existing.getHours(), existing.getMinutes(), 0, 0);
        } else {
          merged.setHours(0, 0, 0, 0);
        }
        emit(formatValue(merged, type));
      } else {
        emit(formatValue(day, type));
        setOpen(false);
      }
    };

    const handleTimeChange = (rawTime: string) => {
      if (!rawTime) return;
      const [hh, mm] = rawTime.split(':').map(n => parseInt(n, 10));
      if (Number.isNaN(hh) || Number.isNaN(mm)) return;
      const base = selectedDate ?? new Date();
      const merged = new Date(base);
      merged.setHours(hh, mm, 0, 0);
      emit(formatValue(merged, type));
    };

    const displayText = selectedDate
      ? format(selectedDate, FORMATS[type].display)
      : (placeholder ?? (type === 'datetime-local' ? 'Pick a date & time' : 'Pick a date'));

    const disabledMatcher = React.useMemo(() => {
      const matchers: Array<(d: Date) => boolean> = [];
      if (minDate) {
        const floor = new Date(minDate);
        floor.setHours(0, 0, 0, 0);
        matchers.push(d => d < floor);
      }
      if (maxDate) {
        const ceil = new Date(maxDate);
        ceil.setHours(23, 59, 59, 999);
        matchers.push(d => d > ceil);
      }
      return matchers.length ? matchers : undefined;
    }, [minDate, maxDate]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              'h-10 w-full justify-start px-3 py-2 text-left font-normal',
              !selectedDate && 'text-muted-foreground',
              className,
            )}
          >
            <CalendarIcon className="mr-2 size-4 opacity-70" />
            <span className="truncate">{displayText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            defaultMonth={selectedDate}
            disabled={disabledMatcher}
            autoFocus
          />
          {type === 'datetime-local' && (
            <div className="flex items-center gap-2 border-t border-border p-3">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`${id ?? 'dp'}-time`}>
                Time
              </label>
              <input
                id={`${id ?? 'dp'}-time`}
                type="time"
                value={selectedDate ? format(selectedDate, 'HH:mm') : ''}
                onChange={e => handleTimeChange(e.target.value)}
                className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  },
);
DatePicker.displayName = 'DatePicker';

export { DatePicker };
