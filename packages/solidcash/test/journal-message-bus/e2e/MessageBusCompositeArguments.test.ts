import { describe, expect, it } from 'vitest';
import { compileString } from '../../direct-compile.js';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract MessageBusCompositeArguments() {
  struct Payload { uint8 kind; bytes note; uint32 timestamp; bytes32[] tags; }
  bigint private count;

  function publish(address target, Payload memory payload) public {
    require(target == address(0));
    require(payload.kind == 4);
    require(payload.note == hex"aabbcc");
    require(payload.timestamp == 1700000000);
    require(payload.tags.length == 4);
    this.count = payload.tags.length;
    require(this.count == 4);
  }

  function check(bigint expected) public view {
    require(this.count == expected);
  }
}`;

describe('message-bus composite argument decoding', () => {
  it('decodes an inline struct after a scalar argument', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      messageBus: true,
      evmCompat: true,
      maximumInputBytes: 10_000_000,
    });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    const contract = StatefulContract.withCategory(inner, categoryId);
    const tags = [0x11, 0x22, 0x33, 0x44].map((byte) => new Uint8Array(32).fill(byte));

    await expect(contract.batch([{
      function: 'publish',
      args: [new Uint8Array(), {
        kind: 4n,
        note: Uint8Array.of(0xaa, 0xbb, 0xcc),
        timestamp: 1_700_000_000n,
        tags,
      }],
    }]).send()).resolves.toBeDefined();
    await expect(contract.getFunction('check')(4n).send()).resolves.toBeDefined();
  }, 180_000);
});
