'use client';

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { ThemeProvider as MUIThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from '../app/theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'dafgram-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [mounted, setMounted] = useState(false);
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>('light');

  // Detect system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPreference(mediaQuery.matches ? 'dark' : 'light');

    const handler = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Load saved preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      setModeState(saved);
    }
    setMounted(true);
  }, []);

  // Resolve the actual theme based on mode
  const resolvedMode = useMemo(() => {
    if (mode === 'system') {
      return systemPreference;
    }
    return mode;
  }, [mode, systemPreference]);

  // Get the MUI theme
  const theme = useMemo(() => {
    return resolvedMode === 'dark' ? darkTheme : lightTheme;
  }, [resolvedMode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  const toggleTheme = () => {
    // Toggle between light and dark (not system)
    const newMode = resolvedMode === 'light' ? 'dark' : 'light';
    setMode(newMode);
  };

  // Valeurs par défaut pour le contexte
  const contextValue = {
    mode,
    resolvedMode: mounted ? resolvedMode : 'light' as const,
    setMode,
    toggleTheme,
  };

  // Pendant le SSR, on utilise le thème light par défaut mais on fournit quand même le contexte
  const currentTheme = mounted ? theme : lightTheme;

  return (
    <ThemeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={currentTheme}>
        <CssBaseline />
        {!mounted ? (
          <div style={{ visibility: 'hidden' }}>{children}</div>
        ) : (
          children
        )}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
