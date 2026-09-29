import { createClient, type User } from "@supabase/supabase-js";

const target = process.argv[2]?.toLowerCase();
const confirm = process.argv.includes("--confirm");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!target || !url || !key) {
  console.error(
    "usage: bun scripts/delete-user.ts <email|user-id> [--confirm]  (needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)",
  );
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(target);

let found: User | undefined;
if (isId) {
  const { data, error } = await admin.auth.admin.getUserById(target);
  if (error) throw error;
  found = data.user ?? undefined;
} else {
  for (let page = 1; !found; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (data.users.length < 200) break;
  }
}

if (!found) {
  console.log(`no user matching ${target}`);
  process.exit(0);
}

console.log(`found ${found.email} id=${found.id} created=${found.created_at}`);
if (!confirm) {
  console.log("dry run. re-run with --confirm to delete.");
  process.exit(0);
}

const { error } = await admin.auth.admin.deleteUser(found.id);
if (error) throw error;
console.log("deleted");
