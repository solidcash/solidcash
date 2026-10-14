import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../../solidc/src/compiler.js';
import { Contract, type TransactionBuilder } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';
import { setupStatefulUtxos } from '../test-util.js';

const SOURCE = `contract Ledger {
  mapping(int => int) m;
  function set(int k, int value) { m[k] = value; require(true); }
  function conditionalSet(int k, int value, bool go) {
    if (go) { m[k] = value; }
    require(true);
  }
  function readIf(int k, int expected, bool go) {
    if (!go) { return; }
    require(m[k] == expected);
  }
  function read(int k, int expected) public { require(m[k] == expected); }
  function invokedRead(int a, int b) {
    require(m[a] == 11);
    this.read(b, 22);
    require(true);
  }
}`;

async function deploy(): Promise<{ provider: MockNetworkProvider; contract: StatefulContract }> {
  const provider = new MockNetworkProvider();
  const artifact = compileString(SOURCE, { messageBus: false, forceStateful: true, enforceFinalRequire: true });
  const base = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
  return { provider, contract: StatefulContract.withCategory(base, categoryId) };
}

function verdict(builder: TransactionBuilder, provider: MockNetworkProvider): true | string {
  const { transaction, sourceOutputs } = builder.buildLibauthProgram();
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ inputIndex: 0, transaction, sourceOutputs }));
}

function entryOutputs(builder: TransactionBuilder, key: bigint): number[] {
  const slot = binToHex(keyToSlot(bigIntToVmNumber(key)));
  return builder.outputs.flatMap((output, index) => {
    const commitment = output.token?.nft?.commitment;
    return commitment !== undefined && commitment.length >= 128
      && binToHex(decodeEntryCommitment(hexToBin(commitment)).slot) === slot ? [index] : [];
  });
}

describe('transcript direct-state integrity follow-ups', () => {
  it('does not insert an absent key when a conditional write without a read is skipped', async () => {
    const { provider, contract } = await deploy();
    await contract.getFunction('set')(7n, 11n).send();
    const builder = await contract.getFunction('conditionalSet')(19n, 88n, false).build();
    expect(entryOutputs(builder, 19n)).toEqual([]);
    expect(verdict(builder, provider)).toBe(true);
    const nodeIndex = builder.outputs.findIndex((output) => (output.token?.nft?.commitment.length ?? 0) >= 128);
    expect(nodeIndex).toBeGreaterThan(0);
    const node = builder.outputs[nodeIndex];
    const decoded = decodeEntryCommitment(hexToBin(node.token!.nft!.commitment));
    node.token!.nft!.commitment = binToHex(encodeEntryCommitment(
      decoded.slot, keyToSlot(bigIntToVmNumber(19n)), decoded.value,
    ));
    expect(verdict(builder, provider)).toBe('Program failed an OP_VERIFY operation.');
    const taken = await contract.getFunction('conditionalSet')(19n, 88n, true).build();
    expect(entryOutputs(taken, 19n)).toHaveLength(1);
    expect(verdict(taken, provider)).toBe(true);
  }, 120_000);

  it('preserves mapping records on the exempt direct early-return path', async () => {
    const { provider, contract } = await deploy();
    await contract.getFunction('set')(7n, 11n).send();
    const builder = await contract.getFunction('readIf')(7n, 999n, false).build();
    expect(verdict(builder, provider)).toBe(true);
    const indices = entryOutputs(builder, 7n);
    expect(indices).toHaveLength(1);
    const node = builder.outputs[indices[0]];
    const decoded = decodeEntryCommitment(hexToBin(node.token!.nft!.commitment));
    node.token!.nft!.commitment = binToHex(encodeEntryCommitment(decoded.slot, decoded.nextKey, bigIntToVmNumber(22n)));
    expect(verdict(builder, provider)).toBe('Program failed an OP_VERIFY operation.');
  }, 120_000);

  it('invokes a mapping reader using the caller collection witnesses', async () => {
    const { provider, contract } = await deploy();
    await contract.getFunction('set')(7n, 11n).send();
    await contract.getFunction('set')(19n, 22n).send();
    const builder = await contract.getFunction('invokedRead')(7n, 19n).build();
    expect(verdict(builder, provider)).toBe(true);
    const wrongKey = await contract.getFunction('invokedRead')(7n, 7n).build();
    expect(verdict(wrongKey, provider)).toBe('Program failed an OP_VERIFY operation.');
  }, 120_000);
});
