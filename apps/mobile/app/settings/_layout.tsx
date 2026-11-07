import { Stack } from 'expo-router';

import { fonts, navHeaderStyleFor } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';

export default function SettingsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: navHeaderStyleFor(colors),
        headerTitleStyle: {
          fontFamily: fonts.title,
          color: colors.ink,
        },
        headerShadowVisible: false,
        headerTintColor: colors.green[700],
        contentStyle: { backgroundColor: colors.canvas },
      }}
    />
  );
}
