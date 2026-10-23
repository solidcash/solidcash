import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, createVirtualMachineBch2026, hexToBin } from '@bitauth/libauth';
import type { ResolvedTransactionBch } from '@bitauth/libauth';
import { keccakChainLockingBytecode } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

/**
 * A stateful `keccak256` of a direct unbounded `bytes` parameter whose runtime length exceeds the single
 * compute side-car's 3-block budget (~407 bytes) while staying within the 10,000-byte consensus input limit.
 * The SDK splits the preimage into START/CONT/FINAL side-cars in the trailing region and the contract reads
 * the FINAL digest.
 */
const SOURCE = `
contract ChainHasher {
    bytes32 digest;

    function record(bytes memory x) public {
        digest = keccak256(x);
    }

    function check(bytes32 expected) public view {
        require(digest == expected);
    }
}`;

const ARTIFACT = compileString(SOURCE, { forceStateful: true, enforceFinalRequire: false });

type Deployed = {
  getFunction(name: string): (...args: unknown[]) => {
    build(): Promise<{
      inputs: Array<{ unlocker: { generateLockingBytecode(): Uint8Array } }>;
      buildLibauthProgram(): ResolvedTransactionBch;
    }>;
    send(): Promise<unknown>;
  };
  withProvider(runner: NetworkProvider): Deployed;
  provider: NetworkProvider;
  categoryId: string;
};

const deploy = async (): Promise<Deployed> => {
  const signer = await fundedSigner(8, 10_000_000n);
  return (await getContractFactory(ARTIFACT, signer).deploy()) as unknown as Deployed;
};

const bigPreimage = (): Uint8Array => {
  const out = new Uint8Array(2_000);
  for (let i = 0; i < out.length; i += 1) out[i] = (i * 13 + 7) & 0xff;
  return out;
};

describe('stateful chained keccak256 side-cars', () => {
  it('hashes a >407-byte runtime argument through the chained START/CONT/FINAL side-cars', async () => {
    const hasher = await deploy();
    const preimage = bigPreimage();
    // The FINAL side-car carries the full preimage, so a 2000-byte input splits into 15 chained blocks: the
    // settled transaction must co-spend more than one START/CONT/FINAL side-car input, not one fixed slot.
    const built = await hasher.getFunction('record')(preimage).build();
    const salt = hexToBin(hasher.categoryId).slice().reverse();
    const chainLocks = new Set((['start', 'cont', 'final'] as const).map((kind) =>
      binToHex(keccakChainLockingBytecode(salt, kind, true))));
    const chainSideCarInputs = built.inputs.filter((input) =>
      chainLocks.has(binToHex(input.unlocker.generateLockingBytecode())));
    expect(chainSideCarInputs.length).toBeGreaterThan(1);
    // The master at input 0 within the BCH 2026 density limit; the side-cars follow the block with no funder band.
    const { transaction, sourceOutputs } = built.buildLibauthProgram();
    const master = createVirtualMachineBch2026().evaluate({ sourceOutputs, transaction, inputIndex: 0 }) as unknown as
      { error?: string; metrics: { operationCost: number; maximumOperationCost: number } };
    console.log(`chained 2000 B master: ${master.metrics.operationCost}/${master.metrics.maximumOperationCost} op, `
      + `${transaction.inputs.length} inputs`);
    expect(master.error).toBeUndefined();
    await hasher.getFunction('record')(preimage).send();
    await expect(hasher.getFunction('check')(keccak_256(preimage)).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses an unfunded chained preimage without broadcasting anything', async () => {
    const hasher = await deploy();
    const preimage = bigPreimage();
    let broadcasts = 0;
    const provider = hasher.provider;
    const wrapped = new Proxy(provider, {
      get(target, key): unknown {
        // Decline side-car minting: the chained START/CONT/FINAL UTXOs must already exist to be spent.
        if (key === 'addUtxo') return undefined;
        const value: unknown = Reflect.get(target, key, target);
        if (key === 'sendRawTransaction' || key === 'sendPreparedTransaction') {
          const send = value as (...args: unknown[]) => Promise<string>;
          return async (...args: unknown[]): Promise<string> => {
            broadcasts += 1;
            return send.apply(target, args);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const unfunded = hasher.withProvider(wrapped as unknown as NetworkProvider);
    await expect(unfunded.getFunction('record')(preimage).send())
      .rejects.toThrow(/keccak256 preimage too large \(2000 B = \d+ blocks\)/);
    expect(broadcasts).toBe(0);
  }, 300_000);
});
