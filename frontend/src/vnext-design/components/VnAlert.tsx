import React, { ReactNode } from 'react';

interface VnAlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  icon?: string;
  onClose?: () => void;
  children: ReactNode;
}

const defaultIcons: Record<string, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

export function VnAlert({ variant = 'info', icon, onClose, children }: VnAlertProps) {
  return (
    <div className={`vn-alert vn-alert-${variant}`}>
      <span className="material-icons">{icon || defaultIcons[variant]}</span>
      <div className="vn-alert-content">{children}</div>
      {onClose && (
        <button className="vn-alert-dismiss" onClick={onClose}>
          <span className="material-icons">close</span>
        </button>
      )}
    </div>
  );
}
