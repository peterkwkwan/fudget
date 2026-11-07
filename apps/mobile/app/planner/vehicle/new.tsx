import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConnectionRequired } from '@/components/ConnectionRequired';
import { VehicleForm } from '@/components/planner/VehicleForm';
import { type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { useCreatePlannerVehicle } from '@/hooks/usePlanner';
import { PLANNER_WRITE_OFFLINE_COPY } from '@/lib/offline/ux';
import type { PlannerVehicleInput } from '@/lib/plannerVehicles';

export default function NewVehicleScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const create = useCreatePlannerVehicle();
  const { plannerWriteBlocked } = useOfflineGates();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(input: PlannerVehicleInput) {
    setError(null);
    try {
      await create.mutateAsync(input);
      // Return to Planner list (same as Transactions after Add).
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/planner');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save account.'
      );
    }
  }

  if (plannerWriteBlocked) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Add account' }} />
        <ConnectionRequired message={PLANNER_WRITE_OFFLINE_COPY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add account' }} />
      <VehicleForm
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

