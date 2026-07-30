import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X115 / X116 / X117 - the OpenZeppelin storage-slot-pointer idiom, on the message bus and on the direct path.
 *
 * X115. Route synthesis runs BEFORE the main lowering pipeline whenever any entry point returns a value, has an
 * effect, or already touches a collection (compiler.ts synthesizeBatchBeforeLowering). A storage-slot pointer
 * access is not a Mapping* node until LowerStorageSlotPointers runs, so `analyseFunctionFootprint` reported NO
 * `collection:` resource for a handler reading or writing `__evm_storage`, the route's whole collection-
 * eligibility branch was skipped, and every such handler was admitted with no key witness and no reserved entry
 * slot. The published route then could not settle a single row - not a write row and not a READ-ONLY row - and
 * failed on-chain at input 0 on the entry output-commitment OP_EQUALVERIFY. A published-but-dead route is a
 * hazard in its own right: the SDK is an untrusted witness constructor, so a composer must never be handed a
 * route shape the covenant will always reject.
 *
 * X116. The same cause published `writesState: false` and `operations: ['read']` for a slot an admitted handler
 * WRITES, because the route's own entry accesses are collected syntactically from its own body.
 *
 * X117. Independent of the bus: the `__evm_storage` word round-trip was not exact for any field type whose
 * value can have its high bit set. The write stores the field's bytes as a non-negative script number; the read
 * used `bytesN(word)` (= `NUM2BIN(N)`, which aborts when the minimal encoding needs N+1 bytes) and, for an
 * address, the deliberate no-op `address(uint160(word))`, leaving a raw script number where a locking bytecode
 * was expected.
 */

const BUS = {
  solidityImportCompat: true,
  forceStateful: true,
  experimentalHiddenBatch: true,
};
const DIRECT = { solidityImportCompat: true, forceStateful: true };

/** A constant slot key (the ERC-7201/OZ spelling) versus the same access keyed by a handler PARAMETER. */
const slotSource = (keyed: 'constant' | 'parameter'): string => `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library StorageSlot {
    struct Uint256Slot { uint256 value; }
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage pointer) {
        assembly { pointer.slot := slot }
    }
}

contract TestSlot {
    bytes32 public constant TEST_SLOT = keccak256("TEST_SLOT");

    function write(${keyed === 'parameter' ? 'bytes32 at, ' : ''}uint256 _value) public {
        StorageSlot.Uint256Slot storage data = StorageSlot.getUint256Slot(${
  keyed === 'parameter' ? 'at' : 'TEST_SLOT'});
        data.value = _value;
    }

    function get(${keyed === 'parameter' ? 'bytes32 at' : ''}) external view returns (uint256) {
        StorageSlot.Uint256Slot storage data = StorageSlot.getUint256Slot(${
  keyed === 'parameter' ? 'at' : 'TEST_SLOT'});
        return data.value;
    }
}`;

/** A field of `type` behind a constant slot key, with a write and a read-back assertion on the direct path. */
const typedSlotSource = (solType: string, struct: string, getter: string): string =>
  `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library StorageSlot {
    struct ${struct} { ${solType} value; }
    function ${getter}(bytes32 slot) internal pure returns (${struct} storage pointer) {
        assembly { pointer.slot := slot }
    }
}

contract TestSlot {
    bytes32 public constant TEST_SLOT = keccak256("TEST_SLOT");

    function write(${solType} _value) public {
        StorageSlot.${struct} storage data = StorageSlot.${getter}(TEST_SLOT);
        data.value = _value;
    }

    function check(${solType} expected) public {
        StorageSlot.${struct} storage data = StorageSlot.${getter}(TEST_SLOT);
        require(data.value == expected);
    }
}`;

/** Compile quietly: these subjects emit lossy-cast and route-absence warnings by design. */
function compileQuiet(text: string, options: Record<string, unknown>): any {
  const original = {
    log: console.log, warn: console.warn, info: console.info, error: console.error,
  };
  console.log = console.warn = console.info = console.error = ((): void => {}) as never;
  try {
    return compileString(text, options as never);
  } finally {
    Object.assign(console, original);
  }
}

async function deploy(artifact: any): Promise<StatefulContract> {
  const provider = createTestProvider();
  const inner = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, inner, artifact.stateLayout!, {}, { saltContract: true },
  );
  return StatefulContract.withCategory(inner, categoryId);
}

/** The input index whose script rejected, so a hostile case names one covenant rather than "the transaction". */
async function rejectingInput(send: () => Promise<unknown>): Promise<{ index: number; message: string }> {
  try {
    await send();
  } catch (error) {
    const message = (error as Error).message;
    const match = /input(?: index)? (\d+)/.exec(message);
    if (!match) throw new Error(`rejection names no input index: ${message}`);
    return { index: Number(match[1]), message };
  }
  throw new Error('expected the transaction to be rejected, but it settled');
}

const routeAbsenceReasons = (artifact: any): string[] => {
  const diagnostic = (artifact.diagnostics ?? [])
    .find((entry: any) => entry.code === 'hidden-batch-route-not-synthesized');
  if (!diagnostic) return [];
  const stated = /Rejected entry points - ([^.]*)\./.exec(diagnostic.message);
  return stated ? stated[1].split('; ') : [];
};

describe('X115 storage-slot-pointer routes', () => {
  it('refuses a constant-keyed __evm_storage handler BY NAME instead of publishing a dead route', () => {
    const artifact = compileQuiet(slotSource('constant'), BUS);

    // The hazard was a PUBLISHED route: assert its absence, then assert the refusal is attributed per handler.
    expect(artifact.hiddenBatch).toBeUndefined();
    const reasons = routeAbsenceReasons(artifact);
    expect(reasons).toContain(
      "'write': collection-route-requires-one-parameter-keyed-entry-per-collection",
    );
    expect(reasons).toContain(
      "'get': collection-route-requires-one-parameter-keyed-entry-per-collection",
    );

    // The direct per-function route is untouched: both entry points still declare the entry they touch.
    const write = artifact.abi.find((fn: any) => fn.name === 'write');
    const get = artifact.abi.find((fn: any) => fn.name === 'get');
    expect(write.entryAccesses.map((e: any) => `${e.collection}:${e.operations.join('+')}`))
      .toEqual(['__evm_storage:write']);
    expect(get.entryAccesses.map((e: any) => `${e.collection}:${e.operations.join('+')}`))
      .toEqual(['__evm_storage:read']);
  });

  it('refuses a PARAMETER-keyed storage-slot pointer too, rather than widening the key witness', () => {
    // The recorded boundary, not an aspiration: the slot key reaches the route as `uint256(at)` - a cast, not
    // the bare parameter the key-witness scan matches - so it is refused by the same name. Widening the scan to
    // see through the cast would make a new route shape buildable without evidence that it settles, so the
    // refusal is pinned instead. Changing this test means proving the admitted route settles on the VM.
    const artifact = compileQuiet(slotSource('parameter'), BUS);

    expect(artifact.hiddenBatch).toBeUndefined();
    const reasons = routeAbsenceReasons(artifact);
    expect(reasons).toContain(
      "'write': collection-route-requires-one-parameter-keyed-entry-per-collection",
    );
    expect(reasons).toContain(
      "'get': collection-route-requires-one-parameter-keyed-entry-per-collection",
    );
  });

  it('GUARD: a parameter-keyed mapping route is still published, and settles what it publishes', async () => {
    // The guard negative control for "a published route must be able to settle a row". Same options, same
    // handler bodies (one write, one read-back assertion); the only difference is that the entry key is a
    // parameter-keyed mapping rather than a constant-keyed storage slot. If this route also failed to settle,
    // the refusal above would be hiding a general route defect rather than an entry-key one.
    const artifact = compileQuiet(`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract Ctl {
    mapping(uint256 => uint256) internal store;

    function put(uint256 k, uint256 v) public {
        store[k] = v;
    }

    function checkAt(uint256 k, uint256 expected) public {
        require(store[k] == expected);
    }
}`, BUS);

    expect(artifact.hiddenBatch).toBeDefined();
    expect(artifact.hiddenBatch.route.inputs.map((input: any) => input.name))
      .toContain('__scb_key_store_0');
    // X116 on a route that IS published: the slot an admitted handler writes is published as written.
    expect(artifact.hiddenBatch.route.writesState).toBe(true);
    expect(artifact.hiddenBatch.route.entryAccesses
      .map((e: any) => `${e.collection}:${e.operations.slice().sort().join('+')}`))
      .toEqual(['store:read+write']);

    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { store: { 1n: 0n } }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    await contract.batch([{ function: 'put', args: [1n, 9n] }]).send();
    await contract.batch([{ function: 'checkAt', args: [1n, 9n] }]).send();
    // The row's argument really reached the entry: the pre-state value no longer verifies, and the rejection
    // comes from the contract's own covenant at input 0.
    const rejection = await rejectingInput(() =>
      contract.batch([{ function: 'checkAt', args: [1n, 0n] }]).send());
    expect(rejection.index).toBe(0);
  });

  it('X116: no published route may claim a collection is read-only while an admitted handler writes it', () => {
    for (const keyed of ['constant', 'parameter'] as const) {
      const artifact = compileQuiet(slotSource(keyed), BUS);
      const route = artifact.hiddenBatch?.route;
      if (!route) continue;
      const written = new Set<string>();
      for (const handler of artifact.hiddenBatch.handlers.filter((h: any) => h.eligible)) {
        const abi = artifact.abi.find((fn: any) => fn.name === handler.name);
        for (const access of abi?.entryAccesses ?? []) {
          if (access.operations.some((op: string) => op !== 'read')) written.add(access.collection);
        }
      }
      for (const collection of written) {
        const published = (route.entryAccesses ?? [])
          .filter((access: any) => access.collection === collection);
        expect(published.length, `${keyed}: route omits written collection ${collection}`)
          .toBeGreaterThan(0);
        expect(
          published.some((access: any) => access.operations.some((op: string) => op !== 'read')),
          `${keyed}: route publishes ${collection} as read-only but an admitted handler writes it`,
        ).toBe(true);
      }
      if (written.size > 0) expect(route.writesState).toBe(true);
    }
  });
});

describe('X117 __evm_storage word round-trip on the direct path', () => {
  const cases: Array<{ label: string; solType: string; struct: string; getter: string;
    value: unknown; other: unknown; }> = [
    {
      label: 'uint256 with the high bit set',
      solType: 'uint256',
      struct: 'Uint256Slot',
      getter: 'getUint256Slot',
      value: (1n << 255n) + 5n,
      other: 5n,
    },
    {
      label: 'bytes32 with the high bit set',
      solType: 'bytes32',
      struct: 'Bytes32Slot',
      getter: 'getBytes32Slot',
      value: new Uint8Array(32).fill(0xab),
      other: new Uint8Array(32).fill(0x01),
    },
    {
      label: 'address',
      solType: 'address',
      struct: 'AddressSlot',
      getter: 'getAddressSlot',
      value: 'bchtest:qz6q5gqnxdldkr07xpls5474mmzmlesd6qnux4skuc',
      other: 'bchtest:qqsr7nqwe6rq5crj63gy5gdqchpnwmguusmr7tfmsj',
    },
  ];

  for (const testCase of cases) {
    it(`writes and reads back a ${testCase.label}`, async () => {
      const artifact = compileQuiet(
        typedSlotSource(testCase.solType, testCase.struct, testCase.getter), DIRECT,
      );
      const contract = await deploy(artifact);

      await contract.getFunction('write')(testCase.value).send();
      // POSITIVE CONTROL: the value the write stored is the value the read observes.
      await contract.getFunction('check')(testCase.value).send();

      // GUARD NEGATIVE CONTROL: same transaction shape, one field changed (the expected value). It must be
      // rejected, and by the contract's own covenant at input 0 - not by an SDK-side arity or encoding check.
      const rejection = await rejectingInput(() => contract.getFunction('check')(testCase.other).send());
      expect(rejection.index).toBe(0);
    });
  }
});
