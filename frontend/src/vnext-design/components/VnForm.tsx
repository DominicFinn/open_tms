import React, { ReactNode, forwardRef } from 'react';

/* ── VnField ─────────────────────────────────────────────── */
interface VnFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function VnField({ label, required, error, hint, children, className = '' }: VnFieldProps) {
  return (
    <div className={`vn-field ${error ? 'vn-field-error' : ''} ${className}`}>
      {label && (
        <label className="vn-field-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      {children}
      {(error || hint) && <span className="vn-field-hint">{error || hint}</span>}
    </div>
  );
}

/* ── VnInput ─────────────────────────────────────────────── */
export const VnInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input ref={ref} className={`vn-input ${className}`} {...props} />
  ),
);
VnInput.displayName = 'VnInput';

/* ── VnSelect ────────────────────────────────────────────── */
export const VnSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => (
    <select ref={ref} className={`vn-select ${className}`} {...props}>{children}</select>
  ),
);
VnSelect.displayName = 'VnSelect';

/* ── VnTextarea ──────────────────────────────────────────── */
export const VnTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea ref={ref} className={`vn-textarea ${className}`} {...props} />
  ),
);
VnTextarea.displayName = 'VnTextarea';

/* ── VnFormGrid ──────────────────────────────────────────── */
export function VnFormGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`vn-form-grid ${className}`}>{children}</div>;
}

/* ── VnFormSection ───────────────────────────────────────── */
interface VnFormSectionProps {
  title: string;
  icon?: string;
  children: ReactNode;
}

export function VnFormSection({ title, icon, children }: VnFormSectionProps) {
  return (
    <div className="vn-form-section">
      <div className="vn-form-section-title">
        {icon && <span className="material-icons">{icon}</span>}
        {title}
      </div>
      {children}
    </div>
  );
}

/* ── VnFormActions ───────────────────────────────────────── */
export function VnFormActions({ children }: { children: ReactNode }) {
  return <div className="vn-form-actions">{children}</div>;
}
