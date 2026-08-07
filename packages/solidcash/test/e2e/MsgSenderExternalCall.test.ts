import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
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

  it('co-spends the msg.sender contract and runs its method (counter 0 -> 1)', async () => {
    const { scCaller, scCallee } = await setup();

    const tx = await scCaller.callBack().withExternalCall(scCallee, 'ping', []).send();
    expect(tx.txid).toBeDefined();

    expect((await scCallee.getState()).counter).toBe(1n);
    expect((await scCaller.getState()).calls).toBe(1n);
  });
});
