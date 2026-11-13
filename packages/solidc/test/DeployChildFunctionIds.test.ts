import { describe, it, expect } from 'vitest';
import { compileStringMulti } from './direct-compile.js';

// A deploying contract embeds its child's compiled body; it never runs the child's functions. Function ids are
// numbered per contract, so a child's internal call must not count as an invocation in the factory. When it did,
// the factory's own function with the same id was OP_DEFINE'd as well as inlined, and the dead definition carried
// a second full copy of the child's body.

const CHILD = `
contract Child(int limit) {
    int counter;
    bytes32 seed;

    function mix(bytes32 a) internal pure returns (bytes32) {
        bytes32 z = a;
        for (int i = 0; i < 3; i = i + 1) { z = sha256(z); }
        return z;
    }

    function bump(int n) public {
        require(n < limit, "limit");
        this.counter = this.counter + n;
        this.seed = mix(this.seed);
    }
}`;

const FACTORY = `
contract Factory() {
    int created;

    function create(int limit) public {
        new Child(limit);
        this.created += 1;
    }
}`;

const occurrences = (haystack: string, needle: string): number => {
  let count = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    if (at % 2 === 0) count += 1;
  }
  return count;
};

describe('a deployed child\'s function ids stay out of the factory', () => {
  const artifacts = compileStringMulti(`pragma solidcash ^0.50.0;\n${CHILD}\n${FACTORY}`, { __legacyDeployFold: true } as never) as Record<string, any>;
  const factory = artifacts.Factory;
  const child = artifacts.Child;

  it('compiles the child with its own OP_DEFINE\'d internal function', () => {
    expect(Object.values(child.debug.invokeDebug ?? {}).map((entry: any) => entry.name)).toContain('mix');
  });

  it('embeds the child body exactly once', () => {
    const body: string = factory.abi.find((entry: any) => entry.name === 'create').deployTargets[0].creationBytecode;
    expect(body).toBe(child.debug.bytecode);
    expect(occurrences(factory.debug.bytecode, body)).toBe(1);
  });

  it('defines no subroutine for the factory\'s only entry point', () => {
    const names = Object.values(factory.debug.invokeDebug ?? {}).map((entry: any) => entry.name);
    expect(names).not.toContain('create');
  });
});
