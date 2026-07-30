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
 * THE GATE IS STRICTER THAN A RELAXED MOCK, BY CONSTRUCTION, and row 2 pins it rather than leaving it latent.
 * `addOutput` already refuses a below-dust output whenever `policy.enforceDust` is true, so the dust rule here
 * is only ever REACHED on a provider that declared it does not enforce dust - and that provider's decider then
 * accepts the same bytes. The rules are BCHN's, not the mock's: 474 satoshis is the threshold a live BCHN
 * regtest used to refuse capstone C1 with `64: dust`, and it is the same number the SDK's own
 * `calculateDust` (444 + 3 x output bytes) produces. This site therefore behaves exactly like the two already
 * gated ones; whether a relaxed mock should suppress the policy half is a decision for the gate, not for one
 * call site to take unilaterally.
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

  it('2. DISCLOSURE: on a relaxed mock the gate is stricter than the provider it is in front of', async () => {
    // `addOutput` refuses a below-dust output whenever `policy.enforceDust` is true, so the dust rule at this
    // site is only ever reachable on a provider that declared it does not enforce dust - and that provider's
    // decider accepts the very bytes the gate refused. Pinned so the asymmetry is visible rather than latent.
    const provider = dustProvider();
    const builder = await p2pkhBuilder(provider, 100n);
    expect(await sendError(builder)).toMatch(/output-dust/);
    // The same bytes, handed straight to the same provider, settle.
    await expect(provider.sendRawTransaction(builder.build())).resolves.toBeTypeOf('string');

    // And on a dust-ENFORCING provider the transaction never reaches `send()`: `addOutput` refuses it, naming
    // the same 474. That is the sense in which the gate refuses no more than a node does.
    const strict = new MockNetworkProvider({ policy: { enforceDust: true } });
    const contract = new Contract(p2pkhArtifact, [alicePkh], { provider: strict });
    const utxo = randomUtxo({ satoshis: 20_000n });
    await strict.addUtxo(contract.address, utxo);
    const strictBuilder = new TransactionBuilder({ provider: strict });
    strictBuilder.addInput(utxo, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    expect(() => strictBuilder.addOutput({ to: OP_TRUE_LOCKING, amount: 100n })).toThrow(/474/);
  });

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
