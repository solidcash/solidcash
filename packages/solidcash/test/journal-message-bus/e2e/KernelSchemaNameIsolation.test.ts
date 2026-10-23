import { binToHex, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { decodePushdataValue, type EntryAccessAbi, type AbiFunction, type Artifact } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs, transaction,
  })) === true);
};

describe('kernel schema-name isolation', () => {
  it('evaluates the exact stored-element recipe with a same-typed decoy', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Capsule { uint8 code; bytes recipient; bytes payload; uint32 observedAt; }
      contract Ledger {
        mapping(uint256 => Capsule[]) records;
        function append(uint256 key, Capsule decoy, Capsule selected) public {
          selected.observedAt = uint32(block.timestamp);
          records[key].push(selected);
          require(records[key].length > 0);
        }
      }
    `, { ...OPTIONS, messageBusHandlers: ['append'] });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'append');
    expect(handler).toMatchObject({ eligible: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'append')
      ?.entryAccesses?.[0].storedElementSource).toMatchObject({
      version: 1, elementType: 'Capsule', expression: { kind: 'call', name: 'Capsule' },
    });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const connected = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    const decoy = [9n, new Uint8Array([9]), new Uint8Array([9]), 999n];
    const selected = [2n, new Uint8Array([2]), new Uint8Array([4, 2]), 0n];
    const builder = await connected.batch([
      { function: 'append', args: [7n, decoy, selected] },
      { function: 'append', args: [7n, decoy, selected] },
    ]).build();
    expect(vmAccepts(builder)).toBe(true);
  }, 120_000);

  it('does not give historical function or schema names special kernel authority', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct JobEventData { uint8 type_; bytes address_; bytes data_; uint32 timestamp_; }
      contract Marketplace {
        mapping(uint256 => JobEventData[]) jobEvents;
        function publishJobEvent(
          uint256 key, JobEventData decoy, JobEventData selected
        ) public {
          selected.timestamp_ = uint32(block.timestamp);
          jobEvents[key].push(selected);
          require(jobEvents[key].length > 0);
        }
      }
    `, { ...OPTIONS, messageBusHandlers: ['publishJobEvent'] });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'publishJobEvent');
    expect(handler).toMatchObject({ eligible: true });
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.abi.find((candidate) => candidate.name === 'publishJobEvent')
      ?.entryAccesses?.[0].storedElementSource).toMatchObject({
      version: 1, elementType: 'JobEventData', expression: { kind: 'call', name: 'JobEventData' },
    });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const connected = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    const decoy = [9n, new Uint8Array([9]), new Uint8Array([9]), 999n];
    const selected = [2n, new Uint8Array([2]), new Uint8Array([4, 2]), 0n];
    const builder = await connected.batch([
      { function: 'publishJobEvent', args: [7n, decoy, selected] },
      { function: 'publishJobEvent', args: [7n, decoy, selected] },
    ]).build();
    expect(vmAccepts(builder)).toBe(true);
  }, 120_000);

  it('evaluates typed literal arithmetic in a stored-element recipe', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`struct Cell { int value; bytes payload; }
      contract Ledger {
      mapping(int => Cell[]) records;
      function append(int key, int delta, bytes payload) public {
        records[key].push(Cell(delta + 2, payload));
        require(records[key].length > 0);
      }
    }`, { ...OPTIONS, evmCompat: false, messageBusHandlers: ['append'] });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'append')
      ?.entryAccesses?.[0]).toMatchObject({
      arrayMutation: 'push',
      storedElementSource: {
        expression: {
          kind: 'call', name: 'Cell',
          args: [expect.objectContaining({ kind: 'binary', operator: '+' }), expect.anything()],
        },
      },
    });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const connected = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    const handler = artifact.abi.find((candidate) => candidate.name === 'append')!;
    const access = handler.entryAccesses![0];
    const payload = new Uint8Array(70).fill(0x51);
    const evaluator = connected as unknown as {
      _encodeStoredElementSource(
        sourceAccess: EntryAccessAbi, elementType: string, args: unknown[], sourceHandler: AbiFunction,
        sourceArtifact: Artifact, state?: Record<string, unknown>,
      ): Uint8Array | undefined;
    };
    const encoded = evaluator._encodeStoredElementSource(access, 'Cell', [3n, 5n, payload], handler, artifact);
    expect(encoded).toBeDefined();
    expect(decodePushdataValue(encoded!, 0, 'Cell', artifact.structs).value)
      .toEqual({ value: 7n, payload });
  }, 120_000);

  it('evaluates a typed bigint left shift in a stored-element recipe', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract ShiftedRecord {
      mapping(int => bigint[]) records;
      function append(int key) public {
        records[key].push(bigint(4) << 160);
        require(records[key].length > 0);
      }
    }`, { ...OPTIONS, messageBusHandlers: ['append'] });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'append'))
      .toMatchObject({ eligible: true });
    const handler = artifact.abi.find((candidate) => candidate.name === 'append')!;
    const access = handler.entryAccesses![0];
    expect(access.storedElementSource?.expression).toMatchObject({
      kind: 'binary', operator: '<<', type: 'bigint',
    });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const connected = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    const evaluator = connected as unknown as {
      _encodeStoredElementSource(
        sourceAccess: EntryAccessAbi, elementType: string, args: unknown[], sourceHandler: AbiFunction,
        sourceArtifact: Artifact, state?: Record<string, unknown>,
      ): Uint8Array | undefined;
    };
    const encoded = evaluator._encodeStoredElementSource(access, 'bigint', [7n], handler, artifact);
    expect(encoded).toBeDefined();
    expect(decodePushdataValue(encoded!, 0, 'bigint').value).toBe(4n << 160n);
    const builder = await connected.batch([
      { function: 'append', args: [7n] },
      { function: 'append', args: [7n] },
    ]).build();
    expect(vmAccepts(builder)).toBe(true);
  }, 120_000);

  it('treats historical Marketplace identifiers exactly like an alpha-renamed chunkable write', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const variants = [
      {
        contractName: 'Marketplace', structName: 'JobEventData', collection: 'jobEvents',
        functionName: 'publishJobPost', fields: ['type_', 'address_', 'data_', 'timestamp_'],
      },
      {
        contractName: 'Catalog', structName: 'Notice', collection: 'notices',
        functionName: 'appendNotice', fields: ['kind', 'recipient', 'payload', 'observedAt'],
      },
    ] as const;
    const pkh = hexToBin('71782e8159265ed94bd35b8e699c08f53a6f38c6');
    const lock = new Uint8Array(25);
    lock.set([0x76, 0xa9, 0x14], 0);
    lock.set(pkh, 3);
    lock.set([0x88, 0xac], 23);
    const encodedAddress = lockingBytecodeToCashAddress({
      bytecode: lock, prefix: 'bchtest', tokenSupport: false,
    });
    const cashAddress = typeof encodedAddress === 'string' ? encodedAddress : encodedAddress.address;
    const builders: TransactionBuilder[] = [];
    const layouts: unknown[] = [];

    for (const variant of variants) {
      const [kind, recipient, payload, observedAt] = variant.fields;
      const artifact = compileString(`pragma solidity ^0.8.0;
        struct ${variant.structName} {
          uint8 ${kind}; bytes ${recipient}; bytes ${payload}; uint32 ${observedAt};
        }
        contract ${variant.contractName} {
          mapping(uint256 => bytes) ${variant.collection};
          function ${variant.functionName}(uint256 id, ${variant.structName} memory item) public {
            ${variant.collection}[id] = item.${recipient};
            require(true);
          }
        }`, { ...OPTIONS, messageBusHandlers: [variant.functionName] });
      expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
      expect(artifact.messageBus?.handlers.find((entry) => entry.name === variant.functionName))
        .toMatchObject({ eligible: true });
      layouts.push(artifact.messageBus?.route.blockLayout);
      const base = new Contract(artifact, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, {}, { saltContract: true },
      );
      const connected = StatefulContract.withCategory(
        base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
      );
      const item = {
        [kind]: 1n,
        [recipient]: cashAddress,
        [payload]: new Uint8Array(),
        [observedAt]: 0n,
      };
      builders.push(await connected.batch([{
        function: variant.functionName, args: [7n, item],
      }]).build());
    }

    expect(layouts[0]).toEqual(layouts[1]);
    expect(builders.map(vmAccepts)).toEqual([true, true]);
    const transactions = builders.map((builder) => builder.buildLibauthTransaction());
    expect(transactions[0].inputs).toHaveLength(transactions[1].inputs.length);
    expect(transactions[0].outputs).toHaveLength(transactions[1].outputs.length);
    const commitmentLengths = (builder: TransactionBuilder): number[] => builder.outputs
      .filter((output) => output.token?.nft?.capability === 'mutable')
      .map((output) => String(output.token?.nft?.commitment ?? '').length);
    const commitments = (builder: TransactionBuilder): string[] => builder.outputs
      .filter((output) => output.token?.nft?.capability === 'mutable')
      .map((output) => String(output.token?.nft?.commitment ?? ''));
    // In particular, the exact legacy struct/field spellings did not reinterpret the CashAddress-looking bytes
    // as locking bytecode: both variants materialize byte-identical-width generic entry geometry.
    expect(commitmentLengths(builders[0])).toEqual(commitmentLengths(builders[1]));
    expect(commitments(builders[0])).toEqual(commitments(builders[1]));
  }, 120_000);

  it('composes two alpha-renamed contracts with colliding schema names without journal bleed', async () => {
    // Fan-out compose (FanOut shape): event Ledger.append + mapping Catalog.append share the Solidity
    // spelling `append` / `records` vocabulary but keep distinct categories under one Caller.fire graph.
    const provider = createMessageBusCapstoneTestProvider();
    const leftArtifact = compileString(`pragma solidity ^0.8.0;
      contract Ledger {
        event Cell(uint256 key, uint256 value);
        function append(uint256 key, uint256 value) public {
          emit Cell(key, value);
          require(true);
        }
      }
    `, { ...OPTIONS, messageBusHandlers: ['append'] });
    const rightArtifact = compileString(`pragma solidity ^0.8.0;
      contract Catalog {
        mapping(uint256 => uint256) records;
        function append(uint256 key, uint256 value) public {
          records[key] = value;
          require(true);
        }
      }
    `, { ...OPTIONS, messageBusHandlers: ['append'] });
    expect(leftArtifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(rightArtifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });

    const leftBase = new Contract(leftArtifact, [], { provider });
    const rightBase = new Contract(rightArtifact, [], { provider });
    const leftSetup = await setupStatefulUtxos(
      provider, leftBase, leftArtifact.stateLayout!, {}, { saltContract: true },
    );
    const rightSetup = await setupStatefulUtxos(
      provider, rightBase, rightArtifact.stateLayout!, {}, { saltContract: true },
    );
    const left = StatefulContract.withCategory(
      leftBase.withCategory(hexToBin(leftSetup.categoryId)), leftSetup.categoryId,
    );
    const right = StatefulContract.withCategory(
      rightBase.withCategory(hexToBin(rightSetup.categoryId)), rightSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface ILedger { function append(uint256 key, uint256 value) external; }
      interface ICatalog { function append(uint256 key, uint256 value) external; }
      contract Caller(address ledger, address catalog) {
        function fire(uint256 leftKey, uint256 leftValue, uint256 rightKey, uint256 rightValue) public {
          ILedger(ledger).append(leftKey, leftValue);
          ICatalog(catalog).append(rightKey, rightValue);
          require(true);
        }
      }
    `, OPTIONS);
    const callerBase = new Contract(
      callerArtifact,
      [left.inner.lockingBytecode, right.inner.lockingBytecode],
      { provider },
    );
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const fireAbi = callerArtifact.abi.find((entry) => entry.name === 'fire')!;
    const leftCallsite = fireAbi.externalCalls!.find((call) => call.interfaceName === 'ILedger')!.callsiteId!;
    const rightCallsite = fireAbi.externalCalls!.find((call) => call.interfaceName === 'ICatalog')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: caller,
          functionName: 'fire',
          args: [7n, 11n, 9n, 13n],
        },
        {
          contract: left,
          functionName: 'append',
          args: [7n, 11n],
          callsiteId: leftCallsite,
        },
        {
          contract: right,
          functionName: 'append',
          args: [9n, 13n],
          callsiteId: rightCallsite,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const transaction = builder.buildLibauthTransaction();
    const leftCategory = leftSetup.categoryId.toLowerCase();
    const rightCategory = rightSetup.categoryId.toLowerCase();
    expect(leftCategory).not.toEqual(rightCategory);

    const leftEvents = transaction.outputs.filter((output) => output.token?.nft?.capability === 'none'
      && binToHex(output.token.category).toLowerCase() === leftCategory);
    const rightEntries = transaction.outputs.filter((output) => output.token?.nft?.capability === 'mutable'
      && binToHex(output.token.category).toLowerCase() === rightCategory);
    expect(leftEvents.length).toBeGreaterThan(0);
    expect(rightEntries.length).toBeGreaterThan(0);
    // Same Solidity `append` spelling on both contracts; effects stay on their own categories.
    expect(leftEvents.every((output) =>
      binToHex(output.token!.category).toLowerCase() !== rightCategory)).toBe(true);
    expect(rightEntries.every((output) =>
      binToHex(output.token!.category).toLowerCase() !== leftCategory)).toBe(true);
  }, 180_000);
});
