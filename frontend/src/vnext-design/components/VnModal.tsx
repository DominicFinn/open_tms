import React, { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface VnModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'default' | 'lg' | 'xl';
  footer?: ReactNode;
  children: ReactNode;
}

const sizeClass: Record<string, string> = {
  sm: 'vn-modal-sm',
  lg: 'vn-modal-lg',
  xl: 'vn-modal-xl',
};

export function VnModal({ open, onClose, title, size = 'default', footer, children }: VnModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="vn-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`vn-modal ${sizeClass[size] || ''}`}>
        <div className="vn-modal-header">
          <h2>{title}</h2>
          <button className="vn-modal-close" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="vn-modal-body">{children}</div>
        {footer && <div className="vn-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
