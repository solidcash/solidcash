import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  argsHash, asmToScript, buildPushdataCommitment, computeFunctionSelector, computeFunctionSignature,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory, validatorFacetPlacements, validatorSpend,
} from './validator-input.js';

/**
 * A self-settling master beside the validator of its own category (spec S2).
 *
 * The caller is its contract's only master and makes a message call, so a validator of its category covers the
 * frame while the master settles its own record. The validator's UTXO is a mutable token of the contract's category
 * at the contract's own address, recreated in place, which the master's census would otherwise take for an
 * undeclared record. The census admits exactly that token: the category's mutable NFT with an empty commitment, at
 * the address, on both sides of one index. A second mutable token with a commitment, or one at another lock, is still
 * an undeclared record and is refused.
 */

const label = (text: string): Uint8Array => sha256(new TextEncoder().encode(text));
const CATEGORY_CALLER = seededCategory('beside validator caller');
const CATEGORY_CALLEE = seededCategory('beside validator callee');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(label('beside validator user').slice(0, 20));
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   int public counter;'
  + '   function callIt() {'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     this.counter = this.counter + 1;'
  + '   }'
  + ' }';
const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const program = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
  const artifact = artifacts[name]!;
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
  });
};
const CALLER_PROGRAM = program('Caller', CATEGORY_CALLER, ADDRESS_CALLER);
const CALLEE_PROGRAM = program('Callee', CATEGORY_CALLEE, ADDRESS_CALLEE);
const counterView = (counter: bigint): Uint8Array => new Uint8Array(Buffer.from(
  buildPushdataCommitment(artifacts.Caller!.stateLayout!, { counter }, 0), 'hex',
));
const BEFORE = counterView(5n);
const AFTER = counterView(6n);
const VALUE = 20_000n;
const EMPTY = new Uint8Array(0);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];
type Capability = 'minting' | 'mutable';
const token = (category: Uint8Array, capability: Capability, commitment: Uint8Array = EMPTY): VmOutput['token'] =>
  ({ category, amount: 0n, nft: { capability, commitment } });

/** Inputs: the caller, its record, its validator and the facets, the user, the callee, then an optional extra pair. */
const CALLER = 0;
const STATE = 1;
const VALIDATOR = 2;
const FACETS = validatorFacetPlacements();
const USER = VALIDATOR + 1 + FACETS.length;
const CALLEE = USER + 1;
const EXTRA = CALLEE + 1;

/** A second mutable token of the caller's category, spent and recreated at `EXTRA`. */
interface ExtraPair {
  readonly lock: Uint8Array;
  readonly commitment: Uint8Array;
}

interface Verdicts {
  readonly caller: boolean;
  readonly callee: boolean;
  /** The validator and every facet. */
  readonly validator: boolean;
}

/** `minted` is an output past every other, which no input carries. */
function verdicts(extra?: ExtraPair, minted?: VmOutput): Verdicts {
  const validator = validatorSpend(CATEGORY_CALLER, { roots: [CALLER], masters: [CALLER, CALLEE], settles: [] });
  const outpoint = (index: number): Uint8Array => label(`beside validator outpoint ${index}`);
  const input = (index: number, unlockingBytecode: Uint8Array): VmInput => ({
    outpointIndex: 0, outpointTransactionHash: outpoint(index), sequenceNumber: 0xffffffff, unlockingBytecode,
  });
  const callerBlock: WitnessBlock = {
    kind: 0, callerRef: USER, originRef: USER, validatorRef: VALIDATOR, sender: USER_LOCK, self: ADDRESS_CALLER,
    value: 0n, retval: EMPTY,
    calls: [{
      kind: 1, target: ADDRESS_CALLEE, value: 0n, calleeRef: CALLEE,
      argsHash: argsHash(CALLEE_SELECTOR, EMPTY), result: EMPTY,
    }],
    segments: [
      [{ in: STATE, out: STATE, viewIn: BEFORE, viewOut: BEFORE }],
      [{ in: STATE, out: STATE, viewIn: BEFORE, viewOut: AFTER }],
    ],
    events: [], sends: [],
  };
  const calleeBlock: WitnessBlock = {
    kind: 1, callerRef: CALLER, originRef: USER, validatorRef: VALIDATOR, sender: ADDRESS_CALLER, self: ADDRESS_CALLEE,
    value: 0n, retval: EMPTY, calls: [], segments: [[]], events: [], sends: [],
  };
  const callerMaster: VmOutput = {
    lockingBytecode: encodeLockingBytecodeP2sh32(hash256(CALLER_PROGRAM)), valueSatoshis: VALUE,
    token: token(CATEGORY_CALLER, 'minting'),
  };
  const calleeMaster: VmOutput = {
    lockingBytecode: encodeLockingBytecodeP2sh32(hash256(CALLEE_PROGRAM)), valueSatoshis: VALUE,
    token: token(CATEGORY_CALLEE, 'minting'),
  };
  const validatorOutput: VmOutput = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };
  const record = (commitment: Uint8Array): VmOutput => ({
    lockingBytecode: dataRecordLock(CATEGORY_CALLER), valueSatoshis: VALUE,
    token: token(CATEGORY_CALLER, 'mutable', commitment),
  });
  const user: VmOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const extraPair: VmOutput[] = extra === undefined ? [] : [{
    lockingBytecode: extra.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', extra.commitment),
  }];
  const inputs: VmInput[] = [
    input(CALLER, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(CALLER_PROGRAM),
    ])),
    input(STATE, encodeDataPush(new Uint8Array([1]))),
    input(VALIDATOR, validator.unlockingBytecode),
    ...FACETS.map((facet, at) => ({ ...facet.input, outpointTransactionHash: outpoint(VALIDATOR + 1 + at) })),
    input(USER, callerUnlockingBytecode()),
    input(CALLEE, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(calleeBlock)), ...encodeDataPush(CALLEE_SELECTOR),
      ...encodeDataPush(CALLEE_PROGRAM),
    ])),
    ...(extra === undefined ? [] : [input(EXTRA, encodeDataPush(new Uint8Array([1])))]),
  ];
  const facetOutputs = FACETS.map((facet) => facet.output);
  const sourceOutputs: VmOutput[] = [
    callerMaster, record(BEFORE), validatorOutput, ...facetOutputs, user, calleeMaster, ...extraPair,
  ];
  const outputs: VmOutput[] = [
    callerMaster, record(AFTER), validatorOutput, ...facetOutputs, user, calleeMaster, ...extraPair,
    ...(minted === undefined ? [] : [minted]),
  ];
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const accepted = (inputIndex: number): boolean =>
    vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
  return {
    caller: accepted(CALLER),
    callee: accepted(CALLEE),
    validator: accepted(VALIDATOR) && FACETS.every((_, at) => accepted(VALIDATOR + 1 + at)),
  };
}

describe('a self-settling master beside the validator of its own category', () => {
  it('settles its record while its validator is recreated in place', () => {
    expect(verdicts()).toStrictEqual({ caller: true, callee: true, validator: true });
  });

  it('refuses a second mutable token of its category with a commitment, at the contract address', () => {
    expect(verdicts({ lock: ADDRESS_CALLER, commitment: AFTER }).caller).toBe(false);
  });

  it('refuses a second mutable token of its category at another lock', () => {
    expect(verdicts({ lock: dataRecordLock(CATEGORY_CALLER), commitment: EMPTY }).caller).toBe(false);
    expect(verdicts({ lock: dataRecordLock(CATEGORY_CALLER), commitment: AFTER }).caller).toBe(false);
  });

  it('refuses an immutable NFT or a fungible amount of its category, which its validator does not settle', () => {
    // S2's census is the caller's alone: the validator settles no contract here, so it and the callee accept.
    const minted = (held: VmOutput['token']): VmOutput =>
      ({ lockingBytecode: USER_LOCK, valueSatoshis: VALUE, token: held });
    const forged = { category: CATEGORY_CALLER, amount: 0n, nft: { capability: 'none' as const, commitment: AFTER } };
    expect(verdicts(undefined, minted(forged))).toStrictEqual({ caller: false, callee: true, validator: true });
    expect(verdicts(undefined, minted({ category: CATEGORY_CALLER, amount: 3n })))
      .toStrictEqual({ caller: false, callee: true, validator: true });
  });
});
