// @pb/core — shared between web/ and native/.
// Nothing here may import from `next`, `react-native`, or touch `window`/`document`.
// Platform-specific behaviour is injected by the caller (see the SupabaseClient
// parameter on every query builder).

export {};
