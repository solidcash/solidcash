import { describe, it, expect, vi } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '../src/index.js';

// Cryptographic builtins: ecrecover (verify-with-pubkey; BCH has no key recovery).

describe('ecrecover (verify-with-pubkey; no native recovery on BCH)', () => {
  it('3-arg ecrecover(hash, sig, pubKey) emits OP_CHECKDATASIG + the P2PKH build', () => {
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(bytes32 h, datasig s, pubkey pk) {'
      + ' address r = ecrecover(h, s, pk); require(r != 0x); } }').debug.bytecode));
    expect(asm).toContain('OP_CHECKDATASIG');
    expect(asm).toContain('OP_HASH160');                 // hash160(pubKey) for the P2PKH script
    expect(asm).toContain('76a914');                     // P2PKH prefix
    expect(asm).toContain('88ac');                       // P2PKH suffix
  });

  it('4-arg Solidity ecrecover(hash, v, r, s) compiles (no error), warns, and is inert (drops args -> 0x)', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const artifact = compileString(
      'contract C() { function f(bytes32 h, int v, bytes32 r, bytes32 s) {'
      + ' address a = ecrecover(h, v, r, s); require(a == 0x); } }');
    expect(artifact.contractName).toBe('C');             // accepted, not a compile error
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(asm).toContain('OP_2DROP');                   // the (hash, v, r, s) args are dropped
    expect(asm).not.toContain('OP_CHECKDATASIG');        // no verification - inert
    expect(warn.mock.calls.some((c) => String(c[0]).includes('ecrecover(hash, v, r, s)'))).toBe(true);
    warn.mockRestore();
  });
});
