import React, { ReactNode } from 'react';

interface VnDetailLayoutProps {
  main: ReactNode;
  sidebar: ReactNode;
}

export function VnDetailLayout({ main, sidebar }: VnDetailLayoutProps) {
  return (
    <div className="vn-detail-grid">
      <div className="vn-detail-main">{main}</div>
      <div className="vn-detail-sidebar">{sidebar}</div>
    </div>
  );
}
