import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { setupStatefulUtxos } from '../test-util.js';
import * as measureModule from '../../src/stateful/stb-measure-and-fund-covenant-fee.js';
import * as validateModule from '../../src/stateful/stb-validate-send-fee-caps-and-bytes.js';

/**
 * A send that materializes no batch-predecessor output charges exactly the fee it measured.
 *
 * The phase-2 fee measure runs `_reassertMaterializedBatchPredecessorOutputs` on the measured builder (commit
 * 328e02615) so a transaction that later gains a batch-predecessor output is funded for it. An ordinary stateful
 * send gains none, so its measured shape is the final one: the funder is sized for exactly the measured fee plus
 * change dust, and the transaction pays exactly the measured fee. A regression that mass-materializes a
 * predecessor output or otherwise inflates the funder makes the funder and the charged fee larger than measured,
 * which is what these assertions pin.
 */

const SOURCE = `contract Counter() {
  int count;
  function bump() public {
    this.count = this.count + 1;
    require(true);
  }
}`;

describe('a stateful send that materializes no batch-predecessor output', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('charges the fee the builder measured, and sizes the funder for exactly that fee', async () => {
    const provider = new MockNetworkProvider();
    const artifact = compileString(SOURCE, {});
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, { count: 0n });
    const counter = StatefulContract.withCategory(inner.withCategory(hexToBin(setup.categoryId)), setup.categoryId);

    const measure = vi.spyOn(measureModule, 'measureAndFundCovenantFee');
    const validate = vi.spyOn(validateModule, 'validateSendFeeCapsAndBytes');
    const addUtxo = vi.spyOn(provider, 'addUtxo');

    const details = await counter.call.bump().send();
    expect(details.txid).toMatch(/^[0-9a-f]{64}$/);

    expect(measure.mock.calls).toHaveLength(1);
    expect(validate.mock.calls).toHaveLength(1);
    const measured = await measure.mock.results[0]!.value;
    const charged = validate.mock.results[0]!.value;
    // The final transaction pays exactly the measured fee: the funder was sized from the shape that was sent.
    expect(charged.fee).toBe(measured.neededFee);
    // The only UTXO the send registers is its fee funder, sized for the measured fee plus the change dust and
    // nothing more. A predecessor output materialized past the measurement would inflate this.
    expect(addUtxo.mock.calls).toHaveLength(1);
    expect(addUtxo.mock.calls[0]![1].satoshis).toBe(measured.neededFee + measured.dustMinimum);
  }, 120_000);
});
