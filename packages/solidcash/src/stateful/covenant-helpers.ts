import { cashAddressToLockingBytecode, lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin, isHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  type AbiFunction,
  type AbiInput,
  type Artifact,
  type StateLayout,
  type EventDefinitionAbi,
  buildCovenantArtifact,
  buildDataNftCovenantScript,
  buildTokenContainerCovenantScript,
  buildSatoshiContainerCovenantScript,
  containerKeepsTokenless,
  containerMasterRetires,
  buildEntryNftCovenantScript,
  buildValueChunkCovenantScript,
  buildEventNftCovenantScript,
  buildAnonymousEventNftCovenantScript,
  computeCollectionHash,
  computeEventContinuationHash,
  computeEventNameHash,
  dynamicChunkSignature,
  valueChunkSignature,
  type Script,
  scriptToBytecode,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import type { AddressType, ContractUnlocker, Utxo } from '../interfaces.js';
import { Contract } from '../Contract.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { createUnlockingBytecode, scriptToAddress, scriptToLockingBytecode } from '../utils.js';
import { StateReader, type OnChainState } from './StateReader.js';

interface CachedCovenantContract {
  contract: Contract<any, any>;
  bytecode: Uint8Array;
  lockingBytecode: Uint8Array;
}

// Stateful transaction derivation recreates relocated data/entry unlockers on every probe. Their numeric
// witnesses vary, but the synthetic artifact, covenant bytecode, and locking bytecode do not. Retain one copy
// per provider so debug metadata remains provider-correct without repeatedly disassembling the same script.
const covenantContractCache = new WeakMap<NetworkProvider, Map<string, CachedCovenantContract>>();

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
export function toTokenAwareAddress(address: string): string {
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
  const covenantBytecodeBytes = scriptToBytecode(covenantScript);
  const cacheKey = `${addressType}\u0000${contractName}\u0000${abiInputs
    .map((input) => `${input.name}:${input.type}`).join(',')}\u0000${binToHex(covenantBytecodeBytes)}`;
  let providerCache = covenantContractCache.get(contract.provider);
  if (!providerCache) {
    providerCache = new Map();
    covenantContractCache.set(contract.provider, providerCache);
  }
  let cached = providerCache.get(cacheKey);
  if (!cached) {
    const artifact = buildCovenantArtifact(contractName, covenantScript, abiFunction);
    cached = {
      contract: new Contract(artifact, [], { provider: contract.provider, addressType }),
      bytecode: covenantBytecodeBytes,
      lockingBytecode: scriptToLockingBytecode(covenantScript, addressType),
    };
    providerCache.set(cacheKey, cached);
  }

  // Covenant args are always plain values (never SignatureTemplates), so the cast is safe. Thread the struct
  // defs so struct-typed covenant args encode as their value-copy blob (same as the direct call path).
  const structs = contract.artifact.structs ?? contract.artifact.stateLayout?.structs;
  const encodedArgs = args.map(
    (arg, i) => encodeFunctionArgument(arg, abiInputs[i].type, structs),
  ) as Uint8Array[];
  // Note: args are passed in reverse stack order because createUnlockingBytecode reverses them.
  const generateUnlockingBytecode = (): Uint8Array => createUnlockingBytecode(
    addressType, cached.bytecode, encodedArgs,
  );
  const generateLockingBytecode = (): Uint8Array => cached.lockingBytecode;

  return {
    generateUnlockingBytecode, generateLockingBytecode,
    contract: cached.contract, params: args, abiFunction,
    covenantUnlocker: true,
  };
}

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

function contractMasterLock(contract: Contract<any, any>): Uint8Array | undefined {
  const encoded = contract.lockingBytecode;
  if (!isHex(encoded)) return undefined;
  const lock = hexToBin(encoded);
  return lock.length === 35 ? lock : undefined;
}

/** P2SH32 master lock for a direct contract. A framed artifact keeps the category-only covenant. */
export function directConventionMasterLock(contract: Contract<any, any>): Uint8Array | undefined {
  if (contract.artifact.composition?.convention === 'framed') return undefined;
  return contractMasterLock(contract);
}

/**
 * A direct contract's bound container covenants of `kind` carry the destroy arm when its master can retire, and the
 * tokenless pin under that kind's pragma: `pragma satoshicontainer single` or `pragma tokencontainer single`.
 */
export function directContainerOptions(
  contract: Contract<any, any>, kind: 'satoshiContainer' | 'tokenContainer',
): { masterRetires: boolean; keepsTokenless: boolean } {
  // An artifact without an ABI states neither, so its containers take the plain pin.
  const abi = contract.artifact?.abi ?? [];
  return { masterRetires: containerMasterRetires(abi), keepsTokenless: containerKeepsTokenless(abi, kind) };
}

export function getDataNftAddress(contract: Contract<any, any>, categoryId: string): string {
  validateCategoryId(categoryId);
  const covenantScript = buildDataNftCovenantScript(hexToBin(categoryId), directConventionMasterLock(contract));
  return scriptToAddress(covenantScript, contract.provider.network, contract.addressType, true);
}

export function getEntryNftAddress(
  contract: Contract<any, any>, categoryId: string, collectionNameOrSignature: string,
): string {
  validateCategoryId(categoryId);
  const collectionSignature = resolveCollectionSignature(contract.artifact, collectionNameOrSignature);
  const collectionHash = computeCollectionHash(collectionSignature);
  const covenantScript = buildEntryNftCovenantScript(
    hexToBin(categoryId), collectionHash, directConventionMasterLock(contract),
  );
  const entryAddress = scriptToAddress(covenantScript, contract.provider.network, contract.addressType, true);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ENTRY_ADDR === '1') {
    console.error('entry-addr', JSON.stringify({
      contract: contract.artifact?.contractName ?? '?',
      collection: collectionNameOrSignature,
      categoryId: categoryId.slice(0, 12),
      lockingBytecode: binToHex(scriptToLockingBytecode(covenantScript, 'p2sh32')),
      address: entryAddress,
    }));
  }
  return entryAddress;
}

// Locking-bytecode (bytes) forms of the sub-NFT addresses, used as address-model handles
// baked into a reader's constructor args (the read covenant checks OP_UTXOBYTECODE == this value).
export function getDataNftLockingBytecode(categoryId: string, masterLock?: Uint8Array): Uint8Array {
  validateCategoryId(categoryId);
  const lockingBytecode = scriptToLockingBytecode(
    buildDataNftCovenantScript(hexToBin(categoryId), masterLock), 'p2sh32',
  );
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ENTRY_ADDR === '1') {
    console.error('data-nft-addr', JSON.stringify({
      categoryId: categoryId.slice(0, 12),
      lockingBytecode: binToHex(lockingBytecode),
    }));
  }
  return lockingBytecode;
}

export function getEntryNftLockingBytecode(
  contract: Contract<any, any>, categoryId: string, collectionNameOrSignature: string,
): Uint8Array {
  validateCategoryId(categoryId);
  const collectionSignature = resolveCollectionSignature(contract.artifact, collectionNameOrSignature);
  const collectionHash = computeCollectionHash(collectionSignature);
  return scriptToLockingBytecode(buildEntryNftCovenantScript(
    hexToBin(categoryId), collectionHash, directConventionMasterLock(contract),
  ), 'p2sh32');
}

// Chunk-collection address for a dynamic-storage var (string / unbounded bytes). Chunks are entry NFTs
// keyed by the var's chunk signature "<name>:<type>". See dynamic-storage.md.
export function getDynamicChunkAddress(
  contract: Contract<any, any>, categoryId: string, varName: string, varType: string,
): string {
  validateCategoryId(categoryId);
  const collectionHash = computeCollectionHash(dynamicChunkSignature(varName, varType));
  const covenantScript = buildEntryNftCovenantScript(
    hexToBin(categoryId), collectionHash, directConventionMasterLock(contract),
  );
  return scriptToAddress(covenantScript, contract.provider.network, contract.addressType, true);
}

// Root-addressed value-chunk covenant. The address commits to collection, slot, and value root, so chunk
// commitments carry only uint16 index || raw data.
export function getValueChunkAddress(
  contract: Contract<any, any>, categoryId: string, collection: string, slot: Uint8Array, root: Uint8Array,
): string {
  validateCategoryId(categoryId);
  const collectionHash = computeCollectionHash(valueChunkSignature(collection));
  const covenantScript = buildValueChunkCovenantScript(
    hexToBin(categoryId), collectionHash, slot, root, directConventionMasterLock(contract),
  );
  return scriptToAddress(covenantScript, contract.provider.network, contract.addressType, true);
}

// No contract parameter: unlike getValueChunkAddress this needs no network/addressType, and a route's chunks
// belong to the CALLEE, so there is no caller contract that would be correct to take.
export function getValueChunkLockingBytecode(
  categoryId: string, collection: string, slot: Uint8Array, root: Uint8Array, masterLock?: Uint8Array,
): Uint8Array {
  validateCategoryId(categoryId);
  const collectionHash = computeCollectionHash(valueChunkSignature(collection));
  return scriptToLockingBytecode(
    buildValueChunkCovenantScript(hexToBin(categoryId), collectionHash, slot, root, masterLock), 'p2sh32',
  );
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

/** The address holding a wide event's continuation chunks (anonymous events share one). */
export function getEventNftContinuationAddress(
  contract: Contract<any, any>, categoryId: string, eventNameOrSignature: string,
): string {
  validateCategoryId(categoryId);
  const eventSignature = resolveEventSignature(contract.artifact, eventNameOrSignature);
  const events: readonly EventDefinitionAbi[] = contract.artifact.events ?? [];
  const anonymous = events.find((event) => event.signature === eventSignature)?.anonymous === true;
  const hash = computeEventContinuationHash(eventSignature, anonymous);
  return scriptToAddress(
    buildEventNftCovenantScript(hexToBin(categoryId), hash), contract.provider.network, 'p2sh32', true,
  );
}

/**
 * The input sequence that satisfies an event covenant's 144-block `OP_CHECKSEQUENCEVERIFY`. The covenant pushes the
 * bare VM number 144, which BIP-68 reads as a BLOCK-height relative locktime (type bit 22 clear), so the input's
 * sequence must match: disable bit (31) clear, type bit (22) clear, low 16 bits 144. Destroy sweeps event head and
 * continuation NFTs with this sequence, so the sweep can spend them once their 144-block age has elapsed.
 */
export const EVENT_NFT_RELATIVE_LOCK_SEQUENCE = 0x00000090;

/**
 * True for a framed contract whose entries name a token container: its containers are the accounted variant, whose
 * amount every master of the contract conserves.
 */
export function framedAccountsTokens(artifact: Artifact): boolean {
  return artifact.composition?.convention === 'framed'
    && artifact.abi.some((entry) => (entry.tokenContainerAccesses?.length ?? 0) > 0);
}

export function getTokenContainerAddress(
  contract: Contract<any, any>, categoryId: string, tokenContainerCategoryId: string,
): string {
  validateCategoryId(categoryId);
  validateCategoryId(tokenContainerCategoryId, 'tokenContainerCategoryId');
  const covenantScript = buildTokenContainerCovenantScript(
    hexToBin(categoryId), hexToBin(tokenContainerCategoryId), directConventionMasterLock(contract),
    { accounted: framedAccountsTokens(contract.artifact), ...directContainerOptions(contract, 'tokenContainer') },
  );
  // Always use P2SH32 for token containers so the in-script derivation
  // (which uses OP_HASH256) produces matching locking bytecodes
  return scriptToAddress(covenantScript, contract.provider.network, 'p2sh32', true);
}

export function getSatoshiContainerAddress(contract: Contract<any, any>, categoryId: string): string {
  validateCategoryId(categoryId);
  const covenantScript = buildSatoshiContainerCovenantScript(
    hexToBin(categoryId), directConventionMasterLock(contract), directContainerOptions(contract, 'satoshiContainer'),
  );
  // Always use P2SH32 for satoshi containers so the in-script derivation
  // (which uses OP_HASH256) produces matching locking bytecodes
  return scriptToAddress(covenantScript, contract.provider.network, 'p2sh32', true);
}

/** A satoshi container is a tokenless coin at its address; a coin carrying tokens there is junk. */
export function isSatoshiContainerCoin(utxo: Utxo): boolean {
  return utxo.token === undefined;
}

/** A token container holds its own address's category; a tokenless or foreign-category coin there is junk. */
export function isTokenContainerCoin(utxo: Utxo, tokenContainerCategoryId: string): boolean {
  return utxo.token?.category.toLowerCase() === tokenContainerCategoryId.toLowerCase();
}

// ---------------------------------------------------------------------------
// State reading
// ---------------------------------------------------------------------------

/** Deployment-authenticated state owner, which can have records beyond the implementation's public schema. */
export interface FramedStateOwner {
  readonly layout: StateLayout;
  readonly masterLockingBytecode: Uint8Array;
}

export async function getContractState(
  contract: Contract<any, any>, categoryId: string, dataNftAddresses?: string | string[],
  framedOwner?: FramedStateOwner,
): Promise<OnChainState> {
  validateCategoryId(categoryId);
  if (!contract.artifact.stateLayout) {
    throw new Error(`Contract ${contract.name} is not a stateful contract`);
  }

  if (framedOwner !== undefined) {
    const { readFramedDeployment, chunkRecordLockingBytecode } = await import('../framed/deploy/records.js');
    const inventory = await readFramedDeployment(contract.provider, categoryId, framedOwner.layout, {
      masterLocks: [framedOwner.masterLockingBytecode],
    });
    const dynamicChunkUtxos: Record<string, Utxo[]> = {};
    for (const variable of contract.artifact.stateLayout.variables) {
      if (variable.dynamic !== true) continue;
      const lock = binToHex(chunkRecordLockingBytecode(categoryId, variable.name, variable.type));
      dynamicChunkUtxos[variable.name] = inventory.chunks.filter((utxo) => utxo.lockingBytecode !== undefined
        && binToHex(utxo.lockingBytecode) === lock);
    }
    // Inventory belongs to the owner; decoded public values belong exclusively to the implementation schema.
    const dataNftUtxos = [...inventory.records];
    const state = new StateReader(contract.artifact.stateLayout).readState(
      dataNftUtxos, { categoryId, byVariable: dynamicChunkUtxos },
    );
    const masterLock = binToHex(framedOwner.masterLockingBytecode);
    return {
      state, dataNftUtxos, dynamicChunkUtxos,
      masterUtxo: inventory.mastersByLock.get(masterLock)?.[0],
      entryNftUtxos: [...inventory.collectionNodes, ...inventory.chunks].sort((a, b) => a.vout - b.vout),
    };
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
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_TRACE) {
    console.error('get-contract-state-addresses', {
      contract: contract.name, categoryId, tokenAddress: contract.tokenAddress,
      allAddresses, dataNftOnlyAddresses,
    });
  }
  return reader.readStateFromChain(
    contract.provider, categoryId, allAddresses, dataNftOnlyAddresses, dynamicChunkAddresses,
  );
}

// ---------------------------------------------------------------------------
// Covenant unlocker factories
// ---------------------------------------------------------------------------

export function createDataNftUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  const covenantScript = buildDataNftCovenantScript(hexToBin(categoryId), contractMasterLock(contract));
  return createCovenantContractUnlocker(
    contract,
    `DataNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
    [1n, BigInt(masterInputIndex)],
  );
}

export function createRelocatedDataNftUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, outputIndex: number, categoryId: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateMasterInputIndex(outputIndex);
  validateCategoryId(categoryId);
  const covenantScript = buildDataNftCovenantScript(hexToBin(categoryId), contractMasterLock(contract));
  return createCovenantContractUnlocker(
    contract,
    `DataNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [
      { name: 'flag', type: 'bigint' },
      { name: 'outputIndex', type: 'bigint' },
      { name: 'masterInputIndex', type: 'bigint' },
    ],
    [3n, BigInt(outputIndex), BigInt(masterInputIndex)],
  );
}

export function createDestroyDataNftUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  const covenantScript = buildDataNftCovenantScript(hexToBin(categoryId), contractMasterLock(contract));
  return createCovenantContractUnlocker(
    contract,
    `DataNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
    [2n, BigInt(masterInputIndex)],
  );
}

/** `masterLock` (with `bindContract` false) names the master an external record binds, not `contract`'s own. */
export function createReadOnlyDataNftUnlocker(
  contract: Contract<any, any>, categoryId: string,
  masterLock?: Uint8Array,
  bindContract = masterLock === undefined,
): ContractUnlocker {
  validateCategoryId(categoryId);
  const covenantScript = buildDataNftCovenantScript(
    hexToBin(categoryId), bindContract ? contractMasterLock(contract) : masterLock,
  );
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
  const covenantScript = buildEntryNftCovenantScript(
    hexToBin(categoryId), collectionHash, directConventionMasterLock(contract),
  );
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
  const covenantScript = buildEntryNftCovenantScript(
    hexToBin(categoryId), collectionHash, directConventionMasterLock(contract),
  );
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
  const covenantScript = buildValueChunkCovenantScript(
    hexToBin(categoryId), collectionHash, slot, root, directConventionMasterLock(contract),
  );
  const unlocker = createCovenantContractUnlocker(
    contract,
    `ValueChunkNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [{ name: 'flag', type: 'bigint' }, { name: 'masterInputIndex', type: 'bigint' }],
    [1n, BigInt(masterInputIndex)],
  );
  // This spend destroys an old root-addressed value version. Unlike preservation covenants, its aligned output
  // may therefore carry the replacement version (whose value root and P2SH32 locking bytecode are different).
  unlocker.allowsAlignedOutputReplacement = true;
  return unlocker;
}

// Read-only unlocker for a dynamic-storage chunk NFT: flag=0 (preserve, output==input) so an on-chain
// read can co-spend the var's chunks without destroying them. The entry covenant enforces preservation.
export function createReadOnlyDynamicChunkUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string, varName: string, varType: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  const collectionHash = computeCollectionHash(dynamicChunkSignature(varName, varType));
  const covenantScript = buildEntryNftCovenantScript(
    hexToBin(categoryId), collectionHash, directConventionMasterLock(contract),
  );
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
  masterLock?: Uint8Array,
  bindContract = masterLock === undefined,
): ContractUnlocker {
  validateCategoryId(categoryId);
  const collectionSignature = resolveCollectionSignature(contract.artifact, collectionNameOrSignature);
  const collectionHash = computeCollectionHash(collectionSignature);
  const covenantScript = buildEntryNftCovenantScript(
    hexToBin(categoryId), collectionHash,
    bindContract ? directConventionMasterLock(contract) : masterLock,
  );
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

/**
 * Unlocker for a wide event's continuation chunk. The chunk sits at the named event covenant seeded with the
 * `#continuation` hash (always P2SH32, matching `getEventNftContinuationAddress`); its unlock is the same empty
 * covenant push as the head, gated by the 144-block `OP_CHECKSEQUENCEVERIFY`.
 */
export function createEventContinuationNftUnlocker(
  contract: Contract<any, any>, categoryId: string, eventNameOrSignature: string,
): ContractUnlocker {
  validateCategoryId(categoryId);
  const eventSignature = resolveEventSignature(contract.artifact, eventNameOrSignature);
  const events: readonly EventDefinitionAbi[] = contract.artifact.events ?? [];
  const anonymous = events.find((event) => event.signature === eventSignature)?.anonymous === true;
  const covenantScript = buildEventNftCovenantScript(
    hexToBin(categoryId), computeEventContinuationHash(eventSignature, anonymous),
  );
  return createCovenantContractUnlocker(
    contract,
    `EventContinuationNft_${categoryId.slice(0, 8)}`,
    covenantScript,
    [],
    [],
    'p2sh32',
  );
}

export function createTokenContainerUnlocker(
  contract: Contract<any, any>, masterInputIndex: number, categoryId: string, tokenContainerCategoryId: string,
): ContractUnlocker {
  validateMasterInputIndex(masterInputIndex);
  validateCategoryId(categoryId);
  validateCategoryId(tokenContainerCategoryId, 'tokenContainerCategoryId');
  const covenantScript = buildTokenContainerCovenantScript(
    hexToBin(categoryId), hexToBin(tokenContainerCategoryId), directConventionMasterLock(contract),
    directContainerOptions(contract, 'tokenContainer'),
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
  const covenantScript = buildSatoshiContainerCovenantScript(
    hexToBin(categoryId), directConventionMasterLock(contract), directContainerOptions(contract, 'satoshiContainer'),
  );
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

/**
 * `__internal__msgSenderCategory` for a delegatecall implementation unlocker.
 * EVM delegatecall keeps the original caller. The implementation of THIS contract's
 * proxy must see the user (32 zero bytes → emitMsgSender uses tx.origin). A nested
 * proxy implementation (we called their proxy) sees us as msg.sender.
 */
export function delegateImplMsgSenderCategory(
  nestedProxyCategoryId: string | undefined,
  callerCategoryId: string,
): Uint8Array {
  if (!nestedProxyCategoryId || nestedProxyCategoryId === callerCategoryId) {
    return new Uint8Array(32);
  }
  return hexToBin(callerCategoryId).reverse();
}
