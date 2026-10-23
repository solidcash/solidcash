import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { getContractFactory, upgrades } from '../../src/stateful/index.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createMessageBusSemanticTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

describe('callee-only authenticated block oracle', () => {
  it.each([false, true])('provisions only the nested reader pinned oracle with caller clock=%s', async (rootReadsClock) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IClock { function stamp() external; }
      contract ClockWriter {
        uint256 public timestamp;
        function stamp() public { timestamp = block.timestamp; }
      }
      contract ClockCaller {
        address writer;
        address second;
        constructor(address target, address sibling) { writer = target; second = sibling; }
        function collect(bool allowed) public {
          require(allowed, "disabled");
          ${rootReadsClock ? 'require(block.timestamp > 0, "clock unavailable");' : ''}
          IClock(writer).stamp();
          IClock(second).stamp();
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true });
    const provider = createMessageBusSemanticTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6b), provider);
    for (let index = 0; index < 32; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (0xb00 + index).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const writer = await getContractFactory(artifacts.ClockWriter, signer).deploy();
    const sibling = await getContractFactory(artifacts.ClockWriter, signer).deploy();
    const caller = await getContractFactory(artifacts.ClockCaller, signer).deploy(
      writer.inner.lockingBytecode, sibling.inner.lockingBytecode,
    );
    caller._registerResolvedExternal('IClock', writer);
    caller._registerResolvedExternal('IClock', sibling);
    expect(artifacts.ClockCaller.abi.find((entry) => entry.name === 'collect')?.usesBlockOracle === true).toBe(rootReadsClock);
    expect(artifacts.ClockWriter.abi.find((entry) => entry.name === 'stamp')?.usesBlockOracle).toBe(true);
    await expect(caller.call.collect(false).send()).rejects.toThrow('disabled');
    const timestamp = 1_800_000_123n;
    provider.setBlockOracleFields({ number: 123n, timestamp, difficulty: 0n, size: 1n,
      totalFees: 0n, coinbase: new Uint8Array() });
    const builder = await caller.call.collect(true).build();
    const funding = (await signer.getUtxos()).find((utxo) => !builder.inputs.some(
      (input) => input.txid === utxo.txid && input.vout === utxo.vout,
    ))!;
    builder.addInput(funding, signer.unlockP2PKH());
    builder.addOutput({ to: signer.getAddress(), amount: funding.satoshis - 100_000n });
    expect(messageBusVmAccepts(builder)).toBe(true);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const oracleIndices = sourceOutputs.flatMap((output, index) => binToHex(output.lockingBytecode)
      === binToHex(provider.blockOracleLock) ? [index] : []);
    expect(oracleIndices).toHaveLength(1);
    const oracleIndex = oracleIndices[0];
    expect(transaction.outputs[oracleIndex]).toEqual(sourceOutputs[oracleIndex]);
    const writerIndex = builder.inputs.findIndex((input) => input.token?.category === writer.categoryId
      && input.token.nft?.capability === 'minting');
    const foreignOracle = sourceOutputs.map((output, index) => index === oracleIndex
      ? { ...output, lockingBytecode: Uint8Array.of(0x51) } : output);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ transaction, sourceOutputs: foreignOracle,
      inputIndex: writerIndex }))).not.toBe(true);
    await builder.send();
    expect((await writer.getState()).timestamp).toBe(timestamp);
    expect((await sibling.getState()).timestamp).toBe(timestamp);
  }, 120_000);
  it('provisions the pinned oracle for a clockless proxy calling a clock-writing proxy', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IClock { function stamp() external; }
      contract ClockWriter {
        uint256 public timestamp;
        function stamp() public { timestamp = block.timestamp; }
      }
      contract ClockCaller {
        address writer;
        uint256 public calls;
        constructor(address first) { writer = first; }
        function collect(bool allowed) public {
          require(allowed, "disabled");
          calls = calls + 1;
          IClock(writer).stamp();
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true });
    const provider = createMessageBusSemanticTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6c), provider);
    for (let index = 0; index < 48; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (0xc00 + index).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const writer = await upgrades.deployProxy(getContractFactory(artifacts.ClockWriter, signer),
      { timestamp: 0n }, { initializer: false });
    const caller = await upgrades.deployProxy(getContractFactory(artifacts.ClockCaller, signer), {
      writer: addressToLockScript(writer.address), calls: 0n,
    }, {
      initializer: false, implementationConstructorArgs: [addressToLockScript(writer.address)],
    });
    caller.implementation._registerResolvedExternal('IClock', writer);
    await expect(caller.forward('collect', [false]).send()).rejects.toThrow('disabled');
    const timestamp = 1_800_000_456n;
    provider.setBlockOracleFields({ number: 456n, timestamp, difficulty: 0n, size: 1n,
      totalFees: 0n, coinbase: new Uint8Array() });
    const builder = await caller.forward('collect', [true]).build();
    const funding = (await signer.getUtxos()).find((utxo) => !builder.inputs.some(
      (input) => input.txid === utxo.txid && input.vout === utxo.vout,
    ))!;
    builder.addInput(funding, signer.unlockP2PKH());
    builder.addOutput({ to: signer.getAddress(), amount: funding.satoshis - 100_000n });
    expect(messageBusVmAccepts(builder)).toBe(true);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const indices = sourceOutputs.flatMap((output, index) => binToHex(output.lockingBytecode)
      === binToHex(provider.blockOracleLock) ? [index] : []);
    expect(indices).toHaveLength(1);
    expect(transaction.outputs[indices[0]]).toEqual(sourceOutputs[indices[0]]);
    const readerIndex = builder.inputs.findIndex((input) => input.token?.category
      === writer.implementation.categoryId && input.token.nft?.capability === 'minting');
    expect(readerIndex).toBeGreaterThanOrEqual(0);
    const foreign = sourceOutputs.map((output, index) => index === indices[0]
      ? { ...output, lockingBytecode: Uint8Array.of(0x51) } : output);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ transaction, sourceOutputs: foreign,
      inputIndex: readerIndex }))).not.toBe(true);
    await builder.send();
    expect(await (writer as unknown as { timestamp(): Promise<bigint> }).timestamp()).toBe(timestamp);
  }, 120_000);

});
