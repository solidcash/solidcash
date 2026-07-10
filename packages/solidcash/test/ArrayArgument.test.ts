import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import type { FunctionArgument } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// First-class array arguments: a JS array passed for an array-typed parameter (`uint[]`, `int[]`, `bool[]`,
// `uint[][]`) is encoded as the value-copy array the covenant decodes (length prefix + packed/nested elements).
async function call(src: string, method: string, args: FunctionArgument[]): Promise<void> {
  const provider = createTestProvider();
  const artifact = compileString(src, { experimentalMemoryModel: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const sc = StatefulContract.withCategory(contract, categoryId);
  await sc[method](...args).send();
}

describe('SDK first-class array arguments', () => {
  it('uint[] argument (length + packed elements)', async () => {
    await call(`contract C() {
      int counter;
      function f(uint[] memory a) { require(a.length == 3); require(a[0] == 10); require(a[2] == 30); require(true); }
    }`, 'f', [[10n, 20n, 30n]]);
  });

  it('int[] argument (signed elements)', async () => {
    await call(`contract C() {
      int counter;
      function f(int[] memory a) { require(a[0] == -5); require(a[1] == 7); require(true); }
    }`, 'f', [[-5n, 7n]]);
  });

  it('bool[] argument', async () => {
    await call(`contract C() {
      int counter;
      function f(bool[] memory a) { require(a[0]); require(!a[1]); require(a[2]); require(true); }
    }`, 'f', [[true, false, true]]);
  });

  it('nested uint[][] argument', async () => {
    await call(`contract C() {
      int counter;
      function f(uint[][] memory a) {
        require(a.length == 2);
        require(a[0][0] == 1); require(a[0][1] == 2); require(a[1][0] == 3);
        require(true);
      }
    }`, 'f', [[[1n, 2n], [3n]]]);
  });
});
