/**
 * B6.4 (O4, O5): the code tail and marker, record-sound classification, and the per-run carrier count.
 *
 * The tail rules are exercised on the shipped `applyCodeTail` function; the marker and the carrier count are
 * asserted on artifacts and on a transaction the mock chain evaluates under the production limits.
 */
import { describe, expect, it } from 'vitest';
import { eq } from '@bitauth/libauth';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { applyCodeTail, CODE_MARKER_MAGIC, CodeTailError } from '../src/generation/CodeTail.js';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import { compileString } from '../src/index.js';
import { Contract, SignatureTemplate } from '../../solidcash/src/index.js';
import { StatefulContract } from '../../solidcash/src/stateful/index.js';
import { alicePub, alicePriv, alicePkh } from '../../solidcash/test/fixture/vars.js';
import { createTestProvider } from '../../solidcash/test/test-util.js';
import p2pkhArtifact from '../../solidcash/test/fixture/p2pkh.artifact.js';

const P = 'pragma solidcash ^0.50.0;';

const markerAt = (script: readonly number[], offset: number): boolean => (
  offset >= 0 && offset + 23 <= script.length
  && script[offset] === 0x15 && script[offset + 22] === 0x75
  && CODE_MARKER_MAGIC.every((byte, index) => script[offset + 1 + index] === byte)
);

describe('B6.4: the code tail (O4)', () => {
  it('pads a short code to the guard distance', () => {
    const out = applyCodeTail([0x51], { flags: 0 });
    expect(out.length).toBe(57);
    expect(out.slice(1).every((byte) => byte === 0x61)).toBe(true);
  });

  it('appends the marker with the requested flag byte', () => {
    const out = applyCodeTail([0x51], { flags: 2 });
    expect(out.length).toBeGreaterThanOrEqual(80);
    expect(markerAt(out, out.length - 23)).toBe(true);
    expect(out[out.length - 2]).toBe(2);
  });

  it('breaks a 34-byte birth-trailer shape at the end', () => {
    const trailer = [0x20, ...new Array(32).fill(0x11), 0x75];
    const out = applyCodeTail(trailer, { flags: 0 });
    const endsInTrailerShape = out[out.length - 34] === 0x20 && out[out.length - 1] === 0x75;
    expect(endsInTrailerShape).toBe(false);
  });

  it('breaks a run of 0x20 bytes before a marker', () => {
    const body = [0x51, ...new Array(40).fill(0x20), 0x75];
    const out = applyCodeTail(body, { flags: 2 });
    expect(out.slice(-34)[0]).not.toBe(0x20);
    expect(markerAt(out, out.length - 23)).toBe(true);
  });

  it('shifts an accidental marker out of the last 23 bytes when the contract has none', () => {
    const accidental = [0x51, 0x15, ...CODE_MARKER_MAGIC, 0x00, 0x75];
    const out = applyCodeTail(accidental, { flags: 0 });
    const at = out.length - 23;
    expect(markerAt(out, at)).toBe(false);
  });

  it('pads when an instance-filled slot reaches into the last 57 bytes', () => {
    const code = new Array(40).fill(0x51);
    const out = applyCodeTail(code, { flags: 0, instanceSlotOffsets: [20] });
    expect(out.length - (20 + 34)).toBeGreaterThanOrEqual(57);
  });

  it('refuses unknown marker flags', () => {
    expect(() => applyCodeTail([0x51], { flags: 4 })).toThrow(CodeTailError);
  });
});

describe('B6.4: record-sound classification and the marker', () => {
  const bytesOf = (source: string): number[] => scriptToBytecode(asmToScript(compileString(source, {
    messageBus: false,
  }).bytecode));

  it('a record-sound contract ends with the marker whose flag byte has bit 1', () => {
    const artifact = compileString(`${P} contract C { int s; function v(int x) { s = s + x; } }`, { messageBus: false });
    expect(artifact.recordSound).toBe(true);
    const script = scriptToBytecode(asmToScript(artifact.bytecode));
    expect(markerAt(script, script.length - 23)).toBe(true);
    expect(script[script.length - 2]).toBe(2);
  });

  it('a contract with an unsafe entry is not record-sound and carries no marker', () => {
    const artifact = compileString(`${P} contract C { int s; function a() { s = s + 1; } function u() unsafe { s = s + 2; } }`,
      { messageBus: false });
    expect(artifact.recordSound).toBe(false);
    const script = scriptToBytecode(asmToScript(artifact.bytecode));
    expect(markerAt(script, script.length - 23)).toBe(false);
  });

  it('a contract with no record-publishing entry has no recordSound field', () => {
    const artifact = compileString(`${P} contract C { int s; function u() unsafe { s = s + 1; } }`, { messageBus: false });
    expect(artifact.recordSound).toBeUndefined();
  });
});

describe('B6.4 (O5): the carrier count', () => {
  const SOURCE = `${P} contract C { int calls; function hit(int amount) { calls = calls + amount; } }`;

  it('accepts the honest run and refuses a second carrier of the contract category', async () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const artifact = compileString(SOURCE, { messageBus: false });
    const funding = { txid: 'd1c0'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, funding);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { calls: 0n },
      changeAddress: p2pkh.address,
    });

    let honest = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as unknown as { sendRawTransaction: (hex: string) => Promise<string> }).sendRawTransaction
      = async (hex: string): Promise<string> => {
        honest = hex;
        throw new Error('capture-only');
      };
    try {
      await expect(deployed.contract.functions.hit(7n).then((builder) => builder.send()))
        .rejects.toThrow('capture-only');
    } finally {
      (provider as unknown as { sendRawTransaction: typeof send }).sendRawTransaction = send;
    }

    const forged = decodeTransactionUnsafe(hexToBin(honest));
    forged.outputs.push({
      lockingBytecode: Uint8Array.of(0x51),
      valueSatoshis: 800n,
      token: { category: hexToBin(deployed.contract.categoryId), amount: 0n },
    });

    const rejected = await send(binToHex(encodeTransaction(forged))).then(() => false).catch(() => true);
    expect(rejected, 'a second carrier').toBe(true);
    await expect(send(honest)).resolves.toBeDefined();
  });
});
