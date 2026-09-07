import { hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const OPTIONS = {
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
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs, transaction,
  })) === true);
};

describe('kernel schema-name isolation', () => {
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
});
