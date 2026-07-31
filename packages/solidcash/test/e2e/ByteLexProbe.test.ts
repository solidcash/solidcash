import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';
import { randomUtxo } from '../../src/utils.js';

// Probe: does int(reverse(x) ++ 0x01) < int(reverse(y) ++ 0x01) yield unsigned big-endian
// (lexicographic) order at the VM in a NORMAL function? If yes, the 3x failure is specific to the
// synthesized SCB1 handler (a fixable compiler-synthesis gap); if no, it is an operation/VM limit.
// Two-half byte-lexicographic compare: each 16-byte half's int() (17 bytes) fits the int range guard,
// unlike the whole 32-byte value. High half decides; low half is the tiebreak.
const SRC = `pragma solidcash >=0.8.0;
contract Probe() {
  function cmp(bytes a, bytes b) public {
    bigint hiA = int(bytes.concat(a.slice(0, 16).reverse(), hex"01"));
    bigint hiB = int(bytes.concat(b.slice(0, 16).reverse(), hex"01"));
    bigint loA = int(bytes.concat(a.slice(16, 32).reverse(), hex"01"));
    bigint loB = int(bytes.concat(b.slice(16, 32).reverse(), hex"01"));
    require(hiA < hiB || (hiA == hiB && loA < loB));
  }
}`;

async function run(a: Uint8Array, b: Uint8Array): Promise<void> {
  const provider = createTestProvider();
  const artifact = compileString(SRC, {});
  const c = new Contract(artifact, [], { provider });
  await provider.addUtxo(c.address, randomUtxo({ satoshis: 100000n }));
  const utxos = await c.getUtxos();
  await new TransactionBuilder({ provider })
    .addInput(utxos[0], c.unlock.cmp(a, b))
    .addOutput({ to: c.address, amount: 99000n })
    .send();
}

describe('probe: byte-lex order at VM (normal function)', () => {
  const REQUIRE_REFUSAL = 'Probe.scash:8 Require statement failed at input 0 in contract Probe.scash at line 8.';
  const lo = hexToBin(`80${'00'.repeat(31)}`); // 32 bytes, high-bit set, big-endian smaller
  const hi = hexToBin(`81${'00'.repeat(31)}`); // differs in high half
  const tieLo = hexToBin(`${'00'.repeat(16)}${'ff'.repeat(15)}80`); // equal high half, differ in low half
  const tieHi = hexToBin(`${'00'.repeat(16)}${'ff'.repeat(15)}81`);
  it('accepts a < b differing in the high half (high-bit values)', async () => {
    await expect(run(lo, hi)).resolves.toBeUndefined();
  });
  it('rejects a > b (reversed)', async () => {
    await expect(run(hi, lo)).rejects.toThrow(REQUIRE_REFUSAL);
  });
  it('accepts a < b differing only in the low half (tiebreak)', async () => {
    await expect(run(tieLo, tieHi)).resolves.toBeUndefined();
  });
  it('rejects equal a == b (not strictly less)', async () => {
    await expect(run(lo, lo)).rejects.toThrow(REQUIRE_REFUSAL);
  });
});
