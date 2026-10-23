import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { type Artifact, type StateRecord } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { deployMaster, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { deploymentStateValues } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied callee that appends an element stamped with the transaction's own clock.
 *
 * The clock in this convention is a value the transaction's frames read rather than one the caller passes, so the
 * element a body appends is only stated by the hop when the hop reads the same clock the frame does. The callee
 * also emits an event on its own frame, which is the other half of what a body computes: the frame's own head
 * walks the event outputs the caller lists, so a frame whose events are undeclared stalls before its write closes.
 *
 * The reduced case drives the shipped deployment, composer, derivation and machine; the second drives the same path
 * against the artifact the project actually ships, whose job-event entry appends a struct whose last field is
 * `uint32(block.timestamp)` beside the event it emits, and reads the appended element back through the reader.
 */

const STORE_IMPL_CATEGORY = '33'.repeat(31) + 'cc';
const STORE_PROXY_CATEGORY = '44'.repeat(31) + 'bb';
const OUTER_IMPL_CATEGORY = '55'.repeat(31) + 'aa';
const OUTER_PROXY_CATEGORY = '66'.repeat(31) + '99';

/** An element body long enough that the appended value crosses the inline limit and takes chunk records. */
const BODY = 'ab'.repeat(120);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IStore { function append(int id, Piece p); }'
  + ' struct Piece { int8 kind; bytes body; uint32 at; }'
  + ' contract Store {'
  + '   address public implementation;'
  + '   event Appended(int indexed id);'
  + '   mapping(int => Piece[]) public pieces;'
  + '   function initialize() { require(true); }'
  + '   function append(int id, Piece p) {'
  + '     Piece e = p;'
  + '     e.at = uint32(block.timestamp);'
  + '     this.pieces[id].push(e);'
  + '     emit Appended(id);'
  + '     require(true);'
  + '   }'
  + '   function piecesLength(int id) view returns (int) { return this.pieces[id].length; }'
  + ' }'
  + ' contract Outer {'
  + '   address public implementation;'
  + '   address public store;'
  + '   function initialize(address target) { this.store = target; require(true); }'
  + '   function run() {'
  + `     IStore(this.store).append(7, Piece(1, hex"${BODY}", 0));`
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const store = artifacts.Store!;
const outer = artifacts.Outer!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

describe('a proxied callee that appends an element stamped with the transaction clock', () => {
  it('settles the reach, its own append and its event, and broadcasts', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = source.unlock.spend(alicePub, signature);
    const callerFunder = signature.unlockP2PKH();
    const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

    for (const txid of [STORE_IMPL_CATEGORY, STORE_PROXY_CATEGORY, OUTER_IMPL_CATEGORY, OUTER_PROXY_CATEGORY]) {
      await network.addUtxo(source.address, funding(txid));
    }
    const storeInitCoin = funding('71'.repeat(32));
    const outerInitCoin = funding('72'.repeat(32));
    const callCoin = funding('77'.repeat(32));
    for (const coin of [storeInitCoin, outerInitCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
    await fundShippedFacets(network);

    const storeDeployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: store,
      proxyArtifact: buildProxyArtifact(store),
      implementationDeploy: {
        fundingUtxo: funding(STORE_IMPL_CATEGORY), funder, changeAddress: source.address, threadCount: 4,
      },
      proxyDeploy: {
        fundingUtxo: funding(STORE_PROXY_CATEGORY), funder, changeAddress: source.address, threadCount: 4,
      },
      initialize: { functionName: 'initialize', args: [] },
      callerLockingBytecode: deployerLock,
      callerFunding: { utxo: storeInitCoin, funder: callerFunder, changeAddress: source.address },
      vm: compositionMachine(),
    });
    expect(storeDeployment.initialize.accepted).toBe(true);

    const outerDeployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: outer,
      proxyArtifact: buildProxyArtifact(outer),
      implementationDeploy: { fundingUtxo: funding(OUTER_IMPL_CATEGORY), funder, changeAddress: source.address },
      proxyDeploy: { fundingUtxo: funding(OUTER_PROXY_CATEGORY), funder, changeAddress: source.address },
      initialize: { functionName: 'initialize', args: [storeDeployment.proxy.address] },
      callerLockingBytecode: deployerLock,
      callerFunding: { utxo: outerInitCoin, funder: callerFunder, changeAddress: source.address },
      vm: compositionMachine(),
    });
    expect(outerDeployment.initialize.accepted).toBe(true);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: outer,
      proxyArtifact: buildProxyArtifact(outer),
      proxyCategoryId: outerDeployment.proxy.categoryId,
      implementationCategoryId: outerDeployment.implementation.categoryId,
      functionName: 'run',
      args: [],
      externals: {
        IStore: {
          artifact: store,
          categoryId: storeDeployment.proxy.categoryId,
          proxyArtifact: buildProxyArtifact(store),
          implementationCategoryId: storeDeployment.implementation.categoryId,
        },
      },
      callerUtxo: callCoin,
      callerLockingBytecode: deployerLock,
      funder: callerFunder,
      changeAddress: source.address,
      vm: compositionMachine(),
    });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The reach runs the implementation's own frame, which emits beside the element it appends. It is one reach:
    // the store's `pieces` holds only the head its genesis minted, and a second reach would splice through that same
    // head (`call/proxy-multi-site-proxied-callee-chunked-writes.test.ts`).
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${store.contractName}.append()`,
      `${store.contractName}Proxy.__fallback()`,
      `${outer.contractName}.run()`,
      `${outer.contractName}Proxy.__fallback()`,
    ]);

    // The element the reach appended carries the clock the frame read, read back through the shipped reader.
    for (const id of [7n]) {
      const read = await readFramedEntry({
        provider: network,
        artifact: store,
        categoryId: storeDeployment.proxy.categoryId,
        functionName: 'piecesLength',
        args: [id],
        vm: compositionMachine(),
      });
      expect(read.accepted, read.objection).toBe(true);
      expect(read.value).toBe(1n);
    }
  }, 400_000);
});

const ARTIFACTS_DIR = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../../.marketplace/artifacts/solidcash',
);
const hasArtifacts = existsSync(ARTIFACTS_DIR);

/** The artifact the project actually ships, whose `publishJobEvent` appends a clock-stamped element. */
function loadArtifact(name: string): Artifact {
  return JSON.parse(readFileSync(join(ARTIFACTS_DIR, name), 'utf8')) as Artifact;
}

// Deploying the shipped data contract takes minutes, so the case runs at milestones (`FRAMED_FULL=1`).
const describeShipped = hasArtifacts && process.env.FRAMED_FULL === '1' ? describe : describe.skip;

describeShipped('the shipped artifact whose append carries the transaction clock', () => {
  const DATA_IMPL_CATEGORY = '0b'.repeat(31) + 'f4';
  const DATA_PROXY_CATEGORY = '0d'.repeat(31) + 'f2';
  const CALLER_IMPL_CATEGORY = '0a'.repeat(31) + 'f5';
  const CALLER_PROXY_CATEGORY = '0e'.repeat(31) + 'f1';

  const CALLER_SOURCE = 'pragma solidity ^0.8.0;'
    + ' struct JobEventData { uint8 type_; bytes address_; bytes data_; uint32 timestamp_; }'
    + ' interface IData { function publishJobEvent(uint256 jobId_, JobEventData calldata event_) external; }'
    + ' contract Caller {'
    + '   address public implementation;'
    + '   address public data;'
    + '   function initialize(address target) { data = target; }'
    + '   function run(uint256 jobId) {'
    + `     IData(data).publishJobEvent(jobId, JobEventData(1, bytes(""), hex"${BODY}", 0));`
    + '   }'
    + ' }';

  it('settles the append the callee stamps and reads the element back', async () => {
    const data = loadArtifact('MarketplaceDataV1.json');
    const callerArtifacts = compileStringMulti(CALLER_SOURCE, {
      evmCompat: true, composition: 'framed',
    });
    const caller = callerArtifacts.Caller!;
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = source.unlock.spend(alicePub, signature);
    const callerFunder = signature.unlockP2PKH();
    const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

    for (const txid of [
      DATA_IMPL_CATEGORY, DATA_PROXY_CATEGORY, CALLER_IMPL_CATEGORY, CALLER_PROXY_CATEGORY,
    ]) await network.addUtxo(source.address, funding(txid));
    const initCoin = funding('71'.repeat(32));
    const dataInitCoin = funding('72'.repeat(32));
    const callCoin = funding('73'.repeat(32));
    for (const coin of [initCoin, dataInitCoin, callCoin]) {
      await network.addUtxo(binToHex(deployerLock), coin);
    }
    await fundShippedFacets(network);

    const callerProxyArtifact = buildProxyArtifact(caller);
    const dataProxyArtifact = buildProxyArtifact(data);
    const dataProxyMaster = deployMaster(
      dataProxyArtifact, hexToBin(DATA_PROXY_CATEGORY), framedValidator.buildValidatorProgram(),
    ).address;

    // The caller's own proxy is the data contract's marketplace, and its record names the data contract's proxy.
    const callerDeployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: caller,
      proxyArtifact: callerProxyArtifact,
      implementationDeploy: {
        fundingUtxo: funding(CALLER_IMPL_CATEGORY), funder, changeAddress: source.address, threadCount: 6,
      },
      proxyDeploy: {
        fundingUtxo: funding(CALLER_PROXY_CATEGORY), funder, changeAddress: source.address, threadCount: 6,
      },
      initialize: { functionName: 'initialize', args: [dataProxyMaster] },
      callerLockingBytecode: deployerLock,
      callerFunding: { utxo: initCoin, funder: callerFunder, changeAddress: source.address },
      vm: compositionMachine(),
    });
    expect(callerDeployment.initialize.accepted).toBe(true);

    const dataDeployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: data,
      proxyArtifact: dataProxyArtifact,
      implementationDeploy: {
        fundingUtxo: funding(DATA_IMPL_CATEGORY), funder, changeAddress: source.address, threadCount: 6,
      },
      proxyDeploy: {
        fundingUtxo: funding(DATA_PROXY_CATEGORY), funder, changeAddress: source.address, threadCount: 6,
      },
      initialize: { functionName: 'initialize', args: [callerDeployment.proxy.address] },
      callerLockingBytecode: deployerLock,
      callerFunding: { utxo: dataInitCoin, funder: callerFunder, changeAddress: source.address },
      vm: compositionMachine(),
    });
    expect(dataDeployment.initialize.accepted).toBe(true);

    // The clock the hop's transaction carries: the field the frame's own record holds, which is what the body
    // reads back for `block.timestamp` and what the plan states the appended element's last field from.
    const classification = {
      ...dataProxyArtifact.stateLayout!,
      collections: data.stateLayout?.collections,
    };
    const live = await readFramedDeployment(network, dataDeployment.proxy.categoryId, classification);
    const clock = deploymentStateValues(
      classification, dataDeployment.proxy.categoryId, live,
    ).__block_timestamp;
    expect(typeof clock).toBe('bigint');

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: caller,
      proxyArtifact: callerProxyArtifact,
      proxyCategoryId: callerDeployment.proxy.categoryId,
      implementationCategoryId: callerDeployment.implementation.categoryId,
      functionName: 'run',
      args: [5n],
      externals: {
        IData: {
          artifact: data,
          categoryId: dataDeployment.proxy.categoryId,
          proxyArtifact: dataProxyArtifact,
          implementationCategoryId: dataDeployment.implementation.categoryId,
        },
      },
      callerUtxo: callCoin,
      callerLockingBytecode: deployerLock,
      funder: callerFunder,
      changeAddress: source.address,
      vm: compositionMachine(),
    });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${data.contractName}.publishJobEvent()`,
      `${data.contractName}Proxy.__fallback()`,
      `${caller.contractName}.run()`,
      `${caller.contractName}Proxy.__fallback()`,
    ]);

    // The element the body computed is the element the plan stated: its last field is the clock, and the frame's
    // own close accepted only because the value the plan declared there is the one the body built.
    const read = await readFramedEntry({
      provider: network,
      artifact: data,
      categoryId: dataDeployment.proxy.categoryId,
      functionName: 'getEvents',
      args: [5n, 0n, 1n],
      vm: compositionMachine(),
    });
    expect(read.accepted, read.objection).toBe(true);
    const events = read.value as (StateRecord & { readonly type_: bigint; readonly timestamp_: bigint })[];
    expect(events).toHaveLength(1);
    expect(events[0]!.type_).toBe(1n);
    expect(events[0]!.timestamp_).toBe(clock);
  }, 600_000);
});

it.runIf(!hasArtifacts)('skips the shipped-append suite: no compiled artifacts directory', () => {
  expect(hasArtifacts).toBe(false);
});
