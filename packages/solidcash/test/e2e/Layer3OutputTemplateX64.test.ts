import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { createTestProvider } from '../test-util.js';

/**
 * X64. IS A BARE `OP_1` OUTPUT ACTUALLY NON-STANDARD? Measured against BCHN v29.0.0, not assumed.
 *
 * WHY IT MATTERS. The production envelope's rule set carried `standard-output-template` as
 * `UNMEASURED_CONSERVATIVE` - the one rule of twelve that no node had ever confirmed. It is not a rule about
 * an exotic corner: eighteen e2e fixtures build a bare `OP_1` output. At 10 satoshis the DUST rule refuses
 * them anyway (that is X60, fixed separately). At 1,000 satoshis dust does not apply and this rule was the
 * only thing refusing them, so one unmeasured rule decided whether C2 and the E1 result graph were inside the
 * envelope at all. Guessing either way would have moved two working shapes on no evidence.
 *
 * THE METHOD, and why a `missing-inputs` verdict is worth anything here. X49 established that BCHN applies
 * standard policy BEFORE it looks up whether the inputs exist, so bytes whose outpoints exist on no chain
 * still get the node's truthful policy verdict. This file does not take that on trust for the OUTPUT rules:
 * two controls below are output-side refusals (`dust`, `oversize-op-return`) that fire on transactions
 * spending the same nonexistent outpoint, and `dust` fires on the very same one-byte `OP_1` script the probe
 * uses, only at a lower value. So the per-output policy loop demonstrably RUNS, and demonstrably REACHES this
 * script. `missing-inputs` on the 1,000-satoshi version therefore means the loop reached it and did not
 * refuse it.
 *
 * THE RESULT: the rule is WRONG. BCHN v29 does not enforce an output-script template.
 *
 *   probe                                        verdict
 *   bare OP_1, 1,000 satoshis                    missing-inputs        <- passed every policy rule
 *   bare OP_1, 10 satoshis                       64: dust              <- same script, refused on VALUE only
 *   `OP_2 OP_3 OP_ADD OP_5 OP_EQUAL`, 1,000 sat  missing-inputs        <- an arbitrary script passes too
 *   two P2PKH outputs                            missing-inputs        <- baseline
 *   OP_RETURN carrying 300 bytes                 64: oversize-op-return
 *   two OP_RETURN outputs                        missing-inputs        <- multi-OP_RETURN not enforced
 *   non-push-only scriptSig                      64: scriptsig-not-pushonly
 *
 * THE PERMISSIVE-DEFAULT OBJECTION, ruled out by measurement rather than by argument. On regtest BCHN's
 * `-acceptnonstdtxn` default could in principle disable `IsStandardTx` entirely, which would make every
 * `missing-inputs` above meaningless. Two independent facts rule that out. First, on the shared node three
 * `IsStandardTx` reasons DO fire (`dust`, `oversize-op-return`, `scriptsig-not-pushonly`), so the function is
 * running. Second, the whole table was re-run against a throwaway `mainnet/bitcoin-cash-node:v29.0.0`
 * container started with an explicit `-acceptnonstdtxn=0` and reproduced row for row. Point this suite at
 * such a node with `X64_STRICT_RPC_URL` to repeat that cross-check:
 *
 *   docker run -d --name x64-probe -p 18453:18443 mainnet/bitcoin-cash-node:v29.0.0 bitcoind -regtest \
 *     -server=1 -rpcuser=user -rpcpassword=password -rpcallowip=0.0.0.0/0 -rpcbind=0.0.0.0 \
 *     -acceptnonstdtxn=0 -upgrade12activationtime=1762596456
 *   X64_STRICT_RPC_URL=http://localhost:18453 TESTS_USE_REGTEST=true yarn vitest run \
 *     test/e2e/Layer3OutputTemplateX64.test.ts
 *
 * AND THE STRONGEST FORM, which is not a policy verdict on unspendable bytes at all: the last test funds a
 * real 1,000-satoshi bare `OP_1` output through the node, so the node accepts and mines a transaction that
 * CREATES one. On the strict `-acceptnonstdtxn=0` container that output was then redeemed with an empty
 * unlocking script and the spend was accepted too, which is the end of the question.
 *
 * Requires the docker regtest stack; see the root CLAUDE.md.
 */

const RPC_URL = process.env.REGTEST_RPC_URL ?? 'http://localhost:18443';
const RPC_USER = process.env.REGTEST_RPC_USER ?? 'user';
const RPC_PASSWORD = process.env.REGTEST_RPC_PASSWORD ?? 'password';
/** Optionally repeat every measurement against a node started with an explicit `-acceptnonstdtxn=0`. */
const STRICT_RPC_URL = process.env.X64_STRICT_RPC_URL;

async function rpc(url: string, method: string, params: unknown[]): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain;',
      authorization: `Basic ${Buffer.from(`${RPC_USER}:${RPC_PASSWORD}`).toString('base64')}`,
    },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'x64', method, params }),
  });
  return response.json();
}

const varInt = (value: number): number[] => {
  if (value < 0xfd) return [value];
  if (value <= 0xffff) return [0xfd, value & 0xff, (value >> 8) & 0xff];
  return [0xfe, value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
};

const littleEndian64 = (value: number): number[] =>
  Array.from({ length: 8 }, (_, index) => Math.floor(value / 2 ** (8 * index)) & 0xff);

/**
 * One transaction spending an outpoint that exists on no chain, carrying the given outputs.
 *
 * Every case pads with a standard 1,000-satoshi P2PKH output for two reasons that would otherwise confound
 * the reading: BCHN refuses any transaction under 65 bytes as `bad-txns-undersize`, which is a CONSENSUS rule
 * and masked the first attempt at this measurement outright; and the padding output is itself well above every
 * dust threshold, so it can never be the thing refused.
 */
function transaction(
  outputs: readonly { satoshis: number; script: number[] }[], unlockingBytecode: number[] = [],
): Uint8Array {
  const bytes: number[] = [2, 0, 0, 0, ...varInt(1)];
  for (let index = 0; index < 32; index += 1) bytes.push(0x11);
  bytes.push(0, 0, 0, 0, ...varInt(unlockingBytecode.length), ...unlockingBytecode, 0xff, 0xff, 0xff, 0xff);
  bytes.push(...varInt(outputs.length));
  for (const output of outputs) {
    bytes.push(...littleEndian64(output.satoshis), ...varInt(output.script.length), ...output.script);
  }
  bytes.push(0, 0, 0, 0);
  return Uint8Array.from(bytes);
}

const P2PKH = [0x76, 0xa9, 0x14, ...Array.from({ length: 20 }, () => 0x22), 0x88, 0xac];
const PADDING = { satoshis: 1000, script: P2PKH };
/** The script under test: `OP_1`. One byte, leaves true on the stack, matches no output template. */
const BARE_OP_1 = [0x51];
/** `OP_2 OP_3 OP_ADD OP_5 OP_EQUAL`: a valid locking script that is not any template either. */
const ARBITRARY = [0x52, 0x53, 0x93, 0x55, 0x87];
const opReturn = (payloadBytes: number): number[] => [
  0x6a, 0x4d, payloadBytes & 0xff, (payloadBytes >> 8) & 0xff,
  ...Array.from({ length: payloadBytes }, () => 0),
];

async function verdict(url: string, raw: Uint8Array): Promise<string> {
  const reply = await rpc(url, 'testmempoolaccept', [[binToHex(raw)]]);
  const result = reply.result?.[0];
  if (result === undefined) throw new Error(`node error: ${JSON.stringify(reply.error)}`);
  return result.allowed === true ? 'ALLOWED' : String(result['reject-reason']);
}

/** Every probe, so the shared node and the strict node are asked exactly the same questions. */
const PROBES = {
  'bare OP_1 at 1,000 satoshis': transaction([{ satoshis: 1000, script: BARE_OP_1 }, PADDING]),
  'bare OP_1 at 10 satoshis': transaction([{ satoshis: 10, script: BARE_OP_1 }, PADDING]),
  'an arbitrary script at 1,000 satoshis': transaction([{ satoshis: 1000, script: ARBITRARY }, PADDING]),
  'two P2PKH outputs': transaction([PADDING, PADDING]),
  'an OP_RETURN carrying 300 bytes': transaction([{ satoshis: 0, script: opReturn(300) }, PADDING]),
  'two OP_RETURN outputs': transaction([
    { satoshis: 0, script: opReturn(2) }, { satoshis: 0, script: opReturn(2) }, PADDING,
  ]),
  'a non-push-only scriptSig': transaction([PADDING, PADDING], [0x51, 0x93]),
} as const;

/** What BCHN v29.0.0 answers, measured on both the shared node and an `-acceptnonstdtxn=0` node. */
const MEASURED: Record<keyof typeof PROBES, string> = {
  'bare OP_1 at 1,000 satoshis': 'missing-inputs',
  'bare OP_1 at 10 satoshis': '64: dust',
  'an arbitrary script at 1,000 satoshis': 'missing-inputs',
  'two P2PKH outputs': 'missing-inputs',
  'an OP_RETURN carrying 300 bytes': '64: oversize-op-return',
  'two OP_RETURN outputs': 'missing-inputs',
  'a non-push-only scriptSig': '64: scriptsig-not-pushonly',
};

describe.runIf(process.env.TESTS_USE_REGTEST)('X64: which output templates BCHN actually enforces', () => {
  it('the node is the BCH-2026 regtest node these measurements assume', async () => {
    const info = (await rpc(RPC_URL, 'getblockchaininfo', [])).result;
    expect(info.chain).toBe('regtest');
    expect(info.upgrade_status.mempool_activated).toBe(true);
  }, 120_000);

  /**
   * THE ORDERING CONTROLS, which have to pass for the probe below to mean anything. Two output-side policy
   * refusals and one input-side refusal, all on transactions whose outpoint exists on no chain: the policy
   * checks are applied BEFORE input lookup, and `IsStandardTx` is running on this node rather than disabled.
   */
  it('MEASURED: output and input policy both refuse before inputs are looked up', async () => {
    expect(await verdict(RPC_URL, PROBES['bare OP_1 at 10 satoshis'])).toBe('64: dust');
    expect(await verdict(RPC_URL, PROBES['an OP_RETURN carrying 300 bytes'])).toBe('64: oversize-op-return');
    expect(await verdict(RPC_URL, PROBES['a non-push-only scriptSig'])).toBe('64: scriptsig-not-pushonly');
  }, 120_000);

  /**
   * THE PROBE. The dust control above proves the per-output loop reaches this exact one-byte script; the only
   * difference here is the value. So `missing-inputs` is not "the node never looked" - it is the node looking
   * and declining to refuse.
   */
  it('MEASURED: a bare OP_1 output is NOT refused for its script - the template rule does not exist', async () => {
    expect(await verdict(RPC_URL, PROBES['bare OP_1 at 1,000 satoshis'])).toBe('missing-inputs');
    // Nor is it a special case for OP_1: an arbitrary non-template script passes the same way.
    expect(await verdict(RPC_URL, PROBES['an arbitrary script at 1,000 satoshis'])).toBe('missing-inputs');
    expect(await verdict(RPC_URL, PROBES['two P2PKH outputs'])).toBe('missing-inputs');
  }, 120_000);

  /** The neighbouring rule the envelope also carried. BCHN v29 does not enforce a single-OP_RETURN limit. */
  it('MEASURED: two OP_RETURN outputs are not refused either', async () => {
    expect(await verdict(RPC_URL, PROBES['two OP_RETURN outputs'])).toBe('missing-inputs');
  }, 120_000);

  /**
   * THE STRONGEST FORM, and the one that owes nothing to the pre-lookup ordering argument: a REAL 1,000-satoshi
   * bare `OP_1` output, funded through the node by a real transaction the node accepts and mines. A policy
   * verdict on unspendable bytes can be argued with; a mined output cannot.
   */
  it('MEASURED: the node accepts and mines a real transaction creating a bare OP_1 output', async () => {
    const provider = createTestProvider();
    // `addUtxo` takes RAW LOCKING BYTECODE when given hex, so this output really is a bare `OP_1` and the
    // funding transaction really is broadcast: a rejection would surface here as a thrown RPC error.
    const created = await (provider as any).addUtxo('51', { txid: '', vout: 0, satoshis: 1000n });
    expect(created.satoshis).toBe(1000n);

    // Read the mined transaction back from the node and find the output, so "it was created" is the node's
    // own record rather than ours. BCHN reports the type of this script as `script`, not `nonstandard`.
    const decoded = (await rpc(RPC_URL, 'getrawtransaction', [created.txid, 1])).result;
    expect(decoded.confirmations).toBeGreaterThanOrEqual(1);
    const bareOutput = decoded.vout.find((output: any) => output.scriptPubKey.hex === '51');
    expect(bareOutput, 'the node mined a transaction carrying a bare OP_1 output').toBeDefined();
    expect(Math.round(bareOutput.value * 1e8)).toBe(1000);
  }, 300_000);

  /**
   * The same table against a node started with an explicit `-acceptnonstdtxn=0`, so a permissive regtest
   * default cannot be mistaken for a policy result. Skipped unless `X64_STRICT_RPC_URL` names such a node;
   * the run that produced the header table reproduced every row.
   */
  it.runIf(STRICT_RPC_URL)('MEASURED: the same verdicts on an -acceptnonstdtxn=0 node', async () => {
    for (const [name, raw] of Object.entries(PROBES)) {
      expect({ name, verdict: await verdict(STRICT_RPC_URL!, raw) })
        .toEqual({ name, verdict: MEASURED[name as keyof typeof PROBES] });
    }
  }, 300_000);
});
