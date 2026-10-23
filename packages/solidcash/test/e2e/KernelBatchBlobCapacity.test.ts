import { createVirtualMachineBch2026, hexToBin, sha256 } from '@bitauth/libauth';
import { compileString, compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { encodeMessageBatch } from '../../src/message-bus/message-bus.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel BCH-2026 batch envelope', () => {
  it('executes a batch above 520 bytes with the unmodified BCH-2026 VM', async () => {
    const artifact = compileString(`contract Digest() {
      bytes32 public digest;
      function record(bytes payload) public { this.digest = sha256(payload); require(true); }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true, suppressWarnings: true });
    const payload = new Uint8Array(600).fill(0x37);
    const batch = encodeMessageBatch(artifact, [{ function: 'record', args: [payload] }]);
    expect(batch.blob.length).toBeGreaterThan(520);
    expect(artifact.messageBus!.maximumBlobBytes).toBe(10_000);
    // The stack-item limit is independent of the complete input's script-size limit.
    // Exercise its exact encoding boundary without claiming a 10KB push plus redeem script is relayable.
    expect(encodeMessageBatch(artifact, [{
      function: 'record', args: [new Uint8Array(9_978)],
    }]).blob.length).toBe(10_000);
    expect(() => encodeMessageBatch(artifact, [{
      function: 'record', args: [new Uint8Array(9_979)],
    }])).toThrow(/blob is 10001 bytes; maximum is 10000/);

    const provider = new MockNetworkProvider();
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
    const digest = StatefulContract.withCategory(inner, setup.categoryId);
    const call = digest.batch([{ function: 'record', args: [payload] }]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026(false);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, transaction, sourceOutputs }))).toBe(true);
    }
    await call.send();
    expect((await digest.getState()).digest).toEqual(sha256.hash(payload));
  });

  it('composes two participants with larger canonical argument envelopes', async () => {
    const artifacts = compileStringMulti(`
      interface IDigest { function record(bytes payload) external; }
      contract Digest {
        bytes32 public digest;
        function record(bytes payload) public { this.digest = sha256(payload); require(true); }
      }
      contract Relay(address target) {
        int public count;
        function forward(bytes payload) public {
          IDigest(target).record(payload); this.count = this.count + 1; require(true);
        }
      }`, { forceStateful: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const digestBase = new Contract(artifacts.Digest, [], { provider });
    const digestSetup = await setupStatefulUtxos(
      provider, digestBase, artifacts.Digest.stateLayout!, {}, { saltContract: true },
    );
    const digest = StatefulContract.withCategory(
      digestBase.withCategory(hexToBin(digestSetup.categoryId)), digestSetup.categoryId,
    );
    const relayBase = new Contract(artifacts.Relay, [hexToBin(digest.inner.lockingBytecode)], { provider });
    const relaySetup = await setupStatefulUtxos(
      provider, relayBase, artifacts.Relay.stateLayout!, {}, { saltContract: true },
    );
    const relay = StatefulContract.withCategory(
      relayBase.withCategory(hexToBin(relaySetup.categoryId)), relaySetup.categoryId,
    );
    relay._registerResolvedExternal('IDigest', digest);
    const payload = new Uint8Array(600).fill(0x63);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    await messageBus.compose({
      calls: [relay.call.forward(payload), digest.call.record(payload)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).send();
    expect((await relay.getState()).count).toBe(1n);
    expect((await digest.getState()).digest).toEqual(sha256.hash(payload));
  });
});
