// Fails a marketplace ladder run whose compiled fixture is older than the compiler build it would be measuring.
// The ladder reads `.marketplace/artifacts` off disk, so a compiler change is not measured until the fixture is
// recompiled; set MARKETPLACE_FIXTURE_STALE_OK=1 to run the artifacts as they are.
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILD_DIRS = ['packages/solidc/dist', 'packages/utils/dist', 'packages/solidhat/dist'];
const RECOMPILE = 'node packages/solidhat/dist/cli.js compile';

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
 * Compares the oldest compiled artifact with the newest compiler build output under `root`. Returns undefined when
 * there are no artifacts yet, otherwise the two times and whether the artifacts are stale.
 */
export function fixtureStaleness(root, buildDirs = BUILD_DIRS) {
  const artifacts = path.join(root, '.marketplace/artifacts/solidcash');
  if (!existsSync(artifacts)) return undefined;
  const times = readdirSync(artifacts).filter((name) => name.endsWith('.json'))
    .map((name) => statSync(path.join(artifacts, name)).mtimeMs);
  if (times.length === 0) return undefined;
  const oldestArtifact = Math.min(...times);
  const newestBuild = Math.max(...buildDirs.map((dir) => newestJs(path.join(root, dir))));
  return { oldestArtifact, newestBuild, stale: newestBuild > oldestArtifact };
}

/** Vitest global setup: refuses to start the ladder on a stale fixture. */
export default function setup() {
  if (process.env.MARKETPLACE_FIXTURE_STALE_OK === '1') return;
  const root = process.env.SOLIDCASH_PROJECT_ROOT ?? path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const found = fixtureStaleness(root);
  if (found === undefined || !found.stale) return;
  const at = (ms) => new Date(ms).toISOString();
  throw new Error(`the marketplace fixture in .marketplace/artifacts (oldest ${at(found.oldestArtifact)}) is older `
    + `than the compiler build (newest ${at(found.newestBuild)}), so this run would measure stale compiler output: `
    + `recompile it first with \`${RECOMPILE}\` from the worktree root, or set MARKETPLACE_FIXTURE_STALE_OK=1 to `
    + 'run the artifacts as they are');
}
