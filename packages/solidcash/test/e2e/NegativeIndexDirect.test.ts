import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

/**
 * A negative `int` index into a mapping's array value or a state array, on the direct convention.
 *
 * The element read checks only `index < length`, then splits the value at `index * width`, or scans a variable-width
 * value for `index` elements: a negative index splits at a negative offset, or counts down past the last element,
 * which the scan refuses because each skipped element has to be present. The call fails rather than reading another
 * element.
 */

const P = 'pragma solidcash ^0.14.0;';
const KIND = Uint8Array.from([0x3c, 0x61, 0x86, 0xab]);
const NOTE = Uint8Array.from([0x52, 0x0e, 0x97]);
/** The machine's refusal of a split at `index * width` for a negative index. */
const SPLIT = 'OP_SPLIT operation with an invalid index. stack item length: 4; requested split index: -4';
/** The element scan's refusal of a skip past the last element. */
const MISSING_ELEMENT = 'Program failed an OP_VERIFY operation.';

let fundingNonce = 0x7a10;

/** Deploys `source` with `initArgs`; the deployed contract's `check` entry, sent with `args`. */
async function deploy(source: string, initArgs: unknown[]): Promise<(...args: unknown[]) => Promise<unknown>> {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  fundingNonce += 1;
  const fundingUtxo = { txid: fundingNonce.toString(16).padStart(64, '0'), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(p2pkh.address, fundingUtxo);
  const result = await StatefulContract.deploy(compileString(source, { suppressWarnings: true }), [], {
    provider,
    fundingUtxo,
    funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: {},
    initArgs: initArgs as never,
    changeAddress: p2pkh.address,
  });
  const call = result.contract.call as unknown as Record<string, (...args: unknown[]) => { send(): Promise<unknown> }>;
  return (...args: unknown[]) => call.check!(...args).send();
}

describe('a negative direct index into a value the contract holds', () => {
  it('refuses a negative index into a mapping\'s fixed-width array value', async () => {
    const check = await deploy(`${P} contract C { mapping(uint => bytes4[]) logs;
      constructor(bytes4 v) { this.logs[7].push(v); }
      function check(uint k, int i, bytes4 e) { require(this.logs[k][i] == e); } }`, [KIND]);
    await check(7n, 0n, KIND);
    await expect(check(7n, -1n, KIND)).rejects.toThrow(SPLIT);
  });

  it('refuses a negative index into a mapping\'s variable-width array value', async () => {
    const check = await deploy(`${P} contract C { mapping(uint => bytes[]) notes;
      constructor(bytes v) { this.notes[7].push(v); }
      function check(uint k, int i, bytes e) { require(this.notes[k][i] == e); } }`, [NOTE]);
    await check(7n, 0n, NOTE);
    await expect(check(7n, -1n, NOTE)).rejects.toThrow(MISSING_ELEMENT);
  });

  it('refuses a negative index into a state array', async () => {
    const check = await deploy(`${P} contract C { bytes4[] items; constructor(bytes4 v) { this.items.push(v); }
      function check(int i, bytes4 e) { uint n = this.items.length; require(this.items[i] == e); require(n > 0); } }`,
    [KIND]);
    await check(0n, KIND);
    await expect(check(-1n, KIND)).rejects.toThrow(SPLIT);
  });
});
