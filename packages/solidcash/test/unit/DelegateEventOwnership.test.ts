import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  argumentsForPhysicalAbiFrame,
  clearMutableCollectionOutputsOutsideAuthoritativeRun,
  demoteUnclaimedConditionalEventOutput,
  demoteUnclaimedDelegateEventClones,
  externalCallEventDestinations,
  groupEventSignatures,
  isAuthenticatedEventRepairCommitment,
  lowLevelCallImmutableEventDestinations,
  lowLevelCallStateOwnerCategory,
  reassertDeclaredMutableSlotLock,
  type DelegateEventClaim,
} from '../../src/stateful/StatefulTransactionBuilder.js';

const category = '11'.repeat(32);
const eventLock = hexToBin(`aa20${'22'.repeat(32)}87`);
const otherLock = hexToBin(`aa20${'33'.repeat(32)}87`);
const commitment = '515e1976a914';

const eventOutput = (to = eventLock, value = commitment, categoryId = category): {
  to: Uint8Array;
  amount: bigint;
  token: { category: string; nft: { capability: string; commitment: string } };
} => ({
  to,
  amount: 1200n,
  token: {
    category: categoryId,
    nft: { capability: 'none', commitment: value },
  },
});

describe('argumentsForPhysicalAbiFrame', () => {
  const handler = {
    name: 'record',
    inputs: [{ name: 'key' }, { name: 'value' }, { name: '__internal__owner' }],
  };

  it('uses refreshed logical arguments when the physical ABI is that handler', () => {
    expect(argumentsForPhysicalAbiFrame({
      abiFunction: handler,
      physicalFunctionArgs: ['stale-key', 'stale-value'],
      logicalFunctionName: 'record',
      logicalFunctionArgs: ['current-key', 'current-value'],
      compilerRoute: { abiFunction: handler, args: ['route-key', 'route-value'] },
    })).toEqual(['current-key', 'current-value']);
  });

  it('keeps synthetic route arguments when the route ABI is not the logical handler', () => {
    const route = { name: '__dispatch', inputs: [{ name: 'batch' }] };
    expect(argumentsForPhysicalAbiFrame({
      abiFunction: route,
      physicalFunctionArgs: ['physical-batch'],
      logicalFunctionName: 'record',
      logicalFunctionArgs: ['current-key', 'current-value'],
      compilerRoute: { abiFunction: route, args: ['authenticated-batch'] },
    })).toEqual(['authenticated-batch']);
  });
});

describe('groupEventSignatures', () => {
  it('uses compiler slot identities and falls back to declared event order', () => {
    expect(groupEventSignatures({
      compilerRoute: {
        abiFunction: { name: '__dispatch' } as never,
        selector: new Uint8Array(),
        blob: new Uint8Array(),
        args: [],
        logicalSelectors: [],
        eventSignaturesBySlot: [undefined, 'Changed(bytes32)'],
      },
    }, {
      emits: [
        { eventSignature: 'Created(uint)', emitIndex: 0 },
        { eventSignature: 'Fallback(bool)', emitIndex: 1 },
      ],
    })).toEqual(['Created(uint)', 'Changed(bytes32)']);
  });
});

describe('externalCallEventDestinations', () => {
  it('reserves event slots from physical participant blocks only', () => {
    const groups = [{
      blockLayout: {
        blockSize: 8,
        slots: [
          { kind: 'master' as const, offset: 0 },
          { kind: 'event' as const, offset: 5, conditional: true },
          { kind: 'event' as const, offset: 6, conditional: true },
        ],
      },
    }, {
      sharedGroupIndex: 0,
      blockLayout: {
        blockSize: 8,
        slots: [{ kind: 'event' as const, offset: 3 }],
      },
    }];

    expect(externalCallEventDestinations(groups, (index) => [20, 40][index])).toEqual([25, 26]);
  });
});

describe('lowLevelCallImmutableEventDestinations', () => {
  it('uses the implementation coordinate and proxy execution category for delegate events', () => {
    const implementationCategory = '55'.repeat(32);
    const proxyCategory = '66'.repeat(32);
    const groups = [{
      categoryId: implementationCategory,
      callMode: 'delegatecall' as const,
      blockLayout: {
        blockSize: 8,
        slots: [
          { kind: 'event' as const, offset: 4 },
          { kind: 'returnEvent' as const, offset: 6 },
        ],
      },
    }, {
      categoryId: implementationCategory,
      callMode: 'call' as const,
      blockLayout: {
        blockSize: 4,
        slots: [{ kind: 'event' as const, offset: 2 }],
      },
    }];
    const proxies = [{ categoryId: proxyCategory, delegateCallGroupIndex: 0 }];

    expect(lowLevelCallImmutableEventDestinations(groups, proxies, (index) => [13, 30][index])).toEqual([
      { categoryId: proxyCategory, destination: 17 },
      { categoryId: proxyCategory, destination: 19 },
      { categoryId: implementationCategory, destination: 32 },
    ]);
  });

  it('collapses shared logical delegates to one physical state owner', () => {
    const implementationCategory = '77'.repeat(32);
    const proxyCategory = '88'.repeat(32);
    const implementation = { categoryId: implementationCategory, callMode: 'delegatecall' as const };
    const proxies = [{
      categoryId: proxyCategory,
      delegateCallGroupIndex: 0,
    }, {
      categoryId: implementationCategory,
      sharedGroupIndex: 0,
      delegateCallGroupIndex: 0,
    }];

    expect(lowLevelCallStateOwnerCategory(0, implementation, proxies)).toBe(proxyCategory);
    expect(lowLevelCallStateOwnerCategory(0, {
      categoryId: implementationCategory,
      callMode: 'call',
    }, proxies)).toBe(implementationCategory);
  });

  it('rejects one physical delegate assigned to distinct state owners', () => {
    const implementation = { categoryId: '99'.repeat(32), callMode: 'delegatecall' as const };
    const proxies = [{
      categoryId: 'aa'.repeat(32),
      delegateCallGroupIndex: 0,
    }, {
      categoryId: 'bb'.repeat(32),
      delegateCallGroupIndex: 0,
    }];

    expect(() => lowLevelCallStateOwnerCategory(0, implementation, proxies))
      .toThrow('multiple physical state owners');
  });

  it('keeps a root delegate on the root state owner despite routed external references', () => {
    const rootCategory = 'cc'.repeat(32);
    const implementation = { categoryId: 'dd'.repeat(32), callMode: 'delegatecall' as const };
    const routedExternals = [{
      categoryId: 'ee'.repeat(32),
      delegateCallGroupIndex: 0,
    }];

    expect(lowLevelCallStateOwnerCategory(
      0, implementation, routedExternals, rootCategory, 0,
    )).toBe(rootCategory);
  });
});

describe('isAuthenticatedEventRepairCommitment', () => {
  it('accepts a typed zero only at a compiler-owned event coordinate', () => {
    expect(isAuthenticatedEventRepairCommitment(Uint8Array.of(0), true)).toBe(true);
    expect(isAuthenticatedEventRepairCommitment(Uint8Array.of(0), false)).toBe(false);
    expect(isAuthenticatedEventRepairCommitment(new Uint8Array(), true)).toBe(false);
  });
});

describe('demoteUnclaimedConditionalEventOutput', () => {
  it('clears both token and stale collection-lock ownership', () => {
    const output = {
      to: eventLock,
      amount: 1200n,
      token: {
        category,
        nft: { capability: 'mutable', commitment: 'ab'.repeat(64) },
      },
    };

    expect(demoteUnclaimedConditionalEventOutput(output, category)).toBe(true);
    expect(output).toEqual({ to: Uint8Array.of(0x51), amount: 1200n });
  });

  it('preserves foreign-category and authenticated event owners', () => {
    const foreign = eventOutput(eventLock, '', '44'.repeat(32));
    const authenticated = eventOutput();

    expect(demoteUnclaimedConditionalEventOutput(foreign, category)).toBe(false);
    expect(demoteUnclaimedConditionalEventOutput(authenticated, category)).toBe(false);
    expect(foreign.to).toEqual(eventLock);
    expect(authenticated.to).toEqual(eventLock);
  });
});

describe('demoteUnclaimedDelegateEventClones', () => {
  it('ignores an unmaterialized slot in a sparse balanced frame', () => {
    const outputs = [undefined, eventOutput()] as unknown as Parameters<
      typeof demoteUnclaimedDelegateEventClones
    >[0];
    expect(demoteUnclaimedDelegateEventClones(outputs, [])).toBe(0);
    expect(outputs[1]).toEqual(eventOutput());
  });

  it('keeps claimed slots and makes only exact unclaimed clones inert', () => {
    const outputs = [
      eventOutput(),
      eventOutput(),
      eventOutput(otherLock),
      eventOutput(eventLock, '51'),
      eventOutput(eventLock, commitment, '44'.repeat(32)),
    ];
    const claims: DelegateEventClaim[] = [{
      destination: 0,
      categoryId: category,
      lockingBytecode: eventLock,
      commitment,
    }];

    expect(demoteUnclaimedDelegateEventClones(outputs, claims)).toBe(1);
    expect(outputs[0].to).toEqual(eventLock);
    expect(outputs[1].to).toEqual(Uint8Array.of(0x51));
    expect(outputs[1].token).toEqual(eventOutput().token);
    expect(outputs[2].to).toEqual(otherLock);
    expect(outputs[3].to).toEqual(eventLock);
    expect(outputs[4].to).toEqual(eventLock);
  });

  it('preserves every physical destination claimed for the same event identity', () => {
    const outputs = [eventOutput(), eventOutput(), eventOutput()];
    const claims: DelegateEventClaim[] = [0, 2].map((destination) => ({
      destination,
      categoryId: category,
      lockingBytecode: eventLock,
      commitment,
    }));

    expect(demoteUnclaimedDelegateEventClones(outputs, claims)).toBe(1);
    expect(outputs.map((output) => output.to)).toEqual([
      eventLock,
      Uint8Array.of(0x51),
      eventLock,
    ]);
  });
});

describe('reassertDeclaredMutableSlotLock', () => {
  it('restores the declared covenant without discarding a computed commitment', () => {
    const computedCommitment = 'ab'.repeat(128);
    const output = {
      to: otherLock,
      token: {
        category,
        nft: { capability: 'mutable', commitment: computedCommitment },
      },
    };
    const input = {
      token: { category, nft: { capability: 'mutable' } },
      unlocker: { generateLockingBytecode: () => eventLock },
    };

    expect(reassertDeclaredMutableSlotLock(output, input)).toBe(true);
    expect(output.to).toEqual(eventLock);
    expect(output.token.nft.commitment).toBe(computedCommitment);
  });

  it('does not claim a mutable output owned by another category', () => {
    const output = {
      to: otherLock,
      token: {
        category: '44'.repeat(32),
        nft: { capability: 'mutable', commitment },
      },
    };
    const input = {
      token: { category, nft: { capability: 'mutable' } },
      unlocker: { generateLockingBytecode: () => eventLock },
    };

    expect(reassertDeclaredMutableSlotLock(output, input)).toBe(false);
    expect(output.to).toEqual(otherLock);
  });
});

describe('clearMutableCollectionOutputsOutsideAuthoritativeRun', () => {
  it('burns superseded collection chunks outside the authoritative replacement run', () => {
    const mutable = (value: string): {
      to: Uint8Array;
      amount: bigint;
      token: { category: string; nft: { capability: string; commitment: string } };
    } => ({
      to: eventLock,
      amount: 1200n,
      token: { category, nft: { capability: 'mutable', commitment: value } },
    });
    const outputs = [mutable('new-0'), mutable('new-0'), mutable('new-1')];
    expect(clearMutableCollectionOutputsOutsideAuthoritativeRun(outputs, new Set([1, 2]))).toBe(1);
    expect(outputs[0]).toEqual({ to: Uint8Array.of(0x51), amount: 1200n });
    expect(outputs[1].token?.nft?.commitment).toBe('new-0');
    expect(outputs[2].token?.nft?.commitment).toBe('new-1');
  });

  it('uses collection identity rather than commitment value', () => {
    const mutable = (value: string, to = eventLock, categoryId = category): {
      to: Uint8Array;
      amount: bigint;
      token: { category: string; nft: { capability: string; commitment: string } };
    } => ({
      to,
      amount: 1200n,
      token: { category: categoryId, nft: { capability: 'mutable', commitment: value } },
    });
    const outputs = [
      mutable('old'),
      mutable('other-lock', otherLock),
      mutable('other-category', eventLock, '44'.repeat(32)),
      mutable('new-0'),
    ];

    expect(clearMutableCollectionOutputsOutsideAuthoritativeRun(outputs, new Set([3]))).toBe(1);
    expect(outputs[0]).toEqual({ to: Uint8Array.of(0x51), amount: 1200n });
    expect(outputs[1].token?.nft?.commitment).toBe('other-lock');
    expect(outputs[2].token?.nft?.commitment).toBe('other-category');
  });
});
