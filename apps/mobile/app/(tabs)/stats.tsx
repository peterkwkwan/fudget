import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  MonthCardPager,
  type MonthCardPagerHandle,
} from '@/components/MonthCardPager';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PeriodSelector } from '@/components/stats/PeriodSelector';
import { StatsMonthBody } from '@/components/stats/StatsMonthBody';
import type { TransactionType } from '@/constants/categories';
import { type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import { useStatsMonthContentReady } from '@/hooks/useMonthPrefetch';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { usePartnerLink } from '@/hooks/usePartner';
import { type StatsScope } from '@/hooks/useStats';
import { useAuth } from '@/lib/auth';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { PeriodNavHeader } from '@/lib/periodHeader';
import {
  currentPeriodFocus,
  resolvePeriodBounds,
  shiftPeriodFocus,
  type PeriodFocus,
  type PeriodPreset,
} from '@/lib/periods';
import { STATS_PERSONAL_OFFLINE_BANNER } from '@/lib/offline/ux';
import type { StatsMetric } from '@/lib/stats';

export default function StatsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();
  const { formatWhole } = useFormatMoney();
  const formatSigned = useCallback(
    (n: number): string => {
      const sign = n < 0 ? '−' : '';
      return `${sign}${formatWhole(Math.abs(n))}`;
    },
    [formatWhole]
  );
  const timeZone = profile?.timezone || 'UTC';
  const partnerLink = usePartnerLink();
  const { offline, pairStatsBlocked } = useOfflineGates();
  const isPaired = partnerLink.data?.status === 'active';

  const [scope, setScope] = useState<StatsScope>('personal');
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [focus, setFocus] = useState<PeriodFocus>(() =>
    currentPeriodFocus(timeZone)
  );
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date());
  const [pieType, setPieType] = useState<TransactionType>('expense');
  const [trendMetric, setTrendMetric] = useState<StatsMetric>('expense');

  // Shared with month label: exit with swipe, blank until contentReady.
  const swipeTranslateX = useSharedValue(0);
  const swipePagerWidth = useSharedValue(0);
  const swipeFillOpacity = useSharedValue(1);
  const pagerRef = useRef<MonthCardPagerHandle>(null);

  // Unlink → Pair scope disappears immediately; fall back to personal.
  useEffect(() => {
    if (!isPaired && scope === 'pair') {
      setScope('personal');
    }
  }, [isPaired, scope]);

  const period = useMemo(
    () =>
      resolvePeriodBounds(preset, timeZone, {
        focus,
        customStart: preset === 'custom' ? customStart : undefined,
        customEndInclusive: preset === 'custom' ? customEnd : undefined,
      }),
    [preset, timeZone, focus, customStart, customEnd]
  );

  const swipeMotion = useMemo(
    () =>
      preset === 'month'
        ? {
            translateX: swipeTranslateX,
            pagerWidth: swipePagerWidth,
            fillOpacity: swipeFillOpacity,
          }
        : null,
    [preset, swipeTranslateX, swipePagerWidth, swipeFillOpacity]
  );

  const onSwipeStep = useCallback((delta: -1 | 1) => {
    pagerRef.current?.step(delta);
  }, []);

  const onCustomStartChange = useCallback((date: Date) => {
    setCustomStart(date);
    setCustomEnd((end) => (date.getTime() > end.getTime() ? date : end));
  }, []);

  const onCustomEndChange = useCallback((date: Date) => {
    setCustomEnd(date);
    setCustomStart((start) =>
      date.getTime() < start.getTime() ? date : start
    );
  }, []);

  const showPair = scope === 'pair' && isPaired;
  const pairLive = showPair && !pairStatsBlocked;
  const pairBlocked = showPair && pairStatsBlocked;

  const contentReady = useStatsMonthContentReady({
    focus,
    timeZone,
    pieType,
    pairLive,
    // Non-month presets still mount one body; gate only Monthly blank-fill.
    enabled: preset === 'month',
  });

  const goToThisMonth = useCallback(() => {
    setPreset('month');
    setFocus(currentPeriodFocus(timeZone));
  }, [timeZone]);

  const onMonthStep = useCallback((delta: -1 | 1) => {
    setFocus((current) => shiftPeriodFocus(current, 'month', delta));
  }, []);

  const onPartnerRefetch = useCallback(() => {
    void partnerLink.refetch();
  }, [partnerLink]);

  const renderPage = useCallback(
    (pageFocus: PeriodFocus) => (
      <StatsMonthBody
        focus={pageFocus}
        preset={preset}
        timeZone={timeZone}
        pieType={pieType}
        onPieTypeChange={setPieType}
        trendMetric={trendMetric}
        onTrendMetricChange={setTrendMetric}
        isPaired={isPaired}
        scope={scope}
        onScopeChange={setScope}
        partnerDisplayName={partnerLink.data?.partnerDisplayName ?? null}
        pairLive={pairLive}
        pairBlocked={pairBlocked}
        offline={offline}
        partnerRefetching={partnerLink.isRefetching}
        partnerLoading={partnerLink.isLoading}
        onPartnerRefetch={onPartnerRefetch}
        formatSigned={formatSigned}
        active
        onGoToThisMonth={goToThisMonth}
        customStart={customStart}
        customEnd={customEnd}
      />
    ),
    [
      preset,
      timeZone,
      pieType,
      trendMetric,
      isPaired,
      scope,
      partnerLink.data?.partnerDisplayName,
      pairLive,
      pairBlocked,
      offline,
      partnerLink.isRefetching,
      partnerLink.isLoading,
      onPartnerRefetch,
      formatSigned,
      goToThisMonth,
      customStart,
      customEnd,
    ]
  );

  return (
    <View style={styles.container}>
      <PeriodNavHeader>
        <PeriodSelector
          preset={preset}
          navLabel={period.navLabel}
          focus={focus}
          timeZone={timeZone}
          customStart={customStart}
          customEnd={customEnd}
          showModeMenu
          pageTitle="Statistics"
          swipeMotion={swipeMotion}
          onSwipeStep={preset === 'month' ? onSwipeStep : undefined}
          onPresetChange={setPreset}
          onFocusChange={setFocus}
          onCustomStartChange={onCustomStartChange}
          onCustomEndChange={onCustomEndChange}
        />
      </PeriodNavHeader>

      <OfflineBanner
        message={offline ? STATS_PERSONAL_OFFLINE_BANNER : null}
      />

      <MonthCardPager
        ref={pagerRef}
        focus={focus}
        enabled={preset === 'month'}
        onStep={onMonthStep}
        renderPage={renderPage}
        contentReady={
          preset !== 'month' || pairBlocked || contentReady
        }
        translateX={swipeTranslateX}
        pagerWidth={swipePagerWidth}
        fillOpacity={swipeFillOpacity}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
});
}

