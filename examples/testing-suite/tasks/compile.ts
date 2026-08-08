import { formatArtifact } from '@solidcash/utils';
import { compileString } from 'solidc';
import fs from 'fs';
import { createRequire } from 'module';
import { URL, fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);

/**
 * Newest mtime among inputs that can change emitted artifacts without the .scash
 * source changing: the .scash itself, and the solidc / @solidcash/utils package
 * entrypoints (so a compiler rebuild invalidates stale example artifacts).
 */
function newestDependencyMtime(sourcePath: string): number {
  let newest = fs.statSync(sourcePath).mtimeMs;
  for (const pkg of ['solidc', '@solidcash/utils']) {
    try {
      const pkgJson = require.resolve(`${pkg}/package.json`);
      const mainRel = (JSON.parse(fs.readFileSync(pkgJson, 'utf-8')) as { main?: string }).main
        ?? 'dist/index.js';
      const mainPath = path.resolve(path.dirname(pkgJson), mainRel);
      if (fs.existsSync(mainPath)) {
        newest = Math.max(newest, fs.statSync(mainPath).mtimeMs);
      }
      newest = Math.max(newest, fs.statSync(pkgJson).mtimeMs);
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
