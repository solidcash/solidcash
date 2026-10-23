import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash160, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { assertPlaceholders, fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { categorySlotValue, dataRecordLock, seededCategory } from './validator-input.js';

/**
 * A contract whose constructor body runs behind the master head.
 *
 * A framed master dispatches its entry points by selector behind one head, and a constructor is one more body the
 * head can reach: it shares the same frame, so the head precedes it exactly as it precedes an entry. The constructor
 * is where a contract's immutable references are established, so the program has to carry its body, and the value it
 * stores has to be the value an entry later reads.
 *
 * Each case below compiles the source through the shipped compiler, fills the deployment slots the way a deployment
 * fills them, and asks the BCH-2026 machine for a verdict on the master's own input. The constructor spend and the
 * entry spend are chained: the record commitment the constructor's body computed is the one the entry's body reads,
 * so the value the entry requires is provably the value the constructor stored.
 */

const CATEGORY = seededCategory('constructor body');
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]); // OP_1 OP_2, any program the address rule accepts
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));
/** The data record sits at the data-NFT covenant, which the master pins. */
const RECORD_LOCK = dataRecordLock(CATEGORY);
const VALUE = 20_000n;

const ADMIN = new Uint8Array(20).fill(0x11);
const OTHER_ADMIN = new Uint8Array(20).fill(0x22);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Vault {'
  + '   bytes20 immutable deployer;'
  + '   constructor(bytes20 admin) { this.deployer = hash160(admin); }'
  + '   function check(bytes20 admin) { require(this.deployer == hash160(admin)); }'
  + ' }';

const artifact = compileString(SOURCE, { composition: 'framed' });
const stateLayout = artifact.stateLayout!;
const program = fillPlaceholders(
  scriptToBytecode(asmToScript(artifact.bytecode)),
  artifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);
const lock = encodeLockingBytecodeP2sh32(hash256(program));

const selectorOf = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(artifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));
const CONSTRUCTOR_SELECTOR = selectorOf('__construct');
const CHECK_SELECTOR = selectorOf('check');

/** A data-NFT commitment holding the single immutable field, in the shipped encoder's form. */
const commitment = (deployer: Uint8Array): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(stateLayout, { deployer }, 0), 'hex'));

const EMPTY = commitment(new Uint8Array(20));
const STORED = commitment(hash160(ADMIN));

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmInput = NonNullable<VmProgram['transaction']>['inputs'][number];
type VmOutput = NonNullable<VmProgram['transaction']>['outputs'][number];

const token = (
  capability: 'minting' | 'mutable',
  commitmentBytes: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category: CATEGORY, amount: 0n, nft: { capability, commitment: commitmentBytes } });

const MASTER_INDEX = 1;
const CALLER_INDEX = 0;
const RECORD_INDEX = 2;
const SPARE_INDEX = 3;

interface Options {
  /** The selector the unlocking bytecode dispatches. */
  readonly selector: Uint8Array;
  /** The body's argument push, above the selector. */
  readonly argument?: Uint8Array;
  /** The commitment the record input spends. */
  readonly before: Uint8Array;
  /** The commitment the record output must carry. */
  readonly after: Uint8Array;
  /** The frame's declared record indices, defaulting to the record the transaction spends and writes. */
  readonly declared?: RecordEntry;
  /** A frame `self` the contract was not deployed at. */
  readonly self?: Uint8Array;
  /**
   * The outpoint the caller's coin, input 0, spends. A constructor spend defaults to the category's genesis
   * outpoint, the only one its arm accepts; an entry's to an ordinary coin.
   */
  readonly callerOutpoint?: { readonly hash: Uint8Array; readonly index: number };
}

/** Builds the spend of the filled master and the record its frame declares, then asks the BCH-2026 machine. */
function verdict(options: Options): boolean {
  const declaration = options.declared
    ?? { in: RECORD_INDEX, out: RECORD_INDEX, viewIn: options.before, viewOut: options.after };

  const block: WitnessBlock = {
    kind: 0,
    callerRef: CALLER_INDEX,
    originRef: CALLER_INDEX,
    validatorRef: 0xffff,
    sender: OWNER_LOCK,
    self: options.self ?? ADDRESS,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[declaration]],
    events: [],
    sends: [],
  };

  const plainInput = (fillByte: number): VmInput => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(fillByte),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  });

  const inputs: VmInput[] = [];
  const outputs: VmOutput[] = [];
  const sourceOutputs: VmProgram['sourceOutputs'] = [];
  const callerOutpoint = options.callerOutpoint ?? (options.selector === CONSTRUCTOR_SELECTOR
    ? { hash: CATEGORY, index: 0 } : { hash: new Uint8Array(32).fill(7), index: 0 });
  inputs[CALLER_INDEX] = {
    outpointIndex: callerOutpoint.index, outpointTransactionHash: callerOutpoint.hash, sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  outputs[CALLER_INDEX] = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };
  sourceOutputs[CALLER_INDEX] = outputs[CALLER_INDEX];
  // The unlocker the convention describes: the witness block, then the selector, then the body's argument pushes.
  inputs[MASTER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(options.selector),
      ...(options.argument ? [...encodeDataPush(options.argument)] : []),
      ...encodeDataPush(program),
    ]),
  };
  outputs[MASTER_INDEX] = { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting') };
  sourceOutputs[MASTER_INDEX] = outputs[MASTER_INDEX];
  inputs[SPARE_INDEX] = plainInput(SPARE_INDEX + 2);
  outputs[SPARE_INDEX] = { lockingBytecode: OWNER_LOCK, valueSatoshis: VALUE };
  sourceOutputs[SPARE_INDEX] = outputs[SPARE_INDEX];
  inputs[RECORD_INDEX] = plainInput(RECORD_INDEX + 2);
  outputs[RECORD_INDEX] = {
    lockingBytecode: RECORD_LOCK, valueSatoshis: VALUE, token: token('mutable', options.after),
  };
  sourceOutputs[RECORD_INDEX] = {
    lockingBytecode: RECORD_LOCK, valueSatoshis: VALUE, token: token('mutable', options.before),
  };

  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({
    inputIndex: MASTER_INDEX,
    sourceOutputs,
    transaction: { version: 2, inputs, outputs, locktime: 0 },
  })) === true;
}

describe('a framed master for a contract with a constructor', () => {
  it('publishes the convention, its deployment slots, and the constructor as a dispatched body', () => {
    expect(artifact.composition?.convention).toBe('framed');
    assertPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders);
    // The constructor is not an entry point, but it is a selector the head's dispatcher reaches, so the program
    // carries its body and the ABI publishes the selector.
    expect(CONSTRUCTOR_SELECTOR.length).toBe(4);
    expect(artifact.abi.map((entry) => entry.name)).toContain('__construct');
  });

  it('stores the constructor argument\'s hash and lets the entry read it back', () => {
    // The constructor's own frame computes the value; the commitment the record output carries is what the body
    // wrote, so the machine only accepts a spend whose output agrees with the computation.
    expect(verdict({
      selector: CONSTRUCTOR_SELECTOR, argument: ADMIN, before: EMPTY, after: STORED,
    })).toBe(true);
    // The entry's frame spends the commitment the constructor's frame wrote and reads the same value back.
    expect(verdict({
      selector: CHECK_SELECTOR, argument: ADMIN, before: STORED, after: STORED,
    })).toBe(true);
  });

  it('refuses a constructor argument whose hash is not the commitment the spend writes', () => {
    // The same spend, with the argument mutated: the body computes `hash160(OTHER_ADMIN)` and the output still
    // carries `hash160(ADMIN)`, so the write's covenant refuses. The faithful spend beside it is the control.
    expect(verdict({ selector: CONSTRUCTOR_SELECTOR, argument: ADMIN, before: EMPTY, after: STORED })).toBe(true);
    expect(verdict({
      selector: CONSTRUCTOR_SELECTOR, argument: OTHER_ADMIN, before: EMPTY, after: STORED,
    })).toBe(false);
  });

  it('refuses an entry whose record does not carry the value the constructor stored', () => {
    // The entry requires `hash160(ADMIN)`. The control's record input carries another value while its output
    // preserves it, so the state transition is well formed and the only thing left to refuse is the entry's own
    // read of the value the constructor stored.
    expect(verdict({ selector: CHECK_SELECTOR, argument: ADMIN, before: STORED, after: STORED })).toBe(true);
    const other = commitment(hash160(OTHER_ADMIN));
    expect(verdict({ selector: CHECK_SELECTOR, argument: ADMIN, before: other, after: other })).toBe(false);
  });

  it('enforces the head\'s frame rules for the constructor body too', () => {
    // The constructor runs under the same head as every entry, so a frame the head rejects is rejected before the
    // body runs. `self` is one field the head compares with the address slot the deployment filled.
    expect(verdict({ selector: CONSTRUCTOR_SELECTOR, argument: ADMIN, before: EMPTY, after: STORED })).toBe(true);
    expect(verdict({
      selector: CONSTRUCTOR_SELECTOR,
      argument: ADMIN,
      before: EMPTY,
      after: STORED,
      self: encodeLockingBytecodeP2sh32(hash256(new Uint8Array([9, 9, 9]))),
    })).toBe(false);
  });

  it('runs the constructor only where input 0 spends the category\'s genesis outpoint', () => {
    // Only the genesis spends `(category, 0)`, so a live master cannot run its constructor again. Another output of
    // the funding transaction, another coin, and the category's bytes reversed are refused beside the accepted one.
    const spend = (hash: Uint8Array, index: number): boolean => verdict({
      selector: CONSTRUCTOR_SELECTOR, argument: ADMIN, before: EMPTY, after: STORED, callerOutpoint: { hash, index },
    });
    expect(spend(CATEGORY, 0)).toBe(true);
    expect(spend(CATEGORY, 1)).toBe(false);
    expect(spend(new Uint8Array(32).fill(7), 0)).toBe(false);
    expect(spend(categorySlotValue(CATEGORY), 0)).toBe(false);
  });
});
