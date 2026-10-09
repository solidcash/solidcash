import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { resolveAddressForm, type AddressForm, type Artifact, type ExternalResultEncoding } from '@solidcash/utils';
import { lockingBytecodeToSolidityAddressPayload } from '../utils.js';

/** True when this artifact's bytecode decodes external returns as EVM ABI words. */
export function artifactUsesSolidityAbi(artifact: Pick<Artifact, 'compiler'>): boolean {
  // Only the explicit compiler switch is authoritative. A `pragma solidity` source marker is not:
  // generateArtifact used to omit `evmCompat` from published options, and those builds
  // decode a bool return as pushdata `0x51` (emitPushdataDecodeLastField). Inferring EVM framing
  // from the pragma then precomputes 32-byte `00…01`, which fails `EQUAL 0x51` at the caller.
  return artifact.compiler?.options?.evmCompat === true;
}

/**
 * The form an address value takes in this artifact, as the compile that produced it decided. `'hash'` narrows an
 * address to its 20-byte Solidity identity; `'bytecode'` keeps the exact locking bytecode and truncates nothing.
 * An artifact that predates the option follows its mode, which is what `resolveAddressForm` encodes.
 */
export function artifactAddressForm(artifact: Pick<Artifact, 'compiler'>): AddressForm {
  return resolveAddressForm(artifact.compiler?.options ?? {});
}

/**
 * `(token0, token1) = a < b ? (a, b) : (b, a)` for two addresses, as a covenant evaluates it: an address compares
 * as its bytes read as an unsigned big-endian number, so a shorter lock can order before a longer one whose
 * first byte is smaller.
 */
export function sortAddressPair(a: Uint8Array, b: Uint8Array): [Uint8Array, Uint8Array] {
  const asNumber = (value: Uint8Array): bigint => (value.length === 0 ? 0n : BigInt(`0x${binToHex(value)}`));
  return asNumber(a) < asNumber(b) ? [a, b] : [b, a];
}

/**
 * `abi.encodePacked(token0, token1)` after `(token0, token1) = a < b ? (a, b) : (b, a)`: the pair a Uniswap-style
 * factory hashes, by the covenant's own rules. The comparison is `sortAddressPair`, and a Solidity-compat source
 * (`artifactUsesSolidityAbi`) packs each address as its 20-byte identity, not its locking bytecode. Undefined when
 * a Solidity-compat address has no such identity.
 */
export function sortedAddressPairPacked(
  a: Uint8Array, b: Uint8Array, solidityAddresses: boolean,
): Uint8Array | undefined {
  const [token0, token1] = sortAddressPair(a, b);
  const fields = solidityAddresses
    ? [lockingBytecodeToSolidityAddressPayload(token0), lockingBytecodeToSolidityAddressPayload(token1)]
    : [token0, token1];
  if (!fields[0] || !fields[1]) return undefined;
  const packed = new Uint8Array(fields[0].length + fields[1].length);
  packed.set(fields[0], 0);
  packed.set(fields[1], fields[0].length);
  return packed;
}

const LEGACY_EVM_WORD_TYPE = new RegExp(
  '^(?:u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|'
  + '104|112|120|128|136|144|152|160|168|176|184|192|'
  + '200|208|216|224|232|240|248|256)?|bigint|bool|'
  + 'address(?: payable)?|bytes(?:[1-9]|[12][0-9]|3[0-2])|'
  + String.raw`u?fixed(?:\d+x\d+)?)$`,
);

/**
 * Resolve an authenticated typed-result representation. Fresh artifacts publish this tuple-wide fact. Legacy
 * native artifacts are unambiguously compact; legacy Solidity artifacts are inferred only for one-word scalar
 * tuples, because dynamic/composite schemas had multiple historical representations and must fail closed.
 */
export function resolveExternalResultEncoding(
  published: ExternalResultEncoding | undefined,
  artifact: Pick<Artifact, 'compiler' | 'contractName' | 'enums'>,
  types: readonly string[],
  context = 'external result',
): ExternalResultEncoding {
  if (published !== undefined) return published;
  if (!artifactUsesSolidityAbi(artifact)) return 'compact-pushdata-v1';
  const enumNames = new Set((artifact.enums ?? []).map((entry) => entry.name));
  if (types.every((type) => LEGACY_EVM_WORD_TYPE.test(type) || enumNames.has(type))) return 'evm-abi-v1';
  throw new Error(
    `${context} in Solidity-compatible artifact '${artifact.contractName}' has no authenticated resultEncoding; `
    + 'recompile the artifact before consuming dynamic or composite results',
  );
}
