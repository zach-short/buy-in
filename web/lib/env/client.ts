// D1 (docs/conventions-typescript.md): the environment is read and validated once, here, and
// passed down — never read inline in app code. Each NEXT_PUBLIC_ name is written out literally
// because Next inlines them into the browser bundle by exact text match; a computed
// `process.env[name]` would read undefined in the browser.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set — see web/.env.example`);
  }
  return value;
}

export const clientEnv = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};
