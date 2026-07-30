import { describe, expect, it } from 'vitest';
import { asmToBytecode } from '@solidcash/utils';
import { compileString, compileStringSplit } from '../src/index.js';

const SOURCE = `
contract SplitCounter() {
    int x;
    int y;

    function setX(int value) {
        this.x = value;
        require(value >= 0);
    }

    function addX(int value) {
        this.x = this.x + value;
        require(value >= 0);
    }

    function setY(int value) {
        this.y = value;
        require(value >= 0);
    }

    function getX() view returns (int) {
        return this.x;
    }
}
`;

describe('large-contract state-local splitting', () => {
  it('preserves the ordinary compiler result when splitting is unnecessary', () => {
    const ordinary = compileString(SOURCE);
    const bundle = compileStringSplit(SOURCE);
    expect(bundle.facets).toEqual({});
    expect(bundle.root.bytecode).toBe(ordinary.bytecode);
    expect(bundle.manifest.routes.every((route) => route.target === 'root')).toBe(true);
  });

  it('prioritizes overlapping state access and packs disjoint groups when they fit', () => {
    const bundle = compileStringSplit(SOURCE, { forceSplit: true });
    const groups = bundle.manifest.facets.map((facet) => [...facet.functions].sort());
    expect(groups).toEqual([['addX', 'setX', 'setY']]);
    expect(bundle.manifest.routes.find((route) => route.function === 'getX')?.target).toBe('root');
    expect(bundle.manifest.routes.find((route) => route.function === 'setX')?.footprint.writes)
      .toContain('state:x');
  });

  it('emits branded delegate-only facets and a one-hop linked root', () => {
    const bundle = compileStringSplit(SOURCE, { forceSplit: true });
    for (const info of bundle.manifest.facets) {
      const facet = bundle.facets[info.name];
      expect(facet.isLibrary).toBe(true);
      expect(facet.brandedLibrary).toBe(true);
      expect(facet.delegateOnly).toBe(true);
      expect(facet.constructorInputs).toEqual([{ name: '__brand', type: 'bytes32' }]);
      // X149: `facet.bytecode` is an ASM LISTING, so `.length / 2` is half a CHARACTER count, not bytes -
      // one 1-byte opcode occupies `OP_CHECKSIGVERIFY `. This assertion encoded that error, which is why it
      // agreed with the planner's ruler until the ruler was corrected. Both now measure real bytes.
      expect(info.estimatedRedeemBytes).toBe(asmToBytecode(facet.bytecode).length);
      expect(bundle.root.constructorInputs.some((input) => input.name === info.linkArgument)).toBe(true);
    }
    expect(bundle.manifest.deploymentMode).toBe('immutable-one-hop');
  });

  it('is deterministic', () => {
    const a = compileStringSplit(SOURCE, { forceSplit: true });
    const b = compileStringSplit(SOURCE, { forceSplit: true });
    expect(a.manifest).toEqual(b.manifest);
    expect(a.root.bytecode).toBe(b.root.bytecode);
    expect(Object.fromEntries(Object.entries(a.facets).map(([name, art]) => [name, art.bytecode])))
      .toEqual(Object.fromEntries(Object.entries(b.facets).map(([name, art]) => [name, art.bytecode])));
  });

  it('keeps an internal call closure in one facet', () => {
    const source = `
      contract Closure() {
        int x;
        function helper(int value) internal { this.x = value; require(value >= 0); }
        function set(int value) { helper(value); require(value >= 0); }
        function reset() { helper(0); require(true); }
      }
    `;
    const bundle = compileStringSplit(source, { forceSplit: true });
    expect(bundle.manifest.facets).toHaveLength(1);
    expect([...bundle.manifest.facets[0].functions].sort()).toEqual(['reset', 'set']);
    expect(bundle.facets[bundle.manifest.facets[0].name].abi.some((fn) => fn.name === 'helper')).toBe(false);
  });

  it('fails closed when a measured facet or root cannot fit', () => {
    expect(() => compileStringSplit(SOURCE, { forceSplit: true, maxShardBytes: 100 }))
      .toThrow(/Cannot split 'SplitCounter'.*(facet|root)/);
  });

  /**
   * A call edge between two planned entries was ATOMIC: `hardClosureGroups` unioned them and nothing could
   * divide the result, so a union over the limit was a refusal with no remaining move. It is not atomic. The
   * caller's facet needs the callee's BODY, not its entry-point arm, and the arm is the expensive half once
   * the callee takes dynamic parameters - measured at 1,454 B of arm against 758 B of body for one
   * `(uint256, address[], address[])` callee. `compileFacet` now demotes a movable entry it did not receive
   * to a plain internal helper, so an oversized union can be dissolved into per-entry groups.
   *
   * The limit here is chosen from the two MEASURED sizes below, not guessed: it admits the caller's divided
   * facet and refuses the union. The control in the next test pins that a union which fits does not move.
   */
  it('divides a call-edge union that does not fit, and keeps the callee body in the caller facet', () => {
    const source = `pragma solidity ^0.8.7;
      contract Pair {
        uint total;
        uint count;
        uint other;
        mapping(uint256 => mapping(address => bool)) whitelist;
        function publish(uint256 jobId_, address[] calldata allowed_) public {
          other = jobId_;
          updateWhitelist(jobId_, allowed_, allowed_);
          require(jobId_ >= 0, "neg");
        }
        function updateWhitelist(uint256 jobId_, address[] calldata a_, address[] calldata d_) public {
          for (uint256 i = 0; i < a_.length; i++) { whitelist[jobId_][a_[i]] = true; count = count + 1; }
          for (uint256 i = 0; i < d_.length; i++) { whitelist[jobId_][d_[i]] = false; total = total + 1; }
          require(jobId_ >= 0, "neg");
        }
      }`;
    const options = { solidityImportCompat: true, forceSplit: true };
    const union = compileStringSplit(source, options);
    const unionBytes = union.manifest.facets[0].estimatedRedeemBytes;
    expect([...union.manifest.facets[0].functions].sort()).toEqual(['publish', 'updateWhitelist']);

    const divided = compileStringSplit(source, { ...options, maxShardBytes: unionBytes - 1 });
    const groups = divided.manifest.facets.map((facet) => [...facet.functions].sort()).sort();
    expect(groups).toEqual([['publish'], ['updateWhitelist']]);

    // The caller's facet still carries the callee body - it must, the call is unconditional - but no longer
    // its selector arm, which is the whole saving. Both facts are asserted, so a dropped body cannot pass.
    const publishFacet = divided.manifest.facets.find((facet) => facet.functions.includes('publish'))!;
    expect(divided.facets[publishFacet.name].abi.some((fn) => fn.name === 'updateWhitelist')).toBe(false);
    const absent = compileStringSplit(`pragma solidity ^0.8.7;
      contract Pair {
        uint other;
        function publish(uint256 jobId_, address[] calldata allowed_) public {
          other = jobId_ + allowed_.length; require(jobId_ >= 0, "neg");
        }
        function second(uint256 v) public { other = v + 1; require(v >= 0, "neg"); }
      }`, options);
    const absentBytes = Math.max(...absent.manifest.facets.map((facet) => facet.estimatedRedeemBytes));
    expect(publishFacet.estimatedRedeemBytes).toBeGreaterThan(absentBytes);
    expect(publishFacet.estimatedRedeemBytes).toBeLessThan(unionBytes);
    // Each divided route still resolves, and to DIFFERENT facets.
    const publishRoute = divided.manifest.routes.find((route) => route.function === 'publish')!;
    const updateRoute = divided.manifest.routes.find((route) => route.function === 'updateWhitelist')!;
    expect(publishRoute.target).not.toBe('root');
    expect(updateRoute.target).not.toBe('root');
    expect(publishRoute.target).not.toBe(updateRoute.target);
  });

  it('CONTROL: a call-edge union that fits is not divided and keeps both entries in one facet', () => {
    const bundle = compileStringSplit(`pragma solidity ^0.8.7;
      contract Closure {
        uint x;
        function set(uint value) public { reset(); x = value; require(value >= 0, "n"); }
        function reset() public { x = 0; require(true, "n"); }
      }`, { solidityImportCompat: true, forceSplit: true });
    expect(bundle.manifest.facets).toHaveLength(1);
    expect([...bundle.manifest.facets[0].functions].sort()).toEqual(['reset', 'set']);
    expect(bundle.facets[bundle.manifest.facets[0].name].abi.some((fn) => fn.name === 'reset')).toBe(true);
  });

  it('uses constant mapping keys as disjoint regions and dynamic keys as wildcard aliases', () => {
    const constants = compileStringSplit(`
      contract Regions() {
        mapping(int => int) values;
        function one(int v) { this.values[1] = v; require(v >= 0); }
        function two(int v) { this.values[2] = v; require(v >= 0); }
      }
    `, { forceSplit: true });
    expect(constants.manifest.facets).toHaveLength(1);
    expect(constants.manifest.routes.find((route) => route.function === 'one')?.footprint.writes)
      .toEqual(['collection:values:1']);
    expect(constants.manifest.routes.find((route) => route.function === 'two')?.footprint.writes)
      .toEqual(['collection:values:2']);

    const wildcard = compileStringSplit(`
      contract Regions() {
        mapping(int => int) values;
        function one(int v) { this.values[1] = v; require(v >= 0); }
        function any(int k, int v) { this.values[k] = v; require(v >= 0); }
      }
    `, { forceSplit: true });
    expect(wildcard.manifest.facets).toHaveLength(1);
    expect(wildcard.manifest.routes.find((route) => route.function === 'any')?.footprint.writes)
      .toEqual(['collection:values:*']);
  });

  it('fails closed on overloaded entry points until routing is selector-keyed', () => {
    expect(() => compileStringSplit(`
      contract Overloads() {
        int x;
        function set(int v) { this.x = v; require(v >= 0); }
        function set(bool v) { this.x = v ? 1 : 0; require(true); }
      }
    `, { forceSplit: true })).toThrow(/overloaded entry points.*set/i);
  });

  it('plans after inheritance and modifier expansion', () => {
    const bundle = compileStringSplit(`
      contract Base() {
        int x;
        modifier positive(int v) { require(v >= 0); _; }
        function inheritedSet(int v) public positive(v) { this.x = v; require(v >= 0); }
      }
      contract Derived() is Base() {
        function add(int v) public positive(v) { this.x = this.x + v; require(v >= 0); }
      }
    `, { forceSplit: true });
    const routed = bundle.manifest.routes.filter((route) => ['inheritedSet', 'add'].includes(route.function));
    expect(routed).toHaveLength(2);
    expect(new Set(routed.map((route) => route.target)).size).toBe(1);
    expect(routed[0].target).not.toBe('root');
  });

  it('does not revalidate resolved override bases on synthetic facets', () => {
    const bundle = compileStringSplit(`
      contract Base() {
        int x;
        function set(int v) public virtual { this.x = v; require(v >= 0); }
      }
      contract Derived() is Base() {
        function set(int v) public override(Base) { this.x = v + 1; require(v >= 0); }
        function reset() public { this.x = 0; require(true); }
      }
    `, { forceSplit: true });
    expect(bundle.manifest.routes.find((route) => route.function === 'set')?.target).not.toBe('root');
  });

  it('keeps compiler-generated maintenance entry points on the root', () => {
    const bundle = compileStringSplit(`
      contract OracleUser() {
        uint seen;
        function record() public { this.seen = block.number; require(true); }
        function reset() public { this.seen = 0; require(true); }
      }
    `, { forceSplit: true });
    expect(bundle.manifest.routes.find((route) => route.function === '__updateBlockOracle')?.target).toBe('root');
  });

  it('does not compile the logical constructor into inherited-function facets', () => {
    const bundle = compileStringSplit(`
      contract Base() {
        int total;
        function _mint(int v) internal { this.total = v; require(v >= 0); }
        function transfer(int v) public { this.total = v; require(v >= 0); }
      }
      contract Derived() is Base() {
        constructor(int supply) { _mint(supply); }
        function burn(int v) public { this.total = this.total - v; require(v >= 0); }
      }
    `, { forceSplit: true });
    expect(Object.values(bundle.facets).every((facet) => facet.constructorInputs
      .every((input) => input.name !== 'supply'))).toBe(true);
    expect(bundle.manifest.routes.find((route) => route.function === 'transfer')?.target).not.toBe('root');
  });

  it('moves return-valued state transitions with their state-affinity group', () => {
    const bundle = compileStringSplit(`
      contract Returning() {
        int x;
        function set(int v) returns (int) { this.x = v; require(v >= 0); return v; }
        function reset() { this.x = 0; require(true); }
      }
    `, { forceSplit: true });
    const setTarget = bundle.manifest.routes.find((route) => route.function === 'set')?.target;
    expect(setTarget).not.toBe('root');
    expect(bundle.manifest.routes.find((route) => route.function === 'reset')?.target).toBe(setTarget);
    const setAbi = bundle.facets[setTarget!].abi.find((fn) => fn.name === 'set');
    expect(setAbi?.outputs).toEqual([{ type: 'int256' }]);
    expect(setAbi?.blockLayout?.slots.some((slot) => slot.kind === 'returnEvent')).toBe(true);
  });

  it('covenants the complete genesis state layout even when the constructor leaves a field untouched', () => {
    const artifact = compileString(`
      contract Genesis() {
        int initialized;
        int untouched;
        constructor(int value) { this.initialized = value; }
        function read() view returns (int) { return this.untouched; }
      }
    `, { commitmentLimit: 8 });
    const constructorAbi = artifact.abi.find((fn) => fn.name === '__construct');
    expect(artifact.stateLayout?.dataNftCount).toBeGreaterThan(1);
    expect(constructorAbi?.requiredNftIndices).toEqual(
      Array.from({ length: artifact.stateLayout!.dataNftCount }, (_, index) => index),
    );
  });

});
