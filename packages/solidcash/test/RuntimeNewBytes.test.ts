import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// Runtime `new bytes(n)` (dynamic length): n zero bytes via `0 n OP_NUM2BIN`. The require()s are VM gates -
// a successful send proves the allocation length and its use as a bytes.concat building block (the memory
// model's malloc growth primitive) both hold at runtime.
const SOURCE = `
contract C() {
    int counter;
    function check(int n) {
        require(n >= 0);
        bytes memory b = new bytes(n);
        require(b.length == n);
        bytes memory grown = bytes.concat(b, bytes32(0));
        require(grown.length == n + 32);
        this.counter = n;
    }
}`;

describe('runtime new bytes(n)', () => {
  it('allocates a dynamic-length zero buffer and composes with bytes.concat', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { solidityImportCompat: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );

    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.check(5n).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
