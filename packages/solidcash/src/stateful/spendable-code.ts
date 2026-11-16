/**
 * Every deployment refuses code no input could ever spend, before it broadcasts anything (UnspendableContractError).
 *
 * The limit is the one the provider enforces, its `consensusLimits`, or BCH's 10,000 bytes when it publishes none: the
 * network the coins land on decides whether they can move. The `maximumInputBytes` a contract was compiled for is not
 * recorded in its artifact, and the compiler's `contract-size-limit` diagnostic measures the artifact's code alone,
 * without the contract arguments, category pin, salt and library pad a deployed redeem script carries. So a mock that
 * enforces 1,000,000 bytes deploys a 20,000-byte build it can spend, and a network that enforces 10,000 refuses it.
 */
import { asmToBytecode, pushPrefixLength, type Artifact } from '@solidcash/utils';
import { UnspendableContractError } from '../Errors.js';
import type { AddressType } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';

/** BCH's per-input script limit and stack item limit, for a provider that publishes none. */
const BCH_INPUT_LIMIT = 10_000;

type LimitSource = Pick<NetworkProvider, 'consensusLimits'>;

/**
 * Why a lock holding `codeBytes` of code at `addressType` can never be spent on `provider`'s network, or undefined when
 * a spend of it can fit. A P2SH spend pushes the redeem script as one stack item of its unlocking bytecode, so that push
 * alone is the fewest bytes any spend needs; a P2S lock runs its code as the locking bytecode.
 */
export function unspendableCodeRefusal(
  contractName: string, codeBytes: number, provider: LimitSource, addressType: AddressType = 'p2sh32',
): UnspendableContractError | undefined {
  const maximumInputBytes = provider.consensusLimits?.maximumInputBytes ?? BCH_INPUT_LIMIT;
  const maximumStackItemBytes = provider.consensusLimits?.maximumStackItemBytes ?? BCH_INPUT_LIMIT;
  if (addressType === 'p2s') {
    return codeBytes > maximumInputBytes
      ? new UnspendableContractError(contractName, codeBytes, codeBytes, maximumInputBytes, 'locking bytecode')
      : undefined;
  }
  const pushed = codeBytes + pushPrefixLength(codeBytes);
  if (pushed > maximumInputBytes) {
    return new UnspendableContractError(contractName, codeBytes, pushed, maximumInputBytes, 'unlocking bytecode');
  }
  if (codeBytes > maximumStackItemBytes) {
    return new UnspendableContractError(contractName, codeBytes, codeBytes, maximumStackItemBytes, 'stack item');
  }
  return undefined;
}

/** Refuses code of `codeBytes` that no input could spend at `addressType` on `provider`'s network. */
export function assertSpendableCode(
  contractName: string, codeBytes: number, provider: LimitSource, addressType?: AddressType,
): void {
  const refusal = unspendableCodeRefusal(contractName, codeBytes, provider, addressType);
  if (refusal !== undefined) throw refusal;
}

/**
 * Refuses an artifact by its own code. Every lock built from it holds that code and more (its arguments, category pin,
 * salt), so this needs no instance, and a deployment asks it before it mints a pool, fans out a coin or builds a prep.
 */
export function assertSpendableArtifact(artifact: Artifact, provider: LimitSource, addressType?: AddressType): void {
  assertSpendableCode(artifact.contractName, asmToBytecode(artifact.bytecode).length, provider, addressType);
}

/** Refuses a built contract by its whole redeem script, the code its lock commits to. */
export function assertSpendableContract(contract: {
  readonly name: string; readonly bytesize: number; readonly addressType: AddressType; readonly provider: LimitSource;
}): void {
  assertSpendableCode(contract.name, contract.bytesize, contract.provider, contract.addressType);
}

/**
 * The first refusal of a deployment of `artifact`, by the code of every program it locks coins at. A framed function
 * split locks them at its shards and cut helpers, not at the logical contract, whose code may be over the limit because
 * it is split.
 */
export function assertDeploymentSpendable(artifact: Artifact, provider: LimitSource, options: {
  readonly addressType?: AddressType;
  readonly functionSplit?: {
    readonly shards: readonly { readonly artifact: Artifact }[];
    readonly internalCuts: readonly { readonly artifact: Artifact }[];
  };
} = {}): void {
  const split = options.functionSplit;
  if (split === undefined) {
    assertSpendableArtifact(artifact, provider, options.addressType);
    return;
  }
  // A framed master sits at the P2SH32 of its filled program, whatever address type its handle is given.
  for (const part of [...split.shards, ...split.internalCuts]) assertSpendableArtifact(part.artifact, provider);
}
