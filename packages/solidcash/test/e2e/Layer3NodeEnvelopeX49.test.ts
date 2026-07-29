import { describe, expect, it } from 'vitest';
import { sha256 } from '@bitauth/libauth';
import { BCH_2026_STANDARD } from './layer3-envelope-f1.js';

/**
 * X49. The envelope measured against a REAL NODE rather than against libauth.
 *
 * F1 measured the whole Layer-3 envelope with real BCH-2026 constants and then declined to assert
 * `CONSENSUS_FIT`, for one stated reason: every reading came from libauth, not from a node. This file closes
 * the part of that gap which can be closed without any UTXO, and it is deliberately NON-MUTATING - it uses
 * `testmempoolaccept` only, never `sendrawtransaction`, and never mines. It can be run beside any other
 * regtest suite without disturbing it.
 *
 * WHAT IS ESTABLISHED HERE, AND WHY IT IS WORTH ESTABLISHING.
 *
 *  1. The node's standard transaction-size ceiling is EXACTLY the 100,000 bytes libauth reports, verified to
 *     the byte: 100,000 passes the size gate and 100,001 is refused. A constant this board's whole capacity
 *     argument rests on is now confirmed against the implementation rather than against another library.
 *
 *  2. The node applies that size rule BEFORE it looks up whether the inputs exist. That ordering is what
 *     makes a replay of mock-built bytes meaningful at all: a transaction whose outpoints exist on no chain
 *     still receives the node's truthful verdict on its SIZE, because the size rule never consults the UTXO
 *     set. Without this ordering, "missing-inputs" would mask every size verdict and a replay would prove
 *     nothing.
 *
 * WHAT IS NOT ESTABLISHED HERE. Nothing about script validity. `missing-inputs` means the node stopped
 * before executing anything. Script execution has to be earned by building against a real provider, which is
 * what the regtest runs of the graph fixtures do.
 *
 * The reject code on the size refusal is 64, `REJECT_NONSTANDARD`: the ceiling is POLICY. That it is policy
 * and not consensus was demonstrated separately, and mutatingly, by
 * `test/regtest/x49-policy-vs-consensus.py`, which gets the same oversized bytes refused by the mempool and
 * then accepted by consensus inside a submitted block.
 */

const RPC_URL = process.env.REGTEST_RPC_URL ?? 'http://localhost:18443';
const RPC_USER = process.env.REGTEST_RPC_USER ?? 'user';
const RPC_PASSWORD = process.env.REGTEST_RPC_PASSWORD ?? 'password';

async function rpc(method: string, params: unknown[]): Promise<any> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain;',
      authorization: `Basic ${Buffer.from(`${RPC_USER}:${RPC_PASSWORD}`).toString('base64')}`,
    },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'x49', method, params }),
  });
  return response.json();
}

const varInt = (value: number): number[] => {
  if (value < 0xfd) return [value];
  if (value <= 0xffff) return [0xfd, value & 0xff, (value >> 8) & 0xff];
  return [0xfe, value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
};

/**
 * A transaction of a chosen serialized size whose single input spends an outpoint that exists on no chain.
 * `standardOutputs` P2PKH outputs carry the bulk; `tailScriptBytes`, when given, appends one further output
 * whose script length tunes the total to the byte.
 */
function transactionOfSize(standardOutputs: number, tailScriptBytes?: number): Uint8Array {
  const bytes: number[] = [2, 0, 0, 0];
  bytes.push(...varInt(1));
  for (let index = 0; index < 32; index += 1) bytes.push(0x11);
  bytes.push(0, 0, 0, 0);
  bytes.push(...varInt(0));
  bytes.push(0xff, 0xff, 0xff, 0xff);
  bytes.push(...varInt(standardOutputs + (tailScriptBytes === undefined ? 0 : 1)));
  for (let index = 0; index < standardOutputs; index += 1) {
    const hash = sha256.hash(Uint8Array.of(index & 0xff, (index >> 8) & 0xff, 0, 0)).slice(0, 20);
    bytes.push(0x58, 2, 0, 0, 0, 0, 0, 0);            // 600 satoshis, little-endian
    bytes.push(...varInt(25), 0x76, 0xa9, 0x14, ...hash, 0x88, 0xac);
  }
  if (tailScriptBytes !== undefined) {
    bytes.push(0x58, 2, 0, 0, 0, 0, 0, 0);
    bytes.push(...varInt(tailScriptBytes));
    for (let index = 0; index < tailScriptBytes; index += 1) bytes.push(0x51);
  }
  bytes.push(0, 0, 0, 0);
  return Uint8Array.from(bytes);
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

async function rejectReason(raw: Uint8Array): Promise<string> {
  const reply = await rpc('testmempoolaccept', [[toHex(raw)]]);
  const result = reply.result?.[0];
  if (result === undefined) throw new Error(`node error: ${JSON.stringify(reply.error)}`);
  return result.allowed === true ? 'ACCEPTED' : String(result['reject-reason']);
}

// Requires the docker regtest stack; see the root CLAUDE.md.
describe.runIf(process.env.TESTS_USE_REGTEST)('X49: the standard envelope, verified against BCHN', () => {
  it('the node is the BCH-2026 regtest node these measurements assume', async () => {
    const info = (await rpc('getblockchaininfo', [])).result;
    expect(info.chain).toBe('regtest');
    expect(info.upgrade_status.mempool_activated).toBe(true);
  }, 120_000);

  /**
   * The exact boundary, not a band. 100,000 bytes reaches input lookup; one further byte does not. Both
   * transactions spend the same nonexistent outpoint, so size is the only variable between them.
   */
  it('MEASURED: the standard size ceiling is exactly 100,000 bytes on the node', async () => {
    const atCeiling = transactionOfSize(2939, 12);
    const overCeiling = transactionOfSize(2939, 13);
    expect(atCeiling.length).toBe(BCH_2026_STANDARD.maximumTransactionSize);
    expect(overCeiling.length).toBe(BCH_2026_STANDARD.maximumTransactionSize + 1);

    expect(await rejectReason(atCeiling)).toBe('missing-inputs');
    // Reject code 64 is REJECT_NONSTANDARD: the ceiling is relay policy, not consensus.
    expect(await rejectReason(overCeiling)).toBe('64: tx-size');
  }, 120_000);

  /**
   * THE ORDERING THAT MAKES A REPLAY MEANINGFUL. A small transaction and a large one, both spending the same
   * nonexistent outpoint: the small one is refused for its absent inputs, the large one for its size. The
   * size verdict therefore does not depend on the UTXO set, so bytes built against a mock provider can still
   * be asked the size question and answered truthfully.
   */
  it('MEASURED: size is refused before inputs are looked up', async () => {
    expect(await rejectReason(transactionOfSize(10))).toBe('missing-inputs');
    expect(await rejectReason(transactionOfSize(2960))).toBe('64: tx-size');
  }, 120_000);
});
