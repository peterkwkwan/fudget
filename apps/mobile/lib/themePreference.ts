import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ColorSchemePreference } from '@/constants/theme';

const STORAGE_KEY = 'fudget.appearance';

export async function loadAppearancePreference(): Promise<ColorSchemePreference | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
    return null;
  } catch {
    return null;
  }
}

export async function saveAppearancePreference(
  scheme: ColorSchemePreference
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, scheme);
  } catch (err) {
    console.warn(
      '[theme] failed to persist appearance',
      err instanceof Error ? err.message : err
    );
  }
}
