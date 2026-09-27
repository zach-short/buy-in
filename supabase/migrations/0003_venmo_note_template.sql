-- 0003 — the host sets the Venmo note (2026-09-27).
--
-- Owner decision, 2026-09-27, superseding DESIGN.md D12's fixed constant
-- (`Buy-In — <session name>`): the default note is plain `Buy-In`, and a host may set a
-- template of their own. Owner's words: "Just Buy In but a user should be able to
-- adjust what the default note says including a {{amount}} tag if that makes sense.
-- But I don't want to show the balance by default in a venmo note." The template is
-- rendered client-side by @pb/core's renderVenmoNote (packages/core/src/venmo-note.ts);
-- null means the default, and the amount appears only if the host's template contains
-- {{amount}}. Nothing here stores or computes a note — only the host's template.
--
-- Why it is a column on `bars`: it is a property of how the venue asks to be paid, the
-- same reasoning D6 gave for venmo_handle. Hosts edit it under the existing
-- bars_owner_write policy (0001), which admits `owner_id = auth.uid()` for update — no
-- new policy.
--
-- Why get_shared_tab is replaced: the receipt and portal pages are anonymous and read
-- only through that security-definer RPC (D8, D15), so the template must travel in its
-- `bar` object or those pages can never render the host's note. The body below is 0001's
-- verbatim except `create or replace` and the one added `venmo_note_template` key.

alter table bars add column venmo_note_template text;

-- 120 characters: Venmo notes are short, and the check keeps a runaway paste out of every
-- receipt. Mirrored by VENMO_NOTE_TEMPLATE_MAX_LENGTH in packages/core/src/venmo-note.ts.
alter table bars add constraint bars_venmo_note_template_len
  check (char_length(venmo_note_template) <= 120);

-- ── get_shared_tab ───────────────────────────────────────────────────────────
-- Unchanged from 0001 (see its comment there for D15's scope and projection rules)
-- except that `bar` now carries venmo_note_template. The template is the host's own
-- chosen wording for a payment request the page already exists to make, so exposing it
-- to a token holder reveals nothing D15 withholds.

create or replace function get_shared_tab(p_token text) returns jsonb
  language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_link   player_share_links%rowtype;
  v_player players%rowtype;
  v_bar    bars%rowtype;
begin
  select * into v_link from player_share_links where token = p_token;
  if not found or v_link.revoked_at is not null
     or (v_link.expires_at is not null and v_link.expires_at < now()) then
    -- One message and one errcode for missing, revoked and expired alike: three
    -- distinguishable errors would be an oracle for which tokens ever existed.
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  select * into v_player from players where id = v_link.player_id;
  -- Defence in depth. The composite foreign key on (player_id, bar_id) already
  -- makes this impossible; if it ever becomes possible, fail rather than serve a
  -- player from another bar.
  if not found or v_player.bar_id <> v_link.bar_id then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  select * into v_bar from bars where id = v_link.bar_id;

  return jsonb_build_object(
    'scope', case when v_link.session_id is null then 'portal' else 'session' end,
    -- venmo_handle is the HOST's, and is the one payment detail these pages exist
    -- to show (D6). The player's own venmo is deliberately not returned.
    'bar', jsonb_build_object('id', v_bar.id, 'name', v_bar.name,
                              'venmo_handle', v_bar.venmo_handle,
                              'cashapp_handle', v_bar.cashapp_handle,
                              'venmo_note_template', v_bar.venmo_note_template),
    'player', jsonb_build_object('id', v_player.id, 'name', v_player.name),
    'sessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name, 'played_on', s.played_on,
               'status', s.status, 'settle_mode', s.settle_mode
             ) order by s.played_on desc), '[]'::jsonb)
        from sessions s
       where s.bar_id = v_link.bar_id
         and (v_link.session_id is null or s.id = v_link.session_id)
         and exists (select 1 from session_players sp
                      where sp.session_id = s.id and sp.player_id = v_player.id)
    ),
    'orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'session_id', o.session_id, 'drink_name', o.drink_name,
               'price_cents', o.price_cents, 'paid', o.paid, 'created_at', o.created_at
             ) order by o.created_at desc), '[]'::jsonb)
        from orders o
       where o.player_id = v_player.id
         and (v_link.session_id is null or o.session_id = v_link.session_id)
    ),
    'buy_ins', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id, 'session_id', b.session_id,
               'amount_cents', b.amount_cents, 'created_at', b.created_at
             ) order by b.created_at), '[]'::jsonb)
        from buy_ins b
       where b.player_id = v_player.id
         and (v_link.session_id is null or b.session_id = v_link.session_id)
    ),
    'cashouts', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'session_id', c.session_id,
               'amount_cents', c.amount_cents, 'created_at', c.created_at
             ) order by c.created_at), '[]'::jsonb)
        from cashouts c
       where c.player_id = v_player.id
         and (v_link.session_id is null or c.session_id = v_link.session_id)
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'session_id', p.session_id, 'amount_cents', p.amount_cents,
               'direction', p.direction, 'created_at', p.created_at
             ) order by p.created_at desc), '[]'::jsonb)
        from payments p
       where p.player_id = v_player.id
         and (v_link.session_id is null or p.session_id = v_link.session_id)
    )
  );
end;
$$;

-- Re-stated exactly as 0001 does. `create or replace` keeps existing grants, but stating
-- them here means this file alone is the whole truth about the function's privileges.
revoke all on function get_shared_tab(text) from public, anon, authenticated;
grant execute on function get_shared_tab(text) to anon, authenticated;
