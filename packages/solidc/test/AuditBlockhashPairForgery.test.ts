/**
 * Forged blockhash slots (block oracle hardening, 2026-11-03).
 *
 * A `blockhash(n)` reader accepts any NFT of its category at the category's blockhash slot lock whose commitment
 * starts with `n`. Every master spend holds the category's minting NFT, so the spend can mint such an NFT: a slot with
 * a forged hash, or a second slot of an n. A master of a contract that reads blockhash therefore admits an
 * own-category output at that lock only as an unchanged recreation of the input at the same index. Honest reads
 * settle, with and without declared events.
 *
 * A contract whose only stateful feature is blockhash had no master covenant at all in a function body compiled on
 * its own (a message-bus build, or two or more functions): the body did not know the contract reads blockhash, so a
 * read could move the master's minting NFT anywhere. Each case runs the whole transaction on the BCH 2026 VM.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, blockhashOracleLockingBytecode, blockhashSlotReadUnlocking, buildBlockhashSlotCommitment,
  encodeIntegerValue, scriptToBytecode, type AbiFunction, type Artifact,
} from '@solidcash/utils';
import { compileString } from '../src/index.js';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
type SourceOutputs = NonNullable<VmProgram['sourceOutputs']>;

interface Spend {
  readonly sourceOutputs: SourceOutputs;
  readonly transaction: VmTransaction;
}

const P = 'pragma solidcash ^0.14.0;';
const READ = 'function read(int bn, bytes32 h) { require(blockhash(bn) == h); }';
const READER = `${P} contract R { ${READ} }`;
const TWO_FUNCTION_READER = `${P} contract R2 { ${READ} function poke(int x) { require(x > 0); } }`;
const EVENT_READER = `${P} contract E { event Seen(int x); ${READ} function ping(int x) { emit Seen(x); } }`;
const SPLIT_READER = `${P} contract S { ${READ} function fork(int k) split(k) { require(k > 0); } }`;

const CATEGORY = Uint8Array.from({ length: 32 }, (_, i) => (0x41 + i * 13) & 0xff);
const EMPTY = new Uint8Array(0);
const MASTER_VALUE = 20_000n;
const SLOT_VALUE = 1_200n;
const FUNDER_LOCK = Uint8Array.from([0x51]);
const HEIGHT = 1_000;
const N = 990n;
const HASH = Uint8Array.from({ length: 32 }, (_, i) => (0x10 + i) & 0xff);
const FORGED = new Uint8Array(32).fill(0xee);
const OWNER = new Uint8Array(20).fill(0x22);
const DEPTH = 256;
const SLOT_READ = blockhashSlotReadUnlocking(CATEGORY);
const SLOT_LOCK = blockhashOracleLockingBytecode(CATEGORY);
const vm = createVirtualMachineBch2026();

const num = (value: bigint): Uint8Array => encodeIntegerValue(value);

function p2sh32(redeem: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(redeem));
}

function input(index: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] {
  return {
    outpointIndex: 0,
    outpointTransactionHash: Uint8Array.from({ length: 32 }, (_, i) => (0x80 + index + i * 37) & 0xff),
    sequenceNumber: 0xfffffffe,
    unlockingBytecode,
  };
}

function pushesOf(values: readonly Uint8Array[]): Uint8Array {
  return new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));
}

function fnOf(artifact: Artifact, name: string): AbiFunction {
  const fn = artifact.abi.find((entry) => entry.name === name);
  if (!fn) throw new Error(`no function ${name}; have ${artifact.abi.map((entry) => entry.name).join(',')}`);
  return fn;
}

function redeemOf(artifact: Artifact): Uint8Array {
  return scriptToBytecode(asmToScript(artifact.bytecode));
}

/** As the SDK: a sole function with no compiler route or multi-call entry in the redeem takes no selector. */
function dispatchesBySelector(artifact: Artifact): boolean {
  const route = artifact.messageBus !== undefined && artifact.messageBus.available !== false
    && artifact.messageBus.routeInBytecode !== false;
  return artifact.abi.length > 1 || route || typeof artifact.callBatch === 'object';
}

/** The selector at the bottom, then the ABI arguments with the first on top, then the redeem. */
function masterUnlock(artifact: Artifact, name: string, values: Record<string, Uint8Array>): Uint8Array {
  const fn = fnOf(artifact, name);
  const args = fn.inputs.map((entry) => {
    const value = values[entry.name] ?? (entry.name.startsWith('__internal__') ? EMPTY : undefined);
    if (value === undefined) throw new Error(`no value for ${name}.${entry.name}`);
    return value;
  }).reverse();
  if (fn.selector && dispatchesBySelector(artifact)) args.unshift(hexToBin(fn.selector));
  return new Uint8Array([...pushesOf(args), ...encodeDataPush(redeemOf(artifact))]);
}

function master(artifact: Artifact, valueSatoshis = MASTER_VALUE): VmOutput {
  return {
    lockingBytecode: p2sh32(redeemOf(artifact)), valueSatoshis,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } },
  };
}

function slot(n: bigint, hash: Uint8Array): VmOutput {
  return {
    lockingBytecode: SLOT_LOCK, valueSatoshis: SLOT_VALUE,
    token: {
      category: CATEGORY, amount: 0n,
      nft: { capability: 'mutable', commitment: buildBlockhashSlotCommitment(n, hash, OWNER, DEPTH) },
    },
  };
}

function verdict(spend: Spend): true | string {
  return vm.verify(spend);
}

/** The master reads `n` from the slot at input 1, holding `slotHash`; a funder pays at input 2. */
function readSpend(artifact: Artifact, n: bigint, hash: Uint8Array, slotHash: Uint8Array = hash): Spend {
  const unlock = masterUnlock(artifact, 'read', {
    bn: num(n), h: hash, __internal__blockhashInputIndex: num(1n), __internal__returnOutputIdx: num(-1n),
  });
  return {
    sourceOutputs: [master(artifact), slot(n, slotHash), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n }],
    transaction: {
      version: 2, locktime: HEIGHT,
      inputs: [input(0, unlock), input(1, SLOT_READ), input(2, EMPTY)],
      outputs: [master(artifact), slot(n, slotHash), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 90_000n }],
    },
  };
}

function withOutput(spend: Spend, output: VmOutput): Spend {
  return { ...spend, transaction: { ...spend.transaction, outputs: [...spend.transaction.outputs, output] } };
}

/** The read slot's recreation at output 1 replaced by `replacement`. */
function withReadSlotOutput(spend: Spend, replacement: VmOutput): Spend {
  const outputs = spend.transaction.outputs.map((output, index) => (index === 1 ? replacement : output));
  return { ...spend, transaction: { ...spend.transaction, outputs } };
}

describe.each([
  ['direct', READER, {}],
  ['direct, two functions', TWO_FUNCTION_READER, {}],
  ['message bus', READER, { messageBus: true }],
])('a blockhash reader with no events (%s)', (_label, source, options) => {
  const artifact = compileString(source, options);

  it('settles an honest read', () => {
    expect(verdict(readSpend(artifact, N, HASH))).toBe(true);
  });

  it('keeps the master: a read cannot move its minting NFT to another lock', () => {
    const spend = readSpend(artifact, N, HASH);
    const outputs = [{ ...master(artifact), lockingBytecode: FUNDER_LOCK }, ...spend.transaction.outputs.slice(1)];
    expect(verdict({ ...spend, transaction: { ...spend.transaction, outputs } })).not.toBe(true);
  });

  it('refuses a forged slot minted beside a read', () => {
    expect(verdict(withOutput(readSpend(artifact, N, HASH), slot(N - 1n, FORGED)))).not.toBe(true);
  });

  it('refuses a second slot of the read n minted beside it', () => {
    expect(verdict(withOutput(readSpend(artifact, N, HASH), slot(N, FORGED)))).not.toBe(true);
  });

  it('refuses the read slot recreated with a forged hash', () => {
    expect(verdict(withReadSlotOutput(readSpend(artifact, N, HASH), slot(N, FORGED)))).not.toBe(true);
  });
});

it('reads a forged slot as genuine once one exists, so the mint is what must be refused', () => {
  expect(verdict(readSpend(compileString(READER), N - 1n, FORGED))).toBe(true);
});

describe('a blockhash reader that declares events', () => {
  const artifact = compileString(EVENT_READER);

  it('settles an honest read', () => {
    expect(verdict(readSpend(artifact, N, HASH))).toBe(true);
  });

  it('refuses a forged slot minted beside a read', () => {
    expect(verdict(withOutput(readSpend(artifact, N, HASH), slot(N - 1n, FORGED)))).not.toBe(true);
  });

  it('refuses the read slot recreated with a forged hash', () => {
    expect(verdict(withReadSlotOutput(readSpend(artifact, N, HASH), slot(N, FORGED)))).not.toBe(true);
  });
});

describe('a permissionless split of a blockhash reader', () => {
  const artifact = compileString(SPLIT_READER, { allowUnsafeOperations: true });

  function splitSpend(): Spend {
    return {
      sourceOutputs: [master(artifact), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n }],
      transaction: {
        version: 2, locktime: HEIGHT,
        inputs: [input(0, masterUnlock(artifact, 'fork', { k: num(1n) })), input(1, EMPTY)],
        outputs: [master(artifact), master(artifact, 1_000n), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 90_000n }],
      },
    };
  }

  it('settles an honest split', () => {
    expect(verdict(splitSpend())).toBe(true);
  });

  it('refuses a forged slot minted beside the split', () => {
    expect(verdict(withOutput(splitSpend(), slot(N - 1n, FORGED)))).not.toBe(true);
  });
});
