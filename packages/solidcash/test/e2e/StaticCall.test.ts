import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { compileString as compileKernelString } from '@solidcash/solidc';
import { binToHex } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { aliceAddress } from '../fixture/vars.js';

// ethers-style `contract.fn.staticCall()`: read a view function's return value(s) via a read-only VM probe (no
// send), decoded against the ABI output type(s). This is the value-returning read pattern (EA getJob/getUsers).
const SRC = `pragma solidcash >=0.8.0;
contract V() {
  struct Pt { bigint x; bigint y; }
  Pt p;
  function set(bigint a, bigint b) { this.p = Pt(a, b); }
  function getPt() view returns (Pt) { return this.p; }
  function sum() view returns (bigint) { return this.p.x + this.p.y; }
  function both() view returns (bigint, bigint) { return (this.p.x, this.p.y); }
  function bump() { this.p = Pt(this.p.x + 1, this.p.y); }
}`;

async function deploy(): Promise<StatefulContract> {
  const art = compileString(SRC);
  const provider = createTestProvider();
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, art.stateLayout!, { p: { x: 0n, y: 0n } }, { saltContract: true },
  );
  return new StatefulContract(categoryId, art, provider);
}

describe('StatefulFunctionCall.staticCall() - value-returning reads', () => {
  it('reads a scalar view return', async () => {
    const sc = await deploy() as unknown as { set: Function; sum: Function };
    await (sc.set(3n, 4n) as { send: () => Promise<unknown> }).send();
    expect(await (sc.sum() as { staticCall: () => Promise<bigint> }).staticCall()).toBe(7n);
  });

  it('keeps kernel struct decoding independent of timestamp_ and address_ field names', async () => {
    const payloadHex = '31'.repeat(20);
    const art = compileKernelString(`pragma solidcash >=0.8.0;
      contract Names() {
        struct Named { bytes address_; bigint timestamp_; }
        struct Renamed { bytes payload; bigint observedAt; }
        function named() view returns (Named) { return Named(hex"${payloadHex}", 0); }
        function renamed() view returns (Renamed) { return Renamed(hex"${payloadHex}", 0); }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    expect(art.messageBus?.convention).toBe('kernel-row-loop');
    const namedHandlers = art.messageBus?.handlers
      .filter((handler) => ['named', 'renamed'].includes(handler.name)) ?? [];
    expect(namedHandlers).toHaveLength(2);
    expect(namedHandlers.every((handler) => handler.eligible)).toBe(true);
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, {}, { saltContract: true },
    );
    const sc = new StatefulContract(categoryId, art, provider) as unknown as {
      named: () => { staticCall: () => Promise<{ toObject: () => Record<string, unknown> }> };
      renamed: () => { staticCall: () => Promise<{ toObject: () => Record<string, unknown> }> };
    };
    const named = (await sc.named().staticCall()).toObject();
    const renamed = (await sc.renamed().staticCall()).toObject();
    expect(binToHex(named.address_ as Uint8Array)).toBe(payloadHex);
    expect(named.timestamp_).toBe(0n);
    expect(binToHex(renamed.payload as Uint8Array)).toBe(payloadHex);
    expect(renamed.observedAt).toBe(0n);
  });

  it('keeps kernel struct argument encoding independent of address_ field names', async () => {
    const lockingBytecodeHex = binToHex(addressToLockScript(aliceAddress));
    const art = compileKernelString(`pragma solidcash >=0.8.0;
      contract ArgumentNames() {
        struct Named { address address_; bigint timestamp_; }
        struct Renamed { address payload; bigint observedAt; }
        function named(Named value) view returns (bool) {
          return value.address_ == hex"${lockingBytecodeHex}" && value.timestamp_ == 0;
        }
        function renamed(Renamed value) view returns (bool) {
          return value.payload == hex"${lockingBytecodeHex}" && value.observedAt == 0;
        }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    expect(art.messageBus?.convention).toBe('kernel-row-loop');
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, {}, { saltContract: true },
    );
    const sc = new StatefulContract(categoryId, art, provider) as unknown as {
      named: (value: Record<string, unknown>) => { staticCall: () => Promise<boolean> };
      renamed: (value: Record<string, unknown>) => { staticCall: () => Promise<boolean> };
    };

    expect(await sc.named({ address_: aliceAddress, timestamp_: 0n }).staticCall()).toBe(true);
    expect(await sc.renamed({ payload: aliceAddress, observedAt: 0n }).staticCall()).toBe(true);
  });

  it('reads a struct view return with .toObject()', async () => {
    const sc = await deploy() as unknown as { set: Function; getPt: Function };
    await (sc.set(3n, 4n) as { send: () => Promise<unknown> }).send();
    const pt = await (sc.getPt() as { staticCall: () => Promise<{ toObject: () => unknown; x: bigint }> }).staticCall();
    expect(pt.toObject()).toEqual({ x: 3n, y: 4n });
    expect(pt.x).toBe(3n); // named field access
    expect(Object.keys(pt as object)).toEqual(['x', 'y']); // accessor non-enumerable
  });

  it('multi-value (tuple) reads resolve one component per declared output', async () => {
    const sc = await deploy() as unknown as { set: Function; both: Function };
    await (sc.set(5n, 9n) as { send: () => Promise<unknown> }).send();
    // `both()` declares two outputs. The read event carries one encoded component per declared output, and the
    // decoder fails closed when the carrier does not decode to exactly that tuple (see `deriveReturnValue`), so
    // a short or mistyped carrier cannot silently produce a wrong pair.
    expect(await (sc.both() as { staticCall: () => Promise<bigint[]> }).staticCall()).toEqual([5n, 9n]);
  });

  it('a read does not consume state (repeatable, no mutation)', async () => {
    const sc = await deploy() as unknown as { set: Function; sum: Function };
    await (sc.set(3n, 4n) as { send: () => Promise<unknown> }).send();
    expect(await (sc.sum() as { staticCall: () => Promise<bigint> }).staticCall()).toBe(7n);
    expect(await (sc.sum() as { staticCall: () => Promise<bigint> }).staticCall()).toBe(7n);
  });
});

// A view that takes arguments (the getJob(id) / balanceOf(addr) shape).
const ARG_SRC = `pragma solidcash >=0.8.0;
contract A() {
  bigint base;
  function set(bigint b) { this.base = b; }
  function plus(bigint k) view returns (bigint) { return this.base + k; }
}`;

describe('StatefulFunctionCall.staticCall() - with arguments', () => {
  it('passes call args into the read (getJob(id) shape)', async () => {
    const art = compileString(ARG_SRC);
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, { base: 0n }, { saltContract: true },
    );
    const sc = new StatefulContract(categoryId, art, provider) as unknown as {
      set: (b: bigint) => { send: () => Promise<unknown> };
      plus: (k: bigint) => { staticCall: () => Promise<bigint> };
    };
    await sc.set(10n).send();
    expect(await sc.plus(5n).staticCall()).toBe(15n);
    expect(await sc.plus(0n).staticCall()).toBe(10n);
  });
});

describe('StatefulFunctionCall.staticCall() - exact loop-array returns', () => {
  it('replaces a preseeded one-row parent result with the resolved external value', async () => {
    const options = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;
    const artifact = compileKernelString(`pragma solidcash >=0.8.0;
      contract ArrayView() {
        function rows() public pure returns (int[] memory) {
          int[] memory result = new int[](1);
          result[0] = 0;
          return result;
        }
      }`, options);
    const producerArtifact = compileKernelString(`pragma solidcash >=0.8.0;
      contract ScalarProducer() {
        function value() public pure returns (int) { return 0; }
      }`, options);
    const provider = createTestProvider();
    const view = new StatefulContract('ab'.repeat(32), artifact, provider);
    type ProbeBuilder = {
      __derivedReturnBlob?: Uint8Array;
      getExternalCallUtxoGroups: () => Array<{
        loopResultArrayOutput: number;
        loopMaximumOccurrences: number;
        loopReturnCommitments: Uint8Array[];
        logicalArtifact: typeof producerArtifact;
        logicalFunctionName: string;
        resolveLoopReturnCommitment: (occurrence: number) => Promise<Uint8Array>;
        resolveLoopReturnValue: (occurrence: number) => Promise<bigint>;
      }>;
    };
    const provisional = encodePushdataValue([0n], 'int[]', artifact.structs);
    // 41n encodes to the single byte 41, which is the raw form this probe used to pass as a Uint8Array.
    const resolved = encodePushdataValue(41n, 'int', producerArtifact.structs);
    let commitmentResolutions = 0;
    const builder: ProbeBuilder = {
      __derivedReturnBlob: provisional,
      getExternalCallUtxoGroups: () => [{
        loopResultArrayOutput: 0,
        loopMaximumOccurrences: 1,
        loopReturnCommitments: [resolved],
        logicalArtifact: producerArtifact,
        logicalFunctionName: 'value',
        resolveLoopReturnCommitment: async () => {
          commitmentResolutions += 1;
          return resolved;
        },
        // The parent must consume the authenticated commitment, never a separately re-evaluated value.
        resolveLoopReturnValue: async () => 99n,
      }],
    };
    const internals = view as unknown as {
      _createBuilder: (...args: unknown[]) => Promise<ProbeBuilder>;
      _deriveReturnValue: (functionName: string, args: unknown[]) => Promise<unknown>;
    };
    internals._createBuilder = async () => builder;

    expect(await internals._deriveReturnValue('rows', [])).toEqual([41n]);
    // reached=1 and one commitment was already seeded: replacement must not depend on growing this array.
    expect(builder.getExternalCallUtxoGroups()[0].loopReturnCommitments).toHaveLength(1);
    expect(commitmentResolutions).toBe(0);
  });
});

// The realistic EA getJob(id) shape: a view returning a struct read from a (vmap-default) mapping. Requires a real
// deploy so the sorted-mapping HEAD sentinel is auto-minted (setupStatefulUtxos does not create it).
const MAP_SRC = `pragma solidcash >=0.8.0;
contract M() {
  struct Job { bigint id; bigint pay; }
  mapping(bigint => Job) jobs;
  function put(bigint k, bigint id, bigint pay) { this.jobs[k] = Job(id, pay); }
  function getJob(bigint k) view returns (Job) { return this.jobs[k]; }
}`;

describe('StatefulFunctionCall.staticCall() - mapping-entry view (EA getJob shape)', () => {
  it('reads a struct entry from a real-deployed vmap mapping', async () => {
    const { MockNetworkProvider } = await import('../../src/network/mock/index.js');
    const art = compileString(MAP_SRC, { forceStateful: true });
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1);
    const f = (await alice.getUtxos()).find((u) => u.vout === 0 && !u.token);
    const res = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
    });
    const sc = res.contract.connect(alice) as unknown as {
      put: (k: bigint, id: bigint, pay: bigint) => { send: () => Promise<unknown> };
      getJob: (k: bigint) => { staticCall: () => Promise<{ pay: bigint; toObject: () => unknown }> };
    };
    await sc.put(7n, 100n, 250n).send();
    const job = await sc.getJob(7n).staticCall();
    expect(job.pay).toBe(250n);
    expect(job.toObject()).toEqual({ id: 100n, pay: 250n });
  });
});

describe('callStatic namespace (ethers v5 sc.callStatic.fn)', () => {
  it('reads a value via the callStatic namespace', async () => {
    const { MockNetworkProvider } = await import('../../src/network/mock/index.js');
    const art = compileString(MAP_SRC, { forceStateful: true });
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1);
    const f = (await alice.getUtxos()).find((u) => u.vout === 0 && !u.token);
    const res = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
    });
    const sc = res.contract.connect(alice) as unknown as {
      put: (k: bigint, id: bigint, pay: bigint) => { send: () => Promise<unknown> };
      callStatic: { getJob: (k: bigint) => Promise<{ pay: bigint; toObject: () => unknown }> };
    };
    await sc.put(3n, 11n, 42n).send();
    const job = await sc.callStatic.getJob(3n);
    expect(job.pay).toBe(42n);
    expect(job.toObject()).toEqual({ id: 11n, pay: 42n });
  });
});

describe('StatefulFunctionCall.staticCall() - missing mapping key (Solidity parity)', () => {
  it('returns the zero-struct for an absent key (vmap exclusion-proof read)', async () => {
    const { MockNetworkProvider } = await import('../../src/network/mock/index.js');
    const art = compileString(MAP_SRC, { forceStateful: true });
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1);
    const f = (await alice.getUtxos()).find((u) => u.vout === 0 && !u.token);
    const res = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
    });
    const sc = res.contract.connect(alice) as unknown as {
      put: (k: bigint, id: bigint, pay: bigint) => { send: () => Promise<unknown> };
      getJob: (k: bigint) => { staticCall: () => Promise<{ toObject: () => unknown }> };
    };
    await sc.put(7n, 100n, 250n).send();
    // An absent key reads as the default value (Solidity `mapping` returns the zero value).
    const missing = await sc.getJob(999n).staticCall();
    expect(missing.toObject()).toEqual({ id: 0n, pay: 0n });
  });
});

describe('StatefulFunctionCall.staticCall() - scalar return types (bool/bytes)', () => {
  it('decodes bool and bytes returns', async () => {
    const { MockNetworkProvider } = await import('../../src/network/mock/index.js');
    const art = compileString(
      'pragma solidcash >=0.8.0;\n'
      + 'contract T() { bigint n; function set(bigint x) { this.n = x; }\n'
      + '  function isBig() view returns (bool) { return this.n > 10; }\n'
      + '  function tag() view returns (bytes4) { return 0xdeadbeef; } }',
      { forceStateful: true },
    );
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1);
    const f = (await alice.getUtxos()).find((u) => u.vout === 0 && !u.token);
    const res = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
    });
    const sc = res.contract.connect(alice) as unknown as {
      set: (x: bigint) => { send: () => Promise<unknown> };
      isBig: () => { staticCall: () => Promise<boolean> };
      tag: () => { staticCall: () => Promise<Uint8Array> };
    };
    await sc.set(50n).send();
    expect(await sc.isBig().staticCall()).toBe(true);
    expect(binToHex(await sc.tag().staticCall())).toBe('deadbeef');
  });
});
