import {
  Op, buildEntryNftCovenantScript, buildValueChunkCovenantScript, encodeInt, scriptToBytecode,
} from '@solidcash/utils';

const category = new Uint8Array(32);
const collection = new Uint8Array(20);
const slot = new Uint8Array(32);
const root = new Uint8Array(32);

// Research prototype: category-independent but collection-specific entry covenant.
// The calling contract still authenticates the entry category against its master. The read-only path preserves
// the exact category, locking bytecode, commitment, token amount, and satoshis, so it cannot migrate the entry.
const categoryIndependentEntry = [
  Op.OP_IF,
  Op.OP_UTXOTOKENCATEGORY,
  encodeInt(32n), Op.OP_SPLIT,
  Op.OP_2, Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY,
  encodeInt(32n), Op.OP_SPLIT,
  Op.OP_1, Op.OP_EQUALVERIFY,
  Op.OP_EQUALVERIFY,
  Op.OP_ELSE,
  Op.OP_DROP,
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY,
  encodeInt(32n), Op.OP_SPLIT,
  Op.OP_1, Op.OP_EQUALVERIFY,
  Op.OP_DROP,
  Op.OP_INPUTINDEX, Op.OP_UTXOBYTECODE,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENAMOUNT,
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENAMOUNT,
  Op.OP_GREATERTHANOREQUAL, Op.OP_VERIFY,
  Op.OP_INPUTINDEX, Op.OP_UTXOVALUE,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTVALUE, Op.OP_EQUALVERIFY,
  Op.OP_ENDIF,
  collection, Op.OP_DROP,
  Op.OP_1,
];

const categoryIndependentChunk = [
  ...categoryIndependentEntry.slice(0, -1),
  slot, Op.OP_DROP, root, Op.OP_DROP, Op.OP_1,
];

// Operationally preferable variant: retain the category once in the read-only category check. This both
// domain-separates the address and rejects a foreign-category node without needing a master on the read-only path.
const readCategoryDrop = categoryIndependentEntry.findIndex((op, index, script) =>
  op === Op.OP_DROP && script[index - 1] === Op.OP_EQUALVERIFY && script[index - 2] === Op.OP_1);
if (readCategoryDrop < 0) throw new Error('category-independent prototype layout changed');
const categorySaltedEntry = [
  ...categoryIndependentEntry.slice(0, readCategoryDrop),
  category, Op.OP_EQUALVERIFY,
  ...categoryIndependentEntry.slice(readCategoryDrop + 1),
];
const categorySaltedChunk = [
  ...categorySaltedEntry.slice(0, -1),
  slot, Op.OP_DROP, root, Op.OP_DROP, Op.OP_1,
];

// Same single-pin invariant, with the current entry's mutable capability/category check factored before the branch.
// Stack starts [masterIndexOrZero, flag]. Preserve the current base until the write branch can compare it with the
// minting master; the read branch discards the placeholder/base pair after the common self-pin.
const categorySaltedFactoredEntry = [
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY,
  encodeInt(32n), Op.OP_SPLIT,
  Op.OP_1, Op.OP_EQUALVERIFY,
  Op.OP_DUP, category, Op.OP_EQUALVERIFY,
  Op.OP_SWAP,
  Op.OP_IF,
  Op.OP_SWAP,
  Op.OP_UTXOTOKENCATEGORY,
  encodeInt(32n), Op.OP_SPLIT,
  Op.OP_2, Op.OP_EQUALVERIFY,
  Op.OP_EQUALVERIFY,
  Op.OP_ELSE,
  Op.OP_2DROP,
  Op.OP_INPUTINDEX, Op.OP_UTXOBYTECODE,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENAMOUNT,
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENAMOUNT,
  Op.OP_GREATERTHANOREQUAL, Op.OP_VERIFY,
  Op.OP_INPUTINDEX, Op.OP_UTXOVALUE,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTVALUE, Op.OP_EQUALVERIFY,
  Op.OP_ENDIF,
  collection, Op.OP_DROP,
  Op.OP_1,
];
const categorySaltedFactoredChunk = [
  ...categorySaltedFactoredEntry.slice(0, -1),
  slot, Op.OP_DROP, root, Op.OP_DROP, Op.OP_1,
];

// Equivalent 256-bit chunk domain separation can commit to HASH256(collectionHash || slot || root) as one salt.
// P2SH32 still commits to the complete covenant, while collision resistance for the dynamic tuple remains 256-bit.
const chunkDomain = new Uint8Array(32);
const categorySaltedFactoredDigestedChunk = [
  ...categorySaltedFactoredEntry.slice(0, -3),
  chunkDomain, Op.OP_DROP, Op.OP_1,
];

const size = (script: typeof categoryIndependentEntry): number => scriptToBytecode(script).length;

console.log(JSON.stringify({
  currentEntry: size(buildEntryNftCovenantScript(category, collection)),
  categoryIndependentEntry: size(categoryIndependentEntry),
  categorySaltedEntry: size(categorySaltedEntry),
  categorySaltedFactoredEntry: size(categorySaltedFactoredEntry),
  currentChunk: size(buildValueChunkCovenantScript(category, collection, slot, root)),
  categoryIndependentChunk: size(categoryIndependentChunk),
  categorySaltedChunk: size(categorySaltedChunk),
  categorySaltedFactoredChunk: size(categorySaltedFactoredChunk),
  categorySaltedFactoredDigestedChunk: size(categorySaltedFactoredDigestedChunk),
}, null, 2));
