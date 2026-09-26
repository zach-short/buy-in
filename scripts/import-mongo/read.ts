import { check } from './supabase';

// PostgREST caps a response (1000 rows by default), so a bare select would silently
// truncate a larger table — and a verification over a truncated read proves nothing.
const PAGE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>;

/** Read every row a query matches, one ordered page at a time. */
export async function readAll<T>(context: string, page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    check(error, context);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return rows;
  }
}
