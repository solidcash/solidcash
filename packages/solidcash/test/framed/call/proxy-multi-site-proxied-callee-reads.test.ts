import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import { sharedNodeId } from '../../../src/framed/proxy/entry-writes.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose proxied callee only reads a mapping node, reached at several sites.
 *
 * The callee is two contracts, so each reach takes a master of the callee proxy's and a master of the
 * implementation's. The implementation's entry writes nothing: it reads the node the caller's key names and
 * requires the value the caller states, so the frame has to declare that node in its own segment even though it
 * rewrites no record. The two unguarded reaches, the loop's two turns and the guarded reach the caller's argument
 * leaves untaken make four reaches in all, and each reads the same node.
 */

const LEDGER_IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const LEDGER_PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const OUTER_IMPL_CATEGORY = '33'.repeat(31) + 'cc';
const OUTER_PROXY_CATEGORY = '44'.repeat(31) + 'bb';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ILedger { function check(address who, int expected); }'
  + ' contract Ledger {'
  + '   address public implementation;'
  + '   mapping(address => int) allowance;'
  + '   function initialize() { this.allowance[msg.sender] = 500; require(true); }'
  + '   function check(address who, int expected) { require(this.allowance[who] == expected); }'
  + '   function allowanceOf(address who) view returns (int) { return this.allowance[who]; }'
  + ' }'
  + ' contract Outer {'
  + '   address public implementation;'
  + '   address public ledger;'
  + '   function initialize(address target) { this.ledger = target; require(true); }'
  + '   function run(address who, int expected, bool takeExtra, int times) {'
  + '     ILedger(this.ledger).check(who, expected);'
  + '     ILedger(this.ledger).check(who, expected);'
  + '     for (int i = 0; i < times; i = i + 1) { ILedger(this.ledger).check(who, expected); }'
  + '     if (takeExtra) { ILedger(this.ledger).check(who, expected); }'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const ledger = artifacts.Ledger!;
const outer = artifacts.Outer!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** Deploys the proxied callee and the root behind its proxy, and broadcasts both initializes. */
async function deployBoth(network: MockNetworkProvider): Promise<{
  readonly ledgerProxyCategoryId: string;
  readonly ledgerImplementationCategoryId: string;
  readonly outerProxyCategoryId: string;
  readonly outerImplementationCategoryId: string;
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

  for (const txid of [LEDGER_IMPL_CATEGORY, LEDGER_PROXY_CATEGORY, OUTER_IMPL_CATEGORY, OUTER_PROXY_CATEGORY]) {
    await network.addUtxo(source.address, funding(txid));
  }
  const ledgerInitCoin = funding('55'.repeat(32));
  const outerInitCoin = funding('66'.repeat(32));
  const callCoin = funding('77'.repeat(32));
  for (const coin of [ledgerInitCoin, outerInitCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
  await fundShippedFacets(network);

  const ledgerDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: ledger,
    proxyArtifact: buildProxyArtifact(ledger),
    implementationDeploy: {
      fundingUtxo: funding(LEDGER_IMPL_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    proxyDeploy: {
      fundingUtxo: funding(LEDGER_PROXY_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: ledgerInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(ledgerDeployment.initialize.accepted).toBe(true);

  const outerDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    implementationDeploy: { fundingUtxo: funding(OUTER_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(OUTER_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [ledgerDeployment.proxy.address] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: outerInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(outerDeployment.initialize.accepted).toBe(true);

  return {
    ledgerProxyCategoryId: ledgerDeployment.proxy.categoryId,
    ledgerImplementationCategoryId: ledgerDeployment.implementation.categoryId,
    outerProxyCategoryId: outerDeployment.proxy.categoryId,
    outerImplementationCategoryId: outerDeployment.implementation.categoryId,
    deployerLock,
    changeAddress: source.address,
    callCoin,
    funder: callerFunder,
  };
}

/** A deployment of both contracts, on the network that holds it. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly funded: Awaited<ReturnType<typeof deployBoth>>;
}

let deployedRun: Promise<Deployed> | undefined;

/**
 * The one deployment both cases share: the first call enters with the coin it funded, a later one with a fresh coin
 * at `txid`. The reaches only read the node, so neither case changes what the other reads.
 */
async function sharedDeployment(txid?: string): Promise<Deployed> {
  deployedRun ??= (async (): Promise<Deployed> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    return { network, funded: await deployBoth(network) };
  })();
  const deployed = await deployedRun;
  if (txid === undefined) return deployed;
  const callCoin = funding(txid);
  await deployed.network.addUtxo(binToHex(deployed.funded.deployerLock), callCoin);
  return { network: deployed.network, funded: { ...deployed.funded, callCoin } };
}

/** The value the callee's mapping node holds for a key, read back through the shipped reader. */
async function allowanceOf(
  network: MockNetworkProvider, categoryId: string, who: Uint8Array,
): Promise<unknown> {
  const read = await readFramedEntry({
    provider: network,
    artifact: ledger,
    categoryId,
    functionName: 'allowanceOf',
    args: [who],
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** Calls the root entry through the hop with the caller's own coin. */
async function callRun(
  network: MockNetworkProvider,
  funded: Awaited<ReturnType<typeof deployBoth>>,
  args: readonly [Uint8Array, bigint, boolean, bigint],
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    proxyCategoryId: funded.outerProxyCategoryId,
    implementationCategoryId: funded.outerImplementationCategoryId,
    functionName: 'run',
    args,
    externals: {
      ILedger: {
        artifact: ledger,
        categoryId: funded.ledgerProxyCategoryId,
        proxyArtifact: buildProxyArtifact(ledger),
        implementationCategoryId: funded.ledgerImplementationCategoryId,
      },
    },
    callerUtxo: funded.callCoin,
    callerLockingBytecode: funded.deployerLock,
    funder: funded.funder,
    changeAddress: funded.changeAddress,
    vm: compositionMachine(),
  });
}

describe('a hop whose proxied callee only reads a mapping node', () => {
  it('declares the read node, settles every reach and broadcasts', async () => {
    const { network, funded } = await sharedDeployment();

    const result = await callRun(network, funded, [funded.deployerLock, 500n, false, 2n]);

    // Each reach derives the callee's implementation entry, then the proxy fallback that entered it; the four
    // reaches come first, then the entry that made them and the fallback that entered it.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${ledger.contractName}.check()`,
      `${ledger.contractName}Proxy.__fallback()`,
      `${ledger.contractName}.check()`,
      `${ledger.contractName}Proxy.__fallback()`,
      `${ledger.contractName}.check()`,
      `${ledger.contractName}Proxy.__fallback()`,
      `${ledger.contractName}.check()`,
      `${ledger.contractName}Proxy.__fallback()`,
      `${outer.contractName}.run()`,
      `${outer.contractName}Proxy.__fallback()`,
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The four reaches share each of the callee's two blocks, and the guarded site places nothing.
    const proxyContract = buildProxyArtifact(ledger).contractName;
    expect(result.draft.layout.blocks.find((block) => block.contract === proxyContract)!.masters).toHaveLength(4);
    expect(result.draft.layout.blocks.find((block) => block.contract === ledger.contractName)!.masters)
      .toHaveLength(4);
    expect(result.draft.blockOf('implementation-master').calls).toHaveLength(4);
    // The node the reaches read is declared once, however many reaches read it, and holds the seeded value: it is
    // placed under the callee proxy's category, the collection and its own slot.
    expect(result.draft.layout.participants.filter((placed) => placed.id.startsWith('mapping-'))
      .map((placed) => placed.id)).toStrictEqual([
      sharedNodeId(funded.ledgerProxyCategoryId, 'allowance', keyToSlotMulti([funded.deployerLock])),
    ]);
    expect(await allowanceOf(network, funded.ledgerProxyCategoryId, funded.deployerLock)).toBe(500n);
  });

  it('refuses when the value the node holds is not the one the caller states', async () => {
    const { network, funded } = await sharedDeployment('77'.repeat(31) + 'c2');

    // The caller states 501 where the node holds 500, so the callee's own `require` refuses every reach.
    await expect(callRun(network, funded, [funded.deployerLock, 501n, false, 2n]))
      .rejects.toThrow(/did not settle through the proxy/);
    expect(await allowanceOf(network, funded.ledgerProxyCategoryId, funded.deployerLock)).toBe(500n);
  });
});
