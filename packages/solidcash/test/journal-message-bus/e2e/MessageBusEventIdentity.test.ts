import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
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
    if (value >= 0) emit A(value);
    require(value >= 0);
  }

  function appendB(bigint key, bigint value) public {
    rows[key].push(Row(value));
    if (value >= 0) emit B(value);
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
    // The route is an envelope, not a semantic event producer. Event identity belongs to the
    // selected handler even when multiple branches reuse the same physical event slot. The emits are
    // conditional: a top-level kernel emit streams and builds no shared event window.
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'appendA')?.emits)
      .toContainEqual(expect.objectContaining({ eventName: 'A' }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'appendB')?.emits)
      .toContainEqual(expect.objectContaining({ eventName: 'B' }));

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 96; index += 1) {
      await provider.addUtxo(signer.getAddress(), randomUtxo({ satoshis: 10_000n }));
    }
    const contract = StatefulContract.withCategory(inner, categoryId).connect(signer);
    const discoverEvents = contract._messageBusEventCommitmentsFromTransaction.bind(contract);
    contract._messageBusEventCommitmentsFromTransaction = (...args) => new Map(
      [...discoverEvents(...args)].map(([index, expectation]) => [index, {
        commitment: expectation.commitment,
      }]),
    );
    // A real equality failure can stop execution after the commitment pin and before the following locking-bytecode
    // pin. The selected handler's unique event schema must recover that missing half of the output identity.
    const call = contract.batch([{ function: 'appendB', args: [1n, 7n] }]);

    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);
});
