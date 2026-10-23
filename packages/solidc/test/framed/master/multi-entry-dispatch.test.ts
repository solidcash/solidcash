import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, computeFunctionSelector, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { categorySlotValue, seededCategory } from './validator-input.js';

/**
 * A compiled framed master with several entry points, driven through the real entry point.
 *
 * The head runs once and leaves the frame; the unlocking bytecode's selector then picks the entry, so the body that
 * runs is the one the selector names and not the other. The VM half builds a real transaction per entry and asks
 * the BCH-2026 machine, because only the machine settles which body the selector reached and whether the frame
 * rules hold for it.
 *
 * The two entries carry different requirements on purpose: `bump` needs the frame's `msg.sender`, `nudge` needs
 * `address(this)`. A mutation that satisfies one and not the other proves which body ran.
 */

const CATEGORY = seededCategory('multi entry');
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]); // OP_1 OP_2, any program the address rule accepts
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));
const OTHER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(7));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Frame(address owner, address expected) {'
  + '   function bump() { require(msg.sender == owner); }'
  + '   function nudge() { require(address(this) == expected); }'
  + ' }';

/** Entry points that take an argument, so the selector and the argument layout are exercised together. */
const ARGUMENT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Choice(address owner) {'
  + '   function pick(int n) { require(msg.sender == owner); require(n == 7); }'
  + '   function drop(int n) { require(msg.sender == owner); require(n == 3); }'
  + ' }';

const compile = (source: string = SOURCE): ReturnType<typeof compileString> =>
  compileString(source, { composition: 'framed' });

/** The finished script as bytes: the artifact publishes it as ASM, deployment fills the slots in the bytes. */
const scriptBytes = (artifact: ReturnType<typeof compileString>): Uint8Array =>
  scriptToBytecode(asmToScript(artifact.bytecode));

/** A function's four-byte dispatcher selector, as the ABI publishes it. */
const selectorOf = (artifact: ReturnType<typeof compileString>, name: string): Uint8Array =>
  new Uint8Array(Buffer.from(artifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));

// Consensus rules only: the master's unlocking bytecode leads with a witness-block push, which the additional
// standardness rules do not describe.
const relaxed = false;

interface SpendOptions {
  readonly selector: Uint8Array;
  /** The argument pushes that follow the selector in the unlocking bytecode, in the order they are pushed. */
  readonly argument?: Uint8Array;
  /** The constructor argument pushes before the program, in the order the unlocker lays them out. */
  readonly constructorPushes?: readonly Uint8Array[];
  readonly sender?: Uint8Array;
  readonly self?: Uint8Array;
  readonly value?: bigint;
  readonly kind?: number;
  readonly callerRef?: number;
  readonly originRef?: number;
  readonly validatorRef?: number;
  readonly outputRecreates?: boolean;
  readonly outputValue?: bigint;
}

/** Builds the spend of a filled master and asks the BCH-2026 machine. */
function evaluateSpend(source: string, options: SpendOptions): boolean {
  const artifact = compile(source);
  const placeholders = artifact.composition!.placeholders;
  const filled = fillPlaceholders(scriptBytes(artifact), placeholders, {
    category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
  });
  const redeemScript = new Uint8Array([
    ...(options.constructorPushes ?? []).flatMap((push) => [...encodeDataPush(push)]),
    ...filled,
  ]);
  const lock = encodeLockingBytecodeP2sh32(hash256(redeemScript));

  const callerIndex = 0;
  const masterIndex = 1;
  const callerRef = options.callerRef ?? callerIndex;
  const block: WitnessBlock = {
    kind: options.kind ?? 0,
    callerRef,
    originRef: options.originRef ?? callerRef,
    validatorRef: options.validatorRef ?? 0xffff,
    sender: options.sender ?? OWNER_LOCK,
    self: options.self ?? ADDRESS,
    value: options.value ?? 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  // The unlocker the convention describes: the witness block, the selector that leads the argument pushes, then
  // the redeem script (spec section 4 and section 17).
  const unlockingBytecode = new Uint8Array([
    ...encodeDataPush(encodeWitnessBlock(block)),
    ...encodeDataPush(options.selector),
    ...(options.argument ? [...encodeDataPush(options.argument)] : []),
    ...encodeDataPush(redeemScript),
  ]);

  const masterSource = {
    lockingBytecode: lock,
    valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
  };
  const masterOutput = options.outputRecreates === false
    ? { lockingBytecode: OWNER_LOCK, valueSatoshis: 20_000n }
    : {
      lockingBytecode: lock,
      valueSatoshis: options.outputValue ?? 20_000n,
      token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
    };

  const callerInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(7),
    sequenceNumber: 0xffffffff,
    // The user's signed P2PKH input: the root frame reads its signature's hash type.
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(2),
    sequenceNumber: 0xffffffff,
    unlockingBytecode,
  };
  const callerSource = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };
  const callerOutput = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };

  const transaction = {
    version: 2,
    inputs: [callerInput, masterInput],
    outputs: [callerOutput, masterOutput],
    locktime: 0,
  };
  const sourceOutputs = [callerSource, masterSource];

  const vm = compositionMachine(relaxed);
  return vm.stateSuccess(vm.evaluate({ inputIndex: masterIndex, sourceOutputs, transaction })) === true;
}

interface FrameOptions extends Omit<SpendOptions, 'constructorPushes'> {
  /** The `owner` constructor argument; the caller's lock by default, so `msg.sender` matches. */
  readonly owner?: Uint8Array;
  /** The `expected` constructor argument; the baked `addrX` by default, so `address(this)` matches. */
  readonly expected?: Uint8Array;
}

/** Spends `Frame`; `expected` is declared last, so the unlocker pushes it before `owner`. */
const spendFrame = ({ owner, expected, ...options }: FrameOptions): boolean => evaluateSpend(SOURCE, {
  constructorPushes: [expected ?? ADDRESS, owner ?? OWNER_LOCK],
  ...options,
});

describe('a framed master with two entry points', () => {
  const artifact = compile();
  const selectors = { bump: selectorOf(artifact, 'bump'), nudge: selectorOf(artifact, 'nudge') };
  const missing = computeFunctionSelector('missing()');

  it('accepts each entry reached by its own selector', () => {
    expect(spendFrame({ selector: selectors.bump })).toBe(true);
    expect(spendFrame({ selector: selectors.nudge })).toBe(true);
  });

  it('runs the body the selector names, not the other entry', () => {
    // `bump` needs `msg.sender == owner`; with a different owner `bump` fails but `nudge` would pass.
    expect(spendFrame({ selector: selectors.bump, owner: OTHER_LOCK })).toBe(false);
    expect(spendFrame({ selector: selectors.nudge, owner: OTHER_LOCK })).toBe(true);
    // `nudge` needs `address(this) == expected`; with a wrong `expected` `nudge` fails but `bump` would pass.
    expect(spendFrame({ selector: selectors.nudge, expected: OTHER_LOCK })).toBe(false);
    expect(spendFrame({ selector: selectors.bump, expected: OTHER_LOCK })).toBe(true);
  });

  it('refuses a selector that names no entry', () => {
    expect(spendFrame({ selector: missing })).toBe(false);
  });

  it('enforces the frame rules for every entry', () => {
    for (const selector of [selectors.bump, selectors.nudge]) {
      expect(spendFrame({ selector, sender: OTHER_LOCK })).toBe(false);
      expect(spendFrame({ selector, self: encodeLockingBytecodeP2sh32(hash256(new Uint8Array([9, 9, 9]))) }))
        .toBe(false);
      expect(spendFrame({ selector, value: 1n })).toBe(false);
      expect(spendFrame({ selector, kind: 1 })).toBe(false);
      expect(spendFrame({ selector, callerRef: 1 })).toBe(false);
      expect(spendFrame({ selector, validatorRef: 0 })).toBe(false);
      expect(spendFrame({ selector, outputRecreates: false })).toBe(false);
      expect(spendFrame({ selector, outputValue: 19_999n })).toBe(false);
    }
  });
});

describe('a framed master whose entries take an argument', () => {
  const artifact = compile(ARGUMENT_SOURCE);
  const selectors = { pick: selectorOf(artifact, 'pick'), drop: selectorOf(artifact, 'drop') };

  /** Spends `Choice` with a single integer argument; `owner` is the caller's lock by default. */
  const spendChoice = (selector: Uint8Array, argument: number): boolean =>
    evaluateSpend(ARGUMENT_SOURCE, {
      selector,
      argument: new Uint8Array([argument]),
      constructorPushes: [OWNER_LOCK],
    });

  it('reads the argument and runs the entry the selector names', () => {
    expect(spendChoice(selectors.pick, 7)).toBe(true);
    expect(spendChoice(selectors.drop, 3)).toBe(true);
    // The value the other entry requires is refused, so the argument reaches the body the selector chose.
    expect(spendChoice(selectors.pick, 3)).toBe(false);
    expect(spendChoice(selectors.drop, 7)).toBe(false);
  });
});
