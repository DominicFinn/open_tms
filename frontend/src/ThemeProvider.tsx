import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { API_URL } from './api';

interface ThemeContextValue {
  hasLogo: boolean;
  logoUrl: string | null;
  themeUpdatedAt: string | null;
  systemName: string;
  reloadTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  hasLogo: false,
  logoUrl: null,
  themeUpdatedAt: null,
  systemName: 'Open TMS',
  reloadTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const THEME_CACHE_KEY = 'open-tms-theme-cache';

interface CachedTheme {
  themeConfig: Record<string, string> | null;
  themeUpdatedAt: string | null;
  hasLogo: boolean;
  systemName?: string;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [hasLogo, setHasLogo] = useState(false);
  const [themeUpdatedAt, setThemeUpdatedAt] = useState<string | null>(null);
  const [systemName, setSystemName] = useState('Open TMS');

  const applyTheme = useCallback((config: Record<string, string> | null) => {
    const root = document.documentElement;
    // Remove any previously applied theme overrides
    root.style.cssText = '';
    if (config) {
      for (const [key, value] of Object.entries(config)) {
        root.style.setProperty(`--${key}`, value);
      }
    }
  }, []);

  const loadTheme = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/theme`);
      const result = await res.json();
      if (result.data) {
        const { themeConfig, themeUpdatedAt: updatedAt, hasLogo: logo, systemName: name } = result.data;

        // Check cache — skip reapply if unchanged
        const cached = sessionStorage.getItem(THEME_CACHE_KEY);
        if (cached) {
          const parsed: CachedTheme = JSON.parse(cached);
          if (parsed.themeUpdatedAt === updatedAt) {
            // Cache valid, but still apply in case DOM was reset
            applyTheme(parsed.themeConfig);
            setHasLogo(parsed.hasLogo);
            setThemeUpdatedAt(parsed.themeUpdatedAt);
            setSystemName(parsed.systemName || 'Open TMS');
            return;
          }
        }

        applyTheme(themeConfig);
        setHasLogo(logo);
        setThemeUpdatedAt(updatedAt);
        setSystemName(name || 'Open TMS');

        // Cache for session
        sessionStorage.setItem(THEME_CACHE_KEY, JSON.stringify({
          themeConfig,
          themeUpdatedAt: updatedAt,
          hasLogo: logo,
          systemName: name || 'Open TMS',
        }));
      }
    } catch {
      // Theme load failure is non-critical — defaults apply via CSS
    }
  }, [applyTheme]);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  const reloadTheme = useCallback(() => {
    sessionStorage.removeItem(THEME_CACHE_KEY);
    loadTheme();
  }, [loadTheme]);

  const logoUrl = hasLogo ? `${API_URL}/api/v1/theme/logo` : null;

  return (
    <ThemeContext.Provider value={{ hasLogo, logoUrl, themeUpdatedAt, systemName, reloadTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
