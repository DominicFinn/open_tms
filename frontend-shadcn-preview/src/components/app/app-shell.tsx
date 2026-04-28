import * as React from 'react';

import { AppSidebar, type RouteKey } from './app-sidebar';
import { AppTopbar } from './app-topbar';

interface AppShellProps {
  active: RouteKey;
  onNavigate: (r: RouteKey) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  children: React.ReactNode;
}

export function AppShell({
  active,
  onNavigate,
  theme,
  onToggleTheme,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar active={active} onNavigate={onNavigate} />
      <div className="flex min-h-screen flex-1 flex-col">
        <AppTopbar theme={theme} onToggleTheme={onToggleTheme} />
        <main className="flex-1 px-8 py-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
