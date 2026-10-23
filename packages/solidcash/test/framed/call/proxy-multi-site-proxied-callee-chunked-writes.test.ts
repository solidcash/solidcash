import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose proxied callee appends to a chunked mapping, reached at several sites.
 *
 * The callee is two contracts, so each reach takes a master of the callee proxy's and a master of the
 * implementation's. The implementation's entry pushes an element onto a mapping's array value, so the value the
 * node ends at is the one the deployment holds with the element appended, and a value past the inline limit takes
 * a run of chunk records. The two unguarded reaches, the loop's two turns and the guarded reach the caller's
 * argument leaves untaken make four reaches in all, each appending under its own key.
 *
 * The store's initialize writes no element, so the mapping holds only the empty head its proxy's genesis minted (a
 * head is minted only at genesis), and every reach splices its own key in through that one head.
 */

const STORE_IMPL_CATEGORY = '33'.repeat(31) + 'cc';
const STORE_PROXY_CATEGORY = '44'.repeat(31) + 'bb';
const OUTER_IMPL_CATEGORY = '55'.repeat(31) + 'aa';
const OUTER_PROXY_CATEGORY = '66'.repeat(31) + '99';

/** An element whose declared body pushes the array value past the inline limit, so its run occupies chunk records. */
const BODY = 'ab'.repeat(120);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IStore { function append(int id, Piece p); }'
  + ' struct Piece { int8 kind; bytes body; }'
  + ' contract Store {'
  + '   address public implementation;'
  + '   int public hits;'
  + '   mapping(int => Piece[]) public pieces;'
  + '   function initialize() { this.hits = 1; require(true); }'
  + '   function append(int id, Piece p) {'
  + '     this.pieces[id].push(p);'
  + '     require(true);'
  + '   }'
  + '   function piecesLength(int id) view returns (int) { return this.pieces[id].length; }'
  + '   function pieceKind(int id) view returns (int) { return this.pieces[id][0].kind; }'
  + ' }'
  + ' contract Outer {'
  + '   address public implementation;'
  + '   address public store;'
  + '   function initialize(address target) { this.store = target; require(true); }'
  + '   function run(bool takeExtra, int times) {'
  + `     IStore(this.store).append(10, Piece(1, hex"${BODY}"));`
  + `     IStore(this.store).append(20, Piece(2, hex"${BODY}"));`
  + `     for (int i = 0; i < times; i = i + 1) { IStore(this.store).append(100 + i, Piece(3, hex"${BODY}")); }`
  + `     if (takeExtra) { IStore(this.store).append(99, Piece(4, hex"${BODY}")); }`
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

/** Deploys the proxied callee and the root behind its proxy, and runs both initializes. */
async function deployAll(network: MockNetworkProvider): Promise<{
  readonly outerProxyCategoryId: string;
  readonly outerImplementationCategoryId: string;
  readonly storeProxyCategoryId: string;
  readonly storeImplementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}> {
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
      fundingUtxo: funding(STORE_IMPL_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    proxyDeploy: {
      fundingUtxo: funding(STORE_PROXY_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: storeInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(storeDeployment.initialize.broadcast).toBeDefined();

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

  return {
    outerProxyCategoryId: outerDeployment.proxy.categoryId,
    outerImplementationCategoryId: outerDeployment.implementation.categoryId,
    storeProxyCategoryId: storeDeployment.proxy.categoryId,
    storeImplementationCategoryId: storeDeployment.implementation.categoryId,
    deployerLock,
    changeAddress: source.address,
    callCoin,
    funder: callerFunder,
  };
}

describe('a hop whose proxied callee appends to a chunked mapping', () => {
  it('refuses the four reaches, each splicing through the one genesis head, and broadcasts nothing', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployAll(network);

    // Each reach plans its insert against the deployment alone, so all four relink the one head the genesis minted
    // to their own key. The cross-reach check leaves a dynamic value's reaches to chain through a node, so the shape
    // is settled; each frame checks its relink against the end view it declares and settles, and the settled hop
    // refuses the chain by name. Owner: the SDK hop planner, where reaches that touch one node are to share one
    // participant with their views chained in execution order.
    await expect(callFramedProxyEntry({
      provider: network,
      implementationArtifact: outer,
      proxyArtifact: buildProxyArtifact(outer),
      proxyCategoryId: funded.outerProxyCategoryId,
      implementationCategoryId: funded.outerImplementationCategoryId,
      functionName: 'run',
      args: [false, 2n],
      externals: {
        IStore: {
          artifact: store,
          categoryId: funded.storeProxyCategoryId,
          proxyArtifact: buildProxyArtifact(store),
          implementationCategoryId: funded.storeImplementationCategoryId,
        },
      },
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(
      `the hop's reach "${store.contractName}.append()" touches a node of collection "pieces" that an earlier reach `
      + `"${store.contractName}.append()" relinks to insert a key`,
    );
    expect((await network.getUtxosForLockingBytecode(funded.deployerLock))
      .some((utxo) => utxo.txid === funded.callCoin.txid && utxo.vout === funded.callCoin.vout)).toBe(true);
  });
});
