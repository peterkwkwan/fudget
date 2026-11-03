import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/lib/auth';
import { useConnectivity } from '@/hooks/useConnectivity';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { getOfflineDb } from '@/lib/offline/db';
import {
  listActiveVehiclesLocal,
  replaceVehiclesLocal,
  toPlannerVehicleLite,
  vehicleFromRemote,
} from '@/lib/offline/vehiclesLocal';
import {
  createPlannerGoal,
  deleteContributionEvent,
  getPlannerGoal,
  listContributionEvents,
  listPlannerGoals,
  logContributionEvent,
  plannerGoalKeys,
  softDeletePlannerGoal,
  updatePlannerGoal,
  type ContributionEventInput,
  type PlannerGoalInput,
} from '@/lib/plannerGoals';
import {
  createPlannerVehicle,
  getPlannerVehicle,
  listPlannerVehicles,
  plannerVehicleKeys,
  softDeletePlannerVehicle,
  updatePlannerVehicle,
  type PlannerVehicle,
  type PlannerVehicleInput,
} from '@/lib/plannerVehicles';

function invalidatePlanner(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: plannerGoalKeys.all });
  void qc.invalidateQueries({ queryKey: plannerVehicleKeys.all });
}

/** Online: fetch + cache. Offline: read the local vehicles mirror. */
async function listVehiclesForUi(online: boolean): Promise<PlannerVehicle[]> {
  if (!OFFLINE_TXNS_ENABLED) {
    return listPlannerVehicles();
  }
  if (!online) {
    const db = await getOfflineDb();
    const { data: sessionData } = await (
      await import('@/lib/supabase')
    ).supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return [];
    const rows = await listActiveVehiclesLocal(db, userId);
    // Lite rows are enough for Account picker / balances; fill defaults for type.
    return rows.map((row) => ({
      ...emptyVehicleShape(toPlannerVehicleLite(row)),
    }));
  }
  const remote = await listPlannerVehicles();
  try {
    const db = await getOfflineDb();
    const userId = remote[0]?.user_id;
    if (userId) {
      await replaceVehiclesLocal(
        db,
        userId,
        remote.map(vehicleFromRemote)
      );
    } else {
      const { data: sessionData } = await (
        await import('@/lib/supabase')
      ).supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (uid) await replaceVehiclesLocal(db, uid, []);
    }
  } catch {
    // Cache miss is fine; remote list still returned.
  }
  return remote;
}

function emptyVehicleShape(
  lite: ReturnType<typeof toPlannerVehicleLite>
): PlannerVehicle {
  return {
    id: lite.id,
    user_id: lite.user_id,
    name: lite.name,
    vehicle_type: 'other',
    balance: lite.balance,
    annual_rate: 0,
    growth_mode: 'grow',
    compound_period: 'yearly',
    plan_amount: null,
    plan_cadence: null,
    notes: null,
    is_default: lite.is_default,
    deleted_at: lite.deleted_at,
    created_at: lite.updated_at,
    updated_at: lite.updated_at,
  };
}

export function usePlannerVehicles() {
  const queryClient = useQueryClient();
  const { online } = useConnectivity();
  const query = useQuery({
    queryKey: [...plannerVehicleKeys.list(), online ? 'online' : 'offline'],
    queryFn: () => listVehiclesForUi(online),
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({
        queryKey: plannerVehicleKeys.list(),
      });
    }, [queryClient])
  );

  return query;
}

export function usePlannerVehicle(id: string | undefined) {
  return useQuery({
    queryKey: plannerVehicleKeys.detail(id ?? ''),
    queryFn: () => getPlannerVehicle(id!),
    enabled: Boolean(id),
  });
}

export function useCreatePlannerVehicle() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlannerVehicleInput) => {
      if (!user?.id) throw new Error('You must be signed in.');
      return createPlannerVehicle(user.id, input);
    },
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useUpdatePlannerVehicle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlannerVehicleInput) =>
      updatePlannerVehicle(id, input),
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useSoftDeletePlannerVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeletePlannerVehicle(id),
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function usePlannerGoals() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: plannerGoalKeys.list(),
    queryFn: listPlannerGoals,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: plannerGoalKeys.list() });
    }, [queryClient])
  );

  return query;
}

export function usePlannerGoal(id: string | undefined) {
  return useQuery({
    queryKey: plannerGoalKeys.detail(id ?? ''),
    queryFn: () => getPlannerGoal(id!),
    enabled: Boolean(id),
  });
}

export function useCreatePlannerGoal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlannerGoalInput) => {
      if (!user?.id) throw new Error('You must be signed in.');
      return createPlannerGoal(user.id, input);
    },
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useUpdatePlannerGoal(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlannerGoalInput) => updatePlannerGoal(id, input),
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useSoftDeletePlannerGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeletePlannerGoal(id),
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useContributionEvents(goalId: string | undefined) {
  return useQuery({
    queryKey: plannerGoalKeys.events(goalId ?? ''),
    queryFn: () => listContributionEvents(goalId!),
    enabled: Boolean(goalId),
  });
}

export function useLogContribution(goalId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ContributionEventInput) => {
      if (!user?.id) throw new Error('You must be signed in.');
      return logContributionEvent(user.id, goalId, input);
    },
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useDeleteContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContributionEvent(id),
    onSuccess: () => invalidatePlanner(queryClient),
  });
}
