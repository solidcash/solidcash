/**
 * A creating body's replay of the child's genesis: the outputs of the child's category `K` (docs/framed/
 * CREATE2_IDENTITY.md, "The genesis replay").
 *
 * The child's genesis is minted by the creator's own transaction, so what that transaction mints of `K` is the
 * creator's to fix. Every output of `K` must be a mutable or minting NFT with no fungible amount at a 35-byte lock,
 * and the outputs fold, last first, into two chains of `SHA256(digest ++ capability ++ lock ++ commitment)` (the
 * reference is `childGenesisChain` in `@solidcash/utils`): the minting NFTs, which are the child's masters, and the
 * rest. The creating body compares the first with the masters' chain its deployment filled in and the second with
 * the chain it computes from `K`, its own address and the folded state, so an output of `K` that is added, dropped,
 * doubled, moved to another lock or given another commitment changes a chain and is refused.
 *
 * The capability byte and the lock have fixed widths and every link hashes a 32-byte digest before its item (the
 * chains start from 32 zero bytes), so a link's preimage reads one way only: no sequence of outputs chains to the
 * digest of another.
 */

import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';

const push = (value: number): number[] => [...encodeDataPush(bigIntToVmNumber(BigInt(value)))];

/**
 * The fold of the transaction's outputs of `K` into the two chains.
 *
 * Entry: `K` at depth `kDepth` (0 is the top), in the order the token introspection answers. Exit: the entry stack
 * with `[others, masters]` pushed, the masters' chain on top. The loop runs over every output, last first, and keeps
 * both chains on the alternate stack while it runs; it leaves the alternate stack as it found it.
 */
export function childGenesisChainsScript(kDepth: number): number[] {
  if (!Number.isInteger(kDepth) || kDepth < 0) throw new Error(`K's depth is a stack depth: got ${kDepth}`);
  return [
    // Both chains start from 32 zero bytes (`childGenesisChainStart`): the minting chain under the rest.
    Opcodes.OP_0, ...push(32), Opcodes.OP_NUM2BIN, Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_TXOUTPUTCOUNT,
    Opcodes.OP_BEGIN,
    Opcodes.OP_1SUB,
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY,
    // A tokenless output has no category to split; a token's is 32 bytes and its capability byte if any.
    Opcodes.OP_SIZE, ...push(32), Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_IF,
    ...push(32), Opcodes.OP_SPLIT, Opcodes.OP_SWAP,
    // `[i, capability, category]`: K sits three items deeper than at the loop's entry.
    ...push(kDepth + 3), Opcodes.OP_PICK, Opcodes.OP_EQUAL,
    Opcodes.OP_IF,
    // A mutable or minting NFT: one capability byte. An immutable NFT or a fungible-only output of `K` carries none.
    Opcodes.OP_SIZE, Opcodes.OP_1, Opcodes.OP_NUMEQUALVERIFY,
    // No fungible amount: a minted amount of `K` at creation is unbacked supply.
    Opcodes.OP_OVER, Opcodes.OP_OUTPUTTOKENAMOUNT, Opcodes.OP_NOT, Opcodes.OP_VERIFY,
    // A 35-byte lock, so `capability ++ lock ++ commitment` parses one way.
    Opcodes.OP_OVER, Opcodes.OP_OUTPUTBYTECODE, Opcodes.OP_SIZE, ...push(35), Opcodes.OP_NUMEQUALVERIFY,
    // `[i, capability, lock]` -> `[i, item, minting]`.
    Opcodes.OP_OVER, Opcodes.OP_2, Opcodes.OP_EQUAL,
    Opcodes.OP_ROT, Opcodes.OP_ROT, Opcodes.OP_CAT,
    Opcodes.OP_2, Opcodes.OP_PICK, Opcodes.OP_OUTPUTTOKENCOMMITMENT, Opcodes.OP_CAT,
    Opcodes.OP_SWAP,
    Opcodes.OP_IF,
    // The masters' chain, under the other on the alternate stack.
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK, Opcodes.OP_ROT, Opcodes.OP_CAT, Opcodes.OP_SHA256,
    Opcodes.OP_TOALTSTACK, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_ELSE,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_SWAP, Opcodes.OP_CAT, Opcodes.OP_SHA256, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_ENDIF,
    Opcodes.OP_ELSE,
    Opcodes.OP_DROP, // another category's capability byte
    Opcodes.OP_ENDIF,
    Opcodes.OP_ELSE,
    Opcodes.OP_DROP, // a tokenless output's empty category
    Opcodes.OP_ENDIF,
    Opcodes.OP_DUP, Opcodes.OP_NOT,
    Opcodes.OP_UNTIL,
    Opcodes.OP_DROP,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK,
  ];
}
