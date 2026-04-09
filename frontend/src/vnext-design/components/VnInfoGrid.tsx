import React, { ReactNode } from 'react';

interface InfoItem {
  label: string;
  value: ReactNode;
}

interface VnInfoGridProps {
  items: InfoItem[];
}

export function VnInfoGrid({ items }: VnInfoGridProps) {
  return (
    <div className="vn-info-grid">
      {items.map((item, i) => (
        <div className="vn-info-item" key={i}>
          <label>{item.label}</label>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
