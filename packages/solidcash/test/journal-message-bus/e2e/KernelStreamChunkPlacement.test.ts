import { binToHex, hexToBin } from '@bitauth/libauth';
import { buildChunkCommitment, encodeEventCommitment, sha256, splitValueIntoChunks } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract, type TransactionBuilder } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { getDynamicChunkAddress } from '../../../src/stateful/covenant-helpers.js';
import { compose } from '../../../src/message-bus/index.js';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;
const SOURCE = `contract StreamChunkPlacement() {
  string left;
  string right;
  string first;
  string second;
  event Recorded(int value);
  event Many(int[] values);
  function writeFirst(bytes32 expected, string next) public {
    require(sha256(this.left) == expected);
    this.first = next;
    emit Recorded(11);
    require(true);
  }
  function writeSecond(bytes32 expected, string next) public {
    require(sha256(this.right) == expected);
    this.second = next;
    emit Recorded(22);
    require(true);
  }
`;

const inputResults = (builder: TransactionBuilder): Array<true | string> => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider();
  return transaction.inputs.map((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ));
};

describe('kernel stream placement after differing persisted chunk runs', () => {
  const deploy = async (readOnlyEmitter = false): Promise<{
    provider: MockNetworkProvider; contract: StatefulContract; artifact: ReturnType<typeof compileString>;
    categoryId: string; left: string; right: string;
  }> => {
    const provider = new MockNetworkProvider();
    const artifact = compileString(`${SOURCE}${readOnlyEmitter ? `
      function readEmit(string expected, int[] values) public {
        require(this.left == expected);
        emit Many(values);
        require(true);
      }` : ''}}`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    const left = 'L'.repeat(250);
    const right = 'R'.repeat(130);
    const { categoryId } = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { left, right, first: '', second: '' }, {
        saltContract: true,
        extraOutputs: (owner) => [['left', left], ['right', right]].flatMap(([name, value]) =>
          splitValueIntoChunks(new TextEncoder().encode(value)).map((chunk, index) => ({
            address: getDynamicChunkAddress(base.withCategory(hexToBin(owner)), owner, name, 'string'),
            satoshis: 10_000n,
            token: { amount: 0n, nft: { capability: 'mutable', commitment: buildChunkCommitment(index, chunk) } },
          }))),
      },
    );
    const contract = StatefulContract.withCategory(base.withCategory(hexToBin(categoryId)), categoryId);
    return { provider, contract, artifact, categoryId, left, right };
  };

  it('settles sibling compose rows with different reads and writes and rejects a changed stream', async () => {
    const { provider, contract, artifact, categoryId, left, right } = await deploy();
    const first = 'A'.repeat(130);
    const second = 'B'.repeat(10);
    const leftHash = sha256(new TextEncoder().encode(left));
    const rightHash = sha256(new TextEncoder().encode(right));
    const callerArtifact = compileString(`
      interface IStreamChunkPlacement {
        function writeFirst(bytes32 expected, string next);
        function writeSecond(bytes32 expected, string next);
      }
      contract StreamChunkCoordinator() {
        function run(address target, bytes32 left, string first, bytes32 right, string second) public {
          IStreamChunkPlacement(target).writeFirst(left, first);
          IStreamChunkPlacement(target).writeSecond(right, second);
          require(true);
        }
      }
    `, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStreamChunkPlacement', contract);
    const callsites = callerArtifact.abi.find((entry) => entry.name === 'run')!.externalCalls!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const call = compose({
      preparedCalls: [
        { contract: caller, functionName: 'run', args: [contract.inner.lockingBytecode, leftHash, first, rightHash, second] },
        { contract, functionName: 'writeFirst', args: [leftHash, first], callsiteId: callsites[0].callsiteId },
        { contract, functionName: 'writeSecond', args: [rightHash, second],
          callsiteId: callsites[0].callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await call.build();
    expect(inputResults(builder)).toEqual(builder.inputs.map(() => true));
    const event = artifact.events!.find((candidate) => candidate.name === 'Recorded')!;
    const records = builder.outputs.flatMap((output, index) => output.token?.category === categoryId
      && output.token.nft?.capability === 'none' ? [{ output, index }] : []);
    expect(records.map(({ output }) => output.token!.nft!.commitment))
      .toEqual([11n, 22n].map((value) => binToHex(encodeEventCommitment(event.parameters, [value]))));
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    transaction.outputs[records[1].index].token!.nft!.commitment = Uint8Array.of(0xff);
    const vm = createVirtualMachineBch2026ForProvider();
    const inputIndex = builder.inputs.findIndex((input) => input.token?.category === categoryId
      && input.token.nft?.capability === 'minting');
    expect(inputIndex).toBeGreaterThan(0);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }))).not.toBe(true);
    await expect(call.send()).resolves.toHaveProperty('txid');
    expect(await contract.getState()).toMatchObject({ left, right, first, second });
    // A direct entry on the same artifact reads only its own variable; sibling-only resources stay untouched.
    const direct = contract.call.writeFirst(leftHash, 'direct');
    const directBuilder = await direct.build();
    expect(inputResults(directBuilder)).toEqual(directBuilder.inputs.map(() => true));
    await expect(direct.send()).resolves.toHaveProperty('txid');
    expect(await contract.getState()).toMatchObject({ left, right, first: 'direct', second });
  }, 120_000);

  it('settles plain batch chunked records after preserved read-only chunks and rejects reordering', async () => {
    const { contract, artifact, categoryId, left, right } = await deploy(true);
    const values = Array.from({ length: 9 }, (_unused, index) => 100_000n + BigInt(index));
    const call = contract.batch([{ function: 'readEmit', args: [left, values] }]);
    const builder = await call.build();
    expect(inputResults(builder)).toEqual(builder.inputs.map(() => true));
    const records = builder.outputs.flatMap((output, index) => output.token?.category === categoryId
      && output.token.nft?.capability === 'none' ? [{ output, index }] : []);
    expect(records).toHaveLength(3);
    const event = artifact.events!.find((candidate) => candidate.name === 'Many')!;
    expect(records.map(({ output }) => output.token!.nft!.commitment).join(''))
      .toBe(binToHex(encodeEventCommitment(event.parameters, [values])));
    const preserved = builder.inputs.filter((input) => input.token?.category === categoryId
      && input.token.nft?.capability === 'mutable');
    expect(preserved).toHaveLength(6);
    for (const input of preserved) {
      expect(builder.outputs.findIndex((output) => output.token?.nft?.commitment === input.token!.nft!.commitment))
        .toBeLessThan(records[0].index);
    }
    const changedRead = await call.build();
    const readIndex = changedRead.outputs.findIndex((output) => output.token?.nft?.commitment
      === preserved[1].token!.nft!.commitment);
    expect(readIndex).toBeGreaterThan(0);
    changedRead.outputs[readIndex].token!.nft!.commitment = 'ff';
    expect(inputResults(changedRead)[0]).not.toBe(true);
    const hostile = await call.build();
    [hostile.outputs[records[1].index], hostile.outputs[records[2].index]] =
      [hostile.outputs[records[2].index], hostile.outputs[records[1].index]];
    expect(inputResults(hostile).some((result) => result !== true)).toBe(true);
    await expect(call.send()).resolves.toHaveProperty('txid');
    expect(await contract.getState()).toMatchObject({ left, right, first: '', second: '' });
  }, 120_000);
});
