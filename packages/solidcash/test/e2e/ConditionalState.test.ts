import { compileString } from 'solidc';
import {
  Contract, StatefulContract,
} from '../../src/index.js';
import {
  parsePushdataCommitment,
} from '@solidcash/utils';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

// A stateful contract that writes state in both branches of an if/else:
//   if (flag): counter + 1, label = newLabel
//   else:     counter - 1, label = 0x00000000
const CONDITIONAL_UPDATE_CONTRACT = `
pragma solidcash >=0.8.0;

contract ConditionalUpdate() {
    int counter;
    bytes4 label;

    function update(bool flag, bytes4 newLabel) {
        if (flag) {
            this.counter = this.counter + 1;
            this.label = newLabel;
        } else {
            this.counter = this.counter - 1;
            this.label = 0x00000000;
        }
    }
}
`;

// A stateful contract that only writes state in one branch (the other auto-preserves):
//   if (flag): counter + 1
//   else:      counter = counter (no-op, auto-filled by compiler)
const CONDITIONAL_INCREMENT_CONTRACT = `
pragma solidcash >=0.8.0;

contract ConditionalCounter() {
    int counter;

    function conditionalIncrement(bool flag) {
        if (flag) {
            this.counter = this.counter + 1;
        } else {
            this.counter = this.counter;
        }
    }
}
`;

describe('Conditional State Writes', () => {
  describe('both branches write state', () => {
    const provider = createTestProvider();
    const artifact = compileString(CONDITIONAL_UPDATE_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    const zeroLabel = new Uint8Array(4);
    let categoryId: string;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(
        provider, contract, stateLayout, { counter: 0n, label: zeroLabel }, { saltContract: true },
      ));
    });

    it('should compile with stateLayout', () => {
      expect(stateLayout).toBeDefined();
      expect(stateLayout.variables).toHaveLength(2);
      expect(stateLayout.variables[0].name).toBe('counter');
      expect(stateLayout.variables[1].name).toBe('label');
    });

    it('should increment counter and set label when flag=true', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const newLabel = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

      const tx = await sc.update(true, newLabel)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(1n);
      expect(parsedState.label).toEqual(newLabel);
    });

    it('should decrement counter and zero label when flag=false', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.update(false, new Uint8Array([0xff, 0xff, 0xff, 0xff]))
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(0n);
      expect(parsedState.label).toEqual(zeroLabel);
    });
  });

  describe('single branch writes state (auto-preserve)', () => {
    const provider = createTestProvider();
    const artifact = compileString(CONDITIONAL_INCREMENT_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    let categoryId: string;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, { counter: 5n }, { saltContract: true }));
    });

    it('should have single state variable', () => {
      expect(stateLayout.variables).toHaveLength(1);
      expect(stateLayout.variables[0].name).toBe('counter');
    });

    it('should increment counter when flag=true', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.conditionalIncrement(true)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(6n);
    });

    it('should preserve counter when flag=false', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.conditionalIncrement(false)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(6n);
    });
  });
});
