import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

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
      const inputNames = (n: string) => abi.find((f) => f.name === n)!.inputs.map((i) => i.name);
      expect(inputNames('increment')).toContain('__internal__proxyMasterIndex');
      expect(inputNames('get')).not.toContain('__internal__proxyMasterIndex');
    });

    it('produces bytecode identical to the hand-written `delegate` modifier', () => {
      const explicit = compileString(`
        pragma solidcash >=0.8.0;
        contract Counter() {
            bigint counter;
            function increment() delegate { this.counter = this.counter + 1; }
            function addTo(bigint amount) delegate { this.counter = this.counter + amount; }
            function get() public view returns (bigint) { return this.counter; }
        }
      `);
      expect(implArtifact.delegateArtifact!.bytecode).toBe(explicit.bytecode);
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
        .toThrow(/not a delegate build/);
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
  });
});
