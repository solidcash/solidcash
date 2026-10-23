import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, createVirtualMachineBch2026, hexToBin } from '@bitauth/libauth';
import type { ResolvedTransactionBch } from '@bitauth/libauth';
import {
  KECCAK_CHAIN_COVENANT_HASH, KECCAK_CHAIN_MODE, buildKeccakChainRedeem, hash256, keccakChainCommitments,
  keccakChainLockingBytecode, keccakChainStates, keccakF1600, planKeccakChain, sha256, type KeccakChainKind,
} from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { buildKeccakChainSidecars, pushDataBytes } from '../../src/keccak/keccakComputeSidecar.js';
import type { TransactionDetails, Utxo } from '../../src/interfaces.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

/**
 * KCHAIN-1: chained keccak256 side-cars commit `X || sha256(state)` (64 B) instead of the 200-byte state, take the
 * previous state only from an input under the same chain lock, and FINAL recomputes the block chain X from the
 * argument the contract binds. The mock allows 1,000,000-byte commitments, so the 128-byte limit is asserted here.
 */
const SOURCE = `
contract ChainBinding {
    bytes32 digest;

    function record(bytes memory x) public {
        digest = keccak256(x);
    }

    function check(bytes32 expected) public view {
        require(digest == expected);
    }
}`;
const ARTIFACT = compileString(SOURCE, { forceStateful: true, enforceFinalRequire: false });
// A returning chain function: its block ends in a returnEvent slot that a plain call does not emit.
const RETURNING_SOURCE = `
contract ChainReturn {
    bytes32 digest;

    function record(bytes memory x) public returns (bytes32) {
        bytes32 h = keccak256(x);
        digest = h;
        return h;
    }

    function check(bytes32 expected) public view {
        require(digest == expected);
    }
}`;
const RETURNING = compileString(RETURNING_SOURCE, { forceStateful: true, enforceFinalRequire: false });

const vm = createVirtualMachineBch2026();
const SALT = new Uint8Array(32);                      // shared salt: the brand check is skipped
const LOCK = keccakChainLockingBytecode(SALT, 'final', true);
const REDEEM = buildKeccakChainRedeem(SALT, 'final', true);
const NFT = Uint8Array.from({ length: 32 }, (_v, i) => i + 1);

const bytes = (length: number): Uint8Array => Uint8Array.from({ length }, (_v, i) => (i * 13 + 7) & 0xff);

type Leg = { lock: Uint8Array; unlocking: Uint8Array; commitment: Uint8Array };
type Metrics = {
  operationCost: number; maximumOperationCost: number; hashDigestIterations: number;
  maximumHashDigestIterations: number;
};

// <pad> <data> <mode> <redeem>, the previous state (if any) at the front of the pad.
const unlocking = (kind: KeccakChainKind, data: Uint8Array, state?: Uint8Array): Uint8Array => {
  const pad = new Uint8Array(1000);
  if (state) pad.set(state);
  return Uint8Array.from([
    ...pushDataBytes(pad), ...pushDataBytes(data), 0x50 + KECCAK_CHAIN_MODE[kind], ...pushDataBytes(REDEEM),
  ]);
};

// The side-car legs the SDK builds for `preimage`.
const sdkLegs = (preimage: Uint8Array): Leg[] => {
  const utxos: Utxo[] = planKeccakChain(preimage).map((_step, vout) => ({
    txid: '11'.repeat(32), vout, satoshis: 100_000n,
    token: { category: binToHex(NFT), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }));
  return buildKeccakChainSidecars(preimage, SALT, utxos, true).map((leg) => ({
    lock: leg.unlocker.generateLockingBytecode(),
    unlocking: leg.unlocker.generateUnlockingBytecode({} as never),
    commitment: leg.commitment,
  }));
};

// Legs as consecutive inputs, each recreated at its own index (the stateful block layout).
const program = (legs: Leg[]): ResolvedTransactionBch => {
  const token = (commitment: Uint8Array): NonNullable<ResolvedTransactionBch['sourceOutputs'][number]['token']> => (
    { category: NFT, amount: 0n, nft: { capability: 'mutable', commitment } });
  return {
    sourceOutputs: legs.map((leg) => (
      { lockingBytecode: leg.lock, valueSatoshis: 100_000n, token: token(new Uint8Array(32)) })),
    transaction: {
      version: 2, locktime: 0,
      inputs: legs.map((leg, i) => ({
        outpointTransactionHash: new Uint8Array(32).fill(0x11), outpointIndex: i, sequenceNumber: 0,
        unlockingBytecode: leg.unlocking,
      })),
      outputs: legs.map((leg) => ({ lockingBytecode: leg.lock, valueSatoshis: 100_000n, token: token(leg.commitment) })),
    },
  };
};

const errors = (legs: Leg[]): Array<string | undefined> => {
  const resolved = program(legs);
  return legs.map((_leg, inputIndex) => vm.evaluate({ ...resolved, inputIndex }).error);
};

// FINAL's digest from a revealed 200-byte state (lane24..lane0, big-endian lanes) and the remainder.
const digestFrom = (state: Uint8Array, remainder: Uint8Array): Uint8Array => {
  const lanes = Array.from({ length: 25 }, (_v, i) => BigInt(`0x${binToHex(state.slice((24 - i) * 8, (25 - i) * 8))}`));
  const padded = [...remainder, 0x01];
  while (padded.length % 136 !== 0) padded.push(0);
  padded[135] |= 0x80;
  for (let i = 0; i < 17; i++) {
    let lane = 0n;
    for (let b = 0; b < 8; b++) lane |= BigInt(padded[i * 8 + b]) << BigInt(8 * b);
    lanes[i] ^= lane;
  }
  const out = keccakF1600(lanes);
  return Uint8Array.from({ length: 32 }, (_v, k) => Number((out[k >> 3] >> BigInt(8 * (k & 7))) & 0xffn));
};

type Call = { build(): Promise<TransactionBuilder>; send(): Promise<TransactionDetails> };
type Deployed = {
  getFunction(name: string): (...args: unknown[]) => Call & { emitReturn(): Call };
  categoryId: string;
};

describe('KCHAIN-1 chained keccak256 side-car binding', () => {
  it('settles an honest chain: keccak256 digest, commitments within 128 bytes, real BCH 2026 costs', async () => {
    for (const length of [200, 300]) {
      const preimage = bytes(length);
      const legs = sdkLegs(preimage);
      const resolved = program(legs);
      // Standard BCH 2026 verification, including its 128-byte token commitment limit.
      expect(vm.verify(resolved)).toBe(true);
      const commitments = keccakChainCommitments(preimage);
      expect(commitments.map((c) => c.length)).toEqual([...new Array(legs.length - 1).fill(64), 32]);
      expect(binToHex(commitments[commitments.length - 1])).toBe(binToHex(keccak_256(preimage)));
      const costs = planKeccakChain(preimage).map((step, inputIndex) => {
        const m = (vm.evaluate({ ...resolved, inputIndex }) as unknown as { metrics: Metrics }).metrics;
        expect(m.operationCost).toBeLessThanOrEqual(m.maximumOperationCost);
        return `${step.kind} ${m.operationCost}/${m.maximumOperationCost} op `
          + `${m.hashDigestIterations}/${m.maximumHashDigestIterations} hash`;
      });
      console.log(`KCHAIN-1 ${length} B: ${costs.join('; ')}`);
    }

    // Through the SDK on mocknet: START, CONT and FINAL right after the fixed block, with no funder band. The send
    // preflight applies the real BCH-2026 budget to this contract's own input too, whose per-input scans a band of
    // funders made exceed it for a short preimage.
    const blockSize = ARTIFACT.abi.find((fn) => fn.name === 'record')!.blockLayout!.blockSize;
    for (const length of [300, 400]) {
      const signer = await fundedSigner(8, 10_000_000n);
      const hasher = (await getContractFactory(ARTIFACT, signer).deploy()) as unknown as Deployed;
      const preimage = bytes(length);
      const built = await hasher.getFunction('record')(preimage).build();
      const { transaction, sourceOutputs } = built.buildLibauthProgram();
      const salt = hexToBin(hasher.categoryId).slice().reverse();
      const chainLock = binToHex(keccakChainLockingBytecode(salt, 'final', true));
      const chainInputs = sourceOutputs.flatMap((output, index) => (
        binToHex(output.lockingBytecode) === chainLock ? [index] : []));
      const steps = planKeccakChain(preimage).length;
      expect(chainInputs).toEqual(Array.from({ length: steps }, (_v, i) => blockSize + i));
      // At most a fee input follows FINAL.
      expect(transaction.inputs.length).toBeLessThanOrEqual(blockSize + steps + 1);
      expect(chainInputs.map((index) => binToHex(transaction.outputs[index].token!.nft!.commitment)))
        .toEqual(keccakChainCommitments(preimage).map(binToHex));
      expect(transaction.outputs.every((output) => (output.token?.nft?.commitment.length ?? 0) <= 128)).toBe(true);
      for (const inputIndex of chainInputs) {
        expect(vm.evaluate({ sourceOutputs, transaction, inputIndex }).error).toBeUndefined();
      }
      // The master at input 0 within the BCH 2026 density limit.
      const master = vm.evaluate({ sourceOutputs, transaction, inputIndex: 0 }) as unknown as
        { error?: string; metrics: Metrics };
      console.log(`KCHAIN-1 ${length} B master: ${master.metrics.operationCost}/`
        + `${master.metrics.maximumOperationCost} op, ${transaction.inputs.length} inputs, `
        + `${transaction.outputs.length} outputs`);
      expect(master.error).toBeUndefined();
      await hasher.getFunction('record')(preimage).send();
      await expect(hasher.getFunction('check')(keccak_256(preimage)).send()).resolves.toBeDefined();
    }
  }, 300_000);

  it('refuses a forged previous state at FINAL-1 under another lock', () => {
    const preimage = bytes(200);                      // START + FINAL
    const honest = sdkLegs(preimage);
    expect(errors(honest)).toEqual([undefined, undefined]);
    const remainder = preimage.slice(136);
    expect(binToHex(digestFrom(keccakChainStates(preimage)[0], remainder))).toBe(binToHex(keccak_256(preimage)));
    // A chosen state S* behind the honest block chain X, and the digest FINAL would derive from it.
    const forged = new Uint8Array(200).fill(0x42);
    const forgedLink = Uint8Array.from([...honest[0].commitment.slice(0, 32), ...sha256(forged)]);
    const final: Leg = {
      lock: LOCK, unlocking: unlocking('final', preimage, forged), commitment: digestFrom(forged, remainder),
    };
    const otherLock = Uint8Array.from([0xaa, 0x20, ...hash256(Uint8Array.of(0x51)), 0x87]);
    const other: Leg = { lock: otherLock, unlocking: pushDataBytes(Uint8Array.of(0x51)), commitment: forgedLink };
    expect(errors([other, final])[1]).toEqual(expect.any(String));
    // Under the chain lock FINAL would take that link, but the input's own covenant refuses the forged commitment.
    expect(errors([{ ...honest[0], commitment: forgedLink }, final])).toEqual([expect.any(String), undefined]);
  });

  it('refuses a START or CONT block that is not its slice of the argument', () => {
    const preimage = bytes(300);                      // START + CONT + FINAL
    expect(errors(sdkLegs(preimage))).toEqual([undefined, undefined, undefined]);
    for (const slice of [0, 1]) {
      const altered = preimage.slice();
      altered[slice * 136 + 5] ^= 0x01;
      const alteredLegs = sdkLegs(altered);           // self-consistent over the altered block
      expect(errors(alteredLegs)).toEqual([undefined, undefined, undefined]);
      // FINAL bound to the real argument and continuing the altered chain: each step passes, FINAL refuses.
      const final: Leg = {
        lock: LOCK, unlocking: unlocking('final', preimage, keccakChainStates(altered)[1]),
        commitment: keccakChainCommitments(altered)[2],
      };
      expect(errors([alteredLegs[0], alteredLegs[1], final])).toEqual([undefined, undefined, expect.any(String)]);
    }
  });

  it('settles a returning chain function: its unemitted return slot keeps FINAL past the whole block', async () => {
    const layout = RETURNING.abi.find((fn) => fn.name === 'record')!.blockLayout!;
    expect(layout.slots.at(-1)?.kind).toBe('returnEvent');
    const signer = await fundedSigner(8, 10_000_000n);
    const hasher = (await getContractFactory(RETURNING, signer).deploy()) as unknown as Deployed;
    const salt = hexToBin(hasher.categoryId).slice().reverse();
    const chainLock = binToHex(keccakChainLockingBytecode(salt, 'final', true));
    // A plain call emits no return; the covenant still reads FINAL at blockSize + fullBlocks.
    const preimage = bytes(300);
    const built = await hasher.getFunction('record')(preimage).build();
    const { transaction, sourceOutputs } = built.buildLibauthProgram();
    const chainInputs = sourceOutputs.flatMap((output, index) => (
      binToHex(output.lockingBytecode) === chainLock ? [index] : []));
    expect(chainInputs).toEqual([0, 1, 2].map((step) => layout.blockSize + step));
    expect(chainInputs.map((index) => binToHex(transaction.outputs[index].token!.nft!.commitment)))
      .toEqual(keccakChainCommitments(preimage).map(binToHex));
    for (const inputIndex of [0, ...chainInputs]) {
      expect(vm.evaluate({ sourceOutputs, transaction, inputIndex }).error).toBeUndefined();
    }
    await hasher.getFunction('record')(preimage).send();
    await expect(hasher.getFunction('check')(keccak_256(preimage)).send()).resolves.toBeDefined();
    // The emitted carrier occupies the same slot and reads the digest back.
    const second = bytes(400);
    const emitted = await hasher.getFunction('record')(second).emitReturn().send();
    const digest = binToHex(keccak_256(second));
    expect(emitted.outputs.some((output) => output.token?.nft?.capability === 'none'
      && binToHex(output.token.nft.commitment).includes(digest))).toBe(true);
    await expect(hasher.getFunction('check')(keccak_256(second)).send()).resolves.toBeDefined();
  }, 300_000);

  it('keeps a message-bus participant on its fixed compute slot, so no chain sits past its published block', () => {
    const bus = compileString(RETURNING_SOURCE, { forceStateful: true, enforceFinalRequire: false, messageBus: true });
    expect(bus.abi.find((fn) => fn.name === 'record')!.keccakChainReads).toBe(true);
    const route = bus.messageBus!.route;
    expect(bus.messageBus!.admittedHandlerIds).toContain('record');
    expect(route.keccakChainReads).toBeUndefined();
    expect(route.blockLayout!.slots.some((slot) => slot.kind === 'keccakSideCar')).toBe(true);
  });

  it('leaves contracts that do not hash long preimages byte-identical', () => {
    const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
    const fixed = compileString(`contract FixedHasher {
    bytes32 digest;
    function record(bytes32 x) public {
        digest = keccak256(x);
    }
}`, { forceStateful: true, enforceFinalRequire: false });
    const stateless = compileString(`contract StatelessHasher {
    function check(bytes x, bytes32 h) {
        require(keccak256(x) == h);
    }
}`, {});
    // sha256(bytecode) of this tree without KCHAIN-1 (at 94e27413c, the C3 pin folded into the count).
    expect(sha(fixed.bytecode)).toBe('e568a8a8faa78187bf8b82b028a6aae15fb616e3fdd290c05869eac8ff3aed45');
    expect(sha(stateless.bytecode)).toBe('7f8057ef1e74a7ce3791b7d522fe3542c50240b292197ae7fabe47d57b98e85e');
    expect(ARTIFACT.bytecode.includes(KECCAK_CHAIN_COVENANT_HASH)).toBe(true);
  });
});
