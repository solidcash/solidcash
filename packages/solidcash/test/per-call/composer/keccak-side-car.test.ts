import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { FrameKind, asmToScript, scriptToBytecode, sha256, validatorAddress } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { fillPlaceholders } from '../../../../solidc/src/per-call/master/placeholders.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory,
} from '../../../../solidc/test/per-call/master/validator-input.js';
import {
  buildKeccakSideCars, keccakPreimagesOf, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import { USER_LOCK, composeAndDerive, rootOf, userInput } from '../shapes/harness.js';

/**
 * A per-call master that hashes through keccak256 compute side-cars, composed and derived by the shipped composer.
 *
 * The entry hashes two of its arguments and compares each digest with a third. The composer reads each call's
 * preimage from the argument pushes, builds one side-car per call, and the layout places them after the master's
 * input in the order the body makes the calls. The machine's verdict on the master and each side-car is the
 * assertion; no coordinate is supplied by the test.
 */

const CATEGORY = seededCategory('composer keccak side-car');
const CONTRACT_ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const MASTER_ID = 'hasher-1';

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Hasher {'
  + '   function check(bytes left, bytes right, bytes32 expected) {'
  + '     require(keccak256(left) == expected);'
  + '     require(keccak256(right) != expected);'
  + '   }'
  + '   function idle() { require(true); }'
  + ' }';

const ARTIFACTS = compileStringMulti(SOURCE, { composition: 'per-call' });
const ARTIFACT = ARTIFACTS.Hasher!;
const PROGRAM = fillPlaceholders(
  scriptToBytecode(asmToScript(ARTIFACT.bytecode)),
  ARTIFACT.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: CONTRACT_ADDRESS, templateHash: TEMPLATE_HASH },
);
const ABI = ARTIFACT.abi.find((row) => row.name === 'check')!;
const utf8 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));

/** The plan for one call: `left`, `right` and `expected` as arguments, and the side-cars hashing `hashed`. */
function planOf(
  left: Uint8Array,
  right: Uint8Array,
  expected: Uint8Array,
  hashed?: readonly Uint8Array[],
): CompositionDraftPlan {
  // The wire carries the first parameter's push last, after the dispatcher's selector.
  const pushes = [hexToBin(ABI.selector!), expected, right, left];
  const sideCars = buildKeccakSideCars(MASTER_ID, hashed ?? keccakPreimagesOf(ABI, pushes, 1));
  const master: DraftMaster = {
    master: MASTER_ID, contract: 'Hasher', functionName: 'Hasher.check()', program: PROGRAM,
    facts: {
      contract: 'Hasher', functionName: 'check', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: CONTRACT_ADDRESS, value: 0n },
    enteredBy: 'user', origin: 'user', calls: [], retval: new Uint8Array(0), segments: [[]], events: [], sends: [],
    argumentPushes: pushes, dispatches: true, redeemScript: PROGRAM,
  };
  return {
    blocks: [{ contract: 'Hasher', masters: [MASTER_ID], state: [], recovery: { [MASTER_ID]: sideCars.ids } }],
    userInputs: [{ id: 'user', index: 1 + sideCars.ids.length }],
    masters: [master],
    inputs: {
      [MASTER_ID]: {
        source: {
          lockingBytecode: encodeLockingBytecodeP2sh32(hash256(PROGRAM)), valueSatoshis: 20_000n,
          token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
        },
      },
      ...sideCars.inputs,
      user: userInput(),
    },
  };
}

const verdictsOf = (plan: CompositionDraftPlan): readonly string[] => composeAndDerive(
  plan, [ARTIFACT], [rootOf('Hasher', 'check', MASTER_ID)],
).verdicts.map((verdict) => `${verdict.participant}:${verdict.accepted ? 'accepted' : 'refused'}`);

describe('a per-call master hashing through keccak256 compute side-cars', () => {
  const LEFT = utf8('per-call keccak left');
  const RIGHT = utf8('per-call keccak right');
  const EXPECTED = keccak_256(LEFT);

  it('reads one side-car per call after its input, and every input accepts', () => {
    expect(verdictsOf(planOf(LEFT, RIGHT, EXPECTED))).toStrictEqual([
      `${MASTER_ID}:accepted`, `${MASTER_ID}/keccak-0:accepted`, `${MASTER_ID}/keccak-1:accepted`,
    ]);
  });

  it('refuses side-cars that hash other bytes than the body binds, or in another order', () => {
    expect(() => verdictsOf(planOf(LEFT, RIGHT, EXPECTED, [LEFT, LEFT]))).toThrow(/PER_CALL_DERIVATION_STALLED/);
    expect(() => verdictsOf(planOf(LEFT, RIGHT, EXPECTED, [RIGHT, LEFT]))).toThrow(/PER_CALL_DERIVATION_STALLED/);
  });

  it('refuses by name a preimage the body computes', () => {
    expect(() => keccakPreimagesOf({ ...ABI, keccakPreimageParams: ['left', null] }, [LEFT, RIGHT, EXPECTED]))
      .toThrow(/computed preimage/);
  });
});
