// @pb/core — shared between web/ and native/.
// Nothing here may import from `next`, `react-native`, or touch `window`/`document`.
// Platform-specific behaviour is injected by the caller (see the SupabaseClient
// parameter on every query builder).

export { toCents, formatCents, centsToDollars } from './money';
export {
  computeBalanceCents,
  isSettled,
  type OrderLike,
  type AmountLike,
  type PaymentLike,
} from './balance';
export { settle, type PlayerBalance, type Transfer } from './settlement';
export { leaveTableVerdict, type LeaveTableVerdict } from './leave-table';
export {
  venmoUrls,
  venmoNote,
  venmoTxnFor,
  VENMO_NOTE_PREFIX,
  type VenmoTxn,
  type VenmoUrls,
} from './venmo';
export {
  renderVenmoNote,
  DEFAULT_VENMO_NOTE,
  VENMO_NOTE_TEMPLATE_MAX_LENGTH,
  type VenmoNoteVars,
} from './venmo-note';
export { formatDate, formatTime } from './format';
export { writeErrorMessage, type WriteErrorLike } from './write-errors';
export {
  parseSharedTab,
  parseMenu,
  requireScope,
  type SharedTab,
  type SharedTabScope,
  type MenuItem,
} from './shared-tab';
export {
  canMake,
  type IngredientLike,
  type StockLike,
  type RecipeLike,
} from './inventory';
// BD-6: generated from the live schema (`supabase gen types typescript`), not
// hand-written — regenerate as part of every phase that changes the schema.
export type { Database, Json, Tables } from './database.types';
