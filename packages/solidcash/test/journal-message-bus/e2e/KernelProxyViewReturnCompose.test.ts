import { binToHex } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../../src/index.js';
import type { TransactionBuilder } from '../../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts as vmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const isOpReturn = (lockingBytecode: Uint8Array | string | undefined): boolean => {
  if (lockingBytecode === undefined) return false;
  const bytes = typeof lockingBytecode === 'string'
    ? Buffer.from(lockingBytecode, 'hex')
    : lockingBytecode;
  return bytes.length >= 1 && bytes[0] === 0x6a;
};

describe('kernel proxy __forward view/return compose', () => {
  it('reads grafted proxy state and materializes a non-empty authenticated return through __forward', async () => {
    // Pure/view getters are not delegate-eligible (DelegateInferred). Admitted paths:
    // (1) wrapDispatch state sugar for views; (2) a writing+returning handler for emitReturn via __forward.
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        int stored;
        mapping(int => int) bal;
        function initialize(int initial) public { this.stored = initial; }
        function seed(int k, int v) public { bal[k] = v; }
        function bump() public returns (int) {
          this.stored = this.stored + 1;
          return this.stored;
        }
      }`, KERNEL);
    expect(artifact.delegateArtifact).toBeDefined();
    expect(artifact.delegateArtifact!.abi.find((fn) => fn.name === 'bump')?.modifiers)
      .toEqual(expect.arrayContaining(['delegate']));

    const provider = createMessageBusCapstoneTestProvider();
    const privateKey = new Uint8Array(32).fill(0x44);
    const signer = new Signer(privateKey, provider);
    for (let index = 0; index < 24; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }
    const proxy = await upgrades.deployProxy(getContractFactory(artifact, signer), [17n]);

    // View: Solidity-parity getter sugar reads grafted proxy state (not a delegate view spend).
    const viewed = await (proxy as any).stored();
    expect(viewed).toBe(17n);

    // Return through __forward: bump is delegate-eligible and returns the post-write value.
    const emitted = await (proxy as any).bump().emitReturn().send();
    expect(emitted.txid).toMatch(/^[0-9a-f]{64}$/);
    const categoryHex = String(proxy.proxy.categoryId).toLowerCase();
    const returnNft = emitted.outputs.find((output: any) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      return hex === categoryHex
        && output.token?.nft?.capability === 'none'
        && !isOpReturn(output.to)
        && (typeof output.token.nft.commitment === 'string'
          ? output.token.nft.commitment.length > 0
          : (output.token.nft?.commitment?.length ?? 0) > 0);
    });
    expect(returnNft).toBeDefined();
    expect(await (proxy as any).stored()).toBe(18n);

    const builder = await (proxy as any).bump().emitReturn().build() as TransactionBuilder;
    expect(vmAccepts(builder)).toBe(true);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker && 'params' in input.unlocker))
      .toBe(true);
  }, 300_000);
});
