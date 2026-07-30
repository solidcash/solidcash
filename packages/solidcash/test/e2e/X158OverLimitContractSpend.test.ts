import { describe, expect, it } from 'vitest';
import { decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { asmToBytecode } from '@solidcash/utils';
import {
  Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X158 - THE OVER-LIMIT REFUSAL AT THE SPEND BOUNDARY.
 *
 * A contract whose script exceeds the 10,000-byte per-input limit compiles, publishes an
 * `artifact.diagnostics` entry no SDK path reads, and warns on the console. A compile-time throw was measured
 * and rejected for a good reason: it deletes the 8 over-limit rows from the benches and with them the ability
 * to measure the gap at all. The refusal belongs where a script length is fatal rather than merely measurable,
 * and this file decides it there.
 *
 * THE ANSWER TO "DOES THE EXISTING RULE ALREADY CATCH IT" IS YES, AND IT CATCHES MORE THAN THAT.
 * `consensus-unlocking-bytes` fires at the contract's own input index, with no new rule needed. But the two
 * checks do not have the same subject, and the difference is not a rounding error:
 *
 *   `solidc`   measures `scriptToBytecode(script).length`, the UN-CONSTRUCTED script, against 10,000.
 *   consensus  limits the UNLOCKING BYTECODE: constructor-argument pushes + script + redeem push prefix +
 *              every call argument.
 *
 * On the `Bulk` family below the overhead is 125 bytes - 21 for the `bytes20` constructor push, 3 for the
 * OP_PUSHDATA2 redeem prefix, 34 for the pubkey, 66 for the signature, 1 for `k` - so the true boundary sits
 * at 9,878 script bytes, 122 below the compiler's threshold. Rows 1 and 2 are that boundary to the byte, and
 * the compiler is SILENT on both: `artifact.diagnostics` is undefined for a contract every spend of which is
 * invalid at consensus. That band is what no compile-time check can reach, because at compile time the call
 * arguments do not exist yet.
 *
 * THE MOCK ACCEPTS THE VERY BYTES THE GATE REFUSES, which is what makes row 1 evidence rather than a
 * coincidence. `MOCK_CONSENSUS_LIMITS.maximumInputBytes` is 1,000,000 - 100x the real ceiling - so the
 * provider's decider takes the transaction and the gate is the only thing objecting. That relaxed profile is
 * also why `debug()`, which runs first in `send()`, does not speak: at 100x the limit the VM has no complaint.
 *
 * THIS IS NOT A SECURITY BOUNDARY. The SDK is an untrusted witness constructor and an attacker does not call
 * `send()`. It is a correctness aid: the composer reads the arithmetic here instead of building, funding and
 * signing a transaction no node will ever accept.
 */

/** `n` repeated arithmetic statements. The ONLY thing that varies between the rows below. */
const source = (n: number): string => `pragma solidcash >=0.8.0;
contract Bulk(bytes20 pkh) {
  function spend(pubkey pk, sig s, bigint k) public {
    require(hash160(pk) == pkh);
    require(checkSig(s, pk));
    bigint acc = k;
${Array.from({ length: n }, (_, i) => `    acc = acc + ${i + 1} * 3 - ${i};`).join('\n')}
    require(acc >= k);
  }
}`;

/** The discriminating pair: 883 statements is the first that cannot be spent, 882 the last that can. */
const OVER = compileString(source(883));
const UNDER = compileString(source(882));

interface Spend {
  builder: TransactionBuilder;
  raw: string;
  provider: MockNetworkProvider;
  unlockingBytes: number;
}

/** Spend one `Bulk` deployment, optionally behind a P2PKH input so the reported index is not always 0. */
async function bulkSpend(artifact: typeof OVER, lead: boolean = false): Promise<Spend> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [alicePkh], { provider });
  const utxo = randomUtxo({ satoshis: 200_000n });
  await provider.addUtxo(contract.address, utxo);
  const builder = new TransactionBuilder({ provider });
  if (lead) {
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const leadUtxo = randomUtxo({ satoshis: 50_000n });
    await provider.addUtxo(p2pkh.address, leadUtxo);
    builder.addInput(leadUtxo, p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
  }
  builder.addInput(utxo, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv), 1n));
  builder.addOutput({ to: contract.address, amount: lead ? 200_000n : 150_000n });
  const raw = builder.build();
  const index = lead ? 1 : 0;
  const unlockingBytes = decodeTransactionUnsafe(hexToBin(raw)).inputs[index].unlockingBytecode.length;
  return { builder, raw, provider, unlockingBytes };
}

const sendError = async (builder: TransactionBuilder): Promise<string> => {
  try { await builder.send(); return ''; } catch (error) { return (error as Error).message; }
};

describe('X158 - the over-limit refusal at the spend boundary', () => {
  it('0. the pair differs in size ONLY, and the compiler is silent on both', () => {
    // Both sides are the same contract with one statement more or less. Neither carries a diagnostic: the
    // compiler's check is on the un-constructed script and both are under its 10,000-byte threshold.
    expect(asmToBytecode(OVER.bytecode).length).toBe(9878);
    expect(asmToBytecode(UNDER.bytecode).length).toBe(9866);
    expect(OVER.diagnostics).toBeUndefined();
    expect(UNDER.diagnostics).toBeUndefined();
    // The unit trap that produced five wrong measurements: `artifact.bytecode` is an ASM LISTING, so its
    // character count halved is not a byte count. It reads ~2.2x high here.
    expect(OVER.bytecode.length / 2).toBeGreaterThan(20_000);
  });

  it('1. REFUSES the spend at the contract input, naming the contract and the overage', async () => {
    const { builder, unlockingBytes } = await bulkSpend(OVER);
    // 9,878 script + 21 constructor push + 3 redeem prefix + 34 pubkey + 66 signature + 1 for `k` = 10,003.
    expect(unlockingBytes).toBe(10_003);
    const message = await sendError(builder);
    expect(message).toMatch(/\[consensus\] consensus-unlocking-bytes at input 0/);
    expect(message).toMatch(/10003 unlocking bytecode bytes is 3 over the 10000-byte per-input script limit/);
    // The contract by name, and where its bytes went - an index alone does not say which contract to shrink.
    expect(message).toMatch(/it spends contract 'Bulk', whose 9899-byte redeem script fits the limit on its own/);
    expect(message).toMatch(/leaves only 101 bytes for the 104 bytes of arguments and redeem push/);
    // Exactly one rule fired: a refusal that also tripped dust or size would prove nothing about this one.
    expect(message).toMatch(/refused by 1 byte rule\(s\)/);
  }, 300_000);

  it('1b. GUARD: one statement fewer - 12 script bytes - and the identical spend settles', async () => {
    // Differs from row 1 in the repetition count alone: same constructor argument, same call arguments, same
    // output, same provider profile. Row 1 therefore measures the 10,000-byte ceiling and not the shape.
    const { builder, unlockingBytes } = await bulkSpend(UNDER);
    expect(unlockingBytes).toBe(9_991);
    await expect(builder.send()).resolves.toBeDefined();
  }, 300_000);

  it('2. THE MOCK ACCEPTS THE REFUSED BYTES, so the gate is the only objector', async () => {
    // The decisive control, and the reason this is a spend-boundary problem at all. The mock publishes
    // `maximumInputBytes: 1_000_000`, so its decider takes the same bytes the gate just refused - exactly the
    // shape in which an over-limit contract reached the benches looking deployable.
    const { builder, raw, provider } = await bulkSpend(OVER);
    expect(await sendError(builder)).toMatch(/consensus-unlocking-bytes/);
    await expect(provider.sendRawTransaction(raw)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('3. names the contract INPUT INDEX, not the transaction', async () => {
    // Behind a P2PKH input the same contract is refused at input 1. Without the index a composition of several
    // contracts reports a limit with nothing to attribute it to.
    const { builder } = await bulkSpend(OVER, true);
    const message = await sendError(builder);
    expect(message).toMatch(/\[consensus\] consensus-unlocking-bytes at input 1/);
    expect(message).toMatch(/it spends contract 'Bulk'/);
    // Input 0 is the P2PKH, and it is not accused: a subject is per-input, not per-transaction.
    expect(message).not.toMatch(/at input 0/);
  }, 300_000);

  it('4. a contract over the limit ON ITS OWN reports that instead, with its own arithmetic', async () => {
    // The plain case the compiler DOES see: 894 statements is 10,004 script bytes, so `contract-size-limit`
    // fires at compile time. The spend refusal then reports the redeem script as already over, rather than
    // claiming the arguments pushed it over.
    const huge = compileString(source(894));
    expect(huge.diagnostics?.[0].code).toBe('contract-size-limit');
    const { builder } = await bulkSpend(huge);
    const message = await sendError(builder);
    expect(message).toMatch(/10129 unlocking bytecode bytes is 129 over the 10000-byte per-input script limit/);
    expect(message).toMatch(
      /it spends contract 'Bulk', whose redeem script is 10025 bytes on its own - already 25 over the limit/,
    );
    expect(message).toMatch(/before any of its 104 bytes of arguments and redeem push/);
  }, 300_000);

  it('5. a subject can neither create a refusal nor suppress one', async () => {
    // The label is descriptive. Handing the assessor a deliberately wrong subject changes the TEXT and not the
    // verdict, so no future caller can reach for it as a way to widen or narrow the rule.
    const { raw } = await bulkSpend(UNDER);
    const transaction = decodeTransactionUnsafe(hexToBin(raw));
    const bare = layer3.assessFinalizedTransactionBytes(transaction);
    const labelled = layer3.assessFinalizedTransactionBytes(transaction, [
      { contractName: 'Fabricated', redeemBytes: 99_999 },
    ]);
    expect(bare.admitted).toBe(true);
    expect(labelled.admitted).toBe(true);
    expect(labelled.refusals).toHaveLength(0);
  }, 300_000);
});
