import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import {
  StatefulContract,
  getEntryNftAddress,
} from '../../src/stateful/index.js';
import type { ContractUnlocker } from '../../src/interfaces.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A sorted-mapping (vmap) write publishes `__internal__vmapBatchProof_<slot>`: the distance from the executing
// master input to the co-spent entry NFT that brackets the written key. The covenant reads the proof input at
// `masterInputIndex + offset` and authenticates its locking bytecode against the collection's entry address, so the
// witness must name the ASSEMBLED distance. Plain `.send()` with an external call used to place the callee between
// the master's data NFTs and the entry NFT (legacy order); dense placement now keeps the caller's own block contiguous
// and defers the callee, matching `masterInputIndex + blockLayout slot offset`.

const CALLEE_SOURCE = `contract Callee() {
  bigint count;

  function bump() public {
    this.count = this.count + 1;
  }
}`;

const HOST_SOURCE = `interface ICallee {
  public bigint count;
  function bump() public;
}

contract Host(bytes calleeAddr) {
  bigint result;
  mapping(bytes20 => bigint) balances;

  function record(bytes20 user, bigint amount) {
    ICallee(calleeAddr).bump();
    this.balances[user] = amount;
    this.result = amount;
  }
}`;

const KEY = hexToBin('11'.repeat(20));

describe('sorted mapping proof-input coordinate', () => {
  it('co-spends the bracketing entry NFT at the distance the covenant adds to the master input', async () => {
    const provider = createTestProvider();
    const calleeArtifact = compileString(CALLEE_SOURCE, {});
    const hostArtifact = compileString(HOST_SOURCE, {});
    const calleeInner = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeInner, calleeArtifact.stateLayout!, { count: 0n },
    );
    // Category pinning changes the redeem script. The constructor target has to be that pinned locking
    // bytecode; the unpinned address is a different script and cannot select this callee.
    const pinnedCallee = calleeInner.withCategory(hexToBin(calleeSetup.categoryId));
    const hostInner = new Contract(hostArtifact, [hexToBin(pinnedCallee.lockingBytecode)], { provider });

    expect(hostArtifact.stateLayout?.collections?.find((entry) => entry.name === 'balances')?.sorted)
      .toBe(true);

    const hostSetup = await setupStatefulUtxos(
      provider, hostInner, hostArtifact.stateLayout!, { result: 0n },
    );

    // The list keeps the HEAD sentinel created with the master UTXOs; the write below splices a new key against it,
    // so the proof input is that sentinel's entry NFT.
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const host = StatefulContract.withCategory(hostInner, hostSetup.categoryId, {
      externals: { ICallee: callee },
    });
    const recordFunction = hostArtifact.abi.find((candidate) => candidate.name === 'record')!;
    // The HEAD sentinel entry NFT is the bracketing predecessor this insert splices against, so its UTXO is the
    // proof input the covenant authenticates. Identify it by outpoint, the one immutable coordinate.
    const entryAddress = getEntryNftAddress(
      hostInner.withCategory(hexToBin(hostSetup.categoryId)), hostSetup.categoryId, 'balances',
    );
    const [sentinelEntry] = await provider.getUtxos(entryAddress);
    expect(sentinelEntry).toBeDefined();

    const statefulBuilder = await (host as unknown as {
      _createBuilder: (
        name: string, args: unknown[], overrides: Record<string, unknown>,
      ) => Promise<ReturnType<typeof StatefulContract.prototype._createBuilder> extends Promise<infer T> ? T : never>;
    })._createBuilder('record', [KEY, 7n], {
      abiFunction: recordFunction,
      calls: [{ type: 'stateful', contract: callee, functionName: 'bump', args: [] }],
    });
    const built = statefulBuilder.build();

    const hostInputIndex = built.inputs.findIndex(
      (input) => input.txid === hostSetup.masterUtxo.txid && input.vout === hostSetup.masterUtxo.vout,
    );
    expect(hostInputIndex).toBeGreaterThanOrEqual(0);
    const unlocker = built.inputs[hostInputIndex]!.unlocker as ContractUnlocker;
    const witnessIndex = unlocker.abiFunction.inputs.findIndex(
      (input) => input.name === '__internal__vmapBatchProof_0',
    );
    expect(witnessIndex).toBeGreaterThanOrEqual(0);

    const proofInputIndex = built.inputs.findIndex((input) => input.txid === sentinelEntry!.txid
      && input.vout === sentinelEntry!.vout);
    expect(proofInputIndex).toBeGreaterThanOrEqual(0);

    // Dense placement keeps the entry immediately after the caller's own block; the witness is that distance.
    expect(unlocker.params[witnessIndex]).toBe(BigInt(proofInputIndex - hostInputIndex));
    const entrySlotOffset = recordFunction.blockLayout?.slots.find((slot) => slot.kind === 'entry')?.offset;
    expect(entrySlotOffset).toBeDefined();
    expect(proofInputIndex - hostInputIndex).toBe(entrySlotOffset);
    const calleeMasterIndex = built.inputs.findIndex(
      (input) => input.txid === calleeSetup.masterUtxo.txid && input.vout === calleeSetup.masterUtxo.vout,
    );
    expect(calleeMasterIndex).toBeGreaterThan(proofInputIndex);
  });

  // UPDATE of an already-present key + external call under the kernel compile profile used by the e2e settle.
  // Plain `.send()` must keep the entry immediately after the caller's block (see KernelDirectSendExternalEntryOrder).
  it('verifies plain send for an existing-key mapping update with an external call', async () => {
    const provider = createTestProvider();
    const kernel = {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      suppressWarnings: true,
    } as const;
    const calleeArtifact = compileString(`pragma solidcash >=0.8.0;
contract Callee() {
  int count;
  function bump() public { this.count = this.count + 1; require(true); }
}`, { ...kernel, evmCompat: false, messageBusGraphContext: true });
    const hostArtifact = compileString(`pragma solidcash >=0.8.0;
interface ICallee { function bump() external; }
contract Host() {
  int result;
  mapping(bytes20 => int) balances;
  function seed(bytes20 user, int amount) public {
    this.balances[user] = amount;
    this.result = amount;
    require(true);
  }
  function record(address callee, bytes20 user, int amount) public {
    ICallee(callee).bump();
    this.balances[user] = amount;
    this.result = amount;
    require(true);
  }
}`, { ...kernel, evmCompat: false });
    const calleeInner = new Contract(calleeArtifact, [], { provider });
    const hostInner = new Contract(hostArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeInner, calleeArtifact.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const hostSetup = await setupStatefulUtxos(
      provider, hostInner, hostArtifact.stateLayout!, { result: 0n }, { saltContract: true },
    );
    const callee = StatefulContract.withCategory(
      calleeInner.withCategory(hexToBin(calleeSetup.categoryId)), calleeSetup.categoryId,
    );
    const host = StatefulContract.withCategory(
      hostInner.withCategory(hexToBin(hostSetup.categoryId)), hostSetup.categoryId,
    );
    host._registerResolvedExternal('ICallee', callee);

    await expect(host.call.seed(KEY, 3n).send()).resolves.toHaveProperty('txid');
    await expect(host.call.record(callee.inner.lockingBytecode, KEY, 7n).send())
      .resolves.toHaveProperty('txid');
    await expect(host.getState()).resolves.toMatchObject({ result: 7n });
  });
});
