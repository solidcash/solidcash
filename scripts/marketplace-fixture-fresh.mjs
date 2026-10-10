// Fails a marketplace ladder run whose compiled fixture is older than the compiler build it would be measuring.
// The ladder reads `.marketplace/artifacts` off disk, so a compiler change is not measured until the fixture is
// recompiled; set MARKETPLACE_FIXTURE_STALE_OK=1 to run the artifacts as they are.
//
// It also fails a run whose lane was switched after the fixture was compiled. The two lanes compile different
// sources into the same `.marketplace/artifacts` (9 -> 19 proxied, 22 -> 26 no-proxy), so a timestamp alone cannot
// tell whose artifacts are on disk; `scripts/marketplace-lane.mjs` stamps `.marketplace/lane` when it switches, and
// a stamp newer than the oldest artifact means the artifacts belong to the lane we just left.
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILD_DIRS = ['packages/solidc/dist', 'packages/utils/dist', 'packages/solidhat/dist'];
const RECOMPILE = 'node packages/solidhat/dist/cli.js compile';
const LANE_MARKER = '.marketplace/lane';

/** The newest modification time of the `.js` files under `dir`, or 0 when it holds none. */
function newestJs(dir) {
  if (!existsSync(dir)) return 0;
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestJs(full));
    else if (entry.name.endsWith('.js')) newest = Math.max(newest, statSync(full).mtimeMs);
  }
  return newest;
}

/**
 * Compares the oldest compiled artifact with the newest compiler build output under `root`, and with the lane
 * stamp `scripts/marketplace-lane.mjs` writes when it switches lanes. Returns undefined when there are no
 * artifacts yet, otherwise the times it read, which condition makes the fixture untrustworthy, and `stale`.
 */
export function fixtureStaleness(root, buildDirs = BUILD_DIRS) {
  const artifacts = path.join(root, '.marketplace/artifacts/solidcash');
  if (!existsSync(artifacts)) return undefined;
  const times = readdirSync(artifacts).filter((name) => name.endsWith('.json'))
    .map((name) => statSync(path.join(artifacts, name)).mtimeMs);
  if (times.length === 0) return undefined;
  const oldestArtifact = Math.min(...times);
  const newestBuild = Math.max(...buildDirs.map((dir) => newestJs(path.join(root, dir))));
  const marker = path.join(root, LANE_MARKER);
  const laneSwitchedAt = existsSync(marker) ? statSync(marker).mtimeMs : undefined;
  const olderThanBuild = newestBuild > oldestArtifact;
  const laneSwitchedAfterFixture = laneSwitchedAt !== undefined && laneSwitchedAt > oldestArtifact;
  return {
    oldestArtifact, newestBuild, laneSwitchedAt,
    olderThanBuild, laneSwitchedAfterFixture,
    stale: olderThanBuild || laneSwitchedAfterFixture,
  };
}

/** Vitest global setup: refuses to start the ladder on a stale fixture. */
export default function setup() {
  if (process.env.MARKETPLACE_FIXTURE_STALE_OK === '1') return;
  const root = process.env.SOLIDCASH_PROJECT_ROOT ?? path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const found = fixtureStaleness(root);
  if (found === undefined || !found.stale) return;
  const at = (ms) => new Date(ms).toISOString();
  // The lane message wins when both apply: a fixture from the other lane is unusable whatever the compiler did.
  if (found.laneSwitchedAfterFixture) {
    throw new Error(`the lane was switched (${at(found.laneSwitchedAt)}) after the fixture was compiled (oldest `
      + `${at(found.oldestArtifact)}), so the artifacts in .marketplace/artifacts belong to the lane this one just `
      + `replaced: recompile with \`${RECOMPILE}\`, or set MARKETPLACE_FIXTURE_STALE_OK=1 to run them as they are`);
  }
  throw new Error(`the marketplace fixture in .marketplace/artifacts (oldest ${at(found.oldestArtifact)}) is older `
    + `than the compiler build (newest ${at(found.newestBuild)}), so this run would measure stale compiler output: `
    + `recompile it first with \`${RECOMPILE}\` from the worktree root, or set MARKETPLACE_FIXTURE_STALE_OK=1 to `
    + 'run the artifacts as they are');
}
