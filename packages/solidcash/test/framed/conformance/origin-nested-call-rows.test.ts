import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, parsePushdataCommitment, sha256, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { deployMaster, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * S0 conformance, spec section 23 row 7: `tx.origin` authorizes a nested call.
 *
 * The user enters `Desk.request` behind its proxy, and the desk calls `Vault.release`, which admits a caller that is
 * the owner or acts in a transaction the owner signed: `require(msg.sender == owner || tx.origin == owner)`, the guard
 * the row names. In the nested frame `msg.sender` is the desk and `tx.origin` the user who signed, exactly as on the
 * EVM, so the owner is admitted through `tx.origin` alone (O1, V5): the vault's frame states the desk's proxy as its
 * sender and the root user's input as its origin, and the claim it writes is on chain after the broadcast. A stranger
 * meets the vault's own reason and nothing is broadcast; the same vault guarded on `msg.sender` alone refuses the
 * owner too, because the desk, not the owner, is the nested frame's sender. The plain call path on the desk
 * implementation's own deployment, whose records hold no vault, refuses the entry by name.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`origin nested call rows ${label}`)));
}

const VAULT_CATEGORY = idOf('vault');
const DESK_IMPL_CATEGORY = idOf('desk implementation');
const DESK_PROXY_CATEGORY = idOf('desk proxy');

const OWNER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const STRANGER_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
const CLAIM_ID = 3n;
const AMOUNT = 25n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IVault { function release(int id, int amount); function releaseBySender(int id, int amount); }'
  + ' contract Vault {'
  + '   address public owner;'
  + '   mapping(int => int) public claims;'
  + '   constructor(address o) { this.owner = o; }'
  + '   function release(int id, int amount) {'
  + '     require(msg.sender == this.owner || tx.origin == this.owner, "not the owner");'
  + '     require(this.claims[id] == 0, "already released");'
  + '     this.claims[id] = amount;'
  + '   }'
  + '   function releaseBySender(int id, int amount) {'
  + '     require(msg.sender == this.owner, "not the owner");'
  + '     this.claims[id] = amount;'
  + '   }'
  + ' }'
  + ' contract Desk {'
  + '   address public implementation;'
  + '   address public vault;'
  + '   int public requests;'
  + '   function initialize(address v) { this.vault = v; require(true); }'
  + '   function request(int id, int amount) {'
  + '     this.requests = this.requests + 1; IVault(this.vault).release(id, amount);'
  + '   }'
  + '   function requestBySender(int id, int amount) {'
  + '     this.requests = this.requests + 1; IVault(this.vault).releaseBySender(id, amount);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const vault = artifacts.Vault!;
const desk = artifacts.Desk!;
const deskProxy = buildProxyArtifact(desk);

/** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/** The vault, then the desk behind its proxy pointing at it, and the chain as it stood when both were done. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly deskProxyCategoryId: string;
  readonly deskImplementationCategoryId: string;
  readonly deskProxyAddress: Uint8Array;
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
    const vaultCoin = funding(VAULT_CATEGORY);
    await network.addUtxo(wallet.address, vaultCoin);
    await deployStatefulContract(vault, [OWNER_LOCK], {
      fundingUtxo: vaultCoin, funder, changeAddress: wallet.address, provider: network,
    });
    for (const txid of [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(txid));
    const initCoin = funding(idOf('initialize coin'));
    await network.addUtxo(binToHex(OWNER_LOCK), initCoin);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: desk,
      proxyArtifact: deskProxy,
      implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder, changeAddress: wallet.address },
      proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder, changeAddress: wallet.address },
      initialize: {
        functionName: 'initialize',
        args: [deployMaster(vault, hexToBin(VAULT_CATEGORY), VALIDATOR_PROGRAM).address],
      },
      callerLockingBytecode: OWNER_LOCK,
      callerFunding: { utxo: initCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    return {
      network,
      deskProxyCategoryId: deployment.proxy.categoryId,
      deskImplementationCategoryId: deployment.implementation.categoryId,
      deskProxyAddress: deployment.proxy.address,
      changeAddress: wallet.address,
      externals: { IVault: { artifact: vault, categoryId: VAULT_CATEGORY } },
      snapshot: await network.takeSnapshot(),
    };
  })();
  const shared = await deployedRun;
  await shared.snapshot.restore();
  return shared;
}

/** Who enters the desk: the vault's owner or a stranger, each with a coin of their own. */
type Caller = 'owner' | 'stranger';

interface Entered {
  readonly coin: { txid: string; vout: number; satoshis: bigint };
  readonly lock: Uint8Array;
  readonly call: Promise<FramedProxyCallResult>;
}

/** Funds the caller's coin and runs one desk entry through the shipped proxy hop. */
async function enter(run: Deployed, functionName: string, caller: Caller): Promise<Entered> {
  const lock = caller === 'owner' ? OWNER_LOCK : STRANGER_LOCK;
  const coin = funding(idOf(`${caller} ${functionName} coin`));
  await run.network.addUtxo(binToHex(lock), coin);
  const call = callFramedProxyEntry({
    provider: run.network,
    implementationArtifact: desk,
    proxyArtifact: deskProxy,
    proxyCategoryId: run.deskProxyCategoryId,
    implementationCategoryId: run.deskImplementationCategoryId,
    functionName,
    args: [CLAIM_ID, AMOUNT],
    externals: run.externals,
    callerUtxo: coin,
    callerLockingBytecode: lock,
    funder: new SignatureTemplate(caller === 'owner' ? alicePriv : bobPriv).unlockP2PKH(),
    changeAddress: run.changeAddress,
    vm: compositionMachine(),
  });
  return { coin, lock, call };
}

/** The fields a deployment's data records hold, decoded with the shipped decoder. */
async function recordsOf(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string,
): Promise<Record<string, unknown>> {
  const layout = artifact.stateLayout!;
  const pools = await readFramedDeployment(network, categoryId, layout);
  return Object.assign({}, ...pools.records.map((record, nftIndex) =>
    parsePushdataCommitment(record.token!.nft!.commitment, layout, nftIndex))) as Record<string, unknown>;
}

/** The value tail of the vault's node for a claim id, or undefined while the list holds no node for it. */
async function claimOf(network: MockNetworkProvider, id: bigint): Promise<string | undefined> {
  const pools = await readFramedDeployment(network, VAULT_CATEGORY, vault.stateLayout!);
  const slot = bytesToHex(keyToSlotMulti([bigIntToVmNumber(id)]));
  const node = (pools.nodesByCollection.get('claims') ?? []).map((utxo) =>
    decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment))).find((entry) => bytesToHex(entry.slot) === slot);
  return node === undefined ? undefined : bytesToHex(node.value);
}

/** Every outpoint the two deployments hold and the chain's tip, which a refused call leaves exactly as they were. */
async function chainView(run: Deployed): Promise<{ readonly tip: number | undefined; readonly outpoints: string[] }> {
  const held = await Promise.all([VAULT_CATEGORY, run.deskProxyCategoryId, run.deskImplementationCategoryId]
    .map((categoryId) => run.network.getUtxosByTokenCategory(categoryId)));
  return {
    tip: run.network.indexer.getTip()?.height,
    outpoints: held.flat().map((utxo) => `${utxo.txid}:${utxo.vout}`).sort(),
  };
}

/** True while the caller's coin is unspent. */
async function coinLive(run: Deployed, entered: Entered): Promise<boolean> {
  return (await run.network.getUtxosForLockingBytecode(entered.lock))
    .some((utxo) => utxo.txid === entered.coin.txid && utxo.vout === entered.coin.vout);
}

describe('spec section 23 row 7: tx.origin authorizes a nested call', () => {
  it('admits the owner through tx.origin in the nested frame, and the claim it writes is on chain', async () => {
    const run = await deployed();
    const result = await (await enter(run, 'request', 'owner')).call;
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The vault runs below the desk, which runs below the proxy's fallback the user entered.
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Vault.release()', 'Desk.request()', 'DeskProxy.__fallback()']);

    // The fallback the user entered and the delegate frame it forwards to both see the owner as `msg.sender`; the
    // vault, one call below, sees the desk's proxy. All three name the same origin input: the owner's own coin.
    const root = result.draft.blockOf('proxy-master');
    const entry = result.draft.blockOf('implementation-master');
    const nested = result.draft.blockOf('callee-master-1');
    expect([root.sender, entry.sender, nested.sender].map(bytesToHex))
      .toStrictEqual([bytesToHex(OWNER_LOCK), bytesToHex(OWNER_LOCK), bytesToHex(run.deskProxyAddress)]);
    expect(new Set([root.originRef, entry.originRef, nested.originRef]).size).toBe(1);
    expect(bytesToHex(result.sourceOutputs[nested.originRef]!.lockingBytecode)).toBe(bytesToHex(OWNER_LOCK));

    // The post-state, read back from the chain: the vault holds the claim and the desk counted the request.
    expect(await claimOf(run.network, CLAIM_ID)).toBe(bytesToHex(bigIntToVmNumber(AMOUNT)));
    expect((await recordsOf(run.network, deskProxy, run.deskProxyCategoryId)).requests).toBe(1n);
  });

  it('refuses a stranger with the vault\'s own reason, and the provider sees no transaction', async () => {
    const run = await deployed();
    const before = await chainView(run);
    const entered = await enter(run, 'request', 'stranger');
    await expect(entered.call).rejects.toThrow(
      /the call's callee "Vault\.release\(\)" did not settle through the proxy: .*not the owner/,
    );
    expect(await coinLive(run, entered)).toBe(true);
    expect(await chainView(run)).toStrictEqual(before);
    expect(await claimOf(run.network, CLAIM_ID)).toBeUndefined();
    expect((await recordsOf(run.network, deskProxy, run.deskProxyCategoryId)).requests).toBe(0n);
  });

  it('refuses the owner when the vault admits msg.sender alone, which the nested frame names as the desk', async () => {
    const run = await deployed();
    const before = await chainView(run);
    const entered = await enter(run, 'requestBySender', 'owner');
    await expect(entered.call).rejects.toThrow(
      /the call's callee "Vault\.releaseBySender\(\)" did not settle through the proxy: .*not the owner/,
    );
    expect(await coinLive(run, entered)).toBe(true);
    expect(await chainView(run)).toStrictEqual(before);
    expect(await claimOf(run.network, CLAIM_ID)).toBeUndefined();
  });

  it('refuses the entry by name on the plain call path, whose implementation records hold no vault', async () => {
    const run = await deployed();
    const coin = funding(idOf('plain path coin'));
    await run.network.addUtxo(binToHex(OWNER_LOCK), coin);
    await expect(callFramedEntry({
      provider: run.network, artifact: desk, categoryId: run.deskImplementationCategoryId, functionName: 'request',
      args: [CLAIM_ID, AMOUNT], callerUtxo: coin, callerLockingBytecode: OWNER_LOCK,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
    })).rejects.toThrow(
      new RegExp('entry "request" makes 1 external call\\(s\\): the call to "IVault\\.release" targets the state '
        + 'field "vault", which the caller\'s own state does not hold as an address'),
    );
  });
});
