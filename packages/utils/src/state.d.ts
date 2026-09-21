import { AbiFunction, Artifact, ChildDeploymentGenesisStateAbi, StateLayout, StructDefinitionInfo } from './artifact.js';
import { Script } from './script.js';
/** Stable digest of the physical state geometry used by child-genesis recipes. */
export declare function childStateLayoutDigest(layout: Pick<StateLayout, 'variables' | 'dataNftCount' | 'commitmentLimit' | 'structs' | 'collections'>): string;
/** Fail closed unless every published constructor-genesis field names one exact physical layout coordinate. */
export declare function validateChildDeploymentGenesisState(layout: Pick<StateLayout, 'variables'>, genesisState: ChildDeploymentGenesisStateAbi): void;
/** A primitive pushdata value: integer, boolean, byte array, or string (UTF-8 encoded). */
export type PrimitiveStateValue = bigint | boolean | Uint8Array | string;
/** A state value that may be a primitive or a (possibly nested) struct record. */
export type StateValue = PrimitiveStateValue | StateRecord | StateValue[];
/** A record whose values are state values (supports recursive nesting for nested structs). */
export interface StateRecord {
    [key: string]: StateValue;
}
/**
 * Build the data-NFT covenant script seeded with a specific token category.
 *
 * Dual-path covenant:
 * - Write path (flag=1): requires master minting NFT at masterInputIndex
 * - Read-only path (flag=0): no master needed, but commitment must be preserved
 *
 * Both paths verify self-preservation (bytecode) and category preservation.
 *
 * Unlocking script provides: `<masterInputIndex | 0> <flag>`
 *
 * @param categoryId - 32-byte token category ID
 */
export declare function buildDataNftCovenantScript(categoryId: Uint8Array): Script;
/**
 * Build the hex-encoded bytecode for the data-NFT covenant seeded with a category.
 *
 * @param categoryIdHex - Hex-encoded 32-byte token category ID
 */
export declare function buildDataNftCovenantBytecode(categoryIdHex: string): string;
/** Parse an array type string like "int[3]" (bounded) or "int[]" (unbounded) into element type and optional bound. */
export declare function parseArrayTypeString(type: string): {
    elementType: string;
    bound: number | undefined;
} | undefined;
/**
 * Return a sensible zero/empty default for a state variable type.
 */
export declare function getDefaultStateValue(type: string, structs?: readonly StructDefinitionInfo[], _visited?: Set<string>): StateValue;
/**
 * Get the worst-case pushdata-encoded size for a type (string form).
 * Used for bin-packing state variables into NFT commitments.
 */
export declare function getMaxPushdataEncodedSize(type: string, structs?: readonly StructDefinitionInfo[], _visited?: Set<string>): number;
/**
 * Encode a value to pushdata format.
 * Must produce byte-identical output to the compiler's emitPushdataEncode.
 */
export declare function encodePushdataValue(value: StateValue, type: string, structs?: readonly StructDefinitionInfo[], _visited?: Set<string>): Uint8Array;
/** Concatenate pushdata-encoded event/struct fields in declaration order. */
export declare function concatPushdataParts(parts: readonly Uint8Array[]): Uint8Array;
/**
 * Encode an event NFT commitment the way `visitEmitStatement` does: each parameter is
 * pushdata-encoded, then the parts are concatenated. `emit Update(0, record)` is therefore
 * `encode(0) || encode(record)` (`00` + struct), not the struct alone.
 */
export declare function encodeEventCommitment(parameters: readonly {
    type: string;
}[], args: readonly StateValue[], structs?: readonly StructDefinitionInfo[]): Uint8Array;
/**
 * A probe can capture only the last event parameter (commonly the struct) because
 * `encode(0)` is a single `0x00`. Complete only when `derived` equals that last
 * parameter's encoding, then prepend the other parameters. Empty stays empty.
 */
export declare function completeEventCommitment(derived: Uint8Array, parameters: readonly {
    type: string;
}[], args: readonly StateValue[], structs?: readonly StructDefinitionInfo[]): Uint8Array;
/**
 * `emit F(0, x)` is `encode(0) || encode(x)` (`0x00` + x). A probe EQUALVERIFY of
 * that blob against a struct-only commitment looks like `00||x` vs `x`. Prefer the
 * longer operand — that is the emit blob the covenant pins.
 */
export declare function preferZeroPrefixedEventBlob(below: Uint8Array, top: Uint8Array): Uint8Array | undefined;
/**
 * Attach ethers/typechain-style accessors IN PLACE to a decoded value and everything nested inside it: a
 * non-enumerable `toObject()` on every struct record and `toArray()` on every array, each returning a plain deep
 * copy with the accessors stripped. Non-enumerable so Object.keys / spread / chai `deep.equal` / re-encode (which
 * iterate own enumerable keys, array indices, or a struct's field list - never this method) are all unaffected.
 *
 * IMPORTANT: apply this ONLY at a user-facing return boundary (getter results, event args). The internal
 * state-derivation path decodes the same values and must NOT see these accessors, so `decodePushdataValue` stays
 * clean and the SDK opts in by calling this on values it hands back to the caller.
 */
export declare function attachDecodedAccessors(value: StateValue): StateValue;
/**
 * Decode a pushdata-encoded value from a buffer at a given offset.
 * Returns the decoded value and number of bytes consumed.
 */
export declare function decodePushdataValue(data: Uint8Array, offset: number, type: string, structs?: readonly StructDefinitionInfo[], _visited?: Set<string>): {
    value: StateValue;
    bytesConsumed: number;
};
/**
 * A layout spans multiple data NFTs when its fixed-size state occupies more than one NFT. Such layouts
 * prepend a verifiable nftIndex tag to every data-NFT commitment so a higher-index NFT cannot be
 * substituted for a lower one (they share one covenant address). Single-NFT layouts carry no tag.
 */
export declare function isMultiDataNftLayout(layout: StateLayout): boolean;
/**
 * The nftIndex tag prepended to a multi-data-NFT commitment: the index encoded as a pushdata int
 * (1 byte for indices 0-16). Identical to how the compiler stamps and verifies it on-chain.
 */
export declare function encodeNftIndexTag(nftIndex: number): Uint8Array;
/**
 * Build a pushdata commitment hex string for a single NFT.
 */
export declare function buildPushdataCommitment(layout: StateLayout, values: Record<string, StateValue>, nftIndex: number, commitmentLimit?: number | undefined): string;
/**
 * Parse a pushdata commitment hex string for a single NFT.
 */
export declare function parsePushdataCommitment(hex: string, layout: StateLayout, nftIndex: number): Record<string, StateValue>;
/**
 * Build the initial state for a stateful contract deployment.
 */
export declare function buildInitialStateCommitments(layout: StateLayout, initialState: Record<string, StateValue>, commitmentLimit?: number): string[];
/**
 * Build an entry NFT commitment hex string from a key and value.
 * The commitment is: encodePushdata(key) ++ encodePushdata(value)
 */
export declare function buildEntryCommitment(keyValue: bigint | boolean | Uint8Array, keyType: string, valueValue: StateValue, valueType: string, structs?: readonly StructDefinitionInfo[], commitmentLimit?: number): string;
/**
 * Parse an entry NFT commitment hex string into key and value.
 */
export declare function parseEntryCommitment(hex: string, keyType: string, valueType: string, structs?: readonly StructDefinitionInfo[]): {
    key: bigint | boolean | Uint8Array;
    value: StateValue;
};
/** Max chunk data bytes. 120 + 5 (index) + 2 (framing) <= 128-byte commitment budget. */
export declare const DYNAMIC_CHUNK_SIZE = 120;
/** Type of a dynamic var's hidden length-header register field (A$len). See dynamic-storage.md. */
export declare const DYNAMIC_LEN_TYPE = "uint32";
/** Internal state-record key under which a dynamic var's decoded length is held before chunk assembly. */
export declare function dynamicLenKey(varName: string): string;
/** Chunk-collection signature for a dynamic var: "<name>:<type>" (e.g. "text:string"). */
export declare function dynamicChunkSignature(varName: string, varTypeString: string): string;
/** UTF-8/raw byte length of a dynamic-storage value (string -> utf8 bytes, bytes -> raw). */
export declare function dynamicValueByteLength(value: StateValue, type?: string): number;
/** ceil(byteLength / DYNAMIC_CHUNK_SIZE) - the number of chunk UTXOs a value of this length needs. */
export declare function chunkCountForLength(byteLength: number): number;
/** Split a value into DYNAMIC_CHUNK_SIZE-byte pieces (the last piece may be shorter). */
export declare function splitValueIntoChunks(value: Uint8Array): Uint8Array[];
/** Build a chunk UTXO commitment (an entry with key=chunkIndex, value=chunkData). */
export declare function buildChunkCommitment(chunkIndex: number, chunkData: Uint8Array, commitmentLimit?: number): string;
/** Parse a chunk UTXO commitment into its index and data. */
export declare function parseChunkCommitment(hex: string): {
    chunkIndex: number;
    chunkData: Uint8Array;
};
export declare const VALUE_HEAD_SIZE = 28;
export declare const VALUE_CHUNK_INDEX_SIZE = 2;
export declare const VALUE_CHUNK_SIZE: number;
export declare const VALUE_CHUNK_MAX_COUNT: number;
export declare const VALUE_INLINE_LIMIT = 60;
/** Encode the value portion of a sorted-map entry: len4 || inline, or len4 || root || head28. */
export declare function encodeChunkableValueTail(value: Uint8Array): Uint8Array;
/** Split only the bytes after the VALUE_HEAD_SIZE-byte entry prefix into full 126-byte continuation chunks. */
export declare function splitValueIntoValueChunks(value: Uint8Array): Uint8Array[];
/** Build a canonical continuation commitment: uint16-le index || raw chunk data. */
export declare function buildValueChunkCommitment(chunkIndex: number, chunkData: Uint8Array): string;
/** Parse the canonical uint16-le index || raw data continuation commitment. */
export declare function parseValueChunkCommitment(hex: string): {
    chunkIndex: number;
    chunkData: Uint8Array;
};
/** Strictly validate and reconstruct a root-addressed long value. */
export declare function joinValueChunks(headData: Uint8Array, chunks: readonly {
    chunkIndex: number;
    chunkData: Uint8Array;
}[], totalLength: number): Uint8Array;
/** Value-chunk covenant domain for a collection and authenticated value version. */
export declare function valueChunkSignature(collection: string, slot?: Uint8Array, root?: Uint8Array): string;
/** Concatenate chunk data (ordered by chunkIndex) and truncate to the authoritative length. */
export declare function joinChunks(orderedChunkData: Uint8Array[], totalLength: number): Uint8Array;
/** Pack one fixed-width element to exactly fixedWidthBytes(type) bytes (OP_NUM2BIN for int/fixed). */
export declare function packFixedWidthElement(value: PrimitiveStateValue, elementType: string): Uint8Array;
/** Decode one fixed-width element from its packed bytes (OP_BIN2NUM for int/fixed). */
export declare function unpackFixedWidthElement(bytes: Uint8Array, elementType: string): PrimitiveStateValue;
/** Pack a fixed-width array into its tight blob. */
export declare function packFixedWidthArray(elements: PrimitiveStateValue[], elementType: string): Uint8Array;
/** Unpack a tight blob into elements; blob length must be a whole multiple of the element width. */
export declare function unpackFixedWidthArray(blob: Uint8Array, elementType: string): PrimitiveStateValue[];
/**
 * Decode an array as it appears in an EVENT NFT commitment: `<count> ++ <elements>`, where count is the minimal
 * script-number push the compiler emits (OP_0, OP_1..OP_16, or OP_PUSHBYTES_n + value) and elements are raw
 * fixed-width (int, bytesN, bool, ...) or framed pushdata for variable-width element types. This is the on-stack
 * blob the emit covenant writes verbatim (emitPushdataEncode is a no-op on ArrayType), distinct from the framed
 * encoding decodePushdataValue produces - so events use this decoder, not the generic array branch.
 */
export declare function decodePackedEventArray(data: Uint8Array, offset: number, type: string, structs?: readonly StructDefinitionInfo[]): {
    value: StateValue[];
    bytesConsumed: number;
};
/**
 * Build an entry NFT commitment hex string from multiple keys and a value.
 * The commitment is: encodePushdata(key1) ++ encodePushdata(key2) ++ ... ++ encodePushdata(value)
 */
export declare function buildEntryCommitmentMultiKey(keyValues: Array<bigint | boolean | Uint8Array>, keyTypes: string[], valueValue: StateValue, valueType: string, structs?: readonly StructDefinitionInfo[], commitmentLimit?: number): string;
/**
 * Parse an entry NFT commitment hex string with multiple keys into keys array and value.
 */
export declare function parseEntryCommitmentMultiKey(hex: string, keyTypes: string[], valueType: string, structs?: readonly StructDefinitionInfo[]): {
    keys: Array<bigint | boolean | Uint8Array>;
    value: StateValue;
};
/**
 * Build the canonical collection signature string: "name:type"
 * e.g. "balances:mapping(pubkey => int)"
 */
export declare function computeCollectionSignature(name: string, typeString: string): string;
/**
 * Compute collection signature hash: SHA-256 of the UTF-8 collection signature, truncated to 20 bytes.
 * This makes each collection's covenant address unique.
 */
export declare function computeCollectionHash(collectionSignature: string): Uint8Array;
/**
 * Build the entry-NFT covenant script seeded with a specific token category and collection hash.
 *
 * Dual-path covenant:
 * - Write path (flag=1): requires master minting NFT, allows delete (no self-preservation)
 * - Read-only path (flag=0): no master needed, enforces self-preservation + commitment preservation
 *
 * Unlocking script provides: `<masterInputIndex | 0> <flag>`
 *
 * @param categoryId - 32-byte token category ID
 * @param collectionHash - 20-byte hash derived from collection signature
 */
export declare function buildEntryNftCovenantScript(categoryId: Uint8Array, collectionHash: Uint8Array): Script;
export declare const VALUE_CHUNK_DOMAIN_TAG: Uint8Array<ArrayBufferLike>;
/** Hash the unambiguous, domain-separated identity committed by a root-addressed value-chunk covenant. */
export declare function computeValueChunkDomain(collectionHash: Uint8Array, slot: Uint8Array, root: Uint8Array): Uint8Array;
/**
 * Build the hex-encoded bytecode for the entry-NFT covenant seeded with a category and collection signature.
 */
/** Entry-NFT spend rules salted by a vmap value version. The salts only domain-separate the P2SH32 address. */
export declare function buildValueChunkCovenantScript(categoryId: Uint8Array, collectionHash: Uint8Array, slot: Uint8Array, root: Uint8Array): Script;
export declare function buildEntryNftCovenantBytecode(categoryIdHex: string, collectionSignature: string): string;
/**
 * Build the canonical event signature string: "Name(type1,type2,...)"
 */
export declare function computeEventSignature(eventName: string, paramTypes: string[]): string;
/**
 * Build the canonical error signature string: "Name(type1,type2,...)"
 */
export declare function computeErrorSignature(errorName: string, paramTypes: string[]): string;
/**
 * Build the canonical function signature string: "Name(type1,type2,...)"
 */
export declare function computeFunctionSignature(funcName: string, paramTypes: string[]): string;
/**
 * Compute 4-byte function selector: SHA-256 of the UTF-8 function signature, truncated to 4 bytes.
 * The signature format is "funcName(type1,type2,...)", e.g. "transfer(pubkey,sig,int)".
 * Used as OP_DEFINE/OP_INVOKE identifier for entry-point functions.
 */
export declare function computeFunctionSelector(signature: string): Uint8Array;
/**
 * EVM/Solidity 4-byte function selector: keccak256(signature)[:4]. Used under evmCompat where selectors must
 * match Solidity (abi.encodeWithSignature / abi.encodeCall), as opposed to the BCH-native sha256 selector.
 */
export declare function computeEvmFunctionSelector(signature: string): Uint8Array;
/**
 * ERC-7201 (EIP-7201) namespaced storage slot, SPEC-CONFORMANT with Ethereum (real keccak256, not BCH-native sha256):
 *   keccak256(abi.encode(uint256(keccak256(bytes(id))) - 1)) & ~bytes32(uint256(0xff))
 * Verified byte-identical to the spec's reference values (erc7201("example.main") = 0x183a..b500). Returns the
 * 32-byte big-endian slot; `computeErc7201SlotNumber` returns its uint256 value = the slot key Ethereum uses.
 */
export declare function computeErc7201Slot(namespaceId: string): Uint8Array;
/** ERC-7201 slot as its big-endian uint256 value (the Ethereum storage-slot key). See computeErc7201Slot. */
export declare function computeErc7201SlotNumber(namespaceId: string): bigint;
/**
 * Compute 4-byte function selector as hex string.
 */
export declare function computeFunctionSelectorHex(signature: string): string;
/**
 * Compute event signature hash: SHA-256 of the UTF-8 event signature, truncated to 20 bytes.
 * The signature includes all parameter types, e.g. "Transfer(pubkey,int)".
 * This makes each event overload's covenant address unique.
 */
export declare function computeEventNameHash(eventSignature: string): Uint8Array;
/**
 * Compute the 32-byte event selector (`E.selector`, bytes32): the full SHA-256 of the UTF-8 event
 * signature - the platform's analog of Solidity's keccak-based topic hash (signature-injective, so
 * equal signatures give equal selectors and distinct signatures distinct ones).
 */
export declare function computeEventSelector(eventSignature: string): Uint8Array;
/**
 * Build the event-NFT covenant script seeded with a specific token category and event name.
 *
 * The covenant:
 * 1. Verifies this input's token category matches the expected category
 * 2. Embeds event name hash (makes address unique per event type)
 * 3. Enforces a 144-block relative timelock, after which anyone can spend (clean up)
 *
 * Unlocking script: empty (after 144 blocks)
 *
 * @param categoryId - 32-byte token category ID
 * @param eventNameHash - 20-byte hash derived from event name
 */
export declare function buildEventNftCovenantScript(categoryId: Uint8Array, eventNameHash: Uint8Array): Script;
/**
 * Build the hex-encoded bytecode for the event-NFT covenant.
 */
export declare function buildEventNftCovenantBytecode(categoryIdHex: string, eventSignature: string): string;
/**
 * Build the anonymous event-NFT covenant script seeded with a specific token category.
 *
 * Unlike named events, anonymous events skip the eventNameHash embedding (Part 2),
 * so all anonymous events from a contract share one P2SH32 address.
 *
 * The covenant:
 * 1. Verifies this input's token category matches the expected category
 * 2. Enforces a 144-block relative timelock, after which anyone can spend (clean up)
 *
 * @param categoryId - 32-byte token category ID
 */
export declare function buildAnonymousEventNftCovenantScript(categoryId: Uint8Array): Script;
/**
 * Build the hex-encoded bytecode for the anonymous event-NFT covenant.
 */
export declare function buildAnonymousEventNftCovenantBytecode(categoryIdHex: string): string;
/**
 * Build the blockhash (n -> hash) oracle covenant for block `n` under the oracle token category
 * (docs/block-and-transaction-properties.md s11). The immutable ('none' capability) NFT carries commitment =
 * n(4 LE)||hash(32).
 *
 * The covenant:
 *  - self-pins its token category == categoryId (capability 'none'), so a foreign-category UTXO paid to
 *    this address is unspendable;
 *  - read path (flag 0): self-preserving recreate (bytecode + category + commitment at the same output
 *    index), so permissionless reads cannot tamper with or destroy it;
 *  - wipe path (flag 1): `tx.time >= n + 256` (CLTV absolute - reads recreate the UTXO so a relative CSV
 *    would keep resetting), after which anyone may consume it for cleanup. `n` is baked, which both bounds
 *    the wipe and makes addr(n) unique per block.
 *
 * No compiler reconstruction: the consumer reads by category + commitment.n, never rebuilds this address.
 */
export declare function buildBlockhashOracleCovenantScript(categoryId: Uint8Array, n: bigint): Script;
/** p2sh32 locking bytecode for the (n -> hash) oracle UTXO of block `n`. */
export declare function blockhashOracleLockingBytecode(categoryId: Uint8Array, n: bigint): Uint8Array;
/** Build the (n,hash) commitment: n as 4 little-endian bytes followed by the 32-byte hash. */
export declare function buildBlockhashCommitment(n: bigint, hash: Uint8Array): Uint8Array;
export declare function blockhashCommitmentNumber(commitment: Uint8Array): bigint;
export declare function encodeComputedBlockhashKey(index: number): string;
export declare function isComputedBlockhashKey(key: string): boolean;
/**
 * Build the token container covenant script for holding foreign tokens on behalf
 * of a stateful master contract.
 *
 * Two spending paths:
 * - flag=1 (master-authorized): verifies minting NFT at masterInputIndex
 * - flag=0 (merge): verifies output preserves locking bytecode
 *
 * Unlocking script: `<masterInputIndex | mergeOutputIndex> <flag>`
 *
 * @param categoryId - 32-byte master contract's token category ID
 * @param tokenContainerCategoryId - 32-byte token container's token category (salt for unique address)
 */
export declare function buildTokenContainerCovenantScript(categoryId: Uint8Array, tokenContainerCategoryId: Uint8Array): Script;
/**
 * Build the hex-encoded bytecode for the token container covenant.
 */
export declare function buildTokenContainerCovenantBytecode(categoryIdHex: string, tokenContainerCategoryIdHex: string): string;
/**
 * Build the covenant script for a satoshi container.
 *
 * Satoshi containers hold the contract's BCH treasury. All this.transfer()
 * calls draw from this container rather than from the master UTXO.
 *
 * Dual-path spending:
 * - flag=1 (master path): verifies minting NFT at masterInputIndex (master-authorized spend)
 * - flag=0 (merge path): verifies output preserves locking bytecode (UTXO consolidation)
 *
 * @param categoryId - 32-byte master contract's token category (also used as salt for unique address)
 */
export declare function buildSatoshiContainerCovenantScript(categoryId: Uint8Array): Script;
/**
 * Build the hex-encoded bytecode for the satoshi container covenant.
 *
 * @param categoryIdHex - Hex-encoded 32-byte master contract's token category
 */
export declare function buildSatoshiContainerCovenantBytecode(categoryIdHex: string): string;
/**
 * Build a minimal Artifact for a covenant script, suitable for debug template generation.
 *
 * The artifact contains raw bytecode ASM (no source maps or debug info), which is enough
 * for the libauth template generator to produce a working debuggable template.
 */
export declare function buildCovenantArtifact(contractName: string, covenantScript: Script, abiFunction: AbiFunction): Artifact;
