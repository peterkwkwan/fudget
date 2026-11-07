import { Tabs } from 'expo-router';

import { FudgetTabBar } from '@/components/FudgetTabBar';
import { fonts, navHeaderStyleFor } from '@/constants/theme';
import { periodBodyScreenOptions } from '@/lib/periodHeader';
import { useTheme } from '@/lib/ThemeProvider';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={(props) => (
        <FudgetTabBar
          state={props.state}
          onTabPress={(routeKey) => {
            const route = props.state.routes.find((r) => r.key === routeKey);
            if (!route) return;
            const event = props.emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!event.defaultPrevented) {
              props.navigateToTab(route.key);
            }
          }}
        />
      )}
      screenOptions={{
        tabBarActiveTintColor: colors.green[700],
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.chromeBorder,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.caption,
          fontSize: 12,
          letterSpacing: 0.2,
        },
        // Fallback for any tab that still uses the default header.
        headerStyle: navHeaderStyleFor(colors),
        headerTitleStyle: {
          fontFamily: fonts.title,
          color: colors.ink,
        },
        headerShadowVisible: false,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        // Period strip lives in the screen body with MonthCardPager.
        options={periodBodyScreenOptions()}
      />
      <Tabs.Screen
        name="stats"
        // Period strip lives in the screen body with MonthCardPager.
        options={periodBodyScreenOptions()}
      />
      <Tabs.Screen
        name="planner"
        // Figma: large in-page title lives in the screen body.
        options={periodBodyScreenOptions()}
      />
      <Tabs.Screen
        name="account"
        options={periodBodyScreenOptions()}
      />
    </Tabs>
  );
}
