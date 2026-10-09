/**
 * BCH dust threshold, vendored from `@mem-cash/validation`.
 *
 * Importing the whole `@mem-cash/validation` package pulls the verification pipeline and its dependencies into
 * the eager graph, while the SDK only needs this one pure, ~10-line derivation for covenant funding. Keeping it
 * local avoids that load for non-mock consumers.
 */

/** OP_RETURN opcode — marks an output as provably unspendable. */
const OP_RETURN = 0x6a;
/** Fixed dust relay fee in sat/KB (BCHN's `dustRelayFee`, separate from `minRelayTxFee`). */
const DUST_RELAY_FEE_PER_KB = 1000n;

export function getDustThreshold(
  output: { lockingBytecode: Uint8Array },
  dustRelayFeePerKb: bigint = DUST_RELAY_FEE_PER_KB,
): bigint {
  const script = output.lockingBytecode;
  // OP_RETURN and empty scripts are unspendable, hence exempt from dust.
  if (script.length === 0 || script[0] === OP_RETURN) return 0n;
  // Serialize size of a CTxOut: 8 (value) + compactSize(scriptLen) + scriptLen (1 byte for <253).
  const outputSize = 8 + (script.length < 253 ? 1 : 3) + script.length;
  // 148 = estimated input size to spend (32 prevhash + 4 previndex + 1 scriptLen + 107 sig + 4 seq).
  const spendSize = outputSize + 148;
  // Match BCHN: 3 * CFeeRate::GetFee(nSize) — floor division with min 1 sat.
  let feePerOutput = (dustRelayFeePerKb * BigInt(spendSize)) / 1000n;
  if (feePerOutput === 0n && spendSize > 0 && dustRelayFeePerKb > 0n) feePerOutput = 1n;
  return 3n * feePerOutput;
}
