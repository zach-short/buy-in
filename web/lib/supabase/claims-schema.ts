import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

// TEMPORARY, and the only reason this file exists: `supabase/migrations/0008_player_claim_requests.sql`
// is written but unapplied, so the generated `Database` type in @pb/core (BD-6) does not know
// its table or functions yet, and PASSOFF item 17 forbids hand-editing generated output. This
// overlay declares 0008's shapes in the generator's own form so the claim calls typecheck
// against *this declaration* — which proves the call sites agree with it, not that it agrees
// with the database. When the owner applies 0008 and regenerates `database.types.ts`, delete
// this file and swap `claimsClient()` for `createClient()` in claims.ts; the typecheck will then
// test the call sites against the real schema.

type ClaimRequestRow = {
  id: string;
  bar_id: string;
  player_id: string;
  user_id: string;
  requester_email: string | null;
  requester_name: string | null;
  // text with a check constraint, which the generator emits as `string`; claims.ts narrows it.
  status: string;
  created_at: string;
  decided_at: string | null;
};

type ClaimsSchema = {
  Tables: {
    player_claim_requests: {
      Row: ClaimRequestRow;
      Insert: Partial<ClaimRequestRow> & Pick<ClaimRequestRow, 'bar_id' | 'player_id' | 'user_id'>;
      Update: Partial<ClaimRequestRow>;
      Relationships: [
        {
          foreignKeyName: 'player_claim_requests_player_id_bar_id_fkey';
          columns: ['player_id', 'bar_id'];
          isOneToOne: false;
          referencedRelation: 'players';
          referencedColumns: ['id', 'bar_id'];
        },
      ];
    };
  };
  Functions: {
    list_claimable_players: {
      Args: { p_token: string };
      Returns: { id: string; name: string; has_pending_request: boolean }[];
    };
    request_player_claim: { Args: { p_token: string; p_player_id: string }; Returns: string };
    decide_player_claim: { Args: { p_request_id: string; p_approve: boolean }; Returns: string };
    unlink_player: { Args: { p_player_id: string }; Returns: undefined };
    swap_player_accounts: { Args: { p_a: string; p_b: string }; Returns: undefined };
    reassign_player_account: { Args: { p_from: string; p_to: string }; Returns: undefined };
  };
};

type Public = Database['public'];

export type ClaimsDatabase = Omit<Database, 'public'> & {
  public: Omit<Public, 'Tables' | 'Functions'> & {
    Tables: Public['Tables'] & ClaimsSchema['Tables'];
    Functions: Public['Functions'] & ClaimsSchema['Functions'];
  };
};

/** The one browser client (BD-5), typed with 0008's overlay until the types are regenerated. */
export function claimsClient(): SupabaseClient<ClaimsDatabase> {
  return createClient() as SupabaseClient<ClaimsDatabase>;
}
