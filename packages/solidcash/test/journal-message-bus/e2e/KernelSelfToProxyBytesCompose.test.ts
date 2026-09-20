import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, StatefulContract, getContractFactory, upgrades, messageBus, Signer,
} from '../../../src/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

/**
 * self→proxy × chunks: non-proxy Caller.poke → deployProxy Acc.append under compose with
 * executionArtifact/executor on the proxy callee. Empty→first-write (and seeded append) fail closed
 * at MessageBusVerifier / chunk path after a genuine compose attempt — honest fence. Proxy-self
 * chunk writes under compose remain covered by KernelProxyBytesStateCompose; foreign empty→append
 * by KernelForeignBytesRmwCompose.
 */
describe('kernel self→proxy bytes chunk compose', () => {
  it('refuses Caller.poke→deployProxy Acc empty→append under compose (honest fence)', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x73), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        bytes payload;
        function initialize() public { this.payload = hex""; }
        function append(bytes suffix) public {
          this.payload = bytes.concat(this.payload, suffix);
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(delegate.abi.find((entry) => entry.name === 'append')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['payload']));

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IAcc { function append(bytes suffix) external; }
      contract Caller() {
        function poke(address acc, bytes suffix) public {
          IAcc(acc).append(suffix);
          require(true);
        }
      }`, KERNEL);
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'poke'))
      .toMatchObject({ eligible: true });
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IAcc', deployed.proxy);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'append');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const suffix = hexToBin('bb');
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [deployed.proxy.inner.lockingBytecode, suffix],
      }, {
        contract: deployed.proxy,
        functionName: 'append',
        args: [suffix],
        callsiteId: callsite!.callsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    // Measured: MessageBusVerifier / chunk path OP_VERIFY (~input 67) after genuine compose attempt.
    await expect(composition.send()).rejects.toThrow(/OP_VERIFY|preflight failed at input/);
  }, 300_000);
});
