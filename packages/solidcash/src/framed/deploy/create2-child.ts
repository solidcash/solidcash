/**
 * Standing up a framed CREATE2 child before the transaction that creates it.
 *
 * A framed master's `new C{salt: s}()` evaluates to the child's EVM identity, and the creating body calls the child
 * there (`initialize`), as may any later body that computes the same identity (`pairFor`). Every frame of the child
 * runs on a master of its own, so the transaction that creates it cannot also be the one that mints those masters:
 * the child is deployed first, with the creator as the sender its constructor sees and the identity as the address
 * it presents (`registerFramedCreate2Identity`), and is registered under that identity so a call reaching it finds it.
 *
 * The creator does not yet verify the child it calls is the one its own creation names: that binding, a creation
 * frame the creator checks, is the open part of spec point 14. Until then the child is whatever this module deploys.
 */

import { lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Artifact, FunctionSplitBundle } from '@solidcash/utils';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type Signer from '../../Signer.js';
import { randomUtxo, getNetworkPrefix } from '../../utils.js';
import { registerDeployment, findDeploymentByAddress } from '../../stateful/deployment-registry.js';
import { markCreate2ChildIdentity } from '../../create2-identity-registry.js';
import { registerFramedCreate2Identity } from './material.js';
import { deployFramedStatefulContract, FramedDeployError } from './stateful.js';

/** What a creating body asks for when it calls a CREATE2 child that is not deployed yet. */
export interface FramedCreate2ChildRequest {
  readonly provider: NetworkProvider;
  /** The creator's artifact, which publishes the children it creates (`composition.creates`). */
  readonly creatorArtifact: Artifact;
  /** The creator's own address, which the child's constructor reads as `msg.sender`. */
  readonly creatorSelf: Uint8Array;
  /** The child's EVM identity: the address the creating body computed and calls. */
  readonly identity: Uint8Array;
  /** The child contract the creator's creation names. */
  readonly contractName: string;
}

/** Deploys the child a request names; installed on the provider by whoever holds artifacts and a funded signer. */
export type FramedCreate2ChildDeployer = (request: FramedCreate2ChildRequest) => Promise<void>;

const DEPLOYER = Symbol.for('@solidcash/framed-create2-child-deployer');

const TEMPLATES = Symbol.for('@solidcash/framed-create2-templates');

/** The CREATE2 templates registered on `provider`: the contract each code hash stands up, by hex hash. */
function templatesOf(provider: NetworkProvider): Map<string, string> {
  const holder = provider as unknown as Record<symbol, Map<string, string> | undefined>;
  if (holder[TEMPLATES] === undefined) {
    Object.defineProperty(provider, TEMPLATES, {
      value: new Map<string, string>(), writable: false, enumerable: false, configurable: true,
    });
  }
  return holder[TEMPLATES]!;
}

/**
 * Names the contract a CREATE2 over a code value stands up, by the value's keccak256.
 *
 * An EVM factory may create its children from code it holds rather than from a contract it names (a test factory
 * given a pair's EVM bytecode): the child's identity commits to that code's hash, and the code itself is no program
 * a BCH master runs, so the contract its frames run is the one this table names for the hash.
 */
export function registerFramedCreate2Template(
  provider: NetworkProvider, codeHash: Uint8Array, contractName: string,
): void {
  templatesOf(provider).set(binToHex(codeHash), contractName);
}

/** The contract a CREATE2 over code with this keccak256 stands up on `provider`, if one is registered. */
export function framedCreate2TemplateOf(provider: NetworkProvider, codeHash: Uint8Array): string | undefined {
  return templatesOf(provider).get(binToHex(codeHash));
}

/** Installs the deployer the call planner asks to stand up a CREATE2 child on `provider`. */
export function setFramedCreate2ChildDeployer(provider: NetworkProvider, deployer: FramedCreate2ChildDeployer): void {
  Object.defineProperty(provider, DEPLOYER, {
    value: deployer, writable: true, enumerable: false, configurable: true,
  });
}

/** The deployer installed on `provider`, if any. */
export function framedCreate2ChildDeployerOf(provider: NetworkProvider): FramedCreate2ChildDeployer | undefined {
  return (provider as unknown as Record<symbol, FramedCreate2ChildDeployer | undefined>)[DEPLOYER];
}

/** The P2SH20 locking bytecode whose hash is `identity`, which is how a CREATE2 child's address is written. */
export function create2ChildLockingBytecode(identity: Uint8Array): Uint8Array {
  return Uint8Array.from([0xa9, 0x14, ...identity, 0x87]);
}

/**
 * Deploys `artifact` as the CREATE2 child at `identity`: its constructor runs with `creatorSelf` as the sender, it
 * presents `identity` as its address, and it is registered under the P2SH20 address that names the identity.
 *
 * The genesis needs a coin at output 0 of its own transaction, whose txid becomes the child's category; on a provider
 * that can mint one (the mock), one is minted to the signer.
 */
export async function standUpFramedCreate2Child(options: {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly creatorSelf: Uint8Array;
  readonly identity: Uint8Array;
  readonly signer: Signer;
  /** The per-entry bundle the child is deployed from, when its contract is published as one. */
  readonly functionSplit?: FunctionSplitBundle;
}): Promise<void> {
  const { provider, artifact, creatorSelf, identity, signer } = options;
  const lock = create2ChildLockingBytecode(identity);
  const encoded = lockingBytecodeToCashAddress({
    bytecode: lock, prefix: getNetworkPrefix(provider.network), tokenSupport: true,
  });
  if (typeof encoded === 'string') throw new FramedDeployError(`a CREATE2 identity is not encodable: ${encoded}`);
  if (findDeploymentByAddress(provider, encoded.address) !== undefined) return;
  const mint = (provider as { addUtxo?: (address: string, utxo: ReturnType<typeof randomUtxo>) => Promise<unknown> })
    .addUtxo;
  if (mint === undefined) {
    throw new FramedDeployError(
      `the CREATE2 child "${artifact.contractName}" at ${binToHex(identity)} is not deployed, and this provider `
      + 'cannot mint the coin its genesis spends',
    );
  }
  const fundingUtxo = randomUtxo({ satoshis: 50_000_000n, vout: 0 });
  await mint.call(provider, signer.getAddress(), fundingUtxo);
  registerFramedCreate2Identity(hexToBin(fundingUtxo.txid), identity);
  markCreate2ChildIdentity(identity);
  const deployed = await deployFramedStatefulContract(artifact, [], {
    provider,
    fundingUtxo,
    funder: signer.unlockP2PKH(),
    changeAddress: signer.getAddress(),
    senderLockingBytecode: creatorSelf,
    identity: { owner: signer.getAddress() },
    ...(options.functionSplit === undefined ? {} : { functionSplit: options.functionSplit }),
  });
  const contract = deployed.contract as unknown as { _framedAddress?: string; _signer?: Signer };
  contract._framedAddress = encoded.address;
  contract._signer = signer;
  // Registered under both spellings of its address: the P2SH20 CashAddress a caller names it by, and the identity
  // itself, which a call target carries.
  for (const address of [binToHex(identity), encoded.address]) {
    registerDeployment(provider, {
      contractName: artifact.contractName,
      address,
      lockingBytecode: binToHex(identity),
      contract: deployed.contract,
      category: deployed.categoryId,
    });
  }
}
