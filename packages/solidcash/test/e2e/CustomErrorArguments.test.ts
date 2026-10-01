import { Contract, FailedRequireError, TransactionBuilder } from '../../src/index.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider } from '../test-util.js';
import { randomUtxo } from '../../src/utils.js';

describe('custom-error argument evidence', () => {
  it('exposes the executed argument tuple from an unconditional revert', () => {
    const artifact = compileString(`
      error Requested(uint256 amount);
      contract ErrorArgs() {
        function fail(uint256 amount) {
          if (amount > 0) revert Requested(amount);
          require(amount == 0);
        }
      }
    `);
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const input = randomUtxo({ satoshis: 10_000n });
    const builder = new TransactionBuilder({ provider })
      .addInput(input, contract.unlock.fail(7n))
      .addOutput({ to: contract.address, amount: 9_000n });

    let error: unknown;
    try {
      builder.debug();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(FailedRequireError);
    expect((error as FailedRequireError).requireStatement.message).toBe('revert Requested(...)');
    expect((error as FailedRequireError).errorArgs).toEqual([7n]);
  });
});
