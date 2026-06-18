import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { ResolvedImport } from '@solidcash/utils';
import { hexToBin } from '@bitauth/libauth';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

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

const factoryArtifact = compileString(FACTORY, { importResolver: resolverFor(FILES), rootFileId: '/main.scash' });
// The child's standalone-compiled redeem script equals the bytes the factory embeds.
const childBytecode = hexToBin(compileString(CHILD_SOURCE).debug!.bytecode.replace(/ /g, ''));

async function spend(fn: string, arg: Uint8Array): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(factoryArtifact, [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock[fn](arg))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('type(C).creationCode', () => {
  it('embeds the child contract bytecode (matches the child compilation)', async () => {
    await expect(spend('check', childBytecode)).resolves.toBeDefined();
  });

  it('runtimeCode returns the same bytecode on BCH', async () => {
    await expect(spend('checkRuntime', childBytecode)).resolves.toBeDefined();
  });

  it('rejects a mismatched bytecode', async () => {
    await expect(spend('check', Uint8Array.from([0x00, 0x11]))).rejects.toThrow();
  });
});
