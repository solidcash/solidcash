import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import { buildPushdataCommitment, childStateLayoutDigest, encodeIntegerValue } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../src/compiler.js';
import { Contract } from '../../solidcash/src/index.js';
import MockNetworkProvider from '../../solidcash/src/network/MockNetworkProvider.js';
import {
  StatefulTransactionBuilder, createReadOnlyDataNftUnlocker, getContractFactory, getDataNftLockingBytecode,
} from '../../solidcash/src/stateful/index.js';
import { setupStatefulUtxos, getTxOutputs } from '../../solidcash/test/test-util.js';
import { deployMaster } from '../../solidcash/src/framed/deploy/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../solidcash/src/network/createVirtualMachine.js';
import {
  deployFramedMaster, masterSpendProgram, spent, type DeployedMaster,
} from './framed/master/record-spend.js';
import { REAL_VALIDATOR_PROGRAM } from './framed/master/validator-input.js';

const SOURCE = `pragma solidcash ^0.14.0;
  contract Box {
    uint8 public stored;
    function read(uint8 expected) { require(this.stored == expected); }
    function set(uint8 next) { this.stored = next; require(true); }
  }`;

function master(tagged: boolean): DeployedMaster {
  const plain = deployFramedMaster(SOURCE, 'singleton tag encoding');
  if (!tagged) return plain;
  const artifact = compileString(SOURCE, { composition: 'framed', tagSingletonDataNfts: true });
  const deployed = deployMaster(artifact, plain.category, REAL_VALIDATOR_PROGRAM);
  return {
    ...plain, artifact, script: deployed.script, address: deployed.address,
    lock: encodeLockingBytecodeP2sh32(hash256(deployed.script)),
    record: (values) => hexToBin(buildPushdataCommitment(artifact.stateLayout!, values, 0)),
  };
}

function accepts(
  deployed: DeployedMaster, entry: string, argument: bigint, before: Uint8Array, after = before,
): true | string {
  const program = masterSpendProgram(deployed, {
    entry, args: [encodeIntegerValue(argument)], records: [spent(deployed.recordLock, 2, before, after)],
  });
  const vm = createVirtualMachineBch2026ForProvider();
  return vm.stateSuccess(vm.evaluate({ inputIndex: 1, ...program }));
}

describe('explicit singleton data-NFT index tags', () => {
  it('reads and writes an opt-in singleton and refuses missing or foreign tags', () => {
    const tagged = master(true);
    const plain = master(false);
    expect(tagged.artifact.stateLayout).toMatchObject({ dataNftCount: 1, taggedDataNfts: true });
    expect(plain.artifact.stateLayout).not.toHaveProperty('taggedDataNfts');
    expect(tagged.artifact.compiler.options?.tagSingletonDataNfts).toBe(true);
    const before = tagged.record({ stored: 7n });
    const after = tagged.record({ stored: 9n });
    expect(accepts(tagged, 'read', 7n, before)).toBe(true);
    expect(accepts(tagged, 'set', 9n, before, after)).toBe(true);
    expect(accepts(plain, 'read', 7n, plain.record({ stored: 7n }))).toBe(true);
    expect(accepts(tagged, 'read', 7n, plain.record({ stored: 7n }))).not.toBe(true);
    const foreign = before.slice();
    foreign[0] = 0x51; // tag 1 substituted for the only record's tag 0
    expect(accepts(tagged, 'read', 7n, foreign)).not.toBe(true);
    const wrongOutput = after.slice();
    wrongOutput[0] = 0x51;
    expect(accepts(tagged, 'set', 9n, before, wrongOutput)).not.toBe(true);
  });

  it('reserves tag bytes in opt-in packing and refuses an indivisible overflowing field', () => {
    const source = 'contract Flags { bool public a; bool public b; function check() { require(true); } }';
    const plain = compileString(source, { messageBus: false, commitmentLimit: 2 });
    const tagged = compileString(source, { messageBus: false, commitmentLimit: 2, tagSingletonDataNfts: true });
    expect(plain.stateLayout?.dataNftCount).toBe(1);
    expect(tagged.stateLayout?.dataNftCount).toBe(2);
    for (const commitment of [0, 1].map((index) => buildPushdataCommitment(tagged.stateLayout!,
      { a: true, b: false }, index))) expect(commitment.length / 2).toBeLessThanOrEqual(2);
    expect(() => compileString('contract Flag { bool a; function check() { require(true); } }',
      { messageBus: false, commitmentLimit: 1, tagSingletonDataNfts: true })).toThrow('STATE_RECORD_CAPACITY');
  });

  it('authenticates a tagged singleton external read and rejects a substituted input tag', async () => {
    const provider = new MockNetworkProvider();
    const options = { messageBus: false, forceStateful: true, tagSingletonDataNfts: true } as const;
    const targetArtifact = compileString(SOURCE, options);
    const targetBase = new Contract(targetArtifact, [], { provider });
    const targetSetup = await setupStatefulUtxos(provider, targetBase, targetArtifact.stateLayout!,
      { stored: 7n }, { saltContract: true });
    const target = targetBase.withCategory(hexToBin(targetSetup.categoryId));
    const readerArtifact = compileString(`interface IBox { public uint8 stored; }
      contract Reader(bytes target) {
        function read() { require(IBox(target).stored == 7); }
      }`, options);
    expect(readerArtifact.externalInterfaces?.find((iface) => iface.name === 'IBox')?.stateLayout)
      .toMatchObject({ dataNftCount: 1, taggedDataNfts: true });
    const readerBase = new Contract(readerArtifact,
      [getDataNftLockingBytecode(targetSetup.categoryId, hexToBin(target.lockingBytecode))], { provider });
    const readerSetup = await setupStatefulUtxos(provider, readerBase, readerArtifact.stateLayout!, {},
      { saltContract: true });
    const reader = readerBase.withCategory(hexToBin(readerSetup.categoryId));
    const builder = new StatefulTransactionBuilder({
      provider, stateLayout: readerArtifact.stateLayout!, categoryId: readerSetup.categoryId,
      masterUtxo: { ...readerSetup.masterUtxo, unlocker: reader.unlock.read() }, dataNftUtxos: [],
      readOnlyDataNftUtxos: [{ ...targetSetup.dataNftUtxos[0],
        unlocker: createReadOnlyDataNftUnlocker(target, targetSetup.categoryId) }],
    }).build();
    const program = builder.buildLibauthProgram();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, ...program }))).toBe(true);
    const input = program.sourceOutputs.find((output) => output.token?.nft?.capability === 'mutable');
    expect(input).toBeDefined();
    input!.token!.nft!.commitment[0] = 0x51;
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, ...program }))).not.toBe(true);
  });

  it('binds and executes tagged singleton child-genesis records', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      contract Child { uint8 public stored = 7; }
      contract Parent {
        function create() public returns (uint8) { return (new Child()).stored(); }
        function check(uint8 expected) public { require(create() == expected); }
      }`, { messageBus: false, evmCompat: true, forceStateful: true, tagSingletonDataNfts: true,
      allowUnsafeOperations: true });
    const descriptor = artifacts.Parent.abi.find((entry) => entry.name === 'check')?.deployTargets?.[0];
    expect(descriptor?.childLayoutDigest).toBe(childStateLayoutDigest(artifacts.Child.stateLayout!));
    expect(artifacts.Child.stateLayout).toMatchObject({ dataNftCount: 1, taggedDataNfts: true });
    const provider = new MockNetworkProvider();
    const signer = provider.getCachedSigner(0);
    for (let index = 0; index < 8; index += 1) {
      await provider.addUtxo(signer.getAddress(), { txid: 'd1'.repeat(32), vout: index, satoshis: 100_000_000n });
    }
    const parent = await getContractFactory(artifacts.Parent, signer).deploy();
    parent.registerArtifacts(artifacts);
    await provider.addUtxo(signer.getAddress(), { txid: 'd2'.repeat(32), vout: 0, satoshis: 100_000_000n });
    const result = await parent.getFunction('check')(7n).deploy();
    const record = getTxOutputs(result.tx).find((output) => output.token?.category === result.childCategoryId
      && output.token.nft?.capability === 'mutable');
    expect(record?.token?.nft?.commitment).toBe(buildPushdataCommitment(artifacts.Child.stateLayout!, { stored: 7n }, 0));
  });
});
