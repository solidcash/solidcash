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
