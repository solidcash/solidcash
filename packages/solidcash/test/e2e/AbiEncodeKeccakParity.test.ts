import { describe, it, expect } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from '../direct-compile.js';
import { ContractFactory, HDSigner } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';
import { addressToLockScript } from '../../src/utils.js';

/**
 * GATE for computing a keccak256 preimage OFF-CHAIN instead of recovering it from a VM probe.
 *
 * Timelock's `queuedTransactions[keccak256(abi.encode(...))] = true` makes the C2 entry KEY the keccak output,
 * so the side-car probe cannot co-spend an entry whose identity it exists to compute. The way out is for the
 * SDK to build the preimage itself - but only if its `abi.encode` matches the compiler's BYTE FOR BYTE. A
 * mismatch yields a wrong digest, hence a wrong entry key, and NOTHING fails loudly: the write lands under a
 * bogus key and later reads simply miss.
 *
 * A constructor is used deliberately: it has no C2 entry, so the existing side-car path works and the digest
 * is readable. That isolates the ENCODING question from the circularity that blocks Timelock.
 */
const SRC = `pragma solidcash >=0.8.0;
contract EncBox() {
  bytes32 public one;
  bytes32 public two;
  bytes32 public small;
  constructor() {
    one = keccak256(abi.encode(uint256(42)));
    two = keccak256(abi.encode(uint256(1), uint256(2)));
    small = keccak256(abi.encode(uint8(7)));
  }
}`;

/**
 * MEASURED encoding: SolidCash `abi.encode` is a BCH-native wire format - minimal script pushdata,
 * little-endian - NOT EVM 32-byte words (docs/evm-abi-parity.md:27; EVM word parity is the separate,
 * largely unbuilt `evmCompat` mode). Verified against compiler output: 42 -> 012a, uint8(7) -> 57 (OP_7),
 * (1,2) -> 5152 (OP_1 OP_2).
 */
const minimalLE = (value: bigint): Uint8Array => {
  if (value === 0n) return new Uint8Array(0);
  const out: number[] = [];
  let rest = value;
  while (rest > 0n) { out.push(Number(rest & 0xffn)); rest >>= 8n; }
  if (out[out.length - 1] & 0x80) out.push(0); // sign-magnitude: keep the top bit clear
  return new Uint8Array(out);
};
const minimalPush = (value: bigint): Uint8Array => {
  if (value === 0n) return new Uint8Array([0x00]);
  if (value >= 1n && value <= 16n) return new Uint8Array([0x50 + Number(value)]);
  return minimalPushBytes(minimalLE(value));
};
/** Minimal script push of an arbitrary byte string: bare length byte, then OP_PUSHDATA1/2 as it grows. */
const minimalPushBytes = (body: Uint8Array): Uint8Array => {
  if (body.length === 0) return new Uint8Array([0x00]);
  if (body.length <= 75) return concat(new Uint8Array([body.length]), body);
  if (body.length <= 255) return concat(new Uint8Array([0x4c, body.length]), body);
  return concat(new Uint8Array([0x4d, body.length & 0xff, (body.length >> 8) & 0xff]), body);
};
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const asHex = (read: unknown): string => {
  if (typeof read === 'string') return read.replace(/^0x/, '').toLowerCase();
  if (read instanceof Uint8Array) return hex(read);
  return String(read);
};

describe('abi.encode + keccak256 parity (compiler vs off-chain)', () => {
  it('reproduces the compiler digest with minimal-pushdata little-endian encoding', async () => {
    const provider = createTestProvider();
    const signer = HDSigner.fromPhrase(
      'test test test test test test test test test test test junk',
      provider,
    );
    for (let i = 0; i < 8; i++) {
      await provider.addUtxo(signer.getAddress(), {
        txid: Buffer.alloc(32, i + 1).toString('hex'),
        vout: 0,
        satoshis: 100_000_000n,
      });
    }
    const contract = await new ContractFactory(compileString(SRC, { forceStateful: true }), signer).deploy();
    await contract.deployed();

    const onChain = {
      one: asHex(await contract.one()),
      two: asHex(await contract.two()),
      small: asHex(await contract.small()),
    };
    const offChain = {
      one: hex(keccak_256(minimalPush(42n))),
      two: hex(keccak_256(concat(minimalPush(1n), minimalPush(2n)))),
      small: hex(keccak_256(minimalPush(7n))),
    };
    // Reported together so a mismatch shows WHICH shapes diverge, not just the first.
    expect(onChain).toEqual(offChain);
  }, 180000);

  // The cases above are all compile-time CONSTANTS, so they only pin the constant-folded path. Timelock's
  // arguments are runtime values whose preimage the covenant builds with OP_CAT. Whether that runtime path
  // produces the same bytes is a separate question and must be measured, not extrapolated.
  it('runtime (non-constant) arguments encode the same way as constants', async () => {
    const provider = createTestProvider();
    const signer = HDSigner.fromPhrase(
      'test test test test test test test test test test test junk',
      provider,
    );
    for (let i = 0; i < 12; i++) {
      await provider.addUtxo(signer.getAddress(), {
        txid: Buffer.alloc(32, i + 40).toString('hex'),
        vout: 0,
        satoshis: 100_000_000n,
      });
    }
    const src = `pragma solidcash >=0.8.0;
contract RuntimeEnc() {
  bytes32 public last;
  function record(uint256 x) public {
    last = keccak256(abi.encode(x));
    require(true, "n");
  }
  function record2(uint256 a, uint256 b) public {
    last = keccak256(abi.encode(a, b));
    require(true, "n");
  }
}`;
    const contract = await new ContractFactory(compileString(src, { forceStateful: true }), signer).deploy();
    await contract.deployed();

    await contract.record(42n).send();
    expect(asHex(await contract.last()), 'runtime uint256 42').toEqual(hex(keccak_256(minimalPush(42n))));

    await contract.record(7n).send();
    expect(asHex(await contract.last()), 'runtime uint256 7 (OP_N range)').toEqual(hex(keccak_256(minimalPush(7n))));

    await contract.record2(1n, 2n).send();
    const expected2 = hex(keccak_256(concat(minimalPush(1n), minimalPush(2n))));
    expect(asHex(await contract.last()), 'runtime two-arg').toEqual(expected2);
  }, 300000);

  // Timelock hashes `abi.encode(target, value, signature, data, eta)` - address/string/bytes, not just
  // integers. An SDK encoder that only handles numbers would silently mis-encode these, so pin them too.
  it('encodes string and bytes arguments as length-prefixed pushes', async () => {
    const provider = createTestProvider();
    const signer = HDSigner.fromPhrase(
      'test test test test test test test test test test test junk',
      provider,
    );
    for (let i = 0; i < 12; i++) {
      await provider.addUtxo(signer.getAddress(), {
        txid: Buffer.alloc(32, i + 90).toString('hex'),
        vout: 0,
        satoshis: 100_000_000n,
      });
    }
    const src = `pragma solidcash >=0.8.0;
contract StrEnc() {
  bytes32 public last;
  function record(string memory s, bytes memory d, uint256 n) public {
    last = keccak256(abi.encode(s, d, n));
    require(true, "n");
  }
}`;
    const contract = await new ContractFactory(compileString(src, { forceStateful: true }), signer).deploy();
    await contract.deployed();

    const sig = 'setDelay(uint256)';
    const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    await contract.record(sig, data, 172800n).send();

    const expected = hex(keccak_256(concat(
      minimalPushBytes(new TextEncoder().encode(sig)),
      minimalPushBytes(data),
      minimalPush(172800n),
    )));
    expect(asHex(await contract.last()), 'string + bytes + uint256').toEqual(expected);
  }, 300000);

  // Timelock's `target` is an address, and address is the one operand the SDK encoder refuses to encode until
  // it is pinned here (addresses arrive as cashaddr strings but hash as LOCKING BYTECODE, so a UTF-8 encoding
  // of the address text would be silently wrong).
  it('encodes an address argument as its locking bytecode', async () => {
    const provider = createTestProvider();
    const signer = HDSigner.fromPhrase(
      'test test test test test test test test test test test junk',
      provider,
    );
    for (let i = 0; i < 12; i++) {
      await provider.addUtxo(signer.getAddress(), {
        txid: Buffer.alloc(32, i + 150).toString('hex'),
        vout: 0,
        satoshis: 100_000_000n,
      });
    }
    const src = `pragma solidcash >=0.8.0;
contract AddrEnc() {
  bytes32 public last;
  function record(address a, uint256 n) public {
    last = keccak256(abi.encode(a, n));
    require(true, "n");
  }
}`;
    const contract = await new ContractFactory(compileString(src, { forceStateful: true }), signer).deploy();
    await contract.deployed();

    const target = signer.getAddress();
    await contract.record(target, 5n).send();
    const expected = hex(keccak_256(concat(
      minimalPushBytes(addressToLockScript(target)),
      minimalPush(5n),
    )));
    expect(asHex(await contract.last()), 'address + uint256').toEqual(expected);
  }, 300000);
});
