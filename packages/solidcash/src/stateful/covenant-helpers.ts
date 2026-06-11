import { hexToBin, isHex } from '@bitauth/libauth';
import {
  AbiFunction,
  AbiInput,
  Artifact,
  buildCovenantArtifact,
  buildDataNftCovenantScript,
  buildTokenContainerCovenantScript,
  buildSatoshiContainerCovenantScript,
  buildEntryNftCovenantScript,
  buildEventNftCovenantScript,
  buildAnonymousEventNftCovenantScript,
  computeCollectionHash,
  computeEventNameHash,
  Script,
  scriptToBytecode,
} from '@solidcash/utils';
import { encodeFunctionArgument, FunctionArgument } from '../Argument.js';
import { AddressType, ContractUnlocker } from '../interfaces.js';
import { Contract } from '../Contract.js';
import { createUnlockingBytecode, scriptToAddress, scriptToLockingBytecode } from '../utils.js';
import { StateReader, OnChainState } from './StateReader.js';

export function validateCategoryId(hex: string, paramName: string = 'categoryId'): void {
  if (!isHex(hex) || hex.length !== 64) {
    throw new Error(`Invalid ${paramName}: expected a 64-character hex string, got '${hex}'`);
  }
}

export function validateMasterInputIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid masterInputIndex: expected a non-negative integer, got ${index}`);
  }
}

/**
 * Create a ContractUnlocker for a covenant script, backed by a synthetic Artifact+Contract
 * so that debug() and bitauth IDE integration work for covenant inputs.
 */
export function createCovenantContractUnlocker(
  contract: Contract<any, any>,
  contractName: string,
  covenantScript: Script,
  abiInputs: AbiInput[],
  args: FunctionArgument[],
  addressType: AddressType = contract.addressType,
): ContractUnlocker {
  const abiFunction: AbiFunction = { name: 'spend', inputs: abiInputs };
  const artifact = buildCovenantArtifact(contractName, covenantScript, abiFunction);
  const covenantContract = new Contract(artifact, [], {
    provider: contract.provider,
    addressType,
  });

  // Covenant args are always plain values (never SignatureTemplates), so the cast is safe.
  const encodedArgs = args.map(
    (arg, i) => encodeFunctionArgument(arg, abiInputs[i].type),
  ) as Uint8Array[];
  const covenantBytecodeBytes = scriptToBytecode(covenantScript);

  // Note: args are passed in reverse stack order because createUnlockingBytecode reverses them.
  const generateUnlockingBytecode = (): Uint8Array => createUnlockingBytecode(
    addressType, covenantBytecodeBytes, encodedArgs,
  );
  const generateLockingBytecode = (): Uint8Array => scriptToLockingBytecode(covenantScript, addressType);

  return {
    generateUnlockingBytecode, generateLockingBytecode,
    contract: covenantContract, params: args, abiFunction,
    covenantUnlocker: true,
  };
}

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

export function getDataNftAddress(contract: Contract<any, any>, categoryId: string): string {
  validateCategoryId(categoryId);
  const covenantScript = buildDataNftCovenantScript(hexToBin(categoryId));
  return scriptToAddress(covenantScript, contract.provider.network, contract.addressType, true);
}

export function getEntryNftAddress(
  contract: Contract<any, any>, categoryId: string, collectionNameOrSignature: string,
): string {
  validateCategoryId(categoryId);
  const collectionSignature = resolveCollectionSignature(contract.artifact, collectionNameOrSignature);
  const collectionHash = computeCollectionHash(collectionSignature);
  const covenantScript = buildEntryNftCovenantScript(hexToBin(categoryId), collectionHash);
  return scriptToAddress(covenantScript, contract.provider.network, contract.addressType, true);
}

export function getEventNftAddress(
  contract: Contract<any, any>, categoryId: string, eventNameOrSignature: string,
): string {
  validateCategoryId(categoryId);
  const eventSignature = resolveEventSignature(contract.artifact, eventNameOrSignature);
  const eventNameHash = computeEventNameHash(eventSignature);
  const covenantScript = buildEventNftCovenantScript(hexToBin(categoryId), eventNameHash);
  return scriptToAddress(covenantScript, contract.provider.network, contract.addressType, true);
}

export function getAnonymousEventNftAddress(
  contract: Contract<any, any>, categoryId: string,
): string {
  validateCategoryId(categoryId);
  const covenantScript = buildAnonymousEventNftCovenantScript(hexToBin(categoryId));
  return scriptToAddress(covenantScript, contract.provider.network, contract.addressType, true);
}

export function getTokenContainerAddress(
  contract: Contract<any, any>, categoryId: string, tokenContainerCategoryId: string,
): string {
  validateCategoryId(categoryId);
  validateCategoryId(tokenContainerCategoryId, 'tokenContainerCategoryId');
  const covenantScript = buildTokenContainerCovenantScript(
    hexToBin(categoryId), hexToBin(tokenContainerCategoryId),
  );
  // Always use P2SH32 for token containers so the in-script derivation
  // (which uses OP_HASH256) produces matching locking bytecodes
  return scriptToAddress(covenantScript, contract.provider.network, 'p2sh32', true);
}

export function getSatoshiContainerAddress(contract: Contract<any, any>, categoryId: string): string {
  validateCategoryId(categoryId);
  const covenantScript = buildSatoshiContainerCovenantScript(hexToBin(categoryId));
  // Always use P2SH32 for satoshi containers so the in-script derivation
  // (which uses OP_HASH256) produces matching locking bytecodes
  return scriptToAddress(covenantScript, contract.provider.network, 'p2sh32', true);
}

// ---------------------------------------------------------------------------
// State reading
// ---------------------------------------------------------------------------

export async function getContractState(
  contract: Contract<any, any>, categoryId: string, dataNftAddresses?: string | string[],
): Promise<OnChainState> {
  validateCategoryId(categoryId);
  if (!contract.artifact.stateLayout) {
    throw new Error(`Contract ${contract.name} is not a stateful contract`);
  }

  let allAddresses: string[];
  let dataNftOnlyAddresses: string[] | undefined;
  if (dataNftAddresses !== undefined) {
    const addresses = Array.isArray(dataNftAddresses) ? dataNftAddresses : [dataNftAddresses];
    allAddresses = [contract.tokenAddress, ...addresses.filter((a) => a !== contract.tokenAddress)];
  } else {
    const dataNftAddr = getDataNftAddress(contract, categoryId);
    const entryNftAddresses = (contract.artifact.stateLayout?.collections ?? [])
      .map((c: { signature: string }) => getEntryNftAddress(contract, categoryId, c.signature));
    const uniqueAddresses = new Set([contract.tokenAddress, dataNftAddr, ...entryNftAddresses]);
    allAddresses = [...uniqueAddresses];
    // Pass data NFT addresses separately so StateReader can distinguish data NFTs from entry NFTs
    dataNftOnlyAddresses = [contract.tokenAddress, dataNftAddr];
  }

  const reader = new StateReader(contract.artifact.stateLayout);
  return reader.readStateFromChain(contract.provider, categoryId, allAddresses, dataNftOnlyAddresses);
}

// ---------------------------------------------------------------------------
// Covenant unlocker factories
// ---------------------------------------------------------------------------

export function createDataNftUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  const covenantScript = buildDataNftCovenantScript(hexToBin(categoryId));
  return createCovenantContractUnlocker(
    contract,
    `DataNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'int' }, { name: 'masterInputIndex', type: 'int' }],
    [1n, BigInt(masterInputIndex)],
  );
}

export function createDestroyDataNftUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  const covenantScript = buildDataNftCovenantScript(hexToBin(categoryId));
  return createCovenantContractUnlocker(
    contract,
    `DataNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'int' }, { name: 'masterInputIndex', type: 'int' }],
    [2n, BigInt(masterInputIndex)],
  );
}

export function createReadOnlyDataNftUnlocker(
  contract: Contract<any, any>, categoryId: string,
): ContractUnlocker {
  validateCategoryId(categoryId);
  const covenantScript = buildDataNftCovenantScript(hexToBin(categoryId));
  return createCovenantContractUnlocker(
    contract,
    `DataNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'int' }, { name: 'index', type: 'int' }],
    [0n, 0n],
  );
}

export function createEntryNftUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string, collectionNameOrSignature: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  const collectionSignature = resolveCollectionSignature(contract.artifact, collectionNameOrSignature);
  const collectionHash = computeCollectionHash(collectionSignature);
  const covenantScript = buildEntryNftCovenantScript(hexToBin(categoryId), collectionHash);
  return createCovenantContractUnlocker(
    contract,
    `EntryNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'int' }, { name: 'masterInputIndex', type: 'int' }],
    [1n, BigInt(masterInputIndex)],
  );
}

export function createReadOnlyEntryNftUnlocker(
  contract: Contract<any, any>, categoryId: string, collectionNameOrSignature: string,
): ContractUnlocker {
  validateCategoryId(categoryId);
  const collectionSignature = resolveCollectionSignature(contract.artifact, collectionNameOrSignature);
  const collectionHash = computeCollectionHash(collectionSignature);
  const covenantScript = buildEntryNftCovenantScript(hexToBin(categoryId), collectionHash);
  return createCovenantContractUnlocker(
    contract,
    `EntryNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'int' }, { name: 'index', type: 'int' }],
    [0n, 0n],
  );
}

export function createEventNftUnlocker(
  contract: Contract<any, any>, categoryId: string, eventNameOrSignature: string,
): ContractUnlocker {
  validateCategoryId(categoryId);
  const eventSignature = resolveEventSignature(contract.artifact, eventNameOrSignature);
  const eventNameHash = computeEventNameHash(eventSignature);
  const covenantScript = buildEventNftCovenantScript(hexToBin(categoryId), eventNameHash);
  return createCovenantContractUnlocker(
    contract,
    `EventNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [],
    [],
  );
}

export function createAnonymousEventNftUnlocker(
  contract: Contract<any, any>, categoryId: string,
): ContractUnlocker {
  validateCategoryId(categoryId);
  const covenantScript = buildAnonymousEventNftCovenantScript(hexToBin(categoryId));
  return createCovenantContractUnlocker(
    contract,
    `AnonEventNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [],
    [],
  );
}

export function createTokenContainerUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string, tokenContainerCategoryId: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  validateCategoryId(tokenContainerCategoryId, 'tokenContainerCategoryId');
  const covenantScript = buildTokenContainerCovenantScript(
    hexToBin(categoryId), hexToBin(tokenContainerCategoryId),
  );
  // Always use P2SH32 for token containers (matches in-script OP_HASH256 derivation)
  return createCovenantContractUnlocker(
    contract,
    `TokenContainer_${categoryId.slice(0, 8)}_${tokenContainerCategoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'int' }, { name: 'masterInputIndex', type: 'int' }],
    [1n, BigInt(masterInputIndex)],
    'p2sh32',
  );
}

export function createSatoshiContainerUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  const covenantScript = buildSatoshiContainerCovenantScript(hexToBin(categoryId));
  // Always use P2SH32 for satoshi containers (matches in-script OP_HASH256 derivation)
  return createCovenantContractUnlocker(
    contract,
    `SatoshiContainer_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'int' }, { name: 'masterInputIndex', type: 'int' }],
    [1n, BigInt(masterInputIndex)],
    'p2sh32',
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function resolveCollectionSignature(artifact: Artifact, collectionNameOrSignature: string): string {
  if (collectionNameOrSignature.includes(':')) return collectionNameOrSignature;
  const colls = artifact.stateLayout?.collections?.filter((c) => c.name === collectionNameOrSignature);
  if (!colls || colls.length === 0) throw new Error(`Unknown collection: ${collectionNameOrSignature}`);
  if (colls.length > 1) throw new Error(`Ambiguous collection name '${collectionNameOrSignature}'`);
  return colls[0].signature;
}

export function resolveEventSignature(artifact: Artifact, eventNameOrSignature: string): string {
  if (eventNameOrSignature.includes('(')) {
    const match = artifact.events?.find((e) => e.signature === eventNameOrSignature);
    if (!match) throw new Error(`Unknown event signature: ${eventNameOrSignature}`);
    return match.signature;
  }
  const matches = artifact.events?.filter((e) => e.name === eventNameOrSignature);
  if (!matches || matches.length === 0) throw new Error(`Unknown event: ${eventNameOrSignature}`);
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous event name '${eventNameOrSignature}', use full signature: ${matches.map((m) => m.signature).join(', ')}`,
    );
  }
  return matches[0].signature;
}
