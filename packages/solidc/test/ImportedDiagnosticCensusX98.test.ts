import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

interface Site {
  readonly id: string;
  readonly body: string;
  readonly warning: RegExp;
  readonly symbol: string;
}

/**
 * X98's preserved instrument measured 84 warnings at these eight source sites. Its complete implementation
 * labelled 68 imported positions and left 16 root-file positions bare; the brief's "60" was neither the total
 * nor the imported subset. Keeping the measured denominator and partition here makes that correction fail loud.
 */
const BASELINE = Object.freeze({ warnings: 84, imported: 68, root: 16, sites: 8 });

const SITES: readonly Site[] = Object.freeze([
  { id: 'hex-odd', body: 'bytes public x = 0xabc;', warning: /hex literal '0xabc'/, symbol: '0xabc' },
  {
    id: 'modern-gas',
    body: 'function f(address a) public { a.call{gas: 1}(hex""); require(true); }',
    warning: /'gas' call option is a no-op/,
    symbol: 'gas',
  },
  {
    id: 'legacy-gas',
    body: 'function f(address a) public { a.call.gas(1)(hex""); require(true); }',
    warning: /'gas' call option is a no-op/,
    symbol: 'gas',
  },
  {
    id: 'assembly',
    body: 'function f() public { assembly { OP_1 } require(true); }',
    warning: /inline assembly used/,
    symbol: 'assembly',
  },
  {
    id: 'address-to-bytes20',
    body: 'function f(address a) public pure returns (bytes20) { return bytes20(a); }',
    warning: /bytes20\(address\).*narrows/,
    symbol: 'bytes20(a)',
  },
  {
    id: 'bytes20-to-address',
    body: 'function f(bytes20 a) public pure returns (address) { return address(a); }',
    warning: /address\(bytes20\).*treats/,
    symbol: 'address(a)',
  },
  {
    id: 'integer-range',
    body: 'function f() public pure returns (uint8) { return uint8(300); }',
    warning: /integer literal 300.*exceeds uint8 range/,
    symbol: 'uint8(300)',
  },
  {
    id: 'bytes-range',
    body: 'function f() public pure returns (bytes1) { return bytes1(300); }',
    warning: /integer literal 300.*exceeds bytes1 range/,
    symbol: 'bytes1(300)',
  },
]);

function compileCapturing(source: string, imported: boolean): string[] {
  const logs: string[] = [];
  const original = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  const sink = (...args: unknown[]): void => { logs.push(args.map(String).join(' ')); };
  console.log = console.error = console.warn = console.info = sink;
  try {
    if (imported) {
      const resolver = (path: string): { source: string; id: string } | undefined => (
        path === './C.sol' ? { source, id: '/C.sol' } : undefined);
      compileString('pragma solidity ^0.8.20;\nimport "./C.sol";\ncontract Root is C {}\n', {
        solidityImportCompat: true, rootFileId: '/main.sol', importResolver: resolver,
        messageBus: false,
      });
    } else {
      compileString(source, {
        solidityImportCompat: true, rootFileId: '/main.sol', messageBus: false,
      });
    }
  } catch {
    // Some compatibility warnings precede an unrelated downstream refusal. The warning itself is the subject;
    // the per-site non-empty assertion below prevents an early throw from turning into a vacuous pass.
  } finally {
    console.log = original.log; console.error = original.error;
    console.warn = original.warn; console.info = original.info;
  }
  return logs;
}

describe('X98 imported diagnostic census', () => {
  it('reproduces the validated baseline partition and all eight sites remain named', () => {
    expect(BASELINE.warnings).toBe(BASELINE.imported + BASELINE.root);
    expect(BASELINE).toEqual({ warnings: 84, imported: 68, root: 16, sites: 8 });
    expect(SITES, 'an empty diagnostic census is never a result').not.toHaveLength(0);
    expect(SITES).toHaveLength(BASELINE.sites);
    expect(new Set(SITES.map(({ id }) => id)).size).toBe(SITES.length);
  });

  for (const site of SITES) {
    it(`${site.id}: labels the holding import and keeps the root spelling bare`, () => {
      const source = `pragma solidity ^0.8.20;\ncontract C {\n  ${site.body}\n}\n`;
      const imported = compileCapturing(source, true).filter((line) => site.warning.test(line));
      expect(imported, `${site.id}: warning site did not fire`).toHaveLength(1);
      expect(imported[0]).toContain('at line 3 of imported "/C.sol"');
      expect(source.split('\n')[2], `${site.id}: cited source line lost its discriminator`).toContain(site.symbol);

      const root = compileCapturing(source, false).filter((line) => site.warning.test(line));
      expect(root, `${site.id}: root guard did not fire`).toHaveLength(1);
      expect(root[0]).toMatch(/at line 3(?! of imported)/);
    });
  }
});
