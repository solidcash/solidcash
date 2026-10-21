/**
 * A deployment's metadata: its identity output, its publication and, for an ERC-20-shaped token, its premint
 * (docs/bcmr/DESIGN.md, sections 4 to 6).
 *
 * The registry hash goes into the genesis, while a contract's own name, symbol, decimals and supply exist only once
 * its constructor has run. So when the contract's values are needed, a probe genesis is deployed through an overlay
 * that holds every broadcast and is never released, the values are read from it, and the real genesis is built from
 * the same funding coin. Neither the category nor the state depends on the genesis txid, so the probe's answers hold
 * for the real genesis, and a mismatch is refused before anything is broadcast.
 */

import type {
  Extensions, NftCategory, Tag, URIs,
} from '@bitauth/libauth/build/lib/engine/types/bcmr-types.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Artifact } from '@solidcash/utils';
import type { Output, Unlocker, Utxo } from '../interfaces.js';
import { ownCoinRefusal } from '../framed/deploy/own-coin.js';
import { stageBroadcasts } from '../framed/proxy/staged-broadcasts.js';
import type { DeployOptions } from '../stateful/stateful-lifecycle-types.js';
import type { GenesisIdentity, IdentityRecord } from './identity.js';
import {
  BcmrError, dataCarrierBytes, ipfsCidV1Raw, publicationOutput,
} from './publication.js';
import {
  assertTokenSymbol, encodeRegistry, publishedRegistry, registryTimestamp,
  type BcmrSnapshot, type EncodedRegistry,
} from './registry.js';
import { nftCategory, type NftParseRole } from './nft-parse.js';
import {
  hasErc20Metadata, hasTotalSupply, metadataInteger, metadataText, nativeDecimals, scaleDigits,
} from './token.js';

/** What a deployment publishes about its category. */
export interface BcmrPublication {
  /** The identity's name; an IERC20Metadata contract's `name()` when omitted. */
  readonly name?: string;
  readonly description?: string;
  /** `icon`, `web` and the schema's other URI identifiers. */
  readonly uris?: URIs;
  /** The registry tags the identity carries, by identifier. */
  readonly tags?: Readonly<Record<string, Tag>>;
  /**
   * Token fields. An IERC20Metadata contract's values fill the ones omitted and are checked against the ones stated:
   * the symbol case-insensitively (BCMR symbols are capitals), the decimals after the native scale. A field whose
   * view the probe cannot read must be stated.
   */
  readonly token?: {
    readonly symbol?: string;
    readonly decimals?: number;
    /** How the category's NFTs read; `'generated'` labels the contract's own NFTs from its artifact (section 8). */
    readonly nfts?: NftCategory | 'generated';
  };
  readonly extensions?: Extensions;
  /** The URIs the publication offers; `ipfs://<CIDv1 of the registry>` when omitted. */
  readonly publicationUris?: readonly string[];
  /** When the snapshot takes effect, as `YYYY-MM-DDTHH:mm:ss.sssZ`; the deployment time when omitted. */
  readonly timestamp?: string;
}

/** A ledger token's bearer form, as BchNative holds it in the contract's token container. */
export interface NativeTokenOptions {
  /**
   * A token-free coin at vout 0 whose txid becomes the token's own category, which the genesis creates beside the
   * contract's. Omitted, the token is the contract's own category, which only the direct convention admits.
   */
  readonly funding?: Utxo;
  /** The funding coin's unlocker; the deployment's funder when omitted. */
  readonly funder?: Unlocker;
  /** The fungible amount minted into the contract's token container for the token's category: the premint. */
  readonly reserve?: bigint;
  /**
   * Bearer tokens of the token's category minted to `to`, a token-aware address: the supply a token whose ledger
   * starts empty puts in holders' hands to wrap.
   */
  readonly bearer?: { readonly amount: bigint; readonly to: string };
  /** Ledger units one native unit backs (BchNativeMultiplier's multiplier), a power of ten; 1 when omitted. */
  readonly scale?: bigint;
}

/** A registry as a deployment published it, and the URIs its publication offers. */
export interface PublishedRegistry extends EncodedRegistry {
  readonly uris: readonly string[];
}

/**
 * What a contract answers through IERC20Metadata and EIP-20 `totalSupply()`, and the bearer category its reserve
 * container is keyed by when it keeps that category in state.
 */
export interface ContractTokenFacts {
  readonly name?: string;
  readonly symbol?: string;
  readonly decimals?: bigint;
  readonly totalSupply?: bigint;
  readonly nativeCategory?: string;
}

/** What a genesis needs from its metadata before it is built. */
export interface PreparedMetadata {
  readonly registry?: PublishedRegistry;
  /** The token category's genesis coin, which the genesis spends after its funding coin. */
  readonly nativeInput?: { readonly utxo: Utxo; readonly unlocker: Unlocker };
  /** The premint: the token's fungible amount at the contract's token container for the token's category. */
  readonly reserveOutput?: Output;
  /** The bearer supply: the token's fungible amount minted to the address `nativeToken.bearer` names. */
  readonly bearerOutput?: Output;
}

/** The extension naming where a ledger token's reserve sits, for explorers that adopt it (DESIGN.md, 6.7). */
export const NATIVE_TOKEN_EXTENSION = 'solidcash-native-token';

/** The largest fungible amount a category can hold. */
const MAXIMUM_FUNGIBLE_AMOUNT = 9_223_372_036_854_775_807n;

/** Deploys a probe genesis through `options.provider`; supplied by the deploy entry point to avoid an import cycle. */
export type ProbeDeploy = (options: DeployOptions) => Promise<{ readonly contract: unknown }>;

/**
 * The immutable state variable a contract keys its token container by (BchNative's bearer category), as the
 * artifact publishes it on the container's key.
 */
export function nativeCategoryStateVariable(artifact: Artifact): string | undefined {
  return artifact.abi.flatMap((entry) => entry.tokenContainerAccesses ?? [])
    .find((access) => access.keySource === 'state')?.keyStateVariable;
}

async function readFact(contract: unknown, view: string): Promise<unknown> {
  const read = (contract as unknown as { callStatic?: Record<string, () => Promise<unknown>> }).callStatic?.[view];
  if (read === undefined) return undefined;
  try {
    return await read();
  } catch {
    return undefined;
  }
}

/** Reads the contract's token facts from a probe genesis that is never broadcast. */
async function probeTokenFacts(
  artifact: Artifact, options: DeployOptions, probe: ProbeDeploy,
): Promise<ContractTokenFacts> {
  const staging = stageBroadcasts(options.provider);
  const { contract } = await probe({
    ...options, provider: staging.provider, bcmr: undefined, metadataProbe: true,
  });
  const facts: {
    name?: string; symbol?: string; decimals?: bigint; totalSupply?: bigint; nativeCategory?: string;
  } = {};
  if (hasErc20Metadata(artifact)) {
    const name = await readFact(contract, 'name');
    const symbol = await readFact(contract, 'symbol');
    const decimals = await readFact(contract, 'decimals');
    if (name !== undefined) facts.name = metadataText(name);
    if (symbol !== undefined) facts.symbol = metadataText(symbol);
    if (decimals !== undefined) facts.decimals = metadataInteger(decimals, 'decimals()');
  }
  if (hasTotalSupply(artifact)) {
    const totalSupply = await readFact(contract, 'totalSupply');
    if (totalSupply !== undefined) facts.totalSupply = metadataInteger(totalSupply, 'totalSupply()');
  }
  const categoryVariable = nativeCategoryStateVariable(artifact);
  if (categoryVariable !== undefined) {
    const state = await (contract as { getState: () => Promise<Record<string, unknown>> }).getState();
    const category = state[categoryVariable];
    if (category instanceof Uint8Array) facts.nativeCategory = binToHex(category);
  }
  return facts;
}

/**
 * A field the options must state because the contract does not answer it: it publishes no view for it, or, with
 * `readsMetadata`, the probe could not read the view (DESIGN.md, 6.4).
 */
function requiredField(field: string, view: string, readsMetadata: boolean): BcmrError {
  return new BcmrError(`${field} is required: ${readsMetadata
    ? `the probe could not read the contract's ${view}` : `the contract does not publish ${view}`}`);
}

/**
 * The token fields of a snapshot: stated ones checked against the contract's, omitted ones taken from it. With
 * `readsMetadata` (the artifact carries IERC20Metadata) the snapshot always has a token, and a view the probe could
 * not read must be stated.
 */
function resolveToken(
  stated: BcmrPublication['token'], facts: ContractTokenFacts, scale: bigint, readsMetadata: boolean,
): BcmrSnapshot['token'] | undefined {
  if (stated === undefined && !readsMetadata) return undefined;
  const contractSymbol = facts.symbol;
  if (stated?.symbol !== undefined && contractSymbol !== undefined
    && stated.symbol.toUpperCase() !== contractSymbol.toUpperCase()) {
    throw new BcmrError(`bcmr.token.symbol "${stated.symbol}" disagrees with the contract's symbol() "${contractSymbol}"`);
  }
  const symbol = stated?.symbol ?? contractSymbol;
  if (symbol === undefined) throw requiredField('bcmr.token.symbol', 'symbol()', readsMetadata);
  if (stated?.symbol === undefined) {
    try {
      assertTokenSymbol(symbol);
    } catch {
      throw new BcmrError(
        `the contract's symbol() "${symbol}" is not a BCMR symbol (capitals, digits and hyphens); state `
        + `bcmr.token.symbol explicitly, for example "${symbol.toUpperCase().replace(/[^-A-Z0-9]/g, '')}"`,
      );
    }
  }
  const contractDecimals = facts.decimals === undefined ? undefined : nativeDecimals(facts.decimals, scale);
  if (stated?.decimals !== undefined && contractDecimals !== undefined && stated.decimals !== contractDecimals) {
    throw new BcmrError(
      `bcmr.token.decimals ${stated.decimals} disagrees with the contract: decimals() ${facts.decimals} less `
      + `log10 of the native scale ${scale} is ${contractDecimals}`,
    );
  }
  const decimals = stated?.decimals ?? contractDecimals;
  if (decimals === undefined && readsMetadata) throw requiredField('bcmr.token.decimals', 'decimals()', true);
  if (decimals === 18 && scale === 1n) {
    // eslint-disable-next-line no-console
    console.warn(
      'BCMR: an 18-decimal token with no native scale can back at most about 9.22 whole tokens in CashTokens '
      + '(the 64-bit cap over 10^18); BchNativeMultiplier scales the reserve',
    );
  }
  return {
    symbol,
    ...(decimals === undefined ? {} : { decimals }),
    ...(stated?.nfts === undefined || stated.nfts === 'generated' ? {} : { nfts: stated.nfts }),
  };
}

/** The token category's genesis coin, refused unless it can create a category of its own. */
async function nativeInputOf(
  deploy: DeployOptions, category: string,
): Promise<PreparedMetadata['nativeInput']> {
  const funding = deploy.nativeToken?.funding;
  if (funding === undefined) return undefined;
  const nativeCategory = funding.txid.toLowerCase();
  if (funding.vout !== 0) {
    throw new BcmrError(`nativeToken.funding must be at vout 0 to create a category, got vout ${funding.vout}`);
  }
  if (nativeCategory === category) throw new BcmrError('the token category must differ from the contract category');
  if (deploy.identity?.kind === 'authguard' && deploy.identity.authKeyFunding.txid.toLowerCase() === nativeCategory) {
    throw new BcmrError('the token category must differ from the AuthKey category');
  }
  const unlocker = deploy.nativeToken?.funder ?? deploy.funder;
  const refusal = await ownCoinRefusal(
    deploy.provider, funding, unlocker.generateLockingBytecode(), { role: 'token funder', tokenFree: true },
  );
  if (refusal !== undefined) throw new BcmrError(refusal);
  return { utxo: funding, unlocker };
}

/** The contract's identity beside its token's: the ledger it keeps and the labels of its NFTs. */
function contractSnapshot(
  name: string, symbol: string | undefined, nfts: NftCategory | undefined, authNft: Extensions[string] | undefined,
): BcmrSnapshot {
  return {
    name: `${name} contract`,
    description: `The contract that keeps the ${name} ledger; its NFTs hold the ledger's state.`,
    ...(symbol === undefined || nfts === undefined ? {} : { token: { symbol: `${symbol}-STATE`, nfts } }),
    ...(authNft === undefined ? {} : { extensions: { authNft } }),
  };
}

/** Resolves a deployment's registry and premint, and checks them against the contract, before the genesis is built. */
export async function prepareMetadata(options: {
  readonly artifact: Artifact;
  readonly category: string;
  readonly deploy: DeployOptions;
  readonly probe: ProbeDeploy;
  /** The contract's token container for the token's category, where the premint goes. */
  readonly reserveLockingBytecode?: Uint8Array;
  /** The satoshis each token output the genesis mints carries. */
  readonly tokenSatoshis: bigint;
  /** The deployment's NFT roles, for a publication that generates its NFT labels. */
  readonly nftRoles?: () => Promise<readonly NftParseRole[]>;
}): Promise<PreparedMetadata> {
  const { artifact, deploy } = options;
  const publication = deploy.bcmr;
  const nativeToken = deploy.nativeToken;
  if (publication === undefined && nativeToken === undefined) return {};
  if (publication !== undefined && deploy.identity?.kind === 'burned') {
    throw new BcmrError('a burned identity publishes nothing: choose another identity policy to publish metadata');
  }
  const scale = nativeToken?.scale ?? 1n;
  // Refused whether or not the contract publishes decimals() (DESIGN.md, 6.5).
  scaleDigits(scale);
  const reserve = nativeToken?.reserve;
  const bearer = nativeToken?.bearer;
  for (const [field, amount] of [['reserve', reserve], ['bearer.amount', bearer?.amount]] as const) {
    if (amount !== undefined && (amount < 1n || amount > MAXIMUM_FUNGIBLE_AMOUNT)) {
      throw new BcmrError(`nativeToken.${field} must be from 1 to ${MAXIMUM_FUNGIBLE_AMOUNT}, got ${amount}`);
    }
  }
  if ((reserve ?? 0n) + (bearer?.amount ?? 0n) > MAXIMUM_FUNGIBLE_AMOUNT) {
    throw new BcmrError(`nativeToken.reserve and nativeToken.bearer together exceed ${MAXIMUM_FUNGIBLE_AMOUNT}`);
  }
  const nativeInput = await nativeInputOf(deploy, options.category);
  const tokenCategory = nativeInput === undefined ? options.category : nativeInput.utxo.txid.toLowerCase();

  const readsMetadata = hasErc20Metadata(artifact);
  const checksSupply = reserve !== undefined && hasTotalSupply(artifact);
  const needsFacts = (publication !== undefined && readsMetadata) || checksSupply
    || (nativeInput !== undefined && nativeCategoryStateVariable(artifact) !== undefined);
  const facts = needsFacts ? await probeTokenFacts(artifact, deploy, options.probe) : {};

  if (nativeInput !== undefined && facts.nativeCategory !== undefined && facts.nativeCategory !== tokenCategory) {
    throw new BcmrError(
      `the contract keys its reserve by category ${facts.nativeCategory}, but nativeToken.funding creates `
      + `${tokenCategory}: construct the contract with the funding coin's txid`,
    );
  }
  if (checksSupply && facts.totalSupply === undefined) {
    throw new BcmrError(
      'nativeToken.reserve cannot be checked against the ledger: the probe could not read the contract\'s '
      + 'totalSupply()',
    );
  }
  if (reserve !== undefined && facts.totalSupply !== undefined && reserve * scale < facts.totalSupply) {
    throw new BcmrError(
      `the premint backs ${reserve * scale} ledger units (reserve ${reserve} x scale ${scale}), but the constructor `
      + `credits a totalSupply() of ${facts.totalSupply}`,
    );
  }
  const reserveLock = options.reserveLockingBytecode;
  const reserveOutput: Output | undefined = reserve === undefined || reserveLock === undefined ? undefined : {
    to: reserveLock, amount: options.tokenSatoshis, token: { category: tokenCategory, amount: reserve },
  };
  const bearerOutput: Output | undefined = bearer === undefined ? undefined : {
    to: bearer.to, amount: options.tokenSatoshis, token: { category: tokenCategory, amount: bearer.amount },
  };
  const prepared = {
    ...(nativeInput === undefined ? {} : { nativeInput }),
    ...(reserveOutput === undefined ? {} : { reserveOutput }),
    ...(bearerOutput === undefined ? {} : { bearerOutput }),
  };
  if (publication === undefined) return prepared;

  if (publication.name !== undefined && facts.name !== undefined && publication.name !== facts.name) {
    throw new BcmrError(`bcmr.name "${publication.name}" disagrees with the contract's name() "${facts.name}"`);
  }
  const name = publication.name ?? facts.name;
  if (name === undefined) throw requiredField('bcmr.name', 'name()', readsMetadata);
  const resolved = resolveToken(publication.token, facts, scale, readsMetadata);
  // The NFTs are the contract's, of its own category, whichever category the token is.
  let nfts = resolved?.nfts;
  if (publication.token?.nfts === 'generated' && resolved !== undefined) {
    if (options.nftRoles === undefined) throw new BcmrError('this deployment cannot derive its NFT roles');
    nfts = nftCategory(await options.nftRoles(), hexToBin(options.category));
  }
  const separate = tokenCategory !== options.category;
  const token = resolved === undefined ? undefined : {
    symbol: resolved.symbol,
    ...(resolved.decimals === undefined ? {} : { decimals: resolved.decimals }),
    ...(nfts === undefined || separate ? {} : { nfts }),
  };

  const extensions: Record<string, Extensions[string]> = { ...(publication.extensions ?? {}) };
  if (deploy.identity?.kind === 'authguard') {
    extensions.authNft = deploy.identity.authKeyFunding.txid.toLowerCase();
  }
  if (reserveOutput !== undefined && reserveLock !== undefined) {
    extensions[NATIVE_TOKEN_EXTENSION] = {
      reserveLockingBytecode: binToHex(reserveLock),
      scale: scale.toString(),
      ...(hasTotalSupply(artifact) ? { ledgerSupply: 'totalSupply()' } : {}),
    };
  }

  const snapshot: BcmrSnapshot = {
    name,
    ...(publication.description === undefined ? {} : { description: publication.description }),
    ...(publication.uris === undefined ? {} : { uris: publication.uris }),
    ...(publication.tags === undefined ? {} : { tags: publication.tags }),
    ...(token === undefined ? {} : { token }),
    ...(Object.keys(extensions).length === 0 ? {} : { extensions }),
  };
  // A token of its own category is an identity of its own, beside the contract's, which labels the NFTs.
  const identities = [{ category: tokenCategory, snapshot }];
  if (separate) {
    identities.push({
      category: options.category, snapshot: contractSnapshot(name, token?.symbol, nfts, extensions.authNft),
    });
  }
  const encoded = await encodeRegistry(publishedRegistry(
    options.category, identities, publication.timestamp ?? registryTimestamp(),
  ));
  const uris = publication.publicationUris ?? [`ipfs://${ipfsCidV1Raw(encoded.bytes)}`];
  return { ...prepared, registry: { ...encoded, uris } };
}

/** The outputs leading a genesis: the identity output, the publication, then the identity's trailing outputs. */
export function leadingOutputs(identity: GenesisIdentity, prepared: PreparedMetadata): Output[] {
  const publication = prepared.registry === undefined ? [] : [publicationOutput(
    prepared.registry.sha256, prepared.registry.uris, dataCarrierBytes(identity.output.to as Uint8Array),
  )];
  return [identity.output, ...publication, ...identity.trailing];
}

/** The record of the identity output a genesis `txid` created under `identity`. */
export function identityRecord(identity: GenesisIdentity, txid: string): IdentityRecord {
  const lockingBytecode = identity.output.to;
  if (!(lockingBytecode instanceof Uint8Array)) throw new BcmrError('an identity output is built from its bytecode');
  return {
    txid,
    vout: 0,
    satoshis: identity.output.amount,
    policy: identity.policy,
    lockingBytecode,
    ...(identity.authKeyCategory === undefined ? {} : { authKeyCategory: identity.authKeyCategory }),
  };
}
