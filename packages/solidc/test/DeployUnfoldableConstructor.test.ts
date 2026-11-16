import { describe, it, expect } from 'vitest';
import { compileStringMulti } from './direct-compile.js';

// A deploying contract used to check its child's genesis against the child's constructor, folded into expressions
// it could evaluate; a step that did not fold was refused. Since B10 every stateful `new` binds a deployer
// instead, so the constructor runs inside the deployer at creation time and there is no folded genesis to refuse.
// These cases now assert the deployer binding; the old refusal belongs to the removed fold path.

const factory = (child: string): string => `pragma solidcash ^0.51.0;
${child}
contract Factory() {
    int created;

    function create(int limit) public {
        new Child(limit);
        this.created += 1;
    }
}`;

describe('a stateful new binds a deployer whatever its constructor folds', () => {
  it('binds a deployer for a constructor that builds a field in a loop', () => {
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
    const artifacts = compileStringMulti(source) as Record<string, any>;
    expect(artifacts.Factory.childDeployers?.Child).toBeDefined();
    const target = artifacts.Factory.abi.find((entry: any) => entry.name === 'create').deployTargets[0];
    expect(target.genesisState).toBeUndefined();
  });

  it('binds a deployer even when a later statement would fold', () => {
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
    const artifacts = compileStringMulti(source) as Record<string, any>;
    expect(artifacts.Factory.childDeployers?.Child).toBeDefined();
    const target = artifacts.Factory.abi.find((entry: any) => entry.name === 'create').deployTargets[0];
    expect(target.genesisState).toBeUndefined();
  });

  it('still deploys a child whose constructor folds, through its deployer', () => {
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
    expect(artifacts.Factory.childDeployers?.Child).toBeDefined();
    const target = artifacts.Factory.abi.find((entry: any) => entry.name === 'create').deployTargets[0];
    expect(target.genesisState).toBeUndefined();
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
