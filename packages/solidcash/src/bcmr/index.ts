/**
 * BCMR metadata for deployed contracts (docs/bcmr/DESIGN.md): the identity output every genesis leads with, the
 * registry a deployment publishes, and the updates that follow.
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
  registryTimestamp,
  selfPublishedRegistry,
  withSnapshot,
  type BcmrSnapshot,
  type EncodedRegistry,
  type MetadataRegistry,
} from './registry.js';
export {
  BURNED_LOCKING_BYTECODE,
  FROZEN_REDEEM_SCRIPT,
  authGuardLockingBytecode,
  authGuardRedeemScript,
  authGuardUnlocker,
  frozenLockingBytecode,
  identityOutput,
  isP2pkhLock,
  lockOf,
  planGenesisIdentity,
  type GenesisIdentity,
  type IdentityPolicy,
  type IdentityPolicyKind,
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
  framedNftLocks,
  type DeploymentNftLocks,
} from './nft-roles.js';
export {
  publishMetadata,
  type CurrentIdentity,
  type NextIdentity,
  type PublishMetadataOptions,
  type PublishMetadataResult,
} from './publish.js';
