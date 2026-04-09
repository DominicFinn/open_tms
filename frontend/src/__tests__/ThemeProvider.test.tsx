import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, useTheme } from '../ThemeProvider';

// Helper component to consume the context
function ThemeConsumer() {
  const { hasLogo, logoUrl, systemName } = useTheme();
  return (
    <div>
      <span data-testid="system-name">{systemName}</span>
      <span data-testid="has-logo">{String(hasLogo)}</span>
      <span data-testid="logo-url">{logoUrl || 'none'}</span>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders children', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: null }),
    });

    await act(async () => {
      render(
        <ThemeProvider>
          <div data-testid="child">Hello</div>
        </ThemeProvider>
      );
    });

    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('provides default system name when API returns no data', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: null }),
    });

    await act(async () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );
    });

    expect(screen.getByTestId('system-name')).toHaveTextContent('Open TMS');
    expect(screen.getByTestId('has-logo')).toHaveTextContent('false');
    expect(screen.getByTestId('logo-url')).toHaveTextContent('none');
  });

  it('loads theme from API and updates context', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          data: {
            themeConfig: { primary: '#ff0000' },
            themeUpdatedAt: '2024-01-01T00:00:00Z',
            hasLogo: true,
            systemName: 'My TMS',
          },
        }),
    });

    await act(async () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('system-name')).toHaveTextContent('My TMS');
      expect(screen.getByTestId('has-logo')).toHaveTextContent('true');
    });
  });

  it('handles fetch failure gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );
    });

    // Should still render with defaults
    expect(screen.getByTestId('system-name')).toHaveTextContent('Open TMS');
  });

  it('caches theme in sessionStorage', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          data: {
            themeConfig: { primary: '#00ff00' },
            themeUpdatedAt: '2024-06-01T00:00:00Z',
            hasLogo: false,
            systemName: 'Cached TMS',
          },
        }),
    });

    await act(async () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );
    });

    await waitFor(() => {
      const cached = sessionStorage.getItem('open-tms-theme-cache');
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached!);
      expect(parsed.systemName).toBe('Cached TMS');
    });
  });
});
