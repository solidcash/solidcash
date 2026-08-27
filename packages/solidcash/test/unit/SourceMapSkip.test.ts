import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { FailedRequireError } from '../../src/Errors.js';

describe('source map skip on VM errors', () => {
  it('attributes a require failure from require.line when the artifact has no source map', () => {
    const artifact = {
      contractName: 'Store',
      source: 'contract Store() {\n  function set() {\n    require(false, "nope");\n  }\n}\n',
      debug: { bytecode: '', sourceMap: '', logs: [], requires: [] },
    } as Artifact;
    const error = new FailedRequireError(
      artifact, 0, { ip: 0, line: 3, message: 'nope' }, 0, 'bitauth:',
    );
    expect(error.message).toContain('Store.scash:3');
    expect(error.message).toContain('at line 3');
    expect(error.message).toContain('require(false, "nope");');
    expect(error.message).not.toContain('Failing statement: <unknown>');
  });
});
