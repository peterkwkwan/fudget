import { useTheme } from '@/lib/ThemeProvider';

export function useColorScheme(): 'light' | 'dark' {
  return useTheme().scheme;
}
