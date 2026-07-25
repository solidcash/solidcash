import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';
import { aliceAddress } from '../fixture/vars.js';

// The implementation carries NO `delegate` modifier: it is an ordinary Solidity-shaped contract, exactly as it
// would be written for an EVM proxy. The compiler infers which functions can act as a proxy implementation and
// emits that build as artifact.delegateArtifact; the SDK reaches it via contract.asDelegate().
const IMPL = `
pragma solidcash >=0.8.0;

contract Counter() {
    bigint counter;

    function increment() public {
        this.counter = this.counter + 1;
    }

    function addTo(bigint amount) public {
        this.counter = this.counter + amount;
    }

    function get() public view returns (bigint) {
        return this.counter;
    }
}
`;

const PROXY = `
pragma solidcash >=0.8.0;

contract CounterProxy() {
    bigint counter;

    // A proxy needs a second entry point: a fallback-only contract takes the SDK's selector-less unlocker path,
    // which the delegatecall covenant cannot satisfy (pre-existing, unrelated to delegate inference).
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }

    fallback(bytes input) external {
        address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}
`;

const implArtifact = compileString(IMPL);
const proxyArtifact = compileString(PROXY);

describe('Inferred delegate mode (no `delegate` keyword in source)', () => {
  describe('Compiler', () => {
    it('emits a delegate variant for a keyword-free implementation', () => {
      expect(implArtifact.delegateArtifact).toBeDefined();
      expect(implArtifact.bytecode).not.toBe(implArtifact.delegateArtifact!.bytecode);
    });

    it('marks exactly the state-writing externally-callable functions', () => {
      const mods = Object.fromEntries(
        implArtifact.delegateArtifact!.abi.map((f) => [f.name, f.modifiers ?? []]),
      );
      expect(mods.increment).toContain('delegate');
      expect(mods.addTo).toContain('delegate');
      // view functions read state but cannot authorize the proxy's outputs
      expect(mods.get).not.toContain('delegate');
    });

    it('injects the proxy master index only on delegate functions', () => {
      const abi = implArtifact.delegateArtifact!.abi;
      const inputNames = (n: string): string[] => abi.find((f) => f.name === n)!.inputs.map((i) => i.name);
      expect(inputNames('increment')).toContain('__internal__proxyMasterIndex');
      expect(inputNames('get')).not.toContain('__internal__proxyMasterIndex');
    });

    it('does not emit a variant for a contract that cannot be an implementation', () => {
      const readOnly = compileString(`
        pragma solidcash >=0.8.0;
        contract R() { bigint v; function get() public view returns (bigint) { return this.v; } }
      `);
      expect(readOnly.delegateArtifact).toBeUndefined();
    });

    it('does not nest variants recursively', () => {
      expect(implArtifact.delegateArtifact!.delegateArtifact).toBeUndefined();
    });

    it('keeps the delegate artifact complete for direct consumers and diagnostics', () => {
      expect(implArtifact.delegateArtifact!.source).toBe(implArtifact.source);
      const provider = createTestProvider();
      const delegateContract = new Contract(implArtifact, [], { provider }).asDelegate();
      expect(delegateContract.artifact.source).toBe(implArtifact.source);
    });

    // Marking must track what actually EXECUTES in delegate mode (see the on-chain matrix below), not merely
    // what counts as a stateful statement. Transfers and token-container ops fail the delegate covenant, so
    // they are excluded and the failure surfaces as asDelegate() throwing rather than a broadcast-time revert.
    it('marks emits and low-level calls, excludes transfers and token operations', () => {
      const artifact = compileString(`
        pragma solidcash >=0.8.0;
        contract SideEffects() {
          bigint counter;
          event Paid(int amount);
          function fire() public { emit Paid(1); }
          function poke(address t) public { t.call(""); }
          function pay(address recipient) public { payable(recipient).transfer(1); }
          function sendToken(bytes32 category, address recipient) public {
            this.tokens[category].transfer(recipient, 1);
          }
          function payAndWrite(address recipient) public {
            this.counter = this.counter + 1;
            payable(recipient).transfer(1);
          }
        }
      `);
      const modifiers = Object.fromEntries(
        artifact.delegateArtifact!.abi.map((f) => [f.name, f.modifiers ?? []]),
      );
      expect(modifiers.fire).toContain('delegate');
      expect(modifiers.poke).toContain('delegate');
      expect(modifiers.pay).not.toContain('delegate');
      expect(modifiers.sendToken).not.toContain('delegate');
      // A transfer poisons the whole function: a state write alongside it still fails the delegate covenant.
      expect(modifiers.payAndWrite).not.toContain('delegate');
    });

    // The gate has to follow calls: an entry point whose own body is clean still cannot run in delegate mode
    // if a helper it reaches transfers. Checking only the entry body ships a build that reverts at broadcast.
    it('excludes unsupported operations reached through internal helpers', () => {
      const viaHelper = compileString(`
        pragma solidcash >=0.8.0;
        contract C() {
          bigint counter;
          function helper(address r) internal { payable(r).transfer(1000); }
          function f(address r) public { this.counter = this.counter + 1; this.helper(r); }
        }
      `);
      expect(viaHelper.delegateArtifact).toBeUndefined();

      const viaTokenHelper = compileString(`
        pragma solidcash >=0.8.0;
        contract C() {
          bigint counter;
          function helper(bytes32 c, address r) internal { this.tokens[c].transfer(r, 1); }
          function f(bytes32 c, address r) public { this.counter = this.counter + 1; this.helper(c, r); }
        }
      `);
      expect(viaTokenHelper.delegateArtifact).toBeUndefined();

      const viaChain = compileString(`
        pragma solidcash >=0.8.0;
        contract C() {
          bigint counter;
          function inner(address r) internal { payable(r).transfer(1000); }
          function outer(address r) internal { this.inner(r); }
          function f(address r) public { this.counter = this.counter + 1; this.outer(r); }
        }
      `);
      expect(viaChain.delegateArtifact, 'must follow helper chains transitively').toBeUndefined();
    });

    it('still marks a function whose internal helper is clean', () => {
      const clean = compileString(`
        pragma solidcash >=0.8.0;
        contract C() {
          bigint counter;
          function helper(bigint x) internal returns (bigint) { return x + 1; }
          function f(bigint x) public { this.counter = this.helper(x); }
        }
      `);
      expect(clean.delegateArtifact!.abi.find((f) => f.name === 'f')?.modifiers).toContain('delegate');
    });

    it('terminates on a recursive internal helper', () => {
      const recursive = compileString(`
        pragma solidcash >=0.8.0;
        contract C() {
          bigint counter;
          function helper(bigint x) internal returns (bigint) {
            if (x > 0) { return this.helper(x - 1); }
            return 0;
          }
          function f(bigint x) public { this.counter = this.helper(x); }
        }
      `);
      expect(recursive.delegateArtifact!.abi.find((f) => f.name === 'f')?.modifiers).toContain('delegate');
    });

    it('emits no variant at all when every function is transfer-only', () => {
      const artifact = compileString(`
        pragma solidcash >=0.8.0;
        contract PayOnly() {
          bigint counter;
          function pay(address r) public { payable(r).transfer(1000); }
        }
      `);
      expect(artifact.delegateArtifact).toBeUndefined();
    });
  });

  describe('SDK', () => {
    it('asDelegate() yields a different script than the standalone build', () => {
      const provider = createTestProvider();
      const standalone = new Contract(implArtifact, [], { provider });
      expect(standalone.asDelegate().address).not.toBe(standalone.address);
    });

    it('asDelegate() throws with a useful message when there is no variant', () => {
      const provider = createTestProvider();
      const readOnly = compileString(`
        pragma solidcash >=0.8.0;
        contract R() { bigint v; function get() public view returns (bigint) { return this.v; } }
      `);
      expect(() => new Contract(readOnly, [], { provider }).asDelegate())
        .toThrow(/has no delegate variant/);
    });

    it('withDelegatecall rejects a standalone build deployed as an implementation', async () => {
      const provider = createTestProvider();
      const proxyContract = new Contract(proxyArtifact, [], { provider });
      const { categoryId: proxyCatId } = await setupStatefulUtxos(
        provider, proxyContract, proxyArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const implContract = new Contract(implArtifact, [], { provider });
      const { categoryId: implCatId } = await setupStatefulUtxos(
        provider, implContract, implArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
      const implSc = StatefulContract.withCategory(implContract, implCatId);

      expect(() => proxySc.call.__fallback().withDelegatecall(implSc, 'increment', []))
        .toThrow(/not available in delegate mode/);
    });

    it('withDelegatecall rejects a non-delegate function from a delegate artifact', async () => {
      const provider = createTestProvider();
      const proxyContract = new Contract(proxyArtifact, [], { provider });
      const { categoryId: proxyCatId } = await setupStatefulUtxos(
        provider, proxyContract, proxyArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const implContract = new Contract(implArtifact, [], { provider }).asDelegate();
      const { categoryId: implCatId } = await setupStatefulUtxos(
        provider, implContract, implContract.artifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
      const implSc = StatefulContract.withCategory(implContract, implCatId);

      expect(() => proxySc.call.__fallback().withDelegatecall(implSc, 'get', []))
        .toThrow(/Counter\.get.*not available in delegate mode/);
    });

    // Contract.unlock dispatches different-arity overloads on args.length, so the guard has to validate the
    // overload that will actually be selected. Both directions matter: accepting the delegate one, and
    // rejecting a call whose arity lands on the non-delegate one.
    it('withDelegatecall selects the overload by arity, not by first match', async () => {
      const provider = createTestProvider();
      const overloaded = compileString(`
        pragma solidcash >=0.8.0;
        contract O() {
          bigint counter;
          function set(bigint x) public view returns (bigint) { return this.counter + x; }
          function set(bigint x, bigint y) public { this.counter = x + y; }
        }
      `);
      // The view overload is first in the ABI; the delegate-eligible one is second.
      expect(overloaded.delegateArtifact!.abi[0].modifiers).not.toContain('delegate');
      expect(overloaded.delegateArtifact!.abi[1].modifiers).toContain('delegate');

      const proxyContract = new Contract(proxyArtifact, [], { provider });
      const { categoryId: proxyCatId } = await setupStatefulUtxos(
        provider, proxyContract, proxyArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const implContract = new Contract(overloaded, [], { provider }).asDelegate();
      const { categoryId: implCatId } = await setupStatefulUtxos(
        provider, implContract, implContract.artifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
      const implSc = StatefulContract.withCategory(implContract, implCatId);

      // Two args -> the delegate overload is selected: accepted.
      expect(() => proxySc.call.__fallback().withDelegatecall(implSc, 'set', [1n, 2n])).not.toThrow();
      // One arg -> the unlocker would select the `view` overload, so this must be rejected even though the
      // two-arg overload of the same name IS delegate-qualified.
      expect(() => proxySc.call.__fallback().withDelegatecall(implSc, 'set', [1n]))
        .toThrow(/not available in delegate mode/);
    });
  });

  describe('On-chain execution', () => {
    async function setup(initial: bigint): Promise<{ proxySc: StatefulContract; implSc: StatefulContract;
      proxyCatId: string; }> {
      const provider = createTestProvider();
      const proxyContract = new Contract(proxyArtifact, [], { provider });
      const { categoryId: proxyCatId } = await setupStatefulUtxos(
        provider, proxyContract, proxyArtifact.stateLayout!, { counter: initial }, { saltContract: true },
      );
      // The implementation is deployed as its delegate build - a different script than the standalone one.
      const implContract = new Contract(implArtifact, [], { provider }).asDelegate();
      const { categoryId: implCatId } = await setupStatefulUtxos(
        provider, implContract, implContract.artifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      return {
        proxySc: StatefulContract.withCategory(proxyContract, proxyCatId),
        implSc: StatefulContract.withCategory(implContract, implCatId),
        proxyCatId,
      };
    }

    function proxyCounter(tx: any, proxyCatId: string): bigint {
      const out = getTxOutputs(tx).find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === proxyCatId,
      );
      expect(out).toBeDefined();
      return parsePushdataCommitment(
        out!.token!.nft!.commitment, proxyArtifact.stateLayout!, 0,
      ).counter as bigint;
    }

    it('mutates the proxy state through an inferred delegate function', async () => {
      const { proxySc, implSc, proxyCatId } = await setup(0n);
      const tx = await proxySc.call.__fallback().withDelegatecall(implSc, 'increment', []).send();
      expect(tx.txid).toBeDefined();
      expect(proxyCounter(tx, proxyCatId)).toBe(1n);
    });

    it('preserves non-zero proxy state', async () => {
      const { proxySc, implSc, proxyCatId } = await setup(42n);
      const tx = await proxySc.call.__fallback().withDelegatecall(implSc, 'increment', []).send();
      expect(proxyCounter(tx, proxyCatId)).toBe(43n);
    });

    it('forwards arguments to an inferred delegate function', async () => {
      const { proxySc, implSc, proxyCatId } = await setup(10n);
      const tx = await proxySc.call.__fallback().withDelegatecall(implSc, 'addTo', [7n]).send();
      expect(proxyCounter(tx, proxyCatId)).toBe(17n);
    });

    // Every form that inference marks must actually run behind a proxy. This is the check that keeps marking
    // honest: a form that compiles but reverts at broadcast belongs in hasUnsupportedDelegateOperation instead.
    async function runForm(implSrc: string, fn: string, args: any[]): Promise<void> {
      const provider = createTestProvider();
      const artifact = compileString(implSrc);
      expect(artifact.delegateArtifact, `${fn}: expected a delegate variant`).toBeDefined();
      const proxyContract = new Contract(proxyArtifact, [], { provider });
      const { categoryId: proxyCatId } = await setupStatefulUtxos(
        provider, proxyContract, proxyArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const implContract = new Contract(artifact, [], { provider }).asDelegate();
      const { categoryId: implCatId } = await setupStatefulUtxos(
        provider, implContract, implContract.artifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
      const implSc = StatefulContract.withCategory(implContract, implCatId);
      await proxySc.call.__fallback().withDelegatecall(implSc, fn, args).send();
    }

    it('executes an emit-only delegate function', async () => {
      await runForm(`pragma solidcash >=0.8.0;
        contract C() { bigint counter; event E(int v);
          function f() public { emit E(1); } }`, 'f', []);
    });

    it('executes a state-write + emit delegate function', async () => {
      await runForm(`pragma solidcash >=0.8.0;
        contract C() { bigint counter; event E(int v);
          function f() public { this.counter = this.counter + 1; emit E(1); } }`, 'f', []);
    });

    // Exercises the arity selection in the execution path (not just the guard): the overload chosen there
    // decides which synthetic args get injected before Contract.unlock dispatches on the final arg count.
    it('executes the delegate overload of an overloaded function', async () => {
      const provider = createTestProvider();
      const overloaded = compileString(`
        pragma solidcash >=0.8.0;
        contract O() {
          bigint counter;
          function set(bigint x) public view returns (bigint) { return this.counter + x; }
          function set(bigint x, bigint y) public { this.counter = x + y; }
        }
      `);
      const proxyContract = new Contract(proxyArtifact, [], { provider });
      const { categoryId: proxyCatId } = await setupStatefulUtxos(
        provider, proxyContract, proxyArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const implContract = new Contract(overloaded, [], { provider }).asDelegate();
      const { categoryId: implCatId } = await setupStatefulUtxos(
        provider, implContract, implContract.artifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
      const implSc = StatefulContract.withCategory(implContract, implCatId);

      const tx = await proxySc.call.__fallback().withDelegatecall(implSc, 'set', [4n, 5n]).send();
      expect(proxyCounter(tx, proxyCatId)).toBe(9n);
    });

    it('executes a low-level-call delegate function', async () => {
      await runForm(`pragma solidcash >=0.8.0;
        contract C() { bigint counter;
          function f(address t) public { t.call(""); } }`, 'f', [aliceAddress]);
    });
  });
});
