import { Stack } from 'expo-router';

import { fonts, navHeaderStyleFor } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';

export default function StatsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: navHeaderStyleFor(colors),
        headerTitleStyle: {
          fontFamily: fonts.title,
          color: colors.ink,
        },
        headerTintColor: colors.green[700],
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    />
  );
}
