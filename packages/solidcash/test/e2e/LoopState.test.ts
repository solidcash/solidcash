import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract,
  getDataNftAddress,
} from '../../src/index.js';
import {
  buildInitialStateCommitments, parsePushdataCommitment,
} from '@solidcash/utils';
import { createTestProvider, getTxOutputs } from '../test-util.js';

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
    const categoryId = 'e1cd'.repeat(16);
    const saltedContract = contract.withSalt(hexToBin(categoryId));
    const dataNftAddress = getDataNftAddress(saltedContract, categoryId);
    const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

    const masterUtxo = {
      txid: 'f1cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'minting' as const, commitment: '' },
      },
    };

    const dataNftUtxo = {
      txid: 'f1cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'mutable' as const, commitment: initialCommitments[0] },
      },
    };

    beforeAll(async () => {
      await provider.addUtxo(saltedContract.tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);
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
    const categoryId = 'e2cd'.repeat(16);
    const saltedContract = contract.withSalt(hexToBin(categoryId));
    const dataNftAddress = getDataNftAddress(saltedContract, categoryId);
    const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

    const masterUtxo = {
      txid: 'f2cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'minting' as const, commitment: '' },
      },
    };

    const dataNftUtxo = {
      txid: 'f2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'mutable' as const, commitment: initialCommitments[0] },
      },
    };

    beforeAll(async () => {
      await provider.addUtxo(saltedContract.tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);
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
