/**
 * A creating body's check of the outputs of the child's category `K` (docs/framed/CREATE2_IDENTITY.md).
 *
 * The child's genesis is minted by the creator's own transaction, so what that transaction mints is the creator's to
 * refuse: an output carrying `K` must carry an NFT and no fungible amount at a 35-byte P2SH32 lock, and that lock must
 * be one the child's genesis names — the validator at `addrV(K)`, the data record's covenant, the authhead contract, or
 * a master at a lock the deployment filled in.
 *
 * Entry (bottom to top): `[K, addrV, recordLock, authheadLock, S0, S1, … S7]`, `K` in the chain order
 * `OP_OUTPOINTTXHASH` answers after `OP_REVERSEBYTES`. Exit: the same stack, unchanged.
 */

import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { CHILD_LOCK_CAPACITY, childOutputCountSentinel } from '@solidcash/utils';

const P2SH32_PREFIX = Uint8Array.of(0xaa, 0x20);
const P2SH32_SUFFIX = Uint8Array.of(0x87);
const push = (value: number): number[] => [...encodeDataPush(bigIntToVmNumber(BigInt(value)))];

/**
 * K's depth at every category comparison: the split copy and the original category, the loop's index, the sentinels
 * and the three locks. The membership, count and digest loops keep the same shape, so one constant serves all three.
 */
const K_DEPTH = 3 + CHILD_LOCK_CAPACITY + 3;

/**
 * Each allowed lock's depth once a comparison has duplicated the output's lock.
 *
 * Top-first under the loop index: the sentinels (S7 first), then the authhead, the record lock and the validator's
 * address; `K` sits past them and is the category, not a lock.
 */
const ALLOWED_DEPTHS: readonly number[] = [
  ...Array.from({ length: CHILD_LOCK_CAPACITY }, (_unused, slot) => 3 + slot),
  3 + CHILD_LOCK_CAPACITY,
  4 + CHILD_LOCK_CAPACITY,
  5 + CHILD_LOCK_CAPACITY,
];

export function childCategoryCheckScript(): number[] {
  const script: number[] = [
    Opcodes.OP_TXOUTPUTCOUNT,
    Opcodes.OP_BEGIN,
    Opcodes.OP_1SUB,
    Opcodes.OP_DUP,
    Opcodes.OP_OUTPUTTOKENCATEGORY,
    Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP, ...push(32), Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_DUP, ...push(32), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
    ...push(K_DEPTH), Opcodes.OP_PICK,
    Opcodes.OP_EQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_DROP,
    // No fungible amount: a minted amount of `K` at creation is unbacked liquidity.
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENAMOUNT, Opcodes.OP_0, Opcodes.OP_NUMEQUALVERIFY,
    // An NFT: the capability byte follows the category.
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY, Opcodes.OP_SIZE, Opcodes.OP_NIP,
    ...push(32), Opcodes.OP_GREATERTHAN, Opcodes.OP_VERIFY,
    // A 35-byte P2SH32 lock.
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTBYTECODE, Opcodes.OP_SIZE, Opcodes.OP_NIP,
    ...push(35), Opcodes.OP_NUMEQUALVERIFY,
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTBYTECODE, ...push(2), Opcodes.OP_SPLIT, Opcodes.OP_SWAP,
    ...encodeDataPush(P2SH32_PREFIX), Opcodes.OP_EQUALVERIFY, Opcodes.OP_DROP,
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTBYTECODE, ...push(34), Opcodes.OP_SPLIT, Opcodes.OP_NIP,
    ...encodeDataPush(P2SH32_SUFFIX), Opcodes.OP_EQUALVERIFY,
    // The lock is one the child's genesis names.
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTBYTECODE,
    Opcodes.OP_0, Opcodes.OP_TOALTSTACK,
  ];
  for (const depth of ALLOWED_DEPTHS) {
    script.push(
      Opcodes.OP_DUP, ...push(depth), Opcodes.OP_PICK, Opcodes.OP_EQUAL,
      Opcodes.OP_FROMALTSTACK, Opcodes.OP_BOOLOR, Opcodes.OP_TOALTSTACK,
    );
  }
  script.push(
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_VERIFY,
    Opcodes.OP_DROP, // the output's lock, read by the comparisons
    Opcodes.OP_ELSE, Opcodes.OP_DROP, Opcodes.OP_ENDIF,
    Opcodes.OP_ELSE, Opcodes.OP_DROP, Opcodes.OP_ENDIF,
    Opcodes.OP_DUP, Opcodes.OP_NOT, Opcodes.OP_UNTIL,
    Opcodes.OP_DROP,
  );
  // The transaction mints exactly the outputs of `K` the deployment states: a per-category count in the second loop,
  // kept on the altstack (the membership loop's flag is gone). The count's push is the deployment's placeholder.
  script.push(
    Opcodes.OP_0, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_BEGIN, Opcodes.OP_1SUB,
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY,
    Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP, ...push(32), Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_IF,
    // The category is compared through a copy, as the membership loop does, so `K` sits at `K_DEPTH` in every loop;
    // the original stays for the true branch to drop before it reads the loop index.
    Opcodes.OP_DUP, ...push(32), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
    ...push(K_DEPTH), Opcodes.OP_PICK, Opcodes.OP_EQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_DROP,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_1ADD, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_ELSE, Opcodes.OP_DROP,
    Opcodes.OP_ENDIF,
    Opcodes.OP_ELSE, Opcodes.OP_DROP, Opcodes.OP_ENDIF,
    Opcodes.OP_DUP, Opcodes.OP_NOT, Opcodes.OP_UNTIL, Opcodes.OP_DROP,
    Opcodes.OP_FROMALTSTACK, ...childOutputCountSentinel(), Opcodes.OP_BIN2NUM,
    Opcodes.OP_NUMEQUALVERIFY,
  );
  // The folded state's digest, folded in the order the outputs sit in the transaction.
  script.push(
    Opcodes.OP_0, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_BEGIN, Opcodes.OP_1SUB,
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY,
    Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP, ...push(32), Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_IF,
    // The same category copy and drop as the count loop: `K` is read at `K_DEPTH`.
    Opcodes.OP_DUP, ...push(32), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
    ...push(K_DEPTH), Opcodes.OP_PICK, Opcodes.OP_EQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_DROP,
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCOMMITMENT,
    Opcodes.OP_1, Opcodes.OP_PICK, Opcodes.OP_OUTPUTBYTECODE,
    Opcodes.OP_SWAP, Opcodes.OP_CAT, Opcodes.OP_SHA256,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_CAT, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_ELSE, Opcodes.OP_DROP,
    Opcodes.OP_ENDIF,
    Opcodes.OP_ELSE, Opcodes.OP_DROP,
    Opcodes.OP_ENDIF,
    Opcodes.OP_DUP, Opcodes.OP_NOT, Opcodes.OP_UNTIL, Opcodes.OP_DROP,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_SHA256,
  );
  // The tokenless `OP_RETURN <digest>` output the SDK appends carries the digest.
  script.push(
    Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_BEGIN, Opcodes.OP_1SUB,
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY,
    Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP, ...push(32), Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_DROP,
    Opcodes.OP_ELSE,
    Opcodes.OP_DROP,
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTBYTECODE,
    Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP, ...push(34), Opcodes.OP_NUMEQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_DUP, ...push(2), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
    ...encodeDataPush(Uint8Array.of(0x6a, 0x20)), Opcodes.OP_EQUALVERIFY,
    ...push(2), Opcodes.OP_SPLIT, Opcodes.OP_NIP, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_ELSE, Opcodes.OP_DROP,
    Opcodes.OP_ENDIF,
    Opcodes.OP_ENDIF,
    Opcodes.OP_DUP, Opcodes.OP_NOT, Opcodes.OP_UNTIL, Opcodes.OP_DROP,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_EQUALVERIFY,
  );
  return script;
}
