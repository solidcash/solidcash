import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { StatefulContract, MockNetworkProvider } from '../../src/index.js';

// ethers view semantics: awaiting a pure single-output view function (writesState:false, no send-intent config)
// READS the decoded return value; awaiting a state-writer still SENDS. .send()/.staticCall() are explicit escapes.
const SRC = `pragma solidcash >=0.8.0;
contract M() {
  struct Job { bigint id; bigint pay; }
  mapping(bigint => Job) jobs;
  bigint n;
  function put(bigint k, bigint id, bigint pay) { this.jobs[k] = Job(id, pay); this.n = this.n + 1; }
  function getJob(bigint k) view returns (Job) { return this.jobs[k]; }
  function count() view returns (bigint) { return this.n; }
}`;

describe('auto-read view dispatch (ethers verbatim getX() semantics)', () => {
  it('await view reads the value; await writer sends; .send() forces a send', async () => {
    const art = compileString(SRC, { forceStateful: true });
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1);
    const f = (await alice.getUtxos()).find((u) => u.vout === 0 && !u.token);
    const res = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
    });
    const sc = res.contract.connect(alice) as unknown as {
      put: (k: bigint, id: bigint, pay: bigint) => Promise<{ txid: string }> & { send: () => Promise<{ txid: string }> };
      getJob: (k: bigint) => Promise<{ pay: bigint; toObject: () => unknown }>;
      count: () => Promise<bigint> & { send: () => Promise<{ txid: string }> };
    };

    // a state-writer: awaiting SENDS (resolves to a tx with a txid).
    const tx = await sc.put(7n, 100n, 250n);
    expect(tx.txid).toBeDefined();

    // a pure view with args: awaiting READS the value directly (no .staticCall needed).
    const job = await sc.getJob(7n);
    expect(job.pay).toBe(250n);
    expect(job.toObject()).toEqual({ id: 100n, pay: 250n });

    // a pure scalar view: awaiting reads.
    expect(await sc.count()).toBe(1n);

    // .send() still forces a send even on a view (explicit escape).
    const vtx = await sc.count().send();
    expect(vtx.txid).toBeDefined();
  });
});
