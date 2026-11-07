import { Pressable, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { fonts, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/lib/useThemedStyles';

export type LinkedAccountRef = {
  id: string;
  name: string;
  /** When false, name is plain text (partner account — no detail screen). */
  tappable?: boolean;
};

type Props = {
  accounts: LinkedAccountRef[];
  /** Prefix before the names, e.g. "Linked accounts:" or "Progress from linked accounts:" */
  label: string;
  onPressAccount: (id: string) => void;
  /** Append a period after the last name (detail copy). */
  trailingPeriod?: boolean;
};

/**
 * “Linked accounts: Name, Name” with each name as an accent link → account edit
 * (unless `tappable: false` for partner-owned accounts).
 */
export function LinkedAccountLinks({
  accounts,
  label,
  onPressAccount,
  trailingPeriod = false,
}: Props) {
  const styles = useThemedStyles(createStyles);

  if (accounts.length === 0) return null;

  return (
    <View style={styles.row}>
      <CaptionText style={styles.muted}>{label} </CaptionText>
      {accounts.map((a, i) => {
        const tappable = a.tappable !== false;
        return (
          <View key={a.id} style={styles.nameChunk}>
            {i > 0 ? <CaptionText style={styles.muted}>, </CaptionText> : null}
            {tappable ? (
              <Pressable
                onPress={() => onPressAccount(a.id)}
                hitSlop={6}
                accessibilityRole="link"
                accessibilityLabel={`Edit account ${a.name}`}
              >
                <CaptionText style={styles.link}>{a.name}</CaptionText>
              </Pressable>
            ) : (
              <CaptionText style={styles.plain}>{a.name}</CaptionText>
            )}
          </View>
        );
      })}
      {trailingPeriod ? <CaptionText style={styles.muted}>.</CaptionText> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    row: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      alignItems: 'center' as const,
    },
    nameChunk: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    muted: { color: colors.inkMuted },
    link: {
      color: colors.green[700],
      fontFamily: fonts.bodyStrong,
      textDecorationLine: 'underline' as const,
    },
    plain: {
      color: colors.inkMuted,
      fontFamily: fonts.bodyStrong,
    },
  };
}
