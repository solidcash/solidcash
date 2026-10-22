/**
 * The authhead contract's fixed body (docs/bcmr/DESIGN.md, 4.2). The SDK builds the contract from it
 * (`packages/solidcash/src/bcmr/authhead.ts`).
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';

/**
 * The authhead script after its first push, `<C || 0x01>` in the VM's byte order: output 0 keeps the mutable NFT of C
 * with no fungible amount, the spend has two inputs and the other is a token-free coin at the lock the NFT's
 * commitment holds, and output 0's lock is the contract, `OP_RETURN`, or P2SH32 of `OP_RETURN`.
 */
export const AUTHHEAD_BODY = hexToBin(
  '00d18800d39169c3529d51c09476ce0088c7c0cf8800cd76c0c78778016a879b7c016aaa02aa207c7e01877e879b',
);
