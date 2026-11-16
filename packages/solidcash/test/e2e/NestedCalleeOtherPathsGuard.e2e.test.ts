/**
 * The guards of a called contract's calls on the planning paths beside the transitive discovery, on the direct
 * convention: the delegatecall path, where a proxy's implementation makes the call in the proxy's state; the late
 * pass, which re-reads a called contract's calls when the transaction's own contract also makes a low-level call; and
 * the frame of a contract a delegated function calls. A false guard on the block leaves the callee unspent and as it
 * was, a true one calls it; a guard no frame can decide is refused by name; and a contract that skips its one
 * conditional call settles. Each transaction is checked by the VM as the mock chain accepts it.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { CallGuardUndecidedError, Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

type Provider = ReturnType<typeof createTestProvider>;

interface Deployed {
  sc: StatefulContract;
  lock: Uint8Array;
}

async function deploy(provider: Provider, contract: Contract, state: Record<string, bigint>): Promise<Deployed> {
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, contract.artifact.stateLayout!, state, { saltContract: true },
  );
  return {
    sc: StatefulContract.withCategory(contract, categoryId),
    lock: hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
  };
}

const masterOf = async (deployed: Deployed): Promise<string> => {
  const { masterUtxo } = await deployed.sc.getFullState();
  return `${masterUtxo!.txid}:${masterUtxo!.vout}`;
};
const field = async (deployed: Deployed, name: string): Promise<bigint> => (
  ((await deployed.sc.getState()) as Record<string, bigint | undefined>)[name] ?? 0n);

const PROXY = `pragma solidcash >=0.8.0;
contract Proxy() {
  bigint counter;
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  fallback(bytes input) external {
    address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;

const FOO = `pragma solidcash >=0.8.0;
contract Foo() {
  bigint hits;
  function inc(int v) public { this.hits = this.hits + v; }
}`;

const IMPL = `pragma solidcash >=0.8.0;
interface IFoo { function inc(int v); }
contract Impl() {
  bigint counter;
  function atGenesis(address foo) public {
    if (int(block.number) == 0) { IFoo(foo).inc(1); }
    this.counter = this.counter + 1;
  }
  function afterGenesis(address foo) public {
    if (int(block.number) > 0) { IFoo(foo).inc(2); }
    this.counter = this.counter + 1;
  }
  function byDifficulty(address foo) public {
    if (int(block.difficulty) >= 0) { IFoo(foo).inc(3); }
    this.counter = this.counter + 1;
  }
}`;

// The contract a delegated function calls, which makes one call of its own when asked.
const RELAY = `pragma solidcash >=0.8.0;
interface IFoo { function inc(int v); }
contract Relay() {
  bigint relays;
  function relay(address foo, bool make) public {
    if (make) { IFoo(foo).inc(4); }
    this.relays = this.relays + 1;
  }
}`;

const RELAY_IMPL = `pragma solidcash >=0.8.0;
interface IRelay { function relay(address foo, bool make); }
contract RelayImpl() {
  bigint counter;
  function viaRelay(address relayer, address foo, bool make) public {
    IRelay(relayer).relay(foo, make);
    this.counter = this.counter + 1;
  }
}`;

interface DelegateChain {
  provider: Provider;
  proxy: Deployed;
  impl: Deployed;
  foo: Deployed;
}

async function delegateChain(implSource: string): Promise<DelegateChain> {
  const provider = createTestProvider();
  const proxy = await deploy(provider, new Contract(
    compileString(PROXY, { allowUnsafeOperations: true }), [], { provider },
  ), { counter: 0n });
  const impl = await deploy(provider, new Contract(compileString(implSource), [], { provider }).asDelegate(),
    { counter: 0n });
  const foo = await deploy(provider, new Contract(compileString(FOO), [], { provider }), { hits: 0n });
  return { provider, proxy, impl, foo };
}

describe('the delegatecall path: a proxy\'s implementation calls Foo when its guard holds', () => {
  it('leaves Foo unspent and as it was when the guard on block.number is false, and calls Foo when it is true',
    async () => {
      const { proxy, impl, foo } = await delegateChain(IMPL);
      (impl.sc as unknown as { _registerResolvedExternal(name: string, contract: unknown): void })
        ._registerResolvedExternal('IFoo', foo.sc);
      const fire = (name: string): Promise<unknown> => (proxy.sc.call as any).__fallback()
        .withDelegatecall(impl.sc, name, [foo.lock]).send();

      const before = await masterOf(foo);
      await fire('atGenesis');
      expect(await field(foo, 'hits')).toBe(0n);
      expect(await masterOf(foo)).toBe(before);
      expect(await field(proxy, 'counter')).toBe(1n);

      await fire('afterGenesis');
      expect(await field(foo, 'hits')).toBe(2n);
      expect(await masterOf(foo)).not.toBe(before);
      expect(await field(proxy, 'counter')).toBe(2n);
    }, 300_000);

  it('refuses by name a delegated call under a guard the compiler publishes no form of', async () => {
    const { proxy, impl, foo } = await delegateChain(IMPL);
    (impl.sc as unknown as { _registerResolvedExternal(name: string, contract: unknown): void })
      ._registerResolvedExternal('IFoo', foo.sc);
    const refusal = await (proxy.sc.call as any).__fallback().withDelegatecall(impl.sc, 'byDifficulty', [foo.lock])
      .send().then(() => undefined, (error: unknown) => error);
    expect(refusal).toBeInstanceOf(CallGuardUndecidedError);
    expect((refusal as Error).message).toMatch(/^Impl\.byDifficulty's call of IFoo\.inc \(line \d+\) cannot be built: it /);
    expect((refusal as Error).message).toContain('a guard the compiler publishes no form of');
    expect(await field(foo, 'hits')).toBe(0n);
    expect(await field(proxy, 'counter')).toBe(0n);
  }, 300_000);

  it('settles a contract the delegated function calls that skips its one conditional call, and makes it when asked',
    async () => {
      const { provider, proxy, impl, foo } = await delegateChain(RELAY_IMPL);
      const relay = await deploy(provider, new Contract(compileString(RELAY), [], { provider }), { relays: 0n });
      (impl.sc as unknown as { _registerResolvedExternal(name: string, contract: unknown): void })
        ._registerResolvedExternal('IRelay', relay.sc);
      (relay.sc as unknown as { _registerResolvedExternal(name: string, contract: unknown): void })
        ._registerResolvedExternal('IFoo', foo.sc);
      const fire = (make: boolean): Promise<unknown> => (proxy.sc.call as any).__fallback()
        .withDelegatecall(impl.sc, 'viaRelay', [relay.lock, foo.lock, make]).send();

      const before = await masterOf(foo);
      await fire(false);
      expect(await field(relay, 'relays')).toBe(1n);
      expect(await field(foo, 'hits')).toBe(0n);
      expect(await masterOf(foo)).toBe(before);

      await fire(true);
      expect(await field(relay, 'relays')).toBe(2n);
      expect(await field(foo, 'hits')).toBe(4n);
    }, 300_000);
});

// The transaction's own contract delegatecalls as well as calling D, so the late pass re-reads D's calls after
// discovery has decided them.
const COUNTER_IMPL = `pragma solidcash >=0.8.0;
contract Impl() {
  bigint counter;
  function increment() public { this.counter = this.counter + 1; }
}`;

const LATE_PROXY = `pragma solidcash >=0.8.0;
interface ID { function byHeight(address t, int atLeast); }
contract LateProxy(address impl, address d, address t) {
  bigint counter;
  function fire(bytes input, int atLeast) public {
    impl.delegatecall(input);
    ID(d).byHeight(t, atLeast);
    require(input.length > 0);
  }
}`;

const LATE_D = `pragma solidcash >=0.8.0;
interface IT { function set(int h); }
contract D() {
  bigint runs;
  function byHeight(address t, int atLeast) public {
    if (int(block.number) >= atLeast) { IT(t).set(int(block.number)); }
    this.runs = this.runs + 1;
  }
}`;

const LATE_T = `pragma solidcash >=0.8.0;
contract T() {
  bigint height;
  bigint calls;
  function set(int h) public { this.height = h; this.calls = this.calls + 1; }
}`;

describe('the late pass: a proxy delegatecalls and calls D, which calls T when its guard holds', () => {
  it('leaves T unspent and as it was when the guard on block.number is false, and calls T when it is true',
    async () => {
      const provider = createTestProvider();
      const implArtifact = compileString(COUNTER_IMPL);
      const impl = await deploy(provider, new Contract(implArtifact, [], { provider }).asDelegate(), { counter: 0n });
      const t = await deploy(provider, new Contract(compileString(LATE_T), [], { provider }), { height: 0n, calls: 0n });
      const d = await deploy(provider, new Contract(compileString(LATE_D), [], { provider }), { runs: 0n });
      const proxy = await deploy(provider, new Contract(compileString(LATE_PROXY), [impl, d, t].map((deployed) => (
        binToHex(deployed.lock))), { provider }), { counter: 0n });
      (d.sc as unknown as { _registerResolvedExternal(name: string, contract: unknown): void })
        ._registerResolvedExternal('IT', t.sc);
      const input = hexToBin(implArtifact.abi.find((entry) => entry.name === 'increment')!.selector!);
      const fire = (atLeast: bigint): Promise<unknown> => (proxy.sc.call as any).fire(input, atLeast)
        .withDelegatecall(impl.sc, 'increment', []).withExternalCall(d.sc, 'byHeight', [t.lock, atLeast]).send();
      const height = BigInt(await provider.getBlockHeight());

      const before = await masterOf(t);
      await fire(height + 1_000_000n);
      expect(await field(t, 'calls')).toBe(0n);
      expect(await masterOf(t)).toBe(before);
      expect(await field(d, 'runs')).toBe(1n);
      expect(await field(proxy, 'counter')).toBe(1n);

      await fire(0n);
      expect(await field(t, 'calls')).toBe(1n);
      expect(await field(t, 'height')).toBe(height);
      expect(await field(d, 'runs')).toBe(2n);
      expect(await field(proxy, 'counter')).toBe(2n);
    }, 300_000);
});
