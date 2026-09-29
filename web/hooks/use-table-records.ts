'use client';

import useSWR from 'swr';

import { tableRecords, type TableRecord } from '@pb/core';
import { fetchMyPerformance } from '@/lib/supabase/performance';
import { fetchMyTables } from '@/lib/supabase/tables';

export interface TableRecordsState {
  records: TableRecord[] | undefined;
  error: Error | undefined;
  retry: () => void;
}

/**
 * The tables the signed-in account sits at, each with its record there. Both keys are the ones
 * Account ('my_tables') and Results ('get_my_performance') already read, so leaving a table
 * or a new cashout reaches Home without a refetch of its own.
 */
export function useTableRecords(): TableRecordsState {
  const tables = useSWR('my_tables', fetchMyTables);
  const played = useSWR('get_my_performance', fetchMyPerformance);
  const records = tables.data && played.data ? tableRecords(tables.data, played.data) : undefined;
  return {
    records,
    error: tables.error ?? played.error,
    retry: () => {
      void tables.mutate();
      void played.mutate();
    },
  };
}
