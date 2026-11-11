import { describe, it, expect } from 'vitest';
import { compileStringMulti } from './direct-compile.js';

// A deploying contract checks its child's genesis against the child's constructor, folded into expressions it
// can evaluate. A field the constructor sets by a step that does not fold was checked against its type default, so
// the child was created in a state its source never reaches. The compiler refuses that deploy instead.

const factory = (child: string): string => `pragma solidcash ^0.14.0;
${child}
contract Factory() {
    int created;

    function create(int limit) public {
        new Child(limit);
        this.created += 1;
    }
}`;

describe('a child whose constructor does not fold cannot be deployed with new', () => {
  it('refuses a constructor that builds a field in a loop', () => {
    const source = factory(`
contract Child(int limit) {
    bytes32 seed;
    constructor() {
        bytes32 z = 0x00;
        for (int i = 0; i < 4; i = i + 1) { z = sha256(abi.encodePacked(z, z)); }
        this.seed = z;
    }
    function bump(int n) public { require(n < limit); this.seed = sha256(this.seed); }
}`);
    expect(() => compileStringMulti(source)).toThrow(/does not fold/);
  });

  it('refuses even when a later statement folds', () => {
    const source = factory(`
contract Child(int limit) {
    bytes32 seed;
    int count;
    constructor() {
        bytes32 z = 0x00;
        for (int i = 0; i < 4; i = i + 1) { z = sha256(abi.encodePacked(z, z)); }
        this.seed = z;
        this.count = 7;
    }
    function bump(int n) public { require(n < limit); this.count = this.count + n; }
}`);
    expect(() => compileStringMulti(source)).toThrow(/does not fold/);
  });

  it('still deploys a child whose constructor folds, with the folded genesis', () => {
    const source = factory(`
contract Child(int limit) {
    bytes32 seed;
    int count;
    constructor() {
        this.seed = sha256(abi.encodePacked(bytes32(0x00)));
        this.count = limit + 1;
    }
    function bump(int n) public { require(n < limit); this.count = this.count + n; }
}`);
    const artifacts = compileStringMulti(source) as Record<string, any>;
    const target = artifacts.Factory.abi.find((entry: any) => entry.name === 'create').deployTargets[0];
    expect(target.genesisState?.fields.map((field: any) => field.name).sort()).toEqual(['count', 'seed']);
  });

  it('still deploys a child with no constructor', () => {
    const source = factory(`
contract Child(int limit) {
    int count;
    function bump(int n) public { require(n < limit); this.count = this.count + n; }
}`);
    expect(() => compileStringMulti(source)).not.toThrow();
  });
});
