// D1 (docs/conventions-typescript.md): read once, here. Link-preview bots resolve a relative
// og:image against metadataBase, so a wrong origin here breaks every card at once — Vercel sets
// VERCEL_PROJECT_PRODUCTION_URL (bare host, no scheme) on every deployment.
function siteOrigin(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : 'http://localhost:3000';
}

export const siteEnv = { origin: siteOrigin() };
