import { formatArtifact } from '@solidcash/utils';
import { compileString } from 'solidc';
import fs from 'fs';
import { URL } from 'url';

/** True when both artifact outputs exist and are newer than the .scash source. */
function artifactsUpToDate(sourcePath: string, outputs: string[]): boolean {
  if (!fs.existsSync(sourcePath)) return false;
  const sourceMtime = fs.statSync(sourcePath).mtimeMs;
  return outputs.every((out) => fs.existsSync(out) && fs.statSync(out).mtimeMs >= sourceMtime);
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
    const sourcePath = contractFile.pathname;
    const jsonPath = jsonOutputFile.pathname;
    const tsPath = tsOutputFile.pathname;

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
