import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { LandmarkIcon, PlusIcon } from '@/components/icons';
import { LinkedAccountLinks } from '@/components/planner/LinkedAccountLinks';
import { PartnerCollapsibleCard } from '@/components/planner/PartnerCollapsibleCard';
import { ProjectionChart } from '@/components/planner/ProjectionChart';
import { ProjectionDisclaimerInfo } from '@/components/planner/ProjectionDisclaimerInfo';
import { ProjectionEmptyWell } from '@/components/planner/ProjectionEmptyWell';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import {
  CaptionText,
  PageTitleText,
  StrongText,
  TitleText,
} from '@/components/StyledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GOAL_TYPE_LABELS,
  HORIZON_PRESETS,
  PLAN_CADENCE_LABELS,
  VEHICLE_TYPE_LABELS,
  type HorizonPresetKey,
} from '@/constants/planner';
import { fonts, radius, space, typography, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import { useAuth } from '@/lib/auth';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { usePartnerLink } from '@/hooks/usePartner';
import {
  usePartnerPlannerGoals,
  usePartnerPlannerVehicles,
  usePlannerGoals,
  usePlannerVehicles,
  warmPartnerPlannerMirror,
} from '@/hooks/usePlanner';
import {
  type ChartFocusSelection,
  isChartableGoal,
  linkedGrowthVehicles,
  loadChartFocus,
  resolveChartFocus,
  resolveChartMode,
  saveChartFocus,
} from '@/lib/plannerChartFocus';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { PLANNER_WRITE_OFFLINE_COPY } from '@/lib/offline/ux';
import { guardedPush } from '@/lib/navGuard';
import {
  goalEffectiveSaved,
  goalPace,
  projectNetWorth,
  requiredContribution,
  type PaceStatus,
  type ProjectVehicleInput,
} from '@/lib/plannerMath';
import type { PlannerGoal } from '@/lib/plannerGoals';
import type { PlannerVehicle } from '@/lib/plannerVehicles';

const ADD_VEHICLE = '/planner/vehicle/new';
const ADD_GOAL = '/planner/goal/new';

type PlannerScope = 'personal' | 'pair';

const SCOPE_OPTIONS = [
  { value: 'personal', label: 'Personal' },
  { value: 'pair', label: 'Pair' },
] as const satisfies readonly { value: PlannerScope; label: string }[];

function paceLabel(status: PaceStatus): string {
  switch (status) {
    case 'ahead':
      return 'Ahead';
    case 'behind':
      return 'Behind';
    case 'on_track':
      return 'On track';
    default:
      return 'No date';
  }
}

function paceColor(status: PaceStatus, palette: ThemeColors): string {
  switch (status) {
    case 'ahead':
      return palette.green[700];
    case 'behind':
      return palette.warning;
    case 'on_track':
      return palette.ink;
    default:
      return palette.inkMuted;
  }
}

function toProjectInput(v: PlannerVehicle): ProjectVehicleInput {
  return {
    balance: v.balance,
    annualRatePercent: v.annual_rate,
    growthMode: v.growth_mode,
    compoundPeriod: v.compound_period,
    planAmount: v.plan_amount,
    planCadence: v.plan_cadence,
  };
}

export default function PlannerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { format } = useFormatMoney();
  const { user } = useAuth();
  const router = useRouter();
  const vehicles = usePlannerVehicles();
  const goals = usePlannerGoals();
  const partnerLink = usePartnerLink();
  const isPaired = partnerLink.data?.status === 'active';
  const partnerId = isPaired ? partnerLink.data?.partnerId ?? null : null;
  const partnerName =
    partnerLink.data?.partnerDisplayName?.trim() || 'partner';
  const partnerVehicles = usePartnerPlannerVehicles(partnerId);
  const partnerGoals = usePartnerPlannerGoals(partnerId);

  const [scope, setScope] = useState<PlannerScope>('personal');
  const [horizonKey, setHorizonKey] = useState<HorizonPresetKey>('10y');
  const [customYears, setCustomYears] = useState('15');
  const [storedFocus, setStoredFocus] = useState<ChartFocusSelection | null>(
    null
  );
  const [prefsReady, setPrefsReady] = useState(false);
  const { edges, scrollProps } = useScrollEdges();
  const insets = useSafeAreaInsets();
  const { plannerWriteBlocked } = useOfflineGates();

  useEffect(() => {
    if (!isPaired && scope === 'pair') {
      setScope('personal');
    }
  }, [isPaired, scope]);

  useEffect(() => {
    if (!partnerId) return;
    void warmPartnerPlannerMirror(partnerId);
  }, [partnerId]);

  useEffect(() => {
    let cancelled = false;
    void loadChartFocus().then((sel) => {
      if (!cancelled) {
        setStoredFocus(sel);
        setPrefsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function pushWrite(href: string) {
    if (plannerWriteBlocked) {
      // Soft gate: still navigate; write screens show ConnectionRequired.
      // Prefer keeping list readable offline.
    }
    guardedPush(router, href);
  }

  const horizonMonths = useMemo(() => {
    if (horizonKey === 'custom') {
      const y = Number(customYears);
      if (!(y > 0) || Number.isNaN(y)) return 120;
      return Math.min(600, Math.round(y * 12));
    }
    return (
      HORIZON_PRESETS.find((h) => h.key === horizonKey)?.months ?? 120
    );
  }, [horizonKey, customYears]);

  const vehicleList = vehicles.data ?? [];
  const goalList = goals.data ?? [];
  const partnerVehicleList = partnerVehicles.data ?? [];
  const partnerGoalList = partnerGoals.data ?? [];
  /** Own goals may link partner accounts — include both for progress math. */
  const progressVehicles = useMemo(
    () => [...vehicleList, ...partnerVehicleList],
    [vehicleList, partnerVehicleList]
  );
  const showPair = scope === 'pair' && isPaired;

  const chartMode = useMemo(
    () => resolveChartMode(goalList, vehicleList),
    [goalList, vehicleList]
  );

  const focus = useMemo(
    () =>
      resolveChartFocus({
        mode: chartMode,
        goals: goalList,
        vehicles: vehicleList,
        stored: storedFocus,
      }),
    [chartMode, goalList, vehicleList, storedFocus]
  );

  const focusedGoal = useMemo(() => {
    if (focus?.kind !== 'goal') return null;
    return goalList.find((g) => g.id === focus.id) ?? null;
  }, [focus, goalList]);

  const primaryVehicles = useMemo(() => {
    if (!focus) return [] as PlannerVehicle[];
    if (focus.kind === 'goal' && focusedGoal) {
      return linkedGrowthVehicles(focusedGoal, progressVehicles);
    }
    if (focus.kind === 'vehicle') {
      const v = vehicleList.find((x) => x.id === focus.id);
      return v ? [v] : [];
    }
    return [];
  }, [focus, focusedGoal, progressVehicles, vehicleList]);

  const projection = useMemo(() => {
    if (primaryVehicles.length === 0) return [];
    return projectNetWorth(
      primaryVehicles.map(toProjectInput),
      horizonMonths
    );
  }, [primaryVehicles, horizonMonths]);

  const targetAmount =
    chartMode === 'goal' && focusedGoal != null
      ? focusedGoal.target_amount
      : null;

  const refreshing =
    vehicles.isRefetching ||
    goals.isRefetching ||
    (showPair &&
      (partnerVehicles.isRefetching || partnerGoals.isRefetching));
  const loading = vehicles.isLoading || goals.isLoading || !prefsReady;
  const error =
    (vehicles.error instanceof Error && vehicles.error.message) ||
    (goals.error instanceof Error && goals.error.message) ||
    null;

  const hasVehicles = vehicleList.length > 0;
  const hasGoals = goalList.length > 0;
  const endNet = projection[projection.length - 1]?.netWorth ?? 0;
  const startNet = projection[0]?.netWorth ?? 0;
  const hasGreyedGoals =
    chartMode === 'goal' &&
    goalList.some((g) => !isChartableGoal(g, progressVehicles));

  function selectFocus(next: ChartFocusSelection) {
    setStoredFocus(next);
    void saveChartFocus(next);
  }

  const scopeBlock = isPaired ? (
    <View style={styles.scopeBlock}>
      <View style={styles.scopeRow}>
        {SCOPE_OPTIONS.map((opt) => {
          const selected = scope === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setScope(opt.value)}
              style={[styles.scopeChip, selected && styles.scopeChipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${opt.label} planner`}
            >
              <CaptionText
                style={[
                  styles.scopeText,
                  selected && styles.scopeTextSelected,
                ]}
              >
                {opt.label}
              </CaptionText>
            </Pressable>
          );
        })}
      </View>
      {scope === 'personal' ? (
        <CaptionText style={styles.scopeHint}>
          Your accounts and goals. To see {partnerName}&apos;s accounts and
          goals, click on the &quot;Pair&quot; tab.
        </CaptionText>
      ) : (
        <CaptionText style={styles.scopeHint}>
          Your lists plus {partnerName}&apos;s accounts and goals (read-only).
        </CaptionText>
      )}
      {plannerWriteBlocked ? (
        <CaptionText style={styles.scopeHint}>
          {PLANNER_WRITE_OFFLINE_COPY}
        </CaptionText>
      ) : null}
    </View>
  ) : null;

  function renderOwnVehicleCard(v: PlannerVehicle) {
    const detailHref = `/planner/vehicle/${v.id}`;
    return (
      <Pressable
        key={v.id}
        style={({ pressed }) => [
          styles.plannerCard,
          pressed && styles.plannerCardPressed,
        ]}
        onPress={() => pushWrite(detailHref)}
        accessibilityRole="button"
        accessibilityLabel={`${v.name} account`}
      >
        <View style={styles.plannerCardTop}>
          <View style={styles.accountSymbol}>
            <LandmarkIcon color={colors.green[700]} size={19} />
          </View>
          <View style={styles.accountCopy}>
            <StrongText style={styles.plannerCardTitle} numberOfLines={2}>
              {v.name}
            </StrongText>
            <CaptionText style={styles.muted}>
              {VEHICLE_TYPE_LABELS[v.vehicle_type]} ·{' '}
              {v.growth_mode === 'grow' ? 'Grows' : 'Shrinks'} · {v.annual_rate}%{' '}
              yearly
            </CaptionText>
          </View>
          <Pressable
            onPress={() => pushWrite(detailHref)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${v.name}`}
          >
            <CaptionText style={styles.editLink}>Edit</CaptionText>
          </Pressable>
        </View>
        <StrongText style={styles.accountBalance}>{format(v.balance)}</StrongText>
        {v.plan_amount != null && v.plan_cadence ? (
          <CaptionText style={styles.muted}>
            Plan {format(v.plan_amount)}{' '}
            {PLAN_CADENCE_LABELS[v.plan_cadence].toLowerCase()}
          </CaptionText>
        ) : null}
      </Pressable>
    );
  }

  /** Read-only twin of own account card — no Edit, no navigation. */
  function renderPartnerVehicleRow(v: PlannerVehicle) {
    return (
      <View
        key={v.id}
        style={styles.plannerCard}
        accessibilityLabel={`${v.name} account, read-only`}
      >
        <View style={styles.plannerCardTop}>
          <View style={styles.accountSymbol}>
            <LandmarkIcon color={colors.green[700]} size={19} />
          </View>
          <View style={styles.accountCopy}>
            <StrongText style={styles.plannerCardTitle} numberOfLines={2}>
              {v.name}
            </StrongText>
            <CaptionText style={styles.muted}>
              {VEHICLE_TYPE_LABELS[v.vehicle_type]} ·{' '}
              {v.growth_mode === 'grow' ? 'Grows' : 'Shrinks'} · {v.annual_rate}%{' '}
              yearly
            </CaptionText>
          </View>
          <CaptionText style={styles.readOnlyBadge}>Read-only</CaptionText>
        </View>
        <StrongText style={styles.accountBalance}>{format(v.balance)}</StrongText>
        {v.plan_amount != null && v.plan_cadence ? (
          <CaptionText style={styles.muted}>
            Plan {format(v.plan_amount)}{' '}
            {PLAN_CADENCE_LABELS[v.plan_cadence].toLowerCase()}
          </CaptionText>
        ) : null}
      </View>
    );
  }

  function renderOwnGoalCard(g: PlannerGoal) {
    const saved = goalEffectiveSaved({
      currentSaved: g.current_saved,
      vehicleIds: g.vehicle_ids,
      vehicles: progressVehicles,
    });
    const linkedGrowth = linkedGrowthVehicles(g, progressVehicles);
    const pace = goalPace({
      targetAmount: g.target_amount,
      currentSaved: saved,
      targetDate: g.target_date,
      createdAt: g.created_at,
      linkedVehicles: linkedGrowth.map(toProjectInput),
      planAmount: g.plan_amount,
      planCadence: g.plan_cadence,
    });
    const need = requiredContribution({
      targetAmount: g.target_amount,
      currentSaved: saved,
      targetDate: g.target_date,
      cadence: g.plan_cadence ?? 'monthly',
    });
    const linkedAccounts = progressVehicles
      .filter((v) => g.vehicle_ids.includes(v.id))
      .map((v) => ({
        id: v.id,
        name: v.name,
        tappable: v.user_id === user?.id,
      }));
    const detailHref = `/planner/goal/${g.id}`;
    const editHref = `/planner/goal/${g.id}?edit=1`;
    return (
      <Pressable
        key={g.id}
        style={({ pressed }) => [
          styles.plannerCard,
          pressed && styles.plannerCardPressed,
        ]}
        onPress={() => guardedPush(router, detailHref)}
        accessibilityRole="button"
        accessibilityLabel={`${g.name} goal`}
      >
        <View style={styles.plannerCardTop}>
          <StrongText style={styles.plannerCardTitle} numberOfLines={2}>
            {g.name}
          </StrongText>
          <Pressable
            onPress={() => pushWrite(editHref)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${g.name}`}
          >
            <CaptionText style={styles.editLink}>Edit</CaptionText>
          </Pressable>
        </View>
        <CaptionText
          style={[styles.muted, { color: paceColor(pace.status, colors) }]}
        >
          {GOAL_TYPE_LABELS[g.goal_type]} · {pace.progressPct}% ·{' '}
          {paceLabel(pace.status)}
        </CaptionText>
        <CaptionText style={styles.muted}>
          {format(saved)} of {format(g.target_amount)}
          {need != null
            ? ` · ~${format(need)}/${g.plan_cadence ? PLAN_CADENCE_LABELS[g.plan_cadence].toLowerCase() : 'mo'} to hit date`
            : ''}
        </CaptionText>
        <LinkedAccountLinks
          accounts={linkedAccounts}
          label="Linked accounts:"
          onPressAccount={(accountId) =>
            pushWrite(`/planner/vehicle/${accountId}`)
          }
        />
      </Pressable>
    );
  }

  /** Read-only twin of own goal card — no Edit, no navigation. */
  function renderPartnerGoalRow(g: PlannerGoal) {
    const saved = goalEffectiveSaved({
      currentSaved: g.current_saved,
      vehicleIds: g.vehicle_ids,
      vehicles: progressVehicles,
    });
    const linkedGrowth = linkedGrowthVehicles(g, progressVehicles);
    const pace = goalPace({
      targetAmount: g.target_amount,
      currentSaved: saved,
      targetDate: g.target_date,
      createdAt: g.created_at,
      linkedVehicles: linkedGrowth.map(toProjectInput),
      planAmount: g.plan_amount,
      planCadence: g.plan_cadence,
    });
    const linkedAccounts = progressVehicles
      .filter((v) => g.vehicle_ids.includes(v.id))
      .map((v) => ({
        id: v.id,
        name: v.name,
        tappable: false,
      }));
    return (
      <View
        key={g.id}
        style={styles.plannerCard}
        accessibilityLabel={`${g.name} goal, read-only`}
      >
        <View style={styles.plannerCardTop}>
          <StrongText
            style={[styles.plannerCardTitle, styles.partnerGoalTitle]}
            numberOfLines={2}
          >
            {g.name}
          </StrongText>
          <CaptionText style={styles.readOnlyBadge}>Read-only</CaptionText>
        </View>
        <CaptionText
          style={[styles.muted, { color: paceColor(pace.status, colors) }]}
        >
          {GOAL_TYPE_LABELS[g.goal_type]} · {pace.progressPct}% ·{' '}
          {paceLabel(pace.status)}
        </CaptionText>
        <CaptionText style={styles.muted}>
          {format(saved)} of {format(g.target_amount)}
        </CaptionText>
        <LinkedAccountLinks
          accounts={linkedAccounts}
          label="Linked accounts:"
          onPressAccount={() => {}}
        />
      </View>
    );
  }

  return (
    <ScrollEdgeHost edges={edges} style={styles.container}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, space.sm) + 12 },
      ]}
      {...scrollProps}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void vehicles.refetch();
            void goals.refetch();
            void partnerLink.refetch();
            if (partnerId) {
              void partnerVehicles.refetch();
              void partnerGoals.refetch();
            }
          }}
          tintColor={colors.green[700]}
        />
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.green[700]} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <TitleText style={styles.sectionTitle}>Couldn’t load planner</TitleText>
          <CaptionText style={styles.muted}>{error}</CaptionText>
          <Pressable
            style={styles.secondary}
            onPress={() => {
              void vehicles.refetch();
              void goals.refetch();
            }}
          >
            <CaptionText style={styles.secondaryText}>Try again</CaptionText>
          </Pressable>
        </View>
      ) : (
        <>
          <PageTitleText style={styles.pageTitle} accessibilityRole="header">
            Planner
          </PageTitleText>

          {scopeBlock}

          <View
            style={[
              styles.sectionHead,
              isPaired ? null : styles.sectionHeadFirst,
            ]}
          >
            <View style={styles.projectionTitleRow}>
              <TitleText style={styles.sectionTitle}>Projection</TitleText>
              <ProjectionDisclaimerInfo />
            </View>
          </View>

          <View style={styles.chips}>
            {HORIZON_PRESETS.map((h) => (
              <Pressable
                key={h.key}
                style={[
                  styles.chip,
                  horizonKey === h.key && styles.chipSelected,
                ]}
                onPress={() => setHorizonKey(h.key)}
              >
                <CaptionText
                  style={[
                    styles.chipText,
                    horizonKey === h.key && styles.chipTextSelected,
                  ]}
                >
                  {h.label}
                </CaptionText>
              </Pressable>
            ))}
          </View>
          {horizonKey === 'custom' ? (
            <View style={styles.customRow}>
              <CaptionText style={styles.muted}>Years</CaptionText>
              <TextInput
                style={styles.customInput}
                value={customYears}
                onChangeText={setCustomYears}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          ) : null}

          {hasVehicles ? (
            <View style={styles.showBlock}>
              <CaptionText style={styles.showLabel}>Show</CaptionText>
              <View style={styles.chips}>
                {chartMode === 'goal'
                  ? goalList.map((g) => {
                      const chartable = isChartableGoal(g, progressVehicles);
                      const selected =
                        focus?.kind === 'goal' && focus.id === g.id;
                      return (
                        <Pressable
                          key={g.id}
                          disabled={!chartable}
                          style={[
                            styles.chip,
                            styles.showChip,
                            selected && styles.chipSelected,
                            !chartable && styles.chipDisabled,
                          ]}
                          onPress={() =>
                            selectFocus({ kind: 'goal', id: g.id })
                          }
                          accessibilityState={{
                            selected,
                            disabled: !chartable,
                          }}
                          accessibilityLabel={
                            chartable
                              ? `Show ${g.name}`
                              : `${g.name}, link a growth account to chart`
                          }
                        >
                          <CaptionText
                            style={[
                              styles.chipText,
                              selected && styles.chipTextSelected,
                              !chartable && styles.chipTextDisabled,
                            ]}
                            numberOfLines={1}
                          >
                            {g.name}
                          </CaptionText>
                        </Pressable>
                      );
                    })
                  : vehicleList.map((v) => {
                      const selected =
                        focus?.kind === 'vehicle' && focus.id === v.id;
                      return (
                        <Pressable
                          key={v.id}
                          style={[
                            styles.chip,
                            styles.showChip,
                            selected && styles.chipSelected,
                          ]}
                          onPress={() =>
                            selectFocus({ kind: 'vehicle', id: v.id })
                          }
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Show ${v.name}`}
                        >
                          <CaptionText
                            style={[
                              styles.chipText,
                              selected && styles.chipTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {v.name}
                          </CaptionText>
                        </Pressable>
                      );
                    })}
              </View>
              {hasGreyedGoals ? (
                <CaptionText style={styles.showHint}>
                  Greyed goals need a linked growth account (not debt).
                </CaptionText>
              ) : null}
            </View>
          ) : null}

          {!hasVehicles ? (
            <View style={styles.chartBleed}>
              <ProjectionEmptyWell onPress={() => pushWrite(ADD_VEHICLE)} />
            </View>
          ) : (
            <>
              {/* Full-bleed: cancel content padding so the chart well hits screen edges. */}
              <View style={styles.chartBleed}>
                <ProjectionChart
                  data={projection}
                  targetAmount={targetAmount}
                  emptyLabel="No projection yet"
                />
              </View>
              <View style={styles.summaryRow}>
                <View>
                  <CaptionText style={styles.muted}>Now</CaptionText>
                  <StrongText style={styles.amount}>
                    {format(startNet)}
                  </StrongText>
                </View>
                <View style={styles.summaryEnd}>
                  <CaptionText style={styles.muted}>At horizon</CaptionText>
                  <StrongText style={styles.amount}>
                    {format(endNet)}
                  </StrongText>
                </View>
              </View>
            </>
          )}

          <View style={styles.sectionHead}>
            <TitleText style={styles.sectionTitle}>Accounts</TitleText>
            {hasVehicles ? (
              <Pressable
                style={styles.headerAdd}
                onPress={() => pushWrite(ADD_VEHICLE)}
                accessibilityRole="button"
                accessibilityLabel="Add account"
              >
                <PlusIcon color={colors.green[700]} size={12} />
                <CaptionText style={styles.secondaryText}>
                  Add account
                </CaptionText>
              </Pressable>
            ) : null}
          </View>

          {!hasVehicles ? (
            <Pressable
              style={({ pressed }) => [
                styles.dashedEmpty,
                pressed && styles.dashedEmptyPressed,
              ]}
              onPress={() => pushWrite(ADD_VEHICLE)}
              accessibilityRole="button"
              accessibilityLabel="Add account"
            >
              <PlusIcon color={colors.green[700]} size={22} />
              <CaptionText style={styles.dashedBody}>
                Track savings, investments, cash, or debt with a rate and
                optional plan.
              </CaptionText>
              <CaptionText style={styles.secondaryText}>Add account</CaptionText>
            </Pressable>
          ) : (
            vehicleList.map(renderOwnVehicleCard)
          )}

          {showPair ? (
            <PartnerCollapsibleCard
              title={`${partnerName}'s accounts`}
              total={partnerVehicleList.length}
            >
              {partnerVehicleList.length === 0 ? (
                <CaptionText style={styles.muted}>No accounts yet.</CaptionText>
              ) : (
                partnerVehicleList.map(renderPartnerVehicleRow)
              )}
            </PartnerCollapsibleCard>
          ) : null}

          <View style={styles.sectionHead}>
            <TitleText style={styles.sectionTitle}>Goals</TitleText>
            {hasGoals ? (
              <Pressable
                style={styles.headerAdd}
                onPress={() => pushWrite(ADD_GOAL)}
                accessibilityRole="button"
                accessibilityLabel="Add goal"
              >
                <PlusIcon color={colors.green[700]} size={12} />
                <CaptionText style={styles.secondaryText}>Add goal</CaptionText>
              </Pressable>
            ) : null}
          </View>

          {!hasGoals ? (
            <Pressable
              style={({ pressed }) => [
                styles.dashedEmpty,
                pressed && styles.dashedEmptyPressed,
              ]}
              onPress={() => pushWrite(ADD_GOAL)}
              accessibilityRole="button"
              accessibilityLabel="Add goal"
            >
              <PlusIcon color={colors.green[700]} size={22} />
              <CaptionText style={styles.dashedBody}>
                No goals yet. Set a target amount and optional date to track
                pace.
              </CaptionText>
              {hasVehicles ? (
                <CaptionText style={styles.muted}>
                  Link accounts when you add a goal.
                </CaptionText>
              ) : null}
              <CaptionText style={styles.secondaryText}>Add goal</CaptionText>
            </Pressable>
          ) : (
            goalList.map(renderOwnGoalCard)
          )}

          {showPair ? (
            <PartnerCollapsibleCard
              title={`${partnerName}'s goals`}
              total={partnerGoalList.length}
            >
              {partnerGoalList.length === 0 ? (
                <CaptionText style={styles.muted}>No goals yet.</CaptionText>
              ) : (
                partnerGoalList.map(renderPartnerGoalRow)
              )}
            </PartnerCollapsibleCard>
          ) : null}
        </>
      )}
    </ScrollView>
    </ScrollEdgeHost>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.screen,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  pageTitle: {
    color: colors.ink,
    marginBottom: space.sm,
  },
  centered: {
    paddingVertical: space.xxl,
    alignItems: 'center',
    gap: space.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  sectionHeadFirst: {
    marginTop: 0,
  },
  projectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  sectionTitle: {
    color: colors.ink,
    ...typography.section,
  },
  headerAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dashedEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  dashedEmptyPressed: {
    backgroundColor: colors.green[50],
    borderColor: colors.green[200],
  },
  dashedBody: {
    color: colors.inkMuted,
    textAlign: 'center',
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 38,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  showChip: {
    maxWidth: 140,
  },
  chipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
  },
  chipDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    opacity: 0.65,
  },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextSelected: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  chipTextDisabled: {
    color: colors.inkMuted,
  },
  showBlock: {
    gap: space.xs,
    marginTop: space.xs,
  },
  showLabel: {
    color: colors.inkMuted,
    fontSize: 12,
  },
  showHint: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  customInput: {
    width: 64,
    borderWidth: 0,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    fontFamily: fonts.body,
    color: colors.ink,
    backgroundColor: colors.surfaceMuted,
  },
  chartBleed: {
    marginHorizontal: 0,
    alignSelf: 'stretch',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
    gap: 12,
  },
  summaryEnd: { alignItems: 'flex-start', flex: 1 },
  amount: { color: colors.ink, ...typography.amount, fontSize: 15 },
  muted: { color: colors.inkMuted, fontSize: 11 },
  secondary: {
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
    fontSize: 12,
  },
  plannerCardTitle: { color: colors.ink, fontSize: 15 },
  accountCopy: { flex: 1, gap: 4, minWidth: 0 },
  accountSymbol: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.green[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountBalance: {
    color: colors.ink,
    fontSize: 22,
    letterSpacing: -0.6,
    marginTop: 4,
  },
  plannerCard: {
    borderRadius: radius.lg,
    padding: space.md,
    backgroundColor: colors.surface,
    gap: 14,
    marginBottom: 2,
  },
  plannerCardPressed: {
    backgroundColor: colors.green[50],
  },
  plannerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editLink: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
    fontSize: 13,
  },
  readOnlyBadge: {
    color: colors.inkMuted,
    fontFamily: fonts.bodyStrong,
    fontSize: 12,
  },
  partnerGoalTitle: {
    flex: 1,
    paddingRight: space.sm,
  },
  scopeBlock: {
    gap: space.sm,
    marginBottom: space.xs,
  },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  scopeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 38,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  scopeChipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
  },
  scopeText: { color: colors.ink, fontSize: 13 },
  scopeTextSelected: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  scopeHint: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
}

