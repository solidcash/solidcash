import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// End-to-end (mocknet) validation that the solidity-by-example porting features execute correctly on the
// VM, not just that they compile. Each contract's spend only succeeds if the emitted bytecode computes the
// asserted result. See examples/solidity-by-example/INTERVENTIONS.md.

// Compile + deploy a non-stateful contract and run one unlock; resolves iff the VM accepts the spend.
async function spend(
  source: string,
  unlock: (c: Contract) => unknown,
  opts?: { compat?: boolean; locktime?: number },
): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(compileString(source, opts?.compat ? { solidityImportCompat: true } : {}), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  const tb = new TransactionBuilder({ provider })
    .addInputs(utxos, unlock(contract) as never)
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount });
  if (opts?.locktime !== undefined) tb.setLocktime(opts.locktime);
  return tb.send();
}

describe('Porting features (runtime)', () => {
  it('SBE-2: bytesN -> bytesM cast truncates the leftmost bytes', async () => {
    // bytes4 of a 6-byte value keeps the first 4 bytes (Solidity left-aligned).
    const src = `contract C() {
      function f() { bytes6 a = 0x1234567890ab; bytes4 b = bytes4(a); require(b == 0x12345678); }
    }`;
    await expect(spend(src, (c) => c.unlock.f())).resolves.toBeDefined();
  });

  it('SBE-2: bytesN -> bytesM cast rejects a wrong truncation (the check is real)', async () => {
    const src = `contract C() {
      function f() { bytes6 a = 0x1234567890ab; bytes4 b = bytes4(a); require(b == 0x90abcdef); }
    }`;
    await expect(spend(src, (c) => c.unlock.f())).rejects.toThrow();
  });

  it('SBE-9: hex literal compares as a big-endian integer (compat)', async () => {
    // 0x0100 == 256; require holds only if the hex literal is read big-endian as the integer 256.
    const src = `pragma solidity ^0.8.26;
      contract C { function f(uint256 x) external pure { require(x == 0x0100); } }`;
    await expect(spend(src, (c) => c.unlock.f(256n), { compat: true })).resolves.toBeDefined();
    await expect(spend(src, (c) => c.unlock.f(255n), { compat: true })).rejects.toThrow();
  });

  it('SBE-11: implicit named return yields the named value', async () => {
    const src = `contract C() {
      function f(int x) { require(addOne(x) == x + 1); }
      function addOne(int x) internal returns (int r) { r = x + 1; }
    }`;
    await expect(spend(src, (c) => c.unlock.f(41n))).resolves.toBeDefined();
  });

  it('SBE-1/4: for-loop with break + prefix increment computes the right sum', async () => {
    // sum 0..n, break at 3 -> 0+1+2 = 3; prefix ++ used as the update path.
    const src = `contract C() {
      function f() {
        int s = 0;
        for (int i = 0; i < 10; ) { if (i == 3) { break; } s = s + i; ++i; }
        require(s == 3);
      }
    }`;
    await expect(spend(src, (c) => c.unlock.f())).resolves.toBeDefined();
  });

  it('SBE-13: block.timestamp maps to tx.locktime (spend gated by locktime)', async () => {
    const src = `pragma solidity ^0.8.26;
      contract C { function f() external { require(block.timestamp >= 1000); } }`;
    await expect(spend(src, (c) => c.unlock.f(), { compat: true, locktime: 1000 })).resolves.toBeDefined();
    await expect(spend(src, (c) => c.unlock.f(), { compat: true, locktime: 999 })).rejects.toThrow();
  });

  it('SBE-15: local struct member assignment updates the field', async () => {
    const src = `contract C() {
      struct S { int a; bool b; }
      function f(int v) { S memory s; s.a = v; s.b = true; require(s.a == v && s.b); }
    }`;
    await expect(spend(src, (c) => c.unlock.f(7n))).resolves.toBeDefined();
  });
});
