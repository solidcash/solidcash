import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import type { ConnectedStatefulContract } from '../../src/stateful/StatefulContract.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Full-implementation phase 3 (audit L3-5, corpus-5/6 result-dependency graph): the load-bearing edge the
// transcript scaffold was built for - an invocation whose input is a DOWNSTREAM invocation's AUTHENTICATED
// result - expressed with REAL independently-compiled contracts over native transitive external calls.
// Kashi.borrow -> Bento.deposit -> Oracle.price: Oracle returns an authenticated price, Bento consumes it
// into its base and returns it, Kashi consumes THAT into collateral. Each level's result is bound to the
// co-spent callee's real computation (return-event NFT), so no wrong intermediate result can be injected.
const IORACLE = 'interface IOracle { public int rate; function price(int x) returns (int); }';
const IBENTO = 'interface IBento { public int base; function deposit(int x) returns (int); }';

const ORACLE = `pragma solidcash >=0.8.0;
${IORACLE}
contract Oracle() is IOracle {
  int rate;
  function price(int x) returns (int) {
    require(x <= 100);
    return x * this.rate;
  }
}`;

const BENTO = `pragma solidcash >=0.8.0;
${IORACLE}
${IBENTO}
contract Bento(bytes oracleAddr) is IBento {
  int base;
  function deposit(int x) returns (int) {
    int p = IOracle(oracleAddr).price(x);
    this.base = this.base + p;
    return p;
  }
}`;

const KASHI = `pragma solidcash >=0.8.0;
${IBENTO}
contract Kashi(bytes bentoAddr) {
  int collateral;
  function borrow(int x) {
    int share = IBento(bentoAddr).deposit(x);
    this.collateral = this.collateral + share;
  }
}`;

async function setupChain(): Promise<{
  scKashi: ConnectedStatefulContract; scBento: ConnectedStatefulContract; scOracle: ConnectedStatefulContract;
}> {
  const provider = createTestProvider();
  const artOracle = compileString(ORACLE);
  const artBento = compileString(BENTO);
  const artKashi = compileString(KASHI);
  const oracle = new Contract(artOracle, [], { provider });
  const { categoryId: catOracle } = await setupStatefulUtxos(
    provider, oracle, artOracle.stateLayout!, { rate: 2n }, { saltContract: true },
  );
  const bento = new Contract(artBento, [oracle.withCategory(hexToBin(catOracle)).lockingBytecode], { provider });
  const { categoryId: catBento } = await setupStatefulUtxos(
    provider, bento, artBento.stateLayout!, { base: 0n }, { saltContract: true },
  );
  const kashi = new Contract(artKashi, [bento.withCategory(hexToBin(catBento)).lockingBytecode], { provider });
  const { categoryId: catKashi } = await setupStatefulUtxos(
    provider, kashi, artKashi.stateLayout!, { collateral: 0n }, { saltContract: true },
  );
  const scOracle = StatefulContract.withCategory(oracle, catOracle);
  const scBento = StatefulContract.withCategory(bento, catBento, { externals: { IOracle: scOracle } });
  const scKashi = StatefulContract.withCategory(kashi, catKashi, { externals: { IBento: scBento } });
  return { scKashi, scBento, scOracle };
}

describe('layer-3 real result-dependency chain (Kashi -> Bento -> Oracle, transitive authenticated results)', () => {
  it('POSITIVE: each level consumes the level below authenticated result, all real contracts', async () => {
    const { scKashi, scBento, scOracle } = await setupChain();
    // borrow(5): Oracle.price(5) = 5*2 = 10; Bento base 0->10, returns 10; Kashi collateral 0->10.
    const tx = await scKashi.borrow(5n).send();
    expect(tx).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      hex: expect.stringMatching(/.+/),
    });
    expect((await scOracle.getState()).rate).toBe(2n); // unchanged
    expect((await scBento.getState()).base).toBe(10n); // consumed Oracle's authenticated price
    expect((await scKashi.getState()).collateral).toBe(10n); // consumed Bento's authenticated result
  });

  /**
   * X144. `.send()` is the STATEFUL SUBMIT PATH, and the finalized-byte gate now runs there - necessarily
   * BEFORE the covenant, because covenant evaluation happens inside the provider. A bare `rejects.toThrow()`
   * here would report that gate's refusal, or an SDK build error, or a fee-check refusal, as if it were the
   * deep callee's guard. Censused: today it is a VM refusal, and it now has to stay one.
   *
   * Guard negative control: the same chain differing only in the borrowed amount settles.
   */
  it('HOSTILE: a guard failure at the DEEPEST callee reverts the whole transitive settlement', async () => {
    const { scKashi } = await setupChain();
    // borrow(200): Oracle.price(200) trips its own require(x <= 100), aborting the entire Kashi->Bento->Oracle tx.
    await expect(scKashi.borrow(200n).send()).rejects.toThrow(
      /layer3: BCH-2026 preflight failed at input 5: Program failed an OP_VERIFY operation\./,
    );
    await expect(scKashi.borrow(5n).send()).resolves.toBeDefined();
  });
});
