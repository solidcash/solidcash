/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 iteration probe build/fingerprint/evaluate.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import type { Output } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import {
  evaluateProbeTrace,
  fingerprintLibauthTransaction,
} from './faithful-probe-trace.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { buildParticipantProbeProgram } from './participant-probe-program.js';

export interface DeriveFullPhase2IterationProbeHost {
  readonly inner: { provider: NetworkProvider };
  lastDerivationIterations: number;
}

export type DeriveFullPhase2IterationProbeResult = {
  fixedPoint: boolean;
  probeBuilder2: TransactionBuilder;
  phase2ParamSnap: ReturnType<StatefulTransactionBuilder['snapshotBuilderReturnOutputParams']> | undefined;
  phase2Insertion: ReturnType<StatefulTransactionBuilder['insertBeforeLateValueSuffix']> | undefined;
  previousProbeFingerprint: string | undefined;
  transaction2?: ReturnType<TransactionBuilder['buildLibauthProgram']>['transaction'];
  sourceOutputs2?: ReturnType<TransactionBuilder['buildLibauthProgram']>['sourceOutputs'];
  fullTrace2?: AuthenticationProgramStateCommon[];
  faithfulProbeHadError?: boolean;
  lastTrace?: AuthenticationProgramStateCommon[];
  lastFailProbeOutputs?: Output[];
  debugIterationBuiltAt?: number;
};

/**
 * Build one Phase-2 convergence probe, detect transaction fixed-points, and evaluate
 * the faithful/discovery trace. Caller owns try/finally restore of return-output params.
 */
export function deriveFullPhase2IterationProbe(
  host: DeriveFullPhase2IterationProbeHost,
  stb: StatefulTransactionBuilder,
  params: {
    iter: number;
    dummyLbc: Uint8Array;
    delegatecallInputIndex: number | undefined;
    debugTargetsThisDerivation: boolean;
    previousProbeFingerprint: string | undefined;
    lockingBytecodeFingerprintCache: WeakMap<Uint8Array, string>;
    fingerprintLockingBytecode: (bytecode: Uint8Array) => string;
    retainDiagnosticTrace: (
      trace: AuthenticationProgramStateCommon[],
    ) => AuthenticationProgramStateCommon[];
    debugIterationStartedAt: number;
  },
): DeriveFullPhase2IterationProbeResult {
  const {
    iter, dummyLbc, delegatecallInputIndex, debugTargetsThisDerivation,
    lockingBytecodeFingerprintCache, fingerprintLockingBytecode, retainDiagnosticTrace,
    debugIterationStartedAt,
  } = params;
  let previousProbeFingerprint = params.previousProbeFingerprint;

  const probeBuilder2 = stb.build();
  const debugBuilderBuiltAt = debugTargetsThisDerivation ? Date.now() : 0;
  if (debugTargetsThisDerivation) console.error('derive-phase2-builder-built', {
    iter, buildMs: debugBuilderBuiltAt - debugIterationStartedAt,
  });
  // Delegate dynamic chunks are authenticated from TXOUTPUTCOUNT-1-nNew. send() inserts fee
  // change *before* that [chunks][one suffix] region. A probe remainder appended after the
  // suffix makes the covenant read OP_RETURN / the dummy as a value chunk.
  const phase2ParamSnap = delegatecallInputIndex !== undefined
    && probeBuilder2.outputs.length > 30
    ? stb.snapshotBuilderReturnOutputParams(probeBuilder2) : undefined;
  let phase2Insertion: ReturnType<typeof stb.insertBeforeLateValueSuffix> | undefined;
  phase2Insertion = delegatecallInputIndex !== undefined
    ? stb.insertBeforeLateValueSuffix(probeBuilder2, { to: dummyLbc, amount: 1000n }, {
      rebindReturnWitnessesOnly: probeBuilder2.outputs.length > 30,
    }) : undefined;
  const { transaction: transaction2, sourceOutputs: sourceOutputs2 } = buildParticipantProbeProgram(
    probeBuilder2, stb.getComposedBlockBase(),
  );
  const debugProgramBuiltAt = debugTargetsThisDerivation ? Date.now() : 0;
  if (debugTargetsThisDerivation) console.error('derive-phase2-program-built', {
    iter, programMs: debugProgramBuiltAt - debugBuilderBuiltAt,
  });
  // If applying the previous trace did not change either the candidate transaction or any spent output,
  // evaluating it again is guaranteed to produce the same trace. This commonly occurs for an intentional
  // source-level revert in a contract that also has dynamic/loop storage: those layouts raise the general
  // derivation ceiling to 64, but no commitment can make the rejected call advance. Detect the fixed point
  // from the complete VM program rather than a partial commitment fingerprint, so legitimate multi-probe
  // derivations continue whenever even one input/output byte changes.
  const transactionFingerprint = fingerprintLibauthTransaction(
    transaction2, lockingBytecodeFingerprintCache,
  );
  const debugTransactionHashedAt = debugTargetsThisDerivation ? Date.now() : 0;
  const sourceOutputFingerprint = sourceOutputs2.map((output) => [
    output.valueSatoshis.toString(),
    fingerprintLockingBytecode(output.lockingBytecode),
    output.token?.category === undefined ? '' : binToHex(output.token.category),
    output.token?.amount?.toString() ?? '',
    output.token?.nft?.capability ?? '',
    output.token?.nft?.commitment === undefined ? '' : binToHex(output.token.nft.commitment),
  ].join(':')).join('|');
  if (debugTargetsThisDerivation) console.error('derive-phase2-program-fingerprinted', {
    iter,
    transactionMs: debugTransactionHashedAt - debugProgramBuiltAt,
    sourceOutputsMs: Date.now() - debugTransactionHashedAt,
  });
  const probeFingerprint = `${transactionFingerprint}|${sourceOutputFingerprint}`;
  if (probeFingerprint === previousProbeFingerprint) {
    return {
      fixedPoint: true,
      probeBuilder2,
      phase2ParamSnap,
      phase2Insertion,
      previousProbeFingerprint,
    };
  }
  previousProbeFingerprint = probeFingerprint;
  host.lastDerivationIterations = iter + 1;
  const debugIterationBuiltAt = debugTargetsThisDerivation ? Date.now() : 0;
  if (debugTargetsThisDerivation) console.error('derive-phase2-transaction-built', {
    iter,
    buildMs: debugIterationBuiltAt - debugIterationStartedAt,
    inputs: transaction2.inputs.length,
    outputs: transaction2.outputs.length,
    unlockingBytes: transaction2.inputs.reduce((sum, input) => sum + input.unlockingBytecode.length, 0),
  });

  const probeProgram = {
    inputIndex: delegatecallInputIndex ?? 0,
    sourceOutputs: sourceOutputs2,
    transaction: transaction2,
  };
  // A dynamic output region can contain dozens of independently verified commitments. Run the discovery
  // VM directly: it records whether it actually suppressed a failed output EQUALVERIFY. If it suppresses
  // nothing, its result is byte-for-byte the faithful verdict; if it does, the iteration remains marked as
  // failed and only supplies candidates for the next probe. This preserves the faithful fixed-point gate
  // without first executing the same multi-megabyte covenant to its first mismatch twice.
  // Discover every output pin in one evaluation: a failing EQUALVERIFY is suppressed so later
  // NFT commitments on the same input still appear in the trace. A suppressed verify is not a
  // faithful success; the next iteration must confirm without a mismatch.
  // Relaxed discovery is only a win when several data NFTs can be pinned in one probe.
  // On a single-NFT layout it continues past the first failed EQUALVERIFY and later
  // stack garbage is applied as the state commitment (fixed-size array writes).
  // Scalar multi-NFT layouts already relax. Mapping-only functions have stateCount 0 and several
  // entry NFTs; without relaxation the VM stops at the first EQUALVERIFY and each insert needs its
  // own probe. Do not relax stateCount == 1, and do not relax fixed-size arrays (kind === 'array'):
  // those clobber the first valid pin with later stack garbage.
  // The sparse observer cannot currently see introspection executed inside OP_INVOKE bodies. Runtime-loop
  // transfer values are verified there, so use the faithful reduced debug trace until those outputs have
  // converged. This remains bounded by the kernel's 64-iteration admission limit.
  const hasRuntimeLoopTransfers = stb.getRuntimeLoopTransferOutputs().length > 0;
  // A chunked runtime event's records are read off the verifier's stacks there as well.
  const hasChunkedRuntimeEvents = stb.getRuntimeLoopEventOutputs().some((event) => event.chunked);
  const fullTrace2 = evaluateProbeTrace(
    host.inner.provider, probeProgram, hasRuntimeLoopTransfers || hasChunkedRuntimeEvents,
  );
  const faithfulProbeHadError = fullTrace2.some((state) => state.error !== undefined);
  if (debugTargetsThisDerivation) {
    const last = fullTrace2.at(-1);
    const instruction = last?.instructions[last.ip];
    const dumpNearby = fullTrace2.length >= 9 && fullTrace2.length <= 120;
    const outputAt = (index: number): Record<string, unknown> => {
      const output = probeBuilder2.outputs[index];
      const lock = output?.to instanceof Uint8Array
        ? output.to
        : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
      return {
        i: index,
        lock: lock ? binToHex(lock).slice(0, 20) : undefined,
        cat: output?.token?.category?.slice(0, 12),
        cap: output?.token?.nft?.capability,
        commit: String(output?.token?.nft?.commitment ?? '').slice(0, 16),
        amount: output?.amount?.toString(),
      };
    };
    console.error('derive-phase2-evaluated', {
      iter,
      evaluateMs: Date.now() - debugIterationBuiltAt,
      states: fullTrace2.length,
      error: last?.error,
      ip: last?.ip,
      opcode: instruction?.opcode,
      stack: last?.stack.slice(-8).map((item) => `${item.length}:${binToHex(item).slice(0, 32)}`),
      nearby: dumpNearby && last
        ? last.instructions.slice(Math.max(0, last.ip - 16), last.ip + 8).map((item, offset) => {
          const ip = Math.max(0, last.ip - 16) + offset;
          const data = 'data' in item && item.data ? binToHex(item.data).slice(0, 20) : '';
          return `${ip}:${item.opcode}${data ? `:${data}` : ''}${ip === last.ip ? '*' : ''}`;
        })
        : undefined,
      out33: dumpNearby ? outputAt(33) : undefined,
      out34: dumpNearby ? outputAt(34) : undefined,
    });
  }
  // Only the terminal diagnostic tail is needed after this iteration. Retaining the complete trace here
  // keeps every intermediate stack item alive while the next oversized probe executes, doubling the peak
  // heap for multi-megabyte routed contracts and forcing long stop-the-world collections.
  const nextLastTrace = retainDiagnosticTrace(fullTrace2);
  let nextLastFailProbeOutputs: Output[] | undefined;
  if (faithfulProbeHadError) {
    nextLastFailProbeOutputs = probeBuilder2.outputs.map((output) => ({
      to: output.to,
      amount: output.amount,
      token: output.token ? {
        amount: output.token.amount,
        category: output.token.category,
        nft: output.token.nft ? {
          capability: output.token.nft.capability,
          commitment: String(output.token.nft.commitment ?? ''),
        } : undefined,
      } : undefined,
    }));
  }

  return {
    fixedPoint: false,
    probeBuilder2,
    phase2ParamSnap,
    phase2Insertion,
    previousProbeFingerprint,
    transaction2,
    sourceOutputs2,
    fullTrace2,
    faithfulProbeHadError,
    lastTrace: nextLastTrace,
    lastFailProbeOutputs: nextLastFailProbeOutputs,
    debugIterationBuiltAt,
  };
}
