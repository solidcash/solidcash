/**
 * Labelling a contract's own NFTs for explorers (docs/bcmr/DESIGN.md, section 8).
 *
 * Every UTXO of a contract carries its category, so explorers list masters, records and events as NFTs of the
 * token. A BCMR parsable-NFT collection labels them: the parse bytecode classifies an NFT by the lock it sits at,
 * pushes that role's type key to the altstack, and then, for a role whose commitment is a run of minimal pushes (a
 * state record, an event), moves each pushed value to the altstack as one field. The bytecode uses no opcode newer
 * than BCH 2025, so clients on that machine parse it.
 *
 * A parse input unlocks with `OP_1`, so its operation-cost budget is (41 + 1) x 800 = 33,600 units. Each role's
 * path is measured on a sample commitment; a role that would come within a tenth of the budget is classified only.
 */

import type {
  NftCategory, NftCategoryField, NftType,
} from '@bitauth/libauth/build/lib/engine/types/bcmr-types.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { measureOperationCost } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2025/bch-2025-consensus.js';
import { createVirtualMachineBch2025 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2025/bch-2025-vm.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import type { StructDefinitionInfo } from '@solidcash/utils';
import { BcmrError } from './publication.js';

/** How a parsed field is shown (BCMR `NftCategoryField` encoding). */
export type NftFieldEncoding = NftCategoryField[string]['encoding'];

/** One value a commitment pushes. */
export interface NftParseField {
  readonly id: string;
  readonly name: string;
  readonly encoding: NftFieldEncoding;
}

/** One type of NFT: its key, its label and, when its commitment is a run of pushes, its fields. */
export interface NftParseType {
  /** The type key, a minimal VM number, so the NFT's ticker reads `SYMBOL-<key>`. */
  readonly key: bigint;
  readonly name: string;
  readonly description?: string;
  /** The values the commitment pushes, in order; omitted, the type is classified only. */
  readonly fields?: readonly NftParseField[];
  /** A sample commitment that exercises the fields, for measuring this type's parse path. */
  readonly sample?: Uint8Array;
}

/** NFTs at one lock: one type, or several told apart by the commitment's leading tag push. */
export interface NftParseRole {
  readonly lockingBytecode: Uint8Array;
  readonly capability: 'none' | 'mutable' | 'minting';
  readonly type?: NftParseType;
  /** Types selected by the value of the commitment's first push, which is not a field. */
  readonly tagged?: readonly { readonly tag: bigint; readonly type: NftParseType }[];
}

/** What parsing one NFT yields: its type key and its field values, as the spec's altstack holds them. */
export interface NftParseResult {
  readonly typeKey: string;
  readonly fields: readonly Uint8Array[];
  readonly operationCost: number;
}

/** The operation-cost budget of a parse input, whose unlocking bytecode is `OP_1`. */
export const NFT_PARSE_BUDGET = (41 + 1) * 800;

const OP = {
  OP_0: 0x00, OP_1: 0x51, OP_IF: 0x63, OP_ELSE: 0x67, OP_ENDIF: 0x68, OP_TOALTSTACK: 0x6b, OP_2DROP: 0x6d,
  OP_DROP: 0x75, OP_DUP: 0x76, OP_NIP: 0x77, OP_OVER: 0x78, OP_SWAP: 0x7c, OP_SPLIT: 0x7f, OP_BIN2NUM: 0x81,
  OP_EQUAL: 0x87, OP_SUB: 0x94, OP_NUMEQUAL: 0x9c, OP_LESSTHAN: 0x9f, OP_UTXOBYTECODE: 0xc7,
  OP_UTXOTOKENCOMMITMENT: 0xcf,
} as const;

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const ops = (...codes: number[]): Uint8Array => Uint8Array.from(codes);
const pushNumber = (value: bigint): Uint8Array => encodeDataPush(bigIntToVmNumber(value));

/**
 * Decodes the minimal push leading the bytes on the stack's top, leaving `[value, rest]`: a direct push of up to 75
 * bytes, `OP_PUSHDATA1`, `OP_0`, `OP_1NEGATE` or `OP_1`..`OP_16`, which is every push a commitment encoder emits.
 */
const DECODE_PUSH = concat([
  ops(OP.OP_1, OP.OP_SPLIT, OP.OP_SWAP, OP.OP_BIN2NUM, OP.OP_DUP), pushNumber(76n), ops(OP.OP_LESSTHAN),
  ops(OP.OP_IF, OP.OP_SPLIT),
  ops(OP.OP_ELSE, OP.OP_DUP), pushNumber(76n), ops(OP.OP_NUMEQUAL),
  ops(OP.OP_IF, OP.OP_DROP, OP.OP_1, OP.OP_SPLIT, OP.OP_SWAP, OP.OP_BIN2NUM, OP.OP_SPLIT),
  ops(OP.OP_ELSE), pushNumber(80n), ops(OP.OP_SUB, OP.OP_SWAP),
  ops(OP.OP_ENDIF, OP.OP_ENDIF),
]);

/** Moves each of `count` pushed values to the altstack, leaving the remaining bytes on top. */
function decodeFields(count: number): Uint8Array {
  return concat(Array.from({ length: count }, () => concat([DECODE_PUSH, ops(OP.OP_SWAP, OP.OP_TOALTSTACK)])));
}

/** The body for one type: its key on the altstack, then its fields, the commitment's rest on top. */
function typeBody(type: NftParseType): Uint8Array {
  return concat([pushNumber(type.key), ops(OP.OP_TOALTSTACK), decodeFields(type.fields?.length ?? 0)]);
}

/** The parse bytecode for `roles`: each role is tried in turn against the NFT's lock, at most one matches. */
export function nftParseBytecode(roles: readonly NftParseRole[]): Uint8Array {
  const parts: Uint8Array[] = [ops(OP.OP_0, OP.OP_UTXOBYTECODE)];
  for (const role of roles) {
    parts.push(ops(OP.OP_DUP), encodeDataPush(role.lockingBytecode), ops(OP.OP_EQUAL, OP.OP_IF));
    parts.push(ops(OP.OP_0, OP.OP_UTXOTOKENCOMMITMENT));
    if (role.tagged === undefined) {
      if (role.type === undefined) throw new BcmrError('an NFT role names a type or tagged types');
      parts.push(typeBody(role.type), ops(OP.OP_DROP));
    } else {
      // `[lock, tag, rest]`: each tagged type compares the tag and reads its fields from the rest.
      parts.push(DECODE_PUSH);
      for (const { tag, type } of role.tagged) {
        parts.push(ops(OP.OP_OVER), pushNumber(tag), ops(OP.OP_NUMEQUAL, OP.OP_IF), typeBody(type), ops(OP.OP_ENDIF));
      }
      parts.push(ops(OP.OP_2DROP));
    }
    parts.push(ops(OP.OP_ENDIF));
  }
  // The parse input's `OP_1` unlocking is the one true value the stack must end with.
  parts.push(ops(OP.OP_DROP));
  return concat(parts);
}

/** The type key's hex, which indexes `parse.types`. */
export function nftTypeKeyHex(key: bigint): string {
  return binToHex(bigIntToVmNumber(key));
}

const EMPTY_HASH = new Uint8Array(32);

/**
 * Parses one NFT as a client would (CHIP-BCMR `ParsableNftCollection`): a standardized transaction whose input 1
 * runs the parse bytecode against input 0, the NFT. Returns the type key and fields, or why parsing failed.
 */
export function parseNft(
  bytecode: Uint8Array,
  nft: {
    readonly lockingBytecode: Uint8Array;
    readonly category: Uint8Array;
    readonly capability: 'none' | 'mutable' | 'minting';
    readonly commitment: Uint8Array;
  },
): NftParseResult | string {
  const vm = createVirtualMachineBch2025(true);
  const state = vm.evaluate({
    inputIndex: 1,
    sourceOutputs: [
      {
        lockingBytecode: nft.lockingBytecode,
        valueSatoshis: 1000n,
        token: { amount: 0n, category: nft.category, nft: { capability: nft.capability, commitment: nft.commitment } },
      },
      { lockingBytecode: bytecode, valueSatoshis: 0n },
    ],
    transaction: {
      version: 2,
      locktime: 0,
      inputs: [
        { outpointIndex: 0, outpointTransactionHash: EMPTY_HASH, sequenceNumber: 0, unlockingBytecode: new Uint8Array(0) },
        { outpointIndex: 0, outpointTransactionHash: EMPTY_HASH, sequenceNumber: 0, unlockingBytecode: ops(OP.OP_1) },
      ],
      outputs: [{ lockingBytecode: ops(0x6a), valueSatoshis: 0n }],
    },
  });
  if (state.error !== undefined) return state.error;
  const top = state.stack[state.stack.length - 1];
  if (state.stack.length !== 1 || top === undefined || !top.some((byte) => byte !== 0)) {
    return 'the parse did not leave a single true value';
  }
  const [typeKey, ...fields] = state.alternateStack;
  if (typeKey === undefined) return 'the NFT matched no type';
  return { typeKey: binToHex(typeKey), fields, operationCost: measureOperationCost(state.metrics) };
}

function typesOf(role: NftParseRole): NftParseType[] {
  return role.tagged === undefined ? (role.type === undefined ? [] : [role.type]) : role.tagged.map(({ type }) => type);
}

/** The commitment that exercises `type` within `role`: its sample, after the tag for a tagged type. */
function sampleCommitment(role: NftParseRole, type: NftParseType): Uint8Array {
  const tag = role.tagged?.find((tagged) => tagged.type === type)?.tag;
  const sample = type.sample ?? new Uint8Array(0);
  return tag === undefined ? sample : concat([pushNumber(tag), sample]);
}

/** `role` with `type` classified only. */
function withoutFields(role: NftParseRole, type: NftParseType): NftParseRole {
  const strip = (candidate: NftParseType): NftParseType => (candidate === type
    ? { key: candidate.key, name: candidate.name, ...(candidate.description === undefined ? {} : {
      description: candidate.description,
    }) }
    : candidate);
  return role.tagged === undefined
    ? { ...role, ...(role.type === undefined ? {} : { type: strip(role.type) }) }
    : { ...role, tagged: role.tagged.map(({ tag, type: tagged }) => ({ tag, type: strip(tagged) })) };
}

/**
 * The parsable-NFT collection describing `roles`. Every type's parse path is measured on its sample; a type whose
 * path fails or comes within a tenth of the budget is classified only, and the bytecode is rebuilt without its fields.
 */
export function nftCategory(roles: readonly NftParseRole[], category: Uint8Array, description?: string): NftCategory {
  let current = [...roles];
  for (;;) {
    const bytecode = nftParseBytecode(current);
    let refit: NftParseRole[] | undefined;
    for (const [index, role] of current.entries()) {
      for (const type of typesOf(role)) {
        if ((type.fields?.length ?? 0) === 0) continue;
        const parsed = parseNft(bytecode, {
          lockingBytecode: role.lockingBytecode, category, capability: role.capability,
          commitment: sampleCommitment(role, type),
        });
        const fits = typeof parsed !== 'string' && parsed.operationCost <= NFT_PARSE_BUDGET * 0.9
          && parsed.typeKey === nftTypeKeyHex(type.key) && parsed.fields.length === type.fields!.length;
        if (!fits) {
          refit = current.map((candidate, at) => (at === index ? withoutFields(candidate, type) : candidate));
          break;
        }
      }
      if (refit !== undefined) break;
    }
    if (refit === undefined) {
      const fields: NftCategoryField = {};
      const types: Record<string, NftType> = {};
      for (const type of current.flatMap(typesOf)) {
        for (const field of type.fields ?? []) fields[field.id] = { name: field.name, encoding: field.encoding };
        types[nftTypeKeyHex(type.key)] = {
          name: type.name,
          ...(type.description === undefined ? {} : { description: type.description }),
          ...((type.fields?.length ?? 0) === 0 ? {} : { fields: type.fields!.map((field) => field.id) }),
        };
      }
      return {
        ...(description === undefined ? {} : { description }),
        ...(Object.keys(fields).length === 0 ? {} : { fields }),
        parse: { bytecode: binToHex(bytecode), types },
      };
    }
    current = refit;
  }
}

const INT_LIKE = /^(u?int\d*|bigint|u?fixed(\d+x\d+)?|function\(.*)$/;

/**
 * The fields one value of `type` pushes, named under `id`: a struct pushes each member in order. Undefined when the
 * value is not a run of pushes (an array packs its elements), so its type is classified only.
 */
export function pushedFields(
  id: string, name: string, type: string, structs: readonly StructDefinitionInfo[] = [],
): NftParseField[] | undefined {
  if (/\[\d*\]$/.test(type)) return undefined;
  const struct = structs.find((candidate) => candidate.name === type);
  if (struct !== undefined) {
    const members = struct.fields.map((member) => pushedFields(
      `${id}.${member.name}`, `${name}.${member.name}`, member.type, structs,
    ));
    return members.some((member) => member === undefined) ? undefined : members.flat() as NftParseField[];
  }
  const fixed = type.match(/^u?fixed(\d+)x(\d+)$/);
  if (fixed !== null && Number(fixed[2]) <= 18) {
    return [{ id, name, encoding: { type: 'number', decimals: Number(fixed[2]) } }];
  }
  if (type === 'fixed' || type === 'ufixed') return [{ id, name, encoding: { type: 'number', decimals: 18 } }];
  // A boolean pushes OP_0 or OP_1, which parse to empty and 1; BCMR's `boolean` wants exactly 0x00 or 0x01.
  if (INT_LIKE.test(type) || type === 'bool') return [{ id, name, encoding: { type: 'number' } }];
  if (type === 'string') return [{ id, name, encoding: { type: 'utf8' } }];
  return [{ id, name, encoding: { type: 'hex' } }];
}
