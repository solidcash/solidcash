import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { type Artifact } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster, satoshiContainerLockingBytecode } from '../../../src/framed/deploy/index.js';
import { type FramedCallResult, type sendFramedValue } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/** The deployment and the caller's coin the value cases (`value-call`, `paid-body-call`) drive a call from. */

const CATEGORY_HEX = '35'.repeat(31) + 'ca';
const CALLER_TXID = '46'.repeat(32);

export interface Deployed {
  readonly artifact: Artifact;
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/** Deploys the contract through the shipped deployment and funds the caller's own coin at its P2PKH lock. */
export async function deploy(artifact: Artifact): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  const deployment = await deployStatefulContract(artifact, [], {
    provider,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, signature),
    changeAddress: funder.address,
  });
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 200_000n };
  await provider.addUtxo(binToHex(callerLock), callerUtxo);
  // The calls broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(provider);
  return {
    artifact, provider, categoryId: deployment.categoryId, callerUtxo, callerLock, funder: signature.unlockP2PKH(),
  };
}

/** The call's options, less the entry and the value. */
export function callerOf(deployed: Deployed): Parameters<typeof sendFramedValue>[0] {
  return {
    provider: deployed.provider,
    artifact: deployed.artifact,
    categoryId: deployed.categoryId,
    callerUtxo: deployed.callerUtxo,
    callerLockingBytecode: deployed.callerLock,
    funder: deployed.funder,
    vm: compositionMachine(),
    value: 0n,
  };
}

/** The caller's options with its current coin: the largest tokenless UTXO at its lock, the last call's change. */
export async function currentCaller(deployed: Deployed): Promise<Parameters<typeof sendFramedValue>[0]> {
  const coins = (await deployed.provider.getUtxosForLockingBytecode(deployed.callerLock))
    .filter((utxo) => utxo.token === undefined)
    .sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1));
  return { ...callerOf(deployed), callerUtxo: coins[0]! };
}

/** The value the broadcast pays into the contract's containers. */
export function containerValue(result: FramedCallResult, categoryId: string): bigint {
  const lock = binToHex(satoshiContainerLockingBytecode(categoryId));
  return (result.broadcast?.outputs ?? [])
    .filter((output) => binToHex(output.lockingBytecode) === lock)
    .reduce((sum, output) => sum + output.valueSatoshis, 0n);
}

/** Deploys a second contract on a deployment's provider, funded from the same wallet. */
export async function deployBeside(deployed: Deployed, artifact: Artifact, fundingTxid: string): Promise<string> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: deployed.provider });
  const fundingUtxo = { txid: fundingTxid, vout: 0, satoshis: 500_000n };
  await deployed.provider.addUtxo(funder.address, fundingUtxo);
  const deployment = await deployStatefulContract(artifact, [], {
    provider: deployed.provider,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, signature),
    changeAddress: funder.address,
  });
  return deployment.categoryId;
}

/** Deploys a contract with constructor arguments on a deployment's provider, funded from the same wallet. */
export async function deployBesideWith(
  deployed: Deployed, artifact: Artifact, args: readonly Uint8Array[], fundingTxid: string,
): Promise<string> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: deployed.provider });
  const fundingUtxo = { txid: fundingTxid, vout: 0, satoshis: 500_000n };
  await deployed.provider.addUtxo(funder.address, fundingUtxo);
  const deployment = await deployStatefulContract(artifact, [...args], {
    provider: deployed.provider,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, signature),
    changeAddress: funder.address,
  });
  return deployment.categoryId;
}

/** A contract's address: the validator address its category derives. */
export function addressOf(artifact: Artifact, categoryId: string): Uint8Array {
  return deployMaster(artifact, hexToBin(categoryId), framedValidator.buildValidatorProgram()).address;
}
