/**
 * Contract-governed metadata (docs/bcmr/DESIGN.md, section 9): the identity output's guard publishes only a registry
 * the contract authorized through its own access control, once the authorizing event has matured.
 */
import { readFileSync } from 'node:fs';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { compileFile, compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  EVENT_MATURITY_BLOCKS, applyGovernedMetadata, encodeRegistry, framedEventLockingBytecode, governedAuthorization,
  governedEvent, governedGuardFor, governedGuardLockingBytecode, withSnapshot, type MetadataRegistry,
} from '../../src/bcmr/index.js';
import { callFramedEntry } from '../../src/framed/call/index.js';
import { SignatureTemplate } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type Signer from '../../src/Signer.js';
import { getEventNftAddress } from '../../src/stateful/covenant-helpers.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { addressToLockScript } from '../../src/utils.js';
import { aliceAddress, alicePkh, alicePriv } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const SOURCE = new URL('../fixture/bcmr_governed_counter.scash', import.meta.url);
// Metadata any caller may authorize: the guard's notation and event lock are under test, not access control.
const OPEN_BODY = 'pragma solidcash >=0.8.0; import { BcmrGoverned } from "./BcmrGoverned.scash";'
  + ' contract GovernedOpen is BcmrGoverned { int count;'
  + '   function _bcmrMayUpdate() internal view override returns (bool) { return true; }';
const OPEN = `${OPEN_BODY} }`;
// A framed call plans a monolith's frame only when the master dispatches between entries.
const FRAMED_OPEN = `${OPEN_BODY} function bump() { this.count = this.count + 1; require(this.count > 0); } }`;
const GOVERNED_FILES = {
  'BcmrGoverned.scash': readFileSync(new URL('../../contracts/BcmrGoverned.scash', import.meta.url), 'utf8'),
};
const T0 = '2026-10-20T12:00:00.000Z';
const T1 = '2026-10-21T12:00:00.000Z';
const T2 = '2026-10-22T12:00:00.000Z';

interface CallOutput {
  lockingBytecode: Uint8Array;
  valueSatoshis: bigint;
  token?: { category: Uint8Array; nft?: { capability: string; commitment: Uint8Array } };
}
type Governed = {
  updateMetadata: (hash: Uint8Array, txid: Uint8Array) => { send: () => Promise<{ txid: string; outputs: CallOutput[] }> };
};

/** The MetadataUpdated event NFT a call minted, as a UTXO: its immutable NFT, of `category` when given. */
function authorizationOf(call: { txid: string; outputs: readonly CallOutput[] }, category?: string): Utxo {
  const vout = call.outputs.findIndex((output) => output.token?.nft?.capability === 'none'
    && (category === undefined || binToHex(output.token.category) === category));
  const output = call.outputs[vout]!;
  return {
    txid: call.txid,
    vout,
    satoshis: output.valueSatoshis,
    token: {
      category: binToHex(output.token!.category), amount: 0n,
      nft: { capability: 'none', commitment: binToHex(output.token!.nft!.commitment) },
    },
  };
}

async function feeCoin(signer: Signer): Promise<Utxo> {
  return (await signer.getUtxos())
    .filter((utxo) => utxo.token === undefined && utxo.satoshis > 10_000n)
    .sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1))[0]!;
}

describe('contract-governed metadata', () => {
  const artifact = compileFile(SOURCE, { messageBus: false });

  it('publishes only what the contract authorized, once the authorization matures, and only once', async () => {
    const provider = new MockNetworkProvider();
    const [alice, bob] = await provider.getSigners(2, { fundingUtxos: 3, genesisFundingUtxos: 3 }) as unknown as Signer[];
    const fundingUtxo = (await alice!.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined)!;
    const deployed = await StatefulContract.deploy(artifact, [alice!.getLockingBytecode()], {
      provider, fundingUtxo, funder: alice!.unlockP2PKH(), changeAddress: alice!.getAddress(), initialState: {},
      identity: { kind: 'governed' }, bcmr: { name: 'Governed', timestamp: T0 },
    });
    const category = deployed.categoryId;
    const guard = governedGuardFor(artifact, category, addressToLockScript(getEventNftAddress(
      deployed.contract.inner, category, governedEvent(artifact).event.signature,
    )));
    expect(binToHex(deployed.tx.outputs[0]!.lockingBytecode)).toBe(binToHex(governedGuardLockingBytecode(guard)));
    expect(deployed.identity?.policy).toBe('governed');

    const next = withSnapshot(deployed.registry!.registry, category, { name: 'Governed v2' }, T1);
    const encoded = await encodeRegistry(next);
    const authorization = governedAuthorization(encoded.sha256, deployed.identity!.txid);

    // The contract's own access control decides who authorizes.
    const asBob = deployed.contract.connect(bob!) as unknown as Governed;
    await expect(asBob.updateMetadata(authorization.registryHash, authorization.identityTxid).send()).rejects.toThrow();
    const asAlice = deployed.contract.connect(alice!) as unknown as Governed;
    const authorized = await asAlice.updateMetadata(authorization.registryHash, authorization.identityTxid).send();

    await provider.mine(EVENT_MATURITY_BLOCKS + 1);
    const identity: Utxo = { txid: deployed.identity!.txid, vout: 0, satoshis: deployed.identity!.satoshis };
    const applied = await applyGovernedMetadata({
      provider, artifact, guard, identity, authorization: authorizationOf(authorized), registry: next,
      feeFunding: { utxo: await feeCoin(alice!), unlocker: alice!.unlockP2PKH() }, changeAddress: alice!.getAddress(),
    });
    expect(binToHex(applied.tx.outputs[0]!.lockingBytecode)).toBe(binToHex(governedGuardLockingBytecode(guard)));
    expect(binToHex(applied.tx.outputs[1]!.lockingBytecode.slice(7, 39))).toBe(binToHex(encoded.sha256));

    // An authorization naming the outpoint the guard has left cannot move it again.
    const later = withSnapshot(next, category, { name: 'Governed v3' }, T2);
    const stale = governedAuthorization((await encodeRegistry(later)).sha256, deployed.identity!.txid);
    const staleCall = await asAlice.updateMetadata(stale.registryHash, stale.identityTxid).send();
    await provider.mine(EVENT_MATURITY_BLOCKS + 1);
    await expect(applyGovernedMetadata({
      provider, artifact, guard,
      identity: { txid: applied.identity.txid, vout: 0, satoshis: applied.identity.satoshis },
      authorization: authorizationOf(staleCall), registry: later,
      feeFunding: { utxo: await feeCoin(alice!), unlocker: alice!.unlockP2PKH() }, changeAddress: alice!.getAddress(),
    })).rejects.toThrow(/OP_(EQUAL)?VERIFY/);
  });

  it('holds an authorization back 144 blocks, publishes only the registry it names, and burns it', async () => {
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1, { fundingUtxos: 3, genesisFundingUtxos: 3 }) as unknown as Signer[];
    const fundingUtxo = (await alice!.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined)!;
    const deployed = await StatefulContract.deploy(artifact, [alice!.getLockingBytecode()], {
      provider, fundingUtxo, funder: alice!.unlockP2PKH(), changeAddress: alice!.getAddress(), initialState: {},
      identity: { kind: 'governed' }, bcmr: { name: 'Governed', timestamp: T0 },
    });
    const category = deployed.categoryId;
    const eventAddress = getEventNftAddress(deployed.contract.inner, category, governedEvent(artifact).event.signature);
    const guard = governedGuardFor(artifact, category, addressToLockScript(eventAddress));
    const next = withSnapshot(deployed.registry!.registry, category, { name: 'Governed v2' }, T1);
    const encoded = await encodeRegistry(next);
    const authorization = governedAuthorization(encoded.sha256, deployed.identity!.txid);
    const asAlice = deployed.contract.connect(alice!) as unknown as Governed;
    const authorized = authorizationOf(
      await asAlice.updateMetadata(authorization.registryHash, authorization.identityTxid).send(),
    );
    const identity: Utxo = { txid: deployed.identity!.txid, vout: 0, satoshis: deployed.identity!.satoshis };
    const apply = async (registry: MetadataRegistry): ReturnType<typeof applyGovernedMetadata> => applyGovernedMetadata({
      provider, artifact, guard, identity, authorization: authorized, registry,
      feeFunding: { utxo: await feeCoin(alice!), unlocker: alice!.unlockP2PKH() }, changeAddress: alice!.getAddress(),
    });

    // The event NFT's relative timelock holds the authorization back until it is 144 blocks old.
    await expect(apply(next)).rejects.toThrow(/non-BIP68-final/);
    await provider.mine(EVENT_MATURITY_BLOCKS + 1);
    // Matured, it publishes only the registry whose hash it names.
    const edited = withSnapshot(deployed.registry!.registry, category, { name: 'Governed v2, edited' }, T1);
    await expect(apply(edited)).rejects.toThrow(/OP_(EQUAL)?VERIFY/);
    const applied = await apply(next);
    expect(applied.tx.inputs[1]!.sequenceNumber).toBe(144);
    expect(binToHex(applied.tx.outputs[1]!.lockingBytecode.slice(7, 39))).toBe(binToHex(encoded.sha256));
    // The authorizing NFT is burned: no output carries a token, and the event's lock no longer holds it.
    expect(applied.tx.outputs.every((output) => output.token === undefined)).toBe(true);
    expect((await provider.getUtxos(eventAddress)).some((utxo) => utxo.txid === authorized.txid)).toBe(false);
  });

  it('reads an authorization its event writes in EVM notation', async () => {
    const evm = compileString(OPEN, { messageBus: false, evmCompat: true, files: GOVERNED_FILES });
    expect(governedEvent(evm).notation).toBe('evm');
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1, { fundingUtxos: 3, genesisFundingUtxos: 3 }) as unknown as Signer[];
    const fundingUtxo = (await alice!.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined)!;
    const deployed = await StatefulContract.deploy(evm, [], {
      provider, fundingUtxo, funder: alice!.unlockP2PKH(), changeAddress: alice!.getAddress(), initialState: {},
      identity: { kind: 'governed' }, bcmr: { name: 'Open', timestamp: T0 },
    });
    const category = deployed.categoryId;
    const guard = governedGuardFor(evm, category, addressToLockScript(getEventNftAddress(
      deployed.contract.inner, category, governedEvent(evm).event.signature,
    )));
    expect(binToHex(deployed.tx.outputs[0]!.lockingBytecode)).toBe(binToHex(governedGuardLockingBytecode(guard)));

    const next = withSnapshot(deployed.registry!.registry, category, { name: 'Open v2' }, T1);
    const encoded = await encodeRegistry(next);
    const authorization = governedAuthorization(encoded.sha256, deployed.identity!.txid);
    const asAlice = deployed.contract.connect(alice!) as unknown as Governed;
    const authorized = authorizationOf(
      await asAlice.updateMetadata(authorization.registryHash, authorization.identityTxid).send(),
    );
    // Two 32-byte words, where the native notation pushes each.
    expect(authorized.token!.nft!.commitment)
      .toBe(binToHex(authorization.registryHash) + binToHex(authorization.identityTxid));
    await provider.mine(EVENT_MATURITY_BLOCKS + 1);
    const applied = await applyGovernedMetadata({
      provider, artifact: evm, guard,
      identity: { txid: deployed.identity!.txid, vout: 0, satoshis: deployed.identity!.satoshis },
      authorization: authorized, registry: next,
      feeFunding: { utxo: await feeCoin(alice!), unlocker: alice!.unlockP2PKH() }, changeAddress: alice!.getAddress(),
    });
    expect(binToHex(applied.tx.outputs[1]!.lockingBytecode.slice(7, 39))).toBe(binToHex(encoded.sha256));
  });

  it('keys a framed deployment\'s guard to the lock its framed MetadataUpdated events take', async () => {
    const framed = compileString(FRAMED_OPEN, { composition: 'framed', suppressWarnings: true, files: GOVERNED_FILES });
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const alice = new SignatureTemplate(alicePriv);
    const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
    await fundShippedFacets(provider);
    const coin = async (txid: string, satoshis: bigint): Promise<Utxo> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis };
      await provider.addUtxo(binToHex(aliceLock), utxo);
      return utxo;
    };
    const deployed = await deployStatefulContract(framed, [], {
      provider, fundingUtxo: await coin('f1', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      identity: { kind: 'governed' }, bcmr: { name: 'Framed', timestamp: T0 },
    });
    const category = deployed.categoryId;
    const guard = governedGuardFor(framed, category, framedEventLockingBytecode(category, governedEvent(framed).event));
    expect(binToHex(deployed.tx.outputs[0]!.lockingBytecode)).toBe(binToHex(governedGuardLockingBytecode(guard)));

    const next = withSnapshot(deployed.registry!.registry, category, { name: 'Framed v2' }, T1);
    const encoded = await encodeRegistry(next);
    const authorization = governedAuthorization(encoded.sha256, deployed.identity!.txid);
    const call = await callFramedEntry({
      provider, artifact: framed, categoryId: category, functionName: 'updateMetadata',
      args: [authorization.registryHash, authorization.identityTxid], callerUtxo: await coin('c1', 500_000n),
      callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(), vm,
    });
    expect(call.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    const broadcast = call.broadcast!;
    const authorized = authorizationOf(broadcast, category);
    // The framed program emits the event NFT at the lock the guard is keyed to.
    expect(binToHex(broadcast.outputs[authorized.vout]!.lockingBytecode)).toBe(binToHex(guard.eventLockingBytecode));

    // Each send mines a block of its own, which `mine` does not count.
    await provider.mine(EVENT_MATURITY_BLOCKS + 10);
    const applied = await applyGovernedMetadata({
      provider, artifact: framed, guard,
      identity: { txid: deployed.identity!.txid, vout: 0, satoshis: deployed.identity!.satoshis },
      authorization: authorized, registry: next,
      feeFunding: { utxo: await coin('fe', 100_000n), unlocker: alice.unlockP2PKH() }, changeAddress: aliceAddress,
    });
    expect(binToHex(applied.tx.outputs[1]!.lockingBytecode.slice(7, 39))).toBe(binToHex(encoded.sha256));
  });
});
