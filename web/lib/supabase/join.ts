import { isAuthRetryableFetchError, type User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

// A member reaches a table only through an invite link or code — there is deliberately no
// directory to browse, so a bar's name is never discoverable (owner). Joining makes a claimed
// `players` row, never a `bar_members` row: a 'player'-role member would read every other
// player's phone and Venmo under the current RLS (DESIGN.md D16).

export type SignInCheck =
  | { status: 'signed-in'; user: User }
  | { status: 'signed-out' }
  | { status: 'unreachable' };

export type JoinFailure = 'invalid-invite' | 'name-taken' | 'unreachable';

export type JoinResult = { ok: true; playerId: string } | { ok: false; reason: JoinFailure };

/** Whether the visitor is signed in, asked of the auth server rather than the cached session. */
export async function checkSignIn(): Promise<SignInCheck> {
  const { data, error } = await createClient().auth.getUser();
  if (data.user) return { status: 'signed-in', user: data.user };
  // A dropped connection must not read as signed out, or a signed-in member is bounced to /login.
  return isAuthRetryableFetchError(error) ? { status: 'unreachable' } : { status: 'signed-out' };
}

/** Joins the bar behind an invite token as a claimed player. Safe to repeat: the RPC is idempotent. */
export async function joinBarAsPlayer(token: string, name: string): Promise<JoinResult> {
  const { data, error } = await createClient().rpc('join_bar_as_player', { p_token: token, p_name: name });
  if (!error) return { ok: true, playerId: data };
  return { ok: false, reason: classifyJoinError(error.code) };
}

// Only Postgres sets a code; postgrest-js reports a transport failure with ''. Every raise in the
// RPC — unknown, expired or revoked token — is one message, so the page never tells them apart.
function classifyJoinError(code: string): JoinFailure {
  if (!code) return 'unreachable';
  return code === '23505' ? 'name-taken' : 'invalid-invite';
}

/** The name the member gave on /welcome (or Google's), as a starting point they can edit. */
export function displayNameOf(user: User): string {
  // auth-js types user_metadata as { [key: string]: any }; narrow it rather than trust it (T1).
  const fullName: unknown = user.user_metadata.full_name;
  return typeof fullName === 'string' ? fullName.trim() : '';
}

/** Sign-in or sign-up, returning to `returnTo` afterwards. The whole path rides inside `redirect`, query and all. */
export function loginPath(returnTo: string): string {
  return `/login?${new URLSearchParams({ redirect: returnTo })}`;
}
