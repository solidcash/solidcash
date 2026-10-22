import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Output } from '@bitauth/libauth';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import type { TransactionDetails } from '../../src/interfaces.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { createTestProvider, fundedSigner } from '../test-util.js';

/**
 * A returning function's block ends in a returnEvent slot. Its dynamic keccak loop reads side-car k at
 * master + blockSize + k, so a plain call (no .emitReturn()) keeps that slot instead of compacting it.
 */
const SOURCE = `
contract LoopReturn {
    bytes32 acc;

    function digestAll(bytes32[] items) public returns (bytes32) {
        bytes32 h = this.acc;
        for (int i = 0; i < items.length; i++) {
            h = keccak256(abi.encodePacked(h, items[i]));
        }
        this.acc = h;
        return h;
    }

    function check(bytes32 expected) public view {
        require(this.acc == expected);
    }
}`;

type Call = { build(): Promise<TransactionBuilder>; send(): Promise<TransactionDetails> };
type Deployed = {
  getFunction(name: string): (...args: unknown[]) => Call & { emitReturn(): Call };
  categoryId: string;
};

const seed = hexToBin('56'.repeat(32));
const item = (byte: number): Uint8Array => new Uint8Array(32).fill(byte);
// The digest each iteration commits on its side-car: d_k = keccak256(d_{k-1} || items[k]).
const chainDigests = (start: Uint8Array, items: readonly Uint8Array[]): Uint8Array[] => {
  const digests: Uint8Array[] = [];
  let h = start;
  for (const next of items) {
    h = keccak_256(Uint8Array.from([...h, ...next]));
    digests.push(h);
  }
  return digests;
};

describe('keccak loop in a returning function keeps its return slot', () => {
  it('settles with and without .emitReturn(): side-cars at blockSize + k, digests read back', async () => {
    const artifact = compileString(SOURCE, { forceStateful: true, suppressWarnings: true });
    const entry = artifact.abi.find((fn) => fn.name === 'digestAll')!;
    expect(entry.keccakLoopReads).toBe(true);
    const layout = entry.blockLayout!;
    const returnSlot = layout.slots.find((slot) => slot.kind === 'returnEvent')!;
    expect(layout.slots.at(-1)).toBe(returnSlot);

    const signer = await fundedSigner(8, 10_000_000n);
    const provider = signer.provider as ReturnType<typeof createTestProvider>;
    const deployed = (await getContractFactory(artifact, signer)
      .deploy({ initialState: { acc: seed } })) as unknown as Deployed;
    const digestAll = deployed.getFunction('digestAll');
    const check = deployed.getFunction('check');
    const sideCarLock = binToHex(keccakComputeLockingBytecode(hexToBin(deployed.categoryId).slice().reverse(), true));
    for (let i = 0; i < 6; i++) {
      await provider.addUtxo(sideCarLock, {
        txid: (0xd0 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: 'dd'.repeat(31) + '22', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const sideCarIndices = (outputs: readonly { lockingBytecode: Uint8Array }[]): number[] => outputs
      .flatMap((output, index) => (binToHex(output.lockingBytecode) === sideCarLock ? [index] : []));
    const expectSideCars = (outputs: readonly Output[], digests: readonly Uint8Array[]): void => {
      const indices = sideCarIndices(outputs);
      expect(indices).toEqual(digests.map((_d, k) => layout.blockSize + k));
      expect(indices.map((index) => binToHex(outputs[index].token!.nft!.commitment))).toEqual(digests.map(binToHex));
    };

    // Plain call: no return is emitted, yet side-car k still sits at master + blockSize + k on both sides.
    const first = [item(0x11), item(0x22), item(0x33)];
    const firstDigests = chainDigests(seed, first);
    const built = await digestAll(first).build();
    const { transaction, sourceOutputs } = built.buildLibauthProgram();
    expect(sideCarIndices(sourceOutputs)).toEqual(first.map((_v, k) => layout.blockSize + k));
    expectSideCars(transaction.outputs, firstDigests);
    const plain = await digestAll(first).send();
    expectSideCars(plain.outputs, firstDigests);
    expect(plain.outputs[returnSlot.offset].token).toBeUndefined();
    await expect(check(firstDigests.at(-1)!).send()).resolves.toBeDefined();

    // Emitted: the return carrier occupies the same slot and carries the final digest.
    const second = [item(0x44), item(0x55)];
    const secondDigests = chainDigests(firstDigests.at(-1)!, second);
    const emitted = await digestAll(second).emitReturn().send();
    expectSideCars(emitted.outputs, secondDigests);
    const carrier = emitted.outputs[returnSlot.offset];
    expect(carrier.token?.nft?.capability).toBe('none');
    expect(binToHex(carrier.token!.nft!.commitment)).toContain(binToHex(secondDigests.at(-1)!));
    await expect(check(secondDigests.at(-1)!).send()).resolves.toBeDefined();
  }, 300_000);
});
