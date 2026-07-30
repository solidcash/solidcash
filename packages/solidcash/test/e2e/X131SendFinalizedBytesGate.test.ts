import { binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
  Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { alicePkh, alicePriv, alicePub, bobPub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X131 - the finalized-bytes gate at `TransactionBuilder.send()`, site 2 of 8.
 *
 * WHY THIS SITE. `layer3-gatesite-probe.ts` measured every broadcast the SDK e2e population makes and
 * attributed each to its `src/` frame: this site carries 1,170 sends across 1,030 tests, 1,159 of which the
 * provider accepted, and the byte rules refuse NONE of them. It is the largest ungated site by an order of
 * magnitude, and 14 of the 100 `Layer3*` e2e files broadcast through it, so gating it closes the non-stateful
 * half of Layer-3 broadcasting.
 *
 * THE OBSERVER FIGURE ABOVE IS PRE-GATE, which is the only time it is worth anything: once a site is gated a
 * refused send never reaches the provider, so an observer wrapped around the provider stops seeing exactly the
 * transactions in question. The non-circular figure is a THROW CENSUS - instrument `send()` itself, record
 * every throw with its calling frame, and diff against the same run before the gate. Run over the whole e2e
 * population with the gate applied, it found ZERO sends that newly throw and zero whose message changed.
 * `test/e2e/layer3-throw-census.ts` is the instrument.
 *
 * IT SPEAKS AFTER `debug()`, and row 3 is what holds that. At a gated site the byte gate otherwise speaks
 * BEFORE the covenant, and a hostile test that pays dust and matches loosely then reports the gate's refusal
 * instead of its own - that is how the seventh vacuous guard on this effort was made. Placing the call after
 * `debug()` keeps every script-level diagnostic first for a standard non-covenant transaction.
 *
 * ONE RESIDUAL WINDOW, disclosed rather than papered over: for a COVENANT input `send()` debugs on a
 * best-effort basis and swallows the result, and for a custom unlocker it does not debug at all. On those two
 * paths the gate does speak before the provider's own verdict. The census found no test in the population
 * where that changes a message, but the window is real - rows 4 and 4b are themselves on the custom-unlocker
 * path and reach the gate with no `debug()` ahead of them.
 *
 * X157 IS DECIDED, AND "THE GATE IS STRICTER THAN THE PROVIDER" IS THE WRONG READING. Rows 2 and 2b are the
 * measurement that settles it. The claim handed over was that `addOutput` admits a below-dust output when
 * `policy.enforceDust` is false - the mock default - so the dust rule is only ever reachable on a provider
 * whose decider then accepts the same bytes, which reads as the gate refusing more than the network does. It
 * is not. The gate is stricter than the SWITCH, not than the provider:
 *
 *   satoshis   gate                     mock `enforceDust:false`   mock `enforceDust:true`
 *   100        REFUSE (374 short)       accept                     refuse `dust`
 *   472        REFUSE (2 short)         accept                     refuse `dust`
 *   473        REFUSE (1 short)         accept                     refuse `dust`
 *   474        ADMIT                    accept                     accept
 *
 * The SAME in-repo decider agrees with the gate TO THE SATOSHI the moment it is asked to model relay policy.
 * `enforceDust: false` does not describe a laxer node: it sets `standard: false` and `dustRelayFeePerKb: 0n`
 * on the verifier, which is a harness that does not model relay policy at all.
 *
 * AND THE FIELD NAMES NO NETWORK. `MockNetworkProvider` is the only provider in `src/network/` that publishes
 * `policy`; Electrum, FullStack, BitcoinRpc and Regtest all leave it undefined, so `enforceDust` resolves true
 * on every real network. Wiring `provider.policy` into the gate would soften it on exactly one provider - the
 * test harness - and never on a network, which is how the dust rule came to be present, correct and switched
 * off while C1 was refused `64: dust` at this same 474 on a live BCHN regtest.
 *
 * THE `standard-output-template` PRECEDENT DOES NOT TRANSFER. That rule was deleted because a real BCHN v29
 * node, started with an explicit `-acceptnonstdtxn=0`, ACCEPTED the shape. The principle it established - a
 * gate refusing more than the NODE does is wrong, not conservative - is about the node, and the node refuses
 * these. Nor is any number in dispute: `calculateDust` (444 + 3 x output bytes) and the gate's
 * `finalizedOutputDustThreshold` (3 x (bytes + 148)) are the same arithmetic.
 *
 * SO THE GATE STAYS PROVIDER-BLIND, and row 2b is the behavioural pin: the identical bytes reach the identical
 * refusal under both policies. Only the caller's explicit `allowNonRelayable` may suppress a policy refusal.
 *
 * NOT A SECURITY BOUNDARY. The SDK is an untrusted witness constructor; this is a correctness aid that saves a
 * round trip and a confusing node error. Nothing here constrains an attacker, who does not call `send()`.
 */

const dustProvider = (): MockNetworkProvider => new MockNetworkProvider({ policy: { enforceDust: false } });

/** `OP_1`: a one-byte locking script, so its serialized output is 10 bytes and its dust threshold is exact. */
const OP_TRUE_LOCKING = Uint8Array.from([0x51]);

async function p2pkhBuilder(
  provider: MockNetworkProvider, recipientAmount: bigint, publicKey: Uint8Array = alicePub,
): Promise<TransactionBuilder> {
  const contract = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const utxo = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(contract.address, utxo);
  const builder = new TransactionBuilder({ provider });
  builder.addInput(utxo, contract.unlock.spend(publicKey, new SignatureTemplate(alicePriv)));
  builder.addOutput({ to: OP_TRUE_LOCKING, amount: recipientAmount });
  builder.addOutput({ to: contract.address, amount: 15_000n });
  return builder;
}

/** One input whose unlocking bytecode is `pushBytes + 3` bytes long, spending an `OP_TRUE` output. */
async function oversizedInputBuilder(
  provider: MockNetworkProvider, pushBytes: number,
): Promise<TransactionBuilder> {
  const locking = Uint8Array.from([0x51]);
  const utxo = randomUtxo({ satoshis: 2_000_000n });
  await provider.addUtxo(binToHex(locking), utxo);
  const unlock = new Uint8Array(3 + pushBytes);
  unlock[0] = 0x4d; // OP_PUSHDATA2, the minimal encoding at these sizes
  new DataView(unlock.buffer).setUint16(1, pushBytes, true);
  const builder = new TransactionBuilder({ provider });
  builder.addInput(utxo, {
    generateUnlockingBytecode: () => unlock, generateLockingBytecode: () => locking,
  } as never);
  builder.addOutput({
    to: new Contract(p2pkhArtifact, [alicePkh], { provider }).address, amount: 500_000n,
  });
  return builder;
}

const sendError = async (builder: TransactionBuilder): Promise<string> => {
  try { await builder.send(); return ''; } catch (error) { return (error as Error).message; }
};

describe('X131 - TransactionBuilder.send() decides its finalized bytes', () => {
  it('1. REFUSES a below-dust output, quoting the arithmetic that produced the threshold', async () => {
    // 3 * (10 + 148) = 474 satoshis for a 10-byte serialized output. The message names every term, so this
    // cannot pass against an unrelated refusal.
    const message = await sendError(await p2pkhBuilder(dustProvider(), 100n));
    expect(message).toMatch(/layer3: finalized transaction refused by 1 byte rule\(s\)/);
    expect(message).toMatch(/\[policy\] output-dust at output 0/);
    expect(message).toMatch(
      /100 satoshis is 374 short of the 474-satoshi dust threshold for a 10-byte output \(3 \* \(10 \+ 148\)\)/,
    );
  });

  it('1b. GUARD: raising ONLY the attacked amount to the threshold settles the identical transaction', async () => {
    // Differs from row 1 in the first output's satoshi value alone - same inputs, same scripts, same second
    // output - so row 1 cannot be passing because this shape fails for some other reason.
    await expect((await p2pkhBuilder(dustProvider(), 474n)).send()).resolves.toBeDefined();
  });

  it('2. X157 DECIDED: the gate is stricter than the SWITCH, not than the provider', async () => {
    // THE DISCRIMINATING MEASUREMENT. The same bytes are offered to two mocks that differ in one field, and
    // the one that models relay policy agrees with the gate at every value including both sides of the
    // boundary. "The provider accepts them" is a property of `enforceDust: false`, not of the provider.
    for (const [amount, policyVerdict] of [[100n, 'refuse'], [472n, 'refuse'], [473n, 'refuse'],
      [474n, 'accept'], [475n, 'accept']] as const) {
      const lenient = dustProvider();
      const builder = await p2pkhBuilder(lenient, amount);
      const raw = builder.build();
      const gateRefusal = await sendError(builder);
      // The gate's own verdict at this value.
      if (policyVerdict === 'refuse') expect(gateRefusal, `gate at ${amount}`).toMatch(/output-dust/);
      else expect(gateRefusal, `gate at ${amount}`).toBe('');

      // The lenient decider takes every one of them - including the three the gate refused.
      const spare = dustProvider();
      const contract = new Contract(p2pkhArtifact, [alicePkh], { provider: spare });
      await spare.addUtxo(contract.address, builder.inputs[0]);
      await expect(spare.sendRawTransaction(raw), `lenient at ${amount}`).resolves.toBeTypeOf('string');

      // The SAME decider told to model relay policy refuses exactly the set the gate refused, to the satoshi.
      const strict = new MockNetworkProvider({ policy: { enforceDust: true } });
      await strict.addUtxo(new Contract(p2pkhArtifact, [alicePkh], { provider: strict }).address,
        builder.inputs[0]);
      const send = strict.sendRawTransaction(raw);
      if (policyVerdict === 'refuse') await expect(send, `policy at ${amount}`).rejects.toThrow(/dust/);
      else await expect(send, `policy at ${amount}`).resolves.toBeTypeOf('string');
    }
  }, 120_000);

  it('2b. the gate never reads `provider.policy`: identical bytes, identical refusal under both', async () => {
    // THE BEHAVIOURAL HALF OF THE DECISION, and the row that goes red if a future caller ever derives
    // `allowNonRelayable` from `provider.policy` - the strict run would keep refusing while the lenient one
    // stopped, so the two messages would stop matching.
    //
    // The shape is chosen so the gate is the only thing that can speak on either provider. A custom unlocker
    // means `send()` does not `debug()`, and pushing the output onto `builder.outputs` bypasses the
    // policy-aware `addOutput`, which would otherwise refuse on the strict provider before `send()` is
    // reached. Nothing else differs between the two runs.
    const messages: string[] = [];
    for (const enforceDust of [false, true]) {
      const provider = new MockNetworkProvider({ policy: { enforceDust } });
      const locking = Uint8Array.from([0x51]);
      const utxo = { ...randomUtxo({ satoshis: 20_000n }), txid: '31'.repeat(32), vout: 0 };
      await provider.addUtxo(binToHex(locking), utxo);
      const builder = new TransactionBuilder({ provider });
      builder.addInput(utxo, {
        generateUnlockingBytecode: () => new Uint8Array(), generateLockingBytecode: () => locking,
      } as never);
      builder.outputs.push({ to: OP_TRUE_LOCKING, amount: 100n });
      builder.addOutput({ to: OP_TRUE_LOCKING, amount: 15_000n });
      messages.push(await sendError(builder));
    }
    expect(messages[0]).toMatch(/100 satoshis is 374 short of the 474-satoshi dust threshold/);
    expect(messages[1]).toBe(messages[0]);
  }, 120_000);

  it('2c. THREE deciders, one number: the SDK is not offering a second opinion about 474', async () => {
    // `addOutput` refuses at construction, and on a dust-enforcing provider the provider's OWN standard-
    // transaction verifier refuses before the gate is even reached. Both name 474, the value the gate's
    // `finalizedOutputDustThreshold` produces and the value BCHN used to refuse C1 `64: dust`.
    const strict = new MockNetworkProvider({ policy: { enforceDust: true } });
    const contract = new Contract(p2pkhArtifact, [alicePkh], { provider: strict });
    const utxo = randomUtxo({ satoshis: 20_000n });
    await strict.addUtxo(contract.address, utxo);
    const builder = new TransactionBuilder({ provider: strict });
    builder.addInput(utxo, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    // Decider 1: construction time.
    expect(() => builder.addOutput({ to: OP_TRUE_LOCKING, amount: 100n })).toThrow(/474/);
    // Decider 2: the provider's own standard-transaction check, reached by placing the output without
    // `addOutput`. It speaks BEFORE the gate here, which is exactly what "the mock is the lenient one" means:
    // told to model relay policy, it refuses these bytes on its own.
    builder.outputs.push({ to: OP_TRUE_LOCKING, amount: 100n });
    builder.addOutput({ to: contract.address, amount: 15_000n });
    expect(await sendError(builder)).toMatch(
      /standard transactions may not have dust outputs.*at least 474 satoshis. Current value: 100/,
    );
  }, 120_000);

  it('3. ORDERING: a failing require still reports itself, not the byte rule it also breaks', async () => {
    // THE ANTI-VACUITY CONTROL. This transaction breaks BOTH: the P2PKH require fails because `bobPub` does not
    // hash to `alicePkh`, AND output 0 pays 100 satoshis against a 474-satoshi threshold. `debug()` runs first,
    // so the script-level cause is what surfaces. If this ever reports `output-dust`, every hostile send test
    // that pays dust has silently become a test of the byte gate instead.
    const message = await sendError(await p2pkhBuilder(dustProvider(), 100n, bobPub));
    expect(message).not.toBe('');
    expect(message, 'the byte gate spoke before the covenant').not.toMatch(/output-dust/);
    expect(message).toMatch(/P2PKH\.scash/);
  });

  it('3b. GUARD: the same spend with the right key and a non-dust amount settles', async () => {
    // Differs from row 3 in the public key and the attacked amount only, so row 3 is not passing because this
    // fixture cannot settle at all.
    await expect((await p2pkhBuilder(dustProvider(), 474n, alicePub)).send()).resolves.toBeDefined();
  });

  it('4. a CONSENSUS refusal names the per-input script limit and its arithmetic', async () => {
    // Consensus refusals are the half `allowNonRelayable` can never suppress. 12,003 unlocking bytes is 2,003
    // over the 10,000-byte per-input ceiling, and the message says exactly that. This input has a custom
    // unlocker, so `send()` does not debug it and the gate is the first thing that speaks.
    const message = await sendError(await oversizedInputBuilder(dustProvider(), 12_000));
    expect(message).toMatch(/\[consensus\] consensus-unlocking-bytes at input 0/);
    expect(message).toMatch(/12003 unlocking bytecode bytes is 2003 over the 10000-byte per-input script limit/);
  });

  it('4b. GUARD: 9,963 bytes on the identical shape clears the gate and reaches the provider', async () => {
    // Differs from row 4 only in the push length, so row 4 measures the 10,000-byte ceiling and not the shape.
    // The provider then refuses it for the synthetic script's own leftover stack item, which is what proves
    // the bytes got past the gate rather than being admitted by accident.
    const message = await sendError(await oversizedInputBuilder(dustProvider(), 9_960));
    expect(message).not.toMatch(/consensus-unlocking-bytes/);
    expect(message).toMatch(/unexpected number of items on the stack/);
  });
});
