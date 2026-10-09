/**
 * phase-boundary extract: SC class-body extract — StatefulFunctionCall.build finalization / materialization.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { Op, type AbiFunction } from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { PreparedAtomicMessageBusCall } from '../message-bus/compose.js';
import { addressToLockScript } from '../utils.js';
import { peekBuildId } from './buildSequence.js';
import { getDataNftAddress, getEntryNftAddress } from './covenant-helpers.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import { KERNEL_ENTRY_JOURNAL_ACCESS_TAG } from './KernelEntryJournal.js';
import type { ResolvedLogicalIdentity } from './logical-identity.js';
import type { StatefulContract } from './StatefulContract.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { preserveTransportedValueChunkWriteGeometry } from './sc-prepare-derive-full-value-chunk-writes.js';
import {
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';
import { describeValueChunkWrites } from './writer-group-selection.js';
import {
  resolveValueChunkWriteGeometry,
  retainCompleteObservedValueChunkWriteGeometry,
} from './value-chunk-write-geometry.js';

export interface BuildStatefulFunctionCallHost {
  compilerRoute?: {
    abiFunction: AbiFunction; selector?: Uint8Array; blockBase?: number;
    emitReturn?: boolean; returnBlob?: Uint8Array; omitLocalFeeTail?: boolean;
    logicalIdentity?: ResolvedLogicalIdentity;
    valueChunkProductions?: NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
  };
  functionName?: string;
  parentContract?: StatefulContract;
  trySplitMergeBuild(): Promise<TransactionBuilder | undefined>;
  applyOverrides(): Promise<StatefulTransactionBuilder>;
  selectedAbiFunction(): AbiFunction | undefined;
  recursivePreflightHasSignatures(): boolean;
  preflightRecursiveBuilder(builder: TransactionBuilder): void;
}

export async function buildStatefulFunctionCall(
  host: BuildStatefulFunctionCallHost,
): Promise<TransactionBuilder> {
  const splitMergeBuilder = await host.trySplitMergeBuild();
  if (splitMergeBuilder) return splitMergeBuilder;
  const stb = await host.applyOverrides();
  const buildFinalized = (): TransactionBuilder => {
    const valueChunkVariables = stb.getValueChunkVars();
    const observedChunks = [...stb.getDerivedChunkOutputs()].map(([offset, chunk]) => ({
      offset,
      resourceIdentity: chunk.resourceIdentity,
      resourcePart: chunk.resourcePart,
    }));
    for (const group of [...stb.getExternalCallUtxoGroups(), ...stb.getLowLevelCallUtxoGroups()]) {
      // A delegate's continuation resources belong to its authenticated state owner (the proxy), not to the
      // implementation whose code executes the write. Finalization may refresh output coordinates, but it must
      // not silently change the category component of the stable resource identity established by derivation.
      const described = describeValueChunkWrites(group, group.valueChunkStateOwner?.categoryId);
      if (described.length > 0 || group.valueChunkWrites === undefined) {
        const published = preserveTransportedValueChunkWriteGeometry(group, described);
        group.valueChunkWrites = retainCompleteObservedValueChunkWriteGeometry(
          published, group.valueChunkWrites ?? [], observedChunks,
        );
      }
    }
    const built = stb.build();
    stb.bindMaterializedValueChunkWitnesses(built, host.compilerRoute?.blockBase ?? 0);
    const composedBlockBase = stb.getComposedBlockBase();
    const compilerValueChunkWrites = resolveValueChunkWriteGeometry(
      stb.getValueChunkWriteDescriptors(),
      host.compilerRoute?.valueChunkProductions?.map((production) => production.write) ?? [],
      [...stb.getDerivedChunkOutputs()].map(([offset, chunk]) => ({
        offset: offset + composedBlockBase,
        resourceIdentity: chunk.resourceIdentity,
        resourcePart: chunk.resourcePart,
      })),
    );
    const runtimeEvents = stb.getRuntimeLoopEventOutputs();
    if (runtimeEvents.length > 0) {
      Object.defineProperty(built, '__messageBusRuntimeLoopEvents', {
        configurable: false,
        enumerable: false,
        value: Object.freeze(runtimeEvents.map((event, eventIndex) => Object.freeze({
          eventSignature: event.eventSignature,
          rowIndex: event.rowIndex,
          offset: stb.getRuntimeLoopEventOutputIndex(eventIndex),
        }))),
      });
    }
    const computedValueChunks: Array<{
      offset: number;
      commitment: string;
      lockingBytecode: Uint8Array;
      categoryId?: string;
      fixedIndex?: boolean;
      resourceIdentity?: string;
      resourcePart?: string;
    }> = [];
    const writesByResource = new Map<string, ValueChunkWriteDescriptor>();
    for (const write of compilerValueChunkWrites) {
      const identity = valueChunkWriteResourceIdentity(write);
      const prior = writesByResource.get(identity);
      if (prior !== undefined && (prior.outputBase !== write.outputBase
        || prior.outputCount !== write.outputCount || prior.operation !== write.operation
        || prior.entryAccessSlot !== write.entryAccessSlot || prior.routeSlot !== write.routeSlot
        || prior.collection !== write.collection || prior.collectionSignature !== write.collectionSignature
        || prior.collectionHash !== write.collectionHash || prior.categoryId !== write.categoryId
        || prior.keySlot !== write.keySlot)) {
        throw new Error(
          `Kernel chunkable-value resource '${identity}' has conflicting unauthenticated producer geometry.`,
        );
      }
      if (prior === undefined) writesByResource.set(identity, write);
    }
    // Composition compacts each compiler-published participant block before computed outputs are converged.
    // Publish exact used continuation coordinates independently of whether the value bytes/locking bytecode
    // have already been observed, so dummy placeholders remain owned by this participant during that compaction.
    // Unresolved geometry (-1/0) is not a claim and may be completed by a later derivation pass.
    const computedValueChunkSpanClaims: Array<{
      offset: number; resourceIdentity: string; resourcePart: string;
    }> = [];
    for (const [resourceIdentity, write] of writesByResource) {
      if (write.outputBase < 0 || write.outputCount === 0) continue;
      if (!Number.isSafeInteger(write.outputBase) || !Number.isSafeInteger(write.outputCount)
        || write.outputCount < 0 || write.outputBase + write.outputCount > Number.MAX_SAFE_INTEGER) {
        throw new Error(
          `Kernel chunkable-value resource '${resourceIdentity}' has invalid continuation geometry.`,
        );
      }
      for (let chunkIndex = 0; chunkIndex < write.outputCount; chunkIndex += 1) {
        computedValueChunkSpanClaims.push(Object.freeze({
          offset: write.outputBase + chunkIndex,
          resourceIdentity,
          resourcePart: `chunk:${chunkIndex}`,
        }));
      }
    }
    if (computedValueChunkSpanClaims.length > 0) {
      Object.defineProperty(built, '__messageBusComputedValueChunkSpanClaims', {
        configurable: false,
        enumerable: false,
        value: Object.freeze(computedValueChunkSpanClaims),
      });
    }
    for (const [resourceIdentity, write] of writesByResource) {
      const variables = valueChunkVariables.flatMap((variable) => (
        variable.collection === write.collection && variable.slot
          && binToHex(variable.slot) === write.keySlot.toLowerCase()
          ? [variable] : []
      ));
      if (variables.length !== 1) continue;
      const variable = variables[0];
      const commitments = stb.getValueChunkRawCommitments(variable.id);
      const outputCount = Math.max(1, write.outputCount, commitments.length);
      for (let chunkIndex = 0; chunkIndex < outputCount; chunkIndex += 1) {
        const offset = write.outputBase + chunkIndex;
        computedValueChunks.push(Object.freeze({
          offset,
          commitment: commitments[chunkIndex] ?? '00',
          lockingBytecode: variable.lockingBytecode.slice(),
          categoryId: write.categoryId,
          resourceIdentity,
          resourcePart: `chunk:${chunkIndex}`,
        }));
      }
    }
    // Derived pins live at block-local coordinates; the composer range-checks every claim against the
    // participant's absolute trailing range, so shift them by the block base exactly once here.
    for (const [localOffset, chunk] of stb.getDerivedChunkOutputs()) {
      const offset = localOffset + composedBlockBase;
      if (computedValueChunks.some((candidate) => candidate.offset === offset)) continue;
      computedValueChunks.push(Object.freeze({
        offset,
        commitment: chunk.commitment,
        lockingBytecode: chunk.lockingBytecode.slice(),
        categoryId: chunk.categoryId,
        fixedIndex: chunk.fixedIndex,
        resourceIdentity: chunk.resourceIdentity,
        resourcePart: chunk.resourcePart,
      }));
    }
    // Every lock this participant may publish, tagged by the resource family it belongs to. The composer merges
    // these across participants to attribute an introspected output in the aggregate tail (which lies beyond
    // every participant block) to its owner without recomputing any covenant address.
    {
      const resourceLocks = new Map<string, string>();
      const noteLock = (lock: Uint8Array | undefined, kind: string): void => {
        if (lock && lock.length > 0) resourceLocks.set(binToHex(lock).toLowerCase(), kind);
      };
      for (const slot of stb.getBlockLayoutSlotsForDiagnostics()) {
        const lock = built.outputs[slot.offset]?.to;
        if (lock instanceof Uint8Array) noteLock(lock, `${slot.kind}${slot.slotIndex !== undefined
          ? `#${slot.slotIndex}` : ''}`);
      }
      for (const [offset, chunk] of stb.getDerivedChunkOutputs()) {
        noteLock(chunk.lockingBytecode, `chunk:${chunk.resourcePart ?? offset}`);
      }
      noteLock(stb.getValueChunkRedeemLock(), 'valueChunkRedeem');
      if (resourceLocks.size > 0) {
        Object.defineProperty(built, '__messageBusResourceLocks', {
          configurable: false,
          enumerable: false,
          value: Object.freeze([...resourceLocks.entries()]),
        });
      }
    }
    if (computedValueChunks.length > 0) {
      Object.defineProperty(built, '__messageBusComputedValueChunks', {
        configurable: false,
        enumerable: false,
        value: Object.freeze(computedValueChunks),
      });
    }
    return built;
  };
  const builder = buildFinalized();
  if (stb.hasUnresolvedDeferredKeccakPreimages() || stb.hasUnresolvedDeferredEcrecoverArguments()) {
    const provider = builder.provider;
    Object.defineProperty(builder, '__messageBusDeferredCompute', {
      configurable: false,
      enumerable: false,
      value: Object.freeze({
        hasUnresolved: (): boolean => stb.hasUnresolvedDeferredKeccakPreimages()
          || stb.hasUnresolvedDeferredEcrecoverArguments(),
        resolveRecipes: (
          keccakPreimages: readonly (Uint8Array | null)[],
          ecrecoverArguments: readonly (Uint8Array | null)[],
        ): boolean => stb.applyDeferredComputeRecipes(keccakPreimages, ecrecoverArguments),
        // The composer reports a stall as one opaque sentence; the counts say whether the trace failed to expose
        // a keccak preimage or an ecrecover (hash,v,r,s) blob, which are different causes.
        remaining: (): ReturnType<typeof stb.getDeferredComputeRemainingForDiagnostics> =>
          stb.getDeferredComputeRemainingForDiagnostics(),
        resolve: (
          program: ReturnType<TransactionBuilder['buildLibauthProgram']>,
          executionInput: number,
          inputBase: number,
          candidateExecutions: readonly number[] = [],
        ): boolean => {
          // A deferred build publishes resources whose value it has not learned yet as empty-commitment NFTs.
          // Every covenant that addresses a token parses its commitment (`slot||next||value` for entries,
          // `index||data` for chunks) through a fixed `OP_SPLIT 32`, and an empty item aborts the whole program
          // with an invalid-index failure - not a rejected check. That abort lands before the recovery/keccak read
          // sites this trace exists to observe, so the resolver can never learn its arguments and the composer
          // reports `complete graph did not expose arguments for all deferred compute resources`.
          //
          // The probe is not the transaction that gets sent: it only feeds argument learning. Fill an empty
          // commitment from the OTHER side of the same 1:1 block coordinate when that side carries one, else with
          // a zero-filled body long enough to parse. Both sides must agree: filling only the output leaves the
          // co-spent input empty and the covenant's preservation check then fails (measured: the abort moved from
          // an invalid OP_SPLIT to `OP_VERIFY` at the master commitment comparison). Acceptance is unaffected -
          // the send recomposes from the learned values and every equality check still compares against the
          // authenticated expectation, so a filled placeholder still fails closed.
          const fillProbeCommitment = <T extends { nft?: { commitment?: Uint8Array } } | undefined>(
            token: T, mirror: Uint8Array | undefined,
          ): T => {
            const commitment = token?.nft?.commitment;
            if (!token?.nft || commitment === undefined || commitment.length > 0) return token;
            const filled = mirror && mirror.length > 0 ? mirror : new Uint8Array(64);
            return { ...token, nft: { ...token.nft, commitment: filled } } as T;
          };
          const emptyOn = (item: { token?: { nft?: { commitment?: Uint8Array } } } | undefined): boolean => {
            const commitment = item?.token?.nft?.commitment;
            return commitment !== undefined && commitment.length === 0;
          };
          const mirrorFor = (index: number): Uint8Array | undefined => {
            const outputCommitment = program.transaction.outputs[index]?.token?.nft?.commitment;
            if (outputCommitment && outputCommitment.length > 0) return outputCommitment;
            const sourceCommitment = program.sourceOutputs[index]?.token?.nft?.commitment;
            return sourceCommitment && sourceCommitment.length > 0 ? sourceCommitment : undefined;
          };
          // The composed path plans no value-chunk band at all (ROUND 115), so the covenant's positional chunk
          // read inside the participant's trailing run finds a TOKEN-LESS pad and the shared 32/32 parser aborts
          // the whole program - which is why the deferred resolvers never reach their read sites. The probe is
          // not the transaction that gets sent: give every token-less coordinate inside this participant's
          // trailing run a structural placeholder token (the participant's own category, mutable, a body long
          // enough to parse). The real run is recomposed from the learned values and every equality check still
          // compares against the authenticated expectation, so a placeholder still fails closed - it only stops
          // the run from aborting before the reads the resolver needs.
          const trailingCoordinates = ((): { trailingBase?: number; blockSize?: number } => {
            try {
              return stb.getTrailingBandCoordinatesForDiagnostics();
            } catch {
              return {};
            }
          })();
          const trailingBase = trailingCoordinates.trailingBase;
          const blockSize = trailingCoordinates.blockSize;
          const masterCategory = program.transaction.outputs
            .find((candidate) => candidate.token?.nft?.capability === 'minting')?.token?.category;
          const placeholderFor = <T extends { token?: unknown; lockingBytecode: Uint8Array }>(
            output: T, index: number,
          ): T => {
            if (output.token !== undefined || masterCategory === undefined || trailingBase === undefined) {
              return output;
            }
            if (index < inputBase + trailingBase) return output;
            // The trailing RUN the positional read walks is the part of THIS participant's block band, so the
            // placeholder stops at the block's end. Everything beyond it belongs to the settlement tail - the
            // payout and change outputs - and a token placed there aborts the probe at the shared token-less
            // output check (`require(tx.outputs[a+b].tokenCommitment.size == 0)`, measured as the abort at the
            // 13-instruction outlined span with OP_NUMEQUALVERIFY on an empty commitment) BEFORE the recovery
            // read site, which is exactly what kept the deferred argument unresolved. The band is the widest
            // region a positional read can address, so bounding the placeholder to it is what the placeholder
            // is for: it stops the parse abort without changing a coordinate the covenant requires to be bare.
            if (blockSize !== undefined && index >= inputBase + blockSize) return output;
            return {
              ...output,
              token: {
                amount: 0n,
                category: masterCategory,
                nft: { capability: 'mutable' as const, commitment: new Uint8Array(64) },
              },
            };
          };
          const probeSources = program.sourceOutputs.map((source, index) => (
            emptyOn(source) ? { ...source, token: fillProbeCommitment(source.token, mirrorFor(index)) } : source
          ));
          const probeOutputs = program.transaction.outputs.map((output, index) => (
            emptyOn(output) ? { ...output, token: fillProbeCommitment(output.token, mirrorFor(index)) } : output
          )).map((output, index) => placeholderFor(output, index));
          // The recovery/keccak reads live in PER-ROW bodies, and each participant's verifier executes its own
          // rows: a single execution input can only expose the reads that execution reaches (measured: one of
          // eight ecrecover arguments learned, the other seven never read). Evaluate the probe at each candidate
          // execution - the participant's own first - and keep the first trace that teaches something.
          let progressed = false;
          let trace: ReturnType<typeof evaluateProbeTrace> = [];
          const executions = [executionInput, ...candidateExecutions.filter((index) => index !== executionInput)];
          for (const candidate of executions) {
            trace = evaluateProbeTrace(provider, {
              ...program,
              sourceOutputs: probeSources,
              transaction: { ...program.transaction, outputs: probeOutputs },
              inputIndex: candidate,
            });
            if (stb.resolveDeferredKeccakPreimage(trace, inputBase)) progressed = true;
            if (stb.resolveDeferredEcrecoverArgument(trace, inputBase)) progressed = true;
            if (progressed) break;
          }
          if (!progressed
            && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_ENTRY_COUNTS === '1') {
            // Which output/input introspection actually killed the probe. The deferred resolver can only learn a
            // recovery/keccak argument from a trace that reaches its read site, so the LAST token-commitment
            // introspection before the terminal state names the slot that ended the run: its index operand is
            // still on that state's stack, and an empty commitment there is the fail-closed-under-placeholder
            // shape the composer reports as "did not expose arguments".
            const vmNumber = (bytes: Uint8Array | undefined): number => {
              if (!bytes || bytes.length === 0) return 0;
              const negative = (bytes[bytes.length - 1] & 0x80) !== 0;
              const magnitude = Uint8Array.from(bytes);
              if (negative) magnitude[magnitude.length - 1] &= 0x7f;
              let value = 0n;
              for (let byte = magnitude.length - 1; byte >= 0; byte -= 1) {
                value = (value << 8n) | BigInt(magnitude[byte]);
              }
              return Number(negative ? -value : value);
            };
            // Classify the introspected locks: whether the aborting slot carries the resource the covenant
            // expects (a collection's entry NFT address, a data NFT, or the master) is the difference between
            // "the right address parsed with the wrong shape" and "the SDK published the wrong resource".
            const lockKinds = new Map<string, string>();
            const classify = (lock: Uint8Array | undefined, kind: string): void => {
              if (lock) lockKinds.set(binToHex(lock).toLowerCase(), kind);
            };
            // Value-chunk covenants commit to collection+slot+root, so their address is per-value; classify them
            // from the builder's own derived-chunk observations rather than recomputing the recipe.
            try {
              for (const [offset, chunk] of stb.getDerivedChunkOutputs()) {
                classify(chunk.lockingBytecode, `chunk:${chunk.resourcePart ?? offset}`
                  + `${chunk.semanticKind ? `(${chunk.semanticKind})` : ''}`);
              }
            } catch { /* no derived chunks */ }
            try {
              classify(stb.getValueChunkRedeemLock(), 'valueChunkRedeem');
            } catch { /* no session lock */ }
            try {
              console.error('trailing-band-coordinates', JSON.stringify({
                buildId: peekBuildId(),
                participant: host.parentContract?.inner.artifact.contractName,
                coordinates: stb.getTrailingBandCoordinatesForDiagnostics(),
              }));
            } catch { /* coordinates unavailable */ }
            const parent = host.parentContract;
            if (parent) {
              try {
                classify(addressToLockScript(parent.inner.address), 'master');
              } catch { /* address form unavailable */ }
              try {
                classify(addressToLockScript(getDataNftAddress(parent.inner, parent.categoryId)), 'dataNft');
              } catch { /* no data NFT for this contract */ }
              for (const collection of (parent.inner.artifact.stateLayout as {
                collections?: Array<{ name: string }>;
              } | undefined)?.collections ?? []) {
                try {
                  classify(addressToLockScript(getEntryNftAddress(
                    parent.inner, parent.categoryId, collection.name,
                  )), `entry:${collection.name}`);
                } catch { /* collection address unavailable */ }
              }
            }
            const commitmentReads = trace.flatMap((raw) => {
              const state = raw as {
                ip?: number; stack?: Uint8Array[];
                instructions?: Array<{ opcode?: number }>;
              };
              const opcode = state.instructions?.[state.ip ?? -1]?.opcode;
              if (!state.stack || state.stack.length === 0) return [];
              const isOutput = opcode === Op.OP_OUTPUTTOKENCOMMITMENT;
              const isInput = opcode === Op.OP_UTXOTOKENCOMMITMENT;
              const inputSide = opcode === Op.OP_UTXOTOKENCATEGORY || opcode === Op.OP_UTXOBYTECODE
                || opcode === Op.OP_UTXOVALUE || opcode === Op.OP_UTXOTOKENAMOUNT
                || opcode === Op.OP_INPUTBYTECODE;
              const outputSide = opcode === Op.OP_OUTPUTBYTECODE || opcode === Op.OP_OUTPUTTOKENCATEGORY
                || opcode === Op.OP_OUTPUTVALUE || opcode === Op.OP_OUTPUTTOKENAMOUNT;
              if (!isOutput && !isInput && !outputSide && !inputSide) return [];
              const label = opcode === Op.OP_OUTPUTBYTECODE ? 'out-bytecode'
                : opcode === Op.OP_UTXOBYTECODE ? 'in-bytecode'
                  : opcode === Op.OP_UTXOTOKENCATEGORY ? 'in-category'
                    : opcode === Op.OP_OUTPUTTOKENCATEGORY ? 'out-category'
                      : opcode === Op.OP_INPUTBYTECODE ? 'in-inputbytecode'
                        : isOutput ? 'out-commitment' : 'in-commitment';
              const index = vmNumber(state.stack[state.stack.length - 1]);
              // The probe program is rebuilt every resolve round, so an aggregate dump taken at the final
              // stall cannot be correlated with an earlier round's trace indices (measured: 216 vs 463).
              // Read the state the covenant actually introspected out of THIS program instead.
              const introspected = isInput || inputSide
                ? program.sourceOutputs[index]
                : probeOutputs[index];
              const commitment = introspected?.token?.nft?.commitment;
              const lock = introspected?.lockingBytecode;
              return [{
                op: label,
                index,
                bytes: state.stack[state.stack.length - 1]?.length,
                stackDepth: state.stack.length,
                cat: introspected?.token?.category
                  ? binToHex(introspected.token.category).slice(0, 8) : undefined,
                cap: introspected?.token?.nft?.capability,
                commitBytes: commitment?.length,
                lock: lock ? binToHex(lock).slice(0, 12) : undefined,
                kind: lock ? lockKinds.get(binToHex(lock).toLowerCase()) : undefined,
              }];
            });
            // The terminal state names the aborting instruction and its error; together with the trailing
            // introspection reads this makes the ENTRY_COUNTS record self-contained (the DERIVE-gated
            // no-progress-* frames are no longer needed to interpret a stalled resolve).
            const terminal = trace.at(-1) as {
              error?: string; ip?: number; instructions?: Array<{ opcode?: number }>;
            } | undefined;
            console.error('deferred-no-progress-reads', JSON.stringify({
              buildId: peekBuildId(),
              total: commitmentReads.length,
              error: terminal?.error,
              failingIp: terminal?.ip,
              failingOpcode: terminal?.instructions?.[terminal.ip ?? -1]?.opcode,
              // The terminal state's instruction list is the ENCLOSING script's, so print the window around the
              // pointer rather than one index: the reported failing opcode (OP_VERIFY) and the neighbouring
              // opcodes together identify the check without needing the artifact's ip-to-source map.
              // The runtime-loop journal rejects the reserved target ordinal (0xffff) and the covenant's
              // sentinel check is exactly `require(target != 0xffff)`, so report any access stream the probe
              // carries whose target field still holds the sentinel: that tuple, not the commitment parse, is
              // what ends the trace before the deferred resolvers can read their arguments.
              accessSentinels: program.transaction.inputs.flatMap((input, inputIndex) => {
                const unlocking = input.unlockingBytecode;
                const hits: Array<Record<string, unknown>> = [];
                for (let at = 0; at + 2 <= unlocking.length; at += 1) {
                  if (unlocking[at] !== KERNEL_ENTRY_JOURNAL_ACCESS_TAG) continue;
                  const count = unlocking[at + 1];
                  if (count === 0 || count > 64 || at + 2 + count * 5 > unlocking.length) continue;
                  // The canonical tuple is `flags || target-u16le || predecessor-u16le` and the flags must
                  // agree with the PREDECESSOR sentinel (`HAS_PREDECESSOR` iff predecessor != 0xffff). Verify
                  // which field carries that relation before calling a sentinel a reserved TARGET ordinal:
                  // reading the fields the other way round would report a legitimate predecessor as a defect.
                  const tuples = Array.from({ length: count }, (_unused, index) => {
                    const offset = at + 2 + 20 + index * 5;
                    return {
                      flags: unlocking[offset],
                      fieldA: unlocking[offset + 1] | (unlocking[offset + 2] << 8),
                      fieldB: unlocking[offset + 3] | (unlocking[offset + 4] << 8),
                    };
                  });
                  const matchesAsTargetFirst = tuples.filter((tuple) =>
                    ((tuple.flags & 0x04) !== 0) === (tuple.fieldB !== 0xffff)).length;
                  const matchesAsPredecessorFirst = tuples.filter((tuple) =>
                    ((tuple.flags & 0x04) !== 0) === (tuple.fieldA !== 0xffff)).length;
                  const sentinels = tuples.map((tuple, index) => ({ tuple, index }))
                    .filter(({ tuple }) => tuple.fieldA === 0xffff).map(({ index }) => index);
                  const predecessorSentinels = tuples.map((tuple, index) => ({ tuple, index }))
                    .filter(({ tuple }) => tuple.fieldB === 0xffff).map(({ index }) => index);
                  // Only a DEFINITIVE stream may be reported. A witness blob can contain an accidental
                  // 0x06/count pair, so require the whole stream to obey the canonical relations under the
                  // target-first reading - flag/sentinel agreement on every tuple, canonical predecessor
                  // sentinel, and no tuple whose target equals the predecessor - before claiming a defect.
                  const canonicalTargetFirst = matchesAsTargetFirst === count
                    && tuples.every((tuple) => (tuple.flags & 0x04) !== 0
                      ? tuple.fieldB !== 0xffff : tuple.fieldB === 0xffff)
                    && tuples.every((tuple) => tuple.fieldA !== tuple.fieldB);
                  if (canonicalTargetFirst && sentinels.length > 0) {
                    hits.push({
                      input: inputIndex, count, sentinels, predecessorSentinels,
                      canonicalOrder: 'target-first', agreement: [matchesAsTargetFirst, count],
                    });
                  } else if (matchesAsPredecessorFirst === count && predecessorSentinels.length > 0) {
                    hits.push({
                      input: inputIndex, count, sentinels, predecessorSentinels,
                      canonicalOrder: 'predecessor-first', agreement: [matchesAsPredecessorFirst, count],
                    });
                  }
                }
                return hits;
              }),
              deferredRemaining: (() => {
                try {
                  return stb.getDeferredComputeRemainingForDiagnostics();
                } catch {
                  return undefined;
                }
              })(),
              // The operands the failing check compared. Sizes alone cannot say which coordinate's body the
              // covenant expected, so carry the top of the stack as length-prefixed hex.
              // Which ROUTE witnesses the probe actually carried. The failing checks compare locking
              // bytecodes against items that came out EMPTY, and an empty item is what an unfilled ABI witness
              // looks like - so list the pushdata items of the executing input with their lengths, in ABI order,
              // marking the empty ones. Mapping them onto the route ABI's internal input names is then a lookup.
              executionWitnesses: (() => {
                const unlocking = program.transaction.inputs[executionInput]?.unlockingBytecode
                  ?? new Uint8Array();
                const items: Array<{ index: number; length: number }> = [];
                let at = 0;
                while (at < unlocking.length && items.length < 64) {
                  const opcode = unlocking[at];
                  if (opcode >= 1 && opcode <= 75) {
                    items.push({ index: items.length, length: opcode });
                    at += 1 + opcode;
                  } else if (opcode === 0x4c && at + 1 < unlocking.length) {
                    const size = unlocking[at + 1];
                    items.push({ index: items.length, length: size });
                    at += 2 + size;
                  } else if (opcode === 0x00) {
                    items.push({ index: items.length, length: 0 });
                    at += 1;
                  } else {
                    break;
                  }
                }
                const empty = items.filter((item) => item.length === 0).map((item) => item.index);
                // Name the empty witnesses from the verifier program's own ABI so the missing values are
                // identifiable without a second instrumentation round.
                const declared = (host.parentContract?.inner.artifact.messageBus as {
                  verifierProgram?: { inputs?: Array<{ name?: string }> };
                } | undefined)?.verifierProgram?.inputs ?? [];
                // A candidate execution is not necessarily a VERIFIER input: the probe also runs the route and
                // the executor. Labelling a route's pushes with the verifier ABI names invents witnesses the
                // route never declared (measured: `localBatch` reported empty on an input whose calldata carries
                // a 2155-byte batch push). Report what the input IS and what its pushes actually contain.
                const heads: string[] = [];
                {
                  let cursor = 0;
                  while (cursor < unlocking.length && heads.length < 64) {
                    const opcode = unlocking[cursor];
                    if (opcode >= 1 && opcode <= 75) {
                      heads.push(binToHex(unlocking.slice(cursor + 1, cursor + 1 + opcode)).slice(0, 32));
                      cursor += 1 + opcode;
                    } else if (opcode === 0x4c && cursor + 1 < unlocking.length) {
                      const size = unlocking[cursor + 1];
                      heads.push(binToHex(unlocking.slice(cursor + 2, cursor + 2 + size)).slice(0, 32));
                      cursor += 2 + size;
                    } else if (opcode === 0x00) {
                      heads.push('');
                      cursor += 1;
                    } else {
                      break;
                    }
                  }
                }
                return {
                  count: items.length,
                  lengths: items.map((item) => item.length),
                  empty,
                  emptyNames: empty.map((index) => declared[index]?.name ?? `<${index}>`),
                  declaredNames: declared.map((input) => input.name ?? '?').slice(0, items.length + 4),
                  inputIndex: executionInput,
                  unlockingLength: unlocking.length,
                  inputLock: binToHex(program.sourceOutputs?.[executionInput]?.lockingBytecode ?? new Uint8Array())
                    .slice(0, 24),
                  heads,
                };
              })(),
              failingStack: (() => {
                // Self-describing operands: which of the values the failing check compared are values the
                // program actually received (a witness item, a lock, a commitment) and which are produced by the
                // covenant itself. An operand that matches nothing the program carries is a witness lookup the
                // probe left unset - the concrete thing to fill.
                const known = new Set<string>();
                const note = (bytes: Uint8Array | undefined): void => {
                  if (bytes && bytes.length > 0) known.add(binToHex(bytes));
                };
                for (const input of program.transaction.inputs) {
                  const unlocking = input.unlockingBytecode;
                  for (let cursor = 0; cursor < unlocking.length;) {
                    const opcode = unlocking[cursor];
                    if (opcode >= 1 && opcode <= 75) {
                      note(unlocking.slice(cursor + 1, cursor + 1 + opcode)); cursor += 1 + opcode;
                    } else if (opcode === 0x4c && cursor + 1 < unlocking.length) {
                      const size = unlocking[cursor + 1];
                      note(unlocking.slice(cursor + 2, cursor + 2 + size)); cursor += 2 + size;
                    } else cursor += 1;
                  }
                }
                for (const item of [...program.sourceOutputs, ...program.transaction.outputs]) {
                  const candidate = item as {
                    lockingBytecode?: Uint8Array;
                    token?: { category?: Uint8Array; nft?: { commitment?: Uint8Array } };
                  };
                  note(candidate.lockingBytecode);
                  note(candidate.token?.category);
                  note(candidate.token?.nft?.commitment);
                }
                // A carried value can also contain the operand NESTED inside a larger item (a graph-emission
                // transcript or a record payload embeds other contracts' locks), so a whole-item lookup alone
                // reports a false `nowhere`.
                const carried = [...known];
                const isCarried = (hex: string): boolean => hex.length > 0
                  && carried.some((value) => value === hex || value.includes(hex));
                const stack = (terminal as { stack?: Uint8Array[] } | undefined)?.stack ?? [];
                return stack.slice(-8).map((item) => ({
                  length: item.length,
                  hex: binToHex(item).slice(0, 48),
                  origin: item.length === 0 ? 'empty' : (isCarried(binToHex(item)) ? 'known' : 'nowhere'),
                }));
              })(),
              failingWindow: (terminal?.instructions ?? [])
                .slice(Math.max(0, (terminal?.ip ?? 0) - 9), (terminal?.ip ?? 0) + 4)
                .map((instruction) => ({ op: instruction?.opcode })),
              trailing: commitmentReads.slice(-40),
            }));
          }
          if (!progressed
            && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_PROBE_SWEEP === '1') {
            // WHICH input can teach the deferred compute its arguments? The resolver only probes the
            // participant's executor (and, when a caller supplies them, a few candidate executions), so a
            // compute read that lives in a DIFFERENT script - a verifier input, a per-row clone input - is never
            // executed and the arguments stay unresolved no matter how many rounds run. Sweep every input that
            // carries a covenant-sized script and report the `OP_INPUTBYTECODE` reads each one exposes, with
            // the side-car range [inputBase, inputBase + 32) marked, so the fix is either "add this input to the
            // candidate set" or "the probe program itself is wrong".
            const sweep: Array<Record<string, unknown>> = [];
            // The participant's OWN block inputs are the other place its code can run: the master/logical
            // identity input executes the participant's row bodies, while the executor input (already in the
            // candidate list) verifies. Address them by slot so the sweep covers the inputs the row dispatcher
            // actually runs in, not just the `base + executorOffset` candidates the resolver knows about.
            const blockProbeInputs = new Set<number>();
            try {
              for (const slot of stb.getBlockLayoutSlotsForDiagnostics()) {
                if (!['master', 'identityAnchor', 'lowLevelCall'].includes(slot.kind)) continue;
                blockProbeInputs.add(inputBase + slot.offset);
              }
            } catch { /* layout unavailable */ }
            blockProbeInputs.add(inputBase);
            // Local VM-number decode: this block must not depend on helpers that live in other diagnostics.
            const sweepVmNumber = (bytes: Uint8Array | undefined): number => {
              if (!bytes || bytes.length === 0) return 0;
              const negative = (bytes[bytes.length - 1] & 0x80) !== 0;
              const magnitude = Uint8Array.from(bytes);
              if (negative) magnitude[magnitude.length - 1] &= 0x7f;
              let value = 0n;
              for (let byte = magnitude.length - 1; byte >= 0; byte -= 1) {
                value = (value << 8n) | BigInt(magnitude[byte]);
              }
              return Number(negative ? -value : value);
            };
            for (let candidate = 0; candidate < program.transaction.inputs.length; candidate += 1) {
              const lock = program.sourceOutputs?.[candidate]?.lockingBytecode ?? new Uint8Array();
              const unlockingBytes = program.transaction.inputs[candidate]?.unlockingBytecode?.length ?? 0;
              const attempted = candidate === executionInput || candidateExecutions.includes(candidate);
              // A covenant input's script lives in its UNLOCKING bytecode (the p2sh32 lock is 35 bytes), so the
              // unlocking length - not the lock length - is what selects the inputs worth probing.
              if (!attempted && unlockingBytes < 1000 && !blockProbeInputs.has(candidate)) continue;
              let candidateTrace: ReturnType<typeof evaluateProbeTrace> = [];
              try {
                candidateTrace = evaluateProbeTrace(provider, { ...program, inputIndex: candidate });
              } catch (error) {
                sweep.push({ candidate, attempted, lockBytes: lock.length, error: String(error).slice(0, 80) });
                continue;
              }
              const reads = candidateTrace.flatMap((raw) => {
                const state = raw as { ip?: number; instructions?: Array<{ opcode?: number }>; stack?: Uint8Array[] };
                if (state.instructions?.[state.ip ?? -1]?.opcode !== Op.OP_INPUTBYTECODE
                  || !state.stack || state.stack.length < 2) return [];
                const index = sweepVmNumber(state.stack[state.stack.length - 1]);
                return [{ ip: state.ip, index, inSidecarRange: index >= inputBase && index < inputBase + 32 }];
              });
              if (reads.length === 0 && !attempted) continue;
              // Which BODIES the execution entered, keyed by frame instruction count. A route that never
              // invokes the entry body carrying the compute read shows up here as a frame profile with no
              // large defined body - the difference between "the row was never dispatched" and "the read is
              // gated behind a branch the probe's data does not take".
              const frames = new Map<number, { steps: number; maxIp: number }>();
              for (const raw of candidateTrace) {
                const state = raw as { ip?: number; instructions?: unknown[] };
                const key = state.instructions?.length ?? 0;
                const entry = frames.get(key) ?? { steps: 0, maxIp: 0 };
                entry.steps += 1;
                entry.maxIp = Math.max(entry.maxIp, state.ip ?? 0);
                frames.set(key, entry);
              }
              sweep.push({
                frames: [...frames.entries()]
                  .sort((left, right) => right[1].steps - left[1].steps)
                  .slice(0, 6)
                  .map(([frame, entry]) => ({ frame, steps: entry.steps, maxIp: entry.maxIp })),
                candidate,
                attempted,
                lockHead: binToHex(lock).slice(0, 24),
                unlockingBytes,
                steps: candidateTrace.length,
                sidecarReads: reads.filter((read) => read.inSidecarRange).slice(0, 3),
                reads: reads.slice(-4),
              });
              if (sweep.length >= 24) break;
            }
            console.error('deferred-probe-sweep', JSON.stringify({ inputBase, executionInput, sweep }));
          }
          if (!progressed
            && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_ECRECOVER_DERIVE === '1') {
            const terminal = trace.at(-1) as {
              error?: string; ip?: number; stack?: Uint8Array[];
              instructions?: Array<{ opcode: number; data?: Uint8Array }>;
            } | undefined;
            const ip = terminal?.ip ?? -1;
            const lastOutputBytecode = [...trace].reverse().find((raw) => {
              const state = raw as { ip?: number; instructions?: Array<{ opcode: number }> };
              return state.instructions?.[state.ip ?? -1]?.opcode === Op.OP_OUTPUTBYTECODE;
            }) as { stack?: Uint8Array[] } | undefined;
            const handlerSnapshots = Array.from({ length: 8 }, (_, offset) => ip - 7 + offset)
              .flatMap((wantedIp) => {
                const state = [...trace].reverse().find((raw) => {
                  const candidate = raw as { ip?: number; instructions?: Array<{ opcode: number }> };
                  return candidate.ip === wantedIp
                  && candidate.instructions?.length === terminal?.instructions?.length;
                }) as {
                  ip?: number; stack?: Uint8Array[]; alternateStack?: Uint8Array[];
                  instructions?: Array<{ opcode: number }>;
                } | undefined;
                if (!state?.stack) return [];
                return [{
                  ip: state.ip,
                  opcode: state.instructions?.[wantedIp]?.opcode,
                  stackSize: state.stack.length,
                  altSize: state.alternateStack?.length,
                  top: state.stack.slice(-40).map((item, index, stack) => ({
                    depth: stack.length - 1 - index,
                    bytes: item.length,
                    hex: binToHex(item).slice(0, 160),
                  })),
                }];
              });
            const diagnostic = {
              executionInput,
              inputBase,
              states: trace.length,
              error: terminal?.error,
              ip,
              stackBytes: terminal?.stack?.slice(-8).map((item) => item.length),
              terminalStack: terminal?.stack?.slice(-45).map((item, index, stack) => ({
                depth: stack.length - 1 - index,
                bytes: item.length,
                hex: binToHex(item).slice(0, 160),
              })),
              handlerSnapshots,
              nearby: terminal?.instructions?.slice(Math.max(0, ip - 24), ip + 2)
                .map((instruction, offset) => ({
                  ip: Math.max(0, ip - 24) + offset,
                  opcode: instruction.opcode,
                  data: instruction.data && binToHex(instruction.data).slice(0, 64),
                })),
              ring: trace.slice(-18).map((raw) => {
                const state = raw as {
                  ip?: number; stack?: Uint8Array[]; instructions?: Array<{ opcode: number }>;
                  error?: string;
                };
                return {
                  ip: state.ip,
                  opcode: state.instructions?.[state.ip ?? -1]?.opcode,
                  stack: state.stack?.slice(-6).map((item) => ({
                    bytes: item.length,
                    hex: binToHex(item).slice(0, 48),
                  })),
                  error: state.error,
                };
              }),
              outputBytecodeStack: lastOutputBytecode?.stack?.map((item, index, stack) => ({
                depth: stack.length - 1 - index,
                bytes: item.length,
                hex: binToHex(item).slice(0, 80),
              })),
            };
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_HANDLER_SNAPSHOTS === '1') {
              const frames = new Map<number, { states: number; minIp: number; maxIp: number }>();
              for (const raw of trace) {
                const state = raw as { ip?: number; instructions?: Array<{ opcode: number }> };
                const instructionCount = state.instructions?.length ?? 0;
                const frame = frames.get(instructionCount) ?? {
                  states: 0, minIp: Number.POSITIVE_INFINITY, maxIp: -1,
                };
                frame.states += 1;
                frame.minIp = Math.min(frame.minIp, state.ip ?? -1);
                frame.maxIp = Math.max(frame.maxIp, state.ip ?? -1);
                frames.set(instructionCount, frame);
              }
              console.error('handler-boundary', JSON.stringify({
                error: terminal?.error,
                ip,
                snapshots: handlerSnapshots,
                frames: [...frames.entries()].sort(([left], [right]) => right - left).slice(0, 24),
              }));
            } else {
              const terminalState = terminal as {
                instructions?: Array<{ opcode: number; data?: Uint8Array }>;
                stack?: Uint8Array[];
              } | undefined;
              const firstTiny = trace.findIndex((raw) => (
                (raw as { instructions?: unknown[] }).instructions?.length ?? 0) === 5);
              const before = firstTiny < 0 ? [] : trace.slice(Math.max(0, firstTiny - 6), firstTiny + 1)
                .map((raw) => {
                  const state = raw as {
                    ip?: number; instructions?: Array<{ opcode: number; data?: Uint8Array }>;
                    stack?: Uint8Array[];
                  };
                  return {
                    ip: state.ip,
                    frame: state.instructions?.length ?? 0,
                    opcode: state.instructions?.[state.ip ?? -1]?.opcode,
                    id: state.instructions?.[(state.ip ?? 0) - 1]?.data
                      ? binToHex(state.instructions[(state.ip ?? 0) - 1]!.data!).slice(0, 8) : undefined,
                    top: (state.stack ?? []).slice(-4).map((item, index, stack) =>
                      `${stack.length - 1 - index}:${item.length}:${binToHex(item).slice(0, 48)}`),
                  };
                });
              console.error('no-progress-before-frame', JSON.stringify({
                buildId: peekBuildId(), firstTiny, before,
              }));
              const framesOf = (count: number): unknown[] => {
                const first = trace.find((raw) => (
                  (raw as { instructions?: unknown[] }).instructions?.length ?? 0) === count) as
                  { instructions?: Array<{ opcode: number; data?: Uint8Array }>; stack?: Uint8Array[] } | undefined;
                if (!first) return [];
                return [{
                  program: (first.instructions ?? []).map((instruction) => `${instruction.opcode}`
                    + (instruction.data ? `:${binToHex(instruction.data)}` : '')),
                  stack: (first.stack ?? []).slice(-6).map((item, index, stack) =>
                    `${stack.length - 1 - index}:${item.length}:${binToHex(item).slice(0, 260)}`),
                }];
              };
              const frameEntries: unknown[] = [];
              for (const [index, raw] of trace.entries()) {
                const state = raw as {
                  ip?: number; instructions?: Array<{ opcode: number; data?: Uint8Array }>;
                  stack?: Uint8Array[];
                };
                if ((state.ip ?? -1) !== 0 || !state.instructions) continue;
                frameEntries.push({
                  index,
                  size: state.instructions.length,
                  head: state.instructions.slice(0, 6).map((instruction) => `${instruction.opcode}`
                    + (instruction.data ? `:${binToHex(instruction.data).slice(0, 12)}` : '')).join(' '),
                  stackDepth: state.stack?.length,
                });
              }
              const bodies = new Map<string, { states: number; minIp: number; maxIp: number; order: number }>();
              let order = 0;
              let failing = '';
              const terminalInstructions = (terminal as { instructions?: Array<{ opcode: number }> } | undefined)
                ?.instructions;
              for (const raw of trace) {
                const state = raw as { ip?: number; instructions?: Array<{ opcode: number }> };
                if (!state.instructions) continue;
                const key = state.instructions.slice(0, 6).map((instruction) => instruction.opcode).join(',');
                const entry = bodies.get(key);
                if (!entry) {
                  bodies.set(key, { states: 1, minIp: state.ip ?? -1, maxIp: state.ip ?? -1, order: order++ });
                } else {
                  entry.states += 1;
                  entry.minIp = Math.min(entry.minIp, state.ip ?? -1);
                  entry.maxIp = Math.max(entry.maxIp, state.ip ?? -1);
                }
                if (terminalInstructions && state.instructions === terminalInstructions) failing = key;
              }
              const failingIndex = terminalInstructions
                ? trace.findIndex((raw) => (raw as { instructions?: unknown }).instructions === terminalInstructions)
                : -1;
              const around = failingIndex < 0 ? [] : trace
                .slice(Math.max(0, failingIndex - 3), failingIndex + 3)
                .map((raw, offset) => {
                  const state = raw as {
                    ip?: number; instructions?: Array<{ opcode: number; data?: Uint8Array }>;
                    stack?: Uint8Array[];
                  };
                  return {
                    at: Math.max(0, failingIndex - 3) + offset,
                    ip: state.ip,
                    size: state.instructions?.length ?? 0,
                    head: (state.instructions ?? []).slice(0, 8).map((instruction) => `${instruction.opcode}`
                      + (instruction.data ? `:${binToHex(instruction.data).slice(0, 16)}` : '')).join(' '),
                    stack: (state.stack ?? []).map((item, index, stack) =>
                      `${stack.length - 1 - index}:${item.length}:${binToHex(item).slice(0, 120)}`),
                  };
                });
              console.error('no-progress-around-failing', JSON.stringify({
                buildId: peekBuildId(), failingIndex, around,
              }));
              console.error('no-progress-bodies', JSON.stringify({
                buildId: peekBuildId(),
                failing,
                bodies: [...bodies.entries()].map(([key, entry]) => ({ key, ...entry })),
              }));
              console.error('no-progress-frame-entries', JSON.stringify({
                buildId: peekBuildId(),
                entries: frameEntries.slice(-10),
              }));
              console.error('no-progress-frames', JSON.stringify({
                buildId: peekBuildId(), five: framesOf(5), seven: framesOf(7),
              }));
              console.error('no-progress-terminal', JSON.stringify({
                buildId: peekBuildId(),
                ip,
                program: (terminalState?.instructions ?? []).slice(0, 8).map(
                  (instruction) => `${instruction.opcode}`
                    + (instruction.data ? `:${binToHex(instruction.data).slice(0, 30)}` : ''),
                ),
                instructionCount: terminalState?.instructions?.length ?? 0,
                stack: (terminalState?.stack ?? []).slice(-14).map((item, index, stack) =>
                  `${stack.length - 1 - index}:${item.length}:${binToHex(item).slice(0, 60)}`),
              }));
              console.error('atomic-deferred-compute-no-progress', JSON.stringify({
                buildId: peekBuildId(),
                error: diagnostic.error,
                ip: diagnostic.ip,
                states: diagnostic.states,
                executionInput: diagnostic.executionInput,
                stackBytes: diagnostic.stackBytes,
              }));
            }
          }
          return progressed;
        },
        refresh: buildFinalized,
      }),
    });
  }
  // J7: route union may retain speculative `00` stubs for an unselected sibling's dynamic array.
  // Only the active named handler's dynamicWrites are incompleteness-relevant for this local builder.
  // Absent dynamicWrites on a non-route entry means the selected handler writes none (treat as []).
  const selectedAbi = host.selectedAbiFunction();
  const selectedIsRoute = selectedAbi?.name === '__message_bus1'
    || (selectedAbi?.name?.startsWith('__message_bus') ?? false);
  const activeDynamicWrites = selectedIsRoute
    ? undefined
    : (selectedAbi?.dynamicWrites ?? (selectedAbi !== undefined ? [] : undefined));
  const incompleteDynamicChunks = stb.getDynamicChunkVars().flatMap((variable) => {
    if (Array.isArray(activeDynamicWrites) && !activeDynamicWrites.includes(variable.name)) {
      return [];
    }
    const commitments = stb.getChunkRawCommitments(variable.name);
    const unresolved = commitments.filter((commitment) => commitment === '00').length;
    return unresolved === 0 ? [] : [{
      variable: variable.name,
      resolved: commitments.length - unresolved,
      total: commitments.length,
    }];
  });
  if (incompleteDynamicChunks.length > 0) {
    (builder as TransactionBuilder & {
      __messageBusIncompleteDynamicChunks?: readonly {
        variable: string; resolved: number; total: number;
      }[];
    }).__messageBusIncompleteDynamicChunks = Object.freeze(incompleteDynamicChunks);
  }
  if (host.recursivePreflightHasSignatures()) {
    throw new Error(
      `Recursive state invocation '${host.functionName}' contains transaction signatures and cannot expose `
      + 'an unsigned intermediate builder; call .send() so the SDK can preflight the fully funded transaction.',
    );
  }
  host.preflightRecursiveBuilder(builder);
  return builder;
}
