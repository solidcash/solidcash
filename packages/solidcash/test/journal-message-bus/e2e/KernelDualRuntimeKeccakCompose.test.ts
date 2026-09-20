import { bigIntToVmNumber, binToHex, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, Signer, StatefulContract, messageBus, SortedList, getEntryNftAddress,
} from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  solidityImportCompat: true,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

async function fundKeccakSidecars(
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>,
  categoryId: string,
  count = 2,
): Promise<void> {
  const keccakLock = binToHex(keccakComputeLockingBytecode(
    hexToBin(categoryId).reverse(), true,
  ));
  for (let index = 0; index < count; index += 1) {
    await provider.addUtxo(keccakLock, {
      ...randomUtxo({ satoshis: 100_000n }),
      token: {
        category: '77'.repeat(32), amount: 0n,
        nft: { capability: 'mutable', commitment: '' },
      },
    });
  }
}

/**
 * Dual-runtime / mapping × keccak under compose.
 *
 * Settles: scalar event emit + keccak; single-key mapping RMW + keccak (graph-owned deferred
 * preimage learning). Fixed dual-key add+remove in one handler remains OP_VERIFY under compose
 * (with or without keccak). DualRuntimeSet array-stream width + keccak remains an inherent density fence.
 */
describe('kernel dual-runtime / event / keccak under composition', () => {
  it('settles Ping emit + keccak256 under compose (no mapping RMW)', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, solidityImportCompat: false, messageBusGraphContext: true,
    });
    const accArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        int counter;
        event Ping(int value);
        function reveal(address probe, bytes32 preimage, bytes32 expected, int ping) public {
          require(keccak256(preimage) == expected);
          emit Ping(ping);
          this.counter = this.counter + 1;
          IProbe(probe).touch();
        }
      }`, { ...KERNEL, solidityImportCompat: false });
    expect(accArtifact.abi.find((entry) => entry.name === 'reveal')?.keccakCompute).toBe(true);
    expect(accArtifact.messageBus?.route.blockLayout?.slots.some(
      (slot) => slot.kind === 'keccakSideCar',
    )).toBe(true);
    expect(accArtifact.messageBus?.route.blockLayout?.slots.some(
      (slot) => slot.kind === 'event',
    )).toBe(true);

    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const accBase = new Contract(accArtifact, [], { provider });
    const accSetup = await setupStatefulUtxos(
      provider, accBase, accArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );
    acc._registerResolvedExternal('IProbe', probe);
    await fundKeccakSidecars(provider, accSetup.categoryId);

    const preimage = hexToBin('ab'.repeat(32));
    const expected = keccak_256(preimage);
    const callsite = accArtifact.abi.find((entry) => entry.name === 'reveal')!
      .externalCalls!.find((call) => call.functionName === 'touch')!.callsiteId!;
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: acc,
          functionName: 'reveal',
          args: [probe.inner.lockingBytecode, preimage, expected, 42n],
        },
        {
          contract: probe,
          functionName: 'touch',
          args: [],
          callsiteId: callsite,
        },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const canonical = await composition.build();
    expect(vmAccepts(canonical)).toBe(true);

    const transaction = canonical.buildLibauthTransaction();
    const accCategory = accSetup.categoryId.toLowerCase();
    const eventOutputs = transaction.outputs.filter((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      const commitment = output.token?.nft?.commitment;
      const commitmentLen = typeof commitment === 'string'
        ? commitment.length / 2
        : (commitment?.length ?? 0);
      return hex === accCategory
        && output.token?.nft?.capability === 'none'
        && commitmentLen > 0;
    });
    expect(eventOutputs.length).toBeGreaterThanOrEqual(1);

    const sidecarOffset = accArtifact.messageBus!.route.blockLayout!.slots.find(
      (slot) => slot.kind === 'keccakSideCar',
    )?.offset;
    expect(sidecarOffset).toBeDefined();
    const sidecarOut = transaction.outputs[sidecarOffset!];
    expect(sidecarOut?.token?.nft?.capability).toBe('mutable');

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await acc.getState()).counter).toBe(1n);
  }, 300_000);

  it('settles single-key mapping RMW + keccak under compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, solidityImportCompat: false, messageBusGraphContext: true,
    });
    const accArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        mapping(int => int) bal;
        function seed(int k, int v) public { this.bal[k] = v; require(true); }
        function credit(
          address probe,
          int k,
          int v,
          bytes32 preimage,
          bytes32 expected
        ) public {
          require(keccak256(preimage) == expected);
          this.bal[k] = this.bal[k] + v;
          IProbe(probe).touch();
          require(true);
        }
      }`, { ...KERNEL, solidityImportCompat: false });
    expect(accArtifact.messageBus?.handlers.find((handler) => handler.name === 'credit'))
      .toMatchObject({ eligible: true });
    expect(accArtifact.messageBus?.route.blockLayout?.slots.some(
      (slot) => slot.kind === 'keccakSideCar',
    )).toBe(true);

    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );
    const accBase = new Contract(accArtifact, [], { provider });
    const accSetup = await setupStatefulUtxos(
      provider, accBase, accArtifact.stateLayout!, {}, { saltContract: true },
    );
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );
    acc._registerResolvedExternal('IProbe', probe);
    await acc.call.seed(2n, 10n).send();
    await fundKeccakSidecars(provider, accSetup.categoryId);

    const preimage = hexToBin('cd'.repeat(32));
    const expected = keccak_256(preimage);
    const callsite = accArtifact.abi.find((entry) => entry.name === 'credit')!
      .externalCalls!.find((call) => call.functionName === 'touch')!.callsiteId!;
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: acc,
          functionName: 'credit',
          args: [probe.inner.lockingBytecode, 2n, 5n, preimage, expected],
        },
        {
          contract: probe,
          functionName: 'touch',
          args: [],
          callsiteId: callsite,
        },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const canonical = await composition.build();
    expect(vmAccepts(canonical)).toBe(true);
    const sidecarOffset = accArtifact.messageBus!.route.blockLayout!.slots.find(
      (slot) => slot.kind === 'keccakSideCar',
    )?.offset;
    expect(sidecarOffset).toBeDefined();
    expect(canonical.buildLibauthTransaction().outputs[sidecarOffset!]?.token?.nft?.capability)
      .toBe('mutable');

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const entryAddress = getEntryNftAddress(acc.inner, accSetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(entryAddress))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(15n);
  }, 300_000);

  it('characterizes fixed dual-key add+remove under compose: OP_VERIFY', async () => {
    // Dual batch-key witnesses in one handler still fail closed under compose (keccak-independent).
    const provider = createMessageBusCapstoneTestProvider();
    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, solidityImportCompat: false, messageBusGraphContext: true,
    });
    const accArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        mapping(int => bool) membership;
        function seed(int who) public { this.membership[who] = true; require(true); }
        function update(address probe, int addKey, int removeKey) public {
          this.membership[addKey] = true;
          this.membership[removeKey] = false;
          IProbe(probe).touch();
          require(true);
        }
      }`, { ...KERNEL, solidityImportCompat: false });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );
    const accBase = new Contract(accArtifact, [], { provider });
    const accSetup = await setupStatefulUtxos(
      provider, accBase, accArtifact.stateLayout!, {}, { saltContract: true },
    );
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );
    acc._registerResolvedExternal('IProbe', probe);
    await acc.call.seed(7n).send();
    const callsite = accArtifact.abi.find((entry) => entry.name === 'update')!
      .externalCalls!.find((call) => call.functionName === 'touch')!.callsiteId!;
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: acc,
          functionName: 'update',
          args: [probe.inner.lockingBytecode, 3n, 7n],
        },
        {
          contract: probe,
          functionName: 'touch',
          args: [],
          callsiteId: callsite,
        },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(composition.build()).rejects.toThrow(/BCH-2026 preflight failed|OP_VERIFY/);
  }, 180_000);

  it('characterizes DualRuntimeSet-width arrays + keccak under compose: density wall', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const probeArtifact = compileString(`pragma solidity ^0.8.20;
      contract Probe { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const accArtifact = compileString(`pragma solidity ^0.8.20;
      interface IProbe { function touch() external; }
      contract Acc {
        mapping(uint256 => mapping(address => bool)) public membership;
        function update(
          address probe,
          uint256 scope,
          address[] memory additions,
          address[] memory removals,
          bytes32 preimage,
          bytes32 expected
        ) public {
          require(keccak256(preimage) == expected);
          for (uint256 cursor = 0; cursor < additions.length; cursor++) {
            membership[scope][additions[cursor]] = true;
          }
          for (uint256 cursor = 0; cursor < removals.length; cursor++) {
            membership[scope][removals[cursor]] = false;
          }
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    expect(accArtifact.abi.find((entry) => entry.name === 'update')?.sortedUpsertLoopInfo)
      .toHaveLength(2);
    expect(accArtifact.messageBus?.route.blockLayout?.blockSize).toBeGreaterThan(100);
    expect(accArtifact.messageBus?.route.blockLayout?.slots.some(
      (slot) => slot.kind === 'keccakSideCar',
    )).toBe(true);

    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );
    const accBase = new Contract(accArtifact, [], { provider });
    const accSetup = await setupStatefulUtxos(
      provider, accBase, accArtifact.stateLayout!, {}, { saltContract: true },
    );
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );
    acc._registerResolvedExternal('IProbe', probe);
    await fundKeccakSidecars(provider, accSetup.categoryId, 1);

    const addition = new Signer(new Uint8Array(32).fill(0x61), provider).getAddress();
    const preimage = hexToBin('ef'.repeat(32));
    const expected = keccak_256(preimage);
    const callsite = accArtifact.abi.find((entry) => entry.name === 'update')!
      .externalCalls!.find((call) => call.functionName === 'touch')!.callsiteId!;
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: acc,
          functionName: 'update',
          args: [probe.inner.lockingBytecode, 1n, [addition], [], preimage, expected],
        },
        {
          contract: probe,
          functionName: 'touch',
          args: [],
          callsiteId: callsite,
        },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.build()).rejects.toThrow(
      /operation cost density limit|BCH-2026 preflight failed|failed to build its balanced block/,
    );
  }, 240_000);
});
