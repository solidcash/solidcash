import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256, type Artifact, type ExternalCallExpression } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A call inside a branch whose arm rewrites, before the call, the field the branch's predicate reads.
 *
 * The predicate is evaluated where the branch starts, so the call site's published condition reads the field as it
 * stood there. It was serialized against the statements that dominate the call, which include the arm's own write,
 * so `if (jobs[i].state == 1) { jobs[i].state = 0; ...call... }` published `0 == 1` and the hop's planner dropped a
 * call the body makes. The shape is driven through the shipped compiler, proxy hop, derivation and machine.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`branch predicate after arm write ${label}`)));
}

const SINK_CATEGORY = idOf('sink');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');
const CALLER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Job { int state; int kind; }'
  + ' interface ISink { function note(int id, int kind); }'
  + ' contract Sink { int public seen; function note(int id, int kind) { require(id >= 0); require(kind > 0); } }'
  + ' contract Root {'
  + '   address public implementation;'
  + '   address public sink;'
  + '   Job[] public jobs;'
  + '   function initialize(address s) { this.sink = s; this.jobs.push(Job(1, 6)); require(true); }'
  + '   function close(int id) {'
  + '     if (this.jobs[id].state == 1) {'
  + '       this.jobs[id].state = 0;'
  + '       ISink(this.sink).note(id, this.jobs[id].kind);'
  + '     }'
  + '     require(true);'
  + '   }'
  + '   function reopen(int id) {'
  + '     this.jobs[id].state = 1;'
  + '     if (this.jobs[id].state == 1) { this.jobs[id].state = 0; ISink(this.sink).note(id, 1); }'
  + '     require(true);'
  + '   }'
  + '   function settle(int id) {'
  + '     if (this.jobs[id].state == 1) { require(true); }'
  + '     else { this.jobs[id].state = 1; ISink(this.sink).note(id, 2); }'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const sink = artifacts.Sink!;
const root = artifacts.Root!;

/** The condition the compiler publishes for an entry's one call site. */
function conditionOf(artifact: Artifact, entry: string): ExternalCallExpression | undefined {
  return artifact.abi.find((row) => row.name === entry)!.externalCalls![0]!.condition;
}

/** `jobs[id].state == value`, with the field read as the branch's own predicate reads it. */
function stateEquals(value: string): ExternalCallExpression {
  return {
    kind: 'binary', operator: '==',
    left: {
      kind: 'field', name: 'state', type: 'int256',
      expression: {
        kind: 'stateAccess', name: 'jobs', type: 'Job',
        args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 0 } }],
      },
    },
    right: { kind: 'literal', type: 'bigint', value },
  } as ExternalCallExpression;
}

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

interface Deployed {
  readonly network: MockNetworkProvider;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
}

/** Deploys the sink, then the root behind its proxy holding one job at state 1. */
async function deployShape(): Promise<Deployed> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  await fundShippedFacets(network);
  const sinkCoin = funding(SINK_CATEGORY);
  await network.addUtxo(wallet.address, sinkCoin);
  await deployStatefulContract(sink, [], {
    fundingUtxo: sinkCoin, funder, changeAddress: wallet.address, provider: network,
  });
  for (const categoryId of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const initCoin = funding(idOf('initialize coin'));
  const callCoin = funding(idOf('call coin'));
  for (const coin of [initCoin, callCoin]) await network.addUtxo(binToHex(CALLER_LOCK), coin);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: {
      functionName: 'initialize',
      args: [deployMaster(sink, hexToBin(SINK_CATEGORY), VALIDATOR_PROGRAM).address],
    },
    callerLockingBytecode: CALLER_LOCK,
    callerFunding: { utxo: initCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    network,
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    changeAddress: wallet.address,
    callCoin,
  };
}

/** The deployment the refusal and the acceptance share, and the chain as it stood when it was done. */
interface Shape {
  readonly deployed: Deployed;
  readonly snapshot: SnapshotRestorer;
}

let shapeRun: Promise<Shape> | undefined;

/** One deployment serves both hops, each rewinding the chain to it first. */
async function deployedShape(): Promise<Deployed> {
  shapeRun ??= (async (): Promise<Shape> => {
    const deployed = await deployShape();
    return { deployed, snapshot: await deployed.network.takeSnapshot() };
  })();
  const shape = await shapeRun;
  await shape.snapshot.restore();
  return shape.deployed;
}

/** `close(0)` through the shipped hop, planned from `implementation`'s published routing. */
function close(deployed: Deployed, implementation: Artifact): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: deployed.network,
    implementationArtifact: implementation,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: deployed.proxyCategoryId,
    implementationCategoryId: deployed.implementationCategoryId,
    functionName: 'close',
    args: [0n],
    externals: { ISink: { artifact: sink, categoryId: SINK_CATEGORY } },
    callerUtxo: deployed.callCoin,
    callerLockingBytecode: CALLER_LOCK,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: deployed.changeAddress,
    vm: compositionMachine(),
  });
}

describe('a call inside a branch whose arm rewrites the field its predicate reads', () => {
  it('publishes the predicate as it stands where the branch starts', () => {
    // The arm's own `state = 0` does not reach the predicate; a write before the branch does, and an else arm's
    // write reaches neither.
    expect(conditionOf(root, 'close')).toStrictEqual(stateEquals('1'));
    expect(conditionOf(root, 'reopen')).toStrictEqual({
      kind: 'binary', operator: '==',
      left: { kind: 'literal', type: 'int256', value: '1' }, right: { kind: 'literal', type: 'bigint', value: '1' },
    });
    expect(conditionOf(root, 'settle')).toStrictEqual({ kind: 'unary', operator: '!', expression: stateEquals('1') });
  });

  it('refuses the plan the arm-folded predicate implied: the machine requires the call the body makes', async () => {
    const deployed = await deployedShape();
    // The routing the compiler used to publish, `0 == 1`, makes the planner place no call for the site; the frame's
    // own program then makes the call and the machine refuses the plan that states none.
    const folded = JSON.parse(JSON.stringify(root)) as Artifact;
    folded.abi.find((row) => row.name === 'close')!.externalCalls![0]!.condition = {
      kind: 'binary', operator: '==',
      left: { kind: 'literal', type: 'int256', value: '0' }, right: { kind: 'literal', type: 'bigint', value: '1' },
    } as ExternalCallExpression;
    await expect(close(deployed, folded)).rejects.toThrow(new RegExp('the implementation\'s "close" entry did not '
      + 'settle through the proxy: frame "implementation-master" of Root\\.close\\(\\) at line \\d+: no source message '
      + '\\(Program '));
    // Nothing was broadcast: the caller's coin is still live.
    const live = await deployed.network.getUtxosForLockingBytecode(CALLER_LOCK);
    expect(live.some((utxo) => utxo.txid === deployed.callCoin.txid)).toBe(true);
  });

  it('accepts the plan the published predicate gives: the arm\'s call is placed and every input accepted', async () => {
    const deployed = await deployedShape();
    const result = await close(deployed, root);

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.draft.blockOf('implementation-master').calls).toHaveLength(1);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      'Sink.note()', 'Root.close()', 'RootProxy.__fallback()',
    ]);
  });
});
