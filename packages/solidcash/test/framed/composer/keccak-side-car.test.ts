import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { FrameKind, asmToScript, scriptToBytecode, sha256, validatorAddress } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { fillPlaceholders } from '../../../../solidc/src/framed/master/placeholders.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';
import {
  buildKeccakSideCars, keccakPreimagesOf, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { USER_LOCK, composeAndDerive, rootOf, userInput } from '../shapes/harness.js';

/**
 * A framed master that hashes through keccak256 compute side-cars, composed and derived by the shipped composer.
 *
 * `check` hashes two of its arguments and compares each digest with a third: the composer reads each call's preimage
 * from the argument pushes. `digest` hashes values it computes, one call nested in the other as a signed-message
 * digest is: the composer builds those side-cars around placeholders and the derivation learns each preimage from
 * the body's own bind. The layout places one side-car per call after the master's input, in the order the body makes
 * the calls. The machine's verdict on the master and each side-car is the assertion; no coordinate is supplied by the
 * test.
 */

const CATEGORY = seededCategory('composer keccak side-car');
const CONTRACT_ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const MASTER_ID = 'hasher-1';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Hasher {'
  + '   function check(bytes left, bytes right, bytes32 expected) {'
  + '     require(keccak256(left) == expected);'
  + '     require(keccak256(right) != expected);'
  + '   }'
  + '   function digest(bytes prefix, bytes left, bytes right, bytes32 expected) {'
  + '     require(keccak256(bytes.concat(prefix, keccak256(bytes.concat(left, right)))) == expected);'
  + '   }'
  + '   function idle() { require(true); }'
  + ' }';

const ARTIFACTS = compileStringMulti(SOURCE, { composition: 'framed' });
const ARTIFACT = ARTIFACTS.Hasher!;
const PROGRAM = fillPlaceholders(
  scriptToBytecode(asmToScript(ARTIFACT.bytecode)),
  ARTIFACT.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: CONTRACT_ADDRESS, templateHash: TEMPLATE_HASH },
);
const utf8 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));

/** The plan for one call of `entry` with `args`, first parameter first, and its side-cars hashing `hashed`. */
function planOf(
  entry: string,
  args: readonly Uint8Array[],
  hashed?: readonly Uint8Array[],
): CompositionDraftPlan {
  const abi = ARTIFACT.abi.find((row) => row.name === entry)!;
  // The wire carries the first parameter's push last, after the dispatcher's selector.
  const pushes = [hexToBin(abi.selector!), ...[...args].reverse()];
  const sideCars = buildKeccakSideCars(MASTER_ID, hashed ?? keccakPreimagesOf(abi, pushes, 1));
  const master: DraftMaster = {
    master: MASTER_ID, contract: 'Hasher', functionName: `Hasher.${entry}()`, program: PROGRAM,
    facts: {
      contract: 'Hasher', functionName: entry, kind: FrameKind.ROOT,
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
    computedWitnesses: sideCars.computedWitnesses,
  };
}

const verdictsOf = (entry: string, plan: CompositionDraftPlan): readonly string[] => composeAndDerive(
  plan, [ARTIFACT], [rootOf('Hasher', entry, MASTER_ID)],
).verdicts.map((verdict) => `${verdict.participant}:${verdict.accepted ? 'accepted' : 'refused'}`);

const ACCEPTED = [`${MASTER_ID}:accepted`, `${MASTER_ID}/keccak-0:accepted`, `${MASTER_ID}/keccak-1:accepted`];

describe('a framed master hashing through keccak256 compute side-cars', () => {
  const LEFT = utf8('framed keccak left');
  const RIGHT = utf8('framed keccak right');
  const EXPECTED = keccak_256(LEFT);

  it('reads one side-car per call after its input, and every input accepts', () => {
    expect(verdictsOf('check', planOf('check', [LEFT, RIGHT, EXPECTED]))).toStrictEqual(ACCEPTED);
  });

  it('refuses side-cars that hash other bytes than the body binds, or in another order', () => {
    expect(() => verdictsOf('check', planOf('check', [LEFT, RIGHT, EXPECTED], [LEFT, LEFT])))
      .toThrow(/FRAMED_DERIVATION_STALLED/);
    expect(() => verdictsOf('check', planOf('check', [LEFT, RIGHT, EXPECTED], [RIGHT, LEFT])))
      .toThrow(/FRAMED_DERIVATION_STALLED/);
  });

  describe('with preimages the body computes', () => {
    const PREFIX = utf8('framed signed digest:');
    const INNER = keccak_256(Uint8Array.from([...LEFT, ...RIGHT]));
    const DIGEST = keccak_256(Uint8Array.from([...PREFIX, ...INNER]));

    it('learns each preimage from the body\'s bind, the nested call included, and every input accepts', () => {
      expect(verdictsOf('digest', planOf('digest', [PREFIX, LEFT, RIGHT, DIGEST]))).toStrictEqual(ACCEPTED);
    });

    it('learns only what the body binds, so the master still refuses a digest its body rejects', () => {
      expect(verdictsOf('digest', planOf('digest', [PREFIX, LEFT, RIGHT, INNER]))).toStrictEqual([
        `${MASTER_ID}:refused`, `${MASTER_ID}/keccak-0:accepted`, `${MASTER_ID}/keccak-1:accepted`,
      ]);
    });
  });
});
