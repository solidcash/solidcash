import { describe, expect, it } from 'vitest';
import { compositionPlaceholders } from '@solidcash/solidc';
import {
  asmToScript, bytecodeToAsm, scriptToBytecode, validatorTemplateHash, type Artifact,
} from '@solidcash/utils';
import { deployMaster, verifyMasterDeployment } from '../../../src/framed/deploy/index.js';

/**
 * The optional third slot: the hash of the validator program.
 *
 * A master that stands alone never reads it, so a contract whose entries make no external call has no such slot. A
 * master that can be reached through a call has to check the validator it points at runs the expected program, and
 * that program's hash exists only once the validator is deployed. Both directions are pinned here, because a
 * descriptor and a script that disagree about which slots exist would fill the wrong bytes.
 */

const {
  ADDRESS_SLOT_LENGTH,
  CATEGORY_SLOT_LENGTH,
  TEMPLATE_HASH_SLOT_LENGTH,
  declaredSlots,
  placeholdersAt,
  placeholderPush,
  placeholderPushLength,
  assertPlaceholders,
  placeholdersAreEmpty,
  fillPlaceholders,
  readPlaceholders,
} = compositionPlaceholders;

const CATEGORY = Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0xa5 : 0x5a));
const ADDRESS = new Uint8Array([0xaa, 0x20, ...new Uint8Array(32).fill(0x33), 0x87]);
const TEMPLATE_HASH = new Uint8Array(32).fill(0x9c);

const HEAD = new Uint8Array([0x51, 0x75, 0x76]);
const TAIL = new Uint8Array([0x87, 0x51]);

/** A script reserving the two mandatory slots, and the third when asked for. */
const scriptWith = (withTemplateHash: boolean): {
  script: Uint8Array;
  placeholders: ReturnType<typeof placeholdersAt>;
} => {
  const categoryOffset = HEAD.length;
  const addressOffset = categoryOffset + placeholderPushLength(CATEGORY_SLOT_LENGTH);
  const templateHashOffset = addressOffset + placeholderPushLength(ADDRESS_SLOT_LENGTH);
  const placeholders = withTemplateHash
    ? placeholdersAt(categoryOffset, addressOffset, templateHashOffset)
    : placeholdersAt(categoryOffset, addressOffset);
  const script = new Uint8Array([
    ...HEAD,
    ...placeholderPush(CATEGORY_SLOT_LENGTH),
    ...placeholderPush(ADDRESS_SLOT_LENGTH),
    ...(withTemplateHash ? placeholderPush(TEMPLATE_HASH_SLOT_LENGTH) : []),
    ...TAIL,
  ]);
  return { script, placeholders };
};

describe('the validator program hash slot', () => {
  it('is declared only when the master recognises a validator', () => {
    // Two and three slots respectively, and the third is the one that names the program hash.
    expect(declaredSlots(placeholdersAt(0, 33)).map((slot) => slot.what))
      .toStrictEqual(['category', 'address']);
    expect(declaredSlots(placeholdersAt(0, 33, 70)).map((slot) => slot.what))
      .toStrictEqual(['category', 'address', 'validator program hash']);
    expect(declaredSlots(placeholdersAt(0, 33, 70))[2]!.length).toBe(TEMPLATE_HASH_SLOT_LENGTH);
  });

  it('fills all three slots and reads them back', () => {
    const { script, placeholders } = scriptWith(true);
    expect(assertPlaceholders(script, placeholders)).toBeUndefined();
    expect(placeholdersAreEmpty(script, placeholders)).toBe(true);

    const filled = fillPlaceholders(script, placeholders, {
      category: CATEGORY, contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
    });
    expect(filled.length).toBe(script.length);
    expect([...filled.subarray(0, HEAD.length)]).toStrictEqual([...HEAD]);
    expect([...filled.subarray(filled.length - TAIL.length)]).toStrictEqual([...TAIL]);

    const read = readPlaceholders(filled, placeholders);
    expect([...read.category]).toStrictEqual([...CATEGORY]);
    expect([...read.contractAddress]).toStrictEqual([...ADDRESS]);
    expect([...read.templateHash!]).toStrictEqual([...TEMPLATE_HASH]);
  });

  it('leaves the third slot absent when the descriptor declares only two', () => {
    const { script, placeholders } = scriptWith(false);
    const filled = fillPlaceholders(script, placeholders, { category: CATEGORY, contractAddress: ADDRESS });
    expect(readPlaceholders(filled, placeholders).templateHash).toBeUndefined();
  });

  it('refuses a program hash when the descriptor declares no slot for one', () => {
    const { script, placeholders } = scriptWith(false);
    expect(() => fillPlaceholders(script, placeholders, {
      category: CATEGORY, contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
    })).toThrow(/declares no validator program hash slot/);
  });

  it('refuses to leave the program hash out when the descriptor declares a slot for it', () => {
    const { script, placeholders } = scriptWith(true);
    expect(() => fillPlaceholders(script, placeholders, { category: CATEGORY, contractAddress: ADDRESS }))
      .toThrow(/a value is required/);
  });

  it('refuses a program hash of the wrong length', () => {
    const { script, placeholders } = scriptWith(true);
    expect(() => fillPlaceholders(script, placeholders, {
      category: CATEGORY, contractAddress: ADDRESS, templateHash: new Uint8Array(31),
    })).toThrow(/a validator program hash is 32 bytes/);
  });

  it('refuses a descriptor whose third offset does not point at a reserved push', () => {
    const { script } = scriptWith(false);
    // The third offset sits past the end of a script that reserves only two slots.
    expect(() => assertPlaceholders(script, placeholdersAt(HEAD.length, HEAD.length + 33, script.length - 1)))
      .toThrow(/outside|not a reserved/);
  });

  it('ties the declared slot to the bytes it describes', () => {
    // The third slot is reserved with the same push form as the others, so its payload starts after that prefix.
    const { script, placeholders } = scriptWith(true);
    const offset = placeholders.templateHashOffset!;
    expect(script[offset]).toBe(TEMPLATE_HASH_SLOT_LENGTH);
    expect([...script.subarray(offset + 1, offset + 1 + TEMPLATE_HASH_SLOT_LENGTH)])
      .toStrictEqual(new Array<number>(TEMPLATE_HASH_SLOT_LENGTH).fill(0));
  });
});

describe('deploying a master that recognises a validator', () => {
  const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52, 0x75, 0x76]);

  /** An artifact over a script reserving all three slots, published the way a compiler publishes one. */
  const artifactWithThreeSlots = (): Artifact => {
    const { script } = scriptWith(true);
    const artifact: Partial<Artifact> = {
      contractName: 'Ledger',
      constructorInputs: [],
      abi: [],
      bytecode: bytecodeToAsm(script),
      source: 'contract Ledger {}',
      composition: {
        convention: 'framed',
        placeholders: {
          version: 1,
          categoryOffset: HEAD.length,
          addressOffset: HEAD.length + placeholderPushLength(CATEGORY_SLOT_LENGTH),
          templateHashOffset: HEAD.length + placeholderPushLength(CATEGORY_SLOT_LENGTH)
            + placeholderPushLength(ADDRESS_SLOT_LENGTH),
        },
      },
    };
    return artifact as Artifact;
  };

  it('fills the program hash into the reserved slot and verifies the result', () => {
    const artifact = artifactWithThreeSlots();
    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    expect(() => verifyMasterDeployment(deployed, artifact, CATEGORY, VALIDATOR_PROGRAM)).not.toThrow();

    // The slot holds the hash of the program the master is told to expect.
    const read = readPlaceholders(deployed.script, artifact.composition!.placeholders);
    expect([...read.templateHash!]).toStrictEqual([...validatorTemplateHash(VALIDATOR_PROGRAM)]);
  });

  it('leaves the script the same length, so every published offset still describes it', () => {
    const artifact = artifactWithThreeSlots();
    const before = scriptToBytecode(asmToScript(artifact.bytecode));
    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    expect(deployed.script.length).toBe(before.length);
  });

  it('reserves nothing for the hash when the descriptor declares two slots', () => {
    // A two-slot descriptor is a standalone master: a fill touches the category and the address and nothing else.
    const { script, placeholders } = scriptWith(false);
    const filled = fillPlaceholders(script, placeholders, { category: CATEGORY, contractAddress: ADDRESS });
    expect(readPlaceholders(filled, placeholders).templateHash).toBeUndefined();
    expect(filled.length).toBe(script.length);
  });
});
