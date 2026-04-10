import React from 'react';

interface VnProgressBarProps {
  value: number;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'primary';
  height?: number;
}

export function VnProgressBar({ value, variant = 'primary', height }: VnProgressBarProps) {
  return (
    <div className="vn-progress" style={height ? { height } : undefined}>
      <div className={`vn-progress-bar ${variant}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
