import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'railyatra-theme';
export const THEMES = ['light', 'dark', 'ocean'];

const ThemeContext = createContext(null);

const readStoredTheme = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return THEMES.includes(stored) ? stored : 'light';
};

const applyThemeToDocument = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
};

export function ThemeProvider({ children }) {
  const { user, refreshUser } = useAuth();
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (user?.theme && THEMES.includes(user.theme) && user.theme !== theme) {
      setThemeState(user.theme);
    }
  }, [user?.theme]);

  const setTheme = useCallback(async (nextTheme) => {
    if (!THEMES.includes(nextTheme)) return;
    setThemeState(nextTheme);
    applyThemeToDocument(nextTheme);

    if (user) {
      try {
        await api.put('/auth/profile', { theme: nextTheme });
        await refreshUser();
      } catch {
        /* keep local theme even if sync fails */
      }
    }
  }, [user, refreshUser]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
