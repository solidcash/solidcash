import { describe, expect, it } from 'vitest';
import { decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { asmToBytecode } from '@solidcash/utils';
import {
  Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder, messageBus,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import type { Unlocker } from '../../src/interfaces.js';
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
 * 122 IS ONE SAMPLE, NOT THE CONSTANT (X163). The band's width IS the overhead - a script of L bytes is
 * unspendable whenever `L > 10_000 - overhead` - and `l4-overhead-probe.ts` measured the overhead of every
 * contract-bearing input the corpus builds. 14,067 spends, 787 distinct contracts, 50 files:
 *
 *   overhead over all spends       min 2   p25 5   MEDIAN 122   p75 122   p90 173   p99 1,537   max 2,077
 *   of which ctor pushes           min 0   median 21   max 145
 *   of which call arguments        min 1   median 101  max 2,040
 *   per-contract WORST overhead    min 2   median 5   mean 55   max 2,077
 *   contracts whose band is wider than 125 bytes:  65 / 787 (8.3%);  wider than 1,000:  15 / 787 (1.9%)
 *
 * So `Bulk` sits exactly at the median and the median is not the answer. The widest band measured is 2,077
 * bytes: for that spend shape the effective compile-time threshold is 7,923, and a contract the compiler
 * passes at 9,000 script bytes is unspendable with 1,000 bytes to spare. The band should be stated as a RANGE
 * of 2..2,077 bytes over this corpus, with no upper bound in principle - `argOverhead` reaches 2,040 here and
 * a call argument may be up to the stack-item limit.
 *
 * AND IT IS NOT EVEN A PER-CONTRACT CONSTANT. 69 of the 952 distinct (contract, function) pairs measured show
 * MORE THAN ONE overhead, spreads up to 696 bytes, because a variable-width argument moves the boundary per
 * CALL. Rows 6 and 7 are that, constructed. This is the sharpest form of "no compile-time check can reach it":
 * the same deployed contract is spendable through one call and not through another.
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

/**
 * Overhead of ONE spend: `unlockingBytes - scriptBytes`, which is exactly the width of the silent band for
 * that contract and that call. `artifact.bytecode` is an ASM LISTING, so `asmToBytecode` is what turns it into
 * a byte count; halving its character count reads about 2.2x high and produced five wrong measurements here.
 */
async function measureOverhead(
  artifact: typeof OVER, unlock: (contract: Contract<typeof OVER>) => Unlocker,
  constructorArgs: unknown[] = [],
): Promise<{ script: number; redeem: number; unlocking: number; overhead: number }> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, constructorArgs as never[], { provider });
  const utxo = randomUtxo({ satoshis: 200_000n });
  await provider.addUtxo(contract.address, utxo);
  const builder = new TransactionBuilder({ provider });
  builder.addInput(utxo, unlock(contract));
  builder.addOutput({ to: contract.address, amount: 150_000n });
  const script = asmToBytecode(artifact.bytecode).length;
  const redeem = contract.bytecode.length / 2;
  const unlocking = decodeTransactionUnsafe(hexToBin(builder.build())).inputs[0].unlockingBytecode.length;
  return { script, redeem, unlocking, overhead: unlocking - script };
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

  it('6. THE BAND IS PER-CONTRACT: two shapes, two boundaries, one compiler threshold', async () => {
    // The 122 figure is a property of `Bulk`'s constructor and call signature, not of the limit. A contract
    // with no constructor argument and a no-argument function carries almost nothing beyond its redeem push,
    // so its cliff sits within a couple of bytes of 10,000 while `Bulk`'s sits 125 below it.
    //
    // Measured on SMALL scripts on purpose - the overhead does not depend on script length except through the
    // redeem push prefix, and that term is stated rather than folded in: 1 byte below 76, 2 below 256, and 3
    // in the band itself, where every script is over 9,800.
    const bare = compileString(`pragma solidcash >=0.8.0;
contract Bare() {
  function spend() public {
    require(1 == 1);
  }
}`);
    const bareSpend = await measureOverhead(bare, (contract) => contract.unlock.spend());
    const bulkSpendOverhead = await measureOverhead(compileString(source(1)), (contract) =>
      contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv), 1n), [alicePkh]);

    // Bare carries only its redeem push prefix; Bulk carries 21 + prefix + 34 + 66 + 1.
    expect(bareSpend.overhead).toBeLessThan(4);
    expect(bulkSpendOverhead.overhead).toBeGreaterThan(120);
    // The two cliffs are 100+ bytes apart under ONE compiler threshold, which is the whole claim.
    expect(bulkSpendOverhead.overhead - bareSpend.overhead).toBeGreaterThan(100);
  }, 300_000);

  it('7. THE BAND IS PER-CALL: one deployed contract, two argument values, two boundaries', async () => {
    // The sharpest form of "no compile-time check can reach it". Same artifact, same constructor arguments,
    // same address, same function - only the VALUE of a variable-width argument differs, and the unlocking
    // bytecode moves by that value's length. A compile-time check does not have this number because the
    // argument does not exist yet, and a per-contract check does not have it either.
    const variadic = compileString(`pragma solidcash >=0.8.0;
contract Variadic() {
  function spend(bytes data) public {
    require(data.length >= 0);
  }
}`);
    const short = await measureOverhead(variadic, (contract) => contract.unlock.spend(new Uint8Array(1)));
    const long = await measureOverhead(variadic, (contract) => contract.unlock.spend(new Uint8Array(400)));
    expect(long.overhead - short.overhead).toBe(400 + 1); // 400 payload bytes, plus OP_PUSHDATA1's extra byte
    expect(short.redeem).toBe(long.redeem); // identical deployment: only the call differs
  }, 300_000);

  it('5. a subject can neither create a refusal nor suppress one', async () => {
    // The label is descriptive. Handing the assessor a deliberately wrong subject changes the TEXT and not the
    // verdict, so no future caller can reach for it as a way to widen or narrow the rule.
    const { raw } = await bulkSpend(UNDER);
    const transaction = decodeTransactionUnsafe(hexToBin(raw));
    const bare = messageBus.assessFinalizedTransactionBytes(transaction);
    const labelled = messageBus.assessFinalizedTransactionBytes(transaction, [
      { contractName: 'Fabricated', redeemBytes: 99_999 },
    ]);
    expect(bare.admitted).toBe(true);
    expect(labelled.admitted).toBe(true);
    expect(labelled.refusals).toHaveLength(0);
  }, 300_000);
});
