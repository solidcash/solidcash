import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { Unlocker } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact, callFramedProxyEntry, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A getter of a chunkable mapping, reached once per turn of a run-time loop, through the callee's own proxy.
 *
 * The caller loops over the array its call carries and asks the other contract, once per element, whether its
 * mapping holds a value under that key, and the entry then requires exactly one non-empty answer. The callee is a
 * getter behind a proxy, so a turn's value travels as a user's read of it does: the proxy's fallback frame
 * delegates into the implementation's getter, the getter's returned blob is recorded as the call's result, and the
 * caller's own body reads that blob back to test the answer. Both boundaries are driven, because the blob's
 * encoding is the caller's to read: a native callee returns the canonical pushes of its values, and a
 * Solidity-compatible one returns an ABI tuple whose first byte is an offset.
 */
function source(declaration: string): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface IData { function tags(string key) external view returns (string); }'
    + ' contract Data {'
    + '   mapping(string => string) public tags;'
    + `   ${declaration}`
    + '   function initialize() { this.tags["DV"] = "DIGITAL_VIDEO"; }'
    + ' }'
    + ' contract Caller {'
    // A proxy mirrors its implementation's records field by field, so the caller declares the fields a record
    // needs as well as the address it calls.
    + '   uint256 public openedAt;'
    + '   uint256 public closedAt;'
    + '   uint256 public revision;'
    + '   uint256 public rate;'
    + '   address public data;'
    + '   function initialize(address data_) { this.data = data_; }'
    + '   function check(string[] keys) returns (uint) {'
    + '     uint count = 0;'
    + '     for (uint8 i = 0; i < keys.length; i++) {'
    + '       if (bytes(IData(this.data).tags(keys[i])).length != 0) { count = count + 1; }'
    + '     }'
    + '     require(count == 1, "Exactly one tag");'
    + '     return count;'
    + '   }'
    + ' }';
}

/**
 * The two boundaries' sources.
 *
 * A Solidity-compatible import publishes a public mapping's own generated getter as an entry, which is the callee
 * a Solidity codebase calls; a native compilation publishes no such entry, so that source declares the getter it
 * calls.
 */
const SOURCES = {
  compat: source(''),
  native: source('function tags(string key) view returns (string) { return this.tags[key]; }'),
};

/** A 32-byte outpoint hash whose bytes are not all the same, so a byte-order bug cannot hide in it. */
function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

interface Wire {
  readonly network: MockNetworkProvider;
  readonly signature: SignatureTemplate;
  readonly funder: Unlocker;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
}

/** The network every genesis and caller coin sits on. */
async function wired(): Promise<Wire> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  await fundShippedFacets(network);
  return {
    network, signature, funder: funder.unlock.spend(alicePub, signature),
    deployerLock: encodeLockingBytecodeP2pkh(alicePkh), changeAddress: funder.address,
  };
}

/** Deploys one implementation behind its own proxy, funded by the wire's funder and entered by the deployer. */
async function deployBehindProxy(
  wire: Wire, implementationArtifact: Artifact, seed: number, args: readonly unknown[],
): Promise<Awaited<ReturnType<typeof deployFramedProxy>>> {
  const implFunding = { txid: outpointHash(seed), vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: outpointHash(seed + 1), vout: 0, satoshis: 500_000n };
  const callerUtxo = { txid: outpointHash(seed + 2), vout: 0, satoshis: 100_000n };
  await wire.network.addUtxo(wire.changeAddress, implFunding);
  await wire.network.addUtxo(wire.changeAddress, proxyFunding);
  await wire.network.addUtxo(binToHex(wire.deployerLock), callerUtxo);
  return deployFramedProxy({
    provider: wire.network,
    implementationArtifact,
    proxyArtifact: buildProxyArtifact(implementationArtifact),
    implementationDeploy: { fundingUtxo: implFunding, funder: wire.funder, changeAddress: wire.changeAddress },
    proxyDeploy: { fundingUtxo: proxyFunding, funder: wire.funder, changeAddress: wire.changeAddress },
    initialize: { functionName: 'initialize', args: args as never },
    callerLockingBytecode: wire.deployerLock,
    callerFunding: { utxo: callerUtxo, funder: wire.signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
}

/**
 * Deploys both contracts behind their own proxies and calls the loop through the caller's, under one boundary.
 *
 * The caller's own state holds the callee's address, which is what its body computes the call's target from; the
 * callee's deployment is handed over as the caller's named external for the interface the call reaches.
 *
 * A genesis-outpoint reservation is process-local and keyed by the outpoint, so the two cases each fund from their
 * own `seed`: sharing one outpoint across chains would hold it out of the second case's funding selection.
 */
async function run(evmCompat: boolean, seed: number): Promise<{
  readonly accepted: boolean;
  readonly objections: readonly string[];
  readonly broadcast?: { readonly txid: string };
}> {
  const artifacts = compileStringMulti(
    evmCompat ? SOURCES.compat : SOURCES.native,
    { composition: 'framed', ...(evmCompat ? { evmCompat: true } : {}) },
  );
  const wire = await wired();
  const data = await deployBehindProxy(wire, artifacts.Data!, seed, []);
  expect(data.initialize.broadcast).toBeDefined();
  const caller = await deployBehindProxy(wire, artifacts.Caller!, seed + 0x10, [data.proxy.address]);
  expect(caller.initialize.broadcast).toBeDefined();

  const external: FramedProxyExternal = {
    artifact: artifacts.Data!,
    categoryId: data.proxy.categoryId,
    proxyArtifact: buildProxyArtifact(artifacts.Data!),
    implementationCategoryId: data.implementation.categoryId,
  };
  const coin = { txid: outpointHash(seed + 0x20), vout: 0, satoshis: 100_000n };
  await wire.network.addUtxo(binToHex(wire.deployerLock), coin);

  const answered = await callFramedProxyEntry({
    provider: wire.network,
    implementationArtifact: artifacts.Caller!,
    proxyArtifact: buildProxyArtifact(artifacts.Caller!),
    proxyCategoryId: caller.proxy.categoryId,
    implementationCategoryId: caller.implementation.categoryId,
    functionName: 'check',
    args: [['DV']] as never,
    externals: { IData: external },
    callerUtxo: coin,
    callerLockingBytecode: wire.deployerLock,
    funder: wire.signature.unlockP2PKH(),
    changeAddress: wire.changeAddress,
    vm: compositionMachine(),
  });
  return {
    accepted: answered.accepted,
    objections: answered.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${String(verdict.objection ?? 'refused')}`),
    ...(answered.broadcast === undefined ? {} : { broadcast: answered.broadcast }),
  };
}

describe('a run-time loop reads a proxied getter once per turn', () => {
  it('settles the loop where the callee returns its values as canonical pushes', async () => {
    const answered = await run(false, 0x30);
    expect({ accepted: answered.accepted, objections: answered.objections })
      .toStrictEqual({ accepted: true, objections: [] });
    expect(answered.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('settles the loop where the callee returns a Solidity-compatible result tuple', async () => {
    // The callee's retval is an ABI tuple, whose first word is the offset of the returned string: reading it as
    // pushdata takes that offset's first byte as an empty push, and the answer the caller counts comes back empty.
    const answered = await run(true, 0x60);
    expect({ accepted: answered.accepted, objections: answered.objections })
      .toStrictEqual({ accepted: true, objections: [] });
    expect(answered.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
