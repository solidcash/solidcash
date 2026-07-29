import { encodeTransactionOutput } from '@bitauth/libauth';
import { MockNetworkProvider, type ConsensusLimits, VmTarget } from '../../src/index.js';

/**
 * BCH-2026 semantic-only Layer-3 test profile.
 *
 * This profile changes capacity limits, not the BCH-2026 instruction set or introspection semantics. Passing with
 * this profile is SEMANTIC evidence only: it is not consensus-fit, standard-policy, relay, or deployability
 * evidence.
 */
export const LAYER3_SEMANTIC_TEST_PROFILE = Object.freeze({
  name: 'layer3-bch2026-semantic-relaxed-v1',
  evidenceLevel: 'SEMANTIC' as const,
  vm: VmTarget.BCH_2026_05,
  consensusLimits: Object.freeze({
    maximumInputBytes: 1_000_000,
    maximumStackItemBytes: 1_000_000,
    maximumTransactionBytes: 10_000_000,
    maximumNftCommitmentBytes: 128,
    operationCostBudgetPerByte: 10_000_000,
    hashDigestIterationsPerByte: 10_000_000,
  } satisfies ConsensusLimits),
  policy: Object.freeze({
    /**
     * X60. THIS LINE IS NOT WHAT HID THE DUST DEFECT, and saying so precisely matters, because the fix that
     * follows from "the profile disabled dust" is the wrong fix.
     *
     * `MockNetworkProvider` DEFAULTS `enforceDust` to false for every instance in the repository
     * (MockNetworkProvider.ts, `policy: { enforceDust: false, ...options?.policy }`). Deleting this line
     * changes nothing at all: the capstones would still have been measured with dust off, and C1 would still
     * have been refused `64: dust` by a real node while every harness reading called it relayable.
     *
     * Nor can it simply be flipped to true here. `enforceDust: true` also selects `standard: true` in the
     * mem-cash verifier, which applies the FULL standard policy VM - including the per-input script and
     * transaction-size ceilings this profile deliberately relaxes. A profile whose declared purpose is relaxed
     * CAPACITY cannot opt into the standard capacity limits to get one relay rule.
     *
     * What catches the class instead is `dustOutputs` below: it applies BCHN's actual rule to the built
     * transaction's outputs, independently of any VM knob, and the capstones assert it is empty. A rule
     * evaluated on the bytes cannot be masked by a provider setting. The check on that check is the node
     * itself: each capstone's X59 block builds against regtest and reads BCHN's own verdict.
     */
    enforceDust: false,
  }),
});

/** Create a fresh provider for a Layer-3 semantic capstone. Never use this helper for deployment-fit claims. */
export function createLayer3SemanticTestProvider(): MockNetworkProvider {
  return new MockNetworkProvider({
    consensusLimits: { ...LAYER3_SEMANTIC_TEST_PROFILE.consensusLimits },
    policy: { ...LAYER3_SEMANTIC_TEST_PROFILE.policy },
  });
}

/** BCHN's default dust relay fee, in satoshis per kilobyte. */
export const DUST_RELAY_FEE_PER_KB = 1_000n;

export interface DustOutput {
  index: number;
  satoshis: bigint;
  /** The output's own serialized length, token prefix included - the figure BCHN's rule is computed from. */
  serializedBytes: number;
  threshold: bigint;
}

/**
 * Every output of a built transaction that BCHN would call dust, in output order.
 *
 * THE RULE, as BCHN implements it: an output is dust when its value is below the fee that spending it would
 * cost at three times the dust relay fee, where the spend is charged the output's own serialized length plus
 * 148 bytes for the input that redeems it. At the default 1,000 sat/kB that is `3 * (bytes + 148)`, so a
 * one-byte script needs 474 satoshis and a 25-byte P2PKH needs 546.
 *
 * This is deliberately computed from the SERIALIZED BYTES rather than read off a VM, so no provider policy
 * setting, relaxed capacity profile or instruction-set choice can mask it. It is the standing check that the
 * mock stack's repository-wide `enforceDust: false` default cannot supply.
 */
export function dustOutputs(
  transaction: { outputs: readonly { valueSatoshis: bigint }[] },
  dustRelayFeePerKb: bigint = DUST_RELAY_FEE_PER_KB,
): DustOutput[] {
  return transaction.outputs.flatMap((output, index) => {
    const serializedBytes = encodeTransactionOutput(output as never).length;
    const threshold = (3n * BigInt(serializedBytes + 148) * dustRelayFeePerKb) / 1_000n;
    return output.valueSatoshis < threshold
      ? [{ index, satoshis: output.valueSatoshis, serializedBytes, threshold }]
      : [];
  });
}

/** `dustOutputs` as a one-line assertion message, for use in an `expect` label. */
export function formatDustOutputs(rows: readonly DustOutput[]): string {
  return rows.length === 0
    ? 'no dust outputs'
    : rows.map((row) => `output ${row.index}: ${row.satoshis} sat, ${row.serializedBytes} B, `
      + `needs ${row.threshold}`).join('; ');
}

/**
 * X59. What a REAL BCHN node says about one built transaction, and what its answer is worth.
 *
 * ROUND 17 SETTLED THE SIZE RULE and could not settle anything else. A 101,513-byte transaction was refused
 * `64: tx-size` through the mempool and the same bytes were accepted inside a submitted block, so the
 * 100,000-byte ceiling is POLICY and not consensus. But every capstone offered to the node came back
 * `missing-inputs`: those bytes were built against `MockNetworkProvider`, their outpoints exist on no chain,
 * and the node therefore STOPPED BEFORE EXECUTING ANY SCRIPT. `missing-inputs` is not acceptance. It is not
 * even a script verdict.
 *
 * The only way to make the node execute a capstone's covenants is to build the capstone against the node, so
 * that every outpoint it spends is a real UTXO the node holds. That is what threading `createProvider` into
 * the capstone builders buys, and it is the whole reason this helper exists.
 *
 * WHAT A SUCCESSFUL RESULT HERE DOES ESTABLISH: BCHN accepted the transaction into its mempool and mined it,
 * having executed every input script under the real BCH-2026 consensus rules and the real standard relay
 * policy, with no relaxed limit anywhere - the regtest provider carries no `consensusLimits`, so the SDK's
 * probe VM is libauth's ordinary BCH-2026 one, and the node's own limits are whatever BCHN v29 ships.
 *
 * WHAT IT STILL DOES NOT ESTABLISH: anything about a shape that was not built and accepted. It is evidence
 * about the transaction that was mined, at the commit that built it, on regtest.
 */
export interface NodeAcceptance {
  txid: string;
  /** Confirmed height, read back from the node, so "mined" is a reading and not an inference. */
  blockHeight: number;
  serializedBytes: number;
  inputCount: number;
  outputCount: number;
}

/**
 * Broadcast one built transaction through a live provider and read back the proof it was mined.
 *
 * `RegtestNetworkProvider.sendRawTransaction` mines a block after a successful send, so a confirmation is
 * available immediately; this reads it rather than assuming it. A rejection propagates as a thrown error
 * carrying the node's own reject string, which is the reading worth having when it fails.
 */
export async function acceptedByNode(
  provider: {
    sendRawTransaction: (hex: string) => Promise<string>;
    getRawTransaction: (txid: string) => Promise<string>;
    getBlockHeight: () => Promise<number>;
  },
  transaction: { inputs: readonly unknown[]; outputs: readonly unknown[] },
  transactionHex: string,
): Promise<NodeAcceptance> {
  const txid = await provider.sendRawTransaction(transactionHex);
  // Read the transaction back FROM THE NODE. A send that resolves says the node took our bytes; reading them
  // back byte for byte says the node kept exactly those bytes, which is the claim the evidence rests on.
  const stored = await provider.getRawTransaction(txid);
  if (stored.toLowerCase() !== transactionHex.toLowerCase()) {
    throw new Error(`node stored different bytes for ${txid}`);
  }
  return {
    txid,
    blockHeight: await provider.getBlockHeight(),
    serializedBytes: transactionHex.length / 2,
    inputCount: transaction.inputs.length,
    outputCount: transaction.outputs.length,
  };
}
