import React, { ReactNode } from 'react';

interface VnCardProps {
  title?: string;
  headerAction?: ReactNode;
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

export function VnCard({ title, headerAction, flush, children, className = '' }: VnCardProps) {
  return (
    <div className={`vn-card ${className}`}>
      {(title || headerAction) && (
        <div className="vn-card-header">
          {title && <h2>{title}</h2>}
          {headerAction}
        </div>
      )}
      <div className={flush ? 'vn-card-flush' : 'vn-card-body'}>
        {children}
      </div>
    </div>
  );
}
