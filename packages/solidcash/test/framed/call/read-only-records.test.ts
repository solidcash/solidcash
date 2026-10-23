import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { parsePushdataCommitment, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { encodeFunctionArgument, type FunctionArgument } from '../../../src/Argument.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Calls whose entry reads a record it does not write, or names only some of its contract's records, through the
 * shipped path.
 *
 * A framed frame declares the data records its entry names, then the node of each mapping key the entry reads and
 * does not write, and its body reads each at that place. An entry that reads a key and writes no mapping spends the
 * key's node on the entry covenant's read-only path and keeps it; an entry that touches only a later data record
 * spends that record and leaves the first unspent.
 */

const CATEGORY_HEX = '5a'.repeat(31) + 'a5';
const CALLER_TXID = '5b'.repeat(32);

const GATE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Gate {'
  + '   int public passes;'
  + '   mapping(address => int) allowance;'
  + '   function grant(address who, int amount) { this.allowance[who] = amount; }'
  + '   function pass(address who, int amount) {'
  + '     require(amount <= this.allowance[who]);'
  + '     this.passes = this.passes + 1;'
  + '   }'
  + '   function check(address who, int amount) { require(amount <= this.allowance[who]); }'
  + ' }';

/** Four 32-byte fields fill the first record, so the counter sits in the second. */
const WIDE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Wide {'
  + '   bytes32 public a;'
  + '   bytes32 public b;'
  + '   bytes32 public c;'
  + '   bytes32 public d;'
  + '   int public counter;'
  + '   mapping(address => int) marks;'
  + '   function bump() { this.counter = this.counter + 1; }'
  + '   function mark(address who) { this.counter = this.counter + 1; this.marks[who] = this.counter; }'
  + '   function setA(bytes32 v) { this.a = v; }'
  + '   function counterOf() view returns (int) { return this.counter; }'
  + ' }';

/** A key read in one mapping beside a write of another: the allow-list beside a balance. */
const CLUB_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Club {'
  + '   mapping(address => int) allowed;'
  + '   mapping(address => int) balances;'
  + '   function allow(address who) { this.allowed[who] = 1; }'
  + '   function credit(address to, int amount) {'
  + '     require(this.allowed[to] == 1);'
  + '     this.balances[to] = this.balances[to] + amount;'
  + '   }'
  + '   function balanceOf(address who) view returns (int) { return this.balances[who]; }'
  + ' }';

/** A key read beside a write of another key of the same mapping: the sender's balance beside the recipient's. */
const POOL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Pool {'
  + '   mapping(address => int) balances;'
  + '   function seed(address who, int amount) { this.balances[who] = amount; }'
  + '   function move(address to, int amount) {'
  + '     require(this.balances[msg.sender] >= amount);'
  + '     this.balances[to] = this.balances[to] + amount;'
  + '   }'
  + '   function balanceOf(address who) view returns (int) { return this.balances[who]; }'
  + ' }';

const gate = compileStringMulti(GATE_SOURCE, { composition: 'framed' }).Gate!;
const wide = compileStringMulti(WIDE_SOURCE, { composition: 'framed' }).Wide!;
const club = compileStringMulti(CLUB_SOURCE, { composition: 'framed' }).Club!;
const pool = compileStringMulti(POOL_SOURCE, { composition: 'framed' }).Pool!;

const HOLDER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x61));
const STRANGER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x62));

interface Deployed {
  readonly artifact: Artifact;
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/** Deploys the contract through the shipped deployment and funds the caller's own coin at its P2PKH lock. */
async function deploy(artifact: Artifact): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  const deployment = await deployStatefulContract(artifact, [], {
    provider,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, signature),
    changeAddress: funder.address,
  });
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  await provider.addUtxo(binToHex(callerLock), { txid: CALLER_TXID, vout: 0, satoshis: 200_000n });
  // The calls broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(provider);
  return { artifact, provider, categoryId: deployment.categoryId, callerLock, funder: signature.unlockP2PKH() };
}

/** Calls one entry with the caller's current coin: the largest tokenless UTXO at its lock, the last call's change. */
async function call(
  deployed: Deployed, functionName: string, args: readonly FunctionArgument[] = [],
): Promise<FramedCallResult> {
  const coins = (await deployed.provider.getUtxosForLockingBytecode(deployed.callerLock))
    .filter((utxo) => utxo.token === undefined)
    .sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1));
  return callFramedEntry({
    provider: deployed.provider,
    artifact: deployed.artifact,
    categoryId: deployed.categoryId,
    functionName,
    args,
    callerUtxo: coins[0]!,
    callerLockingBytecode: deployed.callerLock,
    funder: deployed.funder,
    vm: compositionMachine(),
  });
}

/** The live nodes of the allowance mapping, as the deployment's own classification reports them. */
async function allowanceNodes(deployed: Deployed): Promise<readonly string[]> {
  const deployment = await readFramedDeployment(deployed.provider, deployed.categoryId, gate.stateLayout!);
  return (deployment.nodesByCollection.get('allowance') ?? []).map((utxo) => utxo.token!.nft!.commitment);
}

let gateRun: Promise<Deployed> | undefined;

/**
 * One Gate, granted `HOLDER_LOCK` 500, serves the Gate cases: none grants again, and the first case's pass is the
 * deployment's first.
 */
function grantedGate(): Promise<Deployed> {
  gateRun ??= (async (): Promise<Deployed> => {
    const deployed = await deploy(gate);
    expect((await call(deployed, 'grant', [HOLDER_LOCK, 500n])).accepted).toBe(true);
    return deployed;
  })();
  return gateRun;
}

/** The slot a key's node carries. */
function slotOf(lock: Uint8Array): string {
  return binToHex(keyToSlotMulti([encodeFunctionArgument(lock, 'address') as Uint8Array]));
}

describe('an entry that reads a mapping key it does not write', () => {
  it('reads the key beside the data record it writes, and keeps the key\'s node', async () => {
    const deployed = await grantedGate();
    const granted = await allowanceNodes(deployed);

    const passed = await call(deployed, 'pass', [HOLDER_LOCK, 400n]);
    expect(passed.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(passed.broadcast).toBeDefined();
    expect(parsePushdataCommitment(binToHex(passed.writtenCommitments[0]!), gate.stateLayout!, 0).passes).toBe(1n);
    // The node the entry read is recreated as it was.
    expect(await allowanceNodes(deployed)).toStrictEqual(granted);
  });

  it('reads a key the list does not hold beside its predecessor, as the default', async () => {
    const deployed = await grantedGate();
    const nodes = await allowanceNodes(deployed);
    expect(nodes.some((node) => binToHex(decodeEntryCommitment(Uint8Array.from(Buffer.from(node, 'hex'))).slot)
      === slotOf(STRANGER_LOCK))).toBe(false);

    const zero = await call(deployed, 'pass', [STRANGER_LOCK, 0n]);
    expect(zero.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    const one = await call(deployed, 'pass', [STRANGER_LOCK, 1n]);
    expect(one.accepted).toBe(false);
  });

  it('reads the key in an entry that writes nothing, and is refused when it grants less', async () => {
    const deployed = await grantedGate();
    const checked = await call(deployed, 'check', [HOLDER_LOCK, 500n]);
    expect(checked.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    const refused = await call(deployed, 'check', [HOLDER_LOCK, 501n]);
    expect(refused.accepted).toBe(false);
    expect(refused.broadcast).toBeUndefined();
  });
});

let wideRun: Promise<{ readonly deployed: Deployed; readonly snapshot: SnapshotRestorer }> | undefined;

/** One Wide serves the Wide cases, each rewinding the chain to the deployment first. */
async function deployedWide(): Promise<Deployed> {
  wideRun ??= (async (): Promise<{ readonly deployed: Deployed; readonly snapshot: SnapshotRestorer }> => {
    const deployed = await deploy(wide);
    return { deployed, snapshot: await deployed.provider.takeSnapshot() };
  })();
  const shared = await wideRun;
  await shared.snapshot.restore();
  return shared.deployed;
}

describe('an entry that touches only a later data record', () => {
  it('writes that record and leaves the first unspent', async () => {
    const deployed = await deployedWide();
    const before = await readFramedDeployment(deployed.provider, deployed.categoryId, wide.stateLayout!);
    const first = before.records[0]!.token!.nft!.commitment;

    const bumped = await call(deployed, 'bump');
    expect(bumped.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    const ids = bumped.draft.layout.participants.map((placed) => placed.id);
    expect(ids).toContain('record-1');
    expect(ids).not.toContain('record-0');
    expect(binToHex(bumped.writtenCommitments[0]!)).toBe(first);
    expect(parsePushdataCommitment(binToHex(bumped.writtenCommitments[1]!), wide.stateLayout!, 1).counter).toBe(1n);
    // The first record is still written through its own entry.
    const set = await call(deployed, 'setA', [new Uint8Array(32).fill(7)]);
    expect(set.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  });

  it('writes that record beside a mapping key, declaring the first kept ahead of the key\'s group', async () => {
    const deployed = await deployedWide();
    const before = await readFramedDeployment(deployed.provider, deployed.categoryId, wide.stateLayout!);
    const first = before.records[0]!.token!.nft!.commitment;

    const marked = await call(deployed, 'mark', [HOLDER_LOCK]);
    expect(marked.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    // A batch's groups follow every data record, so the frame declares the one it names first and then the other.
    const ids = marked.draft.layout.participants.map((placed) => placed.id);
    expect(ids.indexOf('record-1')).toBeLessThan(ids.indexOf('record-0'));
    expect(binToHex(marked.writtenCommitments[0]!)).toBe(first);
    expect(parsePushdataCommitment(binToHex(marked.writtenCommitments[1]!), wide.stateLayout!, 1).counter).toBe(1n);
  });

  it('is read by a view that names only that record', async () => {
    const deployed = await deployedWide();
    await call(deployed, 'bump');
    await call(deployed, 'bump');
    const read = await readFramedEntry({
      provider: deployed.provider,
      artifact: wide,
      categoryId: deployed.categoryId,
      functionName: 'counterOf',
      vm: compositionMachine(),
    });
    expect(read.accepted).toBe(true);
    expect(read.value).toBe(2n);
  });
});

/** The balance a contract's `balanceOf` view reads for one lock. */
async function balanceOf(deployed: Deployed, who: Uint8Array): Promise<unknown> {
  const read = await readFramedEntry({
    provider: deployed.provider,
    artifact: deployed.artifact,
    categoryId: deployed.categoryId,
    functionName: 'balanceOf',
    args: [who],
    vm: compositionMachine(),
  });
  return read.value;
}

/** The live nodes of one mapping, as the deployment's own classification reports them. */
async function nodesOf(deployed: Deployed, collection: string): Promise<readonly string[]> {
  const deployment = await readFramedDeployment(deployed.provider, deployed.categoryId, deployed.artifact.stateLayout!);
  return (deployment.nodesByCollection.get(collection) ?? []).map((utxo) => utxo.token!.nft!.commitment);
}

describe('an entry that reads a key of one mapping beside a write of another', () => {
  it('credits a member the allow-list admits, keeping the list\'s node ahead of the balance\'s group', async () => {
    const deployed = await deploy(club);
    expect((await call(deployed, 'allow', [HOLDER_LOCK])).accepted).toBe(true);
    const allowed = await nodesOf(deployed, 'allowed');

    const credited = await call(deployed, 'credit', [HOLDER_LOCK, 500n]);
    expect(credited.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(await balanceOf(deployed, HOLDER_LOCK)).toBe(500n);
    expect(await nodesOf(deployed, 'allowed')).toStrictEqual(allowed);
    // A key the list does not hold is read beside its predecessor as the default, which the body refuses.
    const refused = await call(deployed, 'credit', [STRANGER_LOCK, 500n]);
    expect(refused.accepted).toBe(false);
    expect(refused.broadcast).toBeUndefined();
  });
});

describe('an entry that reads one key of a mapping beside a write of another key of it', () => {
  it('moves from the sender\'s balance, which it reads and keeps, to another key it rewrites', async () => {
    const deployed = await deploy(pool);
    await call(deployed, 'seed', [deployed.callerLock, 100n]);
    await call(deployed, 'seed', [HOLDER_LOCK, 5n]);

    const moved = await call(deployed, 'move', [HOLDER_LOCK, 50n]);
    expect(moved.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(await balanceOf(deployed, HOLDER_LOCK)).toBe(55n);
    // The body reads the sender's balance and does not debit it.
    expect(await balanceOf(deployed, deployed.callerLock)).toBe(100n);
    expect((await call(deployed, 'move', [HOLDER_LOCK, 101n])).accepted).toBe(false);
  });
});
