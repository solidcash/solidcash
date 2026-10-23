import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  Contract,
  SignatureTemplate,
} from '../../../src/index.js';
import { providerUnixLocktime } from '../../../src/stateful/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Ahead of the ladder, MS6: the time-gated challenge, driven through the shipped proxy hop (`callFramedProxyEntry`).
 *
 * The root, behind a generated proxy, keeps its jobs in a dynamic array of structs; its `dispute`, entered by the
 * job's creator, marks the job disputed and, because the sender is the creator, calls a judge's guarded
 * `challenge`, then calls a store behind its own proxy that gates on the root proxy's address and emits: four calls
 * (store 1, escrow 2, judge 1). The judge reads the escrow's terms (`STATIC`, a struct), admits only the escrow's
 * buyer or seller as its sender, requires a block time strictly after the payment's block with the language's own
 * `require(tx.time >= start + 1)`, calls the escrow's `challenge`, which gates on the judge's address and writes a
 * mapping, and emits one event above 128 bytes.
 *
 * The judge's guard writes its record on entry and on exit, so the hop declares that record in both segments and
 * learns the value the body computed between them. The flow keeps its time gate: the hop states the chain's own
 * time as its locktime, so a payment the chain has reached lets the dispute broadcast, while a payment beyond the
 * stated time is refused with both numbers; dropping the gate too settles the same way.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`time gated challenge ahead ${label}`)));
}

const JUDGE_CATEGORY = idOf('judge');
const ESCROW_CATEGORY = idOf('escrow');
const STORE_IMPL_CATEGORY = idOf('store implementation');
const STORE_PROXY_CATEGORY = idOf('store proxy');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');

const JOB_ID = 0n;
const ESCROW_ID = 3n;
/** The escrow's recorded payment time, a unix time below the mock chain's tip, so the gate can be satisfied. */
const PAID_AT = 1_699_990_000n;
/** A payment time beyond the mock chain's tip, so no chain time the hop can state reaches the gate. */
const FUTURE_AT = 2_000_000_000n;
/** Three 32-byte fields beside the id and the start: an event well above the 128-byte data-NFT size. */
const BIG = 452312848583266388373324160190187140051835877600158453279131187530910662656n;

const CREATOR_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const WORKER_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
const ARBITER_LOCK = encodeLockingBytecodeP2pkh(hexToBin('5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7'));
const ROOT_PROXY_ADDRESS = validatorAddress(hexToBin(ROOT_PROXY_CATEGORY), VALIDATOR_PROGRAM);

/** The judge as the flow has it, without its guard, and without its guard and its time gate. */
type Variant = 'flow' | 'unguarded' | 'untimed';

/** The four contracts; the variant decides what the judge keeps of its own guard and its time gate. */
function sourceFor(variant: Variant, paidAt: bigint): string {
  const guarded = variant === 'flow';
  return 'pragma solidcash ^0.14.0;'
    + ' struct Terms { address buyer; address seller; int start; }'
    + ' struct Job { address creator; address worker; address arbitrator; int state; int escrowId; int disputed; }'
    + ' interface IStore { function log(int id, int kind); }'
    + ' interface IJudge { function challenge(int id); }'
    + ' interface IEscrow { function termsOf(int id) view returns (Terms); function challenge(int id, int mark); }'
    + ' contract Escrow {'
    + '   address public judge;'
    + '   address public buyer;'
    + '   address public seller;'
    + '   mapping(int => int) public starts;'
    + '   mapping(int => int) public marks;'
    + '   constructor(address j, address b, address s) {'
    + `     this.judge = j; this.buyer = b; this.seller = s; this.starts[${ESCROW_ID}] = ${paidAt};`
    + '   }'
    + '   function termsOf(int id) view returns (Terms) { return Terms(this.buyer, this.seller, this.starts[id]); }'
    + '   function challenge(int id, int mark) { require(msg.sender == this.judge); this.marks[id] = mark; }'
    + ' }'
    + ' contract Judge {'
    + '   int public locked;'
    + '   address public escrow;'
    + '   event Challenged(int id, int start, int a, int b, int c);'
    + '   function challenge(int id) {'
    + (guarded ? '     require(this.locked == 0); this.locked = 1;' : '')
    + '     Terms memory t = IEscrow(this.escrow).termsOf(id);'
    + '     require(msg.sender == t.buyer || msg.sender == t.seller);'
    + (variant === 'untimed' ? '' : '     require(tx.time >= t.start + 1);')
    + '     IEscrow(this.escrow).challenge(id, 2);'
    + `     emit Challenged(id, t.start, ${BIG}, ${BIG}, ${BIG});`
    + (guarded ? '     this.locked = 0;' : '')
    + '   }'
    + ' }'
    + ' contract Store {'
    + '   address public implementation;'
    + '   address public owner;'
    + '   mapping(int => int) public counts;'
    + '   event Logged(int id, int kind);'
    + '   function initialize(address o) { this.owner = o; require(true); }'
    + '   function log(int id, int kind) {'
    + '     require(msg.sender == this.owner); this.counts[id] = this.counts[id] + 1; emit Logged(id, kind);'
    + '   }'
    + ' }'
    + ' contract Root {'
    + '   address public implementation;'
    + '   address public store;'
    + '   address public judge;'
    + '   Job[] public jobs;'
    + '   function initialize(address s, address j, address c, address w, address a, int id) {'
    + '     this.store = s; this.judge = j; this.jobs.push(Job(c, w, a, 1, id, 0)); require(true);'
    + '   }'
    + '   function dispute(int jobId) {'
    + '     require(this.jobs[jobId].creator == msg.sender || this.jobs[jobId].worker == msg.sender);'
    + '     require(this.jobs[jobId].state == 1);'
    + '     require(this.jobs[jobId].arbitrator != address(0));'
    + '     require(this.jobs[jobId].disputed == 0);'
    + '     this.jobs[jobId].disputed = 1;'
    + '     if (msg.sender == this.jobs[jobId].creator) { IJudge(this.judge).challenge(this.jobs[jobId].escrowId); }'
    + '     IStore(this.store).log(jobId, 8);'
    + '   }'
    + ' }';
}

type Artifacts = ReturnType<typeof compileStringMulti>;
const compiled = new Map<string, Artifacts>();
/** The four contracts compiled once per variant and payment time, on first use. */
function artifactsFor(variant: Variant, paidAt: bigint = PAID_AT): Artifacts {
  const key = `${variant}:${paidAt}`;
  let artifacts = compiled.get(key);
  if (artifacts === undefined) {
    artifacts = compileStringMulti(sourceFor(variant, paidAt), { composition: 'framed' });
    compiled.set(key, artifacts);
  }
  return artifacts;
}

/** One network holding the four contracts, a taken job, and a coin its creator can enter a hop with. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly artifacts: Artifacts;
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
}

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** Deploys the judge and the escrow, then the store and the root behind their proxies, the root holding one job. */
async function deployAll(artifacts: Artifacts): Promise<Deployed> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const judgeAddress = deployMaster(artifacts.Judge!, hexToBin(JUDGE_CATEGORY), VALIDATOR_PROGRAM).address;
  const escrowAddress = deployMaster(artifacts.Escrow!, hexToBin(ESCROW_CATEGORY), VALIDATOR_PROGRAM).address;
  await fundShippedFacets(network);

  // The escrow names the judge it admits and records the payment with the root proxy as its buyer.
  const judgeCoin = funding(JUDGE_CATEGORY);
  await network.addUtxo(wallet.address, judgeCoin);
  await deployStatefulContract(artifacts.Judge!, [], {
    fundingUtxo: judgeCoin, funder, changeAddress: wallet.address, provider: network,
    initialState: { locked: 0n, escrow: escrowAddress } as never,
  });
  const escrowCoin = funding(ESCROW_CATEGORY);
  await network.addUtxo(wallet.address, escrowCoin);
  await deployStatefulContract(artifacts.Escrow!, [judgeAddress, ROOT_PROXY_ADDRESS, WORKER_LOCK] as never, {
    fundingUtxo: escrowCoin, funder, changeAddress: wallet.address, provider: network,
  });
  for (const categoryId of [STORE_IMPL_CATEGORY, STORE_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const storeInitCoin = funding(idOf('store initialize coin'));
  const rootInitCoin = funding(idOf('root initialize coin'));
  const callCoin = funding(idOf('creator coin'));
  for (const coin of [storeInitCoin, rootInitCoin, callCoin]) await network.addUtxo(binToHex(CREATOR_LOCK), coin);

  const store = artifacts.Store!;
  const storeDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: store,
    proxyArtifact: buildProxyArtifact(store),
    implementationDeploy: { fundingUtxo: funding(STORE_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(STORE_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [ROOT_PROXY_ADDRESS] },
    callerLockingBytecode: CREATOR_LOCK,
    callerFunding: { utxo: storeInitCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(storeDeployment.initialize.broadcast).toBeDefined();

  const root = artifacts.Root!;
  const rootDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: {
      functionName: 'initialize',
      args: [storeDeployment.proxy.address, judgeAddress, CREATOR_LOCK, WORKER_LOCK, ARBITER_LOCK, ESCROW_ID],
    },
    callerLockingBytecode: CREATOR_LOCK,
    callerFunding: { utxo: rootInitCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();
  // The store and the escrow were seeded with the root proxy's address before the root existed.
  expect(bytesToHex(rootDeployment.proxy.address)).toBe(bytesToHex(ROOT_PROXY_ADDRESS));

  return {
    network,
    artifacts,
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    externals: {
      IJudge: { artifact: artifacts.Judge!, categoryId: JUDGE_CATEGORY },
      IEscrow: { artifact: artifacts.Escrow!, categoryId: ESCROW_CATEGORY },
      IStore: {
        artifact: store,
        categoryId: storeDeployment.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(store),
        implementationCategoryId: storeDeployment.implementation.categoryId,
      },
    },
    changeAddress: wallet.address,
    callCoin,
  };
}

/** The creator's dispute, entered on the root's proxy through the shipped hop. */
function dispute(deployed: Deployed): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: deployed.network,
    implementationArtifact: deployed.artifacts.Root!,
    proxyArtifact: buildProxyArtifact(deployed.artifacts.Root!),
    proxyCategoryId: deployed.rootProxyCategoryId,
    implementationCategoryId: deployed.rootImplementationCategoryId,
    functionName: 'dispute',
    args: [JOB_ID],
    externals: deployed.externals,
    callerUtxo: deployed.callCoin,
    callerLockingBytecode: CREATOR_LOCK,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: deployed.changeAddress,
    vm: compositionMachine(),
  });
}

/** True while the creator's coin is unspent, i.e. nothing was broadcast for the hop. */
async function coinLive(deployed: Deployed): Promise<boolean> {
  return (await deployed.network.getUtxosForLockingBytecode(CREATOR_LOCK))
    .some((utxo) => utxo.txid === deployed.callCoin.txid && utxo.vout === deployed.callCoin.vout);
}

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead (MS6): the time-gated challenge', () => {
  it('compiles the four contracts on the framed path', () => {
    for (const variant of ['flow', 'unguarded', 'untimed'] as const) {
      for (const name of ['Judge', 'Escrow', 'Store', 'Root']) {
        expect(artifactsFor(variant)[name]?.composition?.convention).toBe('framed');
      }
    }
  });

  it('settles the dispute whose judge writes its own record in two segments', async () => {
    const deployed = await deployAll(artifactsFor('flow'));
    const result = await dispute(deployed);

    // The judge's guard writes its record on entry and on exit, so the hop declares it in both segments and learns
    // the value the body computed between them before the frame's own close is compared.
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead (MS6): behind the judge\'s guard', () => {
  it('settles the dispute once the stated chain time reaches the gate', async () => {
    const deployed = await deployAll(artifactsFor('unguarded'));
    // Read the tip before the hop: broadcasting it mines a block, which advances the mock chain's own time.
    const locktime = providerUnixLocktime(deployed.network)!;
    const result = await dispute(deployed);

    // The hop states the chain's own time as its locktime, so the judge's `require(tx.time >= start + 1)` passes
    // and the whole flow broadcasts, exactly as it does with the gate dropped.
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.transaction.locktime).toBe(locktime);
  });

  it('refuses a gate strictly after the stated locktime, naming it', async () => {
    const deployed = await deployAll(artifactsFor('unguarded', FUTURE_AT));
    const locktime = providerUnixLocktime(deployed.network)!;

    // The escrow records a payment beyond the chain's tip, so the gate the judge reads is later than the time the
    // hop states; the machine's own word names both numbers, and nothing is broadcast.
    await expect(dispute(deployed)).rejects.toThrow(new RegExp('the call\'s callee "Judge\\.challenge\\(\\)" did '
      + 'not settle through the proxy: .*OP_CHECKLOCKTIMEVERIFY.*Transaction locktime: '
      + `${locktime}; required locktime: ${FUTURE_AT + 1n}`));
    expect(await coinLive(deployed)).toBe(true);
  });

  it('settles once the time gate is dropped too: every contract input is accepted and the hop broadcasts', async () => {
    const deployed = await deployAll(artifactsFor('untimed'));
    const result = await dispute(deployed);

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The escrow is entered twice below the judge, a read and a write, each on a master of its own.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      'Escrow.termsOf()', 'Escrow.challenge()', 'Judge.challenge()',
      'Store.log()', 'StoreProxy.__fallback()',
      'Root.dispute()', 'RootProxy.__fallback()',
    ]);
    expect(result.draft.layout.blocks.find((block) => block.contract === 'Escrow')!.masters).toHaveLength(2);
  });
});
