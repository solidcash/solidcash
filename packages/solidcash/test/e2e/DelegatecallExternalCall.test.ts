import { hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

/**
 * A call a function makes beside its delegatecall is verified like a call in any other function.
 *
 * The delegate authorizes the proxy's state, and nothing it runs binds a call the proxy makes itself, yet the proxy
 * skipped its call verification together with its state covenant. The callee was then bound by nothing: another
 * deployment of it, or the same callee running another of its functions, settled where the source names
 * `IFoo(foo).inc(v)`. Now the callee's identity and the function it runs are bound, as for an ordinary caller.
 */
const IMPL = `pragma solidcash >=0.8.0;
contract Impl() {
  bigint counter;
  function increment() public { this.counter = this.counter + 1; }
  function decrement() public { require(this.counter > 0); this.counter = this.counter - 1; }
}`;

const IFOO = 'interface IFoo { function inc(int v); function dec(int v); function get() returns (int); }';

const FOO = `pragma solidcash >=0.8.0;
contract Foo() {
  bigint hits;
  function inc(int v) public { this.hits = this.hits + v; }
  function dec(int v) public { this.hits = this.hits - v; }
  function get() public returns (int) { return this.hits + 1; }
}`;

const PROXY = `pragma solidcash >=0.8.0;
${IFOO}
contract Proxy(address impl, address foo) {
  bigint counter;
  function fire(bytes input, int v) public {
    impl.delegatecall(input);
    IFoo(foo).inc(v);
    require(input.length > 0);
  }
  function ask(bytes input) public {
    impl.delegatecall(input);
    require(IFoo(foo).get() > 0);
  }
}`;

interface Deployed {
  sc: StatefulContract;
  locking: string;
  category: string;
}

async function deploy(
  provider: ReturnType<typeof createTestProvider>, artifact: Artifact, args: string[], state: Record<string, bigint>,
): Promise<Deployed> {
  const base = new Contract(artifact, args, { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, state, { saltContract: true });
  const inner = base.withCategory(hexToBin(setup.categoryId));
  return {
    sc: StatefulContract.withCategory(inner, setup.categoryId),
    locking: inner.lockingBytecode,
    category: setup.categoryId,
  };
}

async function deployAll(): Promise<{
  impl: Deployed; foo: Deployed; other: Deployed; proxy: Deployed; input: Uint8Array;
  fooArtifact: Artifact; proxyArtifact: Artifact;
}> {
  const provider = createTestProvider();
  const implArtifact = compileString(IMPL).delegateArtifact!;
  const fooArtifact = compileString(FOO);
  const proxyArtifact = compileString(PROXY);
  const impl = await deploy(provider, implArtifact, [], { counter: 0n });
  const foo = await deploy(provider, fooArtifact, [], { hits: 0n });
  const other = await deploy(provider, fooArtifact, [], { hits: 0n });
  const proxy = await deploy(provider, proxyArtifact, [impl.locking, foo.locking], { counter: 5n });
  const input = hexToBin(implArtifact.abi.find((entry) => entry.name === 'increment')!.selector!);
  return { impl, foo, other, proxy, input, fooArtifact, proxyArtifact };
}

function field(
  tx: Awaited<ReturnType<ReturnType<StatefulContract['call']['fire']>['send']>>,
  category: string, artifact: Artifact, name: string,
): bigint | undefined {
  const output = getTxOutputs(tx).find(
    (candidate) => candidate.token?.nft?.capability === 'mutable' && candidate.token?.category === category,
  );
  return output ? parsePushdataCommitment(output.token!.nft!.commitment, artifact.stateLayout!, 0)[name] as bigint
    : undefined;
}

describe('an external call beside a delegatecall', () => {
  it('settles with the named callee running the named function, and with no other callee or function', async () => {
    const { impl, foo, other, proxy, input, fooArtifact, proxyArtifact } = await deployAll();
    const fire = (): ReturnType<StatefulContract['call']['fire']> => (proxy.sc.call as any).fire(input, 3n)
      .withDelegatecall(impl.sc, 'increment', []);

    // Another deployment of the callee, the callee running another function, and no callee at all.
    await expect(fire().withExternalCall(other.sc, 'inc', [3n]).send()).rejects.toThrow(/input 0/);
    await expect(fire().withExternalCall(foo.sc, 'dec', [3n]).send()).rejects.toThrow(/input 0/);
    await expect(fire().send()).rejects.toThrow(/input 0/);

    const tx = await fire().withExternalCall(foo.sc, 'inc', [3n]).send();
    expect(field(tx, proxy.category, proxyArtifact, 'counter')).toBe(6n);
    expect(field(tx, foo.category, fooArtifact, 'hits')).toBe(3n);
  }, 180_000);

  it('settles a returning call with the named callee, and not with another deployment of it', async () => {
    // The callee's data NFT names its master's input; behind the implementation block that master sits two inputs
    // later than a call without a delegatecall puts it, and a returning call used to keep the earlier coordinate.
    const { impl, foo, other, proxy, input, proxyArtifact } = await deployAll();
    const ask = (): ReturnType<StatefulContract['call']['ask']> => (proxy.sc.call as any).ask(input)
      .withDelegatecall(impl.sc, 'increment', []);

    await expect(ask().withExternalCall(other.sc, 'get', []).send()).rejects.toThrow(/input 0/);

    const tx = await ask().withExternalCall(foo.sc, 'get', []).send();
    expect(field(tx, proxy.category, proxyArtifact, 'counter')).toBe(6n);
  }, 180_000);
});
