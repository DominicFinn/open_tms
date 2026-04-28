import React, { useEffect, useRef, useState } from 'react';

export type QuickRange = number | 'today' | 'yesterday';

interface VnDateRangeProps {
  iconName: string;
  label: string;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

const QUICK_OPTIONS: Array<{ label: string; value: QuickRange }> = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 14 days', value: 14 },
  { label: 'One month', value: 30 },
  { label: 'Two months', value: 60 },
];

function applyQuick(range: QuickRange, onFromChange: (v: string) => void, onToChange: (v: string) => void) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  let from = '';
  let to = iso(today);
  if (range === 'today') {
    from = iso(today);
  } else if (range === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    from = iso(y);
    to = iso(y);
  } else {
    const start = new Date(today);
    start.setDate(start.getDate() - range);
    from = iso(start);
  }
  onFromChange(from);
  onToChange(to);
}

export function VnDateRangeRow({ iconName, label, from, to, onFromChange, onToChange }: VnDateRangeProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--on-surface-variant)',
      }}>
        <span className="material-icons" style={{ fontSize: 18 }}>{iconName}</span>
        <span>{label}</span>
      </div>
      <input
        type="date"
        className="vn-filter-input"
        value={from}
        onChange={e => onFromChange(e.target.value)}
        aria-label={`${label} from`}
        style={{ width: '100%', padding: '7px 12px' }}
      />
      <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', textAlign: 'center' }}>to</div>
      <input
        type="date"
        className="vn-filter-input"
        value={to}
        onChange={e => onToChange(e.target.value)}
        aria-label={`${label} to`}
        style={{ width: '100%', padding: '7px 12px' }}
      />
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className={`vn-filter-btn${open ? ' is-active' : ''}`}
          onClick={() => setOpen(o => !o)}
          title="Quick ranges"
          aria-label={`${label} quick ranges`}
          style={{ padding: 7, borderRadius: '50%' }}
        >
          <span className="material-icons" style={{ fontSize: 18 }}>history</span>
        </button>
        {open && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: 160,
              background: 'var(--surface-container-lowest)',
              border: '1px solid var(--outline-variant)',
              borderRadius: 'var(--border-radius-md)',
              boxShadow: 'var(--shadow-2)',
              padding: 6,
              zIndex: 20,
            }}
          >
            {QUICK_OPTIONS.map(opt => (
              <button
                key={opt.label}
                role="menuitem"
                onClick={() => { applyQuick(opt.value, onFromChange, onToChange); setOpen(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: 13,
                  color: 'var(--on-surface)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-container)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

interface VnDateRangeFilterProps {
  rows: VnDateRangeProps[];
  onClear?: () => void;
  showClear?: boolean;
}

/**
 * Two (or more) labelled date-range rows laid out on a shared CSS grid so all
 * columns line up vertically. Includes a per-row quick-range menu (Today,
 * Yesterday, Last 7/14 days, One/Two months) and an optional Clear button.
 */
export function VnDateRangeFilter({ rows, onClear, showClear }: VnDateRangeFilterProps) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '12px 20px',
        borderTop: '1px solid var(--outline-variant)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '110px 170px 24px 170px auto 1fr',
          alignItems: 'center',
          rowGap: 10,
          columnGap: 12,
        }}
      >
        {rows.map((row, i) => (
          <React.Fragment key={`${row.label}-${i}`}>
            <VnDateRangeRow {...row} />
            {i === 0 ? (
              <div style={{ justifySelf: 'end' }}>
                {showClear && onClear && (
                  <button
                    type="button"
                    className="vn-filter-btn"
                    onClick={onClear}
                    title="Clear date filters"
                  >
                    <span className="material-icons">clear</span>
                    Clear
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
