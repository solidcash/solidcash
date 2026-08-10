import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

describe('constant internal-call folding', () => {
  it('removes the invoke and dead definition for a literal bool hook with inert arguments', () => {
    const artifact = compileString(
      'contract C { function hook(int unused) internal pure returns (bool) { return true; }'
      + ' function f(int value) { require(hook(value)); } }',
      { messageBus: false },
    );
    expect(artifact.bytecode).not.toContain('OP_DEFINE');
    expect(artifact.bytecode).not.toContain('OP_INVOKE');
  });

  it('keeps evaluating a non-trivial argument expression', () => {
    const artifact = compileString(
      'contract C { function hook(int unused) internal pure returns (bool) { return true; }'
      + ' function f(int value) { require(hook(value + 1)); } }',
      { messageBus: false },
    );
    expect(artifact.bytecode).toContain('OP_DEFINE');
    expect(artifact.bytecode).toContain('OP_INVOKE');
  });

  it('folds a trivial immutable getter into its caller', () => {
    const artifact = compileString(
      'contract C(int immutable admin) {'
      + ' function getAdmin() internal view returns (int) { return admin; }'
      + ' function f(int expected) { require(getAdmin() == expected); } }',
      { messageBus: false },
    );
    expect(artifact.bytecode).not.toContain('OP_DEFINE');
    expect(artifact.bytecode).not.toContain('OP_INVOKE');
  });

  it('removes an empty extension hook and its inert arguments', () => {
    const artifact = compileString(
      'contract C { function hook(int unused) internal pure {}'
      + ' function f(int value) { hook(value); require(value > 0); } }',
      { messageBus: false },
    );
    expect(artifact.bytecode).not.toContain('OP_DEFINE');
    expect(artifact.bytecode).not.toContain('OP_INVOKE');
  });

  it('retains an empty hook call when its argument must be evaluated', () => {
    const artifact = compileString(
      'contract C { function hook(int unused) internal pure {}'
      + ' function f(int value) { hook(value + 1); require(value > 0); } }',
      { messageBus: false },
    );
    expect(artifact.bytecode).toContain('OP_DEFINE');
    expect(artifact.bytecode).toContain('OP_INVOKE');
  });

});
