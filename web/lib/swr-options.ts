import type { SWRConfiguration } from 'swr';

/**
 * For the reads a balance is summed from. The app's SWRConfig keeps `revalidateOnFocus` off
 * (`context/swr-provider.tsx`) because a refetch can reset a form seeded from fetched data; a
 * balance is the exception (owner, 2026-09-30): a host back from Venmo or a text must not act
 * on the number from before they left.
 *
 * SWR 2.5 runs the focus handler of only the first-mounted hook for a key (`revalidateAllKeys`
 * calls `revalidators[key][0]`), so every hook that reads one of these keys must pass this, or
 * whether a focus refetches depends on which component mounted first.
 */
export const BALANCE_READ = { revalidateOnFocus: true } satisfies SWRConfiguration;
