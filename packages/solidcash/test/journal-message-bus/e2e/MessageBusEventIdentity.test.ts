import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, Signer, StatefulContract } from '../../../src/index.js';
import { randomUtxo } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';
import { alicePriv } from '../../fixture/vars.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract EventIdentity() {
  struct Row { bigint value; }
  mapping(bigint => Row[]) rows;
  event A(bigint value);
  event B(bigint value);

  function appendA(bigint key, bigint value) public {
    rows[key].push(Row(value));
    emit A(value);
    require(value >= 0);
  }

  function appendB(bigint key, bigint value) public {
    rows[key].push(Row(value));
    emit B(value);
    require(value >= 0);
  }
}`;

describe('message-bus runtime event identity', () => {
  it('binds the selected event covenant when route branches share one emit slot', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    expect(artifact.messageBus?.route.emits?.[0]?.eventName).toBe('A');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'appendB')?.emits)
      .toContainEqual(expect.objectContaining({ eventName: 'B' }));

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 96; index += 1) {
      await provider.addUtxo(signer.getAddress(), randomUtxo({ satoshis: 10_000n }));
    }
    const contract = StatefulContract.withCategory(inner, categoryId).connect(signer);
    const call = contract.batch([{ function: 'appendB', args: [1n, 7n] }]);

    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);
});
