import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, createFeeFunder } from '../test-util.js';
import { alicePkh } from '../fixture/vars.js';

// Solidity-compat narrowing casts: bytes20(address) / uint160(address) extract the embedded 20-byte hash
// (the P2PKH pubkey-hash) from a variable-length BCH address. See docs/ecrecover.md and the cast warning.
const SOURCE = `pragma solidcash >=0.8.0;
contract AddrCast() {
  function checkBytes20(address a, bytes20 expected) { require(bytes20(a) == expected); }
  function checkUint160(address a, int expected) { require(uint160(a) == expected); }
  function uint160NonNegative(address a) { require(uint160(a) >= 0); }
}`;
const artifact = compileString(SOURCE);

const p2pkh = (pkh: Uint8Array): Uint8Array => hexToBin(`76a914${binToHex(pkh)}88ac`);
// uint160(address) appends a 0x00 sign byte then OP_BIN2NUM: the unsigned little-endian value of the 20-byte hash.
const leUint = (bytes: Uint8Array): bigint => {
  let v = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) v = (v << 8n) + BigInt(bytes[i]);
  return v;
};

async function spend(fnArgs: (c: Contract) => any): Promise<string> {
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
  const feeFunder = await createFeeFunder(provider, 20000n);
  const tx = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, fnArgs(contract))
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: contract.address, amount: 110000n })
    .send();
  return tx.txid;
}

describe('bytes20(address) / uint160(address) narrowing casts (runtime)', () => {
  const addr = p2pkh(alicePkh); // a P2PKH address whose embedded 20-byte hash is alicePkh

  it('bytes20(address) extracts the embedded P2PKH pubkey-hash', async () => {
    const txid = await spend((c) => c.unlock.checkBytes20(addr, alicePkh));
    expect(txid).toBeDefined();
  });

  it('bytes20(address) does not match a different hash', async () => {
    await expect(spend((c) => c.unlock.checkBytes20(addr, new Uint8Array(20)))).rejects.toThrow();
  });

  it('uint160(address) is the unsigned little-endian value of that hash', async () => {
    const txid = await spend((c) => c.unlock.checkUint160(addr, leUint(alicePkh)));
    expect(txid).toBeDefined();
  });

  it('uint160(address) is non-negative even when the hash high bit is set', async () => {
    const highBit = new Uint8Array(20).fill(0xff); // top bit set -> would be negative without the 0x00 fix
    const txid = await spend((c) => c.unlock.uint160NonNegative(p2pkh(highBit)));
    expect(txid).toBeDefined();
  });
});
