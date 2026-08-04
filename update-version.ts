import { spawnSync } from 'child_process';
import fs from 'fs';
import semver from 'semver';
import { URL } from 'url';

// USAGE:
// $ yarn run update-version 'X.X.X'

const version = process.argv[2];
if (!version || !semver.valid(version)) throw new Error(`Expected a valid release version, received: ${version}`);
const result = spawnSync('yarn', [
  'lerna', 'version', '--no-push', '--no-git-tag-version', '--force-publish', '--yes', version,
], { stdio: 'inherit' });
if (result.status !== 0) throw new Error(`lerna version failed with exit code ${result.status}`);

const indexFilePath = new URL('packages/solidc/src/index.ts', import.meta.url);
const data = fs.readFileSync(indexFilePath, 'utf8');
const updatedData = data.replace(/export const version = .*\n/, `export const version = '${version}';\n`);
fs.writeFileSync(indexFilePath, updatedData);
