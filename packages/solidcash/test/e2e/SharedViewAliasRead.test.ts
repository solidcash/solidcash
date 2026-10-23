import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

// Two callsites of one function reach the same routed callee, so the second call is a LOGICAL alias sharing the
// first call's physical participant. Each callsite must still read its OWN result: the alias may not decode the
// owner's value or the builder's neutral placeholder.
const GRAPH_SOURCE = `pragma solidity ^0.8.0;
  interface IProbeStore {
    function flag() external view returns (bool);
    function paused() external view returns (bool);
  }
  contract ProbeStore {
    uint256 touches;
    function touch() public {
      touches = touches + 1;
      require(true);
    }
    function flag() public view returns (bool) {
      return true;
    }
    function paused() public view returns (bool) {
      return touches == 0;
    }
  }
  contract ProbeHost(address store) {
    uint256 reads;
    function readBoth() public view returns (bool, bool) {
      bool first = IProbeStore(store).flag();
      bool second = IProbeStore(store).paused();
      return (first, second);
    }
    function noteBoth() public {
      bool first = IProbeStore(store).flag();
      bool second = IProbeStore(store).paused();
      require(first);
      require(!second);
      reads = reads + 1;
    }
  }`;

const GRAPH_OPTIONS = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
  messageBusGraphContext: true, evmCompat: true, suppressWarnings: true,
  optimizeForCompilationSpeed: true,
} as const;

describe('two view callsites aliased onto one routed participant', () => {
  async function deploy(seed: number): Promise<{ host: StatefulContract; store: StatefulContract }> {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(seed), provider);
    for (let index = 0; index < 8; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const storeInner = new Contract(artifacts.ProbeStore, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeInner, artifacts.ProbeStore.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(storeInner, storeSetup.categoryId).connect(signer);
    const hostInner = new Contract(artifacts.ProbeHost, [store.inner.lockingBytecode], { provider });
    const hostSetup = await setupStatefulUtxos(
      provider, hostInner, artifacts.ProbeHost.stateLayout!, {}, { saltContract: true },
    );
    const host = StatefulContract.withCategory(hostInner, hostSetup.categoryId).connect(signer);
    host._registerResolvedExternal('IProbeStore', store);
    return { host, store };
  }

  it('reads each callsite\'s own result', async () => {
    const { host, store } = await deploy(0x71);
    expect([...await host.call.readBoth() as unknown as boolean[]]).toEqual([true, true]);

    // After one touch the alias's own value changes while the owner's stays: a shared or placeholder channel
    // would answer the owner's `true` (or fail to decode) for both.
    await store.call.touch().send();
    expect([...await host.call.readBoth() as unknown as boolean[]]).toEqual([true, false]);

    // A handle without a connected signer reads the same composition from a throwaway caller.
    const reader = StatefulContract.withCategory(host.inner, host.categoryId);
    reader._registerResolvedExternal('IProbeStore', store);
    expect([...await reader.call.readBoth() as unknown as boolean[]]).toEqual([true, false]);
  }, 180_000);

  it('authenticates both results in a sent transaction', async () => {
    const { host, store } = await deploy(0x72);
    await store.call.touch().send();
    await expect(host.call.noteBoth().send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await host.getFullState()).state.reads).toBe(1n);
  }, 180_000);
});
