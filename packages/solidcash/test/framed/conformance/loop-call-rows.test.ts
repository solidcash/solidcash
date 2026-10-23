import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  FrameKind, buildPushdataCommitment, bytesToHex, encodeEventCommitment, parsePushdataCommitment, sha256,
  type Artifact,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  deployMaster, readFramedDeployment, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { participant, type CompositionDraftPlan, type DraftMaster } from '../../../src/framed/composer/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import {
  VALIDATOR_PROGRAM, compileAndDeploy, composeAndDerive, fundShippedFacets, hexOf, layoutWithFacets, master,
  masterInput, rootOf, seededAddress, selectorOf, token, validatorFor,
} from '../shapes/harness.js';

/**
 * S0 conformance, spec section 23 row 4: calls inside data-dependent loops, including a revert mid-loop.
 *
 * `Board.post` walks the tags its caller passed and asks the catalog about each one, so the number of calls is the
 * array's length: the hop plans one callee frame per turn and the entry closes one segment per call (variable `calls`
 * and segments, spec 4 and 16). The body counts the primary tags it meets and reverts mid-loop on the second; after
 * the loop it requires exactly one and records it. `Board.splitAll` pays a share per turn through `Payout.send`,
 * which emits an event per call.
 *
 * Served: the turns follow the array (three tags make three catalog frames, three shares three payouts), the board's
 * record holds the one primary tag once the hop is broadcast, and each payout event is read back at its own output in
 * turn order.
 * The revert mid-loop is the EVM's: a second primary tag (the entry's own check, after the third call), a tag the
 * catalog rejects (the callee's check, on the second turn) and a zero share (the payout's check, on the second turn)
 * are each refused with the reason that reverted, and the provider sees no transaction.
 *
 * `Board.split` pays only the non-zero shares (`if (amounts[i] > 0)`), so the number of calls is the number of turns
 * a per-turn condition admits. The artifact publishes that condition on the loop site, and the hop's planner places
 * only the turns it admits (`proxy/external-calls.ts`, `callingTurnsOf`): two shares of three settle as two payouts.
 * The control beside it composes the same loop on a plain splitter from a plan stating the two calls the body makes:
 * the shipped composer settles it and the machine accepts every input, and a plan naming the skipped turn's index
 * stalls the splitter's own frame. The plain call path on the implementation's own deployment, whose records hold no
 * catalog, refuses the loop entry by name.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`loop call rows ${label}`)));
}

const CATALOG_CATEGORY = idOf('catalog');
const PAYOUT_CATEGORY = idOf('payout');
const BOARD_IMPL_CATEGORY = idOf('board implementation');
const BOARD_PROXY_CATEGORY = idOf('board proxy');
const USER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

/** The two primary tags the catalog holds; every other positive tag is a plain one. */
const PRIMARY_A = 11n;
const PRIMARY_B = 23n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICatalog { function kindOf(int tag) view returns (int); }'
  + ' interface IPayout { function send(int to, int amount) returns (bool); }'
  + ' contract Catalog {'
  + '   mapping(int => int) public kinds;'
  + '   constructor(int first, int second) { this.kinds[first] = 1; this.kinds[second] = 1; }'
  + '   function kindOf(int tag) view returns (int) {'
  + '     require(tag > 0, "unknown tag");'
  + '     return this.kinds[tag];'
  + '   }'
  + ' }'
  + ' contract Payout {'
  + '   int public floor;'
  + '   event Paid(int to, int amount);'
  + '   function send(int to, int amount) returns (bool) {'
  + '     require(amount > this.floor, "zero share");'
  + '     emit Paid(to, amount);'
  + '     return true;'
  + '   }'
  + ' }'
  + ' contract Board {'
  + '   address public implementation;'
  + '   address public catalog;'
  + '   address public payout;'
  + '   int public primary;'
  + '   int public posts;'
  + '   int public shares;'
  + '   function initialize(address c, address p) { this.catalog = c; this.payout = p; require(true); }'
  + '   function post(int[] tags) {'
  + '     int found = 0;'
  + '     int chosen = 0;'
  + '     for (int i = 0; i < tags.length; i = i + 1) {'
  + '       if (ICatalog(this.catalog).kindOf(tags[i]) != 0) {'
  + '         found = found + 1;'
  + '         require(found < 2, "Only one primary tag");'
  + '         chosen = tags[i];'
  + '       }'
  + '     }'
  + '     require(found == 1, "Exactly one primary tag");'
  + '     this.primary = chosen;'
  + '     this.posts = this.posts + 1;'
  + '   }'
  + '   function splitAll(int[] amounts) {'
  + '     for (int i = 0; i < amounts.length; i = i + 1) { require(IPayout(this.payout).send(i, amounts[i])); }'
  + '     this.shares = this.shares + amounts.length;'
  + '   }'
  + '   function split(int[] amounts) {'
  + '     int made = 0;'
  + '     for (int i = 0; i < amounts.length; i = i + 1) {'
  + '       if (amounts[i] > 0) { require(IPayout(this.payout).send(i, amounts[i])); made = made + 1; }'
  + '     }'
  + '     this.shares = this.shares + made;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const catalog = artifacts.Catalog!;
const payout = artifacts.Payout!;
const board = artifacts.Board!;
const boardProxy = buildProxyArtifact(board);

/** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/** The catalog and the payout, then the board behind its proxy, and the chain as it stood when all were done. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly changeAddress: string;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly snapshot: SnapshotRestorer;
}

let deployedRun: Promise<Deployed> | undefined;

/** One deployment serves every case; each rewinds the chain to it first, so none reads another's broadcast. */
async function deployed(): Promise<Deployed> {
  deployedRun ??= (async (): Promise<Deployed> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = wallet.unlock.spend(alicePub, signature);
    await fundShippedFacets(network);
    const plain: readonly (readonly [Artifact, string, readonly bigint[]])[] = [
      [catalog, CATALOG_CATEGORY, [PRIMARY_A, PRIMARY_B]], [payout, PAYOUT_CATEGORY, []],
    ];
    for (const [artifact, categoryId, args] of plain) {
      const coin = funding(categoryId);
      await network.addUtxo(wallet.address, coin);
      await deployStatefulContract(artifact, [...args], {
        fundingUtxo: coin, funder, changeAddress: wallet.address, provider: network,
      });
    }
    for (const txid of [BOARD_IMPL_CATEGORY, BOARD_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(txid));
    const initCoin = funding(idOf('initialize coin'));
    await network.addUtxo(binToHex(USER_LOCK), initCoin);
    const addressOf = (artifact: Artifact, categoryId: string): Uint8Array =>
      deployMaster(artifact, hexToBin(categoryId), VALIDATOR_PROGRAM).address;
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: board,
      proxyArtifact: boardProxy,
      implementationDeploy: { fundingUtxo: funding(BOARD_IMPL_CATEGORY), funder, changeAddress: wallet.address },
      proxyDeploy: { fundingUtxo: funding(BOARD_PROXY_CATEGORY), funder, changeAddress: wallet.address },
      initialize: {
        functionName: 'initialize',
        args: [addressOf(catalog, CATALOG_CATEGORY), addressOf(payout, PAYOUT_CATEGORY)],
      },
      callerLockingBytecode: USER_LOCK,
      callerFunding: { utxo: initCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    return {
      network,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      changeAddress: wallet.address,
      externals: {
        ICatalog: { artifact: catalog, categoryId: CATALOG_CATEGORY },
        IPayout: { artifact: payout, categoryId: PAYOUT_CATEGORY },
      },
      snapshot: await network.takeSnapshot(),
    };
  })();
  const shared = await deployedRun;
  await shared.snapshot.restore();
  return shared;
}

interface Entered {
  readonly coin: { txid: string; vout: number; satoshis: bigint };
  readonly call: Promise<FramedProxyCallResult>;
}

/** Funds a coin of the user's and runs one board entry over `list` through the shipped proxy hop. */
async function enter(run: Deployed, functionName: string, list: readonly bigint[]): Promise<Entered> {
  const coin = funding(idOf(`${functionName} ${list.join(' ')}`));
  await run.network.addUtxo(binToHex(USER_LOCK), coin);
  const call = callFramedProxyEntry({
    provider: run.network,
    implementationArtifact: board,
    proxyArtifact: boardProxy,
    proxyCategoryId: run.proxyCategoryId,
    implementationCategoryId: run.implementationCategoryId,
    functionName,
    args: [[...list]],
    externals: run.externals,
    callerUtxo: coin,
    callerLockingBytecode: USER_LOCK,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: run.changeAddress,
    vm: compositionMachine(),
  });
  return { coin, call };
}

/** The board's fields as its proxy's records hold them, decoded with the shipped decoder. */
async function boardState(run: Deployed): Promise<Record<string, unknown>> {
  const layout = boardProxy.stateLayout!;
  const pools = await readFramedDeployment(run.network, run.proxyCategoryId, layout);
  return Object.assign({}, ...pools.records.map((record, nftIndex) =>
    parsePushdataCommitment(record.token!.nft!.commitment, layout, nftIndex))) as Record<string, unknown>;
}

/** Every outpoint the deployments hold and the chain's tip, which a refused call leaves exactly as they were. */
async function chainView(run: Deployed): Promise<{ readonly tip: number | undefined; readonly outpoints: string[] }> {
  const held = await Promise.all(
    [CATALOG_CATEGORY, PAYOUT_CATEGORY, run.proxyCategoryId, run.implementationCategoryId]
      .map((categoryId) => run.network.getUtxosByTokenCategory(categoryId)),
  );
  return {
    tip: run.network.indexer.getTip()?.height,
    outpoints: held.flat().map((utxo) => `${utxo.txid}:${utxo.vout}`).sort(),
  };
}

/** True while the coin a call was entered with is unspent. */
async function coinLive(run: Deployed, entered: Entered): Promise<boolean> {
  return (await run.network.getUtxosForLockingBytecode(USER_LOCK))
    .some((utxo) => utxo.txid === entered.coin.txid && utxo.vout === entered.coin.vout);
}

/** Runs an entry the hop must refuse, and checks that nothing was broadcast and the board kept its record. */
async function expectRefused(run: Deployed, functionName: string, list: readonly bigint[], reason: RegExp):
Promise<void> {
  const before = await chainView(run);
  const entered = await enter(run, functionName, list);
  await expect(entered.call).rejects.toThrow(reason);
  expect(await coinLive(run, entered)).toBe(true);
  expect(await chainView(run)).toStrictEqual(before);
  expect(await boardState(run)).toMatchObject({ primary: 0n, posts: 0n, shares: 0n });
}

/** How many frames of one entry a settled hop completed. */
function framesOf(result: FramedProxyCallResult, functionName: string): number {
  return result.completed.filter((frame) => frame.functionName === functionName).length;
}

describe('spec section 23 row 4: calls inside data-dependent loops', () => {
  it('asks the catalog once per tag the caller passed, and records the one primary tag', async () => {
    const run = await deployed();
    const result = await (await enter(run, 'post', [5n, PRIMARY_A, 9n])).call;
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // One call record and one catalog frame per turn, every turn's frame completed before the entry that looped, and
    // one segment more than the calls that close them.
    const entry = result.draft.blockOf('implementation-master');
    expect([entry.calls.length, entry.segments.length]).toStrictEqual([3, 4]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      'Catalog.kindOf()', 'Catalog.kindOf()', 'Catalog.kindOf()', 'Board.post()', 'BoardProxy.__fallback()',
    ]);
    expect(await boardState(run)).toMatchObject({ primary: PRIMARY_A, posts: 1n, shares: 0n });
  });

  it('refuses a second primary tag mid-loop with the entry\'s own reason, and nothing is broadcast', async () => {
    const run = await deployed();
    await expectRefused(run, 'post', [PRIMARY_A, 5n, PRIMARY_B],
      /the implementation's "post" entry did not settle through the proxy: .*Only one primary tag/);
  });

  it('refuses a tag the catalog rejects on the second turn with the callee\'s own reason', async () => {
    const run = await deployed();
    await expectRefused(run, 'post', [5n, 0n, PRIMARY_A],
      /the call's callee "Catalog\.kindOf\(\)" did not settle through the proxy: .*unknown tag/);
  });

  it('refuses a list with no primary tag at the check after the loop', async () => {
    const run = await deployed();
    await expectRefused(run, 'post', [5n, 9n],
      /the implementation's "post" entry did not settle through the proxy: .*Exactly one primary tag/);
  });

  it('pays a share per turn, each payout event read back at its own output in turn order', async () => {
    const run = await deployed();
    const result = await (await enter(run, 'splitAll', [4n, 6n, 3n])).call;
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(framesOf(result, 'Payout.send()')).toBe(3);
    const paid = compositionEventLogs(result.draft, [payout, catalog, board, boardProxy])
      .filter((log) => log.eventName === 'Paid');
    expect(paid.map((log) => log.args)).toStrictEqual([
      { to: 0n, amount: 4n }, { to: 1n, amount: 6n }, { to: 2n, amount: 3n },
    ]);
    // Each event is the payout's: its address is the contract that emitted it, not the board that looped.
    const payoutAddress = deployMaster(payout, hexToBin(PAYOUT_CATEGORY), VALIDATOR_PROGRAM).address;
    expect(new Set(paid.map((log) => bytesToHex(log.address)))).toStrictEqual(new Set([bytesToHex(payoutAddress)]));
    expect(await boardState(run)).toMatchObject({ shares: 3n });
  });

  it('refuses a zero share on the second turn with the payout\'s reason, and nothing is broadcast', async () => {
    const run = await deployed();
    await expectRefused(run, 'splitAll', [4n, 0n, 3n],
      /the call's callee "Payout\.send\(\)" did not settle through the proxy: .*zero share/);
  });

  it('plans a call only on the turns whose per-turn condition the body takes, and pays the two non-zero shares',
    async () => {
      // The EVM makes two calls for [4, 0, 6] and pays the two non-zero shares. The compiler publishes the call as a
      // loop site carrying the per-turn condition `amounts[i] > 0` over the array's own element.
      const site = board.abi.find((entry) => entry.name === 'split')!.externalCalls![0]!;
      expect(site.occurrence).toBe('loop');
      expect(site.condition).toMatchObject({
        kind: 'binary', operator: '>',
        left: { kind: 'source', source: { kind: 'arrayElement', paramIndex: 0, indexValue: 0, indexStepValue: 1 } },
      });
      // The hop places only the turns that condition admits (`proxy/external-calls.ts`, `callingTurnsOf`).
      const run = await deployed();
      const result = await (await enter(run, 'split', [4n, 0n, 6n])).call;
      expect(result.accepted).toBe(true);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
      expect(framesOf(result, 'Payout.send()')).toBe(2);
      const paid = compositionEventLogs(result.draft, [payout, catalog, board, boardProxy])
        .filter((log) => log.eventName === 'Paid');
      expect(paid.map((log) => log.args)).toStrictEqual([{ to: 0n, amount: 4n }, { to: 2n, amount: 6n }]);
      expect(await boardState(run)).toMatchObject({ shares: 2n });
    });

  it('refuses the loop entry by name on the plain call path, whose implementation records hold no catalog', async () => {
    const run = await deployed();
    const coin = funding(idOf('plain path coin'));
    await run.network.addUtxo(binToHex(USER_LOCK), coin);
    await expect(callFramedEntry({
      provider: run.network, artifact: board, categoryId: run.implementationCategoryId, functionName: 'post',
      args: [[5n, PRIMARY_A]], callerUtxo: coin, callerLockingBytecode: USER_LOCK,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
    })).rejects.toThrow(
      new RegExp('entry "post" makes 1 external call\\(s\\): the call to "ICatalog\\.kindOf" targets the state '
        + 'field "catalog", which the caller\'s own state does not hold as an address'),
    );
  });
});

describe('spec section 23 row 4: the per-turn condition, composed with the calls the body makes', () => {
  // The wall's control: the same loop on a plain splitter, composed by the shipped composer from a plan that states
  // the two calls the body makes for [4, 0, 6], is settled by the derivation and accepted by the machine, so what the
  // hop lacks is the plan, not anything the emitted code or the validator refuses.
  const SPLITTER_LABEL = 'loop call rows splitter';
  const PAYOUT_LABEL = 'loop call rows composed payout';
  const SPLITTER = 'splitter-1';
  const RECORD = 'splitter-record';
  const VALIDATOR = 'validator';
  const USER = 'user';
  const SHARES = [4n, 0n, 6n];
  const PAYOUT_ADDRESS = hexOf(seededAddress(PAYOUT_LABEL));
  const { artifacts: composed, contracts } = compileAndDeploy('pragma solidcash ^0.14.0;'
    + ' interface IPayout { function send(int to, int amount); }'
    + ' contract Payout {'
    + '   event Paid(int to, int amount);'
    + '   function send(int to, int amount) { require(amount > 0, "zero share"); emit Paid(to, amount); }'
    + ' }'
    + ' contract Splitter {'
    + '   int public shares;'
    + '   function split(int[] amounts) {'
    + '     int made = 0;'
    + '     for (int i = 0; i < amounts.length; i = i + 1) {'
    + `       if (amounts[i] > 0) { IPayout(0x${PAYOUT_ADDRESS}).send(i, amounts[i]); made = made + 1; }`
    + '     }'
    + '     this.shares = this.shares + made;'
    + '   }'
    + '   function idle() { require(true); }'
    + ' }', { Splitter: SPLITTER_LABEL, Payout: PAYOUT_LABEL });

  /** Composes and derives `split([4, 0, 6])` from a plan stating one payout call per entry of `taken`. */
  function composeSplit(taken: readonly { readonly to: bigint; readonly amount: bigint }[]):
  ReturnType<typeof composeAndDerive> {
    const splitter = contracts.Splitter!;
    const composedPayout = contracts.Payout!;
    const sharesOf = (shares: bigint): Uint8Array => new Uint8Array(Buffer.from(
      buildPushdataCommitment(composed.Splitter!.stateLayout!, { shares }, 0), 'hex'));
    const sendPushes = (to: bigint, amount: bigint): Uint8Array[] => [
      selectorOf(composed, 'Payout', 'send'),
      encodeFunctionArgument(amount, 'int') as Uint8Array,
      encodeFunctionArgument(to, 'int') as Uint8Array,
    ];
    const payouts = taken.map((_turn, index) => `payout-${index + 1}`);
    const blocks: CompositionDraftPlan['blocks'] = [
      { contract: 'Splitter', masters: [SPLITTER], validator: { id: VALIDATOR, settles: [] }, state: [RECORD] },
      { contract: 'Payout', masters: payouts, state: [] },
    ];
    const layout = layoutWithFacets(blocks);
    const base = layout.participantCount;
    const recordIndex = participant(layout, RECORD).index;
    const kept = { in: recordIndex, out: recordIndex, viewIn: sharesOf(0n), viewOut: sharesOf(0n) };
    const splitterMaster = master({
      master: SPLITTER, contract: 'Splitter', entry: 'split', program: splitter.program,
      facts: {
        contract: 'Splitter', functionName: 'split', kind: FrameKind.ROOT,
        callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: splitter.address, value: 0n },
      enteredBy: USER, origin: USER,
      calls: taken.map((turn, index) => ({
        kind: FrameKind.CALL, callee: payouts[index]!, target: composedPayout.address, value: 0n,
        argumentPushes: sendPushes(turn.to, turn.amount),
      })),
      // The write after the loop lands in the segment the last call opened; the record is kept before it.
      segments: [...taken.map(() => [kept]), [{ ...kept, viewOut: sharesOf(BigInt(taken.length)) }]],
      argumentPushes: [
        selectorOf(composed, 'Splitter', 'split'), encodeFunctionArgument([...SHARES], 'int[]') as Uint8Array,
      ],
      dispatches: true,
    });
    const payoutMasters: DraftMaster[] = taken.map((turn, index) => ({
      ...master({
        master: payouts[index]!, contract: 'Payout', entry: 'send', program: composedPayout.program,
        facts: {
          contract: 'Payout', functionName: 'send', kind: FrameKind.CALL,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: taken.length,
        },
        frame: { kind: FrameKind.CALL, sender: splitter.address, self: composedPayout.address, value: 0n },
        enteredBy: SPLITTER, origin: USER,
        argumentPushes: sendPushes(turn.to, turn.amount),
      }),
      events: [base + index],
    }));
    const paid = composed.Payout!.events![0]!;
    const recordLock = stateRecordLockingBytecode(bytesToHex(splitter.category));
    const validator = validatorFor(splitter.category);
    const plan: CompositionDraftPlan = {
      blocks,
      userInputs: [{ id: USER, index: base }],
      masters: [splitterMaster, ...payoutMasters],
      inputs: {
        [SPLITTER]: { source: masterInput(splitter) },
        ...Object.fromEntries(payouts.map((id) => [id, { source: masterInput(composedPayout) }])),
        [VALIDATOR]: {
          source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(splitter.category, 'mutable') },
        },
        [RECORD]: {
          source: {
            lockingBytecode: recordLock, valueSatoshis: 20_000n, token: token(splitter.category, 'mutable', sharesOf(0n)),
          },
          output: {
            lockingBytecode: recordLock, valueSatoshis: 20_000n,
            token: token(splitter.category, 'mutable', sharesOf(BigInt(taken.length))),
          },
          unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(splitter.category),
            participant(layout, SPLITTER).index, 1),
        },
        [USER]: {
          source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, unlockingBytecode: callerUnlockingBytecode(),
        },
      },
      trailingOutputs: taken.map((turn) => eventOutput(composedPayout.category, paid.signature,
        encodeEventCommitment(paid.parameters, [turn.to, turn.amount]))),
      // The payout runs on one master per call, so the validator settles it; it keeps no record to list.
      validator: {
        id: VALIDATOR, covers: ['Payout'], settles: [{ category: composedPayout.category, stateInputs: [] }],
        redeemScript: validator.redeem,
      },
    };

    return composeAndDerive(plan, [composed.Splitter!, composed.Payout!], [rootOf('Splitter', 'split', SPLITTER)]);
  }

  it('settles the two calls the body makes for [4, 0, 6] and reads both payout events back', () => {
    // The turns the body takes: the two non-zero shares, each with its own index.
    const outcome = composeSplit([{ to: 0n, amount: 4n }, { to: 2n, amount: 6n }]);
    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Payout.send()', 'Payout.send()', 'Splitter.split()']);
    expect(compositionEventLogs(outcome.draft, [composed.Payout!, composed.Splitter!]).map((log) => log.args))
      .toStrictEqual([{ to: 0n, amount: 4n }, { to: 2n, amount: 6n }]);
  });

  it('refuses a plan whose second call names the skipped turn, so the accept above binds each call', () => {
    // The payout would accept (1, 6), but the body's second call carries the third turn's index, so the splitter's
    // own frame is the one that stalls.
    expect(() => composeSplit([{ to: 0n, amount: 4n }, { to: 1n, amount: 6n }]))
      .toThrow(/FRAMED_DERIVATION_STALLED.*master "splitter-1" of Splitter\.split\(\) filled no witness/);
  });
});
