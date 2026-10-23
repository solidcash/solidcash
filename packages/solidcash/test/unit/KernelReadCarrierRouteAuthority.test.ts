import { compileString } from 'solidc';
import {
  kernelJournalDispositionCommitmentMarker,
  kernelJournalDispositionManifestDigest,
  type AbiFunction,
  type Artifact,
} from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { encodeMessageBatch } from '../../src/message-bus/message-bus.js';
import {
  kernelReadCarrierCapabilityForSelectedRoute,
} from '../../src/stateful/StatefulContract.js';
import {
  kernelEntryJournalReadCarrierCapabilityFromArtifact,
  kernelJournalDispositionsFromArtifact,
  type KernelEntryJournalReadCarrierCapability,
} from '../../src/stateful/KernelEntryJournal.js';
import { createTestProvider } from '../test-util.js';

const SOURCE = `pragma solidcash ^0.14.0;
contract CarrierAuthorityFixture() {
  int stored;
  function set(int next) public { this.stored = next; require(true); }
}`;

function carrierFixture(): {
  artifact: Artifact;
  handler: AbiFunction;
  capability: KernelEntryJournalReadCarrierCapability;
} {
  const artifact = compileString(SOURCE, {
    forceStateful: true, messageBus: true, messageBusKernel: true,
    maximumInputBytes: 1_000_000, suppressWarnings: true,
  });
  const handler = artifact.abi.find((candidate) => candidate.name === 'set')!;
  const publishedHandler = artifact.messageBus!.handlers.find((candidate) => candidate.name === 'set')!;
  handler.inputs = [
    ...handler.inputs,
    { name: '__internal__kernelJournalAccessStreams', type: 'bytes[]' },
  ];
  handler.sortedUpsertLoopInfo = [{
    collection: 'records', collectionHash: '11'.repeat(20), journalAccessStreamIndex: 0,
    fixedKeyParams: [], varyingArrayParam: '__internal__permutation',
    valueArrayIndexParam: '__internal__permutation', op: 'read',
  }];
  artifact.messageBus!.kernelEntryJournal = {
    version: 1,
    // Carrier publication is still compiler-disabled. This synthetic fixture exercises only the SDK's local
    // route-lineage boundary; arbitrary public JSON is not treated as a compiler or bytecode trust proof.
    kernelJournalDispositions: {
      version: 1,
      handlers: [{
        selectorHex: publishedHandler.selector,
        completedDescriptorDigest: '22'.repeat(32),
        mode: 'carrier',
        streams: [{
          journalAccessStreamIndex: 0,
          descriptorDigest: '33'.repeat(32),
          disposition: 'carrier',
        }],
      }],
    },
    capabilities: [{
      kind: 'internal-read-carrier', version: 1,
      scopes: [{ handlerSelector: publishedHandler.selector, journalAccessStreamIndex: 0 }],
    }],
  };
  const dispositions = artifact.messageBus!.kernelEntryJournal.kernelJournalDispositions!;
  const digest = kernelJournalDispositionManifestDigest(dispositions);
  artifact.messageBus!.kernelEntryJournal.kernelJournalDispositionCommitment = { version: 1, digest };
  artifact.bytecode += ` ${kernelJournalDispositionCommitmentMarker(digest)!}`;
  return { artifact, handler, capability: kernelEntryJournalReadCarrierCapabilityFromArtifact(artifact)! };
}

describe('kernel read-carrier route authority', () => {
  it('requires one exact marker token pair rather than a substring or duplicate', () => {
    const { artifact } = carrierFixture();
    const digest = artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositionCommitment!.digest;
    const marker = kernelJournalDispositionCommitmentMarker(digest)!;
    artifact.bytecode = artifact.bytecode.replace(marker, `00${marker}`);
    expect(() => kernelJournalDispositionsFromArtifact(artifact)).toThrow(/not uniquely committed/);

    artifact.bytecode = artifact.bytecode.replace(`00${marker}`, `${marker} ${marker}`);
    expect(() => kernelJournalDispositionsFromArtifact(artifact)).toThrow(/not uniquely committed/);
  });

  it('binds canonical SDK lineage to immutable blob, selector, arguments, and ABI identity', () => {
    const { artifact, handler, capability } = carrierFixture();
    expect(capability).toBeDefined();

    const contract = StatefulContract.withCategory(
      new Contract(artifact, [], { provider: createTestProvider() }), '00'.repeat(32),
    );
    const call = contract.batch([{ function: 'set', args: [2n] }]);
    const prepared = call as unknown as {
      functionArgs: unknown[];
      compilerRoute: { abiFunction: typeof artifact.messageBus.route };
    };
    const route = prepared.compilerRoute.abiFunction as typeof artifact.messageBus.route & {
      messageBusRowArguments: Array<{ args: unknown[]; handler: typeof handler }>;
    };
    const blob = prepared.functionArgs[0] as Uint8Array;
    const rows = route.messageBusRowArguments;

    expect(kernelReadCarrierCapabilityForSelectedRoute(
      capability, undefined, rows, route, artifact, blob,
    )).toBe(capability);
    expect(kernelReadCarrierCapabilityForSelectedRoute(
      capability, undefined, rows, { ...route }, artifact, blob,
    )).toBeUndefined();
    expect(() => kernelReadCarrierCapabilityForSelectedRoute({
      ...capability,
      scopes: capability.scopes!.map((scope) => ({ ...scope, journalAccessStreamIndex: 1 })),
    }, undefined, rows, route, artifact, blob)).toThrow(/capability differs/);

    rows[0].args[0] = 3n;
    expect(() => kernelReadCarrierCapabilityForSelectedRoute(
      capability, undefined, rows, route, artifact, blob,
    )).toThrow(/authenticated (?:row|envelope) snapshot|disagree/);
    rows[0].args[0] = 2n;

    blob[blob.length - 1] ^= 1;
    expect(() => kernelReadCarrierCapabilityForSelectedRoute(
      capability, undefined, rows, route, artifact, blob,
    )).toThrow(/authenticated blob snapshot/);
  });

  it('does not transfer canonical encoder lineage to a byte-for-byte blob copy', () => {
    const { artifact, handler, capability } = carrierFixture();
    const encoded = encodeMessageBatch(artifact, [{ function: 'set', args: [2n] }]);
    const rows = [{ args: [2n], handler }];
    const contract = StatefulContract.withCategory(
      new Contract(artifact, [], { provider: createTestProvider() }), '00'.repeat(32),
    );
    const call = contract._batchRaw(Uint8Array.from(encoded.blob), encoded.routeWitnesses, {},
      0, false, undefined, false, undefined, rows);
    const prepared = call as unknown as {
      functionArgs: unknown[];
      compilerRoute: { abiFunction: typeof artifact.messageBus.route };
    };
    const route = prepared.compilerRoute.abiFunction as typeof artifact.messageBus.route & {
      messageBusRowArguments: typeof rows;
    };
    expect(kernelReadCarrierCapabilityForSelectedRoute(
      capability, undefined, route.messageBusRowArguments, route, artifact,
      prepared.functionArgs[0] as Uint8Array,
    )).toBeUndefined();
  });

  it.each([
    ['carrier capability', (artifact: Artifact) => {
      artifact.messageBus!.kernelEntryJournal!.capabilities = [{
        kind: 'internal-read-carrier', version: 1,
        scopes: [{
          handlerSelector: artifact.messageBus!.handlers.find((candidate) => candidate.name === 'set')!.selector,
          journalAccessStreamIndex: 1,
        }],
      }];
    }],
    ['disposition descriptor digest', (artifact: Artifact) => {
      artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositions!.handlers[0]
        .streams[0].descriptorDigest = '44'.repeat(32);
    }],
    ['complete disposition manifest', (artifact: Artifact) => {
      artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositions = {
        ...artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositions!,
        handlers: artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositions!.handlers.map((scope) => ({
          ...scope, completedDescriptorDigest: '55'.repeat(32),
        })),
      };
    }],
  ] as const)('rejects in-place %s substitution after route authentication', (_name, mutate) => {
    const { artifact, capability } = carrierFixture();
    const contract = StatefulContract.withCategory(
      new Contract(artifact, [], { provider: createTestProvider() }), '00'.repeat(32),
    );
    const call = contract.batch([{ function: 'set', args: [2n] }]);
    const prepared = call as unknown as {
      functionArgs: unknown[];
      compilerRoute: { abiFunction: typeof artifact.messageBus.route };
    };
    const route = prepared.compilerRoute.abiFunction as typeof artifact.messageBus.route & {
      messageBusRowArguments: Array<{ args: unknown[]; handler: AbiFunction }>;
    };
    mutate(artifact);
    expect(() => kernelReadCarrierCapabilityForSelectedRoute(
      capability, undefined, route.messageBusRowArguments, route, artifact,
      prepared.functionArgs[0] as Uint8Array,
    )).toThrow(/capability differs|authority changed|disposition manifest/);
  });
});
