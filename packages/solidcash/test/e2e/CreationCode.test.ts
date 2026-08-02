/* eslint-disable max-len -- contract source fixtures remain readable as complete declarations */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ResolvedImport } from '@solidcash/utils';
import { hexToBin } from '@bitauth/libauth';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const inputZeroVerifyFailure = /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;

// type(C).creationCode returns the child contract's compiled redeem script (BCH has no separate
// creation vs runtime code). The factory recomputes against the bytes the child compiles to, so the
// spend only succeeds if the embedded bytecode matches on the VM - the basis for on-chain factories.

function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return `/${out.join('/')}`;
}

function resolverFor(files: Record<string, string>) {
  return (importPath: string, currentFile: string): ResolvedImport | undefined => {
    const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
    let resolved = normalize(dir + importPath);
    if (!resolved.endsWith('.scash')) resolved += '.scash';
    return files[resolved] !== undefined ? { source: files[resolved], id: resolved } : undefined;
  };
}

const CHILD_SOURCE = `
contract Child(int threshold) {
    function spend(int v) {
        int doubled = v * 2;
        require(doubled >= threshold);
    }
}`;

const FILES = { '/lib/child.scash': CHILD_SOURCE };

const FACTORY = `
import "./lib/child.scash";
contract Factory() {
    function check(bytes expected) {
        bytes code = type(Child).creationCode;
        require(code == expected);
    }
    // runtimeCode is the same script on BCH.
    function checkRuntime(bytes expected) {
        require(type(Child).runtimeCode == expected);
    }
}
`;

const factoryArtifact = compileString(
  FACTORY,
  { importResolver: resolverFor(FILES), rootFileId: '/main.scash', forceStateful: true },
);
// The child's standalone-compiled redeem script equals the bytes the factory embeds. The factory
// compiles referenced contracts with its own options, so match forceStateful here too.
const childBytecode = hexToBin(
  compileString(CHILD_SOURCE, { forceStateful: true }).debug!.bytecode.replace(/ /g, ''),
);

describe('type(C).creationCode', () => {
  it('embeds the child contract bytecode (matches the child compilation)', async () => {
    const factory = getContractFactory(factoryArtifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.check(childBytecode)).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });

  it('runtimeCode returns the same bytecode on BCH', async () => {
    const factory = getContractFactory(factoryArtifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.checkRuntime(childBytecode)).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });

  it('rejects a mismatched bytecode', async () => {
    const factory = getContractFactory(factoryArtifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.check(Uint8Array.from([0x00, 0x11]))).rejects.toThrow(inputZeroVerifyFailure);
  });
});
