import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { aliceAddress, bobAddress, carolAddress } from '../../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

describe('message-bus shared sorted-proof authority', () => {
  it('promotes an earlier read proof when a later row writes through it', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract SharedProofRoute() {
        mapping(address => uint) balances;

        function mint(address to, uint amount) public {
          balances[to] = balances[to] + amount;
          require(amount >= 0);
        }
        function checkBalance(address owner, uint expected) public {
          require(balances[owner] == expected);
        }
        function move(address from, address to, uint amount) public {
          require(balances[from] >= amount);
          balances[from] = balances[from] - amount;
          balances[to] = balances[to] + amount;
          require(amount >= 0);
        }
      }
    `, {
      forceStateful: true,
      evmCompat: true,
      messageBus: true,
      maximumInputBytes: 10_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'move')?.batchKeyWitnesses)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ routeInput: '__message_bus_key_balances_0', swappable: true }),
        expect.objectContaining({ routeInput: '__message_bus_key_balances_0_row', swappable: true }),
      ]));
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.mint(aliceAddress, 100n).send();
    await contract.mint(bobAddress, 10n).send();

    const batch = encodeMessageBatch(artifact, [
      { function: 'checkBalance', args: [bobAddress, 10n] },
      { function: 'move', args: [aliceAddress, bobAddress, 30n] },
    ]);
    await contract._batchRaw(batch.blob, batch.routeWitnesses).send();

    await expect(contract.checkBalance(aliceAddress, 70n).send()).resolves.toBeDefined();
    await expect(contract.checkBalance(bobAddress, 40n).send()).resolves.toBeDefined();

    await contract.mint(carolAddress, 100n).send();
    // The route now has one shared key (Bob) and separate row-local keys (Alice, Carol). Prove the valid
    // orientation executes, while replacing its shared proof with a key absent from the second row still fails.
    const distinct = encodeMessageBatch(artifact, [
      { function: 'move', args: [aliceAddress, bobAddress, 1n] },
      { function: 'move', args: [carolAddress, bobAddress, 1n] },
    ]);
    // routeWitnesses holds the route inputs other than batchBlob and the compiler's __internal__ ones.
    const sharedIndex = artifact.messageBus!.route.inputs
      .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'))
      .findIndex((input) => input.name === '__message_bus_key_balances_0');
    expect(sharedIndex).toBeGreaterThanOrEqual(0);
    const forgedWitnesses = [...distinct.routeWitnesses];
    forgedWitnesses[sharedIndex] = aliceAddress;
    await expect(contract._batchRaw(distinct.blob, forgedWitnesses).send()).rejects.toThrow();
    await contract._batchRaw(distinct.blob, distinct.routeWitnesses).send();
    await expect(contract.checkBalance(aliceAddress, 69n).send()).resolves.toBeDefined();
    await expect(contract.checkBalance(carolAddress, 99n).send()).resolves.toBeDefined();
    await expect(contract.checkBalance(bobAddress, 42n).send()).resolves.toBeDefined();
  });
});
