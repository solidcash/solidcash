import { compileString } from '../direct-compile.js';
import {
  Contract, StatefulContract,
  TransactionBuilder, FailedRequireError,
} from '../../src/index.js';
import {
  parsePushdataCommitment,
} from '@solidcash/utils';
import { createTestProvider, getTxOutputs, gatherUtxos, setupStatefulUtxos } from '../test-util.js';
import { randomUtxo } from '../../src/utils.js';

// A stateful contract that increments counter in a for loop
const FOR_LOOP_COUNTER_CONTRACT = `
pragma solidcash >=0.8.0;

contract ForLoopCounter() {
    int counter;

    function incrementLoop(int iterations) {
        for (int i = 0; i < iterations; i = i + 1) {
            this.counter = this.counter + 1;
        }
    }
}
`;

// A stateful contract with a branch inside a for loop
const FOR_BRANCH_IN_LOOP_CONTRACT = `
pragma solidcash >=0.8.0;

contract ForBranchInLoop() {
    int counter;

    function update(bool addTwo, int iterations) {
        for (int i = 0; i < iterations; i = i + 1) {
            if (addTwo) {
                this.counter = this.counter + 2;
            } else {
                this.counter = this.counter + 1;
            }
        }
    }
}
`;

// A non-stateful contract that uses require with a for loop
const FOR_LOOP_REQUIRE_CONTRACT = `
pragma solidcash >=0.8.0;

contract ForLoopRequire() {
    function checkLoop(int n) {
        int total = 0;
        for (int i = 0; i < n; i = i + 1) {
            total = total + 1;
        }
        require(total >= 3);
    }
}
`;

describe('ForLoop', () => {
  describe('state write in for loop', () => {
    const provider = createTestProvider();
    const artifact = compileString(FOR_LOOP_COUNTER_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    let categoryId: string;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, { counter: 0n }, { saltContract: true }));
    });

    it('should compile with stateLayout', () => {
      expect(stateLayout).toBeDefined();
      expect(stateLayout.variables).toHaveLength(1);
      expect(stateLayout.variables[0].name).toBe('counter');
    });

    it('should increment counter by 3 via for loop (iterations=3)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.incrementLoop(3n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(3n);
    });

    it('should increment counter by 1 via for loop (iterations=1)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.incrementLoop(1n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(4n);
    });
  });

  describe('branch inside for loop', () => {
    const provider = createTestProvider();
    const artifact = compileString(FOR_BRANCH_IN_LOOP_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    let categoryId: string;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, { counter: 0n }, { saltContract: true }));
    });

    it('should add 2 per iteration when addTwo=true (3 iterations = +6)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.update(true, 3n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(6n);
    });

    it('should add 1 per iteration when addTwo=false (3 iterations = +3)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.update(false, 3n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(9n);
    });
  });

  describe('non-stateful for loop', () => {
    const provider = createTestProvider();
    const artifact = compileString(FOR_LOOP_REQUIRE_CONTRACT);
    const contract = new Contract(artifact, [], { provider });

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
    });

    it('should succeed when n >= 3', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkLoop(5n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toEqual(expect.arrayContaining([{ to, amount }]));
    });

    it('should fail when n < 3', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkLoop(1n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

});
