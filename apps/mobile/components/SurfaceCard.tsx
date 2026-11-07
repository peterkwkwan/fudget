import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, space } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tighter padding for dense lists (default 0 — callers pad rows). */
  padded?: boolean;
};

/** White elevated card matching Figma rounded surfaces on soft canvas. */
export function SurfaceCard({ children, style, padded = false }: Props) {
  return (
    <View style={[styles.card, padded && styles.padded, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  padded: {
    padding: space.md,
  },
});
