import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/lib/auth';
import { currentPeriodFocus, type PeriodFocus } from '@/lib/periods';

type PeriodFocusUpdate =
  | PeriodFocus
  | ((current: PeriodFocus) => PeriodFocus);

type PeriodFocusContextValue = {
  focus: PeriodFocus;
  setFocus: (update: PeriodFocusUpdate) => void;
};

const PeriodFocusContext = createContext<PeriodFocusContextValue | null>(null);

/**
 * One focused month for Transactions and Stats.
 * Chevrons, swipe, and the month/year picker all write this.
 */
export function PeriodFocusProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const timeZone = profile?.timezone || 'UTC';
  const [focus, setFocusState] = useState<PeriodFocus>(() =>
    currentPeriodFocus(timeZone)
  );

  const setFocus = useCallback((update: PeriodFocusUpdate) => {
    setFocusState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      if (next.year === current.year && next.month === current.month) {
        return current;
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ focus, setFocus }), [focus, setFocus]);

  return (
    <PeriodFocusContext.Provider value={value}>
      {children}
    </PeriodFocusContext.Provider>
  );
}

export function usePeriodFocus(): PeriodFocusContextValue {
  const value = useContext(PeriodFocusContext);
  if (!value) {
    throw new Error('usePeriodFocus must be used within PeriodFocusProvider');
  }
  return value;
}
