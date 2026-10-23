import { describe, expect, it } from 'vitest';
import { compositionPlaceholders } from '@solidcash/solidc';

/**
 * Deployment-time constants in a master script, driven through the shipped module.
 *
 * A compiled master reserves a zero-filled slot for the state category and one for the contract address, and
 * publishes where they are. Deployment fills them. The failure this guards against is a mistaken offset: it would
 * overwrite live script bytes and produce a contract that rejects every spend, with nothing to say why.
 */

const {
  ADDRESS_SLOT_LENGTH,
  CATEGORY_SLOT_LENGTH,
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

/** A script with some live bytes, then the two reserved slots, then more live bytes. */
const scriptWithSlots = (): { script: Uint8Array; placeholders: ReturnType<typeof placeholdersAt> } => {
  const head = new Uint8Array([0x51, 0x75, 0x76]); // OP_1 OP_DROP OP_DUP, arbitrary but non-zero
  const tail = new Uint8Array([0x87, 0x51]); // OP_EQUAL OP_1
  const placeholders = placeholdersAt(head.length, head.length + placeholderPushLength(CATEGORY_SLOT_LENGTH));
  const script = new Uint8Array([
    ...head,
    ...placeholderPush(CATEGORY_SLOT_LENGTH),
    ...placeholderPush(ADDRESS_SLOT_LENGTH),
    ...tail,
  ]);
  return { script, placeholders };
};

describe('deployment-time constants', () => {
  it('reserves two zero-filled slots and leaves the rest of the script alone', () => {
    const { script, placeholders } = scriptWithSlots();
    expect(assertPlaceholders(script, placeholders)).toBeUndefined();
    expect(placeholdersAreEmpty(script, placeholders)).toBe(true);
    // The live bytes before and after are untouched by reserving the slots.
    expect([...script.subarray(0, 3)]).toStrictEqual([0x51, 0x75, 0x76]);
    expect([...script.subarray(script.length - 2)]).toStrictEqual([0x87, 0x51]);
  });

  it('fills both slots without changing the script length or the surrounding bytes', () => {
    const { script, placeholders } = scriptWithSlots();
    const filled = fillPlaceholders(script, placeholders, { category: CATEGORY, contractAddress: ADDRESS });
    expect(filled.length).toBe(script.length);
    expect([...filled.subarray(0, 3)]).toStrictEqual([0x51, 0x75, 0x76]);
    expect([...filled.subarray(filled.length - 2)]).toStrictEqual([0x87, 0x51]);
    expect(placeholdersAreEmpty(filled, placeholders)).toBe(false);
  });

  it('reads back exactly the values that were filled in', () => {
    const { script, placeholders } = scriptWithSlots();
    const filled = fillPlaceholders(script, placeholders, { category: CATEGORY, contractAddress: ADDRESS });
    const read = readPlaceholders(filled, placeholders);
    expect([...read.category]).toStrictEqual([...CATEGORY]);
    expect([...read.contractAddress]).toStrictEqual([...ADDRESS]);
  });

  it('refuses an offset that does not point at a reserved zero push', () => {
    const { script } = scriptWithSlots();
    // One byte off: the slot's opcode is no longer where the descriptor says it is.
    expect(() => assertPlaceholders(script, placeholdersAt(4, 38))).toThrow(/not a reserved/);
    // Pointing at the live head instead of a slot.
    expect(() => assertPlaceholders(script, placeholdersAt(0, 38))).toThrow(/not a reserved/);
  });

  it('refuses an offset outside the script', () => {
    const { script, placeholders } = scriptWithSlots();
    expect(() => assertPlaceholders(script, placeholdersAt(script.length - 4, placeholders.addressOffset)))
      .toThrow(/outside/);
  });

  it('refuses to fill a script whose slots are not where the descriptor says', () => {
    const { script } = scriptWithSlots();
    expect(() => fillPlaceholders(script, placeholdersAt(4, 38), { category: CATEGORY, contractAddress: ADDRESS }))
      .toThrow(/not a reserved/);
  });

  it('refuses a category or address of the wrong length before touching the script', () => {
    const { script, placeholders } = scriptWithSlots();
    expect(() => fillPlaceholders(script, placeholders, {
      category: new Uint8Array(31).fill(0x5a), contractAddress: ADDRESS,
    })).toThrow(/a category is 32 bytes/);
    expect(() => fillPlaceholders(script, placeholders, {
      category: CATEGORY, contractAddress: new Uint8Array(34),
    })).toThrow(/a contract address is 35 bytes/);
  });

  it('refuses a descriptor from a different schema version', () => {
    const { script, placeholders } = scriptWithSlots();
    const wrongVersion = { ...placeholders, version: 2 } as unknown as typeof placeholders;
    expect(() => assertPlaceholders(script, wrongVersion)).toThrow(/unsupported placeholder version/);
  });
});
