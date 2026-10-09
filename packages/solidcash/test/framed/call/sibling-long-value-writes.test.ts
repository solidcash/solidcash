import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * One mapping value written twice in one hop by two sibling reaches, short enough to sit in its node and long enough
 * to take continuation chunks.
 *
 * `Root.both` (behind a generated proxy) reaches `Store.mark`, which sets a record's `stage`, and then `Store.flag`,
 * which requires that stage and sets the record's `flag`. Each write rebuilds the whole record from the fields it
 * keeps, and the compiler publishes each kept field as a read of the node (`field:<name>(map:recs(id:id))`), so the
 * hop plans the second write from the value the first left: a long value's run of chunk records sits at an address
 * salted with the value's own digest, and a run planned from the deployment's value is laid where the body that
 * computes the other value finds none of its chunks.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '4c3b2a1908f7e6d5c4b3a29180f7e6d';
  return `${seed}${base}${base}`.slice(0, 64);
}

const STORE_CATEGORY = category('0d');
const ROOT_IMPL_CATEGORY = category('1e');
const ROOT_PROXY_CATEGORY = category('2f');
const OPEN_TXID = category('30');
const ROOT_INIT_TXID = category('41');
const CALL_TXID = category('52');

const ID = 7n;
/** A note that keeps the record within its node's inline limit, and one that takes it past it. */
const SHORT_NOTE = 'n7';
const LONG_NOTE = 'a record note long enough that the record value takes continuation chunks';
const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Rec { address owner; uint16 stage; uint16 flag; uint256 amount; string note; }',
  'interface IStore {',
  '  function open(uint256 id, string calldata note) external;',
  '  function mark(uint256 id) external;',
  '  function flag(uint256 id) external;',
  '}',
  'contract Store {',
  '  mapping(uint256 => Rec) recs;',
  '  function open(uint256 id, string calldata note) external { recs[id] = Rec(msg.sender, 0, 0, 100, note); }',
  '  function mark(uint256 id) external { recs[id].stage = 1; }',
  '  function flag(uint256 id) external { require(recs[id].stage == 1, "stage"); recs[id].flag = 1; }',
  '  function rec(uint256 id) external view returns (Rec memory) { return recs[id]; }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public store;',
  '  uint256 public done;',
  '  function initialize(address store_) public { store = store_; }',
  '  function open(uint256 id, string calldata note) public { IStore(store).open(id, note); }',
  '  function both(uint256 id) public { IStore(store).mark(id); IStore(store).flag(id); done = 1; }',
  '}',
].join('\n');

/** Solidity-import compile options, under which a call result crosses the boundary as a Solidity ABI tuple. */
const FIXTURE_OPTIONS = {
  evmCompat: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  messageBus: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  ecrecover: 'p2pkh',
  sortedMappingsAll: false,
  composition: 'framed',
} as const;

const compiled = compileStringMulti(SOURCE, FIXTURE_OPTIONS as never);
const { Store, Root } = compiled as Required<typeof compiled>;

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The store plain, the root behind its proxy, the record opened through the root, and the hop that writes it twice. */
async function openThenBoth(note: string): Promise<{
  readonly network: MockNetworkProvider;
  readonly both: () => Promise<FramedProxyCallResult>;
}> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
  await network.addUtxo(wallet.address, funding(STORE_CATEGORY));
  await deployStatefulContract(Store!, [], {
    fundingUtxo: funding(STORE_CATEGORY), funder, changeAddress, provider: network, threadCount: 4,
  });
  for (const id of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(id));
  for (const txid of [OPEN_TXID, ROOT_INIT_TXID, CALL_TXID]) await network.addUtxo(binToHex(ALICE_LOCK), funding(txid));
  await fundShippedFacets(network);
  const root = await deployFramedProxy({
    provider: network,
    implementationArtifact: Root!,
    proxyArtifact: buildProxyArtifact(Root!),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(STORE_CATEGORY)] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: funding(ROOT_INIT_TXID), funder: callerFunder, changeAddress },
    vm: compositionMachine(),
  });
  expect(root.initialize.broadcast).toBeDefined();
  const enter = (functionName: string, args: readonly (bigint | string)[], coin: Utxo): Promise<FramedProxyCallResult> =>
    callFramedProxyEntry({
      provider: network,
      implementationArtifact: Root!,
      proxyArtifact: buildProxyArtifact(Root!),
      proxyCategoryId: root.proxy.categoryId,
      implementationCategoryId: root.implementation.categoryId,
      functionName,
      args,
      externals: { IStore: { artifact: Store!, categoryId: STORE_CATEGORY } },
      callerUtxo: coin,
      callerLockingBytecode: ALICE_LOCK,
      funder: callerFunder,
      changeAddress,
      vm: compositionMachine(),
    });
  const opened = await enter('open', [ID, note], funding(OPEN_TXID));
  expect(opened.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return { network, both: () => enter('both', [ID], funding(CALL_TXID)) };
}

describe('one mapping value written twice in one hop by two sibling reaches', () => {
  for (const [label, note] of [['within the inline limit', SHORT_NOTE], ['taking chunks', LONG_NOTE]] as const) {
    it(`settles the second write from the value the first left, ${label}`, async () => {
      const { network, both } = await openThenBoth(note);
      const result = await both();
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
      const read = await readFramedEntry({
        provider: network, artifact: Store!, categoryId: STORE_CATEGORY, functionName: 'rec', args: [ID],
        vm: compositionMachine(),
      });
      const fields = read.value as { stage: bigint; flag: bigint; amount: bigint; note: string };
      expect([fields.stage, fields.flag, fields.amount, fields.note]).toStrictEqual([1n, 1n, 100n, note]);
      const layout = buildProxyArtifact(Root!).stateLayout!;
      const field = layout.variables.find((variable) => variable.name === 'done')!;
      expect(parsePushdataCommitment(binToHex(result.writtenCommitments[field.nftIndex]!), layout, field.nftIndex).done)
        .toBe(1n);
    });
  }
});
