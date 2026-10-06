import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Opcodes } from '@bitauth/libauth';
import {
  CONTRACT_LOCK_LENGTH,
  TokenCapability,
  categoryPin,
  categoryPinScript,
  isUserAddress,
  isValidContractAddress,
  validatorAddress,
  validatorRedeemScript,
  validatorTemplateHash,
} from '../../src/framed/index.js';
import { buildMasterUnlockingBytecode, splitFirstPush } from '../../src/framed/witness-block.js';
import { encodeArgumentPayload } from '../../src/framed/canonical.js';
import { expectFramedRejection, toBytes, toHex, toWitnessBlock } from './helpers.js';
import {
  ADDRESS_A,
  ADDRESS_A_ALT_PROGRAM,
  ADDRESS_B,
  CATEGORY_A,
  CATEGORY_B,
  CATEGORY_PIN_SCRIPT_A,
  LOADER_CODE_A,
  MASTER_LOADER_LOCK_A,
  MASTER_LOADER_LOCK_B,
  USER_LOCK,
  VALIDATOR_REDEEM_SCRIPT_A,
  VALIDATOR_TEMPLATE,
  VALIDATOR_TEMPLATE_ALT,
  VALIDATOR_TEMPLATE_HASH,
} from './vectors/identity.js';
import { BLOCKS } from './vectors/witness-block.js';

describe('category pin', () => {
  it('is the category followed by the capability byte', () => {
    const pinned = categoryPin(toBytes(CATEGORY_A), TokenCapability.MUTABLE);
    expect(pinned.length).toBe(33);
    expect(toHex(pinned)).toBe(`${CATEGORY_A}01`);
  });

  it('rejects a category that is not 32 bytes and an unknown capability', () => {
    expectFramedRejection(() => categoryPin(new Uint8Array(31), TokenCapability.NONE));
    expectFramedRejection(() => categoryPin(toBytes(CATEGORY_A), 0x03));
  });

  it('builds the input-side script the vector records', () => {
    const script = categoryPinScript(toBytes(CATEGORY_A), TokenCapability.MUTABLE);
    expect(toHex(script)).toBe(CATEGORY_PIN_SCRIPT_A);
    // The script is the 0x21 push of the 33-byte pin, then three opcodes: 1 + 33 + 3 bytes.
    expect(script.length).toBe(37);
    expect(script[0]).toBe(33);
    // The pin is the category in the chain's order: the reverse of the display-order id, then the capability.
    const chainOrder = CATEGORY_A.match(/../g)!.reverse().join('');
    expect(toHex(script.subarray(1, 34))).toBe(`${chainOrder}01`);
    expect(script[34]).toBe(Opcodes.OP_INPUTINDEX);
    expect(script[35]).toBe(Opcodes.OP_UTXOTOKENCATEGORY);
    expect(script[36]).toBe(Opcodes.OP_EQUALVERIFY);
  });
});

describe('validator program identity', () => {
  it('hashes the validator program with SHA256', () => {
    const expected = createHash('sha256').update(toBytes(VALIDATOR_TEMPLATE)).digest('hex');
    expect(toHex(validatorTemplateHash(toBytes(VALIDATOR_TEMPLATE)))).toBe(expected);
    expect(toHex(validatorTemplateHash(toBytes(VALIDATOR_TEMPLATE)))).toBe(VALIDATOR_TEMPLATE_HASH);
  });

  it('pushes the pinned category in front of the program', () => {
    expect(toHex(validatorRedeemScript(toBytes(CATEGORY_A), toBytes(VALIDATOR_TEMPLATE))))
      .toBe(VALIDATOR_REDEEM_SCRIPT_A);
  });
});

describe('validator address', () => {
  it('is deterministic and a contract lock', () => {
    const first = validatorAddress(toBytes(CATEGORY_A), toBytes(VALIDATOR_TEMPLATE));
    const second = validatorAddress(toBytes(CATEGORY_A), toBytes(VALIDATOR_TEMPLATE));
    expect(toHex(first)).toBe(ADDRESS_A);
    expect(toHex(second)).toBe(ADDRESS_A);
    expect(first.length).toBe(CONTRACT_LOCK_LENGTH);
  });

  it('differs for a different category and for a different validator program', () => {
    expect(ADDRESS_B).not.toBe(ADDRESS_A);
    expect(ADDRESS_A_ALT_PROGRAM).not.toBe(ADDRESS_A);
    expect(toHex(validatorAddress(toBytes(CATEGORY_B), toBytes(VALIDATOR_TEMPLATE)))).toBe(ADDRESS_B);
    expect(toHex(validatorAddress(toBytes(CATEGORY_A), toBytes(VALIDATOR_TEMPLATE_ALT))))
      .toBe(ADDRESS_A_ALT_PROGRAM);
  });

  it('recognises a user address and a contract address', () => {
    expect(isUserAddress(toBytes(USER_LOCK))).toBe(true);
    expect(isUserAddress(toBytes(ADDRESS_A))).toBe(false);
    expect(isValidContractAddress(toBytes(ADDRESS_A), toBytes(CATEGORY_A), toBytes(VALIDATOR_TEMPLATE)))
      .toBe(true);
    expect(isValidContractAddress(toBytes(ADDRESS_B), toBytes(CATEGORY_A), toBytes(VALIDATOR_TEMPLATE)))
      .toBe(false);
  });

  it('rejects a category that is not 32 bytes', () => {
    expectFramedRejection(() => validatorAddress(new Uint8Array(31), toBytes(VALIDATOR_TEMPLATE)));
  });
});

describe('master loader lock', () => {
  it('is neither a user address nor the contract address', () => {
    const loaderLock = toBytes(MASTER_LOADER_LOCK_A);
    expect(isUserAddress(loaderLock)).toBe(false);
    expect(isValidContractAddress(loaderLock, toBytes(CATEGORY_A), toBytes(VALIDATOR_TEMPLATE)))
      .toBe(false);
    expect(MASTER_LOADER_LOCK_A).not.toBe(ADDRESS_A);
  });

  it('never appears in a witness block, because the block holds input indices and the contract address', () => {
    for (const vector of Object.values(BLOCKS)) {
      expect(vector.hex.includes(MASTER_LOADER_LOCK_A)).toBe(false);
      expect(vector.hex.includes(MASTER_LOADER_LOCK_B)).toBe(false);
    }
  });

  it('leaves the frame address and the master redeem script independent', () => {
    const block = toWitnessBlock(BLOCKS.ABBA_A_F!);
    expect(toHex(block.self)).toBe(ADDRESS_A);
    const unlocking = buildMasterUnlockingBytecode(block, [], toBytes(LOADER_CODE_A));
    expect(toHex(splitFirstPush(unlocking).rest)).toBe(toHex(encodeArgumentPayload(toBytes(LOADER_CODE_A))));
  });
});
