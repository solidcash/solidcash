import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  VALUE_INLINE_LIMIT, bytesToHex, encodePushdataValue, parsePushdataCommitment, sha256, validatorAddress,
  type Artifact,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { deploymentStateValues } from '../../../src/per-call/proxy/external-calls.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A guarded collector that reads back a long mapping value a sibling reach rewrote, rewrites it again and pays out
 * once per share its guard admits.
 *
 * `Root.decide` (behind a generated proxy) reaches `Store.settle`, which rewrites a record's shares and votes, and
 * then `Collector.collect`, whose body-wide re-entrancy guard sets its own record before its first call and restores
 * it after the payout loop. `collect` reads the record through the store's getter (a sibling of the write, not inside
 * it), marks it paid out, which rewrites the value a second time, and calls `pay` once per non-zero share. The guard's
 * restore follows the loop, so no fixed count of calls stands before it, yet no call follows it: the artifact
 * publishes it in the run's last segment, and the hop declares the record written at both ends rather than kept,
 * which the guard's own close at the first call refused. The sibling's write is one the plan states from the call
 * data and the node, within the node's inline limit or past it into continuation chunks, or a long one the writer's
 * body computes: the writer's own close exposes those bytes, and the hop is planned again from them before the getter
 * and the second write are judged, so neither starts from the deployment's bytes.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`guarded payout after sibling rewrite ${label}`)));
}

const STORE_CATEGORY = idOf('store');
const COLLECTOR_CATEGORY = idOf('collector');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');

const ID = 7n;
/** The shares the decision settles: three are non-zero, so the payout calls three times. */
const SHARES = [6000n, 0n, 3000n, 1000n] as const;
const VOTES = [2n, -1n] as const;
const SHORT_NOTE = 'n7';
const LONG_NOTE = 'a record note long enough that the record value takes continuation chunks past its node';
const CALLER = encodeLockingBytecodeP2pkh(alicePkh);

/**
 * The sibling's write, with the votes it leaves: field writes the planner states from the call data and the node,
 * or a whole record the body rebuilds with a vote made positive, whose value the artifact does not publish.
 */
const SETTLES = {
  stated: { body: 'recs[id].shares = shares; recs[id].votes = votes;', votes: VOTES },
  computed: {
    body: 'Rec memory r = recs[id]; r.shares = shares; r.votes = votes; if (r.votes[1] < 0) { r.votes[1] = -r.votes[1]; } '
      + 'recs[id] = r;',
    votes: [2n, 1n],
  },
} as const;

const source = (settle: string): string => [
  'pragma solidity ^0.8.20;',
  'struct Rec { uint16 paidOut; int16[2] votes; uint16[4] shares; uint256 amount; string note; }',
  'interface IStore {',
  '  function open(uint256 id, string calldata note) external;',
  '  function settle(uint256 id, uint16[4] calldata shares, int16[2] calldata votes) external;',
  '  function rec(uint256 id) external view returns (Rec memory);',
  '  function markPaid(uint256 id) external;',
  '  function pay(uint256 share) external;',
  '}',
  'interface ICollector { function collect(uint256 id) external returns (uint256); }',
  'contract Store {',
  '  mapping(uint256 => Rec) recs;',
  '  function open(uint256 id, string calldata note) external {',
  '    recs[id] = Rec(0, [int16(0), int16(0)], [uint16(0), uint16(0), uint16(0), uint16(0)], 100, note);',
  '  }',
  `  function settle(uint256 id, uint16[4] calldata shares, int16[2] calldata votes) external { ${settle} }`,
  '  function rec(uint256 id) external view returns (Rec memory) { return recs[id]; }',
  '  function markPaid(uint256 id) external { recs[id].paidOut = 1; }',
  '  function pay(uint256 share) external { require(share > 0, "share"); }',
  '}',
  'contract Collector {',
  '  uint256 private status;',
  '  address public store;',
  '  constructor(address store_) { store = store_; status = 1; }',
  '  modifier guarded() { require(status != 2, "reentrant"); status = 2; _; status = 1; }',
  '  function collect(uint256 id) external guarded returns (uint256) {',
  '    Rec memory r = IStore(store).rec(id);',
  '    require(r.paidOut == 0, "paid out");',
  '    IStore(store).markPaid(id);',
  '    uint256 total = 0;',
  '    for (uint256 i = 0; i < 4; ++i) {',
  '      if (r.shares[i] > 0) {',
  '        IStore(store).pay(r.shares[i]);',
  '        total += r.shares[i];',
  '      }',
  '    }',
  '    return total;',
  '  }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public store;',
  '  address public collector;',
  '  uint256 public total;',
  '  function initialize(address store_, address collector_) public { store = store_; collector = collector_; }',
  '  function open(uint256 id, string calldata note) public { IStore(store).open(id, note); }',
  '  function decide(uint256 id, uint16[4] calldata shares, int16[2] calldata votes) public {',
  '    IStore(store).settle(id, shares, votes);',
  '    total = ICollector(collector).collect(id);',
  '  }',
  '}',
].join('\n');

/** Solidity-import compile options, under which a call result crosses the boundary as a Solidity ABI tuple. */
const FIXTURE_OPTIONS = {
  solidityImportCompat: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  messageBus: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  ecrecover: 'p2pkh',
  sortedMappingsAll: false,
  composition: 'per-call',
} as const;

/** The three contracts one form of the sibling's write compiles to. */
interface Contracts {
  readonly Store: Artifact;
  readonly Collector: Artifact;
  readonly Root: Artifact;
}

const compiledByForm = new Map<string, Contracts>();
/** Each form is compiled once, and only when a case runs it. */
function contractsFor(form: keyof typeof SETTLES): Contracts {
  let found = compiledByForm.get(form);
  if (found === undefined) {
    const compiled = compileStringMulti(source(SETTLES[form].body), FIXTURE_OPTIONS as never);
    found = { Store: compiled.Store!, Collector: compiled.Collector!, Root: compiled.Root! };
    compiledByForm.set(form, found);
  }
  return found;
}

/** A per-call contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The store and the collector plain, the root behind its proxy, the record opened through the root. */
async function openThenDecide(contracts: Contracts, note: string): Promise<{
  readonly network: MockNetworkProvider;
  readonly decide: () => Promise<PerCallProxyCallResult>;
}> {
  const { Store, Collector, Root } = contracts;
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
  // The decision reaches the store six times (the write, the read, the second write and three payouts).
  await network.addUtxo(wallet.address, funding(STORE_CATEGORY));
  await deployStatefulContract(Store, [], {
    fundingUtxo: funding(STORE_CATEGORY), funder, changeAddress, provider: network, threadCount: 8,
  });
  await network.addUtxo(wallet.address, funding(COLLECTOR_CATEGORY));
  await deployStatefulContract(Collector, [addressOf(STORE_CATEGORY)] as never, {
    fundingUtxo: funding(COLLECTOR_CATEGORY), funder, changeAddress, provider: network, threadCount: 2,
  });
  for (const id of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(id));
  const [openCoin, initCoin, callCoin] = ['open', 'initialize', 'call'].map((label) => funding(idOf(`${label} coin`)));
  for (const coin of [openCoin!, initCoin!, callCoin!]) await network.addUtxo(binToHex(CALLER), coin);
  await fundShippedFacets(network);
  const root = await deployPerCallProxy({
    provider: network,
    implementationArtifact: Root,
    proxyArtifact: buildProxyArtifact(Root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(STORE_CATEGORY), addressOf(COLLECTOR_CATEGORY)] },
    callerLockingBytecode: CALLER,
    callerFunding: { utxo: initCoin!, funder: callerFunder, changeAddress },
    vm: compositionMachine(),
  });
  expect(root.initialize.broadcast).toBeDefined();
  const enter = (functionName: string, args: readonly unknown[], coin: Utxo): Promise<PerCallProxyCallResult> =>
    callPerCallProxyEntry({
      provider: network,
      implementationArtifact: Root,
      proxyArtifact: buildProxyArtifact(Root),
      proxyCategoryId: root.proxy.categoryId,
      implementationCategoryId: root.implementation.categoryId,
      functionName,
      args: args as never,
      externals: {
        IStore: { artifact: Store, categoryId: STORE_CATEGORY },
        ICollector: { artifact: Collector, categoryId: COLLECTOR_CATEGORY },
      },
      callerUtxo: coin,
      callerLockingBytecode: CALLER,
      funder: callerFunder,
      changeAddress,
      vm: compositionMachine(),
    });
  const opened = await enter('open', [ID, note], openCoin!);
  expect(opened.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return { network, decide: () => enter('decide', [ID, [...SHARES], [...VOTES]], callCoin!) };
}

/** The form of the sibling's write, and the note that keeps the record within its node or takes it into chunks. */
const CASES = [
  ['stated', 'within the inline limit', SHORT_NOTE],
  ['stated', 'taking chunks', LONG_NOTE],
  ['computed', 'taking chunks', LONG_NOTE],
] as const;

describe('a guarded collector that reads back and rewrites a long value a sibling reach rewrote', () => {
  for (const [form, label, note] of CASES) {
    it(`settles the read, the second write and the payouts its guard admits, ${form} write ${label}`, async () => {
      const contracts = contractsFor(form);
      const { network, decide } = await openThenDecide(contracts, note);
      const result = await decide();
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
      // The record carries both writes: the shares and votes the sibling left, and the second write's mark.
      const read = await readPerCallEntry({
        provider: network, artifact: contracts.Store, categoryId: STORE_CATEGORY, functionName: 'rec', args: [ID],
        vm: compositionMachine(),
      });
      const fields = read.value as unknown as {
        paidOut: bigint; votes: readonly bigint[]; shares: readonly bigint[]; amount: bigint; note: string;
      };
      expect([fields.paidOut, [...fields.votes], [...fields.shares], fields.amount, fields.note])
        .toStrictEqual([1n, [...SETTLES[form].votes], [...SHARES], 100n, note]);
      const stored = encodePushdataValue(
        [fields.paidOut, [...fields.votes], [...fields.shares], fields.amount, fields.note], 'Rec',
        contracts.Store.structs ?? contracts.Store.stateLayout?.structs);
      expect(stored.length <= VALUE_INLINE_LIMIT).toBe(note === SHORT_NOTE);
      // The root holds what the collector paid out, summed from the record the getter returned.
      const layout = buildProxyArtifact(contracts.Root).stateLayout!;
      const field = layout.variables.find((variable) => variable.name === 'total')!;
      expect(parsePushdataCommitment(binToHex(result.writtenCommitments[field.nftIndex]!), layout, field.nftIndex)
        .total).toBe(SHARES.reduce<bigint>((sum, share) => sum + share, 0n));
      // The guard is restored: the collector's record ends where it started.
      const collectorLayout = contracts.Collector.stateLayout!;
      const state = deploymentStateValues(collectorLayout, COLLECTOR_CATEGORY,
        await readPerCallDeployment(network, COLLECTOR_CATEGORY, collectorLayout));
      expect(state.status).toBe(1n);
    });
  }
});
