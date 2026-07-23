import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Function pointers stored in a state mapping (a dispatch table / router). The contract registers a
// handler (storing its functionId in an entry NFT) and later reads it back to dispatch. The SDK
// derives the new state from the VM trace (functionId is an int on the wire), so no JS-side
// function-pointer encoding is needed for the contract-managed path.
const ROUTER = `
pragma solidcash >=0.8.0;

contract Router() {
    int counter;
    mapping(bytes4 => function(int) returns (int)) routes;

    function double(int x) internal returns (int) { return x * 2; }
    function triple(int x) internal returns (int) { return x * 3; }

    function register(bytes4 sel, bool useTriple) {
        if (useTriple) { this.routes[sel] = triple; } else { this.routes[sel] = double; }
        this.counter = this.counter + 1;
    }

    function invoke(bytes4 sel, int v, int expected) {
        function(int) returns (int) h = this.routes[sel];
        require(h(v) == expected);
    }
}
`;

describe('function pointers in state (dispatch table)', () => {
  const artifact = compileString(ROUTER);
  const stateLayout = artifact.stateLayout!;

  it('registers a handler then dispatches it through the state mapping', async () => {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, stateLayout, { counter: 0n }, { saltContract: true },
    );

    const sel = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);

    // Register `double` for the selector (stored as its functionId in an entry NFT).
    const sc1 = StatefulContract.withCategory(contract, categoryId);
    const regTx = await sc1.register(sel, false).send();
    expect(regTx.txid).toBeDefined();

    // Read the handler back and dispatch it: double(21) == 42.
    const sc2 = StatefulContract.withCategory(contract, categoryId);
    const invTx = await sc2.invoke(sel, 21n, 42n).send();
    expect(invTx.txid).toBeDefined();
  });

  it('dispatches the alternate handler (triple) after registering it', async () => {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, stateLayout, { counter: 0n }, { saltContract: true },
    );

    const sel = Uint8Array.from([0x00, 0x11, 0x22, 0x33]);

    const sc1 = StatefulContract.withCategory(contract, categoryId);
    await sc1.register(sel, true).send();

    const sc2 = StatefulContract.withCategory(contract, categoryId);
    const invTx = await sc2.invoke(sel, 21n, 63n).send();
    expect(invTx.txid).toBeDefined();
  });

  // Two distinct selectors in ONE C2 list: the second register is an INSERT into a non-empty sorted list (co-spends
  // the first entry or HEAD as predecessor). Each dispatches its own handler - proves the C2 fn-ptr path grows the
  // list, not just the empty-list genesis. (The fn-ptr value is an int functionId; exclusion-proof reads per C2.)
  it('holds two distinct handlers in the sorted list and dispatches each', async () => {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, stateLayout, { counter: 0n }, { saltContract: true },
    );
    const selD = Uint8Array.from([0xaa, 0xbb, 0xcc, 0xdd]); // -> double
    const selT = Uint8Array.from([0x11, 0x22, 0x33, 0x44]); // -> triple

    await StatefulContract.withCategory(contract, categoryId).register(selD, false).send();
    await StatefulContract.withCategory(contract, categoryId).register(selT, true).send();

    expect((await StatefulContract.withCategory(contract, categoryId).invoke(selD, 21n, 42n).send()).txid).toBeDefined();
    expect((await StatefulContract.withCategory(contract, categoryId).invoke(selT, 21n, 63n).send()).txid).toBeDefined();
  });

  // An EXTERNAL self-ref pointer (`this.f`) routes to the internal OP_INVOKE dispatch (the only external-pointer
  // VALUE that exists), so its runtime representation is a functionId - identical to an internal pointer. A
  // scalar `function(..) external` state var therefore round-trips like the internal case above.
  const EXT_ROUTER = `
    pragma solidcash >=0.8.0;
    contract ExtRouter() {
        int counter;
        function(int) external returns (int) handler;
        function double(int x) external returns (int) { return x * 2; }
        function register() { this.handler = this.double; this.counter = this.counter + 1; }
        function invoke(int v, int expected) {
            function(int) external returns (int) h = this.handler;
            require(h(v) == expected);
        }
    }
  `;

  it('round-trips a scalar EXTERNAL self-ref function-pointer state var (this.f) on the VM', async () => {
    const artifact2 = compileString(EXT_ROUTER);
    const provider = createTestProvider();
    const contract = new Contract(artifact2, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact2.stateLayout!, { counter: 0n }, { saltContract: true },
    );

    // Store `this.double`'s functionId in state, then read it back in a later tx and dispatch: double(21) == 42.
    const sc1 = StatefulContract.withCategory(contract, categoryId);
    await sc1.register().send();
    const sc2 = StatefulContract.withCategory(contract, categoryId);
    const invTx = await sc2.invoke(21n, 42n).send();
    expect(invTx.txid).toBeDefined();
  });

  it('rejects function-pointer state in a contract that can rewrite its own code', () => {
    const bad = `
      contract Bad() {
        int counter;
        mapping(bytes4 => function(int) returns (int)) routes;
        function double(int x) internal returns (int) { return x * 2; }
        function evolve() upgrade { this.counter = this.counter + 1; }
      }
    `;
    expect(() => compileString(bad)).toThrow(/functionIds would remap/i);
  });
});
