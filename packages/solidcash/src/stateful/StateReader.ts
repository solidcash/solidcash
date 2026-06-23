import {
  StateLayout, parsePushdataCommitment, EventDefinitionAbi, decodePushdataValue,
  StateValue, StateRecord, isMultiDataNftLayout,
  parseChunkCommitment, joinChunks, dynamicLenKey,
  parseArrayTypeString, isFixedWidthType, unpackFixedWidthArray,
} from '@solidcash/utils';
import { hexToBin, binsAreEqual, binToUtf8 } from '@bitauth/libauth';
import { Utxo } from '../interfaces.js';
import NetworkProvider from '../network/NetworkProvider.js';

export interface OnChainState {
  state: Record<string, StateValue>;
  masterUtxo: Utxo | undefined;
  dataNftUtxos: Utxo[];
  entryNftUtxos: Utxo[];
}

export class StateReader {
  constructor(private layout: StateLayout) {}

  /**
   * Find the master UTXO (minting NFT) for the given category.
   */
  findMasterUtxo(utxos: Utxo[], categoryId: string): Utxo | undefined {
    return utxos.find((utxo) => (
      utxo.token
      && utxo.token.category === categoryId
      && utxo.token.nft
      && utxo.token.nft.capability === 'minting'
    ));
  }

  /**
   * Find ALL master UTXOs (minting NFTs) for the given category.
   * Returns them sorted by vout (ascending).
   * A contract with threading enabled may have multiple minting NFTs.
   */
  findMasterUtxos(utxos: Utxo[], categoryId: string): Utxo[] {
    return utxos
      .filter((utxo) => (
        utxo.token
        && utxo.token.category === categoryId
        && utxo.token.nft
        && utxo.token.nft.capability === 'minting'
      ))
      .sort((a, b) => a.vout - b.vout);
  }

  /**
   * Find data NFT UTXOs matching the given category ID.
   * Validates each candidate's commitment by attempting to parse it as pushdata state
   * at any nftIndex. This distinguishes data NFTs from entry NFTs (whose commitments
   * have key+value format). Results are sorted by vout to match covenant output ordering.
   */
  findDataNfts(utxos: Utxo[], categoryId: string): Utxo[] {
    const dataNftCount = this.layout.dataNftCount ?? 1;
    const multi = isMultiDataNftLayout(this.layout);
    // Validate each candidate's commitment and record the nftIndex it parses at. For a multi-data-NFT
    // layout the commitment carries a verified nftIndex tag, so exactly one index parses cleanly.
    const tagged: Array<{ utxo: Utxo; nftIndex: number }> = [];
    for (const utxo of utxos) {
      if (!utxo.token
        || utxo.token.category !== categoryId
        || !utxo.token.nft
        || utxo.token.nft.capability !== 'mutable'
        || utxo.token.nft.commitment.length === 0) continue;
      const commitmentHex = utxo.token.nft.commitment;
      for (let nftIdx = 0; nftIdx < dataNftCount; nftIdx++) {
        try {
          parsePushdataCommitment(commitmentHex, this.layout, nftIdx);
          tagged.push({ utxo, nftIndex: nftIdx });
          break;
        } catch {
          // Try next nftIndex
        }
      }
    }
    // Multi-data-NFT: order by the verified nftIndex tag (robust against vout/input permutation, so
    // dataNftUtxos[i] is genuinely register i). Single-data-NFT: vout order (no tag to disambiguate).
    tagged.sort((a, b) => (multi ? a.nftIndex - b.nftIndex : a.utxo.vout - b.utxo.vout));
    return tagged.map((t) => t.utxo);
  }

  /**
   * Find entry NFT UTXOs matching the given category ID.
   * Entry NFTs are mutable NFTs with commitments that are NOT data NFTs.
   */
  findEntryNfts(allUtxos: Utxo[], dataNftUtxos: Utxo[], categoryId: string): Utxo[] {
    const dataNftIds = new Set(dataNftUtxos.map((u) => `${u.txid}:${u.vout}`));
    return allUtxos
      .filter((utxo) => (
        utxo.token
        && utxo.token.category === categoryId
        && utxo.token.nft
        && utxo.token.nft.capability === 'mutable'
        && utxo.token.nft.commitment.length > 0
        && !dataNftIds.has(`${utxo.txid}:${utxo.vout}`)
      ))
      .sort((a, b) => a.vout - b.vout);
  }

  /**
   * Find a dynamic var's chunk UTXOs in a pool (fetched from the var's chunk address), parse each
   * chunk commitment, and return them ordered by the verified in-commitment chunkIndex (robust against
   * UTXO permutation). Chunks are entry NFTs: mutable, this category, commitment = chunkIndex ++ data.
   */
  findChunkNfts(pool: Utxo[], categoryId: string): Array<{ chunkIndex: number; chunkData: Uint8Array }> {
    const chunks: Array<{ chunkIndex: number; chunkData: Uint8Array }> = [];
    for (const utxo of pool) {
      if (!utxo.token
        || utxo.token.category !== categoryId
        || !utxo.token.nft
        || utxo.token.nft.capability !== 'mutable'
        || utxo.token.nft.commitment.length === 0) continue;
      try {
        chunks.push(parseChunkCommitment(utxo.token.nft.commitment));
      } catch {
        // Not a chunk commitment for this var - skip.
      }
    }
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    return chunks;
  }

  /**
   * Assemble dynamic-storage vars: replace each `<name>$len` length header (decoded from the data NFT)
   * with the full value joined from the var's chunk UTXOs and truncated to that length. Mutates state.
   */
  private assembleDynamicVars(
    state: Record<string, StateValue>,
    categoryId: string,
    chunkPoolByVar: Record<string, Utxo[]>,
  ): void {
    for (const v of this.layout.variables) {
      if (!v.dynamic) continue;
      const lenKey = dynamicLenKey(v.name);
      const len = Number(state[lenKey] as bigint ?? 0n);
      delete state[lenKey];

      let value: Uint8Array;
      if (len === 0) {
        value = new Uint8Array(0);
      } else {
        const ordered = this.findChunkNfts(chunkPoolByVar[v.name] ?? [], categoryId);
        if (ordered.length === 0) {
          throw new Error(
            `Dynamic var '${v.name}' has length ${len} but no chunk UTXOs were found at its chunk address`,
          );
        }
        value = joinChunks(ordered.map((c) => c.chunkData), len);
      }
      // Chunk-packed fixed-width array: decode the tight blob into elements. string -> utf8, bytes -> raw.
      const arrInfo = parseArrayTypeString(v.type);
      if (arrInfo && isFixedWidthType(arrInfo.elementType)) {
        state[v.name] = unpackFixedWidthArray(value, arrInfo.elementType) as StateValue;
      } else {
        state[v.name] = v.type === 'string' ? binToUtf8(value) : value;
      }
    }
  }

  /**
   * Read state from data NFT UTXOs using pushdata format.
   * Data NFTs must be ordered by nftIndex (0, 1, 2, ...).
   */
  readState(
    dataNftUtxos: Utxo[],
  ): Record<string, StateValue> {
    const result: Record<string, StateValue> = {};

    for (let nftIdx = 0; nftIdx < this.layout.dataNftCount; nftIdx++) {
      const nftUtxo = dataNftUtxos[nftIdx];
      if (!nftUtxo || !nftUtxo.token?.nft?.commitment) {
        throw new Error(`Missing data NFT at index ${nftIdx} for state variables`);
      }

      const commitment = nftUtxo.token.nft.commitment;
      const parsed = parsePushdataCommitment(commitment, this.layout, nftIdx);

      for (const [key, value] of Object.entries(parsed)) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Fetch UTXOs from the chain and read the contract state.
   *
   * @param provider - Network provider to query UTXOs from.
   * @param categoryId - Token category ID shared by master and data NFTs.
   * @param addresses - Addresses to search for UTXOs. Should include the
   *   contract's token address (for the master UTXO) and any addresses
   *   where data NFTs are held.
   */
  async readStateFromChain(
    provider: NetworkProvider,
    categoryId: string,
    addresses: string[],
    dataNftAddresses?: string[],
    dynamicChunkAddresses?: Record<string, string>,
  ): Promise<OnChainState> {
    // Fetch all addresses in parallel for a consistent snapshot
    const utxoResults = await Promise.all(
      addresses.map((address) => provider.getUtxos(address)),
    );
    const allUtxos: Utxo[] = [];
    const utxosByAddress = new Map<string, Utxo[]>();
    for (let i = 0; i < addresses.length; i++) {
      allUtxos.push(...utxoResults[i]);
      utxosByAddress.set(addresses[i], utxoResults[i]);
    }

    const masterUtxo = this.findMasterUtxo(allUtxos, categoryId);

    // When dataNftAddresses are provided, only look for data NFTs at those specific addresses.
    // This prevents entry NFTs (which share the same category) from being misidentified.
    // Filter from already-fetched UTXOs to avoid TOCTOU issues from re-fetching.
    let dataNftPool: Utxo[];
    if (dataNftAddresses && dataNftAddresses.length > 0) {
      const dataNftAddressSet = new Set(dataNftAddresses);
      dataNftPool = [];
      for (const address of addresses) {
        if (dataNftAddressSet.has(address)) {
          dataNftPool.push(...(utxosByAddress.get(address) ?? []));
        }
      }
    } else {
      dataNftPool = allUtxos;
    }

    const dataNftUtxos = this.findDataNfts(dataNftPool, categoryId);

    if (dataNftUtxos.length < this.layout.dataNftCount) {
      throw new Error(
        `Expected ${this.layout.dataNftCount} data NFT(s) for category ${categoryId}, `
        + `found ${dataNftUtxos.length}. Check that all addresses holding data NFTs are included.`,
      );
    }

    const state = this.readState(dataNftUtxos);

    // Assemble dynamic-storage vars (string / unbounded bytes) from their chunk UTXOs, grouped by the
    // address each chunk collection was fetched from.
    if (dynamicChunkAddresses && Object.keys(dynamicChunkAddresses).length > 0) {
      const chunkPoolByVar: Record<string, Utxo[]> = {};
      for (const [varName, addr] of Object.entries(dynamicChunkAddresses)) {
        chunkPoolByVar[varName] = utxosByAddress.get(addr) ?? [];
      }
      this.assembleDynamicVars(state, categoryId, chunkPoolByVar);
    }

    const entryNftUtxos = this.findEntryNfts(allUtxos, dataNftUtxos, categoryId);

    return { state, masterUtxo, dataNftUtxos, entryNftUtxos };
  }
}

export interface ParsedEvent {
  txid: string;
  vout: number;
  values: Record<string, StateValue>;
  eventName?: string;
  eventSignature?: string;
}

export type EventFilter = Record<string, StateValue>;

/**
 * Parse event commitment data from a hex-encoded NFT commitment.
 */
export function parseEventCommitment(
  commitmentHex: string,
  eventDef: EventDefinitionAbi,
  structs?: StateLayout['structs'],
): Record<string, StateValue> {
  const data = hexToBin(commitmentHex);
  const result: Record<string, StateValue> = {};
  let offset = 0;

  for (const param of eventDef.parameters) {
    const { value, bytesConsumed } = decodePushdataValue(data, offset, param.type, structs);
    result[param.name] = value;
    offset += bytesConsumed;
  }

  if (offset < data.length) {
    throw new Error(
      `parseEventCommitment: ${data.length - offset} trailing byte(s) after parsing all parameters`,
    );
  }

  return result;
}

/**
 * Read events from chain by querying UTXOs at the event covenant address.
 */
export async function readEventsFromChain(
  provider: NetworkProvider,
  eventAddress: string,
  categoryId: string,
  eventDef: EventDefinitionAbi,
  structs?: StateLayout['structs'],
): Promise<ParsedEvent[]> {
  const utxos = await provider.getUtxos(eventAddress);

  return utxos
    .filter((utxo) => (
      utxo.token
      && utxo.token.category === categoryId
      && utxo.token.nft
      && utxo.token.nft.commitment.length > 0
    ))
    .map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      values: parseEventCommitment(utxo.token!.nft!.commitment, eventDef, structs),
    }));
}

/**
 * Read events from chain and filter by indexed parameter values.
 */
export async function readEventsFiltered(
  provider: NetworkProvider,
  eventAddress: string,
  categoryId: string,
  eventDef: EventDefinitionAbi,
  filters?: EventFilter,
  structs?: StateLayout['structs'],
): Promise<ParsedEvent[]> {
  const allEvents = await readEventsFromChain(provider, eventAddress, categoryId, eventDef, structs);
  if (!filters || Object.keys(filters).length === 0) return allEvents;

  // Validate filter keys are indexed parameters
  const indexedParams = new Set(
    eventDef.parameters.filter((p) => p.indexed).map((p) => p.name),
  );
  for (const key of Object.keys(filters)) {
    if (!indexedParams.has(key)) {
      throw new Error(`Filter key '${key}' is not an indexed parameter of event '${eventDef.name}'`);
    }
  }

  return allEvents.filter((event) => Object.entries(filters).every(
    ([key, val]) => valuesEqual(event.values[key], val),
  ));
}

/**
 * Try to parse an event commitment, returning null if the commitment doesn't
 * fully match the event definition (e.g. trailing bytes remain).
 */
export function tryParseEventCommitment(
  commitmentHex: string,
  eventDef: EventDefinitionAbi,
  structs?: StateLayout['structs'],
): Record<string, StateValue> | null {
  try {
    const data = hexToBin(commitmentHex);
    const result: Record<string, StateValue> = {};
    let offset = 0;

    for (const param of eventDef.parameters) {
      if (offset >= data.length) return null; // not enough data
      const { value, bytesConsumed } = decodePushdataValue(data, offset, param.type, structs);
      result[param.name] = value;
      offset += bytesConsumed;
    }

    // Reject if there are unconsumed bytes (wrong event schema)
    if (offset !== data.length) return null;

    return result;
  } catch {
    return null;
  }
}

/**
 * Read anonymous events from chain. Queries the shared anonymous event address
 * and tries decoding each UTXO against all anonymous event definitions.
 */
export async function readAnonymousEventsFromChain(
  provider: NetworkProvider,
  anonymousAddress: string,
  categoryId: string,
  anonymousEventDefs: EventDefinitionAbi[],
  structs?: StateLayout['structs'],
): Promise<ParsedEvent[]> {
  const utxos = await provider.getUtxos(anonymousAddress);
  const results: ParsedEvent[] = [];

  const filtered = utxos.filter((utxo) => (
    utxo.token
    && utxo.token.category === categoryId
    && utxo.token.nft
    && utxo.token.nft.commitment.length > 0
  ));

  for (const utxo of filtered) {
    for (const eventDef of anonymousEventDefs) {
      try {
        const values = tryParseEventCommitment(utxo.token!.nft!.commitment, eventDef, structs);
        if (values === null) continue; // didn't match this event schema
        results.push({
          txid: utxo.txid,
          vout: utxo.vout,
          values,
          eventName: eventDef.name,
          eventSignature: eventDef.signature,
        });
        break; // first successful decode wins
      } catch {
        // Try next event definition
      }
    }
  }

  return results;
}

/**
 * Deep equality comparison for StateValue types (bigint, Uint8Array, string, boolean, struct objects).
 */
export function valuesEqual(a: StateValue, b: StateValue): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;

  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    return binsAreEqual(a, b);
  }

  if (typeof a === 'object' && typeof b === 'object'
    && !(a instanceof Uint8Array) && !(b instanceof Uint8Array)) {
    const aRec = a as StateRecord;
    const bRec = b as StateRecord;
    const aKeys = Object.keys(aRec);
    const bKeys = Object.keys(bRec);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => key in bRec && valuesEqual(aRec[key], bRec[key]));
  }

  return false;
}
