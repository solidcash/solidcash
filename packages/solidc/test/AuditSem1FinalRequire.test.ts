import { describe, it, expect, vi } from 'vitest';
import { compileString } from './direct-compile.js';
import * as Errors from '../src/Errors.js';

const GUARD_PREFIX = 'OP_TXLOCKTIME OP_CHECKLOCKTIMEVERIFY OP_DROP';

// SEM-1: a require placed after an early `return;` does not cover the path that returns.
describe('SEM-1: early return before the only require', () => {
  const earlyReturn = `
    contract Wallet(pubkey owner) {
      function spend(sig s, int amount) {
        if (amount == 0) return;
        require(checkSig(s, owner));
      }
    }`;

  it('errors with enforceFinalRequire', () => {
    expect(() => compileString(earlyReturn, { enforceFinalRequire: true }))
      .toThrow(Errors.FinalRequireStatementError);
  });

  it('warns by default', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      compileString(earlyReturn);
      expect(log.mock.calls.some(([m]) => String(m).includes('unconditionally-spendable'))).toBe(true);
    } finally {
      log.mockRestore();
    }
  });

  it('errors when the early return sits in a nested arm before a final if/else', () => {
    const src = `
      contract Wallet(pubkey owner) {
        function spend(sig s, int amount) {
          if (amount > 5) { if (amount == 7) return; }
          if (amount == 1) { require(checkSig(s, owner)); } else { require(amount > 2); }
        }
      }`;
    expect(() => compileString(src, { enforceFinalRequire: true })).toThrow(Errors.FinalRequireStatementError);
  });

  it('accepts a require that dominates the early return', () => {
    const src = `
      contract Wallet(pubkey owner) {
        function spend(sig s, int amount) {
          require(checkSig(s, owner));
          if (amount == 0) return;
          require(amount > 1);
        }
      }`;
    expect(() => compileString(src, { enforceFinalRequire: true })).not.toThrow();
  });

  it('accepts an early return verified inside its own arm', () => {
    const src = `
      contract Wallet(pubkey owner) {
        function spend(sig s, int amount) {
          if (amount == 0) { require(checkSig(s, owner)); return; }
          require(amount > 1);
        }
      }`;
    expect(() => compileString(src, { enforceFinalRequire: true })).not.toThrow();
  });
});

// A stateful entry's return ends under the collection census only when the entry reads an entry. Without it only
// C3's count holds, which a co-spent record rewritten in place keeps balanced, so the path is checked.
describe('SEM-1: early return in a stateful entry', () => {
  const vault = (entry: string): string => `
    contract Vault {
      mapping(uint256 => uint256) m;
      function put(uint256 k, uint256 v) external { m[k] = v; require(true); }
      ${entry}
    }`;

  it('errors when the entry reads no entry', () => {
    const src = vault('function act(uint256 code, bool skip) external { if (skip) { return; } require(code == 7); }');
    expect(() => compileString(src, { enforceFinalRequire: true })).toThrow(Errors.FinalRequireStatementError);
  });

  it('accepts the return in an entry that reads an entry', () => {
    const src = vault(
      'function readIf(uint256 k, uint256 ev, bool doit) external { if (!doit) { return; } require(m[k] == ev); }',
    );
    expect(() => compileString(src, { enforceFinalRequire: true })).not.toThrow();
  });
});

// SEM-6: a time check after an early return does not enforce locktime for the returning path.
describe('SEM-6: locktime guard and early returns', () => {
  it('keeps the guard when the time check follows an early return', () => {
    const src = `
      contract Escrow(pubkey seller, pubkey buyer) {
        function release(sig s) {
          if (tx.locktime >= 1000) { require(checkSig(s, seller)); return; }
          require(checkSig(s, buyer));
          require(tx.time >= 500);
        }
      }`;
    expect(compileString(src).bytecode.startsWith(GUARD_PREFIX)).toBe(true);
  });

  it('still omits the guard when a later time check is reached on every path', () => {
    const src = `
      contract Escrow(pubkey seller) {
        function release(sig s) {
          require(tx.locktime >= 1000);
          require(checkSig(s, seller));
          require(tx.time >= 500);
        }
      }`;
    expect(compileString(src).bytecode.startsWith(GUARD_PREFIX)).toBe(false);
  });
});
