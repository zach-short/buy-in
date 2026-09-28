// Every variable is read and validated here, once, and passed down (conventions D1).
// Values came from web/.env and backend/.env through `bun --env-file`, so no secret was
// ever copied into this checkout; nothing here prints or writes a value. backend/.env no
// longer exists (phase 10, HANDOFF.md step 29) — see main.ts's USAGE for what running this
// again would require.

export interface ImportEnv {
  mongoUrl: string;
  mongoDatabase: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  publishableKey: string;
  // D6: the settle-up handle moves from this env var onto the bar row at import.
  venmoHandle: string | null;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — pass --env-file for web/.env and a Mongo env file (backend/.env is gone; see main.ts's USAGE)`);
  }
  return value;
}

export function readEnv(): ImportEnv {
  return {
    mongoUrl: required('DATABASE_URL'),
    mongoDatabase: required('DATABASE_NAME'),
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    publishableKey: required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    venmoHandle: process.env.NEXT_PUBLIC_VENMO_HANDLE || null,
  };
}
