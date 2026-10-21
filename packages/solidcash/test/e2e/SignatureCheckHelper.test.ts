import { describe, expect, it } from 'vitest';
import {
  Contract,
  SignatureAlgorithm,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';
import { alicePriv, alicePub, bobPriv, bobPub } from '../fixture/vars.js';

// A transaction-signature check covers the bytecode of the body it runs in, and an SDK signature covers the entry
// point's body. A helper that checks one is therefore inlined into each caller instead of running behind OP_INVOKE,
// whose covered bytecode would be the helper's own body; before that, no SDK signature verified in a helper.
const TWICE = `
contract Twice(pubkey owner) {
    int counter;
    function auth(sig s) internal { require(checkSig(s, owner)); }
    function up(sig s) { auth(s); this.counter = this.counter + 1; require(this.counter > 0); }
    function down(sig s) { auth(s); this.counter = this.counter - 1; require(this.counter >= 0); }
}`;
const RETURNING = `
contract Returning(pubkey owner, bool open) {
    int counter;
    function isOwner(sig s) internal returns (bool) { return checkSig(s, owner); }
    function bump(sig s) { require(isOwner(s)); this.counter = this.counter + 1; require(this.counter > 0); }
    function nudge(sig s) { require(open || isOwner(s)); this.counter = this.counter + 1; require(this.counter > 0); }
}`;
const MULTISIG = `
contract Pair(pubkey first, pubkey second) {
    int counter;
    function both(sig a, sig b) internal { require(checkMultiSig([a, b], [first, second])); }
    function bump(sig a, sig b) { both(a, b); this.counter = this.counter + 1; require(this.counter > 0); }
}`;
const ENTRY = `
contract Entry(pubkey owner) {
    int counter;
    function validate(sig s) public { require(checkSig(s, owner)); }
    function bump(sig s) { validate(s); this.counter = this.counter + 1; require(this.counter > 0); }
}`;
const SELF_CALL = `
contract SelfCall(pubkey owner) {
    int counter;
    function validate(sig s) public { require(checkSig(s, owner)); }
    function bump(sig s) { this.validate(s); this.counter = this.counter + 1; require(this.counter > 0); }
}`;
const POINTER = `
contract Pointer(pubkey owner) {
    int counter;
    function auth(sig s) internal { require(checkSig(s, owner)); }
    function bump(sig s) {
        function(sig) internal check = auth;
        check(s);
        this.counter = this.counter + 1;
        require(this.counter > 0);
    }
}`;

describe('a transaction signature checked in a helper', () => {
  const deploy = async (source: string, args: unknown[]): Promise<StatefulContract> => {
    const provider = createTestProvider();
    const artifact = compileString(source);
    const contract = new Contract(artifact, args as never, { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    return StatefulContract.withCategory(contract, categoryId);
  };

  it('settles with an SDK signature from each entry that calls one shared void helper', async () => {
    const contract = await deploy(TWICE, [alicePub]);
    await contract.call.up(new SignatureTemplate(alicePriv)).send();
    await contract.call.up(new SignatureTemplate(alicePriv)).send();
    await contract.call.down(new SignatureTemplate(alicePriv)).send();
    expect((await contract.getState()).counter).toBe(1n);
    await expect(contract.call.up(new SignatureTemplate(bobPriv)).send()).rejects.toThrow();
  });

  it('settles a returning helper called once as a condition, and once in a short-circuit operand', async () => {
    const contract = await deploy(RETURNING, [alicePub, false]);
    await contract.call.bump(new SignatureTemplate(alicePriv)).send();
    await contract.call.nudge(new SignatureTemplate(alicePriv)).send();
    expect((await contract.getState()).counter).toBe(2n);
    await expect(contract.call.nudge(new SignatureTemplate(bobPriv)).send()).rejects.toThrow();
  });

  it('settles a multisig helper with SDK signatures', async () => {
    const contract = await deploy(MULTISIG, [alicePub, bobPub]);
    const ecdsa = (key: Uint8Array): SignatureTemplate => new SignatureTemplate(key, undefined, SignatureAlgorithm.ECDSA);
    await contract.call.bump(ecdsa(alicePriv), ecdsa(bobPriv)).send();
    expect((await contract.getState()).counter).toBe(1n);
  });

  it('settles an entry point that checks a signature both when called and when another entry calls it', async () => {
    const contract = await deploy(ENTRY, [alicePub]);
    await contract.call.bump(new SignatureTemplate(alicePriv)).send();
    await contract.call.validate(new SignatureTemplate(alicePriv)).send();
    expect((await contract.getState()).counter).toBe(1n);
  });

  // Since 766d02e42 a direct build inlines a void `this.f()` into its caller, so the check runs in the signed entry.
  it('settles an entry point that checks a signature when another entry self-calls it', async () => {
    const contract = await deploy(SELF_CALL, [alicePub]);
    await contract.call.bump(new SignatureTemplate(alicePriv)).send();
    expect((await contract.getState()).counter).toBe(1n);
    await expect(contract.call.bump(new SignatureTemplate(bobPriv)).send()).rejects.toThrow();
  });

  it('refuses a signature check left in an invoked body: a function-pointer target', () => {
    expect(() => compileString(POINTER)).toThrow(/SIGNATURE_CHECK_IN_SUBROUTINE/);
  });
});
