import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { callRecordCommitment, callRecordDigest } from '../../../src/stateful/call-record.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const missingAuthenticatedReturn = (functionName: string): string =>
  `Could not derive the return value of '${functionName}' for .emitReturn(). The covenant trace did not expose an authenticated return commitment.`;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

const commitmentNonEmpty = (commitment: Uint8Array | string | undefined): boolean => {
  if (commitment === undefined) return false;
  const bytes = typeof commitment === 'string' ? hexToBin(commitment) : commitment;
  return bytes.length > 0 && !bytes.every((byte) => byte === 0);
};

describe('kernel two-hop return probe', () => {
  it('derives zero, one, and two looped getter results from an authenticated scalar result', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sourceArtifact = compileString(`pragma solidity ^0.8.0;
      contract NumberSource {
        mapping(uint256 => uint256) public values;
        function size() public pure returns (uint256) { return 2; }
        function seed(uint256 index, uint256 value) public { values[index] = value; require(true); }
        function read(uint256 index) public view returns (uint256) { return values[index]; }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const sourceBase = new Contract(sourceArtifact, [], { provider });
    const sourceSetup = await setupStatefulUtxos(
      provider, sourceBase, sourceArtifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );
    await expect(source.call.seed(1n, 11n).send()).resolves.toBeDefined();
    await expect(source.call.seed(0n, 10n).send()).resolves.toBeDefined();
    expect(sourceArtifact.abi.find((fn) => fn.name === 'read')?.entryAccesses).toEqual([
      expect.objectContaining({ collection: 'values', operations: ['read'] }),
    ]);
    // The read handler keys the value the loop variable selects, so its key pool covers every physical entry
    // slot the loop can reach: the published alternative lane is the whole pool, not a two-slot window.
    expect(sourceArtifact.messageBus?.handlers.find((fn) => fn.name === 'read'))
      .toMatchObject({ physicalEntrySlotAlternatives: [[0, 1, 2, 3, 4, 5, 6, 7]] });

    const collectorArtifact = compileString(`pragma solidity ^0.8.0;
      interface INumberSource {
        function size() external view returns (uint256);
        function read(uint256 index) external view returns (uint256);
      }
      contract NumberCollector(address source) {
        function collect(uint256 offset) public view returns (uint256[] memory) {
          uint256 length = INumberSource(source).size() - offset;
          uint256[] memory result = new uint256[](length);
          for (uint256 index = 0; index < length; index++) {
            result[index] = INumberSource(source).read(index + offset);
          }
          return result;
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    expect(collectorArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(collectorArtifact.bytecode.replace(/\s+/gu, '')).toContain('OP_INVOKE');
    expect(collectorArtifact.abi.find((fn) => fn.name === 'collect')?.externalCalls?.[1])
      .toMatchObject({ callsiteId: 1, functionName: 'read', resultArrayOutput: 0 });
    const collectorBase = new Contract(
      collectorArtifact, [source.inner.lockingBytecode], { provider },
    );
    const collectorSetup = await setupStatefulUtxos(
      provider, collectorBase, collectorArtifact.stateLayout!, {}, { saltContract: true },
    );
    const collector = StatefulContract.withCategory(
      collectorBase.withCategory(hexToBin(collectorSetup.categoryId)), collectorSetup.categoryId,
      { externals: { INumberSource: source } },
    );

    await expect(collector.call.collect(2n).staticCall()).resolves.toEqual([]);
    await expect(collector.call.collect(1n).staticCall()).resolves.toEqual([11n]);
    await expect(collector.call.collect(0n).staticCall()).resolves.toEqual([10n, 11n]);
  }, 120_000);

  it('materializes authenticated non-empty return commitments across Leaf→Root compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const leafArtifact = compileString(`pragma solidity ^0.8.0;
      contract Leaf {
        function read(uint256 value) public pure returns (uint256) { return value + 7; }
      }`, KERNEL);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, {}, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );

    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      interface Reader { function read(uint256 value) external view returns (uint256); }
      contract Root(address leaf) {
        function read(uint256 value) public view returns (uint256) {
          return Reader(leaf).read(value);
        }
      }`, KERNEL);
    const rootBase = new Contract(rootArtifact, [leaf.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );

    const callsiteId = rootArtifact.abi.find((entry) => entry.name === 'read')!
      .externalCalls!.find((call) => call.functionName === 'read')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'read', args: [3n] },
        { contract: leaf, functionName: 'read', args: [3n], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const transaction = builder.buildLibauthTransaction();
    const participants = [
      { artifact: rootArtifact, categoryId: rootSetup.categoryId },
      { artifact: leafArtifact, categoryId: leafSetup.categoryId },
    ];
    for (const { artifact, categoryId } of participants) {
      const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
        && input.unlocker.contract.artifact.contractName === artifact.contractName
        && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
      expect(routeInputIndex).toBeGreaterThanOrEqual(0);
      const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
      if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
      const returnWitnessIndex = artifact.messageBus!.route.inputs.findIndex(
        (input) => input.name === '__internal__returnOutputIdx',
      );
      expect(returnWitnessIndex).toBeGreaterThanOrEqual(0);
      const absoluteReturnOutputIndex = Number(routeUnlocker.params[returnWitnessIndex] as bigint);
      const returnOutput = transaction.outputs[absoluteReturnOutputIndex];
      expect(returnOutput.token).toMatchObject({
        category: hexToBin(categoryId),
        nft: { capability: 'none' },
      });
      expect(
        commitmentNonEmpty(returnOutput.token?.nft?.commitment),
        `return commitment at ${absoluteReturnOutputIndex} must be non-empty/non-zero`,
      ).toBe(true);
      expect(binToHex(returnOutput.token!.nft!.commitment as Uint8Array)).not.toMatch(/^0+$/);
    }

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 120_000);

  it('fails closed when a prepared return commitment is empty', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const leafArtifact = compileString(`pragma solidity ^0.8.0;
      contract Leaf {
        function read(uint256 value) public pure returns (uint256) { return value + 7; }
      }`, KERNEL);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, {}, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );

    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      interface Reader { function read(uint256 value) external view returns (uint256); }
      contract Root(address leaf) {
        function read(uint256 value) public view returns (uint256) {
          return Reader(leaf).read(value);
        }
      }`, KERNEL);
    const rootBase = new Contract(rootArtifact, [leaf.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );

    const callsiteId = rootArtifact.abi.find((entry) => entry.name === 'read')!
      .externalCalls!.find((call) => call.functionName === 'read')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const emptyCommitment = new Uint8Array(0);
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'read', args: [3n] },
        {
          contract: leaf,
          functionName: 'read',
          args: [3n],
          callsiteId,
          provisionalResultCommitment: emptyCommitment,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/prepared return commitment/);
  }, 120_000);

  it('emits a non-empty return commitment on Leaf.read via .emitReturn()', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const leafArtifact = compileString(`pragma solidity ^0.8.0;
      contract Leaf {
        function read(uint256 value) public pure returns (uint256) { return value + 7; }
      }`, KERNEL);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, {}, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );

    const tx = await leaf.call.read(3n).emitReturn().send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
    const categoryHex = leafSetup.categoryId.toLowerCase();
    const returnOutput = tx.outputs.find((output) => {
      const category = output.token?.category;
      const categoryMatches = typeof category === 'string'
        ? category.toLowerCase() === categoryHex
        : category !== undefined && binToHex(category).toLowerCase() === categoryHex;
      return categoryMatches
        && output.token?.nft?.capability === 'none'
        && commitmentNonEmpty(output.token.nft?.commitment);
    });
    expect(returnOutput).toBeDefined();
    // ABI-encoded uint256(10) must appear in the authenticated return commitment.
    const expected = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [10n]).slice(2));
    const commitment = typeof returnOutput!.token!.nft!.commitment === 'string'
      ? hexToBin(returnOutput!.token!.nft!.commitment)
      : returnOutput!.token!.nft!.commitment;
    expect(binToHex(commitment)).toContain(binToHex(expected));
  }, 120_000);

  it('hash-commits an oversized direct ABI return NFT', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract WideReturn {
        function values() public pure returns (uint256, uint256, uint256, uint256, uint256) {
          return (1, 2, 3, 4, 5);
        }
      }`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    const values = [1n, 2n, 3n, 4n, 5n];

    const builder = await contract.call.values().emitReturn().build();
    expect(vmAccepts(builder)).toBe(true);
    const raw = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint256', 'uint256', 'uint256', 'uint256'], values,
    ).slice(2));
    expect(raw).toHaveLength(160);
    const returnOutput = builder.buildLibauthTransaction().outputs.find((output) => (
      output.token?.nft?.capability === 'none'
      && output.token.category !== undefined
      && binToHex(output.token.category) === setup.categoryId
    ));
    // D50: the carrier is the record of this call, digest(values) || form 2 || SHA256(result).
    const digest = callRecordDigest(artifact.abi.find((fn) => fn.name === 'values')!, []);
    if (!digest) throw new Error('values publishes no selector');
    const commitment = returnOutput?.token?.nft?.commitment;
    expect(commitment).toEqual(callRecordCommitment(raw, digest));
    expect(commitment?.slice(32)).toEqual(hexToBin(ethers.sha256(raw).slice(2)));
  }, 120_000);

  it('pins the missing-authenticated-return error string for .emitReturn()', () => {
    expect(missingAuthenticatedReturn('read')).toBe(
      "Could not derive the return value of 'read' for .emitReturn(). "
      + 'The covenant trace did not expose an authenticated return commitment.',
    );
  });
});
