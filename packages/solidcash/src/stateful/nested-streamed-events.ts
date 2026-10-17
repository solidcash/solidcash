import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  buildAnonymousEventNftCovenantScript, buildEventNftCovenantScript, computeEventNameHash,
  type Artifact,
} from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { generateLibauthSourceOutputs, scriptToLockingBytecode } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { eventContinuationLockingBytecode } from './event-chunks.js';
import { traceRuntimeEffectStreamRuns, type RuntimeEffectStreamRecord } from './runtime-effect-stream-trace.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

export interface NestedStreamedEventPlan {
  /** Compiler-owned trailing band, relative to this participant's master. */
  fixedSize: number;
  capacity: number;
  locks: ReadonlySet<string>;
  /** Coordinates are participant-relative, so preceding blocks may grow during derivation. */
  outputs: Map<number, RuntimeEffectStreamRecord>;
  makeFunder(): Promise<UnlockableUtxo>;
}

/** Seed one head per lifted emit; the callee's effect verifier supplies computed chunks and commitments. */
export function planNestedStreamedEvents(
  route: NonNullable<ExternalCallUtxoGroup['compilerRoute']>, artifact: Artifact, categoryId: string,
  firstOutput: number, makeFunder: NestedStreamedEventPlan['makeFunder'],
): NestedStreamedEventPlan | undefined {
  const heads: RuntimeEffectStreamRecord[] = [];
  const locks = new Set<string>();
  for (const row of route.rowArguments ?? []) {
    for (const stream of row.handler.runtimeLoopEvents ?? []) {
      if (!stream.stream && !stream.chunked) continue;
      // These flags describe lifted top-level sites, whose source multiplicity is one. Other loop shapes
      // retain their own runtime cardinality planner and must not be guessed from an event schema.
      if (stream.repeatCount !== 1) throw new Error('Lifted callee event stream has no single-row multiplicity');
      for (const signature of stream.eventSignatures) {
        const event = artifact.events?.find((candidate) => candidate.signature === signature);
        if (!event) throw new Error(`Callee stream event schema '${signature}' is missing`);
        const script = event.anonymous
          ? buildAnonymousEventNftCovenantScript(hexToBin(categoryId))
          : buildEventNftCovenantScript(hexToBin(categoryId), computeEventNameHash(signature));
        const lockingBytecode = scriptToLockingBytecode(script, 'p2sh32');
        locks.add(binToHex(lockingBytecode));
        if (stream.chunked) locks.add(binToHex(eventContinuationLockingBytecode(
          categoryId, signature, event.anonymous === true,
        )));
        heads.push({ commitment: '', lockingBytecode });
      }
    }
  }
  if (heads.length === 0) return undefined;
  const layout = route.abiFunction.blockLayout;
  const fixedSize = layout?.trailingBase ?? layout?.blockSize;
  const capacity = layout?.trailingCapacity;
  if (fixedSize === undefined || capacity === undefined || firstOutput < fixedSize
    || firstOutput + heads.length > fixedSize + capacity) {
    throw new Error('Callee event stream exceeds its compiler-owned trailing band');
  }
  return {
    fixedSize, capacity, locks, makeFunder,
    outputs: new Map(heads.map((head, index) => [firstOutput + index, head])),
  };
}

/** Learn only records computed by the selected callee covenant, then let ordinary VM validation prove them. */
export async function deriveNestedStreamedEvents(
  provider: NetworkProvider, stb: StatefulTransactionBuilder, group: ExternalCallUtxoGroup, groupIndex: number,
): Promise<void> {
  const plan = group.streamedEventPlan;
  if (!plan || group.sharedGroupIndex !== undefined || !group.blockInputs) return;
  // Each changing probe learns at least one record or one commitment inside this bounded band.
  for (let attempt = 0; attempt <= plan.capacity; attempt += 1) {
    const builder = stb.build();
    const transaction = builder.buildLibauthTransaction();
    const inputIndex = stb.getExternalCallMasterInputIndex(groupIndex);
    const outputBase = stb.getExternalCallOutputBase(groupIndex);
    const runs = traceRuntimeEffectStreamRuns(provider, {
      inputIndex, transaction, sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
    }, { includeCompactRecords: true });
    const usedInputs = new Set(builder.inputs.map((input) => `${input.txid}:${input.vout}`));
    let changed = false;
    let inputsChanged = false;
    for (const run of runs) {
      const start = run.base - outputBase;
      const end = start + run.records.length;
      if (start < plan.fixedSize || end > plan.fixedSize + plan.capacity
        || run.records.some((record) => !plan.locks.has(binToHex(record.lockingBytecode)))) {
        throw new Error('Callee event trace exceeds its authenticated event schema or trailing band');
      }
      while (group.blockInputs.length < end) {
        const funder = await plan.makeFunder();
        const outpoint = `${funder.txid}:${funder.vout}`;
        if (usedInputs.has(outpoint)) continue;
        usedInputs.add(outpoint);
        group.blockInputs.push(funder);
        changed = true;
        inputsChanged = true;
      }
      for (const [index, record] of run.records.entries()) {
        const slot = start + index;
        const previous = plan.outputs.get(slot);
        if (previous?.commitment === record.commitment
          && binToHex(previous.lockingBytecode) === binToHex(record.lockingBytecode)) continue;
        plan.outputs.set(slot, record);
        changed = true;
      }
    }
    if (inputsChanged) stb._refreshInputs();
    if (!changed) return;
  }
  throw new Error('Callee event stream did not converge within its compiler-owned trailing capacity');
}
