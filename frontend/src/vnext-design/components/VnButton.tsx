import React from 'react';

interface VnButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'success' | 'danger';
  size?: 'sm' | 'default';
  icon?: string;
  iconOnly?: boolean;
}

export function VnButton({ variant = 'primary', size = 'default', icon, iconOnly, children, className = '', ...rest }: VnButtonProps) {
  const cls = [
    iconOnly ? 'vn-btn vn-btn-icon' : 'vn-btn',
    !iconOnly && `vn-btn-${variant}`,
    !iconOnly && size === 'sm' && 'vn-btn-sm',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} {...rest}>
      {icon && <span className="material-icons">{icon}</span>}
      {children}
    </button>
  );
}
