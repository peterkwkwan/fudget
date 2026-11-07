import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChevronRightIcon,
  ShieldIcon,
  SlidersIcon,
  UserIcon,
} from '@/components/icons';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PartnerSection } from '@/components/PartnerSection';
import { RestoreBackupBanner } from '@/components/RestoreBackupBanner';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import {
  CaptionText,
  PageTitleText,
  StrongText,
} from '@/components/StyledText';
import { Text } from '@/components/Themed';
import { colors, fonts, radius, space } from '@/constants/theme';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { useAuth } from '@/lib/auth';

/** Public privacy policy (GitHub Pages → /docs). Same URL as Play Console. */
const PRIVACY_POLICY_URL = 'https://peterkwkwan.github.io/fudget/privacy.html';

export default function AccountScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { settingsBanner } = useOfflineGates();
  const { edges, scrollProps } = useScrollEdges();
  const insets = useSafeAreaInsets();
  const displayName = profile?.display_name?.trim() || 'Your account';

  const openPrivacyPolicy = () => {
    void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  };

  return (
    <RNView style={styles.host}>
      <OfflineBanner message={settingsBanner} />
      <ScrollEdgeHost edges={edges} style={styles.scrollHost}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.container,
            { paddingTop: Math.max(insets.top, space.sm) + 12 },
          ]}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          <PageTitleText style={styles.title} accessibilityRole="header">
            Account
          </PageTitleText>

          <RestoreBackupBanner />

          <RNView style={styles.profileCard}>
            <RNView style={styles.profileHeading}>
              <RNView style={styles.profileSymbol}>
                <UserIcon color={colors.green[700]} size={22} />
              </RNView>
              <RNView style={styles.profileCopy}>
                <StrongText style={styles.profileName}>{displayName}</StrongText>
                <CaptionText style={styles.profileSub}>Your account</CaptionText>
              </RNView>
            </RNView>
            <RNView style={styles.divider} />
            <CaptionText style={styles.label}>Email</CaptionText>
            <StrongText style={styles.value}>{user?.email ?? '—'}</StrongText>
            <CaptionText style={styles.label}>Display name</CaptionText>
            <StrongText style={styles.value}>
              {profile?.display_name ?? '—'}
            </StrongText>
            <CaptionText style={styles.label}>Timezone</CaptionText>
            <StrongText style={styles.value}>
              {profile?.timezone ?? '—'}
            </StrongText>
          </RNView>

          <Pressable
            style={({ pressed }) => [
              styles.settingsEntry,
              pressed && styles.settingsEntryPressed,
            ]}
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Open settings and preferences"
          >
            <RNView style={styles.settingsSymbol}>
              <SlidersIcon color={colors.inkMuted} size={18} />
            </RNView>
            <RNView style={styles.settingsCopy}>
              <StrongText style={styles.settingsTitle}>Settings</StrongText>
              <CaptionText style={styles.settingsSubtitle}>
                Open preferences and account tools
              </CaptionText>
            </RNView>
            <ChevronRightIcon color={colors.inkMuted} size={18} />
          </Pressable>

          <PartnerSection />

          <Pressable
            style={({ pressed }) => [
              styles.linkRow,
              pressed && styles.linkRowPressed,
            ]}
            onPress={openPrivacyPolicy}
            accessibilityRole="link"
            accessibilityLabel="Open privacy policy"
          >
            <RNView style={styles.privacySymbol}>
              <ShieldIcon color={colors.green[700]} size={18} />
            </RNView>
            <RNView style={styles.settingsCopy}>
              <StrongText style={styles.linkTitle}>Privacy policy</StrongText>
              <CaptionText style={styles.linkMeta}>
                How Fudget handles your data · opens in your browser
              </CaptionText>
            </RNView>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text
              style={styles.buttonText}
              lightColor={colors.inkInverse}
              darkColor={colors.inkInverse}
            >
              Sign out
            </Text>
          </Pressable>
        </ScrollView>
      </ScrollEdgeHost>
    </RNView>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollHost: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    paddingHorizontal: space.screen,
    gap: space.lg,
    paddingBottom: space.xxl,
  },
  title: {
    color: colors.ink,
  },
  profileCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: space.md,
    gap: 7,
  },
  profileHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: space.sm,
  },
  profileSymbol: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.green[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    color: colors.ink,
    fontSize: 19,
    letterSpacing: -0.4,
  },
  profileSub: {
    color: colors.inkMuted,
    fontSize: 12,
    letterSpacing: 0,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: space.sm,
  },
  label: {
    marginTop: space.sm,
    color: colors.inkMuted,
    fontSize: 12,
    letterSpacing: 0,
  },
  value: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.caption,
  },
  settingsEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: space.md,
  },
  settingsEntryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  settingsSymbol: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsCopy: {
    flex: 1,
    gap: 5,
  },
  settingsTitle: {
    color: colors.ink,
    fontSize: 15,
  },
  settingsSubtitle: {
    color: colors.inkMuted,
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: space.md,
  },
  linkRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  privacySymbol: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.green[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: {
    color: colors.green[700],
    fontSize: 15,
  },
  linkMeta: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0,
  },
  button: {
    marginTop: space.sm,
    backgroundColor: colors.green[700],
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.green[950],
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontFamily: fonts.bodyStrong,
    fontSize: 16,
  },
});
