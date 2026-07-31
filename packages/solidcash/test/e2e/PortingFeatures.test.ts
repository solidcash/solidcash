import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// End-to-end (mocknet) validation that the solidity-by-example porting features execute correctly on the
// VM, not just that they compile. Each contract's spend only succeeds if the emitted bytecode computes the
// asserted result. Compiled with { forceStateful: true } so each test can deploy + call directly
// (`await sc.<fn>(args)`). See examples/solidity-by-example/INTERVENTIONS.md.

describe('Porting features (runtime)', () => {
  it('SBE-2: bytesN -> bytesM cast truncates the leftmost bytes', async () => {
    // bytes4 of a 6-byte value keeps the first 4 bytes (Solidity left-aligned).
    const artifact = compileString(`contract C() {
      function f() { bytes6 a = 0x1234567890ab; bytes4 b = bytes4(a); require(b == 0x12345678); }
    }`, { forceStateful: true });
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.f()).resolves.toBeDefined();
  });

  it('SBE-2: bytesN -> bytesM cast rejects a wrong truncation (the check is real)', async () => {
    const artifact = compileString(`contract C() {
      function f() { bytes6 a = 0x1234567890ab; bytes4 b = bytes4(a); require(b == 0x90abcdef); }
    }`, { forceStateful: true });
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.f()).rejects.toThrow(verifyFailure);
  });

  it('SBE-9: hex literal compares as a big-endian integer (compat)', async () => {
    // 0x0100 == 256; require holds only if the hex literal is read big-endian as the integer 256.
    const artifact = compileString(
      `pragma solidity ^0.8.26;
      contract C { function f(uint256 x) external pure { require(x == 0x0100); } }`,
      { forceStateful: true, solidityImportCompat: true },
    );
    const factory1 = getContractFactory(artifact, await fundedSigner());
    await expect((await factory1.deploy()).f(256n)).resolves.toBeDefined();
    const factory2 = getContractFactory(artifact, await fundedSigner());
    await expect((await factory2.deploy()).f(255n)).rejects.toThrow(verifyFailure);
  });

  it('SBE-11: implicit named return yields the named value', async () => {
    const artifact = compileString(`contract C() {
      function f(int x) { require(addOne(x) == x + 1); }
      function addOne(int x) internal returns (int r) { r = x + 1; }
    }`, { forceStateful: true });
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.f(41n)).resolves.toBeDefined();
  });

  it('SBE-1/4: for-loop with break + prefix increment computes the right sum', async () => {
    // sum 0..n, break at 3 -> 0+1+2 = 3; prefix ++ used as the update path.
    const artifact = compileString(`contract C() {
      function f() {
        int s = 0;
        for (int i = 0; i < 10; ) { if (i == 3) { break; } s = s + i; ++i; }
        require(s == 3);
      }
    }`, { forceStateful: true });
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.f()).resolves.toBeDefined();
  });

  it('SBE-13: block.timestamp routes via the block oracle register, not tx.locktime', () => {
    // block.timestamp is an oracle-backed register (__block_timestamp), the same in ported and native code;
    // it is no longer aliased to tx.locktime. The full oracle spend path is covered by BlockOracle.test.ts.
    const artifact = compileString(
      `pragma solidity ^0.8.26;
      contract C { function f() external { require(block.timestamp >= 1000); } }`,
      { forceStateful: true, solidityImportCompat: true },
    );
    expect(artifact.bytecode).not.toContain('OP_TXLOCKTIME');
    expect(JSON.stringify(artifact)).toContain('__block_timestamp');
  });

  it('SBE-15: local struct member assignment updates the field', async () => {
    const artifact = compileString(`contract C() {
      struct S { int a; bool b; }
      function f(int v) { S memory s; s.a = v; s.b = true; require(s.a == v && s.b); }
    }`, { forceStateful: true });
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.f(7n)).resolves.toBeDefined();
  });
});
