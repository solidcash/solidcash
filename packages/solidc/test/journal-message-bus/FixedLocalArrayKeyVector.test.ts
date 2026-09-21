import { bytecodeToAsm } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const compile = (body: string, parameters = 'int count, int base') => compileString(`contract C() {
  mapping(int => int) values;
  function write(${parameters}) public {
    ${body}
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.values[keys[cursor]] = cursor + 10;
    }
    require(true);
  }
}`, OPTIONS);

describe('fixed local array key vectors', () => {
  it('replays one exact dominating definition for every fixed-vector element', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function write(int count, int base) public {
        int[3] memory keys;
        keys[0] = base;
        keys[1] = base + 2;
        keys[2] = base + 4;
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor + 10;
        }
        require(true);
      }
    }`, {
      ...OPTIONS,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it.each([
    ['partial', `int[3] memory keys; keys[0] = base; keys[2] = base + 4;`],
    ['reassigned', `int[3] memory keys; keys[0] = base; keys[1] = base + 2;
      keys[2] = base + 4; keys[1] = base + 3;`],
    ['conditional', `int[3] memory keys; keys[0] = base;
      if (choose) { keys[1] = base + 2; } keys[2] = base + 4;`],
  ])('keeps a %s fixed vector fenced', (_name, body) => {
    const artifact = compile(body, _name === 'conditional'
      ? 'int count, int base, bool choose' : undefined);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('preserves an exact fixed vector through one memory alias', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function write(int count, int base) public {
        int[3] memory source;
        source[0] = base;
        source[1] = base + 2;
        source[2] = base + 4;
        int[3] memory keys = source;
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor + 10;
        }
        require(true);
      }
    }`, {
      ...OPTIONS,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it.each([
    ['partial source', `source[0] = base; source[2] = base + 4;`],
    ['source mutation after alias', `source[0] = base; source[1] = base + 2;
      source[2] = base + 4;`, `source[1] = base + 3;`],
    ['alias mutation', `source[0] = base; source[1] = base + 2;
      source[2] = base + 4;`, `keys[1] = base + 3;`],
  ])('keeps an alias with %s fenced', (_name, definitions, mutation = '') => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function write(int count, int base) public {
        int[3] memory source;
        ${definitions}
        int[3] memory keys = source;
        ${mutation}
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('keeps a second alias hop fenced', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function write(int count, int base) public {
        int[3] memory source;
        source[0] = base; source[1] = base + 2; source[2] = base + 4;
        int[3] memory middle = source;
        int[3] memory keys = middle;
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('replays a complete fixed vector returned by one acyclic pure helper', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function make(int base) internal pure returns (int[3] memory) {
        int[3] memory result;
        result[0] = base;
        result[1] = base + 2;
        result[2] = base + 4;
        return result;
      }
      function write(int count, int base) public {
        int[3] memory keys = make(base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, {
      ...OPTIONS,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it.each([
    ['partial result', `result[0] = base; result[2] = base + 4;`],
    ['reassigned result', `result[0] = base; result[1] = base + 2;
      result[2] = base + 4; result[1] = base + 3;`],
    ['branched result', `result[0] = base; if (choose) { result[1] = base + 2; }
      result[2] = base + 4;`],
  ])('keeps a pure helper with a %s fenced', (_name, assignments) => {
    const conditional = _name === 'branched result';
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function make(int base${conditional ? ', bool choose' : ''}) internal pure returns (int[3] memory) {
        int[3] memory result;
        ${assignments}
        return result;
      }
      function write(int count, int base${conditional ? ', bool choose' : ''}) public {
        int[3] memory keys = make(base${conditional ? ', choose' : ''});
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('keeps a returned vector fenced after caller mutation', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function make(int base) internal pure returns (int[3] memory) {
        int[3] memory result;
        result[0] = base; result[1] = base + 2; result[2] = base + 4;
        return result;
      }
      function write(int count, int base) public {
        int[3] memory keys = make(base);
        keys[1] = base + 3;
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('expands one exactly resolved pure scalar helper without cloning its call node', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function element(int base) internal pure returns (int) { return base + 1; }
      function element(bigint base) internal pure returns (bigint) { return base + 100; }
      function make(int base) internal pure returns (int[3] memory) {
        int[3] memory result;
        result[0] = base;
        result[1] = element(base);
        result[2] = base + 4;
        return result;
      }
      function write(int count, int base) public {
        int[3] memory keys = make(base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, {
      ...OPTIONS,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it('keeps a recursive scalar producer fenced', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function element(int base) internal pure returns (int) {
        return base == 0 ? 0 : element(base - 1);
      }
      function make(int base) internal pure returns (int[3] memory) {
        int[3] memory result;
        result[0] = base; result[1] = element(base); result[2] = base + 4;
        return result;
      }
      function write(int count, int base) public {
        int[3] memory keys = make(base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('merges an exhaustive two-arm element definition into one typed conditional', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function write(int count, int base, bool choose) public {
        int[3] memory keys;
        keys[0] = base;
        if (choose) { keys[1] = base + 2; } else { keys[1] = base + 3; }
        keys[2] = base + 4;
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, {
      ...OPTIONS,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it.each([
    ['non-exhaustive arm', `if (choose) { keys[1] = base + 2; }`],
    ['different arm indices', `if (choose) { keys[1] = base + 2; } else { keys[2] = base + 3; }`],
    ['mutation after join', `if (choose) { keys[1] = base + 2; } else { keys[1] = base + 3; }
      keys[1] = base + 5;`],
  ])('keeps a fixed conditional vector with a %s fenced', (_name, branch) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function write(int count, int base, bool choose) public {
        int[3] memory keys;
        keys[0] = base;
        ${branch}
        keys[2] = base + 4;
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('merges an exhaustive finite switch element definition in source case order', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function write(int count, int base, int mode) public {
        int[3] memory keys;
        keys[0] = base;
        switch (mode) {
          case 0: keys[1] = base + 2; break;
          case 1: keys[1] = base + 3; break;
          default: keys[1] = base + 5;
        }
        keys[2] = base + 6;
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, {
      ...OPTIONS,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it.each([
    ['no default', `case 0: keys[1] = base + 2; break; case 1: keys[1] = base + 3; break;`],
    ['fallthrough', `case 0: keys[1] = base + 2; case 1: keys[1] = base + 3; break;
      default: keys[1] = base + 5;`],
    ['different index', `case 0: keys[1] = base + 2; break; case 1: keys[2] = base + 3; break;
      default: keys[1] = base + 5;`],
    ['an extra mutation', `case 0: keys[1] = base + 2; keys[0] = base + 7; break;
      case 1: keys[1] = base + 3; break; default: keys[1] = base + 5;`],
  ])('keeps a fixed switch vector with %s fenced', (_name, cases) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function write(int count, int base, int mode) public {
        int[3] memory keys;
        keys[0] = base;
        switch (mode) { ${cases} }
        keys[2] = base + 6;
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('keeps a fixed switch vector fenced after mutation', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function write(int count, int base, int mode) public {
        int[3] memory keys;
        keys[0] = base;
        switch (mode) {
          case 0: keys[1] = base + 2; break;
          default: keys[1] = base + 3;
        }
        keys[1] = base + 4;
        keys[2] = base + 5;
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.values[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });
});
