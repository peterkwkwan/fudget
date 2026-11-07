import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StatusBar } from 'react-native';

import {
  darkShadow,
  lightColors,
  palettes,
  shadow as lightShadow,
  type ColorSchemePreference,
  type ThemeColors,
  type ThemeShadow,
} from '@/constants/theme';
import {
  loadAppearancePreference,
  saveAppearancePreference,
} from '@/lib/themePreference';

type ThemeContextValue = {
  /** Explicit Light / Dark — never follows system. Default light. */
  scheme: ColorSchemePreference;
  colors: ThemeColors;
  shadow: ThemeShadow;
  isDark: boolean;
  ready: boolean;
  setScheme: (scheme: ColorSchemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorSchemePreference>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void loadAppearancePreference().then((stored) => {
      if (!mounted) return;
      if (stored) setSchemeState(stored);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setScheme = useCallback((next: ColorSchemePreference) => {
    setSchemeState(next);
    void saveAppearancePreference(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const colors = palettes[scheme];
    return {
      scheme,
      colors,
      shadow: scheme === 'dark' ? darkShadow : lightShadow,
      isDark: scheme === 'dark',
      ready,
      setScheme,
    };
  }, [scheme, ready, setScheme]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      scheme: 'light',
      colors: lightColors,
      shadow: lightShadow,
      isDark: false,
      ready: true,
      setScheme: () => {},
    };
  }
  return ctx;
}

/** Convenience — active palette only. */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}
