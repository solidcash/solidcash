import { appendFileSync } from 'fs';
import { expect } from 'vitest';
import { binToHex, sha256, utf8ToBin } from '@bitauth/libauth';
import { Contract } from '../../../src/Contract.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';

/**
 * X204 SETTLEMENT ATTRIBUTION PROBE. Records which BUS HANDLER each SETTLED transaction actually drove.
 *
 * The recorded "VM-proved" figure has always been a hand count copied between files: each recovered-handler
 * test carries its own `verdict: 'proven' | 'unproven'` literal, set by whoever wrote the row. A file that
 * names a handler is not a file that settles it, and a `verdict` field is not a measurement.
 *
 * This probe derives the list from the run itself, from two facts the SDK cannot fake:
 *
 *  1. WHICH HANDLER WAS DRIVEN. `Contract.createCompilerRouteUnlocker` is the only way a participant's SCB1
 *     route is spent. Its `batchBlob` argument carries the row selectors the covenant will dispatch on, so
 *     intersecting the blob with the participant's OWN published handler selectors names the handler(s) that
 *     input executes. The artifact is read off the live `Contract`, so nothing is quoted.
 *  2. WHETHER IT SETTLED. `MockNetworkProvider.sendRawTransaction` either returns a txid or raises. Only the
 *     returning case is recorded as a settlement.
 *
 * ATTRIBUTION IS BY CONTAINMENT, NOT BY ADJACENCY, and that distinction is the whole correctness of the
 * figure. `createCompilerRouteUnlocker` duplicates the executable batch blob as a positional push inside the
 * master input's unlocking script, so a transaction that really drove a handler CONTAINS that handler's blob
 * bytes. Ordering alone is not enough: a PROBE attempt builds its route, traces it under the VM debugger and
 * never broadcasts, leaving its route "pending" for the next attempt's controller-initialization transaction
 * to absorb. That absorption invents settlements for handlers whose only real attempt was REFUSED, which is
 * exactly the class of false positive this figure exists to avoid. Containment cannot absorb: the
 * initialization transaction does not carry the blob.
 *
 * Inert unless `L3_X204_OUT` names an output file. A pure observer: every patched method forwards to the
 * original and returns its result unchanged, and every record is written inside a `try`.
 */

// One file per worker process. Vitest runs test files in parallel workers and a shared append would
// interleave partial lines once a record exceeds the atomic-append size; the consumer reads the whole glob.
const OUT = process.env.L3_X204_OUT === undefined
  ? undefined : `${process.env.L3_X204_OUT}.${process.pid}`;

let sequence = 0;

function emit(record: Record<string, unknown>): void {
  try {
    appendFileSync(OUT!, `${JSON.stringify({
      seq: (sequence += 1), test: expect.getState().currentTestName ?? 'unknown', ...record,
    })}\n`);
  } catch {
    // Observation must never change the outcome of the test it observes.
  }
}

/** Every route staged so far in this worker, keyed by its batch-blob hex. Bounded by the run's route count. */
export interface StagedRoute {
  contract: string;
  participantBytecode: string;
  sourceDigest: string | null;
  handlers: string[];
  published: string[];
  blobBytes: number;
  test: string;
  seq: number;
}
const stagedByBlob = new Map<string, StagedRoute[]>();

export interface CollisionResolution {
  blobDigest: string;
  candidateIdentities: string[];
  matchedIdentities: string[];
  resolutionCardinality: number;
}

const routeIdentity = (route: StagedRoute): string => {
  const bytecodeDigest = binToHex(sha256.hash(utf8ToBin(route.participantBytecode))).slice(0, 24);
  return `${route.sourceDigest ?? 'missing'}:${route.contract}:${bytecodeDigest}`;
};

/** Resolve every contained blob independently. Collisions are evidence and never silently disappear. */
export const resolveContainedRoutes = (
  txHex: string, routes: ReadonlyMap<string, StagedRoute[]>,
): { drove: StagedRoute[]; collisionResolutions: CollisionResolution[] } => {
  const drove: StagedRoute[] = [];
  const collisionResolutions: CollisionResolution[] = [];
  for (const [blobHex, candidates] of routes) {
    if (!txHex.includes(blobHex)) continue;
    if (candidates.length === 1) {
      drove.push(candidates[0]);
      continue;
    }
    const matched = candidates.filter((candidate) => txHex.includes(candidate.participantBytecode));
    const candidateIdentities = [...new Set(candidates.map(routeIdentity))].sort();
    const matchedByIdentity = new Map(matched.map((candidate) => [routeIdentity(candidate), candidate]));
    const matchedIdentities = [...matchedByIdentity.keys()].sort();
    collisionResolutions.push({
      blobDigest: binToHex(sha256.hash(utf8ToBin(blobHex))).slice(0, 24),
      candidateIdentities,
      matchedIdentities,
      resolutionCardinality: matchedIdentities.length,
    });
    if (matchedIdentities.length === 1) drove.push(matchedByIdentity.get(matchedIdentities[0])!);
  }
  return { drove, collisionResolutions };
};

if (OUT !== undefined) {
  const originalUnlocker = Contract.prototype.createCompilerRouteUnlocker;
  Contract.prototype.createCompilerRouteUnlocker = function patched(
    this: Contract, abiFunction: never, selector: Uint8Array,
  ): ReturnType<Contract['createCompilerRouteUnlocker']> {
    const make = originalUnlocker.call(this, abiFunction, selector);
    const artifact = (this as unknown as { artifact: Record<string, never> }).artifact as never as {
      contractName: string;
      source?: string;
      messageBus?: { handlers?: { name: string; selector: string; eligible?: boolean }[] };
    };
    const batchBlobIndex = (abiFunction as unknown as { inputs: { name: string }[] }).inputs
      .findIndex((input) => input.name === 'batchBlob');
    if (batchBlobIndex < 0) return make;
    return (...args: never[]) => {
      try {
        const blob = args[batchBlobIndex] as unknown;
        if (!(blob instanceof Uint8Array) || blob.length === 0) return make(...args);
        const blobHex = binToHex(blob);
        const handlers = artifact.messageBus?.handlers ?? [];
        const staged: StagedRoute = {
          contract: artifact.contractName,
          // A direct, non-route spend of this same participant includes its redeem bytecode but not the staged
          // batch blob. Recording both lets the consumer distinguish "unrelated initialization" from "same
          // contract, ordinary entry point" without attributing either as a route settlement.
          participantBytecode: this.bytecode,
          // Thirteen `Contract.handler` names in the 206 sit on more than one partition row (three different
          // files declare `UniswapV2ERC20.totalSupply`), so the contract name alone cannot address a row.
          // The source digest resolves which file the settling artifact was compiled from.
          sourceDigest: typeof artifact.source === 'string'
            ? binToHex(sha256.hash(utf8ToBin(artifact.source))).slice(0, 24) : null,
          // Only the participant's OWN selectors are candidates, so a 4-byte match inside a short blob is
          // scoped to this artifact rather than to the whole 4-byte space.
          handlers: handlers
            .filter((handler) => handler.selector !== undefined && blobHex.includes(handler.selector))
            .map((handler) => handler.name),
          published: handlers.map((handler) => handler.name),
          blobBytes: blob.length,
          test: expect.getState().currentTestName ?? 'unknown',
          seq: sequence + 1,
        };
        const candidates = stagedByBlob.get(blobHex) ?? [];
        if (!candidates.some((candidate) => candidate.participantBytecode === staged.participantBytecode
          && candidate.sourceDigest === staged.sourceDigest && candidate.contract === staged.contract)) {
          candidates.push(staged);
          stagedByBlob.set(blobHex, candidates);
        }
        emit({ kind: 'route', ...staged });
      } catch {
        // Observation must never change the outcome.
      }
      return make(...args);
    };
  } as typeof originalUnlocker;

  const originalSend = MockNetworkProvider.prototype.sendRawTransaction;
  MockNetworkProvider.prototype.sendRawTransaction = async function patched(
    this: MockNetworkProvider, txHex: string,
  ): Promise<string> {
    try {
      const txid = await originalSend.call(this, txHex);
      // CONTAINMENT. A settled transaction drove exactly the routes whose executable batch blob its bytes
      // carry. Nothing is inferred from ordering, so a probe that never broadcast cannot be absorbed.
      const { drove, collisionResolutions } = resolveContainedRoutes(txHex, stagedByBlob);
      const noRouteCandidates = drove.length === 0
        ? [...new Map([...stagedByBlob.values()].flat()
          .filter((staged) => txHex.includes(staged.participantBytecode))
          .map((staged) => [`${staged.sourceDigest}:${staged.contract}`, staged])).values()]
          .map(({ contract, sourceDigest }) => ({ contract, sourceDigest }))
        : [];
      emit({ kind: 'settled', txid, rawBytes: txHex.length / 2, drove, collisionResolutions, noRouteCandidates });
      return txid;
    } catch (error) {
      const { drove, collisionResolutions } = resolveContainedRoutes(txHex, stagedByBlob);
      emit({
        kind: 'refused', drove, collisionResolutions,
        reason: String((error as Error).message).split('\n')[0].slice(0, 240),
      });
      throw error;
    }
  } as typeof originalSend;
}
