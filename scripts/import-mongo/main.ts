import { parseArgs } from 'node:util';

import { assertOwnerExists, convergeBar, createBar, findBar, reuseBar, type BarTarget } from './bar';
import { guardBar } from './drift';
import { readEnv, type ImportEnv } from './env';
import { writeBar, type Plan } from './load';
import { preflight, printFindings } from './preflight';
import { takeSnapshot, writeSnapshot } from './snapshot';
import { COLLECTIONS, readMongo, withMongo, type MongoSource } from './source';
import { anonClient, check, projectRef, serviceClient, type Db } from './supabase';
import { buildRows, type ImportRows } from './transform';
import { verifyAll, type VerifyContext } from './verify';

const USAGE = `Mongo -> Supabase import (DESIGN.md D9, PLAN.md phase 8).

Run from the repo root; both env files are read at runtime, never copied:
  bun --env-file=web/.env --env-file=backend/.env scripts/import-mongo/main.ts <command> [options]

Commands
  ping        Mongo ping and per-collection counts; Supabase reachability. Writes nothing.
  preflight   Read Mongo, build every row in memory, report findings. Writes nothing.
  import      Load the owner's bar from Mongo, then verify. A new or empty bar is loaded and
              nothing is deleted; a bar already exactly what this import writes is left as
              it is. Any other bar is refused: every difference is listed and the run stops
              before its first write.
  verify      Verify an imported bar against Mongo. Its temporary links and probes are
              removed before it exits.

Options for import and verify
  --ref <project-ref>     required; must match NEXT_PUBLIC_SUPABASE_URL's project
  --owner <auth-user-id>  required; the bar owner's auth.users id (D9)
  --bar-name <name>       bar name to create, or converge an existing bar to (default "Buy-In")
  --snapshot <file>       write every row in the bar to <file> after verifying, with per-table
                          hashes; holds real PII, so keep it outside the repo
  --skip-verify           import only
  --force                 import only: clear and reload even though the bar differs from what
                          this import writes; the only way the import deletes anything.
                          DESTRUCTIVE: deletes every row the app added
                          (orders, sessions, share and claim links, ...), puts back every
                          imported row the app deleted, and reverts every edit and claim
                          and the bar's name and payment handle. Read the list first.
`;

interface Options {
  ref: string | undefined;
  owner: string | undefined;
  barName: string;
  snapshot: string | undefined;
  skipVerify: boolean;
  force: boolean;
}

function parseOptions(argv: string[]): { command: string | undefined; options: Options } {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      ref: { type: 'string' },
      owner: { type: 'string' },
      'bar-name': { type: 'string', default: 'Buy-In' },
      snapshot: { type: 'string' },
      'skip-verify': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
  });
  return {
    command: positionals[0],
    options: {
      ref: values.ref,
      owner: values.owner,
      barName: values['bar-name'] ?? 'Buy-In',
      snapshot: values.snapshot,
      skipVerify: values['skip-verify'] ?? false,
      force: values.force ?? false,
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GATE 0 found this repo's Supabase config pointed at another project's production
// database. So the operator names the project they mean to write, and a mismatch with
// the env stops the run before it reads or writes anything.
function requireTarget(env: ImportEnv, options: Options): { owner: string } {
  if (!options.ref || !options.owner) throw new Error('import and verify need --ref and --owner');
  if (options.ref !== projectRef(env)) throw new Error(`--ref ${options.ref} does not match the configured project ${projectRef(env)}`);
  if (!UUID.test(options.owner)) throw new Error('--owner must be an auth.users uuid');
  return { owner: options.owner };
}

async function ping(env: ImportEnv): Promise<number> {
  await withMongo(env, async (client) => {
    await client.db('admin').command({ ping: 1 });
    const db = client.db(env.mongoDatabase);
    for (const name of COLLECTIONS) console.log(`  mongo ${name}: ${await db.collection(name).estimatedDocumentCount()}`);
  });
  const { count, error } = await serviceClient(env).from('bars').select('id', { count: 'exact', head: true });
  check(error, 'reaching Supabase');
  console.log(`  supabase ${projectRef(env)}: reachable, bars ${count ?? 0}`);
  return 0;
}

async function loadSource(env: ImportEnv): Promise<MongoSource> {
  const s = await readMongo(env);
  console.log(`source: players ${s.players.length}, sessions ${s.sessions.length}, orders ${s.orders.length}, buy-ins ${s.buyIns.length}, cash-outs ${s.cashouts.length}, payments ${s.payments.length}, drinks ${s.drinks.length}, inventory ${s.inventory.length}`);
  return s;
}

function printRowCounts(rows: ImportRows): void {
  const counts = Object.entries(rows).map(([table, list]) => `${table} ${list.length}`);
  console.log(`rows built: ${counts.join(', ')}`);
}

function passesPreflight(source: MongoSource): boolean {
  console.log('preflight:');
  return printFindings(preflight(source));
}

// A dry build needs some bar id; this one is never written anywhere.
const DRY_RUN_BAR = '00000000-0000-0000-0000-000000000000';

async function runPreflight(env: ImportEnv): Promise<number> {
  const source = await loadSource(env);
  const clean = passesPreflight(source);
  printRowCounts(buildRows(source, DRY_RUN_BAR));
  console.log(`preflight: ${clean ? 'no blocking findings' : 'BLOCKED — see [BLOCK] lines'}`);
  return clean ? 0 : 1;
}

async function finish(options: Options, ctx: VerifyContext): Promise<number> {
  const ok = options.skipVerify || (await verifyAll(ctx));
  if (options.snapshot) {
    console.log('snapshot:');
    writeSnapshot(options.snapshot, await takeSnapshot(ctx.sb, ctx.barId));
  }
  return ok ? 0 : 1;
}

interface OpenBar {
  barId: string;
  plan: Plan;
}

// The bar to write and how, or null if the guard refused it. An existing bar is compared
// with this run's rows before anything touches it, the bar row included; a bar this run
// creates is empty by construction, so it is loaded unguarded — which is safe only
// because the load plan deletes nothing (B1: a wrong --owner lands here).
async function openBar(sb: Db, source: MongoSource, target: BarTarget, force: boolean): Promise<OpenBar | null> {
  await assertOwnerExists(sb, target.ownerId);
  const existing = await findBar(sb, target.ownerId);
  if (!existing) return { barId: await createBar(sb, target), plan: 'load' };
  const plan = await guardBar(sb, existing, buildRows(source, existing), target, force);
  if (!plan) return null;
  const barId = plan === 'replace' ? await convergeBar(sb, existing, target) : await reuseBar(sb, existing, target.ownerId);
  return { barId, plan };
}

async function runImport(env: ImportEnv, options: Options): Promise<number> {
  const { owner } = requireTarget(env, options);
  const importStartedAt = Date.now();
  const source = await loadSource(env);
  if (!passesPreflight(source)) {
    console.log('import: stopped before any write — the blocking findings above are the owner\'s to resolve');
    return 1;
  }
  const sb = serviceClient(env);
  console.log('bar:');
  const bar = await openBar(sb, source, { ownerId: owner, name: options.barName, venmoHandle: env.venmoHandle }, options.force);
  if (!bar) return 1;
  const rows = buildRows(source, bar.barId);
  await writeBar(sb, bar.barId, bar.plan, rows);
  return finish(options, { sb, anon: anonClient(env), barId: bar.barId, source, rows, importStartedAt });
}

async function runVerify(env: ImportEnv, options: Options): Promise<number> {
  const { owner } = requireTarget(env, options);
  const source = await loadSource(env);
  const sb = serviceClient(env);
  const barId = await findBar(sb, owner);
  if (!barId) throw new Error('the owner has no bar yet — run import first');
  return finish(options, { sb, anon: anonClient(env), barId, source, rows: buildRows(source, barId), importStartedAt: Date.now() });
}

async function main(argv: string[]): Promise<number> {
  const { command, options } = parseOptions(argv);
  if (command === undefined || command === 'help') {
    console.log(USAGE);
    return command === undefined ? 1 : 0;
  }
  const env = readEnv();
  if (command === 'ping') return ping(env);
  if (command === 'preflight') return runPreflight(env);
  if (command === 'import') return runImport(env, options);
  if (command === 'verify') return runVerify(env, options);
  console.log(USAGE);
  return 1;
}

// A driver error can quote the connection string; strip it before anything is printed.
function redact(message: string): string {
  return message.replace(/mongodb(\+srv)?:\/\/\S+/g, '<mongo-uri>');
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`FAILED: ${redact(error instanceof Error ? error.message : String(error))}`);
    process.exit(1);
  },
);
