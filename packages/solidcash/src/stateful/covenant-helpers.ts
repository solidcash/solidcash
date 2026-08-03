import {
  hexToBin, isHex, cashAddressToLockingBytecode, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import {
  AbiFunction,
  AbiInput,
  Artifact,
  buildCovenantArtifact,
  buildDataNftCovenantScript,
  buildTokenContainerCovenantScript,
  buildSatoshiContainerCovenantScript,
  buildEntryNftCovenantScript,
  buildValueChunkCovenantScript,
  buildEventNftCovenantScript,
  buildAnonymousEventNftCovenantScript,
  computeCollectionHash,
  computeEventNameHash,
  dynamicChunkSignature,
  valueChunkSignature,
  Script,
  scriptToBytecode,
  buildMessageBusVerifierCovenantScript,
} from '@solidcash/utils';
import { encodeFunctionArgument, FunctionArgument } from '../Argument.js';
import { AddressType, ContractUnlocker, Utxo } from '../interfaces.js';
import { Contract } from '../Contract.js';
import type NetworkProvider from '../network/NetworkProvider.js';
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

function categoryOf(utxos: Utxo[], where: string): string {
  const tokenUtxo = utxos.find((u) => u.token?.category);
  if (!tokenUtxo) {
    throw new Error(`No token UTXO at ${where} - cannot resolve the contract category (is it deployed?).`);
  }
  return tokenUtxo.token!.category;
}

/**
 * Resolve a stateful contract's token category straight from the indexer: the UTXOs at its address carry
 * `token: { category }`, so a deployed instance's category needs no SDK-side registry (see
 * docs/multi-contract-artifacts.md s13). Throws if there is no token UTXO (not deployed / fully spent).
 */
// Category resolution is token-seeking: query the token-aware form of the address so providers that gate token
// UTXOs on address token-awareness (e.g. BCHN listunspent) still return them. No-op for hex / non-cashaddr.
function toTokenAwareAddress(address: string): string {
  if (isHex(address)) return address;
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') return address;
  const prefix = (address.includes(':') ? address.split(':')[0] : 'bitcoincash') as 'bitcoincash' | 'bchtest' | 'bchreg';
  const encoded = lockingBytecodeToCashAddress({ bytecode: decoded.bytecode, prefix, tokenSupport: true });
  return typeof encoded === 'string' ? address : encoded.address;
}

export async function resolveCategoryFromAddress(provider: NetworkProvider, address: string): Promise<string> {
  return categoryOf(await provider.getUtxos(toTokenAwareAddress(address)), `address ${address}`);
}

/** As resolveCategoryFromAddress, but keyed by locking bytecode (e.g. a co-spend target's baked address arg). */
export async function resolveCategoryFromLockingBytecode(
  provider: NetworkProvider, lockingBytecode: Uint8Array,
): Promise<string> {
  return categoryOf(await provider.getUtxosForLockingBytecode(lockingBytecode), 'the given locking bytecode');
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

  // Covenant args are always plain values (never SignatureTemplates), so the cast is safe. Thread the struct
  // defs so struct-typed covenant args encode as their value-copy blob (same as the direct call path).
  const structs = contract.artifact.structs ?? contract.artifact.stateLayout?.structs;
  const encodedArgs = args.map(
    (arg, i) => encodeFunctionArgument(arg, abiInputs[i].type, structs),
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

export function getMessageBusVerifierAddress(contract: Contract<any, any>, categoryId: string): string {
  validateCategoryId(categoryId);
  const program = contract.artifact.messageBus?.verifierProgram;
  if (!program) throw new Error(`Contract '${contract.artifact.contractName}' publishes no message bus verifier program`);
  return scriptToAddress(
    buildMessageBusVerifierCovenantScript(program),
    contract.provider.network,
    'p2sh32',
    true,
  );
}

export function getMessageBusVerifierLockingBytecode(
  contract: Contract<any, any>, categoryId: string, _addressType: AddressType = 'p2sh32',
): Uint8Array {
  validateCategoryId(categoryId);
  const program = contract.artifact.messageBus?.verifierProgram;
  if (!program) throw new Error(`Contract '${contract.artifact.contractName}' publishes no message bus verifier program`);
  return scriptToLockingBytecode(buildMessageBusVerifierCovenantScript(program), 'p2sh32');
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

// Locking-bytecode (bytes) forms of the sub-NFT addresses, used as address-model handles
// baked into a reader's constructor args (the read covenant checks OP_UTXOBYTECODE == this value).
export function getDataNftLockingBytecode(categoryId: string): Uint8Array {
  validateCategoryId(categoryId);
  return scriptToLockingBytecode(buildDataNftCovenantScript(hexToBin(categoryId)), 'p2sh32');
}

export function getEntryNftLockingBytecode(
  contract: Contract<any, any>, categoryId: string, collectionNameOrSignature: string,
): Uint8Array {
  validateCategoryId(categoryId);
  const collectionSignature = resolveCollectionSignature(contract.artifact, collectionNameOrSignature);
  const collectionHash = computeCollectionHash(collectionSignature);
  return scriptToLockingBytecode(buildEntryNftCovenantScript(hexToBin(categoryId), collectionHash), 'p2sh32');
}

// Chunk-collection address for a dynamic-storage var (string / unbounded bytes). Chunks are entry NFTs
// keyed by the var's chunk signature "<name>:<type>". See dynamic-storage.md.
export function getDynamicChunkAddress(
  contract: Contract<any, any>, categoryId: string, varName: string, varType: string,
): string {
  validateCategoryId(categoryId);
  const collectionHash = computeCollectionHash(dynamicChunkSignature(varName, varType));
  const covenantScript = buildEntryNftCovenantScript(hexToBin(categoryId), collectionHash);
  return scriptToAddress(covenantScript, contract.provider.network, contract.addressType, true);
}

// Root-addressed value-chunk covenant. The address commits to collection, slot, and value root, so chunk
// commitments carry only uint16 index || raw data.
export function getValueChunkAddress(
  contract: Contract<any, any>, categoryId: string, collection: string, slot: Uint8Array, root: Uint8Array,
): string {
  validateCategoryId(categoryId);
  const collectionHash = computeCollectionHash(valueChunkSignature(collection));
  const covenantScript = buildValueChunkCovenantScript(hexToBin(categoryId), collectionHash, slot, root);
  return scriptToAddress(covenantScript, contract.provider.network, contract.addressType, true);
}

export function getValueChunkLockingBytecode(
  contract: Contract<any, any>, categoryId: string, collection: string, slot: Uint8Array, root: Uint8Array,
): Uint8Array {
  validateCategoryId(categoryId);
  const collectionHash = computeCollectionHash(valueChunkSignature(collection));
  return scriptToLockingBytecode(buildValueChunkCovenantScript(hexToBin(categoryId), collectionHash, slot, root), 'p2sh32');
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

  // Dynamic-storage vars (string / unbounded bytes) keep their data in chunk UTXOs at a per-var address.
  const dynamicVars = (contract.artifact.stateLayout.variables ?? [])
    .filter((v: { dynamic?: boolean }) => v.dynamic);
  const dynamicChunkAddresses: Record<string, string> = {};
  for (const v of dynamicVars) {
    dynamicChunkAddresses[v.name] = getDynamicChunkAddress(contract, categoryId, v.name, v.type);
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
  // Always fetch dynamic-var chunk addresses so the reader can assemble their values.
  for (const addr of Object.values(dynamicChunkAddresses)) {
    if (!allAddresses.includes(addr)) allAddresses.push(addr);
  }

  const reader = new StateReader(contract.artifact.stateLayout);
  return reader.readStateFromChain(
    contract.provider, categoryId, allAddresses, dataNftOnlyAddresses, dynamicChunkAddresses,
  );
}

// ---------------------------------------------------------------------------
// Covenant unlocker factories
// ---------------------------------------------------------------------------

export function createMessageBusVerifierUnlocker(
  contract: Contract<any, any>, categoryId: string, messageEnvelope: Uint8Array, verifierArgs: FunctionArgument[],
): ContractUnlocker {
  validateCategoryId(categoryId);
  const program = contract.artifact.messageBus?.verifierProgram;
  if (!program) throw new Error(`Contract '${contract.artifact.contractName}' publishes no message bus verifier program`);
  if (verifierArgs.length !== program.inputs.length) {
    throw new Error(`message bus verifier expects ${program.inputs.length} arguments, got ${verifierArgs.length}`);
  }
  return createCovenantContractUnlocker(
    contract,
    `MessageBusVerifier_${categoryId.slice(0, 8)}`,
    buildMessageBusVerifierCovenantScript(program),
    [{ name: '__internal__densityReserve', type: 'bytes' }, ...program.inputs, { name: 'messageEnvelope', type: 'bytes' }],
    [new Uint8Array(2048), ...verifierArgs, messageEnvelope],
    'p2sh32',
  );
}

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
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
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
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
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
    [{ name: 'flag', type: 'bigint' }, { name: 'index', type: 'bigint' }],
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
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
    [1n, BigInt(masterInputIndex)],
  );
}

// Unlocker for spending (destroying) a dynamic-storage chunk NFT. Chunks reuse the entry NFT covenant;
// flag=1 authorizes the spend by co-spending the master at masterInputIndex.
export function createDynamicChunkUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string, varName: string, varType: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  const collectionHash = computeCollectionHash(dynamicChunkSignature(varName, varType));
  const covenantScript = buildEntryNftCovenantScript(hexToBin(categoryId), collectionHash);
  return createCovenantContractUnlocker(
    contract,
    `ChunkNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
    [1n, BigInt(masterInputIndex)],
  );
}

// Unlocker for spending (destroying) a P5b value-chunk NFT: flag=1 authorizes the spend by co-spending the
// master. Used to GC the OLD chunks of a long sorted-mapping value when it is overwritten (the value chunks
// reuse the entry NFT covenant, keyed by the collection's value-chunk signature).
export function createValueChunkUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string, collection: string,
  slot: Uint8Array, root: Uint8Array,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  const collectionHash = computeCollectionHash(valueChunkSignature(collection));
  const covenantScript = buildValueChunkCovenantScript(hexToBin(categoryId), collectionHash, slot, root);
  return createCovenantContractUnlocker(
    contract,
    `ValueChunkNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
    [1n, BigInt(masterInputIndex)],
  );
}

// Read-only unlocker for a dynamic-storage chunk NFT: flag=0 (preserve, output==input) so an on-chain
// read can co-spend the var's chunks without destroying them. The entry covenant enforces preservation.
export function createReadOnlyDynamicChunkUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string, varName: string, varType: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  const collectionHash = computeCollectionHash(dynamicChunkSignature(varName, varType));
  const covenantScript = buildEntryNftCovenantScript(hexToBin(categoryId), collectionHash);
  return createCovenantContractUnlocker(
    contract,
    `ChunkNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
    [0n, BigInt(masterInputIndex)],
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
    [{ name: 'flag', type: 'bigint' }, { name: 'index', type: 'bigint' }],
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
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
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
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
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
