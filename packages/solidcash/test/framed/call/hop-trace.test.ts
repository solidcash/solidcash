import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { FrameKind, bytesToHex } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop traced from the plan through the frames the settle touches.
 *
 * The failing frame is not always the frame a refusal names: the reporter names the deepest frame the machine
 * refused on the draft as it stands, while the settle asked about one frame of the chain. The trace records both,
 * so the frame that failed is read from evidence rather than inferred from the reporter.
 */

// Categories and coin outpoints: 32-byte values whose bytes are not all the same, so a category cannot be mistaken
// for a placeholder by inspection.
const INNER_IMPL_CATEGORY = '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809';
const INNER_PROXY_CATEGORY = '2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a';
const OUTER_IMPL_CATEGORY = '3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b';
const OUTER_PROXY_CATEGORY = '4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c';
const INNER_INIT_TXID = '5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d';
const OUTER_INIT_TXID = '6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e';
const CALL_TXID = '708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f';

// `Inner.ping` reads the record the initialize hop left at 1 and accepts; `Inner.pingBad` requires 2, so the
// callee's own entry refuses. Both `Outer` entries reach `Inner` through the address their own record holds, which
// is the address `Inner`'s proxy presents, so the callee is placed as a proxy fallback plus the implementation
// entry it delegates to.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IInner { function ping(); function pingBad(); }'
  + ' contract Inner {'
  + '   address public implementation;'
  + '   int public hits;'
  + '   function initialize() { this.hits = 1; require(this.hits > 0); }'
  + '   function ping() { require(this.hits == 1); }'
  + '   function pingBad() { require(this.hits == 2); }'
  + ' }'
  + ' contract Outer {'
  + '   address public implementation;'
  + '   address public inner;'
  + '   function initialize(address target) { this.inner = target; require(true); }'
  + '   function runOk() { IInner(this.inner).ping(); require(true); }'
  + '   function run() { IInner(this.inner).pingBad(); require(true); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const inner = artifacts.Inner!;
const outer = artifacts.Outer!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/**
 * Deploys the callee behind its own proxy, then the caller behind its own, and returns what a call needs.
 *
 * The caller's initialize is handed the address the callee's proxy presents, so the caller's entry computes that
 * same address from its own record and the callee is resolved from it, not from a named external.
 */
async function deployThroughProxiedCallee(network: MockNetworkProvider): Promise<{
  readonly innerImplementationCategoryId: string;
  readonly outerProxyCategoryId: string;
  readonly outerImplementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  for (const coin of [
    funding(INNER_IMPL_CATEGORY), funding(INNER_PROXY_CATEGORY),
    funding(OUTER_IMPL_CATEGORY), funding(OUTER_PROXY_CATEGORY),
  ]) await network.addUtxo(source.address, coin);
  const innerInitCoin = funding(INNER_INIT_TXID);
  const outerInitCoin = funding(OUTER_INIT_TXID);
  const callCoin = funding(CALL_TXID);
  for (const coin of [innerInitCoin, outerInitCoin, callCoin]) {
    await network.addUtxo(binToHex(deployerLock), coin);
  }
  await fundShippedFacets(network);

  const innerDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: inner,
    proxyArtifact: buildProxyArtifact(inner),
    implementationDeploy: { fundingUtxo: funding(INNER_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(INNER_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: innerInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(innerDeployment.initialize.broadcast).toBeDefined();

  const outerDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    implementationDeploy: { fundingUtxo: funding(OUTER_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(OUTER_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [innerDeployment.proxy.address] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: outerInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(outerDeployment.initialize.broadcast).toBeDefined();

  return {
    innerImplementationCategoryId: innerDeployment.implementation.categoryId,
    outerProxyCategoryId: outerDeployment.proxy.categoryId,
    outerImplementationCategoryId: outerDeployment.implementation.categoryId,
    deployerLock,
    changeAddress: source.address,
    callCoin,
    funder: callerFunder,
  };
}

/** Enters one of the caller's entries through its proxy, naming no externals. */
function enter(
  network: MockNetworkProvider,
  funded: Awaited<ReturnType<typeof deployThroughProxiedCallee>>,
  functionName: string,
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    proxyCategoryId: funded.outerProxyCategoryId,
    implementationCategoryId: funded.outerImplementationCategoryId,
    functionName,
    args: [],
    callerUtxo: funded.callCoin,
    callerLockingBytecode: funded.deployerLock,
    funder: funded.funder,
    changeAddress: funded.changeAddress,
    vm: compositionMachine(),
  });
}

/** The message a call throws, or undefined for one that settles. */
async function callMessage(
  network: MockNetworkProvider,
  funded: Awaited<ReturnType<typeof deployThroughProxiedCallee>>,
  functionName: string,
): Promise<string | undefined> {
  return enter(network, funded, functionName)
    .then(() => undefined, (error: unknown) => (error instanceof Error ? error.message : String(error)));
}

/**
 * Runs `body` with the hop trace's stdout captured and `FRAMED_HOP_TRACE` set or unset; the environment and the
 * stream are restored before anything is asserted.
 */
async function withHopTrace(enabled: boolean, body: () => Promise<void>): Promise<readonly string[]> {
  const previous = process.env.FRAMED_HOP_TRACE;
  if (enabled) process.env.FRAMED_HOP_TRACE = '1';
  else delete process.env.FRAMED_HOP_TRACE;
  const lines: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array): boolean => {
    lines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stdout.write);
  try {
    await body();
  } finally {
    spy.mockRestore();
    if (previous === undefined) delete process.env.FRAMED_HOP_TRACE;
    else process.env.FRAMED_HOP_TRACE = previous;
  }
  return lines;
}

/** The trace lines a captured run produced, each already clipped to the trace's own bound. */
function tracedLines(lines: readonly string[]): readonly string[] {
  return lines.filter((line) => line.startsWith('HOPTRACE ')).map((line) => line.trimEnd());
}

type Funded = Awaited<ReturnType<typeof deployThroughProxiedCallee>>;

/** The deployment the cases share, and the chain as it stood when the deployment was done. */
interface World {
  readonly network: MockNetworkProvider;
  readonly funded: Funded;
  readonly snapshot: SnapshotRestorer;
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first, so no case reads another's broadcast. */
async function deployed(): Promise<World> {
  worldRun ??= (async (): Promise<World> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployThroughProxiedCallee(network);
    return { network, funded, snapshot: await network.takeSnapshot() };
  })();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** The one `runOk` hop that settles, which the first two cases read: its result and its trace. */
interface SettledHop {
  readonly funded: Funded;
  readonly result: FramedProxyCallResult;
  readonly traced: readonly string[];
}

let settledRun: Promise<SettledHop> | undefined;

/** The trace only observes the draft, so the traced hop settles as an untraced one would. */
function settledHop(): Promise<SettledHop> {
  settledRun ??= (async (): Promise<SettledHop> => {
    const { network, funded } = await deployed();
    let result: FramedProxyCallResult | undefined;
    const lines = await withHopTrace(true, async () => {
      result = await enter(network, funded, 'runOk');
    });
    return { funded, result: result!, traced: tracedLines(lines) };
  })();
  return settledRun;
}

describe('the hop trace', () => {
  it('lays the callee chain as a proxy fallback plus the implementation entry it delegates to, and settles it', async () => {
    const { funded, result, traced } = await settledHop();
    // The callee is resolved from the address the caller's record holds, with no externals named, and placed as
    // the root hop places its own proxy: the callee's delegate frame and its fallback run before the caller's.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      'Inner.ping()', 'InnerProxy.__fallback()', 'Outer.runOk()', 'OuterProxy.__fallback()',
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The callee's proxy leg delegates to the implementation's own master, at the address its category derives.
    const callee = result.draft.blockOf('callee-master-1');
    expect(callee.calls).toHaveLength(1);
    expect(callee.calls[0]!.kind).toBe(FrameKind.DELEGATE);
    expect(bytesToHex(callee.calls[0]!.target)).toBe(bytesToHex(
      deployMaster(inner, hexToBin(funded.innerImplementationCategoryId), VALIDATOR_PROGRAM).address));

    expect(traced.some((line) => line.includes('plan frame=proxy-master fn=OuterProxy.__fallback() kind=ROOT')))
      .toBe(true);
    expect(traced.some((line) => line.includes('plan frame=implementation-master fn=Outer.runOk() kind=DELEGATE')))
      .toBe(true);
    expect(traced.some((line) => line.includes('plan frame=callee-master-1 fn=InnerProxy.__fallback()')))
      .toBe(true);
    expect(traced.some((line) => line.includes('plan frame=callee-impl-master-2 fn=Inner.ping() kind=DELEGATE')))
      .toBe(true);
    // Every line is a single line under the trace's own bound.
    expect(traced.every((line) => line.length <= 200)).toBe(true);
    expect(traced.length).toBeGreaterThan(0);
  });

  it('records each frame\'s call records before and after an attempt, sentinel while unfilled', async () => {
    const { traced } = await settledHop();
    // The callee's fallback is settled on its own: its delegate reference is unfilled before the attempt fills it.
    const fallbackAttempt = traced.find((line) =>
      line.startsWith('HOPTRACE attempt callee=callee-master-1 '));
    expect(fallbackAttempt, traced.join('\n')).toBeDefined();
    expect(fallbackAttempt).toMatch(/refs-before=\[\?@unfilled->/);
    const fallbackDerived = traced.find((line) =>
      line.startsWith('HOPTRACE stop callee=callee-master-1 reason=derived'));
    expect(fallbackDerived).toBeDefined();
    expect(fallbackDerived).toMatch(/refs-after=\[callee-impl-master-2@\d+->/);

    // The implementation frame reads its own call record unfilled until the hop's derivation binds the callee.
    const entryAttempt = traced.find((line) =>
      line.startsWith('HOPTRACE attempt entry=implementation-master '));
    expect(entryAttempt, traced.join('\n')).toBeDefined();
    expect(entryAttempt).toMatch(/refs-before=\[\?@unfilled->/);
    const entryDerived = traced.find((line) =>
      line.startsWith('HOPTRACE stop entry=implementation-master reason=derived'));
    expect(entryDerived).toBeDefined();
    expect(entryDerived).toMatch(/refs-after=\[callee-master-1@\d+->/);
  });

  it('names the frame the settle evaluated and the frame the refusal reporter named', async () => {
    const { network, funded } = await deployed();
    let message: string | undefined;
    const lines = await withHopTrace(true, async () => {
      message = await callMessage(network, funded, 'run');
    });

    const traced = tracedLines(lines);
    const refused = traced.find((line) => line.includes('reason=refused'));
    expect(refused, traced.join('\n')).toBeDefined();
    // The frame the settle evaluated and the frame the reporter named are both on the line, so the failing frame
    // is read off the trace rather than inferred.
    expect(refused).toMatch(/evaluated=callee-impl-master-2 reported=callee-impl-master-2/);
    expect(traced.some((line) => line.includes('fn=Inner.pingBad() kind=DELEGATE'))).toBe(true);
    // The refusal names the callee entry and the frame the settle stopped on.
    expect(message).toMatch(/the call's callee "Inner\.pingBad\(\)" did not settle through the proxy/);
    expect(message).toMatch(/callee-impl-master-2/);
  });

  it('writes nothing when FRAMED_HOP_TRACE is unset', async () => {
    const { network, funded } = await deployed();
    let message: string | undefined;
    const lines = await withHopTrace(false, async () => {
      message = await callMessage(network, funded, 'run');
    });
    expect(lines.filter((line) => line.includes('HOPTRACE'))).toStrictEqual([]);
    // The untraced hop took the path the traced refusal above did.
    expect(message).toMatch(/the call's callee "Inner\.pingBad\(\)" did not settle through the proxy/);
  });
});
