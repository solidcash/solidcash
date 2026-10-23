import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { FrameKind, hash160, parsePushdataCommitment, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Callee frames on the plain call path (spec 10, 18): an entry that calls another plain deployment runs each callee
 * as a frame of the callee contract's own block, its return learned from its own close before the caller reads it.
 *
 * `A.bump` counts itself in its own record, makes a `CALL` into `B.add`, whose body rewrites B's own record and
 * returns the new total, then writes that total after the call and emits it: A's record is written in both
 * segments the call splits its frame into. `A.chain` and `A.chainOrigin` are nested `STATIC` frames, A into B into
 * C: C answers its own `msg.sender`, the contract that called it, and the `tx.origin` the user's input carries.
 * `A.readTwice` enters B twice, on two masters of B's block, whose category the validator settles, and `A.sumThree`
 * enters it once per turn of a loop. `A.twice` enters B twice with frames that both write its record, the second
 * starting from what the first wrote. `A.notify` makes a `CALL` into `B.note`, whose event output follows the
 * root's. `A.both` reaches two deployments of C, each its own block under its own category.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract C { uint256 public marker;'
  + '   function who() external view returns (address) { return msg.sender; }'
  + '   function origin() external view returns (address) { return tx.origin; } }'
  + ' contract B { uint256 public total; event Noted(uint256 x);'
  + '   function add(uint256 amount) external returns (uint256) { total = total + amount; return total; }'
  + '   function relay(C c) external view returns (address) { return c.who(); }'
  + '   function relayOrigin(C c) external view returns (address) { return c.origin(); }'
  + '   function note(uint256 x) external { emit Noted(x); } }'
  + ' contract A { B public b; C public c; uint256 public lastTotal; uint256 public bumps; event Bumped(uint256 total);'
  + '   constructor(B b_, C c_) { b = b_; c = c_; }'
  + '   function bump(uint256 amount) external returns (uint256) {'
  + '     bumps = bumps + 1; lastTotal = b.add(amount); emit Bumped(lastTotal); return lastTotal; }'
  + '   function chain() external view returns (address) { return b.relay(c); }'
  + '   function chainOrigin() external view returns (address) { return b.relayOrigin(c); }'
  + '   function notify() external { b.note(1); }'
  + '   function twice(uint256 amount) external returns (uint256) { return b.add(amount) + b.add(amount); }'
  + '   function readTwice() external view returns (uint256) { return b.total() + b.total(); }'
  + '   function sumThree() external view returns (uint256 t) { for (uint256 i = 0; i < 3; i++) { t += b.total(); } }'
  + '   function both(C other) external view returns (address x, address y) { x = c.who(); y = other.who(); } }';

/** The deployments, by name, and the chain as it stood when they were done. */
interface Deployed {
  readonly provider: MockNetworkProvider;
  /** The artifact each deployment runs, by deployment name. */
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  /** The lock each deployment's category derives, and its `address`, the hash160 of that lock, as hex. */
  readonly locks: ReadonlyMap<string, Uint8Array>;
  readonly addresses: ReadonlyMap<string, string>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** C, a second C, B and A, A holding B and the first C; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { A: compiled.A!, B: compiled.B!, C: compiled.C!, C2: compiled.C! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['C', []], ['C2', []], ['B', []], ['A', ['B', 'C']]] as const).entries()) {
      const fundingUtxo = { txid: `${'71'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name]!, args.map((arg) => locks.get(arg)!), {
        provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      categories.set(name, deployment.categoryId);
      locks.set(name, validatorAddress(hexToBin(deployment.categoryId), validatorProgram));
    }
    const addresses = new Map([...locks].map(([name, lock]) => [name, binToHex(hash160(lock))]));
    return { provider, artifacts, categories, locks, addresses, snapshot: await provider.takeSnapshot() };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

let coins = 0;

/** Enters one of A's entries with a fresh coin of the user's, naming every deployment as a call may reach it. */
async function enter(
  chain: Deployed, functionName: string, args: readonly (bigint | Uint8Array)[] = [],
): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'72'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.A!, categoryId: chain.categories.get('A')!, functionName,
    args, callerUtxo, callerLockingBytecode: user, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    vm: compositionMachine(), externals,
  });
}

/** A contract's records as its own layout decodes them, read back from the chain. */
async function recordOf(chain: Deployed, name: string): Promise<Record<string, unknown>> {
  const layout = chain.artifacts[name]!.stateLayout!;
  const set = await readFramedDeployment(chain.provider, chain.categories.get(name)!, layout);
  return Object.assign({}, ...set.records.slice(0, layout.dataNftCount)
    .map((record, nftIndex) => parsePushdataCommitment(record.token!.nft!.commitment, layout, nftIndex)));
}

/** The answer an entry returned, by role: the user who entered, or the contract it names. */
function roleOf(chain: Deployed, value: unknown): string {
  const address = value instanceof Uint8Array ? binToHex(value) : String(value);
  if (address === binToHex(alicePkh)) return 'user';
  return [...chain.addresses].find(([, known]) => known === address)?.[0] ?? address;
}

describe('callee frames on the plain call path', () => {
  it('serves a CALL whose callee writes its own record and returns, and the caller writes what it returned', async () => {
    const chain = await deployed();
    const first = await enter(chain, 'bump', [5n]);
    expect(first.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(first.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(first.values).toStrictEqual([5n]);
    expect(first.completed.map((frame) => [frame.functionName, frame.kind]))
      .toStrictEqual([['B.add()', FrameKind.CALL], ['A.bump()', FrameKind.ROOT]]);
    expect(await recordOf(chain, 'B')).toMatchObject({ total: 5n });
    expect(await recordOf(chain, 'A')).toMatchObject({ lastTotal: 5n, bumps: 1n });
    // A second call starts from what the first one left on chain.
    const second = await enter(chain, 'bump', [7n]);
    expect(second.accepted).toBe(true);
    expect(second.values).toStrictEqual([12n]);
    expect(await recordOf(chain, 'B')).toMatchObject({ total: 12n });
    expect(await recordOf(chain, 'A')).toMatchObject({ lastTotal: 12n, bumps: 2n });
  });

  it('serves nested STATIC frames: the innermost callee sees its own caller as msg.sender', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'chain');
    expect(result.accepted).toBe(true);
    expect(result.completed.map((frame) => [frame.functionName, frame.kind])).toStrictEqual([
      ['C.who()', FrameKind.STATIC], ['B.relay()', FrameKind.STATIC], ['A.chain()', FrameKind.ROOT],
    ]);
    expect(result.values.map((value) => roleOf(chain, value))).toStrictEqual(['B']);
  });

  it('serves nested STATIC frames: tx.origin two frames down is the user who entered', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'chainOrigin');
    expect(result.accepted).toBe(true);
    expect(result.values.map((value) => roleOf(chain, value))).toStrictEqual(['user']);
  });

  it('serves a contract entered twice whose frames only read it, settled by the validator', async () => {
    const chain = await deployed();
    expect((await enter(chain, 'bump', [5n])).accepted).toBe(true);
    const result = await enter(chain, 'readTwice');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.values).toStrictEqual([10n]);
    // Two masters of B, each in B's one block.
    const masters = result.draft.layout.participants.filter((placed) => placed.contract === 'B' && placed.kind === 'master');
    expect(masters).toHaveLength(2);
  });

  it('serves a loop of calls: one master and one segment per turn', async () => {
    const chain = await deployed();
    expect((await enter(chain, 'bump', [5n])).accepted).toBe(true);
    const result = await enter(chain, 'sumThree');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.values).toStrictEqual([15n]);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['B.total()', 'B.total()', 'B.total()', 'A.sumThree()']);
    expect(result.draft.blockOf('master').segments).toHaveLength(4);
  });

  it('serves a contract entered twice whose frames both write its record, chained frame to frame', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'twice', [2n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    // The second frame starts from the total the first one wrote, as the EVM's second call does.
    expect(result.values).toStrictEqual([6n]);
    expect(await recordOf(chain, 'B')).toMatchObject({ total: 4n });
  });

  it('serves two deployments of one contract, each its own block: both answer the contract that called them', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'both', [chain.locks.get('C2')!]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.values.map((value) => roleOf(chain, value))).toStrictEqual(['A', 'A']);
    // The first deployment's block keeps the contract's name, and the second's is qualified by its category.
    expect(result.draft.layout.blocks.map((block) => block.contract))
      .toStrictEqual(['A', 'C', `C@${chain.categories.get('C2')!}`]);
  });

  it('serves a callee that emits: its event output follows the root\'s, under its own category', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'notify');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(compositionEventLogs(result.draft, Object.values(chain.artifacts))
      .map((log) => [log.contract, log.emitter, log.eventName, log.args, log.outputIndex]))
      .toStrictEqual([['B', 'callee-master-1', 'Noted', { x: 1n }, result.draft.layout.participantCount]]);
  });
});
