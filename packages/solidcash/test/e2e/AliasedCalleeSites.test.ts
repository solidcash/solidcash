import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * Two calls on different targets each claim their own callee input. Their targets are equal when the spender passes
 * one address twice, and each call's identity check binds its input only to its own target, so both calls accepted
 * one run of that callee: the caller counted two deposits for one.
 */

const SOURCE = `
interface ISink { function put(int x) external; }
contract Sink {
  int last;
  int runs;
  function put(int x) public { this.last = x; this.runs = this.runs + 1; }
}
contract Pair {
  int count;
  function both(address a, address b, int x) public {
    ISink(a).put(x);
    ISink(b).put(x);
    this.count = this.count + 2;
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;

async function sink(provider: Provider, artifact: any): Promise<{ sc: StatefulContract<any>; address: Uint8Array }> {
  const base = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, artifact.stateLayout!, { last: 0n, runs: 0n }, { saltContract: true },
  );
  return {
    sc: StatefulContract.withCategory(base, categoryId),
    address: hexToBin(base.withCategory(hexToBin(categoryId)).lockingBytecode),
  };
}

async function deploy(): Promise<{ provider: Provider; pair: any; one: any; two: any }> {
  const provider = createTestProvider();
  const artifacts = compileStringMulti(SOURCE);
  const one = await sink(provider, artifacts.Sink);
  const two = await sink(provider, artifacts.Sink);
  const base = new Contract(artifacts.Pair, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, artifacts.Pair.stateLayout!, { count: 0n }, { saltContract: true },
  );
  return { provider, pair: StatefulContract.withCategory(base, categoryId), one, two };
}

describe('calls on different targets', () => {
  it('run on two callees, one input each', async () => {
    const { pair, one, two } = await deploy();
    await pair.both(one.address, two.address, 5n)
      .withExternalCall(one.sc, 'put', [5n]).withExternalCall(two.sc, 'put', [5n]).send();
    expect((await pair.getState()).count).toBe(2n);
    expect((await one.sc.getState()).runs).toBe(1n);
    expect((await two.sc.getState()).runs).toBe(1n);
  }, 300_000);

  it('refuse one callee run serving both when the spender passes one address twice', async () => {
    const { pair, one } = await deploy();
    // The SDK lays the one callee's master once and names it for both calls.
    await expect(pair.both(one.address, one.address, 5n)
      .withExternalCall(one.sc, 'put', [5n]).withExternalCall(one.sc, 'put', [5n]).send())
      .rejects.toThrow(/(preflight failed at input 0|VM failed at ip \d+ opcode \d+): Program failed an OP_VERIFY/);
    expect((await pair.getState()).count).toBe(0n);
    expect((await one.sc.getState()).runs).toBe(0n);
  }, 300_000);
});
