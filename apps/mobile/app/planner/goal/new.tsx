import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConnectionRequired } from '@/components/ConnectionRequired';
import { GoalForm } from '@/components/planner/GoalForm';
import { type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { usePartnerLink } from '@/hooks/usePartner';
import {
  useCreatePlannerGoal,
  usePartnerPlannerVehicles,
  usePlannerVehicles,
} from '@/hooks/usePlanner';
import { PLANNER_WRITE_OFFLINE_COPY } from '@/lib/offline/ux';
import type { PlannerGoalInput } from '@/lib/plannerGoals';

export default function NewGoalScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const create = useCreatePlannerGoal();
  const vehicles = usePlannerVehicles();
  const partnerLink = usePartnerLink();
  const isPaired = partnerLink.data?.status === 'active';
  const partnerId = isPaired ? partnerLink.data?.partnerId : null;
  const partnerVehicles = usePartnerPlannerVehicles(partnerId);
  const { plannerWriteBlocked } = useOfflineGates();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(input: PlannerGoalInput) {
    setError(null);
    try {
      await create.mutateAsync(input);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/planner');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save goal.');
    }
  }

  if (plannerWriteBlocked) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Add goal' }} />
        <ConnectionRequired message={PLANNER_WRITE_OFFLINE_COPY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add goal' }} />
      <GoalForm
        vehicles={vehicles.data ?? []}
        partnerVehicles={isPaired ? (partnerVehicles.data ?? []) : []}
        partnerLabel={partnerLink.data?.partnerDisplayName ?? null}
        submitLabel="Save"
        busy={create.isPending}
        error={error}
        onSubmit={(input) => void onSubmit(input)}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
});
}

