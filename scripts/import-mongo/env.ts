// Every variable is read and validated here, once, and passed down (conventions D1).
// Values come from web/.env and backend/.env through `bun --env-file`, so no secret is
// ever copied into this checkout; nothing here prints or writes a value.

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
    throw new Error(`${name} is not set — pass --env-file for both web/.env and backend/.env`);
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
