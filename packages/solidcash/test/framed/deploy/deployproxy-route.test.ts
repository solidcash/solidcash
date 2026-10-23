import { describe, expect, it } from 'vitest';
import { hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Signer } from '../../../src/index.js';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import {
  getContractFactory,
  deployProxy,
  ProxyContract,
  type FramedArtifact,
  type FramedProxyHandle,
} from '../../../src/stateful/index.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact } from '../../../src/framed/proxy/index.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { VALIDATOR_PROGRAM } from '../shapes/harness.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The ordinary `deployProxy` entry point reached with a framed implementation.
 *
 * A framed artifact is a master program, not a direct-convention contract: its entries read their frame from a
 * witness block, and it runs behind the fallback-only proxy the convention compiles. The direct builder therefore
 * has nothing to spend, and `deployProxy` routes the whole deployment - both geneses and the `initialize` hop -
 * through the framed path, generating the proxy from the implementation's own declaration. What it returns is
 * the contract handle, whose bare names are the implementation's entries, with the deployment's own record nested
 * under it: the proxy's category and address, the implementation it forwards to, the derived hop and the machine's
 * verdict on every participant.
 *
 * The direct control below pins that a direct-convention artifact is unaffected and still returns a `ProxyContract`.
 */

// The proxy's records are the implementation's records: the implementation's write rebuilds the record from its
// own declaration, so both name the same fields and the address the fallback forwards to is one of them.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public version;'
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '     this.version = 7;'
  + '   }'
  + ' }';

const DIRECT_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Counter { int public counter; function initialize() public { this.counter = 5; } }';

/** A relaxed mock network, matching what a composition shape needs to run. */
function provider(): MockNetworkProvider {
  return new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
}

/** A funded Signer over the provider; a deploy needs fresh vout-0 coins to create each token category. */
async function fundedSigner(network: MockNetworkProvider, fill: number): Promise<Signer> {
  const signer = new Signer(new Uint8Array(32).fill(fill), network);
  for (let index = 0; index < 6; index += 1) {
    await network.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
  }
  // The hop broadcasts, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);
  return signer;
}

interface Routed {
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly deployerLock: Uint8Array;
  readonly routed: FramedProxyHandle;
}

let routedRun: Promise<Routed> | undefined;

/** The routed deployment the first two cases read; the second's re-entered initialize broadcasts nothing. */
function routedDeployment(): Promise<Routed> {
  routedRun ??= (async (): Promise<Routed> => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const network = provider();
    const signer = await fundedSigner(network, 0x51);
    const deployerLock = signer.getLockingBytecode();
    const routed: FramedProxyHandle = await deployProxy(
      getContractFactory(artifacts.Impl! as FramedArtifact, signer), [deployerLock],
    );
    return { artifacts, deployerLock, routed };
  })();
  return routedRun;
}

interface TableRun {
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly network: MockNetworkProvider;
  readonly signer: Signer;
  readonly handle: StatefulContract & {
    append(note: string, amount: bigint): Promise<unknown>;
    rows(index: number): Promise<{ note: string; amount: bigint }>;
  };
  readonly note: string;
}

let tableRun: Promise<TableRun> | undefined;
function tableDeployment(): Promise<TableRun> {
  tableRun ??= (async (): Promise<TableRun> => {
    const artifacts = compileStringMulti('pragma solidcash ^0.13.0;'
      + ' contract Table {'
      + '   struct Row { string note; bigint amount; }'
      + '   bigint public counter;'
      + '   Row[] public rows;'
      + '   function initialize() { this.counter = 7; }'
      + '   function append(string note, bigint amount) {'
      + '     this.rows.push();'
      + '     Row storage row = this.rows[this.rows.length - 1];'
      + '     row.note = note; row.amount = amount;'
      + '     this.counter = this.counter + 1;'
      + '   }'
      + ' }', { composition: 'framed', tagSingletonDataNfts: true });
    const network = provider();
    const signer = await fundedSigner(network, 0x54);
    const deployed = await deployProxy(getContractFactory(artifacts.Table! as FramedArtifact, signer), []);
    const handle = deployed as unknown as StatefulContract & {
      append(note: string, amount: bigint): Promise<unknown>;
      rows(index: number): Promise<{ note: string; amount: bigint }>;
    };
    // D49: the unbounded `rows` array takes a data NFT of its own, so the implementation keeps two and the proxy
    // adds its own `address` record.
    expect(artifacts.Table!.stateLayout!.dataNftCount).toBe(2);
    expect(buildProxyArtifact(artifacts.Table!).stateLayout!.dataNftCount).toBe(3);
    expect(await handle.getState()).toMatchObject({ counter: 7n, rows: [] });
    const note = 'a dynamic row crossing a chunk boundary '.repeat(5);
    await handle.append(note, 9n);
    expect(await handle.rows(0)).toMatchObject({ note, amount: 9n });
    expect(await handle.getState()).toMatchObject({ counter: 8n, rows: [{ note, amount: 9n }] });
    return { artifacts, network, signer, handle, note };
  })();
  return tableRun;
}

describe('deployProxy with a framed implementation', () => {
  it('reads tagged implementation fields and dynamic rows after a proxied update', async () => {
    const { handle, signer, note } = await tableDeployment();
    const connected = handle.connect(signer) as unknown as typeof handle;
    expect(await connected.rows(0)).toMatchObject({ note, amount: 9n });
    expect(Object.keys(await connected.getState()).sort()).toEqual(['counter', 'rows']);
  }, 300_000);

  it('retains proxy owner inventory across signer and provider rebinding', async () => {
    const { artifacts, handle, network, signer, note } = await tableDeployment();
    const owner = buildProxyArtifact(artifacts.Table!);
    const master = deployMaster(owner, hexToBin(handle.categoryId), VALIDATOR_PROGRAM);
    const masterAddress = lockingBytecodeToCashAddress({
      bytecode: master.lockingBytecode, prefix: 'bchtest', tokenSupport: true,
    });
    if (typeof masterAddress === 'string') throw new Error(masterAddress);
    const liveMasters = await network.getUtxos(masterAddress.address);
    expect(liveMasters.length).toBeGreaterThan(0);
    // A distinct provider facade proves reads use the rebound provider, while retaining the deployment context.
    const rebound = Object.create(network) as MockNetworkProvider;
    expect(handle.withProvider(rebound).provider).toBe(rebound);
    for (const candidate of [handle, handle.connect(signer), handle.withProvider(rebound), handle.connect(rebound)]) {
      expect(candidate.address).toBe(handle.address);
      const full = await candidate.getFullState();
      expect(Object.keys(full.state).sort()).toEqual(['counter', 'rows']);
      expect(full.state).toMatchObject({ counter: 8n, rows: [{ note, amount: 9n }] });
      expect(full.masterUtxo).toBeDefined();
      expect(liveMasters.some((utxo) => utxo.txid === full.masterUtxo?.txid
        && utxo.vout === full.masterUtxo?.vout)).toBe(true);
      expect(full.dataNftUtxos).toHaveLength(owner.stateLayout!.dataNftCount);
      const pointer = full.dataNftUtxos[artifacts.Table!.stateLayout!.dataNftCount]!;
      expect(parsePushdataCommitment(
        pointer.token!.nft!.commitment, owner.stateLayout!, artifacts.Table!.stateLayout!.dataNftCount,
      ).implementation).toBeInstanceOf(Uint8Array);
      const records = new Set(full.dataNftUtxos.map((utxo) => `${utxo.txid}:${utxo.vout}`));
      expect(full.entryNftUtxos.some((utxo) => records.has(`${utxo.txid}:${utxo.vout}`))).toBe(false);
      expect(full.dynamicChunkUtxos?.rows.length).toBeGreaterThan(1);
      for (const chunk of full.dynamicChunkUtxos!.rows) {
        expect(full.entryNftUtxos.some((utxo) => utxo.txid === chunk.txid && utxo.vout === chunk.vout)).toBe(true);
      }
      expect(await (candidate as unknown as typeof handle).rows(0)).toMatchObject({ note, amount: 9n });
      expect(await candidate.getState()).toMatchObject(full.state);
    }
  }, 300_000);

  it('routes to the framed deployment and settles the initialize hop', async () => {
    const { artifacts, routed } = await routedDeployment();
    const deployment = routed.proxyDeployment;

    // The handle names the deployed proxy: its category and the address its masters and records sit under.
    expect(deployment.proxy.categoryId).toMatch(/^[0-9a-f]{64}$/);
    const proxyArtifact = buildProxyArtifact(artifacts.Impl!);
    const proxyMaster = deployMaster(proxyArtifact, hexToBin(deployment.proxy.categoryId), VALIDATOR_PROGRAM);
    expect([...deployment.proxy.address]).toStrictEqual([...proxyMaster.address]);
    expect(deployment.implementation.categoryId).toMatch(/^[0-9a-f]{64}$/);

    // The initialize hop ran through the proxy: the implementation frame first, then the proxy that forwarded.
    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Impl.initialize()', `${proxyArtifact.contractName}.__fallback()`]);
    // Every convention participant - both masters, the validator and the proxy's record - was accepted.
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);
  });

  it('keeps the implementation entry callable beside the deployment record', async () => {
    const { deployerLock, routed } = await routedDeployment();

    // `initialize` names the implementation's entry, as it does for a direct-convention deploy; the deployment's
    // own record of the hop sits beside the handle rather than over that name.
    const handle = routed as unknown as { initialize: (arg: Uint8Array) => Promise<unknown> };
    expect(typeof handle.initialize).toBe('function');
    expect(routed.proxyDeployment.initialize.accepted).toBe(true);

    // Re-entering the initializer is the entry's own guard refusing, so nothing is broadcast.
    await expect(handle.initialize(deployerLock)).rejects.toThrow(/initialize/);
  });

  // The written record keeping the implementation's address is the deployment's own property, asserted in
  // `proxy-deployment`, `generated-proxy` and `proxy-initialize-broadcast`.
  it('leaves a direct-convention artifact on the direct path', async () => {
    const artifacts = compileStringMulti(DIRECT_SOURCE);
    const network = provider();
    const signer = await fundedSigner(network, 0x53);

    const handle = await deployProxy(getContractFactory(artifacts.Counter!, signer), []);

    expect(handle).toBeInstanceOf(ProxyContract);
    // The direct handle forwards through a pinned delegatecall; a framed deployment has no such method.
    expect(typeof handle.forward).toBe('function');
    expect(handle.forwardShape.mode).toBe('baked');
    expect(await handle.getAddress()).toMatch(/^[a-z]+:/);
  });
});
