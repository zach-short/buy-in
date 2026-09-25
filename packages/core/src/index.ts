// @pb/core — shared between web/ and native/.
// Nothing here may import from `next`, `react-native`, or touch `window`/`document`.
// Platform-specific behaviour is injected by the caller (see the SupabaseClient
// parameter on every query builder).

export { toCents, formatCents } from './money';
export {
  computeBalanceCents,
  isSettled,
  type OrderLike,
  type AmountLike,
  type PaymentLike,
} from './balance';
export { settle, type PlayerBalance, type Transfer } from './settlement';
export {
  venmoUrls,
  venmoNote,
  venmoTxnFor,
  VENMO_NOTE_PREFIX,
  type VenmoTxn,
  type VenmoUrls,
} from './venmo';
export { formatDate, formatTime } from './format';
export {
  canMake,
  type IngredientLike,
  type StockLike,
  type RecipeLike,
} from './inventory';
// BD-6: generated from the live schema (`supabase gen types typescript`), not
// hand-written — regenerate as part of every phase that changes the schema.
export type { Database, Json } from './database.types';
