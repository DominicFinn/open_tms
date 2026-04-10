import React, { ReactNode } from 'react';

interface VnPageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function VnPageHeader({ title, subtitle, children }: VnPageHeaderProps) {
  return (
    <div className="vn-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--on-surface-variant)' }}>{subtitle}</p>}
      </div>
      {children && <div className="vn-page-actions">{children}</div>}
    </div>
  );
}
