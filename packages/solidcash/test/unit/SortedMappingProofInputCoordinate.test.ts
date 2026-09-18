import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, getEntryNftAddress } from '../../src/index.js';
import type { ContractUnlocker } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A sorted-mapping (vmap) write publishes `__internal__vmapBatchProof_<slot>`: the distance from the executing
// master input to the co-spent entry NFT that brackets the written key. The covenant reads the proof input at
// `masterInputIndex + offset` and authenticates its locking bytecode against the collection's entry address, so the
// witness is only correct while it names the ASSEMBLED distance. Deriving it from the collection's block slot
// instead only works while the input frame is dense: a callee participant block placed between the master's data
// NFTs and the entry NFT moves the entry further along, and the covenant then authenticates a callee's bytecode and
// aborts on `OP_EQUALVERIFY`. The external call below is what makes the frame non-dense, which is why this case
// needs a contracting pair rather than a lone mapping writer.

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
    const hostInner = new Contract(hostArtifact, [addressToLockScript(calleeInner.address)], { provider });

    expect(hostArtifact.stateLayout?.collections?.find((entry) => entry.name === 'balances')?.sorted)
      .toBe(true);

    const calleeSetup = await setupStatefulUtxos(
      provider, calleeInner, calleeArtifact.stateLayout!, { count: 0n },
    );
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

    // The covenant reads the proof input at `masterInputIndex + offset`, so the witness must publish the assembled
    // distance - a callee participant block sits between the master's data NFTs and the entry NFT here.
    expect(unlocker.params[witnessIndex]).toBe(BigInt(proofInputIndex - hostInputIndex));
  });

  // Reproduces the next blocker in ~0.3 s instead of ~65 s of marketplace ladder. The converged transaction is
  // rejected at input 0 (the host master, running the route program = contract bytecode behind a 5-instruction
  // prologue): contract bytecode instruction 181 `OP_EQUALVERIFY` fails, in the window
  // `OP_INPUTINDEX; OP_2; OP_LSHIFTNUM; OP_DUP; OP_OUTPUTBYTECODE; OP_3; OP_PICK; OP_EQUALVERIFY;
  // OP_DUP; OP_OUTPUTTOKENCATEGORY`. The compared pair looks like a 35-byte locking bytecode against 32 zero
  // bytes, i.e. an unresolved witness. Enable this case once the host's block-slot output identity check passes.
  it.skip('verifies the converged transaction that spends the bracketing entry NFT', async () => {
    const provider = createTestProvider();
    const calleeArtifact = compileString(CALLEE_SOURCE, {});
    const hostArtifact = compileString(HOST_SOURCE, {});
    const calleeInner = new Contract(calleeArtifact, [], { provider });
    const hostInner = new Contract(hostArtifact, [addressToLockScript(calleeInner.address)], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeInner, calleeArtifact.stateLayout!, { count: 0n },
    );
    const hostSetup = await setupStatefulUtxos(
      provider, hostInner, hostArtifact.stateLayout!, { result: 0n },
    );
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const host = StatefulContract.withCategory(hostInner, hostSetup.categoryId, {
      externals: { ICallee: callee },
    });

    await expect(host.record(KEY, 7n).send()).resolves.toHaveProperty('txid');
    await expect(host.getState()).resolves.toMatchObject({ result: 7n });
  });
});
