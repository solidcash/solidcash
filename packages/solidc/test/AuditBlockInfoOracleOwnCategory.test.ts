/**
 * The block-info oracle is of the reading contract's own category (block oracle hardening, 2026-11-03).
 *
 * Any block.* or blockhash read makes a contract stateful, and its block-info oracle is a mutable NFT of its own
 * category at the lock the oracle covenant gives that category. Every master spend holds the minting NFT that could
 * mint a look-alike with forged block fields, so every function of a reader admits an output at that lock only as an
 * unchanged recreation of the input at its index. Each case runs the whole transaction on the BCH 2026 VM.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  applyBlockOracleLock, asmToScript, blockOracleLockingBytecode, blockOracleReadUnlocking,
  encodeBlockOracleCommitment, encodeIntegerValue, scriptToBytecode, type AbiFunction, type Artifact,
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
const READ = 'function read(int t) { require(block.timestamp == t); }';
const READER = `${P} contract T { ${READ} }`;
const TWO_FUNCTION_READER = `${P} contract T2 { ${READ} function poke(int x) { require(x > 0); } }`;
const EVENT_READER = `${P} contract TE { event Seen(int x); ${READ} function ping(int x) { emit Seen(x); } }`;
const SPLIT_READER = `${P} contract TS { ${READ} function fork(int k) split(k) { require(k > 0); } }`;

const CATEGORY = Uint8Array.from({ length: 32 }, (_, i) => (0x37 + i * 11) & 0xff);
const EMPTY = new Uint8Array(0);
const MASTER_VALUE = 20_000n;
const ORACLE_VALUE = 1_000n;
const FUNDER_LOCK = Uint8Array.from([0x51]);
const TIME = 1_700_000_000n;
const OWNER_PKH = new Uint8Array(20).fill(0x31);
const FORGER_PKH = new Uint8Array(20).fill(0x66);
const ORACLE_LOCK = blockOracleLockingBytecode(CATEGORY);
const vm = createVirtualMachineBch2026();

const num = (value: bigint): Uint8Array => encodeIntegerValue(value);

function fields(timestamp: bigint): Parameters<typeof encodeBlockOracleCommitment>[1] {
  return { number: 900n, timestamp, difficulty: 1n, size: 1000n, totalFees: 100n, coinbase: FUNDER_LOCK };
}

function p2sh32(redeem: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(redeem));
}

function input(index: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] {
  return {
    outpointIndex: 0,
    outpointTransactionHash: Uint8Array.from({ length: 32 }, (_, i) => (0x70 + index + i * 29) & 0xff),
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

/** The redeem with the category's oracle lock written over the reader's sentinel, as deployment writes it. */
function redeemOf(artifact: Artifact): Uint8Array {
  const program = scriptToBytecode(asmToScript(artifact.bytecode));
  return applyBlockOracleLock(program, ORACLE_LOCK, artifact.blockOracleLockSlots ?? []);
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

function oracle(ownerPkh: Uint8Array, timestamp: bigint): VmOutput {
  return {
    lockingBytecode: ORACLE_LOCK, valueSatoshis: ORACLE_VALUE,
    token: {
      category: CATEGORY, amount: 0n,
      nft: { capability: 'mutable', commitment: encodeBlockOracleCommitment(ownerPkh, fields(timestamp)) },
    },
  };
}

function verdict(spend: Spend): true | string {
  return vm.verify(spend);
}

/** The master reads block.timestamp from its oracle at input 1; a funder pays at input 2. */
function readSpend(artifact: Artifact): Spend {
  const unlock = masterUnlock(artifact, 'read', {
    t: num(TIME), __internal__blockOracleInputIndex: num(1n), __internal__returnOutputIdx: num(-1n),
  });
  return {
    sourceOutputs: [master(artifact), oracle(OWNER_PKH, TIME), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n }],
    transaction: {
      version: 2, locktime: 0,
      inputs: [input(0, unlock), input(1, blockOracleReadUnlocking(CATEGORY)), input(2, EMPTY)],
      outputs: [master(artifact), oracle(OWNER_PKH, TIME), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 90_000n }],
    },
  };
}

/** The master runs `poke`, which reads no oracle; a funder pays at input 1. */
function pokeSpend(artifact: Artifact): Spend {
  return {
    sourceOutputs: [master(artifact), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n }],
    transaction: {
      version: 2, locktime: 0,
      inputs: [
        input(0, masterUnlock(artifact, 'poke', { x: num(1n), __internal__returnOutputIdx: num(-1n) })), input(1, EMPTY),
      ],
      outputs: [master(artifact), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 90_000n }],
    },
  };
}

function withOutput(spend: Spend, output: VmOutput): Spend {
  return { ...spend, transaction: { ...spend.transaction, outputs: [...spend.transaction.outputs, output] } };
}

describe('any block.* or blockhash read makes a contract stateful', () => {
  it.each([
    ['block.timestamp', 'function f(int t) { require(block.timestamp == t); }'],
    ['block.chainid', 'function f(uint256 c) { require(block.chainid == c); }'],
    ['block.gaslimit', 'function f(int g) { require(block.gaslimit == g); }'],
    ['block.prevrandao', 'function f(uint256 r) { require(block.prevrandao != r); }'],
    ['blockhash', 'function f(int n, bytes32 h) { require(blockhash(n) == h); }'],
  ])('%s', (_label, body) => {
    expect(compileString(`${P} contract B { ${body} }`).stateLayout).toBeDefined();
  });

  it('and a contract that reads none stays stateless', () => {
    expect(compileString(`${P} contract B { function f(int x) { require(x > 0); } }`).stateLayout).toBeUndefined();
  });
});

describe.each([
  ['direct', READER, {}],
  ['direct, two functions', TWO_FUNCTION_READER, {}],
  ['message bus', READER, { messageBus: true }],
  ['with events', EVENT_READER, {}],
])('a block.* reader (%s)', (_label, source, options) => {
  const artifact = compileString(source, options);

  it('settles an honest read of its own oracle', () => {
    expect(verdict(readSpend(artifact))).toBe(true);
  });

  it('keeps the master: a read cannot move its minting NFT to another lock', () => {
    const spend = readSpend(artifact);
    const outputs = [{ ...master(artifact), lockingBytecode: FUNDER_LOCK }, ...spend.transaction.outputs.slice(1)];
    expect(verdict({ ...spend, transaction: { ...spend.transaction, outputs } })).not.toBe(true);
  });

  it('refuses a forged oracle minted beside a read', () => {
    expect(verdict(withOutput(readSpend(artifact), oracle(FORGER_PKH, TIME + 86_400n)))).not.toBe(true);
  });
});

describe('a function that reads no oracle, in a contract that does', () => {
  const artifact = compileString(TWO_FUNCTION_READER);

  it('settles', () => {
    expect(verdict(pokeSpend(artifact))).toBe(true);
  });

  it('refuses a forged oracle minted beside it', () => {
    expect(verdict(withOutput(pokeSpend(artifact), oracle(FORGER_PKH, TIME + 86_400n)))).not.toBe(true);
  });
});

describe('a permissionless split of a block.* reader', () => {
  const artifact = compileString(SPLIT_READER, { allowUnsafeOperations: true });

  function splitSpend(): Spend {
    return {
      sourceOutputs: [master(artifact), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n }],
      transaction: {
        version: 2, locktime: 0,
        inputs: [input(0, masterUnlock(artifact, 'fork', { k: num(1n) })), input(1, EMPTY)],
        outputs: [master(artifact), master(artifact, 1_000n), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 90_000n }],
      },
    };
  }

  it('settles an honest split', () => {
    expect(verdict(splitSpend())).toBe(true);
  });

  it('refuses a forged oracle minted beside the split', () => {
    expect(verdict(withOutput(splitSpend(), oracle(FORGER_PKH, TIME + 86_400n)))).not.toBe(true);
  });
});
