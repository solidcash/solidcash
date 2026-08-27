import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  MOCK_CONSENSUS_LIMITS,
  MOCK_RELAXED_OPERATION_COST,
  MockNetworkProvider,
  TransactionBuilder,
  randomUtxo,
} from '../../src/index.js';

describe('deep dynamic-bytes accumulator', () => {
  it('preserves an accumulator below loop-local stack values', async () => {
    const artifact = compileString(`
      contract DeepBytesAccumulator {
        function verify(bytes supplied) public {
          bytes expected = hex"";
          bigint a0 = 0; bigint a1 = 1; bigint a2 = 2; bigint a3 = 3;
          bigint a4 = 4; bigint a5 = 5; bigint a6 = 6; bigint a7 = 7;
          bigint a8 = 8; bigint a9 = 9; bigint a10 = 10; bigint a11 = 11;
          bigint a12 = 12; bigint a13 = 13; bigint a14 = 14; bigint a15 = 15;
          bigint a16 = 16; bigint a17 = 17; bigint a18 = 18; bigint a19 = 19;
          for (bigint cursor = 0; cursor < supplied.length; cursor = cursor + 81) {
            bigint end = min(cursor + 81, supplied.length);
            expected = bytes.concat(expected, supplied.slice(cursor, end));
          }
          require(a0 + a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9
            + a10 + a11 + a12 + a13 + a14 + a15 + a16 + a17 + a18 + a19 == 190);
          require(expected == supplied);
        }
      }
    `);
    const provider = new MockNetworkProvider({
      consensusLimits: {
        ...MOCK_CONSENSUS_LIMITS,
        operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST,
        maximumInputBytes: 10_000_000,
        maximumStackItemBytes: 10_000_000,
      },
    });
    const contract = new Contract(artifact, [], { provider });
    const utxo = randomUtxo({ satoshis: 100_000n });
    await provider.addUtxo(contract.address, utxo);
    const supplied = Uint8Array.from({ length: 7 * 81 }, (_, index) => index % 251);

    await expect(new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.verify(supplied))
      .addOutput({ to: contract.address, amount: 90_000n })
      .send()).resolves.toBeDefined();
  });
});
