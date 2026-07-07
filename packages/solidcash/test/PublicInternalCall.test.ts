import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, setupStatefulUtxos, verifyTransaction } from './test-util.js';

// VM-verify that a PUBLIC function called INTERNALLY (bare f(), not this.f()) with a used return value runs
// correctly. Previously the internal-call subroutine skipped the synthetic __internal__returnOutputIdx param
// during setup but the caller still pushed it, so it leaked onto the stack and the covenant ended with an
// unexpected stack depth. Each case's require only holds if the returned value is correct AND the stack is clean.
const CASES: Record<string, string> = {
  'single-return': `contract C() {
    function pick(int a) public pure returns (int) { return a + 100; }
    function check() { require(pick(5) == 105); }
  }`,
  'chained-calls': `contract C() {
    function inc(int a) public pure returns (int) { return a + 1; }
    function check() { require(inc(inc(inc(5))) == 8); }
  }`,
  'multi-return': `contract C() {
    function split(int a) public pure returns (int, int) { return (a, a + 1); }
    function check() { int x; int y; (x, y) = split(5); require(x == 5); require(y == 6); }
  }`,
};

describe('public function called internally with a return value (VM-verified)', () => {
  for (const [name, src] of Object.entries(CASES)) {
    it(`runs a public function called internally: ${name}`, async () => {
      const provider = createTestProvider();
      const contract = new Contract(compileString(src), [], { provider });
      const utxo = randomUtxo();
      await provider.addUtxo(contract.address, utxo);
      const tx = new TransactionBuilder({ provider })
        .addInput(utxo, contract.unlock.check())
        .addOutput({ to: contract.address, amount: 10000n });
      expect(() => verifyTransaction(tx)).not.toThrow();
    });
  }

  // A VOID public helper called internally from a state-writing entry, in a STATEFUL contract. Needs a real
  // state NFT (setupStatefulUtxos) - a plain UTXO would fail the state-preservation covenant regardless of the
  // internal call. Confirms the void-public-internal-call path is sound once the state NFT is present.
  it('runs a void public helper called internally in a stateful contract', async () => {
    const provider = createTestProvider();
    const artifact = compileString('contract C() { int s;'
      + ' function bump(int a) public { require(a > 0); }'
      + ' function set(int v) { bump(v); this.s = v; } }');
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { s: 3n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.set(7n).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
