import { describe, expect, it, vi } from 'vitest';
import { encodeInt } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';
import { VersionError } from '../src/index.js';
import { createMapResolver } from '../src/createMapResolver.js';
import { compileString } from './direct-compile.js';

// Compiler behaviour ported from CashScript 0.14.0 (see docs/framed/UPSTREAM_0140_PORT.md for the upstream commits).

const DATE_SOURCE = `contract Test() {
  function test() {
    int d = date("2021-02-17T01:30:00");
    require(d == 0);
  }
}`;

describe('date literals', () => {
  it('are read as UTC whatever the time zone of the compiling process', () => {
    const utcTimestamp = binToHex(encodeInt(BigInt(Date.UTC(2021, 1, 17, 1, 30) / 1000)));
    const previous = process.env.TZ;
    try {
      process.env.TZ = 'America/New_York';
      // The zone has to take effect, or this test could not tell a local reading from a UTC one
      expect(new Date('2021-02-17T01:30:00').getTime()).not.toBe(Date.UTC(2021, 1, 17, 1, 30));
      expect(compileString(DATE_SOURCE).bytecode).toContain(utcTimestamp);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});

describe('warningListener', () => {
  const SOURCE = `contract C() {
    fallback() external {
      require(tx.version >= 1);
    }
  }`;

  it('delivers a compiler warning to warningListener instead of the console', () => {
    const warnings: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      compileString(SOURCE, {
        warningListener: (warning) => { warnings.push(warning.message); },
      });
    } finally {
      log.mockRestore();
    }

    expect(warnings.some((message) => message.includes('fallback() is a Solidity compatibility feature'))).toBe(true);
    expect(log.mock.calls.some((call) => String(call[0]).includes('Warning:'))).toBe(false);
  });

  it('suppressWarnings discards warnings, including for a listener on the same compile', () => {
    const warnings: string[] = [];
    compileString(SOURCE, {
      suppressWarnings: true,
      warningListener: (warning) => { warnings.push(warning.message); },
    });
    expect(warnings).toEqual([]);
  });
});

describe('LockingBytecodeNullData', () => {
  it('requires a chunk sized at runtime to fit OP_PUSHDATA1, instead of dropping the length high byte', () => {
    const artifact = compileString(`contract C() {
      function spend(bytes data) {
        bytes lb = new LockingBytecodeNullData([data]);
        require(tx.outputs[0].lockingBytecode == lb);
      }
    }`);

    expect(artifact.bytecode).toContain('OP_2 OP_NUM2BIN OP_1 OP_SPLIT 00 OP_EQUALVERIFY 4c OP_SWAP OP_CAT');
  });
});

describe('compileString files', () => {
  const ROOT = `import "./math.scash";
contract Calculator() {
  function check(int a) {
    require(double(a) == 4);
  }
}`;
  const MATH = 'function double(int x) pure returns (int) { return x * 2; }';

  it('resolves imports from an in-memory map of sources', () => {
    const fromFiles = compileString(ROOT, { files: { 'math.scash': MATH } });
    const fromResolver = compileString(ROOT, { importResolver: createMapResolver({ 'math.scash': MATH }) });

    expect(fromFiles.bytecode).toBe(fromResolver.bytecode);
  });

  it('refuses files beside an import resolver', () => {
    expect(() => compileString(ROOT, { files: { 'math.scash': MATH }, importResolver: () => undefined }))
      .toThrow('Pass either files or importResolver');
  });
});

describe('version pragmas', () => {
  it('name the imported file whose pragma the compiler does not satisfy', () => {
    const files = { 'lib.scash': 'pragma solidcash >=99.0.0;\nfunction one() pure returns (int) { return 1; }' };
    const compile = (): unknown => compileString(`import "./lib.scash";
contract C() {
  function check() {
    require(one() == 1);
  }
}`, { files });

    expect(compile).toThrow(VersionError);
    expect(compile).toThrow("does not satisfy version constraint >=99.0.0 (from pragma in imported file 'lib.scash')");
  });
});
