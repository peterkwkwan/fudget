import { useTheme } from '@/lib/ThemeProvider';

/**
 * App appearance preference (explicit Light / Dark), not OS scheme.
 * Defaults to light until ThemeProvider hydrates from AsyncStorage.
 */
export function useColorScheme(): 'light' | 'dark' {
  return useTheme().scheme;
}
