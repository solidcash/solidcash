/**
 * Regenerate `packages/solidcash/src/stateful/defaultProxyArtifact.ts` from its own `DEFAULT_PROXY_SOURCE`.
 *
 * The SDK ships the compiled proxy so it needs no compiler at runtime, which means any codegen change leaves it
 * stale until it is rebuilt. See packages/solidc/docs/upgrades.md "Regenerating the default proxy artifact" -
 * the header comment and the source constant are preserved verbatim, and no manual edit follows.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileString } from '../packages/solidc/src/index.js';
import { DEFAULT_PROXY_SOURCE } from '../packages/solidcash/src/stateful/defaultProxyArtifact.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(here, '../packages/solidcash/src/stateful/defaultProxyArtifact.ts');

const artifact = compileString(DEFAULT_PROXY_SOURCE) as Record<string, unknown>;
delete artifact.updatedAt;

const source = fs.readFileSync(FILE, 'utf-8');
const marker = 'export const defaultProxyArtifact: Artifact = {';
const at = source.indexOf(marker);
if (at < 0) throw new Error('defaultProxyArtifact declaration not found');
const rebuilt = `${source.slice(0, at)}export const defaultProxyArtifact: Artifact = `
  + `${JSON.stringify(artifact, null, 2)} as unknown as Artifact;\n`;
fs.writeFileSync(FILE, rebuilt);
console.log(`regenerated ${path.relative(path.resolve(here, '..'), FILE)}`);
