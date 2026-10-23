import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hexToBin } from '@bitauth/libauth';
import {
  bytesToHex, hash256, parsePushdataCommitment, validatorAddress, type Artifact,
} from '@solidcash/utils';
import { framedValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import { planHopExternalCalls } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A proxied entry whose own body makes external calls.
 *
 * A framed body binds each external call to its own frame's k-th call record, so a hop that runs such an entry
 * has to state the calls the entry makes and run each callee as a frame of its own. The deployment is driven only
 * through the shipped deploy/compose/derive/machine/broadcast path, and the state is read back through the
 * shipped deployment reader.
 */

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const ORACLE_CATEGORY = '55'.repeat(31) + 'aa';
const ESCROW_CATEGORY = '66'.repeat(31) + '99';
const WRITER_CATEGORY = '77'.repeat(31) + '88';
const GUARD_CATEGORY = '88'.repeat(31) + '77';
const LEDGER_CATEGORY = '99'.repeat(31) + '66';
const ORACLE_ADDRESS = validatorAddress(hexToBin(ORACLE_CATEGORY), VALIDATOR_PROGRAM);
const ESCROW_ADDRESS = validatorAddress(hexToBin(ESCROW_CATEGORY), VALIDATOR_PROGRAM);
const WRITER_ADDRESS = validatorAddress(hexToBin(WRITER_CATEGORY), VALIDATOR_PROGRAM);
const GUARD_ADDRESS = validatorAddress(hexToBin(GUARD_CATEGORY), VALIDATOR_PROGRAM);
const LEDGER_ADDRESS = validatorAddress(hexToBin(LEDGER_CATEGORY), VALIDATOR_PROGRAM);
const hexOf = (bytes: Uint8Array): string => binToHex(bytes);
/** The locked P2PKH the fixture's `address` arguments name. */
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
/** What the composer's plan gives each facet input; a facet holds no token and pays its own fee share. */
const FACET_SATOSHIS = 10_000n;

// The callees carry a record each: the oracle's entry returns a field of it, and the escrow's entry reads one.
// `Impl`'s entries read their own record beside the call, so the frame's segments declare the record it touches.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IOracle { function amountOf() view returns (int); }'
  + ' interface IWriter { function bump(); }'
  + ' interface IGuard { function bump(); }'
  + ' interface ILedger { function record(int id, address author, address subject, bytes32 reference, string memo); function noteOf(int id) view returns (Note); }'
  + ' struct Note { address author; address subject; bytes32 reference; string memo; int seen; }'
  + ' contract Oracle {'
  + '   int public answer;'
  + '   constructor() { this.answer = 5; }'
  + '   function amountOf() view returns (int) { return this.answer; }'
  + ' }'
  + ' contract Escrow {'
  + '   int public touched;'
  + '   function settle() { require(this.touched == 0); }'
  + ' }'
  + ' contract Writer {'
  + '   int public count;'
  + '   function bump() { this.count = this.count + 1; require(this.count > 0); }'
  + ' }'
  // A callee whose body writes its record on both sides of a call, so the frame's own record is closed once per
  // segment it moved in and the value between the two closures is one only the body computes.
  + ' contract Guard {'
  + '   int public count;'
  + `   function bump() { this.count = this.count + 1; require(IOracle(0x${hexOf(ORACLE_ADDRESS)}).amountOf() > 0); this.count = this.count + 1; require(this.count > 0); }`
  + ' }'
  // A callee whose body stores a mapping value it builds from its own arguments: the node's value is longer than
  // its tail holds, so the write lays a run of chunk records whose width only the value's bytes decide.
  + ' contract Ledger {'
  + '   int public written;'
  + '   mapping(int => Note) public notes;'
  + '   function record(int id, address author, address subject, bytes32 reference, string memo) {'
  + '     int seen = IOracle(0x' + hexOf(ORACLE_ADDRESS) + ').amountOf();'
  + '     this.notes[id] = Note(author, subject, reference, memo, seen);'
  + '     this.written = id + 1;'
  + '   }'
  + '   function noteOf(int id) view returns (Note) { return this.notes[id]; }'
  + ' }'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public total;'
  + '   function initialize(address expected) { require(msg.sender == expected); this.initialized = 1; }'
  + `   function probe() { require(IOracle(0x${hexOf(ORACLE_ADDRESS)}).amountOf() > this.total); require(true); }`
  + `   function write() { IWriter(0x${hexOf(WRITER_ADDRESS)}).bump(); require(this.total >= 0); }`
  + `   function guard() { IGuard(0x${hexOf(GUARD_ADDRESS)}).bump(); require(this.total >= 0); }`
  + `   function ledger(int id, address author, address subject, bytes32 reference, string memo) { ILedger(0x${hexOf(LEDGER_ADDRESS)}).record(id, author, subject, reference, memo); require(this.total >= 0); }`
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const impl = artifacts.Impl!;
const oracle = artifacts.Oracle!;
const escrow = artifacts.Escrow!;
const writer = artifacts.Writer!;
const guard = artifacts.Guard!;
const ledger = artifacts.Ledger!;

// Shapes the artifact compiles but the planner used to refuse by name: an occurrence the source leaves open, a
// target the entry's own code computes, and an entry that mixes a guarded call with a loop.
const UNFIXED = compileStringMulti('pragma solidcash ^0.14.0;'
  + ' interface IOracle { function amountOf() view returns (int); }'
  + ' interface IEscrow { function settle(); }'
  + ' contract Oracle { int public answer; function amountOf() view returns (int) { return this.answer; } }'
  + ' contract Looping {'
  + `   function spin(int n) { for (int i = 0; i < n; i = i + 1) { require(IOracle(0x${hexOf(ORACLE_ADDRESS)}).amountOf() > 0); } require(true); }`
  + ' }'
  + ' contract Target {'
  + '   address public foo;'
  + '   function go() { require(IOracle(this.foo).amountOf() > 0); require(true); }'
  + ' }'
  + ' contract Mixed {'
  + '   address public sink;'
  + '   function run(bool go, int n) {'
  + `     if (go) { IEscrow(0x${hexOf(ESCROW_ADDRESS)}).settle(); }`
  + '     for (int i = 0; i < n; i = i + 1) { require(IOracle(this.sink).amountOf() > 0); }'
  + '     require(true);'
  + '   }'
  + ' }', { composition: 'framed' });

// Two entries that call each other, each at an address baked into the other's code, so the planner is asked to
// place a contract it already placed when it recurses.
const CYCLE_A_CATEGORY = 'aa'.repeat(31) + '55';
const CYCLE_B_CATEGORY = 'bb'.repeat(31) + '44';
const CYCLE_A_ADDRESS = validatorAddress(hexToBin(CYCLE_A_CATEGORY), VALIDATOR_PROGRAM);
const CYCLE_B_ADDRESS = validatorAddress(hexToBin(CYCLE_B_CATEGORY), VALIDATOR_PROGRAM);
const CYCLE = compileStringMulti('pragma solidcash ^0.14.0;'
  + ' interface ICycleB { function y(); }'
  + ' interface ICycleA { function x(); }'
  + ` contract CycleA { int public seen; function x() { ICycleB(0x${hexOf(CYCLE_B_ADDRESS)}).y(); require(true); } }`
  + ` contract CycleB { int public seen; function y() { ICycleA(0x${hexOf(CYCLE_A_ADDRESS)}).x(); require(true); } }`,
{ composition: 'framed' });

/** The record's own state, read back through the shipped deployment reader and decoded as a field map. */
async function recordState(network: MockNetworkProvider, categoryId: string): Promise<string> {
  const deployment = await readFramedDeployment(network, categoryId, impl.stateLayout!);
  return bytesToHex(new Uint8Array(hexToBin(deployment.records[0]!.token!.nft!.commitment)));
}

/** The `count` field the callee's own record carries, decoded with the shipped state decoder. */
async function recordCount(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string,
): Promise<bigint> {
  const deployment = await readFramedDeployment(network, categoryId, artifact.stateLayout!);
  const commitment = bytesToHex(new Uint8Array(hexToBin(deployment.records[0]!.token!.nft!.commitment)));
  return parsePushdataCommitment(commitment, artifact.stateLayout!, 0).count as bigint;
}

/** The `count` field the writer's own record carries. */
function writerCount(network: MockNetworkProvider): Promise<bigint> {
  return recordCount(network, writer, WRITER_CATEGORY);
}

/** The `count` field the guarded callee's own record carries. */
function guardCount(network: MockNetworkProvider): Promise<bigint> {
  return recordCount(network, guard, GUARD_CATEGORY);
}

/** The fields the ledger callee's own record carries, decoded with the shipped state decoder. */
async function ledgerFields(network: MockNetworkProvider): Promise<Record<string, unknown>> {
  const deployment = await readFramedDeployment(network, LEDGER_CATEGORY, ledger.stateLayout!);
  const commitment = bytesToHex(new Uint8Array(hexToBin(deployment.records[0]!.token!.nft!.commitment)));
  return parsePushdataCommitment(commitment, ledger.stateLayout!, 0);
}

/** Deploys one callee at `categoryId`, so a hop's call has a live deployment to run against. */
async function deployCallee(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string, threadCount = 1,
): Promise<void> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const funding = { txid: categoryId, vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(source.address, funding);
  await deployStatefulContract(artifact, [], {
    fundingUtxo: funding, funder, changeAddress: source.address, provider: network, threadCount,
  });
}

/** The contracts the entries call, keyed by the interface each call goes through. */
function externals(): Readonly<Record<string, { artifact: Artifact; categoryId: string }>> {
  return {
    IOracle: { artifact: oracle, categoryId: ORACLE_CATEGORY },
    IEscrow: { artifact: escrow, categoryId: ESCROW_CATEGORY },
    IWriter: { artifact: writer, categoryId: WRITER_CATEGORY },
    IGuard: { artifact: guard, categoryId: GUARD_CATEGORY },
    ILedger: { artifact: ledger, categoryId: LEDGER_CATEGORY },
  };
}

/**
 * Deploys both callees, then the implementation and its proxy, and broadcasts the initialize hop.
 *
 * The callees are deployed at the categories the implementation's address literals were compiled from, so each
 * call's target names the address the deployed callee actually presents.
 */
async function deployedWithCallees(network: MockNetworkProvider): Promise<{
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
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

  const callees: readonly [Artifact, string][] =
    [[oracle, ORACLE_CATEGORY], [escrow, ESCROW_CATEGORY], [writer, WRITER_CATEGORY], [guard, GUARD_CATEGORY],
      [ledger, LEDGER_CATEGORY]];
  for (const [artifact, categoryId] of callees) {
    const funding = { txid: categoryId, vout: 0, satoshis: 500_000n };
    await network.addUtxo(source.address, funding);
    await deployStatefulContract(artifact, [], {
      fundingUtxo: funding, funder, changeAddress: source.address, provider: network,
    });
  }

  // The validator runs as a head plus one input per facet, each locked by its own code and holding no token, so
  // any live UTXO at the facet's lock serves it.
  const facets = framedValidator.buildValidatorFacets();
  for (const [index, code] of facets.entries()) {
    const lock = encodeLockingBytecodeP2sh32(hash256(code));
    await network.addUtxo(hexOf(lock), {
      txid: (0x70 + index).toString(16).padStart(2, '0').repeat(32),
      vout: 0,
      satoshis: FACET_SATOSHIS,
    });
  }

  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: '33'.repeat(32), vout: 0, satoshis: 300_000n };
  const callCoin = { txid: '44'.repeat(32), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(source.address, coin);
  for (const coin of [hopCoin, callCoin]) await network.addUtxo(hexOf(deployerLock), coin);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: impl,
    proxyArtifact: buildProxyArtifact(impl),
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [deployerLock] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: hopCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, callCoin, funder: callerFunder,
  };
}

/** A deployment with its callees, on the network that holds it. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly funded: Awaited<ReturnType<typeof deployedWithCallees>>;
}

let deployedRun: Promise<Deployed> | undefined;

/**
 * The one deployment the hop cases share: the first call enters with the coin it funded, a later one with a fresh
 * coin at `txid`. Only the static read broadcasts, and it writes no record.
 */
async function sharedDeployment(txid?: string): Promise<Deployed> {
  deployedRun ??= (async (): Promise<Deployed> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    return { network, funded: await deployedWithCallees(network) };
  })();
  const deployed = await deployedRun;
  if (txid === undefined) return deployed;
  const callCoin = { txid, vout: 0, satoshis: 300_000n };
  await deployed.network.addUtxo(hexOf(deployed.funded.deployerLock), callCoin);
  return { network: deployed.network, funded: { ...deployed.funded, callCoin } };
}

describe('a proxied entry that calls another deployed contract', () => {
  it('plans the static read, runs the callee frame, accepts every contract input and broadcasts', async () => {
    const { network, funded } = await sharedDeployment();
    const afterInitialize = await recordState(network, funded.proxyCategoryId);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'probe',
      args: [],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The callee completes before the entry that called it, which completes before the fallback that entered it.
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual([`${oracle.contractName}.amountOf()`, `${impl.contractName}.probe()`, 'ImplProxy.__fallback()']);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The call is not a write, so the proxy's record is where the initialize hop left it.
    expect(await recordState(network, funded.proxyCategoryId)).toBe(afterInitialize);
  });

  it('refuses a call whose callee the deployment does not hold, naming the address', async () => {
    const { network, funded } = await sharedDeployment('44'.repeat(31) + 'c2');
    const before = await recordState(network, funded.proxyCategoryId);

    await expect(callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'probe',
      args: [],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/none of the deployment's contracts sits at that address/);

    expect(await recordState(network, funded.proxyCategoryId)).toBe(before);
  });

  it('settles a callee whose own body rewrites its record, at the value that body computed', async () => {
    const { network, funded } = await sharedDeployment('44'.repeat(31) + 'c3');
    expect(await writerCount(network)).toBe(0n);

    const outcome = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'write',
      args: [],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The callee's own frame declares the record it spends and closes against the commitment its body built, so
    // the record the transaction carries is the value the body computed rather than the one it was spent with.
    expect(outcome.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(outcome.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await writerCount(network)).toBe(1n);
  });

  it('chains a callee record its body writes on both sides of a call, and carries the last value out', async () => {
    const { network, funded } = await sharedDeployment('44'.repeat(31) + 'c4');
    expect(await guardCount(network)).toBe(0n);

    const outcome = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'guard',
      args: [],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The frame opens on the record, calls the oracle, and writes the record again, so its own close runs once per
    // segment: the value between the two closures is the one the body computed there, and the record the
    // transaction carries is the value the last closure left.
    expect(outcome.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(outcome.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await guardCount(network)).toBe(2n);
  });

  it('settles a callee that stores a mapping value it builds, laying the run its own bytes size', async () => {
    const { network, funded } = await sharedDeployment('44'.repeat(31) + 'c5');
    const MEMO = 'a note long enough that the node cannot hold its value inline';
    const NOTE_ID = 1n;

    const outcome = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'ledger',
      args: [NOTE_ID, aliceLock, aliceLock, new Uint8Array(32).fill(7), MEMO],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The value is the callee's own to compute, so the hop lays the run of chunk records from the bytes the body's
    // own pin close exposed: the node and its chunks are what the transaction carries, and the field beside them
    // advanced with the write.
    expect(outcome.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(outcome.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await ledgerFields(network)).toMatchObject({ written: NOTE_ID + 1n });
    // The value the node holds is the whole struct, read back through the shipped read path.
    const read = await readFramedEntry({
      provider: network, artifact: ledger, categoryId: LEDGER_CATEGORY, functionName: 'noteOf',
      args: [NOTE_ID], externals: externals(), vm: compositionMachine(),
    });
    expect(read.accepted, read.objection).toBe(true);
    expect(read.values).toStrictEqual([{ author: aliceLock, subject: aliceLock,
      reference: new Uint8Array(32).fill(7), memo: MEMO, seen: 5n }]);
  });

  it("refuses a loop whose turns exceed the callee's own master pool, naming the pool", async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    // The callee holds one master, so the loop's three reaches cannot each be given an input of their own.
    await deployCallee(network, oracle, ORACLE_CATEGORY);
    await expect(planHopExternalCalls({
      provider: network,
      artifact: UNFIXED.Looping!,
      functionName: 'spin',
      args: [3n],
      externals: externals(),
      validatorProgram: VALIDATOR_PROGRAM,
    })).rejects.toThrow(/reaches "Oracle".*holds 1 master\(s\), so it cannot be entered 3 time\(s\)/);
  });

  it("refuses a target held in a state field the caller's own state does not carry, naming it", async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await deployCallee(network, oracle, ORACLE_CATEGORY);
    await expect(planHopExternalCalls({
      provider: network,
      artifact: UNFIXED.Target!,
      functionName: 'go',
      args: [],
      externals: externals(),
      validatorProgram: VALIDATOR_PROGRAM,
    })).rejects.toThrow(/targets the state field "foo", which the caller's own state does not hold as an address/);
  });

  it('states a guarded record and one record per loop turn for an entry that mixes both', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await deployCallee(network, oracle, ORACLE_CATEGORY, 3);
    await deployCallee(network, escrow, ESCROW_CATEGORY);
    const plan = await planHopExternalCalls({
      provider: network,
      artifact: UNFIXED.Mixed!,
      functionName: 'run',
      args: [true, 3n],
      externals: externals(),
      stateValues: { sink: ORACLE_ADDRESS },
      validatorProgram: VALIDATOR_PROGRAM,
    });
    // One record for the guarded call, then one per turn of the loop, whose target the entry's own state holds.
    expect(plan.calls).toHaveLength(4);
    expect(bytesToHex(plan.calls[0]!.target)).toBe(hexOf(ESCROW_ADDRESS));
    expect(plan.calls.slice(1).every((call) => bytesToHex(call.target) === hexOf(ORACLE_ADDRESS))).toBe(true);
  });

  it('refuses a contract a call reaches below itself, naming the cycle', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const cycleA = CYCLE.CycleA!;
    const cycleB = CYCLE.CycleB!;
    await deployCallee(network, cycleB, CYCLE_B_CATEGORY);
    // The implementation's own entry reaches a callee, whose entry reaches the implementation again: a composition
    // gives each contract one block, so the second placement is refused.
    await expect(planHopExternalCalls({
      provider: network,
      artifact: cycleA,
      functionName: 'x',
      args: [],
      externals: {
        ICycleB: { artifact: cycleB, categoryId: CYCLE_B_CATEGORY },
        ICycleA: { artifact: cycleA, categoryId: CYCLE_A_CATEGORY },
      },
      validatorProgram: VALIDATOR_PROGRAM,
    })).rejects.toThrow(/reaches "CycleA", which this hop already places/);
  });
});
