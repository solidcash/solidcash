import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import type { ConnectedStatefulContract } from '../../src/stateful/StatefulContract.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Full-implementation phase 1 (audit L3-4/L3-6): a REAL heterogeneous settlement between two INDEPENDENTLY
// COMPILED application contracts - not a homogeneous generated scaffold. Kashi.borrow calls Bento.deposit
// via native IContract(addr).method(); Bento runs the real Rebase (shareOut = amount*base/elastic), returns
// it through the authenticated return-event NFT, and Kashi consumes it into its own collateral. Each
// contract's state is its OWN self-pinned master (not a P2PKH fixture), so the callee's state covenant stays
// authoritative. This is the smallest real caller/callee settlement the audit asked to prove.
const IBENTO = `interface IBento { function deposit(int amount) returns (int); }`;

const BENTO = `pragma solidcash >=0.8.0;
${IBENTO}
contract Bento() is IBento {
  int elastic;
  int base;
  function deposit(int amount) returns (int) {
    int shareOut = amount;
    if (this.elastic != 0) { shareOut = amount * this.base / this.elastic; }
    this.elastic = this.elastic + amount;
    this.base = this.base + shareOut;
    return shareOut;
  }
}`;

const KASHI = `pragma solidcash >=0.8.0;
${IBENTO}
contract Kashi(bytes bentoAddr) {
  int collateral;
  function borrow(int amount) {
    int shareOut = IBento(bentoAddr).deposit(amount);
    this.collateral = this.collateral + shareOut;
  }
}`;

async function setup(
  bento: Record<string, bigint>,
): Promise<{ scKashi: ConnectedStatefulContract; scBento: ConnectedStatefulContract }> {
  const provider = createTestProvider();
  const artBento = compileString(BENTO);
  const artKashi = compileString(KASHI);
  // Genesis Bento first; Kashi embeds Bento's self-pinned address.
  const contractBento = new Contract(artBento, [], { provider });
  const { categoryId: catBento } = await setupStatefulUtxos(
    provider, contractBento, artBento.stateLayout!, bento, { saltContract: true },
  );
  const bentoAddr = contractBento.withCategory(hexToBin(catBento)).lockingBytecode;
  const contractKashi = new Contract(artKashi, [bentoAddr], { provider });
  const { categoryId: catKashi } = await setupStatefulUtxos(
    provider, contractKashi, artKashi.stateLayout!, { collateral: 0n }, { saltContract: true },
  );
  return {
    scKashi: StatefulContract.withCategory(contractKashi, catKashi),
    scBento: StatefulContract.withCategory(contractBento, catBento),
  };
}

describe('layer-3 real heterogeneous composition (Kashi <- Bento, two compiled contracts)', () => {
  it('settles a real Rebase across two contracts: Bento returns shareOut, Kashi consumes it into collateral', async () => {
    const { scKashi, scBento } = await setup({ elastic: 10n, base: 8n });
    // borrow(5): shareOut = 5*8/10 = 4. Bento -> elastic 15, base 12. Kashi -> collateral 4.
    const tx = await scKashi.borrow(5n).withExternalCall(scBento, 'deposit', [5n]).send();
    expect(tx.txid).toBeDefined();

    const bentoState = await scBento.getState();
    expect(bentoState.elastic).toBe(15n);
    expect(bentoState.base).toBe(12n);
    expect((await scKashi.getState()).collateral).toBe(4n); // authenticated shareOut consumed
  });

  it('handles the min-share init branch (elastic == 0 => shareOut = amount, 1:1)', async () => {
    const { scKashi, scBento } = await setup({ elastic: 0n, base: 0n });
    // borrow(9): elastic==0 => shareOut = 9. Bento -> elastic 9, base 9. Kashi -> collateral 9.
    const tx = await scKashi.borrow(9n).withExternalCall(scBento, 'deposit', [9n]).send();
    expect(tx.txid).toBeDefined();
    expect((await scBento.getState()).base).toBe(9n);
    expect((await scKashi.getState()).collateral).toBe(9n);
  });
});
