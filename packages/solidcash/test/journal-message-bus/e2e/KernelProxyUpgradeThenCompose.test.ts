import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, StatefulContract, getContractFactory, upgrades, messageBus, Signer,
  SignatureTemplate,
} from '../../../src/index.js';
import { ProxyContract } from '../../../src/stateful/upgrades.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

/** Param-mode proxy: implementation locking bytecode is a call argument (not baked). */
const PARAM_PROXY = `pragma solidcash >=0.8.0;
  contract PinnedProxy() {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s) external {
      require(checkSig(s, pk));
      impl.delegatecall(input);
      require(input.length > 0);
    }
  }`;

/**
 * Upgrade-through-proxy: param-mode proxy can forward V1 then V2. Default SolidCashProxy bakes the
 * implementation lock, so compose executor retarget without rematerializing that target stays fail-closed
 * (see characterizes test).
 */
describe('kernel proxy upgrade then composition', () => {
  it('settles param-mode proxy forward through V1 then V2 implementations', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x52), provider);
    for (let index = 0; index < 16; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    // Layout must match the param-mode proxy's grafted state (`bigint counter`).
    const v1Artifact = compileString(`pragma solidcash >=0.8.0;
      contract AccV1() {
        bigint counter;
        function bump() public { this.counter = this.counter + 1; }
      }`, KERNEL);
    const v2Artifact = compileString(`pragma solidcash >=0.8.0;
      contract AccV2() {
        bigint counter;
        function bump() public { this.counter = this.counter + 2; }
      }`, KERNEL);

    const proxy = await upgrades.deployProxy(
      getContractFactory(v1Artifact, signer),
      { counter: 0n },
      {
        proxy: compileString(PARAM_PROXY, { allowUnsafeOperations: true }),
      },
    );
    expect(proxy.implementation.inner.artifact.contractName).toBe('AccV1');

    await expect((proxy as any).bump().send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await proxy.proxy.getState()).counter).toBe(1n);

    const v2Delegate = v2Artifact.delegateArtifact!;
    expect(v2Delegate).toBeDefined();
    const v2 = await getContractFactory(v2Delegate, signer).deploy({ logicalNonce: false });
    // Param-mode `forward` takes the implementation locking bytecode as a call argument. Re-wrap the
    // same state-holding proxy with the V2 implementation handle.
    const retargeted = new ProxyContract(
      proxy.proxy,
      v2 as typeof proxy.implementation,
      { name: 'up', mode: 'param' },
      (signerArg: Signer) => [signerArg.publicKey, new SignatureTemplate(signerArg.privateKey)],
      signer,
    );
    await expect(retargeted.forward('bump', []).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await proxy.proxy.getState()).counter).toBe(3n);
  }, 300_000);

  it('characterizes baked SolidCashProxy compose executor retarget: forwarding target not materialized', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x51), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const v1Artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract AccV1() {
        int counter;
        function initialize() public { this.counter = 0; }
        function bump(address probe) public {
          this.counter = this.counter + 1;
          IProbe(probe).touch();
        }
      }`, KERNEL);
    const v2Artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract AccV2() {
        int counter;
        function initialize() public { this.counter = 0; }
        function bump(address probe) public {
          this.counter = this.counter + 2;
          IProbe(probe).touch();
        }
      }`, KERNEL);
    const v2Delegate = v2Artifact.delegateArtifact!;
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const deployed = await upgrades.deployProxy(getContractFactory(v1Artifact, signer), []);
    const v2Implementation = await getContractFactory(v2Artifact, signer).deploy({ logicalNonce: false });
    (v2Implementation as unknown as StatefulContract)._registerResolvedExternal('IProbe', probe);
    const callsite = v2Delegate.abi.find((entry) => entry.name === 'bump')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'bump',
        args: [probe.inner.lockingBytecode],
        executionArtifact: v2Delegate,
        executor: v2Implementation as unknown as StatefulContract,
      }, {
        contract: probe,
        functionName: 'touch',
        args: [],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(composition.build()).rejects.toThrow(
      /Compiler-authenticated delegate forwarding target is not materialized/,
    );
  }, 300_000);
});
