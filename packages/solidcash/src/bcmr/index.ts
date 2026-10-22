/**
 * BCMR metadata for deployed contracts (docs/bcmr/DESIGN.md): the authhead contract every genesis leads with, the
 * registry a deployment publishes, and the owner's spends that follow.
 */

export {
  BCMR_PUBLICATION_PREFIX,
  BcmrError,
  MAXIMUM_DATA_CARRIER_BYTES,
  dataCarrierBytes,
  encodePublicationUri,
  ipfsCidV1Raw,
  isDataCarrier,
  isPublicationBytecode,
  publicationBytecode,
  publicationOutput,
} from './publication.js';
export {
  BCMR_SCHEMA,
  TOKEN_SYMBOL_PATTERN,
  assertTokenDecimals,
  assertTokenSymbol,
  encodeRegistry,
  identitySnapshot,
  publishedRegistry,
  registryTimestamp,
  selfPublishedRegistry,
  withSnapshot,
  type BcmrSnapshot,
  type EncodedRegistry,
  type MetadataRegistry,
} from './registry.js';
export {
  AUTHHEAD_BODY,
  BURNED_LOCKING_BYTECODE,
  FROZEN_LOCKING_BYTECODE,
  authheadLockingBytecode,
  authheadOutput,
  authheadRedeemScript,
  authheadToken,
  authheadUnlocker,
  identityStatusOf,
  ownerLockRefusal,
  type IdentityStatus,
} from './authhead.js';
export {
  identityRecord,
  isP2pkhLock,
  lockOf,
  planGenesisIdentity,
  resolveIdentity,
  type GenesisIdentity,
  type IdentityOptions,
  type IdentityRecord,
} from './identity.js';
export { categoriesCreatedBy, identityOutputRefusal, publishesRegistry } from './authchain.js';
export {
  hasErc20Metadata,
  hasTotalSupply,
  metadataInteger,
  metadataText,
  nativeDecimals,
  scaleDigits,
} from './token.js';
export {
  NATIVE_TOKEN_EXTENSION,
  nativeCategoryStateVariable,
  prepareMetadata,
  type BcmrPublication,
  type ContractTokenFacts,
  type NativeTokenOptions,
  type PreparedMetadata,
  type PublishedRegistry,
} from './deployment.js';
export {
  NFT_PARSE_BUDGET,
  nftCategory,
  nftParseBytecode,
  nftTypeKeyHex,
  parseNft,
  pushedFields,
  type NftFieldEncoding,
  type NftParseField,
  type NftParseResult,
  type NftParseRole,
  type NftParseType,
} from './nft-parse.js';
export {
  deploymentNftRoles,
  directNftLocks,
  framedEventLockingBytecode,
  framedNftLocks,
  type DeploymentNftLocks,
} from './nft-roles.js';
export {
  publishMetadata,
  type IdentityAction,
  type PublishMetadataOptions,
  type PublishMetadataResult,
} from './publish.js';
