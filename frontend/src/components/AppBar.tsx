import React from 'react';
import AppSwitcher from './AppSwitcher';
import { useTheme } from '../ThemeProvider';

interface AppBarProps {
  title: string;
  icon: string;
  onToggleMobileMenu: () => void;
}

export default function AppBar({ title, icon, onToggleMobileMenu }: AppBarProps) {
  const { hasLogo, logoUrl } = useTheme();

  return (
    <header className="app-bar">
      <div className="app-bar-left">
        <button
          className="icon-btn mobile-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span className="material-icons">menu</span>
        </button>
        {hasLogo && logoUrl && (
          <img
            src={logoUrl}
            alt="Logo"
            style={{ height: '32px', width: 'auto', objectFit: 'contain', marginRight: 'var(--spacing-1)' }}
          />
        )}
        <div className="app-bar-title">
          <span className="material-icons">{icon}</span>
          {title}
        </div>
      </div>
      <div className="app-bar-actions">
        <button className="icon-btn">
          <span className="material-icons">notifications</span>
        </button>
        <button className="icon-btn">
          <span className="material-icons">account_circle</span>
        </button>
        <AppSwitcher />
      </div>
    </header>
  );
}
