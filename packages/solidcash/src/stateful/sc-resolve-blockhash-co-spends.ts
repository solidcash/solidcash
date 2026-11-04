/**
 * phase-boundary extract: SC class-body extract — blockhash oracle param resolution,
 * probe extraction, and co-spend ordering.
 */

import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  isComputedBlockhashKey,
  oraclePoolBinding,
  type AbiFunction,
} from '@solidcash/utils';
import {
  isContractUnlocker, type Output, type UnlockableUtxo, type Unlocker, type Utxo,
} from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import { resolveBlockhashCoSpend } from '../oracle/blockhashCoSpend.js';
import { poolInfoCoSpend } from '../oracle/pool/reader.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import { sameOutpoint } from './external-call-utxo-group.js';
import { extractBlockhashReadsFromTrace, unansweredBlockhashWalk } from './trace-verified-value-helpers.js';
import type { PoolReaderParticipant } from './unslotted-pool-co-spends.js';

const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]);
const inertUnlocker: Unlocker = {
  generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
  generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
};

/** A computed `block.number` is sliced before `blockhash` reads its own input. The probe has to spend a pool
 * info coin at the slot the reader was given, or that slice aborts before n is on the stack. */
async function placeBlockInfoOracle(
  host: BlockhashCoSpendHost,
  builder: {
    inputs: readonly unknown[];
    outputs: readonly unknown[];
    addInput(utxo: Utxo, unlocker: Unlocker): unknown;
    addOutput(output: Output): unknown;
  },
  stateInputUnlocker: Unlocker,
  masterInputIndex: number,
): Promise<void> {
  if (!isContractUnlocker(stateInputUnlocker)) return;
  const abi = stateInputUnlocker.abiFunction;
  const info = abi.blockLayout?.slots.find((slot) => slot.kind === 'blockInfoOracle');
  if (abi.usesBlockOracle !== true || info === undefined) return;
  const pool = stateInputUnlocker.contract.oraclePool;
  if (pool === undefined) return;
  const at = masterInputIndex + info.offset;
  while (builder.inputs.length < at) {
    const index = builder.inputs.length;
    builder.addInput(
      { txid: (0x8100 + index).toString(16).padStart(64, '0'), vout: 0, satoshis: 10000n },
      inertUnlocker,
    );
    builder.addOutput({ to: DUMMY_FUNDER_LOCKING_BYTECODE, amount: 10000n });
  }
  if (builder.inputs.length !== at) return;
  const coSpend = await poolInfoCoSpend(host.inner.provider, pool).catch(() => undefined);
  if (coSpend === undefined) return;
  const { unlocker, ...oracle } = coSpend;
  builder.addInput(oracle, unlocker);
  // The probe executes the reader, which only inspects this input. The output still has to carry the NFT
  // or the builder refuses the transaction as an implicit burn before the trace runs.
  builder.addOutput({ to: unlocker.generateLockingBytecode(), amount: oracle.satoshis, token: oracle.token });
}

export interface BlockhashCoSpendHost {
  readonly categoryId: string;
  /** The reader: its provider and the oracle pool its slots come from. */
  readonly inner: { provider: NetworkProvider; oraclePool?: string };
}

export function paramBlockhashN(readKey: string, args: any[], abiFunction: AbiFunction): bigint | null {
  const visible = abiFunction.inputs.filter((i) => !i.name.startsWith('__internal__'));
  const pIdx = visible.findIndex((i) => i.name === readKey);
  if (pIdx < 0) return null;
  const bn = args[pIdx];
  return typeof bn === 'bigint' ? bn : null;
}

// Run a minimal covenant probe (master + data NFTs + the already-resolved oracle co-spends, max-height
// locktime so any tx.time >= n CLTV passes) and read the blockhash reads' (inputIndex, n) off the trace.
// The covenant computes each n on-stack, so ANY expression resolves without JS re-derivation. A read whose
// oracle is not yet co-spent aborts the probe at its OP_UTXOTOKENCATEGORY - but the (n, idx) is captured on
// the pre-abort step - so the caller resolves reads one at a time in slot order (priorCoSpends grows).
export async function extractBlockhashReads(
  host: BlockhashCoSpendHost,
  masterUtxo: Utxo, stateInputUnlocker: Unlocker, dataNftUtxos: Utxo[],
  priorCoSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }>,
  base: number, slotCount: number,
): Promise<Array<{ inputIndex: number; n: bigint }>> {
  const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
  const vm = createVirtualMachineBch2026ForProvider(host.inner.provider);
  const b = new CovenantTransactionBuilder({ provider: host.inner.provider });
  b.locktime = 499999999; // max block-height locktime: satisfies any tx.time >= n (height) CLTV
  const dataUnlockers = dataNftUtxos.map(() => createDataNftUnlocker(host.inner as any, 0, host.categoryId));
  b.addInput(masterUtxo, stateInputUnlocker);
  dataNftUtxos.forEach((u, i) => b.addInput(u, dataUnlockers[i]));
  for (const cs of priorCoSpends) b.addInput(cs.utxo, cs.unlocker);
  b.addOutput({ to: stateInputUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token });
  dataNftUtxos.forEach((u, i) => b.addOutput({
    to: dataUnlockers[i].generateLockingBytecode(), amount: u.satoshis, token: u.token,
  }));
  for (const cs of priorCoSpends) b.addOutput(cs.recreate);
  await placeBlockInfoOracle(host, b, stateInputUnlocker, 0);
  const transaction = b.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(b.inputs);
  const trace = vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as AuthenticationProgramStateCommon[];
  return extractBlockhashReadsFromTrace(trace, base, slotCount);
}

/** Message-bus graph variant of the trace probe. The compiler reserves a sparse fixed row band, so preceding
 * inactive positions use inert inputs and prior active oracle co-spends occupy their exact slots. */
export async function extractGraphBlockhashRead(
  host: BlockhashCoSpendHost,
  masterUtxo: Utxo, stateInputUnlocker: Unlocker, dataNftUtxos: Utxo[],
  prior: Array<{ slotOrdinal: number; utxo: Utxo; unlocker: Unlocker; recreate: Output }>,
  base: number, targetOrdinal: number, slotCount: number, masterInputIndex = 0,
): Promise<bigint | null> {
  const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
  const vm = createVirtualMachineBch2026ForProvider(host.inner.provider);
  const b = new CovenantTransactionBuilder({ provider: host.inner.provider });
  b.locktime = 499999999;
  const dataUnlockers = dataNftUtxos.map(() => createDataNftUnlocker(host.inner as any, 0, host.categoryId));
  while (b.inputs.length < masterInputIndex) {
    const i = b.inputs.length;
    b.addInput({ txid: (0x8000 + i).toString(16).padStart(64, '0'), vout: 0, satoshis: 10000n }, inertUnlocker);
  }
  b.addInput(masterUtxo, stateInputUnlocker);
  dataNftUtxos.forEach((u, i) => b.addInput(u, dataUnlockers[i]));
  const priorByIndex = new Map(prior.map((p) => [base + p.slotOrdinal, p]));
  while (b.inputs.length <= base + targetOrdinal) {
    const inputIndex = b.inputs.length;
    const p = priorByIndex.get(inputIndex);
    if (p) b.addInput(p.utxo, p.unlocker);
    else b.addInput({ txid: inputIndex.toString(16).padStart(64, '0'), vout: 0, satoshis: 10000n }, inertUnlocker);
  }
  while (b.outputs.length < masterInputIndex) {
    b.addOutput({ to: DUMMY_FUNDER_LOCKING_BYTECODE, amount: 10000n });
  }
  b.addOutput({ to: stateInputUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token });
  dataNftUtxos.forEach((u, i) => b.addOutput({
    to: dataUnlockers[i].generateLockingBytecode(), amount: u.satoshis, token: u.token,
  }));
  while (b.outputs.length < b.inputs.length) {
    const inputIndex = b.outputs.length;
    const p = priorByIndex.get(inputIndex);
    b.addOutput(p?.recreate ?? { to: DUMMY_FUNDER_LOCKING_BYTECODE, amount: 10000n });
  }
  await placeBlockInfoOracle(host, b, stateInputUnlocker, masterInputIndex);
  const transaction = b.buildLibauthTransaction();
  const trace = vm.debug({
    inputIndex: masterInputIndex, sourceOutputs: generateLibauthSourceOutputs(b.inputs), transaction,
  }) as AuthenticationProgramStateCommon[];
  return extractBlockhashReadsFromTrace(trace, base, slotCount)
    .find((read) => read.inputIndex === base + targetOrdinal)?.n ?? null;
}

// Resolve every blockhash slot co-spend for a call, ordered by slot (ordinal 0..slotCount-1), from the reader's
// oracle pool. Reads are resolved STRICTLY in slot order so the co-spend inputs stay contiguous from the bottom: a
// param read's n is its call arg; a computed read's n is extracted from a probe that co-spends the already-resolved
// lower reads (so the covenant reaches this read). Single source of truth: computed n comes from the covenant.
export async function resolveBlockhashCoSpends(
  host: BlockhashCoSpendHost,
  abiFunction: AbiFunction, args: any[], base: number, slotCount: number,
  masterUtxo: Utxo, stateInputUnlocker: Unlocker, dataNftUtxos: Utxo[],
): Promise<Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }>> {
  const reads = abiFunction.blockhashReads ?? [];
  const ordered: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }> = [];
  if (reads.length === 0) return ordered;
  const pool = host.inner.oraclePool;
  if (pool === undefined) throw new Error('blockhash(n): the reader binds no oracle pool');
  for (let k = 0; k < reads.length; k++) {
    let n: bigint | null;
    if (isComputedBlockhashKey(reads[k])) {
      const extracted = await extractBlockhashReads(
        host, masterUtxo, stateInputUnlocker, dataNftUtxos, ordered, base, slotCount,
      );
      n = extracted.find((r) => r.inputIndex === base + k)?.n ?? null;
    } else {
      n = paramBlockhashN(reads[k], args, abiFunction);
    }
    if (n === null) throw new Error(`blockhash: could not resolve n for read "${reads[k]}" (slot ${k})`);
    const cs = await resolveBlockhashCoSpend(host.inner.provider, pool, n, ordered.map(({ utxo }) => utxo));
    if (!cs) throw new Error(`blockhash(${n}): oracle pool ${pool} has no live slot that answers block ${n}`);
    ordered.push({ utxo: cs.utxo, unlocker: cs.unlocker, recreate: cs.recreateOutput, locktime: cs.locktime });
  }
  return ordered;
}

/** The blockhash reads a call may make through function pointers, each a probe round. */
const MAX_INDIRECT_BLOCKHASH_READS = 8;
/** The largest height locktime: a probe at it passes the CLTV of any blockhash(n). */
const MAX_HEIGHT_LOCKTIME = 499999999;

/** A ring slot a function-pointer target's blockhash walk reads, recreated at its own index. */
export interface IndirectBlockhashSlot { utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }

/**
 * The ring slots of `pool` a reader's function-pointer blockhash walks read. Each round probes the reader with the
 * slots found so far; the walk that runs past the last input names the next n, answered by the slot holding n or, for
 * the zero, one of n's residue at least 256 newer. A slot in `exclude`, one the transaction already spends, is not
 * chosen.
 */
async function resolveUnansweredBlockhashWalks(
  provider: NetworkProvider, pool: string, exclude: readonly Pick<Utxo, 'txid' | 'vout'>[],
  probe: (resolved: readonly IndirectBlockhashSlot[]) => Promise<bigint | undefined>,
): Promise<IndirectBlockhashSlot[]> {
  const resolved: IndirectBlockhashSlot[] = [];
  for (let round = 0; round <= MAX_INDIRECT_BLOCKHASH_READS; round += 1) {
    const n = await probe(resolved);
    if (n === undefined) return resolved;
    if (round === MAX_INDIRECT_BLOCKHASH_READS) break;
    const cs = await resolveBlockhashCoSpend(provider, pool, n, [...exclude, ...resolved.map(({ utxo }) => utxo)]);
    if (!cs) throw new Error(`blockhash(${n}): oracle pool ${pool} has no live slot that answers block ${n}`);
    resolved.push({ utxo: cs.utxo, unlocker: cs.unlocker, recreate: cs.recreateOutput, locktime: cs.locktime });
  }
  throw new Error(`a call reads blockhash through function pointers more than ${MAX_INDIRECT_BLOCKHASH_READS} times`);
}

/**
 * The ring slots the blockhash walks of a function-pointer target read, which no block slot places. Each round probes
 * the reader with its direct co-spends, `extra` and the slots found so far; the walk that runs past the last input
 * names the next n. A slot in `exclude`, one the transaction already spends, is not chosen.
 */
export async function resolveIndirectBlockhashCoSpends(
  host: BlockhashCoSpendHost,
  masterUtxo: Utxo, stateInputUnlocker: Unlocker, dataNftUtxos: Utxo[],
  front: readonly UnlockableUtxo[], extra: readonly UnlockableUtxo[], exclude: readonly Pick<Utxo, 'txid' | 'vout'>[],
): Promise<IndirectBlockhashSlot[]> {
  const pool = host.inner.oraclePool;
  if (pool === undefined) throw new Error('blockhash(n): the reader binds no oracle pool');
  const binding = oraclePoolBinding(hexToBin(pool));
  const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
  const vm = createVirtualMachineBch2026ForProvider(host.inner.provider);
  const recreateOf = (input: UnlockableUtxo): Output => ({
    to: input.unlocker.generateLockingBytecode(), amount: input.satoshis, token: input.token,
  });
  return resolveUnansweredBlockhashWalks(host.inner.provider, pool, exclude, async (resolved) => {
    const b = new CovenantTransactionBuilder({ provider: host.inner.provider });
    b.locktime = MAX_HEIGHT_LOCKTIME;
    const dataUnlockers = dataNftUtxos.map(() => createDataNftUnlocker(host.inner as any, 0, host.categoryId));
    b.addInput(masterUtxo, stateInputUnlocker);
    dataNftUtxos.forEach((u, i) => b.addInput(u, dataUnlockers[i]));
    for (const input of front) b.addInput(input, input.unlocker);
    b.addOutput({ to: stateInputUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token });
    dataNftUtxos.forEach((u, i) => b.addOutput({
      to: dataUnlockers[i].generateLockingBytecode(), amount: u.satoshis, token: u.token,
    }));
    for (const input of front) b.addOutput(recreateOf(input));
    await placeBlockInfoOracle(host, b, stateInputUnlocker, 0);
    for (const input of extra) {
      b.addInput(input, input.unlocker);
      b.addOutput(recreateOf(input));
    }
    for (const slot of resolved) {
      b.addInput(slot.utxo, slot.unlocker);
      b.addOutput(slot.recreate);
    }
    const transaction = b.buildLibauthTransaction();
    const trace = vm.debug({
      inputIndex: 0, sourceOutputs: generateLibauthSourceOutputs(b.inputs), transaction,
    }) as AuthenticationProgramStateCommon[];
    return unansweredBlockhashWalk(trace, b.inputs.length, binding);
  });
}

/**
 * The ring slots the blockhash walks of a nested or low-level callee's function-pointer targets read: the root's
 * probe never runs a callee. Each participant whose entry publishes `indirectPoolReads.blockhash` is probed at its own
 * input of the built transaction, and each slot found joins the builder's unslotted co-spends, past every block.
 * Returns the largest locktime the slots need.
 */
export async function resolveCalleeIndirectBlockhashCoSpends(
  provider: NetworkProvider,
  builder: { build(): TransactionBuilder; addUnslottedPoolCoSpends(coins: readonly UnlockableUtxo[]): void },
  readers: readonly PoolReaderParticipant[],
): Promise<number> {
  const walkers = readers.filter(({ abiFunction, master }) => abiFunction?.indirectPoolReads?.blockhash === true
    && master !== undefined);
  if (walkers.length === 0) return 0;
  const vm = createVirtualMachineBch2026ForProvider(provider);
  let locktime = 0;
  for (const { pool, name, master } of walkers) {
    if (pool === undefined) throw new Error(`${name} reads blockhash(n), and binds no oracle pool`);
    const binding = oraclePoolBinding(hexToBin(pool));
    // Refilled by each probe with the inputs the built transaction spends.
    const spent: Utxo[] = [];
    const slots = await resolveUnansweredBlockhashWalks(provider, pool, spent, async (resolved) => {
      builder.addUnslottedPoolCoSpends(resolved.map(({ utxo, unlocker }) => ({ ...utxo, unlocker })));
      const built = builder.build();
      spent.splice(0, spent.length, ...built.inputs);
      const inputIndex = built.inputs.findIndex((input) => sameOutpoint(input, master));
      if (inputIndex < 0) return undefined;
      built.locktime = MAX_HEIGHT_LOCKTIME;
      const { transaction, sourceOutputs } = built.buildLibauthProgram(true);
      const trace = vm.debug({ inputIndex, sourceOutputs, transaction }) as AuthenticationProgramStateCommon[];
      return unansweredBlockhashWalk(trace, built.inputs.length, binding);
    });
    locktime = slots.reduce((max, slot) => Math.max(max, slot.locktime), locktime);
  }
  return locktime;
}
