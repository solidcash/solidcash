import { describe, expect, it } from 'vitest';
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

  it('groups overlapping state access and separates disjoint state', () => {
    const bundle = compileStringSplit(SOURCE, { forceSplit: true });
    const groups = bundle.manifest.facets.map((facet) => [...facet.functions].sort());
    expect(groups).toContainEqual(['addX', 'setX']);
    expect(groups).toContainEqual(['setY']);
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
      expect(info.estimatedRedeemBytes).toBe(facet.bytecode.length / 2);
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

  it('uses constant mapping keys as disjoint regions and dynamic keys as wildcard aliases', () => {
    const constants = compileStringSplit(`
      contract Regions() {
        mapping(int => int) values;
        function one(int v) { this.values[1] = v; require(v >= 0); }
        function two(int v) { this.values[2] = v; require(v >= 0); }
      }
    `, { forceSplit: true });
    expect(constants.manifest.facets).toHaveLength(2);
    expect(constants.manifest.routes.find((route) => route.function === 'one')?.footprint.writes)
      .toEqual(['collection:values:1']);

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

});
