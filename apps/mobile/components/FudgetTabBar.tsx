import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BarsIcon,
  FlagIcon,
  ListIcon,
  PlusIcon,
  UserIcon,
} from '@/components/icons';
import {
  chromeHairlineFor,
  fonts,
  radius,
  space,
  type ThemeColors,
} from '@/constants/theme';
import { addTransactionHref } from '@/lib/addTransactionDate';
import { guardedPush } from '@/lib/navGuard';
import { useTheme } from '@/lib/ThemeProvider';

/** Figma Add FAB: 50×50, radius 18 (squircle), no white ring. */
const FAB_SIZE = 50;
const FAB_GAP = 56;

type FudgetTabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  /** Called with the route key; parent handles emit + navigateToTab. */
  onTabPress: (routeKey: string) => void;
};

const TABS: {
  route: string;
  label: string;
  Icon: typeof ListIcon;
}[] = [
  { route: 'index', label: 'Transactions', Icon: ListIcon },
  { route: 'stats', label: 'Stats', Icon: BarsIcon },
  { route: 'planner', label: 'Planner', Icon: FlagIcon },
  { route: 'account', label: 'Account', Icon: UserIcon },
];

/**
 * Tab bar: Transactions · Stats · raised Add FAB · Planner · Account.
 * FAB gently pulses unless reduce-motion is on.
 */
export function FudgetTabBar({ state, onTabPress }: FudgetTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const fabScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });
  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.08, 1.2],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.36],
  });

  function renderTab(routeName: string) {
    const meta = TABS.find((t) => t.route === routeName);
    if (!meta) return null;
    const routeIndex = state.routes.findIndex((r) => r.name === routeName);
    if (routeIndex < 0) return null;
    const route = state.routes[routeIndex];
    const focused = state.index === routeIndex;
    const color = focused ? colors.green[700] : colors.inkMuted;
    const { Icon } = meta;

    return (
      <Pressable
        key={routeName}
        style={styles.tab}
        onPress={() => {
          if (!focused) onTabPress(route.key);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
      >
        <Icon color={color} size={21} />
        <Text
          style={[
            styles.tabLabel,
            { color, fontFamily: focused ? fonts.bodyStrong : fonts.body },
          ]}
        >
          {meta.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, space.sm) },
      ]}
    >
      <View style={styles.fabWrap} pointerEvents="box-none">
        {!reduceMotion ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.fabRing,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
        ) : null}
        <Animated.View
          style={{ transform: [{ scale: reduceMotion ? 1 : fabScale }] }}
        >
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              pressed && styles.fabPressed,
            ]}
            onPress={() =>
              guardedPush(
                router,
                addTransactionHref(state.routes[state.index]?.name)
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Add transaction"
          >
            <PlusIcon color={colors.inkInverse} size={26} />
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.row}>
        {renderTab('index')}
        {renderTab('stats')}
        <View style={styles.fabGap} />
        {renderTab('planner')}
        {renderTab('account')}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  const hairline = chromeHairlineFor(colors);
  return StyleSheet.create({
    bar: {
      backgroundColor: colors.surface,
      borderTopWidth: hairline.width,
      borderTopColor: hairline.color,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      height: 76,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 4,
      minHeight: 44,
    },
    tabLabel: {
      fontSize: 10,
      letterSpacing: 0,
    },
    fabGap: {
      width: FAB_GAP,
      flexShrink: 0,
    },
    fabWrap: {
      position: 'absolute',
      left: '50%',
      top: -18,
      marginLeft: -FAB_SIZE / 2,
      width: FAB_SIZE,
      height: FAB_SIZE,
      zIndex: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabRing: {
      position: 'absolute',
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: radius.fab,
      backgroundColor: colors.green[700],
    },
    fab: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: radius.fab,
      backgroundColor: colors.green[700],
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabPressed: {
      backgroundColor: colors.primaryPressed,
      transform: [{ scale: 0.98 }],
    },
  });
}
