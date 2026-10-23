import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../src/index.js';
import { StatefulContract } from '../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

describe('stateful late-materialization fees', () => {
  it('funds a runtime scalar journal carrier after late materialization', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract RuntimeScalarFee() {
      mapping(int => int) values;
      function seed(int key, int value) public {
        this.values[key] = value;
        require(true);
      }
      function update(int count) public {
        for (int i = 0; i < count; i = i + 1) {
          this.values[i] = this.values[i] + 1;
        }
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(0n, 10n).send();

    await expect(contract.batch([{ function: 'update', args: [2n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);
});
