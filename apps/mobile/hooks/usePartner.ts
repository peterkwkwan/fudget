import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useConnectivity } from '@/hooks/useConnectivity';
import { useAuth } from '@/lib/auth';
import { getOfflineDb } from '@/lib/offline/db';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import {
  readPartnerCache,
  savePartnerCache,
} from '@/lib/offline/partnerCache';
import {
  acceptPartnerInvite,
  createPartnerInvite,
  fetchPartnerLink,
  partnerKeys,
  unlinkPartner,
  type PartnerLink,
} from '@/lib/partner';
import { statsKeys } from '@/lib/stats';

async function fetchPartnerLinkCached(
  userId: string,
  online: boolean
): Promise<PartnerLink | null> {
  if (!OFFLINE_TXNS_ENABLED) {
    return fetchPartnerLink();
  }
  if (!online) {
    try {
      const db = await getOfflineDb();
      return readPartnerCache(db, userId);
    } catch {
      return null;
    }
  }
  const link = await fetchPartnerLink();
  try {
    const db = await getOfflineDb();
    await savePartnerCache(db, userId, link);
  } catch {
    // Mirror miss is fine; live link still returned.
  }
  return link;
}

export function usePartnerLink() {
  const { session, user } = useAuth();
  const { online, ready } = useConnectivity();
  const queryClient = useQueryClient();
  const userId = user?.id ?? session?.user.id;
  // Flag off: live RPC (same as before). Flag on: online RPC or offline cache.
  const canFetch =
    Boolean(userId) && (!OFFLINE_TXNS_ENABLED || ready);

  const query = useQuery({
    queryKey: [
      ...partnerKeys.link(),
      userId ?? '',
      online ? 'online' : 'offline',
    ],
    queryFn: () => fetchPartnerLinkCached(userId!, online),
    enabled: canFetch,
  });

  useFocusEffect(
    useCallback(() => {
      if (!canFetch) return;
      void queryClient.invalidateQueries({ queryKey: partnerKeys.link() });
    }, [queryClient, canFetch])
  );

  return query;
}

function invalidatePartnerAndStats(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: partnerKeys.all });
  void queryClient.invalidateQueries({ queryKey: statsKeys.all });
}

export function useCreatePartnerInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPartnerInvite,
    onSuccess: () => invalidatePartnerAndStats(queryClient),
  });
}

export function useAcceptPartnerInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => acceptPartnerInvite(code),
    onSuccess: () => invalidatePartnerAndStats(queryClient),
  });
}

export function useUnlinkPartner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const entries = queryClient.getQueriesData<PartnerLink | null>({
        queryKey: partnerKeys.all,
      });
      let partnerId: string | null = null;
      for (const [, value] of entries) {
        if (value?.partnerId) {
          partnerId = value.partnerId;
          break;
        }
      }
      await unlinkPartner();
      return partnerId;
    },
    onSuccess: async (partnerId) => {
      invalidatePartnerAndStats(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['planner_goals'] });
      void queryClient.invalidateQueries({ queryKey: ['planner_vehicles'] });
      if (OFFLINE_TXNS_ENABLED && user?.id) {
        try {
          const db = await getOfflineDb();
          const { removeGoalsLocal } = await import('@/lib/offline/goalsLocal');
          const { removeVehiclesLocal } = await import(
            '@/lib/offline/vehiclesLocal'
          );
          await savePartnerCache(db, user.id, null);
          if (partnerId) {
            await removeGoalsLocal(db, partnerId);
            await removeVehiclesLocal(db, partnerId);
          }
        } catch {
          // Cache cleanup is best-effort.
        }
      }
    },
  });
}
