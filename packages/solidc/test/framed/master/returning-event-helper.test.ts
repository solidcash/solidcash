import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { EmittingStateHelperEventError } from '../../../src/Errors.js';

/**
 * A helper that returns a value and emits, in the shape of an EVM access-control library's current role helpers:
 * `_grantRole(...) internal returns (bool)` writes and emits on one branch and returns whether it did.
 *
 * Behind OP_INVOKE such a helper's event would be dropped at its exit, which code generation refuses (X118,
 * `EmittingStateHelperEventError`). The helper is inlined into each caller instead, once its two returns are made
 * one tail return, and the caller emits the helper's event where the helper's branch does. That holds in both
 * conventions, whether the caller discards the result, returns it, binds it, branches on it or requires it, whether
 * the helper's other branch is an `else` or the statements after its `if`, and when the helper emits through a
 * helper it calls. A helper ending `if (c) return a; return b;` keeps the ternary the inliner makes of it, and a
 * helper that cannot be inlined keeps X118's refusal and its message.
 */

type Convention = 'direct' | 'framed';
const CONVENTIONS: readonly Convention[] = ['direct', 'framed'];

/** Compiles `source` in `convention` and returns contract `name`. */
function compile(source: string, convention: Convention, name = 'Roles'): Artifact {
  return compileStringMulti(source, {
    evmCompat: true, suppressWarnings: true,
    ...(convention === 'framed' ? { composition: 'framed' } : {}),
  } as never)[name]!;
}

/** The access-control helper, its other branch an `else` or the statements after its `if`. */
const grantHelper = (form: 'else' | 'after'): string[] => [
  '  function _grantRole(bytes32 role, address account) internal returns (bool) {',
  '    if (!hasRole(role, account)) {',
  '      _members[role][account] = true;',
  '      emit RoleGranted(role, account, msg.sender);',
  '      return true;',
  ...(form === 'else' ? ['    } else {', '      return false;', '    }'] : ['    }', '    return false;']),
  '  }',
];

/** One entry per use of the helper's result. The read stays behind `hasRole`, as the library writes it. */
const rolesSource = (form: 'else' | 'after'): string => [
  'pragma solidity ^0.8.20;',
  'contract Roles {',
  '  mapping(bytes32 => mapping(address => bool)) private _members;',
  '  uint256 public grants;',
  '  event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);',
  '  event Granted(bool changed);',
  '  function hasRole(bytes32 role, address account) public view returns (bool) { return _members[role][account]; }',
  '  function discarded(bytes32 role, address account) external { _grantRole(role, account); }',
  '  function returned(bytes32 role, address account) external returns (bool) { return _grantRole(role, account); }',
  '  function bound(bytes32 role, address account) external {',
  '    bool changed = _grantRole(role, account);',
  '    emit Granted(changed);',
  '  }',
  '  function branched(bytes32 role, address account) external { if (_grantRole(role, account)) { grants += 1; } }',
  '  function required(bytes32 role, address account) external {',
  '    require(_grantRole(role, account), "already a member");',
  '  }',
  ...grantHelper(form),
  '}',
].join('\n');

/** The events each entry's ABI says it emits, by name, in emit order. */
const emitted = (artifact: Artifact, entry: string): readonly string[] | undefined =>
  artifact.abi.find((candidate) => candidate.name === entry)?.emits?.map((emit) => emit.eventName);

/** The message X118 refuses helper `name` with. */
const refusal = (name: string): RegExp => new RegExp(`^Helper '${name}' emits an event and is invoked internally `
  + 'as a value-returning subroutine, whose event would be dropped at its exit\\. Move the emit into the calling '
  + 'entry point, or split the emit and the state write into separate helpers at Line \\d+, Column \\d+$');

/** Compiles `source` and returns what it threw. */
function thrown(source: string, convention: Convention): unknown {
  try {
    compile(source, convention, 'C');
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('a value-returning helper that emits, inlined into its callers', () => {
  const forms = [['in an else', 'else'], ['after its if', 'after']] as const;
  it.each(CONVENTIONS.flatMap((convention) => forms.map(([label, form]) => [convention, label, form] as const)))(
    'compiles %s with the helper\'s other branch %s, each entry carrying the helper\'s event',
    (convention, _label, form) => {
      const artifact = compile(rolesSource(form), convention);
      expect(artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
      for (const entry of ['discarded', 'returned', 'branched', 'required']) {
        expect(emitted(artifact, entry)).toStrictEqual(['RoleGranted']);
      }
      // The helper's event comes first: the entry's own emit follows the call that returned its operand.
      expect(emitted(artifact, 'bound')).toStrictEqual(['RoleGranted', 'Granted']);
      expect(artifact.abi.some((entry) => entry.name === '_grantRole')).toBe(false);
    },
  );

  it.each(CONVENTIONS)('compiles %s a helper that emits through a void helper it calls', (convention) => {
    const artifact = compile([
      'pragma solidity ^0.8.20;',
      'contract C {',
      '  uint256 public total;',
      '  event Added(uint256 n);',
      '  function announce(uint256 n) internal { emit Added(n); }',
      '  function tryAdd(uint256 n) internal returns (bool) {',
      '    if (n == 0) { return false; }',
      '    total += n;',
      '    announce(n);',
      '    return true;',
      '  }',
      '  function add(uint256 n) external returns (bool) { return tryAdd(n); }',
      '}',
    ].join('\n'), convention, 'C');
    expect(artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
    expect(emitted(artifact, 'add')).toStrictEqual(['Added']);
  });

  it.each(CONVENTIONS)('leaves %s a helper ending in one early return to the inliner, which makes it a ternary', (
    convention,
  ) => {
    const source = (tail: readonly string[]): string => [
      'pragma solidity ^0.8.20;',
      'contract C {',
      '  uint256 public total;',
      '  event Seen(uint256 n);',
      '  function note(uint256 n) internal returns (uint256) {',
      '    emit Seen(n);',
      ...tail,
      '  }',
      '  function run(uint256 n) external { total = note(n); }',
      '}',
    ].join('\n');
    expect(compile(source(['    if (n > 3) return n;', '    return 0;']), convention, 'C').bytecode)
      .toBe(compile(source(['    return n > 3 ? n : 0;']), convention, 'C').bytecode);
  });

  /** Helpers that stay subroutines: one that calls itself, one used as a value, one in an unhoistable position. */
  const notInlined: readonly (readonly [string, string, readonly string[]])[] = [
    ['calls itself', 'countDown', [
      '  function countDown(uint256 n) internal returns (uint256) {',
      '    if (n == 0) { emit Seen(n); return 0; }',
      '    return countDown(n - 1) + 1;',
      '  }',
      '  function run(uint256 n) external { total = countDown(n); }',
    ]],
    ['is used as a value', 'bump', [
      '  function bump(uint256 n) internal returns (uint256) {',
      '    if (n > 3) { emit Seen(n); return n; }',
      '    return 0;',
      '  }',
      '  function run(uint256 n) external {',
      '    function(uint256) internal returns (uint256) step = bump;',
      '    total = step(n);',
      '  }',
    ]],
    ['is called where only one arm evaluates it, in a mapping key', 'note', [
      '  mapping(uint256 => uint256) public values;',
      '  function note(uint256 n) internal returns (uint256) {',
      '    if (n > 3) { emit Seen(n); return n; }',
      '    return 0;',
      '  }',
      '  function run(uint256 n, bool on) external { values[on ? note(n) : n] = 1; }',
    ]],
  ];

  it.each(CONVENTIONS.flatMap((convention) => notInlined.map(([label, name, body]) =>
    [convention, label, name, body] as const)))('still refuses %s a helper that %s, by X118', (
    convention, _label, name, body,
  ) => {
    const error = thrown([
      'pragma solidity ^0.8.20;',
      'contract C {',
      '  uint256 public total;',
      '  event Seen(uint256 n);',
      ...body,
      '}',
    ].join('\n'), convention);
    expect(error).toBeInstanceOf(EmittingStateHelperEventError);
    expect((error as Error).message).toMatch(refusal(name));
  });
});
