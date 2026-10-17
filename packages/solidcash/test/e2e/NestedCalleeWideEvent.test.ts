import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * Cross-contract harness for a NESTED external-call callee that emits events. The callee's own block reserves one
 * event slot plus continuation `eventChunk` slots for a wide emit; the SDK funds the unused chunk slots with
 * pass-through outputs. A payload that fits one commitment settles, while a wide payload needs its chunks learned
 * and materialized inside the callee's block, which is the still-deferred boundary pinned below.
 */
const EMITTER = `pragma solidcash >=0.8.0;
contract Emitter() {
  bigint counter;
  event Narrow(int value);
  event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
  function fireNarrow(int value) public {
    this.counter = this.counter + value;
    emit Narrow(value);
    require(true);
  }
  function fireWide(bytes32 a) public {
    this.counter = this.counter + 1;
    emit Wide(a, a, a, a, a);
    require(true);
  }
}`;

const IE = `interface IE {
  function fireNarrow(int value);
  function fireWide(bytes32 a);
}`;

const CALLER = `pragma solidcash >=0.8.0;
${IE}
contract Caller() {
  address target;
  bigint last;
  function callNarrow(int value) public {
    IE(target).fireNarrow(value);
    require(true);
  }
  function callWide(bytes32 a) public {
    IE(target).fireWide(a);
    require(true);
  }
}`;

const a32 = (fill: number): Uint8Array => {
  const value = new Uint8Array(32);
  value.fill(fill);
  return value;
};

describe('nested external-call callee wide events', () => {
  const provider = createTestProvider();

  const deployEmitter = async (): Promise<{ sc: any; addr: Uint8Array }> => {
    const artifact = compileString(EMITTER);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    return {
      sc: StatefulContract.withCategory(contract, categoryId),
      addr: hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
    };
  };

  const deployCaller = async (emitterAddr: Uint8Array): Promise<any> => {
    const artifact = compileString(CALLER);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { target: emitterAddr, last: 0n }, { saltContract: true },
    );
    return StatefulContract.withCategory(contract, categoryId);
  };

  it('settles a nested callee emit that fits one commitment', async () => {
    const { sc: emitter, addr } = await deployEmitter();
    const caller = await deployCaller(addr);
    await caller.callNarrow(7n).withExternalCall(emitter, 'fireNarrow', [7n]).send();
    expect((await emitter.getState()).counter).toBe(7n);
  });

  it('pins the still-deferred wide nested callee emit', async () => {
    const { sc: emitter, addr } = await deployEmitter();
    const caller = await deployCaller(addr);
    // The callee's Wide emit spans two commitments (5 x 32 bytes = 165 bytes); its continuation chunk is not
    // learned/materialized inside the callee's block, so the callee covenant refuses the spend.
    let message = '';
    try {
      await caller.callWide(a32(0x5a)).withExternalCall(emitter, 'fireWide', [a32(0x5a)]).send();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message.length).toBeGreaterThan(0);
    expect(message).toContain('OP_VERIFY');
  }, 300_000);
});
