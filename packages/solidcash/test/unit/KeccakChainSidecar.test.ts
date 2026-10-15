import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  keccakChainLockingBytecode, planKeccakChain, type AbiFunction,
} from '@solidcash/utils';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import {
  resolveKeccakComputeCoSpends,
} from '../../src/stateful/sc-resolve-keccak-compute-co-spends.js';

const abiFunction = {
  name: 'record',
  inputs: [{ name: 'x', type: 'bytes' }],
  keccakPreimageParams: ['x'],
  keccakChainReads: true,
} as unknown as AbiFunction;

const preimage = (): Uint8Array => {
  const out = new Uint8Array(12_000);
  for (let i = 0; i < out.length; i += 1) out[i] = (i * 13 + 7) & 0xff;
  return out;
};

describe('stateful chained keccak256 side-car planning', () => {
  it('plans one chain side-car per 136-byte block and a FINAL digest carrier', () => {
    const data = preimage();
    const plan = planKeccakChain(data);
    expect(plan[0].kind).toBe('start');
    expect(plan[plan.length - 1].kind).toBe('final');
    expect(plan.filter((step) => step.kind === 'cont').length).toBe(Math.floor(data.length / 136) - 1);
    // The last (FINAL) side-car carries the 12000 % 136 remainder block.
    expect(plan[plan.length - 1].block.length).toBe(data.length % 136);
  });

  it('refuses an unfunded chained preimage with the documented refusal', async () => {
    const provider = new MockNetworkProvider();
    (provider as unknown as { addUtxo?: unknown }).addUtxo = undefined;
    const host = {
      categoryId: 'aa'.repeat(32),
      inner: {
        bytecode: '',
        provider,
      },
      evalComputedKey: () => undefined,
      extractStatefulKeccakPreimages: async () => {
        throw new Error('unexpected probe');
      },
    };
    await expect(resolveKeccakComputeCoSpends(host, abiFunction, [preimage()], undefined))
      .rejects.toThrow(/keccak256 preimage too large \(12000 B = \d+ blocks\)/);
  });

  it('resolves funded chain side-cars at the branded start/cont/final locks', async () => {
    const provider = new MockNetworkProvider();
    const data = preimage();
    const salt = new Uint8Array(32).fill(0xbb);
    for (const step of planKeccakChain(data)) {
      await provider.addUtxo(binToHex(keccakChainLockingBytecode(salt, step.kind, true)), {
        txid: 'cc'.repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: 'dd'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      } as never);
    }
    const host = {
      categoryId: 'bb'.repeat(32),
      inner: { bytecode: '', provider },
      evalComputedKey: () => undefined,
      extractStatefulKeccakPreimages: async () => {
        throw new Error('unexpected probe');
      },
    };
    const resolution = await resolveKeccakComputeCoSpends(host, abiFunction, [data], undefined);
    expect(resolution.chain?.sideCars.length).toBe(planKeccakChain(data).length);
    expect(resolution.chain?.recreates.length).toBe(planKeccakChain(data).length);
  });
});
