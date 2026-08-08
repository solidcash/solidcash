import { formatArtifact } from '@solidcash/utils';
import { compileString } from 'solidc';
import fs from 'fs';
import { createRequire } from 'module';
import { URL, fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);

/** Newest mtime of any file under dir (recursive). Returns 0 if dir missing/empty. */
function newestMtimeUnder(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let newest = 0;
  const walk = (d: string): void => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        walk(p);
      } else if (ent.isFile()) {
        newest = Math.max(newest, fs.statSync(p).mtimeMs);
      }
    }
  };
  walk(dir);
  return newest;
}

/**
 * Newest mtime among inputs that can change emitted artifacts without the .scash
 * source changing: the .scash itself, and every file under solidc / @solidcash/utils
 * package roots that affect compilation (package.json + dist tree). Nested dist
 * files (e.g. dist/compiler.js) can update under incremental tsc without touching
 * dist/index.js — walking the tree catches those rebuilds.
 */
function newestDependencyMtime(sourcePath: string): number {
  let newest = fs.statSync(sourcePath).mtimeMs;
  for (const pkg of ['solidc', '@solidcash/utils']) {
    try {
      const pkgJson = require.resolve(`${pkg}/package.json`);
      const pkgRoot = path.dirname(pkgJson);
      newest = Math.max(newest, fs.statSync(pkgJson).mtimeMs);
      newest = Math.max(newest, newestMtimeUnder(path.join(pkgRoot, 'dist')));
    } catch {
      // Package not resolvable — force recompile by treating dep mtime as now.
      newest = Date.now();
    }
  }
  return newest;
}

/** True when both artifact outputs exist and are newer than sources + compiler. */
function artifactsUpToDate(sourcePath: string, outputs: string[]): boolean {
  if (!fs.existsSync(sourcePath)) return false;
  const depMtime = newestDependencyMtime(sourcePath);
  return outputs.every((out) => fs.existsSync(out) && fs.statSync(out).mtimeMs >= depMtime);
}

export const compile = (): void => {
  const directory = new URL('../contracts', import.meta.url);
  const result = fs.readdirSync(directory)
    .filter((fn) => fn.endsWith('.scash'));

  fs.mkdirSync(new URL('../artifacts', import.meta.url), { recursive: true });

  result.forEach((fn) => {
    const contractFile = new URL(fn, `${directory}/`);
    const jsonOutputFile = new URL(`../artifacts/${fn.replace('.scash', '.json')}`, import.meta.url);
    const tsOutputFile = new URL(`../artifacts/${fn.replace('.scash', '.artifact.ts')}`, import.meta.url);
    const sourcePath = fileURLToPath(contractFile);
    const jsonPath = fileURLToPath(jsonOutputFile);
    const tsPath = fileURLToPath(tsOutputFile);

    if (artifactsUpToDate(sourcePath, [jsonPath, tsPath])) {
      console.log(`Up-to-date ${fn}`);
      return;
    }

    try {
      const contents = fs.readFileSync(contractFile, { encoding: 'utf-8' });
      const artifact = compileString(contents);

      fs.writeFileSync(jsonOutputFile, formatArtifact(artifact, 'json'));
      fs.writeFileSync(tsOutputFile, formatArtifact(artifact, 'ts'));
    } catch (error: any) {
      console.error(`Error compiling ${fn}: ${error.message}`);
      return;
    }

    console.log(`Successfully compiled ${fn}`);
  });
};

compile();
