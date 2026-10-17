#!/usr/bin/env node
/**
 * Prepare, or check, one of the two marketplace ladder lanes.
 *
 *   node scripts/marketplace-lane.mjs                 # report the lane the checkout is in, and how to run it
 *   node scripts/marketplace-lane.mjs proxied         # prepare the proxied lane
 *   node scripts/marketplace-lane.mjs noproxy         # prepare the no-proxy lane
 *   node scripts/marketplace-lane.mjs proxied --dry-run   # show what would change, change nothing
 *   node scripts/marketplace-lane.mjs --check         # exit 1 when the config and the symlinks disagree
 *
 * Why this exists. A lane is three things that must agree: the `paths.contracts` and `paths.tests` lines in
 * `solidcash.config.ts`, the `.marketplace/project/{src,test/marketplace.test.ts}` symlinks, and - for the
 * proxied lane - a fixture view at `.marketplace/contracts`. Nothing in the repo said how that view is built,
 * and it is not a copy: the two lane projects each vendor their own `@openzeppelin`, and the compiler resolves
 * `./@openzeppelin/contracts/utils/Context.sol` relative to the *importing source*. A copied directory
 * therefore fails with `Cannot resolve import './@openzeppelin/contracts/utils/Context.sol'`; the view is
 * eleven symlinks into the upstream project, which keeps the vendored imports resolvable at the path the
 * fixture publishes. Getting this wrong is silent until the compile, and a half-switched lane (proxied
 * `tests:` beside no-proxy symlinks) is what a previous session left behind.
 *
 * A switch also stamps `.marketplace/lane`, which `scripts/marketplace-fixture-fresh.mjs` reads: the two lanes
 * compile different sources into one `.marketplace/artifacts`, so its timestamp check alone cannot tell whether
 * the artifacts on disk belong to the lane a run is about to measure.
 *
 * The fixture is read from disk, so a lane switch must be followed by a cold recompile before a ladder run:
 *
 *   rm -rf .marketplace/cache node_modules/.experimental-vitest-cache
 *   mkdir -p node_modules/.experimental-vitest-cache
 *   node packages/solidhat/dist/cli.js compile
 *
 * and then, for the lane's own shape (`9 sources -> 19 artifacts` proxied, `22 sources -> 26 artifacts`
 * no-proxy; `scripts/marketplace-fixture-fresh.mjs` refuses a run whose fixture predates the compiler build):
 *
 *   SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144 npx vitest run --config vitest.marketplace.config.ts
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'solidcash.config.ts');
const contractsView = path.join(root, '.marketplace/contracts');
const projectDir = path.join(root, '.marketplace/project');
const laneMarker = path.join(root, '.marketplace/lane');
const EA = '/Code/effectiveacceleration.ai';

/** The fixture view the proxied lane needs, relative to `.marketplace/contracts`. */
const PROXIED_VIEW = [
  'MarketplaceDataV1.sol',
  'MarketplaceV1.sol',
  'libraries/Encoding.sol',
  'unicrow/FakeToken.sol',
  'unicrow/Unicrow.sol',
  'unicrow/UnicrowArbitrator.sol',
  'unicrow/UnicrowClaim.sol',
  'unicrow/UnicrowDispute.sol',
  'unicrow/UnicrowTypes.sol',
  'unicrow/@openzeppelin',
  'unicrow/interfaces',
];

const LANES = {
  proxied: {
    project: `${EA}/contract`,
    contracts: "'.marketplace/contracts'",
    tests: `'${EA}/contract/test'`,
    fixtureView: true,
  },
  noproxy: {
    project: `${EA}/contract-noproxy`,
    contracts: `'${EA}/contract-noproxy/contracts'`,
    tests: `'${EA}/contract-noproxy/test'`,
    fixtureView: false,
  },
};

const rel = (value) => path.relative(root, value) || '.';

/** Reads the two `paths` lines the lane switch owns. Throws when a key is absent or not unique. */
function readConfigPaths() {
  const source = readFileSync(configPath, 'utf8');
  const read = (key) => {
    const matches = [...source.matchAll(new RegExp(`^(\\s*)${key}:\\s*(.*?),\\s*$`, 'gm'))];
    if (matches.length !== 1) throw new Error(`expected exactly one '${key}:' line, found ${matches.length}`);
    return { indent: matches[0][1], value: matches[0][2], line: matches[0][0] };
  };
  return { source, contracts: read('contracts'), tests: read('tests') };
}

/** The lane the config paths name, or undefined when they disagree or name neither lane. */
function laneOf(paths) {
  for (const [name, lane] of Object.entries(LANES)) {
    if (paths.contracts.value === lane.contracts && paths.tests.value === lane.tests) return name;
  }
  return undefined;
}

/** The symlink target of `file`, or undefined when it is absent or not a link. */
function linkTarget(file) {
  try {
    return lstatSync(file).isSymbolicLink() ? readlinkSync(file) : undefined;
  } catch {
    return undefined;
  }
}

function ensureLink(file, target, dryRun, changes) {
  const current = linkTarget(file);
  if (current === target) return;
  const verb = current === undefined
    ? (existsSync(file) ? 'replace non-symlink' : 'create')
    : `repoint (now ${current})`;
  changes.push(`${verb} ${rel(file)} -> ${target}`);
  if (dryRun) return;
  rmSync(file, { recursive: true, force: true });
  mkdirSync(path.dirname(file), { recursive: true });
  symlinkSync(target, file);
}

/** Builds the proxied fixture view, or reports why it cannot be built. */
function prepareFixtureView(dryRun, changes) {
  const upstream = `${LANES.proxied.project}/contracts`;
  const missing = PROXIED_VIEW.filter((entry) => !existsSync(path.join(upstream, entry)));
  if (missing.length > 0) throw new Error(`${upstream} is missing ${missing.join(', ')}`);
  for (const entry of PROXIED_VIEW) {
    ensureLink(path.join(contractsView, entry), path.join(upstream, entry), dryRun, changes);
  }
}

/** Checks one lane's whole state, returning the list of disagreements. */
function checkLane(name) {
  const lane = LANES[name];
  const problems = [];
  if (!existsSync(lane.project)) problems.push(`${lane.project} does not exist`);
  for (const [file, target] of [
    [path.join(projectDir, 'src'), `${lane.project}/src`],
    [path.join(projectDir, 'test/marketplace.test.ts'), `${lane.project}/test/marketplace.test.ts`],
  ]) {
    const current = linkTarget(file);
    if (current !== target) problems.push(`${rel(file)} -> ${current ?? '(absent)'}, want ${target}`);
  }
  if (lane.fixtureView) {
    for (const entry of PROXIED_VIEW) {
      const upstream = path.join(LANES.proxied.project, 'contracts', entry);
      const current = linkTarget(path.join(contractsView, entry));
      if (current !== upstream) problems.push(`${rel(path.join(contractsView, entry))} -> ${current ?? '(absent)'}`);
    }
  }
  return problems;
}

function applyConfig(name, dryRun, changes) {
  const lane = LANES[name];
  const paths = readConfigPaths();
  const lines = [];
  for (const [key, value] of [['contracts', lane.contracts], ['tests', lane.tests]]) {
    const current = paths[key];
    if (current.value === value) continue;
    lines.push({ from: current.line, to: `${current.indent}${key}: ${value},` });
    changes.push(`solidcash.config.ts ${key}: ${current.value} -> ${value}`);
  }
  if (lines.length === 0 || dryRun) return;
  let source = paths.source;
  for (const { from, to } of lines) source = source.replace(from, to);
  writeFileSync(configPath, source);
}

function report() {
  const paths = readConfigPaths();
  const name = laneOf(paths);
  console.log(`checkout lane: ${name ?? 'UNKNOWN (the config lines name no single lane)'}`);
  console.log(`  contracts: ${paths.contracts.value}`);
  console.log(`  tests:     ${paths.tests.value}`);
  console.log(existsSync(laneMarker)
    ? `  last switch: ${readFileSync(laneMarker, 'utf8').trim()} at ${new Date(lstatSync(laneMarker).mtimeMs).toISOString()}`
    : '  last switch: (no stamp; the fixture\'s lane cannot be checked)');
  console.log('');
  console.log('run a lane:');
  console.log('  node scripts/marketplace-lane.mjs <proxied|noproxy>');
  console.log('  rm -rf .marketplace/cache node_modules/.experimental-vitest-cache');
  console.log('  mkdir -p node_modules/.experimental-vitest-cache');
  console.log('  node packages/solidhat/dist/cli.js compile');
  console.log('  SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144 npx vitest run --config vitest.marketplace.config.ts');
  console.log('');
  console.log('run the same lane against patched BCHN:');
  console.log('  scripts/build-bchn-relaxed.sh');
  console.log('  docker compose -f docker-compose.marketplace.yml up -d');
  console.log('  SOLIDCASH_MARKETPLACE_NETWORK=regtest SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144 \\');
  console.log('    npx vitest run --config vitest.marketplace.config.ts');
  const problems = name ? checkLane(name) : [];
  for (const problem of problems) console.log(`  ! ${problem}`);
  return problems.length;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const named = args.filter((arg) => !arg.startsWith('--'));

if (args.includes('--check')) {
  const paths = readConfigPaths();
  const name = laneOf(paths);
  if (name === undefined) {
    console.error('the config names no single lane; run `node scripts/marketplace-lane.mjs <lane>`');
    process.exit(1);
  }
  const problems = checkLane(name);
  for (const problem of problems) console.error(`! ${problem}`);
  console.log(problems.length === 0 ? `the ${name} lane is consistent` : `the ${name} lane is inconsistent`);
  process.exit(problems.length === 0 ? 0 : 1);
} else if (named.length === 1 && LANES[named[0]]) {
  const name = named[0];
  const changes = [];
  if (name === 'proxied') prepareFixtureView(dryRun, changes);
  const lane = LANES[name];
  ensureLink(path.join(projectDir, 'src'), `${lane.project}/src`, dryRun, changes);
  ensureLink(
    path.join(projectDir, 'test/marketplace.test.ts'),
    `${lane.project}/test/marketplace.test.ts`, dryRun, changes,
  );
  applyConfig(name, dryRun, changes);
  // Stamped only on a real switch, so re-preparing the lane it is already in does not invalidate a fresh fixture.
  if (changes.length > 0) {
    changes.push(`stamp ${rel(laneMarker)} with '${name}'`);
    if (!dryRun) {
      mkdirSync(path.dirname(laneMarker), { recursive: true });
      writeFileSync(laneMarker, `${name}\n`);
    }
  }
  for (const change of changes) console.log(`${dryRun ? 'would ' : ''}${change}`);
  if (changes.length === 0) console.log(`${name} lane already prepared`);
  const problems = checkLane(name);
  for (const problem of problems) console.error(`! ${problem}`);
  process.exit(problems.length === 0 ? 0 : 1);
} else if (named.length === 0) {
  process.exit(report() === 0 ? 0 : 1);
} else {
  console.error('usage: node scripts/marketplace-lane.mjs [proxied|noproxy|--check] [--dry-run]');
  process.exit(2);
}
