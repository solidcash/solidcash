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
import type { Output } from '../interfaces.js';
import { stageBroadcasts } from '../framed/proxy/staged-broadcasts.js';
import type { DeployOptions } from '../stateful/stateful-lifecycle-types.js';
import type { GenesisIdentity, IdentityRecord } from './identity.js';
import {
  BcmrError, dataCarrierBytes, ipfsCidV1Raw, publicationOutput,
} from './publication.js';
import {
  assertTokenSymbol, encodeRegistry, registryTimestamp, selfPublishedRegistry,
  type BcmrSnapshot, type EncodedRegistry,
} from './registry.js';
import { nftCategory, type NftParseRole } from './nft-parse.js';
import {
  hasErc20Metadata, hasTotalSupply, metadataInteger, metadataText, nativeDecimals,
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
   * the symbol case-insensitively (BCMR symbols are capitals), the decimals after the native scale.
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

/** The contract's own fungible token, as BchNative holds it (direct convention). */
export interface NativeTokenOptions {
  /** The fungible amount of the contract's own category minted into its token container: the premint. */
  readonly reserve?: bigint;
  /** Ledger units one native unit backs (BchNativeMultiplier's multiplier), a power of ten; 1 when omitted. */
  readonly scale?: bigint;
}

/** A registry as a deployment published it, and the URIs its publication offers. */
export interface PublishedRegistry extends EncodedRegistry {
  readonly uris: readonly string[];
}

/** What a contract answers through IERC20Metadata and EIP-20 `totalSupply()`. */
export interface ContractTokenFacts {
  readonly name?: string;
  readonly symbol?: string;
  readonly decimals?: bigint;
  readonly totalSupply?: bigint;
}

/** What a genesis needs from its metadata before it is built. */
export interface PreparedMetadata {
  readonly registry?: PublishedRegistry;
}

/** The extension naming where a ledger token's reserve sits, for explorers that adopt it (DESIGN.md, 6.7). */
export const NATIVE_TOKEN_EXTENSION = 'solidcash-native-token';

/** The largest fungible amount a category can hold. */
const MAXIMUM_FUNGIBLE_AMOUNT = 9_223_372_036_854_775_807n;

/** Deploys a probe genesis through `options.provider`; supplied by the deploy entry point to avoid an import cycle. */
export type ProbeDeploy = (options: DeployOptions) => Promise<{ readonly contract: unknown }>;

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
  const facts: { name?: string; symbol?: string; decimals?: bigint; totalSupply?: bigint } = {};
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
  return facts;
}

/** The token fields of a snapshot: stated ones checked against the contract's, omitted ones taken from it. */
function resolveToken(
  stated: BcmrPublication['token'], facts: ContractTokenFacts, scale: bigint,
): BcmrSnapshot['token'] | undefined {
  if (stated === undefined && facts.symbol === undefined) return undefined;
  const contractSymbol = facts.symbol;
  if (stated?.symbol !== undefined && contractSymbol !== undefined
    && stated.symbol.toUpperCase() !== contractSymbol.toUpperCase()) {
    throw new BcmrError(`bcmr.token.symbol "${stated.symbol}" disagrees with the contract's symbol() "${contractSymbol}"`);
  }
  const symbol = stated?.symbol ?? contractSymbol;
  if (symbol === undefined) throw new BcmrError('bcmr.token.symbol is required: the contract does not publish symbol()');
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

/**
 * Resolves a deployment's registry, and checks its premint against the ledger, before the genesis is built.
 * `reserveLockingBytecode` is the token container the premint goes to, named by the native-token extension.
 */
export async function prepareMetadata(options: {
  readonly artifact: Artifact;
  readonly category: string;
  readonly deploy: DeployOptions;
  readonly probe: ProbeDeploy;
  readonly reserveLockingBytecode?: Uint8Array;
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
  const reserve = nativeToken?.reserve;
  if (reserve !== undefined && (reserve < 1n || reserve > MAXIMUM_FUNGIBLE_AMOUNT)) {
    throw new BcmrError(`nativeToken.reserve must be from 1 to ${MAXIMUM_FUNGIBLE_AMOUNT}, got ${reserve}`);
  }

  const needsFacts = (publication !== undefined && hasErc20Metadata(artifact))
    || (reserve !== undefined && hasTotalSupply(artifact));
  const facts = needsFacts ? await probeTokenFacts(artifact, deploy, options.probe) : {};

  if (reserve !== undefined && facts.totalSupply !== undefined && reserve * scale < facts.totalSupply) {
    throw new BcmrError(
      `the premint backs ${reserve * scale} ledger units (reserve ${reserve} x scale ${scale}), but the constructor `
      + `credits a totalSupply() of ${facts.totalSupply}`,
    );
  }
  if (publication === undefined) return {};

  if (publication.name !== undefined && facts.name !== undefined && publication.name !== facts.name) {
    throw new BcmrError(`bcmr.name "${publication.name}" disagrees with the contract's name() "${facts.name}"`);
  }
  const name = publication.name ?? facts.name;
  if (name === undefined) throw new BcmrError('bcmr.name is required: the contract does not publish name()');
  const resolved = resolveToken(publication.token, facts, scale);
  let token = resolved;
  if (publication.token?.nfts === 'generated' && resolved !== undefined) {
    if (options.nftRoles === undefined) throw new BcmrError('this deployment cannot derive its NFT roles');
    token = { ...resolved, nfts: nftCategory(await options.nftRoles(), hexToBin(options.category)) };
  }

  const extensions: Record<string, Extensions[string]> = { ...(publication.extensions ?? {}) };
  if (deploy.identity?.kind === 'authguard') {
    extensions.authNft = deploy.identity.authKeyFunding.txid.toLowerCase();
  }
  if (reserve !== undefined && options.reserveLockingBytecode !== undefined) {
    extensions[NATIVE_TOKEN_EXTENSION] = {
      reserveLockingBytecode: binToHex(options.reserveLockingBytecode),
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
  const encoded = await encodeRegistry(selfPublishedRegistry(
    options.category, snapshot, publication.timestamp ?? registryTimestamp(),
  ));
  const uris = publication.publicationUris ?? [`ipfs://${ipfsCidV1Raw(encoded.bytes)}`];
  return { registry: { ...encoded, uris } };
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
