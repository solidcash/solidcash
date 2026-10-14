import { hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { buildEventNftCovenantScript, computeEventNameHash, scriptToBytecode } from '@solidcash/utils';
import { compileString } from '../../../solidc/src/compiler.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { StatefulContract, getEventNftAddress } from '../../src/stateful/index.js';
import { addressToLockScript, createUnlockingBytecode } from '../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createLogicalIdentityUnlocker, encodeLogicalIdentityCommitment } from '../../src/stateful/logical-identity.js';
import { aliceAddress } from '../fixture/vars.js';

const SOURCE = `contract Lifecycle {
  event Fired(bigint value);
  function fork(bigint n) split(n) { require(n == 1); }
  function consolidate(bigint n) merge(n) { require(n == 1); }
  function guarded() unsafe(1) { require(true); }
  function valueGuarded() unsafe(2) { require(true); }
}`;

describe('lifecycle and tiered unsafe event integrity', () => {
  for (const name of ['fork', 'consolidate', 'guarded', 'valueGuarded']) {
    it(`refuses an extra addressable event NFT on ${name}`, async () => {
      const provider = new MockNetworkProvider();
      const artifact = compileString(SOURCE, { messageBus: false, forceStateful: true, allowUnsafeOperations: true });
      const base = new Contract(artifact, [], { provider });
      const { categoryId, masterUtxo } = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, {}, { saltContract: true },
      );
      const contract = base.withCategory(hexToBin(categoryId));
      const args = ['fork', 'consolidate'].includes(name) ? [1n] : [];
      const fee = await createBareP2pkhFeeFunder(provider, 100_000n);
      const builder = new TransactionBuilder({ provider, allowImplicitNftBurn: name === 'consolidate' });
      builder.addInput(masterUtxo, contract.unlock[name](...args));
      if (name === 'consolidate') {
        builder.addInput({ ...masterUtxo, vout: masterUtxo.vout + 1 }, contract.unlock[name](...args));
      }
      builder.addInput(fee.utxo, fee.unlocker);
      const token = { category: categoryId, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } };
      builder.addOutput({ to: contract.tokenAddress, amount: masterUtxo.satoshis, token });
      if (name === 'fork') builder.addOutput({ to: contract.tokenAddress, amount: 1200n, token });
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const honest = builder.buildLibauthProgram();
      for (let inputIndex = 0; inputIndex < honest.transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, ...honest })), `input ${inputIndex}`).toBe(true);
      }
      builder.addOutput({
        to: getEventNftAddress(contract, categoryId, artifact.events![0].signature),
        amount: 1200n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment: '01' } },
      });
      const hostile = builder.buildLibauthProgram();
      expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, ...hostile })))
        .toBe('Program failed an OP_VERIFY operation.');
    }, 120_000);
  }

  it('refuses replaying a matured event beside an unrelated external call', async () => {
    const provider = new MockNetworkProvider();
    const callerArtifact = compileString(`interface ITarget { function ping(); }
      contract Caller(address target) {
        event Fired(bigint value);
        function record() { emit Fired(7); require(true); }
        function run() { ITarget(target).ping(); require(true); }
      }`, { messageBus: false, forceStateful: true });
    const targetArtifact = compileString('contract Target { function ping() { require(true); } }',
      { messageBus: false, forceStateful: true });
    const targetBase = new Contract(targetArtifact, [], { provider });
    const targetSetup = await setupStatefulUtxos(provider, targetBase, targetArtifact.stateLayout!, {},
      { saltContract: true });
    const target = StatefulContract.withCategory(
      targetBase.withCategory(hexToBin(targetSetup.categoryId)), targetSetup.categoryId,
    );
    const callerBase = new Contract(callerArtifact, [target.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {},
      { saltContract: true });
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    await caller.call.record().send();
    const signature = callerArtifact.events![0].signature;
    const eventAddress = getEventNftAddress(caller.inner, callerSetup.categoryId, signature);
    const [oldLog] = (await provider.getUtxos(eventAddress)).filter((utxo) =>
      utxo.token?.nft?.capability === 'none');
    expect(oldLog).toBeDefined();
    const before = await provider.getBlockHeight();
    await provider.mine(144);
    expect(await provider.getBlockHeight()).toBe(before + 144);
    const builder = await caller.call.run().withExternalCall(target, 'ping', []).build();
    const vm = createVirtualMachineBch2026ForProvider();
    const honest = builder.buildLibauthProgram();
    for (let inputIndex = 0; inputIndex < honest.transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, ...honest })), `honest input ${inputIndex}`).toBe(true);
    }
    // Preserve the old log at its own input/output coordinate, so the input census cannot decide this attack.
    // The output census must refuse publishing that log beside a call that emitted nothing.
    while (builder.inputs.length < builder.outputs.length) {
      const fee = await createBareP2pkhFeeFunder(provider, 10_000n);
      builder.addInput(fee.utxo, fee.unlocker);
    }
    while (builder.outputs.length < builder.inputs.length) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: 1_200n });
    }
    const anchorUnlocker = createLogicalIdentityUnlocker(aliceAddress, 7n);
    const anchor = {
      txid: 'ac'.repeat(32), vout: 0, satoshis: 1200n,
      token: { category: callerSetup.categoryId, amount: 0n,
        nft: { capability: 'none' as const, commitment: encodeLogicalIdentityCommitment({
          deployerLockingBytecode: addressToLockScript(aliceAddress), nonce: 7n,
          rootLockingBytecode: hexToBin(caller.inner.lockingBytecode),
        }) } },
    };
    const anchorInputIndex = builder.inputs.length;
    builder.addInput(anchor, anchorUnlocker);
    builder.addOutput({ to: anchorUnlocker.generateLockingBytecode(), amount: anchor.satoshis, token: anchor.token });
    const withAnchor = builder.buildLibauthProgram();
    for (let inputIndex = 0; inputIndex < withAnchor.transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, ...withAnchor })), `identity input ${inputIndex}`).toBe(true);
    }
    expect(anchorInputIndex).toBe(builder.outputs.length - 1);
    const redeem = scriptToBytecode(buildEventNftCovenantScript(hexToBin(callerSetup.categoryId),
      computeEventNameHash(signature)));
    const oldLogInputIndex = builder.inputs.length;
    builder.addInput(oldLog, {
      generateLockingBytecode: () => addressToLockScript(eventAddress),
      generateUnlockingBytecode: () => createUnlockingBytecode('p2sh32', redeem, []),
    }, { sequence: 144 });
    builder.addOutput({ to: eventAddress, amount: oldLog.satoshis, token: oldLog.token });
    const hostile = builder.buildLibauthProgram();
    expect(hostile.transaction.inputs[oldLogInputIndex].sequenceNumber).toBe(144);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: oldLogInputIndex, ...hostile }))).toBe(true);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, ...hostile })))
      .toBe('Program failed an OP_VERIFY operation.');
  }, 120_000);
});
