/**
 * Contract-governed metadata (docs/bcmr/DESIGN.md, section 9): the identity output's guard publishes only a registry
 * the contract authorized through its own access control, once the authorizing event has matured.
 */
import { binToHex } from '@bitauth/libauth';
import { compileFile } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  EVENT_MATURITY_BLOCKS, applyGovernedMetadata, encodeRegistry, governedAuthorization, governedEvent,
  governedGuardFor, governedGuardLockingBytecode, withSnapshot,
} from '../../src/bcmr/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type Signer from '../../src/Signer.js';
import { getEventNftAddress } from '../../src/stateful/covenant-helpers.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';

const SOURCE = new URL('../fixture/bcmr_governed_counter.scash', import.meta.url);
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

/** The MetadataUpdated event NFT a call minted, as a UTXO. */
function authorizationOf(call: { txid: string; outputs: CallOutput[] }): Utxo {
  const vout = call.outputs.findIndex((output) => output.token?.nft?.capability === 'none');
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
});
