import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import type { ConnectedStatefulContract } from '../../src/stateful/StatefulContract.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Typed external call whose target is msg.sender: `IFoo(msg.sender).ping()`. The callee is the tx-derived
// msg.sender input (not a baked address / param), so the caller embeds no callee address. The SDK co-spends the
// caller-designated msg.sender contract and auto-fills _msgSenderCategory with its category, so the covenant's
// emitMsgSender resolves to that co-spent input and the callee-identity check passes. VM-verifies the callee's
// method actually runs (its state updates) when co-spent as msg.sender.
const IFOO = `
interface IFoo {
    public int counter;
    function ping();
}
`;

const CALLEE = `
pragma solidcash >=0.8.0;
${IFOO}
contract Callee() is IFoo {
    int counter;
    function ping() {
        this.counter = this.counter + 1;
    }
}
`;

const CALLER = `
pragma solidcash >=0.8.0;
${IFOO}
contract Caller() {
    int calls;
    function callBack() {
        IFoo(msg.sender).ping();
        this.calls = this.calls + 1;
    }
}
`;

describe('external call targeting msg.sender (IFoo(msg.sender).method())', () => {
  async function setup(): Promise<{ scCaller: ConnectedStatefulContract; scCallee: ConnectedStatefulContract }> {
    const provider = createTestProvider();
    const artCaller = compileString(CALLER);
    const artCallee = compileString(CALLEE);

    const callee = new Contract(artCallee, [], { provider });
    const { categoryId: catCallee } = await setupStatefulUtxos(
      provider, callee, artCallee.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const caller = new Contract(artCaller, [], { provider });
    const { categoryId: catCaller } = await setupStatefulUtxos(
      provider, caller, artCaller.stateLayout!, { calls: 0n }, { saltContract: true },
    );

    return {
      scCaller: StatefulContract.withCategory(caller, catCaller),
      scCallee: StatefulContract.withCategory(callee, catCallee),
    };
  }

  // F1 (caller-attested call edges): `IFoo(msg.sender).ping()` trusts msg.sender as a contract caller. A top-level
  // call simply DESIGNATES a co-spent contract as msg.sender; nothing proves that contract called callBack. That
  // designation is the presence-forgery F1 closes: callBack resolves a contract msg.sender, so it requires a
  // co-spent caller-category edge committing to its own run, which the designated (non-calling) scCallee does not
  // provide. The covenant refuses it. The SOUND form of this convention - a genuine caller that attested calling
  // callBack (an own-category edge), then callBack calling back - still settles; only the unattested top-level
  // designation is refused.
  it('refuses a designated msg.sender that never attested calling back (presence-forgery closed)', async () => {
    const { scCaller, scCallee } = await setup();

    await expect(scCaller.callBack().withExternalCall(scCallee, 'ping', []).send()).rejects.toThrow(
      /preflight failed|OP_VERIFY|OP_EQUALVERIFY|mandatory-script-verify|VM failed/i,
    );

    expect((await scCallee.getState()).counter).toBe(0n);
    expect((await scCaller.getState()).calls).toBe(0n);
  });
});
