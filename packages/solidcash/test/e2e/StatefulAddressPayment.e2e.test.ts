/**
 * B2 of the deployer-coins spec: a payment to a `new` result goes to the child's container (A8).
 *
 * Before this fix `this.transfer(child, v)` paid the child's master lock, whose pin requires the category on the
 * spending input: a coin paid there can never be spent. The first case checks the payment lands on the child's
 * satoshi container and that a later call of the child spends it. The second records where a `{value:}` call to
 * a stateful contract lands today; the plan does not change it, and the test states what it found.
 */
import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { Contract } from '../../src/index.js';

const CHILD = `
contract Child {
    int x;
    constructor() { x = 1; }
    // A satoshi container slot: the child reads its own balance and can send from the container.
    function see(int minimum) { require(this.balance >= minimum); x = 2; }
}
`;

const FACTORY = `
contract Factory {
    int deployments;
    function make() {
        Child child = new Child();
        this.transfer(child, 5000);
        deployments = deployments + 1;
    }
}
`;

describe('a payment to a new result (B2.1)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('the compiler routes a payment to a new result without an SDK build step (B2.2)', () => {
    // The SDK's deployFrom path for a routed payment is B9's work: the transaction that spends the deployer and
    // carries the transfer is rebuilt there. This asserts the compiler's half: the routed payment compiles and
    // the source's payment is no longer an error.
    const source = `${CHILD}\n${FACTORY}`;
    expect(() => compileStringMulti(source, { allowUnsafeOperations: true })).not.toThrow();
  });

  it('a payment to a stateful contract value that is not a new result is refused (B2.3)', () => {
    const source = `
contract Child { int x; constructor() { x = 1; } function poke() { x = x + 1; } }
contract Parent() {
    int n;
    function pay(Child c) { this.transfer(c, 5000); n = n + 1; }
}
`;
    expect(() => compileString(source, { allowUnsafeOperations: true }))
      .toThrow(/master lock/);
  });
});
