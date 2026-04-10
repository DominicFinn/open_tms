import React from 'react';

interface VnStatCardProps {
  icon: string;
  iconVariant?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  value: string | number;
  label: string;
  change?: { direction: 'up' | 'down'; text: string };
  onClick?: () => void;
}

export function VnStatCard({ icon, iconVariant = 'primary', value, label, change, onClick }: VnStatCardProps) {
  return (
    <div className="vn-stat" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className={`vn-stat-icon ${iconVariant}`}>
        <span className="material-icons">{icon}</span>
      </div>
      <div>
        <div className="vn-stat-value">{value}</div>
        <div className="vn-stat-label">{label}</div>
        {change && (
          <div className={`vn-stat-change ${change.direction}`}>
            <span className="material-icons">
              {change.direction === 'up' ? 'trending_up' : 'trending_down'}
            </span>
            {change.text}
          </div>
        )}
      </div>
    </div>
  );
}
