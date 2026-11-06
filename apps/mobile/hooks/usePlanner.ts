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
  listActiveGoalsLocal,
  replaceGoalsLocal,
} from '@/lib/offline/goalsLocal';
import {
  listActiveVehiclesLocal,
  replaceVehiclesLocal,
  toPlannerVehicle,
  vehicleFromRemote,
} from '@/lib/offline/vehiclesLocal';
import {
  createPlannerGoal,
  deleteContributionEvent,
  getPlannerGoal,
  listContributionEvents,
  listPlannerGoalsForUser,
  logContributionEvent,
  plannerGoalKeys,
  softDeletePlannerGoal,
  updatePlannerGoal,
  type ContributionEventInput,
  type PlannerGoal,
  type PlannerGoalInput,
} from '@/lib/plannerGoals';
import {
  createPlannerVehicle,
  getPlannerVehicle,
  listPlannerVehiclesForUser,
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

async function sessionUserId(): Promise<string | null> {
  const { data: sessionData } = await (
    await import('@/lib/supabase')
  ).supabase.auth.getSession();
  return sessionData.session?.user.id ?? null;
}

/** Online: fetch + cache. Offline: read the local vehicles mirror. */
async function listVehiclesForOwner(
  ownerId: string,
  online: boolean
): Promise<PlannerVehicle[]> {
  if (!OFFLINE_TXNS_ENABLED) {
    return listPlannerVehiclesForUser(ownerId);
  }
  if (!online) {
    const db = await getOfflineDb();
    const rows = await listActiveVehiclesLocal(db, ownerId);
    return rows.map(toPlannerVehicle);
  }
  const remote = await listPlannerVehiclesForUser(ownerId);
  try {
    const db = await getOfflineDb();
    await replaceVehiclesLocal(
      db,
      ownerId,
      remote.map(vehicleFromRemote)
    );
  } catch {
    // Cache miss is fine; remote list still returned.
  }
  return remote;
}

async function listGoalsForOwner(
  ownerId: string,
  online: boolean
): Promise<PlannerGoal[]> {
  if (!OFFLINE_TXNS_ENABLED) {
    return listPlannerGoalsForUser(ownerId);
  }
  if (!online) {
    const db = await getOfflineDb();
    return listActiveGoalsLocal(db, ownerId);
  }
  const remote = await listPlannerGoalsForUser(ownerId);
  try {
    const db = await getOfflineDb();
    await replaceGoalsLocal(db, ownerId, remote);
  } catch {
    // Cache miss is fine.
  }
  return remote;
}

export function usePlannerVehicles() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { online } = useConnectivity();
  const userId = user?.id;

  const query = useQuery({
    queryKey: [
      ...plannerVehicleKeys.list(),
      userId ?? '',
      online ? 'online' : 'offline',
    ],
    queryFn: () => listVehiclesForOwner(userId!, online),
    enabled: Boolean(userId),
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

/** Partner (or any other owner) vehicles — Pair read-only list. */
export function usePartnerPlannerVehicles(partnerId: string | null | undefined) {
  const { online } = useConnectivity();
  return useQuery({
    queryKey: [
      ...plannerVehicleKeys.all,
      'partner',
      partnerId ?? '',
      online ? 'online' : 'offline',
    ],
    queryFn: () => listVehiclesForOwner(partnerId!, online),
    enabled: Boolean(partnerId),
  });
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
  const { user } = useAuth();
  const { online } = useConnectivity();
  const userId = user?.id;

  const query = useQuery({
    queryKey: [
      ...plannerGoalKeys.list(),
      userId ?? '',
      online ? 'online' : 'offline',
    ],
    queryFn: () => listGoalsForOwner(userId!, online),
    enabled: Boolean(userId),
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: plannerGoalKeys.list() });
    }, [queryClient])
  );

  return query;
}

/** Partner goals — Pair read-only list. */
export function usePartnerPlannerGoals(partnerId: string | null | undefined) {
  const { online } = useConnectivity();
  return useQuery({
    queryKey: [
      ...plannerGoalKeys.all,
      'partner',
      partnerId ?? '',
      online ? 'online' : 'offline',
    ],
    queryFn: () => listGoalsForOwner(partnerId!, online),
    enabled: Boolean(partnerId),
  });
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

/** Prefetch partner mirrors while online (Pair view + offline). */
export async function warmPartnerPlannerMirror(
  partnerId: string
): Promise<void> {
  if (!OFFLINE_TXNS_ENABLED) return;
  const online = true;
  await listVehiclesForOwner(partnerId, online);
  await listGoalsForOwner(partnerId, online);
}

export { sessionUserId };
