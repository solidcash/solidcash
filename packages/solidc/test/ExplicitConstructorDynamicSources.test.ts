import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const constructorSources = (
  source: string,
): ReturnType<typeof compileString>['abi'][number]['dynamicWriteSources'] => compileString(source).abi
  .find((entry) => entry.name === '__construct')?.dynamicWriteSources;

describe('explicit constructor dynamic-write replay metadata', () => {
  it('replays ordered aliases, multiple writes, nested else-if arms, and ternary values', () => {
    const sources = constructorSources(`
      contract C() {
        int scalar;
        string selected;
        bytes memo;
        constructor(int route, bool flip, string left, string middle, string right, bytes a, bytes b) {
          this.scalar = 1;
          string aliasValue = left;
          if (flip) { aliasValue = middle; }
          if (route == 0) {
            this.selected = aliasValue;
          } else if (route == 1) {
            this.selected = right;
          } else {
            this.selected = flip ? middle : left;
          }
          this.scalar = 2;
          if (flip) { this.memo = a; } else { this.memo = b; }
        }
      }
    `);

    expect(Object.keys(sources ?? {}).sort()).toEqual(['memo', 'selected']);
    expect(sources?.memo).toMatchObject({ kind: 'ternary' });
    expect(sources?.selected).toMatchObject({
      kind: 'ternary',
      ifFalse: { kind: 'ternary' },
    });
    // The route-zero value was captured after the preceding alias branch, not resolved as pristine `left`.
    expect(sources?.selected).toMatchObject({
      ifTrue: { kind: 'ternary' },
    });
  });

  it('omits an incomplete arm but replays the final value after repeated writes', () => {
    const incomplete = constructorSources(`
      contract C() {
        string selected;
        constructor(bool choose, string value) {
          if (choose) { this.selected = value; }
        }
      }
    `);
    expect(incomplete?.selected).toBeUndefined();

    const repeated = constructorSources(`
      contract C() {
        string selected;
        constructor(bool choose, string left, string right) {
          if (choose) { this.selected = left; } else { this.selected = right; }
          if (choose) { this.selected = right; } else { this.selected = left; }
        }
      }
    `);
    expect(repeated?.selected).toMatchObject({ kind: 'ternary' });
  });

  it('omits metadata for a write a return can bypass but not for one only a revert can', () => {
    // A constructor `return` ends the construction successfully, so the write really is skipped on that path.
    const earlyReturn = constructorSources(`
      contract C() {
        string selected;
        constructor(bool stop, string value) {
          if (stop) { return; }
          this.selected = value;
        }
      }
    `);
    expect(earlyReturn?.selected).toBeUndefined();

    // A `revert` aborts the deployment, so no successful genesis exists on the path that reaches it and the
    // write is still the single assignment on every path that completes.
    const revertingArm = constructorSources(`
      contract C() {
        string selected;
        constructor(bool stop, string value) {
          if (stop) { revert("stopped"); }
          this.selected = value;
        }
      }
    `);
    expect(revertingArm?.selected).toMatchObject({ kind: 'source', source: { kind: 'forward', paramIndex: 1 } });
  });

  it('omits values that depend on prior state or an unserializable local mutation', () => {
    const stateDependent = constructorSources(`
      contract C() {
        bool route;
        string selected;
        constructor(bool choose, string left, string right) {
          this.route = choose;
          if (this.route) { this.selected = left; } else { this.selected = right; }
        }
      }
    `);
    expect(stateDependent?.selected).toBeUndefined();

    const localDependent = constructorSources(`
      contract C() {
        string selected;
        constructor(bool choose, string left, string right) {
          string aliasValue = left;
          if (choose) { aliasValue = make(right); }
          this.selected = aliasValue;
        }
        function make(string value) internal pure returns (string) { return value; }
      }
    `);
    expect(localDependent?.selected).toBeUndefined();
  });

  it('keeps a write a call to a global builtin precedes, which writes no state', () => {
    // A constructor that hashes its arguments before it stores them: a call to a global builtin computes a value
    // from its own operands and writes nothing, so it is not the unknown mutation the replay charges an unresolved
    // callee with. The charge used to blank the write count for the whole body, so the source of every dynamic
    // value such a constructor wrote went unpublished.
    const hashing = constructorSources(`
      contract C() {
        bytes32 digest;
        string label;
        constructor(bytes32 seed, string name) {
          this.digest = keccak256(seed);
          this.label = name;
        }
      }
    `);

    expect(hashing?.label).toMatchObject({ kind: 'source', source: { kind: 'forward', paramIndex: 1 } });
  });

  it('still omits a write a call the replay cannot rule out produces', () => {
    // The control: `string.concat` is not a global builtin, so the replay keeps charging the call as a possible
    // mutation of any dynamic value and the write stays unstated rather than approximated.
    const concatenated = constructorSources(`
      contract C() {
        bytes32 digest;
        string label;
        constructor(bytes32 seed, string left, string right) {
          this.digest = keccak256(seed);
          this.label = string.concat(left, right);
        }
      }
    `);

    expect(concatenated?.label).toBeUndefined();
  });
});
