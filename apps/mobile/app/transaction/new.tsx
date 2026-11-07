import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OfflineBanner } from '@/components/OfflineBanner';
import {
  TransactionForm,
  type TransactionFormSubmit,
  type TransactionFormValues,
} from '@/components/TransactionForm';
import { type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { usePlannerVehicles } from '@/hooks/usePlanner';
import { useCreateRecurringSeries } from '@/hooks/useRecurring';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { occurredAtFromDateParam } from '@/lib/addTransactionDate';
import { useAuth } from '@/lib/auth';
import { userFacingOfflineWriteError } from '@/lib/offline/writeError';
import { deviceTimezone } from '@/lib/profile';
import { takePendingVoiceDraft } from '@/lib/voiceDraft';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readInitial(
  dateParam: string | undefined,
  timeZone: string
): Partial<TransactionFormValues> | undefined {
  const draft = takePendingVoiceDraft();
  if (draft) {
    return {
      amount: draft.amount,
      type: draft.type,
      category: draft.category,
      note: draft.note,
      occurredAt: new Date(),
    };
  }
  const occurredAt = occurredAtFromDateParam(dateParam, timeZone);
  if (!occurredAt) return undefined;
  return { occurredAt };
}

export default function NewTransactionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { profile } = useAuth();
  const createTxn = useCreateTransaction();
  const createSeries = useCreateRecurringSeries();
  const vehicles = usePlannerVehicles();
  const [error, setError] = useState<string | null>(null);
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const timezone = profile?.timezone || deviceTimezone();
  const [initial] = useState(() =>
    readInitial(firstParam(params.date), timezone)
  );
  const { offline, banner } = useOfflineGates();
  const busy = createTxn.isPending || createSeries.isPending;
  const accounts = (vehicles.data ?? []).map((v) => ({
    id: v.id,
    name: v.name,
  }));
  const defaultAccountId =
    (vehicles.data ?? []).find((v) => v.is_default)?.id ?? null;

  async function onSubmit(input: TransactionFormSubmit) {
    setError(null);
    try {
      if (input.repeat?.cadence && !offline) {
        await createSeries.mutateAsync({
          amount: input.amount,
          type: input.type,
          category: input.category,
          note: input.note,
          cadence: input.repeat.cadence,
          byweekday: input.repeat.byweekday,
          anchor_at: input.occurred_at,
          timezone,
          endsMode: input.repeat.endsMode,
          endsOn: input.repeat.endsOn,
          endsAfterCount: input.repeat.endsAfterCount,
        });
      } else {
        await createTxn.mutateAsync({
          amount: input.amount,
          type: input.type,
          category: input.category,
          note: input.note,
          occurred_at: input.occurred_at,
          vehicle_id: input.vehicle_id ?? null,
          transfer_to_vehicle_id: input.transfer_to_vehicle_id ?? null,
        });
      }
      router.back();
    } catch (err) {
      setError(
        userFacingOfflineWriteError(err, 'Could not save transaction.')
      );
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add transaction' }} />
      <OfflineBanner message={banner} />
      <TransactionForm
        allowRepeat
        allowVoice
        initial={initial}
        accounts={accounts}
        defaultAccountId={defaultAccountId}
        submitLabel="Save"
        busy={busy}
        error={error}
        onSubmit={(input) => void onSubmit(input)}
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

