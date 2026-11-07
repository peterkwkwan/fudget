import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  lightColors,
  space,
  typography,
  type ThemeColors,
} from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';

/** Reserve room so left-aligned period controls don’t sit under a top-right gear. */
const TRAILING_SLOT = 44;

type NavHeaderChromeProps = {
  children: ReactNode;
  /** Optional top-right control (e.g. settings gear) on the same row. */
  trailing?: ReactNode;
};

/**
 * Shared tab header chrome (safe-area + content + soft canvas).
 * Figma page headers have no bottom hairline — soft canvas continues into body.
 */
function NavHeaderChrome({ children, trailing }: NavHeaderChromeProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: Math.max(insets.top, space.sm) + 4,
          backgroundColor: colors.canvas,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.nav}>{children}</View>
        {trailing ? (
          <View style={styles.trailingSlot}>{trailing}</View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Period nav chrome for Transactions + Stats.
 * Rendered in the **screen body** (same React tree as MonthCardPager) so
 * month-label rewrite and settle `translateX = 0` share one pre-paint commit.
 * Stack header is hidden via {@link periodBodyScreenOptions}.
 */
export function PeriodNavHeader({
  children,
  trailing,
}: NavHeaderChromeProps) {
  return <NavHeaderChrome trailing={trailing}>{children}</NavHeaderChrome>;
}

/**
 * Titled tab header (Planner / Account) — same chrome as PeriodNavHeader.
 */
export function TitleNavHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <NavHeaderChrome trailing={trailing}>
      <Text
        style={styles.title}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
    </NavHeaderChrome>
  );
}

/**
 * Transactions / Stats: hide the stack header. Period chrome lives in the
 * screen tree next to MonthCardPager (avoids settle month-label flash).
 */
export function periodBodyScreenOptions() {
  return {
    title: '',
    headerTitle: '',
    headerShown: false as const,
  };
}

/** Options that hide the default title and install our full header. */
export function periodNavScreenOptions(
  header: () => ReactNode,
  themeColors: ThemeColors = lightColors
) {
  return {
    title: '',
    headerTitle: '',
    headerShown: true as const,
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: themeColors.canvas,
      borderBottomWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
    },
    header,
  };
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: colors.canvas,
    },
    row: {
      minHeight: 44,
      paddingLeft: space.screen,
      paddingRight: space.screen,
      paddingBottom: space.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
    },
    nav: {
      flex: 1,
      minWidth: 0,
      alignItems: 'stretch',
      justifyContent: 'center',
    },
    trailingSlot: {
      width: TRAILING_SLOT,
      minHeight: TRAILING_SLOT,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: colors.ink,
      ...typography.pageTitle,
      textAlign: 'left',
    },
  });
}
