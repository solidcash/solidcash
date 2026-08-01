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
const IBENTO = 'interface IBento { function deposit(int amount) returns (int); }';

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

// 3-owner graph: Kashi settles against BOTH Bento (share) and a Token (balance) in one atomic borrow.
const ITOKEN = 'interface IToken { function debit(int amount) returns (int); }';
const TOKEN = `pragma solidcash >=0.8.0;
${ITOKEN}
contract Token() is IToken {
  int balance;
  function debit(int amount) returns (int) {
    require(this.balance >= amount);
    this.balance = this.balance - amount;
    return amount;
  }
}`;
const KASHI3 = `pragma solidcash >=0.8.0;
${IBENTO}
${ITOKEN}
contract Kashi3(bytes bentoAddr, bytes tokenAddr) {
  int collateral;
  function borrow(int amount) {
    int shareOut = IBento(bentoAddr).deposit(amount);
    IToken(tokenAddr).debit(amount);
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

async function setup3(
  bentoState: Record<string, bigint>, tokenState: Record<string, bigint>,
): Promise<{ scKashi: ConnectedStatefulContract; scBento: ConnectedStatefulContract; scToken: ConnectedStatefulContract }> {
  const provider = createTestProvider();
  const artBento = compileString(BENTO);
  const artToken = compileString(TOKEN);
  const artKashi = compileString(KASHI3);
  const bento = new Contract(artBento, [], { provider });
  const { categoryId: catBento } = await setupStatefulUtxos(
    provider, bento, artBento.stateLayout!, bentoState, { saltContract: true },
  );
  const token = new Contract(artToken, [], { provider });
  const { categoryId: catToken } = await setupStatefulUtxos(
    provider, token, artToken.stateLayout!, tokenState, { saltContract: true },
  );
  const bentoAddr = bento.withCategory(hexToBin(catBento)).lockingBytecode;
  const tokenAddr = token.withCategory(hexToBin(catToken)).lockingBytecode;
  const kashi = new Contract(artKashi, [bentoAddr, tokenAddr], { provider });
  const { categoryId: catKashi } = await setupStatefulUtxos(
    provider, kashi, artKashi.stateLayout!, { collateral: 0n }, { saltContract: true },
  );
  return {
    scKashi: StatefulContract.withCategory(kashi, catKashi),
    scBento: StatefulContract.withCategory(bento, catBento),
    scToken: StatefulContract.withCategory(token, catToken),
  };
}

describe('layer-3 real heterogeneous composition (Kashi <- Bento, two compiled contracts)', () => {
  it('settles a real Rebase across two contracts: Bento returns shareOut, Kashi consumes it into collateral', async () => {
    const { scKashi, scBento } = await setup({ elastic: 10n, base: 8n });
    // borrow(5): shareOut = 5*8/10 = 4. Bento -> elastic 15, base 12. Kashi -> collateral 4.
    const tx = await scKashi.borrow(5n).withExternalCall(scBento, 'deposit', [5n]).send();
    expect(tx).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      hex: expect.stringMatching(/.+/),
    });

    const bentoState = await scBento.getState();
    expect(bentoState.elastic).toBe(15n);
    expect(bentoState.base).toBe(12n);
    expect((await scKashi.getState()).collateral).toBe(4n); // authenticated shareOut consumed
  });

  it('handles the min-share init branch (elastic == 0 => shareOut = amount, 1:1)', async () => {
    const { scKashi, scBento } = await setup({ elastic: 0n, base: 0n });
    // borrow(9): elastic==0 => shareOut = 9. Bento -> elastic 9, base 9. Kashi -> collateral 9.
    const tx = await scKashi.borrow(9n).withExternalCall(scBento, 'deposit', [9n]).send();
    expect(tx).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      hex: expect.stringMatching(/.+/),
    });
    expect((await scBento.getState()).base).toBe(9n);
    expect((await scKashi.getState()).collateral).toBe(9n);
  });

  it('settles a 3-owner graph atomically: Kashi <- Bento (share) + Token (balance), all real contracts', async () => {
    const { scKashi, scBento, scToken } = await setup3({ elastic: 10n, base: 8n }, { balance: 100n });
    // borrow(5): Bento share=4 (elastic 15, base 12); Token balance 100->95; Kashi collateral 0->4.
    const tx = await scKashi.borrow(5n)
      .withExternalCall(scBento, 'deposit', [5n])
      .withExternalCall(scToken, 'debit', [5n])
      .send();
    expect(tx).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      hex: expect.stringMatching(/.+/),
    });
    expect((await scBento.getState()).base).toBe(12n);
    expect((await scToken.getState()).balance).toBe(95n);
    expect((await scKashi.getState()).collateral).toBe(4n);
  });

  /**
   * X144. `.send()` is the STATEFUL SUBMIT PATH, where the finalized-byte gate runs BEFORE the covenant - the
   * covenant only speaks once the provider has the bytes. A bare `rejects.toThrow()` here would report that
   * gate, a fee-check refusal or an SDK build error as if it were the callee's own guard, which is exactly how
   * a forgery test stops measuring its forgery. Censused: this is a VM refusal at input 5, and it stays one.
   *
   * Guard negative control: the same 3-owner composition, differing only in the attacked balance, settles.
   */
  it('HOSTILE: the callee covenant stays authoritative - an over-debit (balance < amount) reverts the whole settlement', async () => {
    // Token balance 3 < borrow 5: Token.debit's own require(balance >= amount) fails, aborting the atomic tx.
    const { scKashi, scBento, scToken } = await setup3({ elastic: 10n, base: 8n }, { balance: 3n });
    await expect(scKashi.borrow(5n)
      .withExternalCall(scBento, 'deposit', [5n])
      .withExternalCall(scToken, 'debit', [5n])
      .send()).rejects.toThrow(
        /layer3: BCH-2026 preflight failed at input 5: Program failed an OP_VERIFY operation\./,
      );
    const honest = await setup3({ elastic: 10n, base: 8n }, { balance: 100n });
    await expect(honest.scKashi.borrow(5n)
      .withExternalCall(honest.scBento, 'deposit', [5n])
      .withExternalCall(honest.scToken, 'debit', [5n])
      .send()).resolves.toBeDefined();
  });
});
