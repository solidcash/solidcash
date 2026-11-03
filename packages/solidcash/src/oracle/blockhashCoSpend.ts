import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BLOCKHASH_MAX_DEPTH, blockhashOracleLockingBytecode, blockhashSlotReadUnlocking, decodeBlockhashSlotCommitment,
  type BlockhashSlotFields,
} from '@solidcash/utils';
import type { NetworkProvider } from '../network/index.js';
import type { Utxo, Unlocker, Output } from '../interfaces.js';

/**
 * Consumer-side resolver for blockhash(n) (docs/block-and-transaction-properties.md s11). The read codegen co-spends
 * a blockhash slot of the master's category, and the slot covenant's read path recreates it unchanged at the
 * MATCHING output index, under tx.time >= n. This packages the three pieces a consumer wires for that, so call sites
 * stop hand-rolling the covenant redeem + read flag.
 */
export interface BlockhashCoSpend {
  utxo: Utxo;
  unlocker: Unlocker;
  // Self-preserving recreate; the caller MUST place it at the same output index as the co-spend input
  // (the covenant checks output[INPUTINDEX] == the input).
  recreateOutput: Output;
  locktime: number; // tx.time floor the read covenant requires (= n)
}

interface BlockhashSlot {
  utxo: Utxo;
  fields: BlockhashSlotFields;
}

/**
 * Resolve the master's slot that answers blockhash(n): the slot holding n, else the slot of n's residue in a 256-deep
 * ring holding a newer block, which reads zero as on the EVM. Returns null when no slot answers.
 */
export async function resolveBlockhashCoSpend(
  provider: NetworkProvider,
  oracleCategory: string,
  n: bigint,
): Promise<BlockhashCoSpend | null> {
  const found = await findBlockhashCoSpend(provider, oracleCategory, n);
  return typeof found === 'string' ? null : found;
}

/** `resolveBlockhashCoSpend`, throwing why no slot answers blockhash(n). */
export async function requireBlockhashCoSpend(
  provider: NetworkProvider,
  oracleCategory: string,
  n: bigint,
): Promise<BlockhashCoSpend> {
  const found = await findBlockhashCoSpend(provider, oracleCategory, n);
  if (typeof found === 'string') throw new Error(found);
  return found;
}

async function findBlockhashCoSpend(
  provider: NetworkProvider,
  oracleCategory: string,
  n: bigint,
): Promise<BlockhashCoSpend | string> {
  const category = hexToBin(oracleCategory);
  const lock = blockhashOracleLockingBytecode(category);
  const wanted = oracleCategory.toLowerCase();
  const slots = (await provider.getUtxosForLockingBytecode(lock)).flatMap((utxo): BlockhashSlot[] => {
    const nft = utxo.token?.nft;
    if (utxo.token?.category.toLowerCase() !== wanted || nft?.capability !== 'mutable') return [];
    const fields = decodeBlockhashSlotCommitment(hexToBin(nft.commitment));
    return fields === undefined ? [] : [{ utxo, fields }];
  });
  const full = BigInt(BLOCKHASH_MAX_DEPTH);
  const slot = slots.find(({ fields }) => fields.n === n) ?? slots.find(({ fields }) => n >= 0n
    && fields.depth === BLOCKHASH_MAX_DEPTH && fields.n > n && (fields.n - n) % full === 0n);
  if (slot === undefined) return blockhashUnansweredMessage(oracleCategory, n, slots.map(({ fields }) => fields));

  const { utxo } = slot;
  const readUnlock = blockhashSlotReadUnlocking(category);
  return {
    utxo,
    unlocker: { generateLockingBytecode: (): Uint8Array => lock, generateUnlockingBytecode: (): Uint8Array => readUnlock },
    recreateOutput: { to: lock, amount: utxo.satoshis, token: utxo.token },
    locktime: Number(n),
  };
}

/**
 * Why no slot answers blockhash(n). In a ring under 256 deep, the slot of n's residue holding a newer block means n is
 * older than the ring keeps; that slot holding an older block, or none of that residue, means the keeper has not
 * written n.
 */
function blockhashUnansweredMessage(category: string, n: bigint, slots: readonly BlockhashSlotFields[]): string {
  const blocks = slots.map((slot) => slot.n).sort((a, b) => Number(a - b));
  const residue = slots.filter((slot) => (n - slot.n) % BigInt(slot.depth) === 0n);
  const depth = (residue[0] ?? slots[0])?.depth;
  const ring = `the blockhash ring of category ${category}${depth === undefined ? '' : ` (depth ${depth})`}`;
  let held = 'no block';
  if (blocks.length > 8) held = `${blocks.length} blocks from ${blocks[0]} to ${blocks[blocks.length - 1]}`;
  else if (blocks.length > 0) held = `block${blocks.length === 1 ? '' : 's'} ${blocks.join(', ')}`;
  let why = 'not yet written by its keeper';
  if (n < 0n) why = 'no block height';
  else if (residue.length > 0 && residue.every((slot) => slot.n > n)) why = 'older than the ring keeps';
  return `blockhash(${n}): ${ring} holds ${held}; block ${n} is ${why}`;
}
