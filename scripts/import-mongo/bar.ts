import { check, type Db } from './supabase';

export interface BarTarget {
  ownerId: string;
  name: string;
  venmoHandle: string | null;
}

export async function assertOwnerExists(sb: Db, ownerId: string): Promise<void> {
  const { data, error } = await sb.auth.admin.getUserById(ownerId);
  if (error || !data.user) throw new Error(`owner ${ownerId} is not an auth user in this project`);
  console.log(`  owner: auth user found, email confirmed: ${Boolean(data.user.email_confirmed_at)}`);
}

/** The owner's bar, if the import has run before. More than one is ambiguous, so it stops. */
export async function findBar(sb: Db, ownerId: string): Promise<string | null> {
  const { data, error } = await sb.from('bars').select('id').eq('owner_id', ownerId);
  check(error, 'reading bars');
  const bars = data ?? [];
  if (bars.length > 1) throw new Error(`owner owns ${bars.length} bars; refusing to guess which one to load`);
  return bars[0]?.id ?? null;
}

// BD-1 names create_bar() as the one way a bar is born, but it cannot run here: it
// authorizes by auth.uid() (0001_init.sql:481-487), and a service-role request has no
// user — against dev on 2026-09-25 the call returned 403 / 42501 "create_bar requires
// an authenticated user" and wrote nothing. So the bar is inserted with the service role,
// and the owner's membership comes from the trigger create_bar itself relies on
// (bars_owner_membership, 0001_init.sql:456-473), in the same statement. What BD-1
// protects — no bar without its owner's membership — is asserted after the insert.
// Reversal: sign in as the owner and call rpc('create_bar') here instead.
async function insertBar(sb: Db, target: BarTarget): Promise<string> {
  const { data, error } = await sb
    .from('bars')
    .insert({ name: target.name, owner_id: target.ownerId, venmo_handle: target.venmoHandle })
    .select('id')
    .single();
  check(error, 'creating the bar');
  if (!data) throw new Error('creating the bar returned no row');
  return data.id;
}

// Reached only on the replace plan (--force), the overwrite the operator asked for:
// without it the guard has already proved the row holds these values, so nothing is
// written. It used to run before any check, and so reset a name or handle set in the
// app — to NULL whenever NEXT_PUBLIC_VENMO_HANDLE happened to be unset.
async function updateBar(sb: Db, barId: string, target: BarTarget): Promise<void> {
  const { error } = await sb.from('bars').update({ name: target.name, venmo_handle: target.venmoHandle }).eq('id', barId);
  check(error, 'updating the bar');
}

async function assertOwnerMembership(sb: Db, barId: string, ownerId: string): Promise<void> {
  const { data, error } = await sb.from('bar_members').select('role').eq('bar_id', barId).eq('user_id', ownerId);
  check(error, 'reading bar_members');
  if (data?.[0]?.role !== 'owner') throw new Error('the bar exists without an owner membership row — BD-1 invariant broken');
  console.log("  bar_members: owner row present with role 'owner'");
}

export async function createBar(sb: Db, target: BarTarget): Promise<string> {
  const barId = await insertBar(sb, target);
  console.log(`  bar: created ${barId}`);
  await assertOwnerMembership(sb, barId, target.ownerId);
  return barId;
}

/** An existing bar the guard passed as it is (load or keep): nothing is written to it. */
export async function reuseBar(sb: Db, barId: string, ownerId: string): Promise<string> {
  console.log(`  bar: reused ${barId}`);
  await assertOwnerMembership(sb, barId, ownerId);
  return barId;
}

/** --force only: sets the bar row to this run's name and handle, then reuses it. */
export async function convergeBar(sb: Db, barId: string, target: BarTarget): Promise<string> {
  await updateBar(sb, barId, target);
  return reuseBar(sb, barId, target.ownerId);
}
