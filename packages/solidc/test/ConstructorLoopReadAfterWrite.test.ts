import { describe, expect, it } from 'vitest';
import { decodeAuthenticationInstructions, hexToBin } from '@bitauth/libauth';
import { ConstructorStaleReadError } from '../src/Errors.js';
import { compileString } from './direct-compile.js';

/**
 * A direct constructor loop's read of an entry the loop's earlier turns may have written.
 *
 * The loop keeps a log of its turns' writes of the collection, each write's key hash and the value it stores, and a
 * read inside the loop takes the last value logged under its own key hash over the one from before the loop. So the
 * uniqueness check of a member loop sees the members its earlier turns added and refuses a repeat, as the EVM's
 * does. A read the log does not reach, after its loop or in a later one, stays refused.
 */

const PRAGMA = 'pragma solidity ^0.8.26;';

/** A member registry whose constructor adds each member once; `check` is the loop's read of the member entry. */
const registry = (check: string): string => `${PRAGMA} contract Registry {
  address[] public members;
  mapping(address => bool) public isMember;
  uint256 public quorum;
  constructor(address[] memory _members, uint256 _quorum) {
    require(_members.length > 0, "members required");
    for (uint256 i = 0; i < _members.length; i++) {
      address member = _members[i];
      require(member != address(0), "invalid member");
      ${check}
      isMember[member] = true;
      members.push(member);
    }
    quorum = _quorum;
  }
}`;

/** A contract whose constructor runs `body` over the key arrays `ks` and `js`. */
const seen = (body: string): string => `${PRAGMA} contract Seen {
  mapping(uint256 => bool) seen;
  constructor(uint256[] memory ks, uint256[] memory js) { ${body} }
  function check(uint256 k) public view returns (bool) { return seen[k]; }
}`;

const compile = (source: string): ReturnType<typeof compileString> => compileString(source, { evmCompat: true });

/** The stale-read refusal `source` draws, or undefined when it compiles. */
function refusal(source: string): string | undefined {
  try {
    compile(source);
    return undefined;
  } catch (error) {
    if (error instanceof ConstructorStaleReadError) return error.message;
    throw error;
  }
}

/** The loops a compile's script and function bodies close, each body decoded from its hex. */
const loops = (source: string): number => {
  const artifact = compile(source);
  const inBodies = Object.values(artifact.functionBodies ?? {})
    .flatMap((hex) => decodeAuthenticationInstructions(hexToBin(hex)))
    .filter((instruction) => instruction.opcode === 0x66).length;
  return artifact.bytecode.split(' ').filter((op) => op === 'OP_UNTIL').length + inBodies;
};

describe('a direct constructor loop that reads an entry its earlier turns may have written', () => {
  it('compiles the member loop, its uniqueness check scanning what the earlier turns wrote', () => {
    const checked = registry('require(!isMember[member], "member not unique");');
    expect(refusal(checked)).toBeUndefined();
    expect(loops(checked)).toBeGreaterThan(loops(registry('')));
  });

  it('compiles a read of another key the earlier turns may have written', () => {
    expect(refusal(seen('for (uint256 i = 0; i < ks.length; i++) {'
      + ' require(!seen[js[i]], "seen"); seen[ks[i]] = true; }'))).toBeUndefined();
  });

  it('refuses a read after the loop, which the log does not outlive', () => {
    expect(refusal(seen('for (uint256 i = 0; i < ks.length; i++) { seen[ks[i]] = true; }'
      + ' require(!seen[js[0]], "seen");'))).toContain('in a loop is not supported');
  });

  it('refuses a read in a later loop, which the earlier loop\'s log does not reach', () => {
    expect(refusal(seen('for (uint256 i = 0; i < ks.length; i++) { seen[ks[i]] = true; }'
      + ' for (uint256 j = 0; j < js.length; j++) { require(!seen[js[j]], "seen"); }')))
      .toContain('in a loop is not supported');
  });
});
