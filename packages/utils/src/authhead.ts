/**
 * The authhead contract's fixed body and the check a covenant that creates a category runs on its output 0
 * (docs/bcmr/DESIGN.md, 4.2 and section 7). The SDK builds the contract from the same body
 * (`packages/solidcash/src/bcmr/authhead.ts`), so the compiler and the SDK derive one lock.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { Op, type Script } from './script.js';

/**
 * The authhead script after its first push, `<C || 0x01>` in the VM's byte order: output 0 keeps the mutable NFT of C
 * with no fungible amount, the spend has two inputs and the other is a token-free coin at the lock the NFT's
 * commitment holds, and output 0's lock is the contract, `OP_RETURN`, or P2SH32 of `OP_RETURN`.
 */
export const AUTHHEAD_BODY = hexToBin(
  '00d18800d39169c3529d51c09476ce0088c7c0cf8800cd76c0c78778016a879b7c016aaa02aa207c7e01877e879b',
);

/**
 * Consumes a category on top of the stack, in the VM's byte order, and verifies that output 0 is that category's
 * authhead contract holding its mutable NFT. The NFT's commitment, the owner, is the caller's to choose.
 */
export function buildAuthheadOutputCheck(): Script {
  return [
    Op.OP_1, Op.OP_CAT, Op.OP_DUP,
    hexToBin('21'), Op.OP_SWAP, Op.OP_CAT, AUTHHEAD_BODY, Op.OP_CAT,
    Op.OP_HASH256, hexToBin('aa20'), Op.OP_SWAP, Op.OP_CAT, hexToBin('87'), Op.OP_CAT,
    Op.OP_0, Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY,
    Op.OP_0, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_EQUALVERIFY,
  ];
}
