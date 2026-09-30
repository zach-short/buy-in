// @pb/core — shared between web/ and native/.
// Nothing here may import from `next`, `react-native`, or touch `window`/`document`.
// Platform-specific behaviour is injected by the caller (see the SupabaseClient
// parameter on every query builder).

export { toCents, formatCents, centsToDollars } from './money';
export {
  computeBalanceCents,
  balancesByPlayer,
  isSettled,
  type OrderLike,
  type AmountLike,
  type PaymentLike,
} from './balance';
export {
  nightNet,
  describeNet,
  type NightRows,
  type NightNet,
  type NetKind,
  type NetDisplay,
} from './night-net';
export { settle, type PlayerBalance, type Transfer } from './settlement';
export { leaveTableVerdict, type LeaveTableVerdict } from './leave-table';
export {
  tableRecords,
  withNextGames,
  type SeatLike,
  type PlayedLike,
  type TableRecord,
  type NextGameLike,
  type NextGame,
  type RsvpAnswer,
  type TableWithGame,
} from './table-record';
export {
  resultsFromPerformance,
  resultsFromLogged,
  mergeResults,
  filterResults,
  centsPerHour,
  formatBlinds,
  hoursToMinutes,
  playedOnFromLocalDate,
  type ResultSource,
  type SourceFilter,
  type PerformanceLike,
  type LoggedLike,
  type HomeResult,
  type LoggedResult,
  type PokerResult,
  type HoursParse,
} from './logged-session';
export {
  POKER_TYPE,
  EVENT_SLUG,
  EVENT_TYPES,
  eventType,
  typeLabel,
  searchEventTypes,
  parseEventDetails,
  parseAmericanOdds,
  type EventType,
  type EventDetails,
  type ExtraField,
  type ExtraKind,
  type TypeOption,
  type OddsParse,
} from './event-types';
export {
  eventNetCents,
  eventDetail,
  rowsFromEvents,
  rowsFromPoker,
  mergeEverything,
  filterByType,
  typeChips,
  breakdownByType,
  type EventLike,
  type EverythingRow,
  type TypeTotal,
} from './event-result';
export { featureVisibility, type DrinkSettings, type FeatureVisibility } from './host-features';
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
export {
  GENERATED_CODE_LENGTHS,
  normalizeInviteCode,
  isValidCustomCode,
  isInviteToken,
  hasCode,
  codeStatus,
  inviteShareText,
  type InviteKind,
  type CodeStatus,
  type GeneratedCodeLength,
} from './invite-code';
