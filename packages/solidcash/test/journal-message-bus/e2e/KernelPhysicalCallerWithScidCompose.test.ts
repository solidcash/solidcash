import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import {
  StatefulContract,
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
import { addressToLockScript } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('kernel nested caller identity with a co-spent SCID', () => {
  // Pending the deferred model-B logical-identity migration (user decision 2026-10-14; deferrals.md, "Logical caller
  // identity for native compiles"): native entries get no SCID anchor witness and a proxy root's identity is physical.
  it.skip('uses the authenticated proxy identity for address(this) and a nested caller beside its SCID anchor', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x61), provider);
    for (let index = 0; index < 20; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const calleeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract CallerCheck() {
        int hits;
        function touch(address expected) public {
          require(msg.sender == expected);
          this.hits = this.hits + 1;
        }
      }`, KERNEL);
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { hits: 0n }, { saltContract: true },
    );
    const callee = StatefulContract.withCategory(
      calleeBase.withCategory(hexToBin(calleeSetup.categoryId)), calleeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ICallerCheck { function touch(address expected) external; }
      contract PhysicalCaller() {
        int calls;
        function poke(address callee) public {
          ICallerCheck(callee).touch(address(this));
          this.calls = this.calls + 1;
        }
      }`, KERNEL);
    const deployed = await upgrades.deployProxy(
      getContractFactory(callerArtifact, signer),
      { calls: 0n },
      { initializer: false },
    );
    deployed.implementation._registerResolvedExternal('ICallerCheck', callee);

    const callsite = callerArtifact.delegateArtifact?.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.[0];
    expect(callsite?.callerIdentity).toEqual({
      version: 1, role: 'active', auth: 'input-bytecode', authOffset: 0xffff,
    });

    const publicProxyLock = addressToLockScript(await deployed.getAddress());
    expect(publicProxyLock).not.toEqual(hexToBin(deployed.proxy.inner.lockingBytecode));
    const call = (deployed as any).poke(callee.inner.lockingBytecode)
      .withExternalCall(callee, 'touch', [publicProxyLock]);
    const builder = await call.build();
    const sameCategoryImmutableAnchors = builder.inputs.filter((input) => (
      input.token?.nft?.capability === 'none'
      && input.token.category === deployed.proxy.categoryId
    ));
    expect(sameCategoryImmutableAnchors).toHaveLength(1);

    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    expect((await callee.getState()).hits).toBe(1n);
    expect((await deployed.proxy.getState()).calls).toBe(1n);
  }, 180_000);
});
