/**
 * phase-boundary extract: SC class-body extract — blockhash oracle param resolution,
 * probe extraction, and co-spend ordering.
 */

import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction } from '@solidcash/utils';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  isComputedBlockhashKey,
} from '@solidcash/utils';
import type { Output, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import { resolveBlockhashCoSpend } from '../oracle/blockhashCoSpend.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import { extractBlockhashReadsFromTrace } from './trace-verified-value-helpers.js';

const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]);

export interface BlockhashCoSpendHost {
  readonly categoryId: string;
  readonly inner: { provider: NetworkProvider };
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
  const inertUnlocker: Unlocker = {
    generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
    generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
  };
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
  const transaction = b.buildLibauthTransaction();
  const trace = vm.debug({
    inputIndex: masterInputIndex, sourceOutputs: generateLibauthSourceOutputs(b.inputs), transaction,
  }) as AuthenticationProgramStateCommon[];
  return extractBlockhashReadsFromTrace(trace, base, slotCount)
    .find((read) => read.inputIndex === base + targetOrdinal)?.n ?? null;
}

// Resolve every blockhash oracle co-spend for a call, ordered by slot (ordinal 0..slotCount-1). Reads are
// resolved STRICTLY in slot order so the co-spend inputs stay contiguous from the bottom: a param read's n
// is its call arg; a computed read's n is extracted from a probe that co-spends the already-resolved lower
// reads (so the covenant reaches this read). Single source of truth: computed n comes from the covenant.
export async function resolveBlockhashCoSpends(
  host: BlockhashCoSpendHost,
  abiFunction: AbiFunction, args: any[], base: number, slotCount: number,
  masterUtxo: Utxo, stateInputUnlocker: Unlocker, dataNftUtxos: Utxo[],
): Promise<Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }>> {
  const reads = abiFunction.blockhashReads ?? [];
  const ordered: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }> = [];
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
    const cs = await resolveBlockhashCoSpend(host.inner.provider, host.categoryId, n);
    if (!cs) throw new Error(`blockhash(${n}): no (n->hash) oracle UTXO at addr(${n})`);
    ordered.push({ utxo: cs.utxo, unlocker: cs.unlocker, recreate: cs.recreateOutput, locktime: cs.locktime });
  }
  return ordered;
}
