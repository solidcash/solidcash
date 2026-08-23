import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../../src/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { aliceAddress, bobAddress } from '../../fixture/vars.js';
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
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 10_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
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
  });
});
