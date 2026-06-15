import { compileString } from 'solidc';
import {
  Contract, StatefulContract,
} from '../../src/index.js';
import {
  parsePushdataCommitment,
} from '@solidcash/utils';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

// A stateful contract that increments counter in a do-while loop
const LOOP_COUNTER_CONTRACT = `
pragma solidcash >=0.8.0;

contract LoopCounter() {
    int counter;

    function incrementLoop(int iterations) {
        int i = 0;
        do {
            this.counter = this.counter + 1;
            i = i + 1;
        } while (i < iterations);
    }
}
`;

// A stateful contract with a branch inside a do-while loop
const BRANCH_IN_LOOP_CONTRACT = `
pragma solidcash >=0.8.0;

contract BranchInLoop() {
    int counter;

    function update(bool addTwo, int iterations) {
        int i = 0;
        do {
            if (addTwo) {
                this.counter = this.counter + 2;
            } else {
                this.counter = this.counter + 1;
            }
            i = i + 1;
        } while (i < iterations);
    }
}
`;

describe('Loop State Writes', () => {
  describe('state write in do-while loop', () => {
    const provider = createTestProvider();
    const artifact = compileString(LOOP_COUNTER_CONTRACT);
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

    it('should increment counter by 3 via loop (iterations=3)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.incrementLoop(3n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(3n);
    });

    it('should increment counter by 1 via loop (iterations=1)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.incrementLoop(1n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(4n);
    });
  });

  describe('branch inside do-while loop', () => {
    const provider = createTestProvider();
    const artifact = compileString(BRANCH_IN_LOOP_CONTRACT);
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
});
