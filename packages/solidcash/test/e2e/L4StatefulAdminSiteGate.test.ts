import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { compileString } from '../direct-compile.js';
import { decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import { describe, expect, it, beforeAll } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import {
  Contract, MockNetworkProvider, SignatureTemplate, StatefulContract,
} from '../../src/index.js';
import { Utxo } from '../../src/interfaces.js';
import { alicePub, alicePriv, alicePkh, bobPriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X163 - THE FOUR STATEFUL LIFECYCLE-ADMIN BROADCAST SITES, and the fifth that is deleted.
 *
 * WHAT THE INHERITED MEASUREMENT COULD NOT SETTLE. `message-bus-gatesite-probe.ts` attributed every broadcast the
 * SDK e2e population makes to its `src/` frame. These four sites saw 14 sends across 11 tests, 13 of which the
 * provider accepted, and the byte rules refused none of them. A previous worker declined to gate them on that,
 * correctly: 0% over 13 net-ok sends is not the evidence 2,316 sends gave for the submit path. At that sample
 * size the ONE real defect the submit-path measurement found - a fixture paying 100 satoshis to a one-byte
 * script - would have been invisible.
 *
 * SO THE COVERAGE IS CONSTRUCTED, NOT INHERITED. Every row below drives a site deliberately at the shape the
 * population never steers into. All four sites turn out to ship bytes a node refuses, and the reason is the
 * same on all four:
 *
 *   destroy         reclaim      = totalInputSats - fee
 *   split           change       = totalFunding - newMintingAmount * splitCount - fee
 *   merge           change       = consumedSatoshis + totalFunding - fee
 *   _sendRawBuilder change       = whichever of the two above, via `sc.call`
 *
 * Every one is pure arithmetic whose only floor is ZERO - `changeAmount < 0n` throws, `changeAmount > 0n`
 * ships - so the entire band between 1 satoshi and the dust threshold is reachable and unguarded. Worse, all
 * four then write the amount over a 1,000-satoshi placeholder BY INDEX on `builder.outputs`, which is the one
 * path into an output that `addOutput`'s policy check never sees. `MockNetworkProvider` does not catch it
 * either: its default policy is `enforceDust: false`, which sets `standard: false` and `dustRelayFeePerKb: 0n`
 * on the verifier - a harness that models no relay policy at all. That is the C1 blind spot exactly, on four
 * paths at once.
 *
 * THE NUMBER IS 576 AND IT IS NOT NEW. `3 * (44 + 148)` for a 44-byte output paying a p2sh32 address, the same
 * arithmetic BCHN used to refuse C1 `64: dust` at 474 for a 10-byte one. Rows 1/2/3/4 quote every term.
 *
 * THE ORDERING WINDOW WAS PINNED HERE AND IS NOW CLOSED (X175). All four sites deliberately bypass `debug()`,
 * so the gate used to be the FIRST decider and a split that broke its covenant AND paid dust reported the dust.
 * Pinning that with an ordering row recorded the hazard without removing it: any future hostile that pays dust
 * and matches loosely walks straight back into the shape that made the seventh vacuous guard on this effort.
 * Section 5 below is now the demonstration that it cannot recur - the gate reports BOTH objections, so the
 * ordering decides nothing.
 *
 * THE MECHANISM NO LONGER LIVES IN `StatefulContract.ts` (X186). `TransactionBuilder.send` has the same window
 * on two paths - a covenant input is debugged best-effort and SWALLOWED, a custom unlocker is not debugged at
 * all - so `covenantObjectionOf` and the routed gate moved to `message-bus/preflight.ts` and `send` now shares them.
 * Rows 1-5e are unchanged and byte-identical; row 5f keeps only the half whose subject is these four sites,
 * and `X186SendCovenantAbsorption.test.ts` owns the per-file structural count.
 *
 * THE THROW CENSUS, because a green suite proves nothing went RED and only a census proves nothing went
 * VACUOUS. `assertFinalizedTransactionBytes` was temporarily instrumented to append every call - throwing or
 * not - with its calling `src/` frame, and the whole at-risk population was run twice: once at the pre-gate
 * source, once with the four sites gated. Thirteen files, 212 passing tests both times, diffed by
 * `file::test::caller::occurrence`.
 *
 *   BEFORE   266 gate calls, 28 throws, 122 tests reaching the gate
 *   AFTER    280 gate calls, 28 throws, 128 tests reaching the gate
 *   newly reached       14   destroy 8, split 3, `_sendRawBuilder` 2, merge 1 - exactly the per-site counts
 *                            the X126 probe attributed to these four sites, and ALL 14 ADMITTED
 *   newly throwing       0
 *   disappeared          0
 *   changed verdict      0
 *
 * The 14 are what makes these four guards non-vacuous: each new call site has a live subject in the
 * pre-existing population, so none of them is a guard that can only ever fire on its own test. The 0 is the
 * blast radius. Note which of the two numbers is the evidence - 0% was already known and was correctly
 * refused as grounds for landing.
 *
 * A NARROWING THIS DOES CAUSE, stated rather than discovered: a contract whose MASTER output sits below the
 * token-output dust floor can no longer be destroyed through the SDK, because destroy recreates that output at
 * its own satoshi value. Such a master cannot be created on a real network in the first place - the node that
 * refuses it here is the node that would have refused its creation - but a mock-only fixture could hold one.
 * None in this repository does.
 *
 * NOT A SECURITY BOUNDARY. The SDK is an untrusted witness constructor and an attacker does not call
 * `StatefulContract.split`. This is a correctness aid: the composer reads the arithmetic here instead of
 * building, funding, signing and broadcasting a sweep the network will not relay.
 */

/**
 * FOUR `bytes32` state variables, MEASURED not guessed: state packs into 128-byte commitments, and 2 vars
 * yield one data NFT while 4 yield two. Destroy's batch path needs more inputs than `maxInputsPerTx`, and two
 * data NFTs plus the master is the smallest shape that reaches it (`maxInputsPerTx: 1` cannot be used - the
 * batch loop's `splice(0, 0)` never terminates at that value).
 */
const SRC = `
pragma solidcash >=0.8.0;

contract AdminSites(pubkey admin) {
    bytes32 a;
    bytes32 b;
    bytes32 c;
    bytes32 d;

    function touch() {
        this.a = this.b;
    }

    function fork(bigint n, sig s) split(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }

    function consolidate(bigint n, sig s) merge(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }

    function wind(sig s) selfdestruct {
        require(checkSig(s, admin));
    }
}
`;

/** The dust threshold for the 44-byte p2sh32 change output every row below pays to. */
const CHANGE_DUST = 576n;

let artifact: Artifact;

interface Deployment {
  contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
  p2pkh: Contract;
  provider: MockNetworkProvider;
}

let seed = 0x10;
const nextTxid = (): string => (seed++).toString(16).padStart(2, '0').repeat(32);

async function deploy(): Promise<Deployment> {
  const provider = new MockNetworkProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 100_000n };
  await provider.addUtxo(p2pkh.address, fundingUtxo);
  const { contract } = await StatefulContract.deploy(artifact, [alicePub], {
    provider,
    fundingUtxo,
    funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: {
      a: new Uint8Array(32), b: new Uint8Array(32), c: new Uint8Array(32), d: new Uint8Array(32),
    },
    changeAddress: p2pkh.address,
  });
  return { contract, p2pkh, provider };
}

const fund = async (d: Deployment, satoshis: bigint): Promise<Utxo> => {
  const utxo: Utxo = { txid: nextTxid(), vout: 0, satoshis };
  await d.provider.addUtxo(d.p2pkh.address, utxo);
  return utxo;
};

const funder = (d: Deployment): ReturnType<Contract['unlock'][string]> =>
  d.p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv));

const errorOf = async (run: () => Promise<unknown>): Promise<string> => {
  try { await run(); return ''; } catch (error) { return (error as Error).message; }
};

/**
 * One split at the static site. `change` is the exact satoshi value the change output will carry, because the
 * fee is declared and the funding is derived from it - nothing here is left to a size estimate.
 */
async function staticSplit(
  d: Deployment, change: bigint, priv: Uint8Array = alicePriv, count = 2n,
): Promise<{ tx: { hex: string; txid: string } }> {
  const fee = 2_000n;
  const minting = 1_200n;
  const funding = await fund(d, minting * count + fee + change);
  return StatefulContract.split({
    provider: d.provider,
    contract: d.contract,
    splitFunctionName: 'fork',
    splitFunctionArgs: [count, new SignatureTemplate(priv)],
    funder: funder(d),
    fundingUtxos: [funding],
    changeAddress: d.p2pkh.address,
    newMintingAmount: minting,
    fee,
  }) as never;
}

describe('X163 - the stateful lifecycle-admin broadcast sites decide their finalized bytes', () => {
  beforeAll(() => { artifact = compileString(SRC); });

  /* ---------------------------------------------------------------------------------------------------- */
  /* StatefulContract.destroy                                                                             */
  /* ---------------------------------------------------------------------------------------------------- */

  it('1. destroy REFUSES a below-dust reclaim, quoting the arithmetic that produced the threshold', async () => {
    // Destroy sweeps every UTXO the contract owns into ONE reclaim output at `totalInputSats - fee`. A fee
    // 100 satoshis short of the whole balance is not exotic - it is what a contract holding barely more than
    // its own fee produces - and the existing `reclaimed <= 0n` throw is one satoshi wide, so it never fires.
    const d = await deploy();
    const state = await d.contract.getFullState();
    const masters = await d.provider.getUtxos(d.contract.inner.tokenAddress);
    const total = masters.reduce((s, u) => s + u.satoshis, 0n)
      + state.dataNftUtxos.reduce((s: bigint, u: Utxo) => s + u.satoshis, 0n);

    const message = await errorOf(() => StatefulContract.destroy({
      provider: d.provider,
      contract: d.contract,
      destroyFunctionName: 'wind',
      destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
      recipient: d.p2pkh.address,
      fee: total - 100n,
    }));
    expect(message).toMatch(/messageBus: finalized transaction refused by 1 byte rule\(s\)/);
    expect(message).toMatch(/\[policy\] output-dust at output 0/);
    expect(message).toMatch(
      /100 satoshis is 476 short of the 576-satoshi dust threshold for a 44-byte output \(3 \* \(44 \+ 148\)\)/,
    );
    expect(message).toMatch(/a node refuses `64: dust`/);
  }, 300_000);

  it('1b. GUARD: the identical destroy with 476 more satoshis of reclaim settles', async () => {
    // Differs from row 1 in the declared fee alone - same contract, same UTXO set, same recipient, same
    // function and arguments - so row 1 measures the dust floor and not some other property of a sweep.
    const d = await deploy();
    const state = await d.contract.getFullState();
    const masters = await d.provider.getUtxos(d.contract.inner.tokenAddress);
    const total = masters.reduce((s, u) => s + u.satoshis, 0n)
      + state.dataNftUtxos.reduce((s: bigint, u: Utxo) => s + u.satoshis, 0n);

    const result = await StatefulContract.destroy({
      provider: d.provider,
      contract: d.contract,
      destroyFunctionName: 'wind',
      destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
      recipient: d.p2pkh.address,
      fee: total - CHANGE_DUST,
    });
    expect(result.txs).toHaveLength(1);
    expect(result.totalReclaimed).toBe(CHANGE_DUST);
    const outputs = decodeTransactionUnsafe(hexToBin(result.txs[0].hex!)).outputs;
    expect(outputs[0].valueSatoshis).toBe(CHANGE_DUST);
  }, 300_000);

  it('1c. destroy decides EVERY prebuilt batch before broadcasting ANY of them', async () => {
    // THE ROW THAT HOLDS THE PLACEMENT. The batch path chains: each intermediate's master output is the next
    // batch's input, by locally computed txid. At `maxInputsPerTx: 2` the sweep is two transactions, and at a
    // 2,300-satoshi per-transaction fee the FIRST is admissible (its only output is the recreated master at
    // 1,200 against a 678-satoshi token-output floor) while the SECOND reclaims 100 against 576. A gate inside
    // the broadcast loop would therefore settle batch 0 and refuse batch 1, leaving the contract half-swept
    // with no path that both finishes and reports. The gate runs over every prebuilt transaction first.
    const d = await deploy();
    const before = await d.provider.getUtxos(d.contract.inner.tokenAddress);
    const state = await d.contract.getFullState();
    expect(state.dataNftUtxos.length, 'batch mode needs more inputs than maxInputsPerTx').toBe(2);

    const message = await errorOf(() => StatefulContract.destroy({
      provider: d.provider,
      contract: d.contract,
      destroyFunctionName: 'wind',
      destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
      recipient: d.p2pkh.address,
      fee: 2_300n,
      maxInputsPerTx: 2,
    }));
    expect(message).toMatch(/\[policy\] output-dust at output 0/);
    expect(message).toMatch(/100 satoshis is 476 short of the 576-satoshi dust threshold/);
    // NOTHING settled: the master is exactly where it was, so batch 0 never reached the network either.
    const after = await d.provider.getUtxos(d.contract.inner.tokenAddress);
    expect(after.map((u) => `${u.txid}:${u.vout}`).sort())
      .toEqual(before.map((u) => `${u.txid}:${u.vout}`).sort());
  }, 300_000);

  it('1d. GUARD: the identical batched destroy at 476 satoshis less fee settles BOTH batches', async () => {
    // Differs from row 1c in the per-transaction fee alone - same `maxInputsPerTx`, same contract, same UTXO
    // set - so row 1c measures the dust floor on batch 1 and not the batch machinery.
    const d = await deploy();
    const result = await StatefulContract.destroy({
      provider: d.provider,
      contract: d.contract,
      destroyFunctionName: 'wind',
      destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
      recipient: d.p2pkh.address,
      fee: 2_300n - 476n,
      maxInputsPerTx: 2,
    });
    expect(result.txs).toHaveLength(2);
    expect(result.totalReclaimed).toBe(CHANGE_DUST);
  }, 300_000);

  /* ---------------------------------------------------------------------------------------------------- */
  /* StatefulContract.split                                                                               */
  /* ---------------------------------------------------------------------------------------------------- */

  it('2. split REFUSES a below-dust change output, quoting the arithmetic', async () => {
    const d = await deploy();
    const message = await errorOf(() => staticSplit(d, 100n));
    expect(message).toMatch(/messageBus: finalized transaction refused by 1 byte rule\(s\)/);
    expect(message).toMatch(/\[policy\] output-dust at output 3/);
    expect(message).toMatch(
      /100 satoshis is 476 short of the 576-satoshi dust threshold for a 44-byte output \(3 \* \(44 \+ 148\)\)/,
    );
  }, 300_000);

  it('2b. GUARD: 476 more satoshis of funding on the identical split settles it', async () => {
    // Differs from row 2 in the funding UTXO's value alone. Same fee, same split count, same minting amount,
    // same change address - so the refusal in row 2 is about the change output's value and nothing else.
    const d = await deploy();
    const result = await staticSplit(d, CHANGE_DUST);
    const outputs = decodeTransactionUnsafe(hexToBin(result.tx.hex)).outputs;
    expect(outputs).toHaveLength(4);
    expect(outputs[3].valueSatoshis).toBe(CHANGE_DUST);
  }, 300_000);

  it('2c. THE MOCK ACCEPTS THE VERY BYTES THE GATE REFUSES, so the gate is the only objector', async () => {
    // The decisive control. `sc.call.fork(...).build()` returns the same builder the send path uses and carries
    // NO gate, so the identical transaction can be handed straight to the provider - which takes it. Without
    // this row a refusal is indistinguishable from a shape the mock was going to reject anyway, and only the
    // first kind is a defect the gate is fixing.
    //
    // It also measures the `.build()` hole exactly: a composer who builds and broadcasts by hand gets no
    // refusal at all. See `L4BuildRefusalScope.test.ts` for the decision that leaves it that way.
    const d = await deploy();
    const fee = 2_000n;
    const funding = await fund(d, 1_200n * 2n + fee + 100n);
    const builder = await d.contract.call
      .fork(2n, new SignatureTemplate(alicePriv))
      .withSplitFunding([funding], funder(d), d.p2pkh.address)
      .withNewMintingAmount(1_200n)
      .withSplitFee(fee)
      .build();
    const raw = builder.build();
    const decoded = decodeTransactionUnsafe(hexToBin(raw));
    expect(decoded.outputs[3].valueSatoshis, 'the same 100-satoshi change output').toBe(100n);
    await expect(d.provider.sendRawTransaction(raw)).resolves.toBeTypeOf('string');
  }, 300_000);

  /* ---------------------------------------------------------------------------------------------------- */
  /* StatefulContract.merge                                                                               */
  /* ---------------------------------------------------------------------------------------------------- */

  it('3. merge REFUSES a below-dust change output, quoting the arithmetic', async () => {
    const d = await deploy();
    await staticSplit(d, 40_000n);
    const minting = (await d.provider.getUtxos(d.contract.inner.tokenAddress)).filter(
      (u) => u.token?.category === d.contract.categoryId && u.token?.nft?.capability === 'minting',
    );
    const consumed = minting.slice(1);
    const consumedSats = consumed.reduce((s, u) => s + u.satoshis, 0n);
    const extra = await fund(d, 20_000n);

    const message = await errorOf(() => StatefulContract.merge({
      provider: d.provider,
      contract: d.contract,
      mergeFunctionName: 'consolidate',
      mergeFunctionArgs: [BigInt(consumed.length), new SignatureTemplate(alicePriv)],
      funder: funder(d),
      consumedMasterUtxos: consumed,
      fundingUtxos: [extra],
      changeAddress: d.p2pkh.address,
      fee: consumedSats + extra.satoshis - 100n,
      maxFee: 200_000n,
    }));
    expect(message).toMatch(/messageBus: finalized transaction refused by 1 byte rule\(s\)/);
    expect(message).toMatch(/\[policy\] output-dust at output 1/);
    expect(message).toMatch(
      /100 satoshis is 476 short of the 576-satoshi dust threshold for a 44-byte output \(3 \* \(44 \+ 148\)\)/,
    );
  }, 300_000);

  it('3b. GUARD: the identical merge with 476 more satoshis of change settles', async () => {
    // Differs from row 3 in the declared fee alone: same consumed masters, same funding UTXO, same count.
    const d = await deploy();
    await staticSplit(d, 40_000n);
    const minting = (await d.provider.getUtxos(d.contract.inner.tokenAddress)).filter(
      (u) => u.token?.category === d.contract.categoryId && u.token?.nft?.capability === 'minting',
    );
    const consumed = minting.slice(1);
    const consumedSats = consumed.reduce((s, u) => s + u.satoshis, 0n);
    const extra = await fund(d, 20_000n);

    const result = await StatefulContract.merge({
      provider: d.provider,
      contract: d.contract,
      mergeFunctionName: 'consolidate',
      mergeFunctionArgs: [BigInt(consumed.length), new SignatureTemplate(alicePriv)],
      funder: funder(d),
      consumedMasterUtxos: consumed,
      fundingUtxos: [extra],
      changeAddress: d.p2pkh.address,
      fee: consumedSats + extra.satoshis - CHANGE_DUST,
      maxFee: 200_000n,
    });
    const outputs = decodeTransactionUnsafe(hexToBin(result.tx.hex as string)).outputs;
    expect(outputs).toHaveLength(2);
    expect(outputs[1].valueSatoshis).toBe(CHANGE_DUST);
  }, 300_000);

  /* ---------------------------------------------------------------------------------------------------- */
  /* StatefulFunctionCall._sendRawBuilder                                                                  */
  /* ---------------------------------------------------------------------------------------------------- */

  it('4. _sendRawBuilder REFUSES a below-dust change on the `sc.call` split route', async () => {
    // A DIFFERENT SITE, not a second test of row 2. `sc.call.fork(...).send()` never reaches
    // `StatefulContract.split`: `_trySplitMergeBuild` builds its own builder and `_sendRawBuilder` broadcasts
    // it, which is why the probe attributed these to `StatefulContract.ts:11133` and not `:10105`.
    const d = await deploy();
    const fee = 2_000n;
    const funding = await fund(d, 1_200n * 2n + fee + 100n);
    const message = await errorOf(() => d.contract.call
      .fork(2n, new SignatureTemplate(alicePriv))
      .withSplitFunding([funding], funder(d), d.p2pkh.address)
      .withNewMintingAmount(1_200n)
      .withSplitFee(fee)
      .send());
    expect(message).toMatch(/messageBus: finalized transaction refused by 1 byte rule\(s\)/);
    expect(message).toMatch(/\[policy\] output-dust at output 3/);
    expect(message).toMatch(
      /100 satoshis is 476 short of the 576-satoshi dust threshold for a 44-byte output \(3 \* \(44 \+ 148\)\)/,
    );
  }, 300_000);

  it('4b. GUARD: 476 more satoshis of funding on the identical `sc.call` split settles', async () => {
    const d = await deploy();
    const fee = 2_000n;
    const funding = await fund(d, 1_200n * 2n + fee + CHANGE_DUST);
    const tx = await d.contract.call
      .fork(2n, new SignatureTemplate(alicePriv))
      .withSplitFunding([funding], funder(d), d.p2pkh.address)
      .withNewMintingAmount(1_200n)
      .withSplitFee(fee)
      .send();
    const outputs = decodeTransactionUnsafe(hexToBin(tx.hex as string)).outputs;
    expect(outputs).toHaveLength(4);
    expect(outputs[3].valueSatoshis).toBe(CHANGE_DUST);
  }, 300_000);

  it('4c. the fee-per-byte cap still speaks BEFORE the byte gate at this site', async () => {
    // Ordering inside the site. A missing or drained change output deserves a FEE diagnostic, not whichever
    // relay observation is also true of the same bytes, and it still gets one: the builder's own
    // `maximumFeeSatsPerByte` check fires inside `build()`, upstream of both `_sendRawBuilder`'s 1,000
    // sat/byte cap and the byte gate placed after it. A split whose entire funding goes to fee reaches it.
    const d = await deploy();
    const funding = await fund(d, 5_000_000n);
    const message = await errorOf(() => d.contract.call
      .fork(1n, new SignatureTemplate(alicePriv))
      .withSplitFunding([funding], funder(d), d.p2pkh.address)
      .withNewMintingAmount(1_200n)
      .withSplitFee(4_998_800n)
      .withMaxFee(10_000_000n)
      .send());
    expect(message).toMatch(/fee per byte of [0-9.]+ is higher than max fee per byte of 1000/);
    expect(message, 'the byte gate spoke before the fee cap').not.toMatch(/finalized transaction refused/);
  }, 300_000);

  /* ---------------------------------------------------------------------------------------------------- */
  /* X175. The ordering window these four sites had, and why it can no longer decide anything                */
  /* ---------------------------------------------------------------------------------------------------- */

  /**
   * THE SHAPE THAT MUST NOT RECUR. The seventh vacuous guard on this effort was a forgery test whose bare
   * `rejects.toThrow()` absorbed a new gate's dust error: it kept passing while its rejection was no longer the
   * forgery's. At these four sites that was reachable by construction, because nothing debugs ahead of the gate
   * and the byte rule spoke first.
   *
   * WHY THE ORDERING WAS NOT SIMPLY SWAPPED. The stated reason these sites bypass `debug()` - "the debug VM
   * cannot validate covenant scripts" - has expired in the half that matters: `TransactionBuilder.send` debugs a
   * covenant input on a best-effort basis and SWALLOWS the result (TransactionBuilder.ts:1131-1137), so calling
   * `debug()` here would have surfaced nothing. Running the covenant FIRST would also have closed one absorption
   * direction by opening the other: a dust test whose fixture also broke a covenant would then report the
   * covenant. Reporting BOTH is what makes the order irrelevant, and it is the only one of the three options
   * that leaves NO direction of absorption open.
   *
   * IT COSTS NOTHING A TRANSACTION USED TO GET. The covenant is consulted only when the bytes are already
   * refused, so nothing that settled can now fail, and a byte-only refusal keeps its message byte for byte -
   * rows 1 through 4 above are unchanged and are the evidence for that.
   *
   * THE ROW 5 THAT WAS HERE IS ITSELF THE LESSON. It asserted `not.toMatch(/checkSig|OP_/)` to claim the
   * covenant was masked, and it STILL PASSES against the combined message, because libauth phrases this
   * covenant's failure as `Program failed a signature verification ... "NULLFAIL" ... Schnorr` and names neither
   * token. A negative control matching on the wrong vocabulary is a guard that cannot see the thing it guards.
   */
  const HOSTILE_COVENANT = /\[covenant\] input 0: Program failed a signature verification/;
  const BOTH_REFUSED = /refused by its covenant and 1 byte rule\(s\)/;

  it('5. BOTH: a split that breaks its covenant AND pays dust reports the covenant AND the dust', async () => {
    // THE DEMONSTRATION. The signature is Bob's against Alice's admin key, so `require(checkSig(s, admin))`
    // fails, AND the change output pays 100 satoshis against 576. Rows 5b and 5c each differ from this one in a
    // single field, so each half of this message is attributable to the field that produced it.
    const d = await deploy();
    const hostile = await errorOf(() => staticSplit(d, 100n, bobPriv));
    expect(hostile).toMatch(BOTH_REFUSED);
    expect(hostile, 'the covenant objection is absorbed').toMatch(HOSTILE_COVENANT);
    expect(hostile, 'the byte objection is absorbed').toMatch(/\[policy\] output-dust at output 3/);
    expect(hostile).toMatch(
      /100 satoshis is 476 short of the 576-satoshi dust threshold for a 44-byte output \(3 \* \(44 \+ 148\)\)/,
    );
  }, 300_000);

  it('5b. GUARD: the same split with a VALID signature reports the dust and no covenant line', async () => {
    // Differs from row 5 in the signing key alone - same funding, same change, same fee, same count - so the
    // covenant line in row 5 is attributable to the signature and to nothing else about that shape.
    const d = await deploy();
    const dustOnly = await errorOf(() => staticSplit(d, 100n, alicePriv));
    expect(dustOnly).toMatch(/^messageBus: finalized transaction refused by 1 byte rule\(s\)/);
    expect(dustOnly, 'a covenant objection appeared without a broken covenant').not.toMatch(/\[covenant\]/);
    expect(dustOnly).toMatch(/\[policy\] output-dust at output 3/);
  }, 300_000);

  it('5c. GUARD: the same broken covenant with a relayable change reports the covenant and no byte line',
    async () => {
      // Differs from row 5 in the change amount alone. The bytes clear the gate, so the PROVIDER's own
      // evaluation is what speaks - and it produces the same sentence the gate quoted in row 5, at the same
      // input index. That is what makes row 5's covenant line evidence rather than a string the SDK invented.
      const d = await deploy();
      const covenant = await errorOf(() => staticSplit(d, CHANGE_DUST, bobPriv));
      expect(covenant, 'the byte gate spoke instead of the covenant').not.toMatch(/finalized transaction refused/);
      expect(covenant).toMatch(/evaluating input index 0: Program failed a signature verification/);
      expect(covenant).toMatch(/"NULLFAIL"/);
    }, 300_000);

  it('5d. the gate quotes the DECIDER, not a string of its own: same sentence, same input index', async () => {
    // The two runs differ in the change amount alone, so the covenant is identical. One sentence is produced
    // locally by `covenantObjectionOf` and reported inside the gate's refusal; the other is produced by the
    // provider on the wire. They agree verbatim, which is the discriminating evidence that the local
    // evaluation is the same decider the network would have used and not a second opinion.
    const gatedDeployment = await deploy();
    const wireDeployment = await deploy();
    const gated = await errorOf(() => staticSplit(gatedDeployment, 100n, bobPriv));
    const wire = await errorOf(() => staticSplit(wireDeployment, CHANGE_DUST, bobPriv));
    // The WHOLE sentence, not a prefix: a prefix match would still pass if the two deciders diverged in the
    // algorithm or the rule they name.
    const sentence = new RegExp('Program failed a signature verification with a non-null signature '
      + '\\(violating the "NULLFAIL" rule\\)\\. Algorithm used: Schnorr\\.');
    expect(gated).toMatch(sentence);
    expect(wire).toMatch(sentence);
    expect(gated).toMatch(/\[covenant\] input 0:/);
    expect(wire).toMatch(/evaluating input index 0:/);
  }, 300_000);

  it('5e. ALL FOUR SITES: a hostile that breaks a covenant and pays dust is attributable at every one',
    async () => {
      // ONE SITE PROVING IT IS NOT FOUR SITES PROVING IT. `_sendRawBuilder` is a different frame from the static
      // `split`, and destroy and merge compute their payouts from different arithmetic; a fix applied at one
      // could silently miss the others. Each row here is a hostile with a broken signature AND a below-dust
      // payout, and each must name both.
      const sites: Array<[string, () => Promise<unknown>, RegExp]> = [];

      const splitDeployment = await deploy();
      sites.push(['split', () => staticSplit(splitDeployment, 100n, bobPriv), /output-dust at output 3/]);

      const rawDeployment = await deploy();
      const rawFunding = await fund(rawDeployment, 1_200n * 2n + 2_000n + 100n);
      sites.push(['_sendRawBuilder', () => rawDeployment.contract.call
        .fork(2n, new SignatureTemplate(bobPriv))
        .withSplitFunding([rawFunding], funder(rawDeployment), rawDeployment.p2pkh.address)
        .withNewMintingAmount(1_200n)
        .withSplitFee(2_000n)
        .send(), /output-dust at output 3/]);

      const destroyDeployment = await deploy();
      const destroyState = await destroyDeployment.contract.getFullState();
      const destroyMasters = await destroyDeployment.provider.getUtxos(
        destroyDeployment.contract.inner.tokenAddress,
      );
      const destroyTotal = destroyMasters.reduce((s, u) => s + u.satoshis, 0n)
        + destroyState.dataNftUtxos.reduce((s: bigint, u: Utxo) => s + u.satoshis, 0n);
      sites.push(['destroy', () => StatefulContract.destroy({
        provider: destroyDeployment.provider,
        contract: destroyDeployment.contract,
        destroyFunctionName: 'wind',
        destroyFunctionArgs: [new SignatureTemplate(bobPriv)],
        recipient: destroyDeployment.p2pkh.address,
        fee: destroyTotal - 100n,
      }), /output-dust at output 0/]);

      const mergeDeployment = await deploy();
      await staticSplit(mergeDeployment, 40_000n);
      const mergeMinting = (await mergeDeployment.provider.getUtxos(
        mergeDeployment.contract.inner.tokenAddress,
      )).filter((u) => u.token?.category === mergeDeployment.contract.categoryId
        && u.token?.nft?.capability === 'minting');
      const mergeConsumed = mergeMinting.slice(1);
      const mergeConsumedSats = mergeConsumed.reduce((s, u) => s + u.satoshis, 0n);
      const mergeExtra = await fund(mergeDeployment, 20_000n);
      sites.push(['merge', () => StatefulContract.merge({
        provider: mergeDeployment.provider,
        contract: mergeDeployment.contract,
        mergeFunctionName: 'consolidate',
        mergeFunctionArgs: [BigInt(mergeConsumed.length), new SignatureTemplate(bobPriv)],
        funder: funder(mergeDeployment),
        consumedMasterUtxos: mergeConsumed,
        fundingUtxos: [mergeExtra],
        changeAddress: mergeDeployment.p2pkh.address,
        fee: mergeConsumedSats + mergeExtra.satoshis - 100n,
        maxFee: 200_000n,
      }), /output-dust at output 1/]);

      for (const [site, run, dustRule] of sites) {
        const message = await errorOf(run);
        expect(message, `${site}: neither objection reported`).toMatch(BOTH_REFUSED);
        expect(message, `${site}: the covenant objection is absorbed`).toMatch(HOSTILE_COVENANT);
        expect(message, `${site}: the byte objection is absorbed`).toMatch(dustRule);
      }
    }, 300_000);

  it('5f. the four sites route through the shared helper, which no longer lives in this file', () => {
    // X186 MOVED THE MECHANISM AND THE FULL STRUCTURAL ROW WITH IT. `covenantObjectionOf` and the routed gate
    // (now `assertFinalizedBytesWithCovenant`) live in `message-bus/preflight.ts` because `TransactionBuilder.send`
    // became their second caller, and the per-file call counts are asserted in
    // `X186SendCovenantAbsorption.test.ts` row 5b. What stays here is the half whose subject is these four
    // sites: they route, and none of them calls the bare gate.
    const source = readFileSync(fileURLToPath(new URL('../../src/stateful/StatefulContract.ts', import.meta.url)),
      'utf8');
    const call = (name: string): string[] => source.split('\n')
      .filter((line) => new RegExp(`${name}\\(`).test(line) && !/^\s*[*/]/.test(line)
        && !/^import|^\s{2}\w+,?$/.test(line));
    expect(call('assertFinalizedBytesWithCovenant'), 'routed sites').toHaveLength(4);
    expect(call('assertFinalizedTransactionBytes'), 'bare gate calls').toHaveLength(0);
    expect(source).toMatch(
      /import \{[\s\S]*?assertFinalizedBytesWithCovenant[\s\S]*?\} from '\.\.\/message-bus\/preflight\.js'/,
    );
  });

  /* ---------------------------------------------------------------------------------------------------- */
  /* The eighth site                                                                                        */
  /* ---------------------------------------------------------------------------------------------------- */

  it('6. every LIVE broadcast site in `src/` is gated, and the dead one no longer exists', async () => {
    // A guard on dead code cannot fire on its own subject, so `_sendBuilderWithCustomUnlockers` was never a
    // candidate for gating - it was a candidate for deletion, and this row is what keeps it deleted and keeps
    // a NEW ungated site from appearing quietly. Scanning the source is the only way to see a site that no
    // test happens to reach; that is exactly how this one stayed invisible.
    const root = fileURLToPath(new URL('../../src/', import.meta.url));
    const files = [
      'TransactionBuilder.ts', 'message-bus/preflight.ts',
      'stateful/StatefulContract.ts', 'stateful/StatefulTransactionBuilder.ts',
    ];
    const callSites: string[] = [];
    for (const file of files) {
      const text = readFileSync(`${root}${file}`, 'utf8');
      expect(text, 'the dead site is deleted').not.toMatch(/async _sendBuilderWithCustomUnlockers/);
      text.split('\n').forEach((line, index) => {
        if (/\.sendRawTransaction\(/.test(line) && !/^\s*\*/.test(line)) {
          callSites.push(`${file}:${index + 1}`);
        }
      });
    }
    // Seven live sites, one per gated path. A new entry here is a new broadcast path that must be gated
    // before this list is updated.
    expect(callSites).toHaveLength(7);
    expect(callSites.filter((site) => site.startsWith('stateful/StatefulContract.ts'))).toHaveLength(4);
  });
});
