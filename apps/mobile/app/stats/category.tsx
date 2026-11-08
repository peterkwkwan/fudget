import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
} from 'react-native';

import { CaptionText, TitleText } from '@/components/StyledText';
import { PartnerCategoryTotalRow } from '@/components/stats/PartnerCategoryTotalRow';
import { TransactionRow } from '@/components/TransactionRow';
import type { TransactionType } from '@/constants/categories';
import { space, typography, type ThemeColors } from '@/constants/theme';
import { usePartnerLink } from '@/hooks/usePartner';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import {
  useCategoryDrilldown,
  usePartnerCategoryTotal,
} from '@/hooks/useStats';
import { STATS_OFFLINE_COPY } from '@/lib/offline/ux';
import {
  buildCategoryDrilldownEntries,
  type CategoryListEntry,
} from '@/lib/pairCategoryList';
import { useTheme } from '@/lib/ThemeProvider';

function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function CategoryDrilldownScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: string;
    type?: string;
    start?: string;
    end?: string;
    periodLabel?: string;
    scope?: string;
  }>();

  const category = asString(params.category);
  const type = (asString(params.type) || 'expense') as TransactionType;
  const startIso = asString(params.start);
  const endIso = asString(params.end);
  const periodLabel = asString(params.periodLabel);
  const pairScope = asString(params.scope) === 'pair';

  const start = useMemo(() => new Date(startIso), [startIso]);
  const end = useMemo(() => new Date(endIso), [endIso]);

  const { pendingIds, categoryFixIds, offline } = useOfflineGates();
  const partnerLink = usePartnerLink();
  const boundsValid =
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    Boolean(category);

  const isPaired = partnerLink.data?.status === 'active';
  const linkPending =
    pairScope &&
    !offline &&
    partnerLink.isLoading &&
    partnerLink.data == null;
  const partnerEnabled =
    pairScope && boundsValid && isPaired && !offline && !linkPending;

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useCategoryDrilldown({
      type,
      category,
      start,
      end,
      enabled: boundsValid,
    });

  const partner = usePartnerCategoryTotal({
    type,
    category,
    start,
    end,
    enabled: partnerEnabled,
  });

  const entries = useMemo(
    () =>
      buildCategoryDrilldownEntries({
        transactions: data ?? [],
        type,
        category,
        partnerName: partnerLink.data?.partnerDisplayName,
        partnerTotal: partnerEnabled ? (partner.data ?? null) : null,
      }),
    [
      data,
      type,
      category,
      partnerLink.data?.partnerDisplayName,
      partnerEnabled,
      partner.data,
    ]
  );

  const partnerBlocking =
    partnerEnabled &&
    partner.isLoading &&
    partner.data == null &&
    !partner.isError;
  const showSpinner = boundsValid && (isLoading || linkPending || partnerBlocking);
  const partnerFailed = partnerEnabled && partner.isError;
  const partnerUnresolved = pairScope && (offline || partnerFailed);

  const footer =
    pairScope && offline ? (
      <CaptionText style={styles.footer}>{STATS_OFFLINE_COPY}</CaptionText>
    ) : partnerFailed ? (
      <CaptionText style={styles.footer}>
        Couldn’t load your partner’s category total.
      </CaptionText>
    ) : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: category || 'Category',
        }}
      />
      <View style={styles.container}>
        {periodLabel ? (
          <CaptionText style={styles.period}>{periodLabel}</CaptionText>
        ) : null}

        {!boundsValid ? (
          <View style={styles.centered}>
            <TitleText style={styles.emptyTitle}>Missing filters</TitleText>
            <CaptionText style={styles.emptyBody}>
              Go back to Stats and open a category again.
            </CaptionText>
          </View>
        ) : showSpinner ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.green[700]} />
          </View>
        ) : isError ? (
          <View style={styles.centered}>
            <TitleText style={styles.emptyTitle}>Couldn’t load entries</TitleText>
            <CaptionText style={styles.emptyBody}>
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </CaptionText>
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) =>
              item.kind === 'transaction' ? item.transaction.id : item.id
            }
            renderItem={({ item }) => (
              <CategoryListRow
                item={item}
                partnerName={partnerLink.data?.partnerDisplayName}
                category={category}
                pendingIds={pendingIds}
                categoryFixIds={categoryFixIds}
                onOpen={(id) => router.push(`/transaction/${id}`)}
              />
            )}
            refreshing={isRefetching || partner.isRefetching}
            onRefresh={() => {
              void refetch();
              if (partnerEnabled) void partner.refetch();
            }}
            contentContainerStyle={
              entries.length === 0 ? styles.emptyList : undefined
            }
            ListFooterComponent={entries.length > 0 ? footer ?? undefined : undefined}
            ListEmptyComponent={
              <View style={styles.empty}>
                {partnerUnresolved ? (
                  <>
                    <TitleText style={styles.emptyTitle}>
                      {offline
                        ? 'Partner total needs a connection'
                        : 'Couldn’t load partner total'}
                    </TitleText>
                    <CaptionText style={styles.emptyBody}>
                      {offline
                        ? STATS_OFFLINE_COPY
                        : `Couldn’t load your partner’s total for ${category}.`}
                    </CaptionText>
                  </>
                ) : (
                  <>
                    <TitleText style={styles.emptyTitle}>
                      No matching entries
                    </TitleText>
                    <CaptionText style={styles.emptyBody}>
                      Nothing in {category} for this period.
                    </CaptionText>
                  </>
                )}
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

function CategoryListRow({
  item,
  partnerName,
  category,
  pendingIds,
  categoryFixIds,
  onOpen,
}: {
  item: CategoryListEntry;
  partnerName: string | null | undefined;
  category: string;
  pendingIds: Set<string>;
  categoryFixIds: Set<string>;
  onOpen: (id: string) => void;
}) {
  if (item.kind === 'partner') {
    return (
      <PartnerCategoryTotalRow
        partnerName={partnerName}
        category={category}
        amount={item.sum}
        type={item.type}
      />
    );
  }

  return (
    <TransactionRow
      transaction={item.transaction}
      pending={pendingIds.has(item.transaction.id)}
      categoryFix={categoryFixIds.has(item.transaction.id)}
      onPress={() => onOpen(item.transaction.id)}
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  period: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    color: colors.inkMuted,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    paddingHorizontal: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  emptyTitle: {
    color: colors.green[950],
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.inkMuted,
    textAlign: 'center',
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    color: colors.inkMuted,
    textAlign: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
});
}
