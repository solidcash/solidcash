import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// B8: returning entry functions. A function that returns values is spendable standalone (the value is
// computed by the covenant); `.emitReturn()` additionally logs it in a return-event output.
const SOURCE = `
contract Counter() {
    int counter;
    function readCounter() returns (int) { return this.counter; }
    function bump(pubkey pk, sig s) { require(checkSig(s, pk)); this.counter = this.counter + 1; }
}`;

describe('B8: returning entry functions are spendable standalone', () => {
  it('spends a returning function (return value computed, not emitted by default)', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 7n }, { saltContract: true },
    );

    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.readCounter().send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('emits the return value in a return-event output with .emitReturn()', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 9n }, { saltContract: true },
    );

    const sc = StatefulContract.withCategory(contract, categoryId);
    // The covenant verifies the return-event output commitment == the encoded return value, so a
    // successful send proves the value (9) was derived and emitted correctly.
    const tx = await sc.readCounter().emitReturn().send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
