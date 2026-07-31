import { describe, expect, it } from 'vitest';
import { asmToBytecode } from '@solidcash/utils';
import { compileString, compileStringSplit } from '../src/index.js';
import { assertSplitLayoutsAgree } from '../src/compiler.js';

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
    // `.every` is true on an EMPTY array, so the route set has to be pinned before its targets are judged -
    // otherwise a manifest that lost every route keeps this green.
    expect(bundle.manifest.routes.map((route) => route.function).sort())
      .toEqual(['addX', 'getX', 'setX', 'setY']);
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

  /**
   * X162/X166. The split planner never compared the root's storage layout against its facets'. The manifest
   * fingerprint was taken from the unsplit BASELINE and checked against nothing the bundle contains, and two
   * orderings in the split path were shard-dependent: `LowerStorageSlotPointers` appends one hidden state
   * variable per ERC-7201 namespace in the order the SURVIVING functions first reach it, and `prepareSplitAst`
   * ran `SynthesizeBlockOracle` earlier than the ordinary pipeline. Measured on the corpus MarketplaceV1:
   * baseline, root, five facets and a sixth carried FOUR layouts - root slot 2.0 was `OwnableStorage___owner`
   * where five of six facets put `PausableStorage___paused`, and the baseline put the namespaces at 0.8-0.11
   * with `__block_timestamp@0.12`. Every shard fit and the bundle compiled clean; the SDK refused it at load,
   * so it could not be deployed - but a delegate facet writes the ROOT's state through physical slots, and the
   * divergence IS spendable once a transaction is built around it (see the SDK's SplitLayoutAgreementX162).
   *
   * Both passes now run in `prepareSplitAst`, on the complete function set, in the ordinary pipeline's
   * relative order. The corpus-free reproduction of the refusal is the subject here, and it now AGREES.
   */
  it('emits one storage layout across the baseline, the root and every facet', () => {
    const source = `pragma solidity ^0.8.7;
      abstract contract AMod {
        struct AStorage { uint256 a; }
        bytes32 private constant ALoc = 0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;
        function _a() private pure returns (AStorage storage $) { assembly { $.slot := ALoc } }
        function _setA(uint256 v) internal { AStorage storage $ = _a(); $.a = v; }
      }
      abstract contract BMod {
        struct BStorage { uint256 b; }
        bytes32 private constant BLoc = 0xcd5ed15c6e187e77e9aee88184c21f4f2182ab5827cb3b7e07fbedcd63f03300;
        function _b() private pure returns (BStorage storage $) { assembly { $.slot := BLoc } }
        function _setB(uint256 v) internal { BStorage storage $ = _b(); $.b = v; }
      }
      abstract contract CMod {
        struct CStorage { uint256 c; }
        bytes32 private constant CLoc = 0x237e158222e3e6968b72b9db0d8043aacf074ad9f650f0d1606b4d82ee432c00;
        function _c() private pure returns (CStorage storage $) { assembly { $.slot := CLoc } }
        function _setC(uint256 v) internal { CStorage storage $ = _c(); $.c = v; }
      }
      contract Multi is AMod, BMod, CMod {
        uint256 own;
        function touchC(uint256 v) public { _setC(v); own = v; require(v >= 0, "n"); }
        function touchA(uint256 v) public { _setA(v); own = v + 1; require(v >= 0, "n"); }
        function touchB(uint256 v) public { _setB(v); own = v + 2; require(v >= 0, "n"); }
      }`;
    const options = { solidityImportCompat: true, forceSplit: true };
    const slots = (layout: any): string[] => (layout?.variables ?? [])
      .map((v: any) => `${v.name}@${v.nftIndex}.${v.fieldIndex}`);
    // One facet holds every entry: the case that always agreed, so the divided case below is compared
    // against a layout that the shard split cannot have influenced.
    const together = compileStringSplit(source, { ...options, maxShardBytes: 10_000 });
    expect(together.manifest.facets).toHaveLength(1);
    expect(slots(together.facets[together.manifest.facets[0].name].stateLayout))
      .toEqual(slots(together.root.stateLayout));

    // The same source at the limit that USED to be refused (root had AStorage__a@0.1 where the touchC facet
    // had CStorage__c@0.1). It now compiles into more than one facet, and every shard - including the unsplit
    // baseline the manifest fingerprint is taken from - names the same variable at every slot.
    const divided = compileStringSplit(source, { ...options, maxShardBytes: 1100 });
    expect(divided.manifest.facets.length).toBeGreaterThan(1);
    const expected = slots(compileString(source, { solidityImportCompat: true }).stateLayout);
    expect(expected).toEqual(slots(together.root.stateLayout));
    expect(slots(divided.root.stateLayout)).toEqual(expected);
    for (const info of divided.manifest.facets) {
      expect(slots(divided.facets[info.name].stateLayout), `${info.name} layout`).toEqual(expected);
    }
  });

  /**
   * THE GUARD IS STILL ARMED, and it has to be checked separately now that no source reaches it: the repair
   * removed the two orderings that produced a divergent bundle, not the refusal. `assertSplitLayoutsAgree`
   * reads only `stateLayout.variables`, so it is driven here from minimal shards that differ in exactly one
   * field. Both arms are pinned, and the first row is the positive control that makes the refusals mean
   * something.
   */
  it('refuses a shard that does not share the root storage layout', () => {
    const layout = (...names: string[]): any => ({
      stateLayout: { variables: names.map((name, index) => ({ name, nftIndex: 0, fieldIndex: index })) },
    });
    const root = layout('own', 'AStorage__a', 'BStorage__b');
    const agreeing = [{ name: 'F0', artifact: layout('own', 'AStorage__a', 'BStorage__b') }];
    expect(() => assertSplitLayoutsAgree('M', root, agreeing as never, root as never)).not.toThrow();

    const swapped = [{ name: 'F0', artifact: layout('own', 'BStorage__b', 'AStorage__a') }];
    expect(() => assertSplitLayoutsAgree('M', root, swapped as never, root as never))
      .toThrow(/facet 'F0' does not share the root's storage layout \(root has AStorage__a@0\.1, it has BStorage__b@0\.1\)/);

    // The second arm: the root agreeing with its facets is not enough if the PUBLISHED layout - the unsplit
    // baseline the manifest fingerprint is taken from - describes something else.
    expect(() => assertSplitLayoutsAgree(
      'M', root, agreeing as never, layout('own', 'BStorage__b', 'AStorage__a') as never,
    )).toThrow(/generated root does not share the unsplit contract's storage layout/);
  });

  /**
   * X169. X162 fixed the two orderings it found and RECORDED a third that it did not build:
   * `LowerForeignFunctionPointerArrayElements` also appends state variables, and it still ran POST-FILTER. Its
   * classification is usage-driven - a table whose writes name TWO methods is VARYING and gets a parallel
   * `bytes[] __fnsel_<name>` state variable, one whose SURVIVING writes name one method is FIXED and gets none.
   *
   * It is built here. Two tables, `p` and `q`; a shared helper writes `IH(t).inc` to both (so no shard loses
   * every write, which fails closed elsewhere), and only `b` writes `IH(t).dec` to `p`. Divided, the facet
   * holding `c` classified `p` FIXED and created no `__fnsel_p`, so its `q` landed one slot early:
   *
   *   root  total@0.0  p@0.1  __fnsel_p@0.2  q@0.3  __fnsel_q@0.4
   *   c     total@0.0  p@0.1  q@0.2          __fnsel_q@0.3
   *
   * Physical slot 0.2 is `__fnsel_p` to the root and `q` to that facet, and a delegate facet writes the ROOT's
   * state through physical slots - the X162 wrong-variable write with a different author. `assertSplitLayoutsAgree`
   * refused the bundle (the negative control below is that exact refusal, and it stays armed), so nothing was
   * emitted; the repair is that the decision is now taken once, in `prepareSplitAst`, on the complete function set.
   */
  const FN_PTR_TABLES = `pragma solidcash >=0.8.0;
interface IH { function inc(uint value); function dec(uint value); }
contract Diverge2() {
  uint total;
  function(uint) external[] p;
  function(uint) external[] q;
  constructor(address t) {
    this.p.push(IH(t).inc); this.p.push(IH(t).dec);
    this.q.push(IH(t).inc); this.q.push(IH(t).dec);
  }
  function seed(address t) internal { this.p.push(IH(t).inc); this.q.push(IH(t).inc); this.q.push(IH(t).dec); }
  function a(address t) public { seed(t); this.total = this.total + 1; require(true); }
  function b(address t) public { seed(t); this.p.push(IH(t).dec); this.total = this.total + 2; require(true); }
  function c(address t) public { seed(t); this.total = this.total + 3; require(true); }
}`;

  const fnPtrSlots = (layout: any): string[] => (layout?.variables ?? [])
    .map((v: any) => `${v.name}@${v.nftIndex}.${v.fieldIndex}`);

  it('decides foreign fn-ptr array lowering once, so a divided shard cannot re-classify a table', () => {
    const options = { forceStateful: true, forceSplit: true };
    const expected = fnPtrSlots(compileString(FN_PTR_TABLES, { forceStateful: true }).stateLayout);
    expect(expected).toEqual(['total@0.0', 'p@0.1', '__fnsel_p@0.2', 'q@0.3', '__fnsel_q@0.4']);

    // The union is the case that always agreed: one facet holds every entry, so its function set already WAS
    // the complete one. It is the control that the divided case below is compared against.
    const union = compileStringSplit(FN_PTR_TABLES, options);
    expect(union.manifest.facets).toHaveLength(1);
    expect(fnPtrSlots(union.root.stateLayout)).toEqual(expected);

    const divided = compileStringSplit(FN_PTR_TABLES, {
      ...options, maxShardBytes: union.manifest.facets[0].estimatedRedeemBytes - 1,
    });
    expect(divided.manifest.facets.length).toBeGreaterThan(1);
    expect(fnPtrSlots(divided.root.stateLayout)).toEqual(expected);
    for (const info of divided.manifest.facets) {
      expect(fnPtrSlots(divided.facets[info.name].stateLayout), `${info.name} layout`).toEqual(expected);
    }

    // The discriminating shard, named: `c` writes only the helper's `IH(t).inc` to `p`, so on its own function
    // set `p` is a FIXED table with no selector array. It carries `__fnsel_p` anyway - the complete set's
    // decision - which is the whole repair. Without it the assertion above would still pass on a bundle whose
    // shards had all agreed on the WRONG layout.
    const cFacet = divided.manifest.facets.find((f) => f.functions.includes('c') && !f.functions.includes('b'))!;
    expect(cFacet, 'the shard that classified p as fixed').toBeDefined();
    expect(fnPtrSlots(divided.facets[cFacet.name].stateLayout)).toContain('__fnsel_p@0.2');
    expect(divided.facets[cFacet.name].abi.some((fn) => fn.name === 'b')).toBe(false);
  });

  /**
   * NEGATIVE CONTROL for the row above, differing in exactly the attacked field: the pre-repair `c` shard, with
   * `__fnsel_p` omitted and everything else identical. The guard is not weakened by the repair - it names the
   * aliased slot and refuses.
   */
  it('still refuses the shard the fn-ptr classification used to produce', () => {
    const layout = (...names: string[]): any => ({
      stateLayout: { variables: names.map((name, index) => ({ name, nftIndex: 0, fieldIndex: index })) },
    });
    const root = layout('total', 'p', '__fnsel_p', 'q', '__fnsel_q');
    const repaired = [{ name: 'F1', artifact: layout('total', 'p', '__fnsel_p', 'q', '__fnsel_q') }];
    expect(() => assertSplitLayoutsAgree('Diverge2', root, repaired as never, root as never)).not.toThrow();

    const preRepair = [{ name: 'F1', artifact: layout('total', 'p', 'q', '__fnsel_q') }];
    expect(() => assertSplitLayoutsAgree('Diverge2', root, preRepair as never, root as never))
      .toThrow(/facet 'F1' does not share the root's storage layout \(root has __fnsel_p@0\.2, it has q@0\.2\)/);
  });

  /**
   * The single-table form of the same class, and the shard that has NO write to the table at all. Both were
   * refusals before the decision moved: the first as a layout divergence, the second as
   * `Function-pointer array 'handlers': it is never written in contract code` raised against a shard whose
   * function set simply did not contain the registrars.
   */
  it('splits a table whose writes are reachable from only some entries', () => {
    const source = `pragma solidcash >=0.8.0;
interface IH { function inc(uint value); function dec(uint value); }
contract NoWrite() {
  uint total;
  function(uint) external[] handlers;
  function registerInc(address t) public { this.handlers.push(IH(t).inc); this.total = this.total + 1; require(true); }
  function registerDec(address t) public { this.handlers.push(IH(t).dec); this.total = this.total + 2; require(true); }
  function fireAll(uint value) public {
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    this.total = this.total + 3; require(value >= 0);
  }
}`;
    const options = { forceStateful: true, forceSplit: true };
    const expected = fnPtrSlots(compileString(source, { forceStateful: true }).stateLayout);
    expect(expected).toEqual(['total@0.0', 'handlers@0.1', '__fnsel_handlers@0.2']);
    const union = compileStringSplit(source, options);
    const divided = compileStringSplit(source, {
      ...options, maxShardBytes: union.manifest.facets[0].estimatedRedeemBytes - 1,
    });
    const broadcast = divided.manifest.facets.find((f) => f.functions.includes('fireAll'))!;
    expect(broadcast.functions).toEqual(['fireAll']);
    expect(fnPtrSlots(divided.facets[broadcast.name].stateLayout)).toEqual(expected);
    expect(fnPtrSlots(divided.root.stateLayout)).toEqual(expected);
  });

  /**
   * THE RESIDUAL, STATED. `LowerReceivedFnPtrArray` appends state variables too, and it CANNOT be hoisted the
   * same way: it reads the `__fnsel_` companions that `LowerForeignFunctionPointerParams` splits out far later
   * in the pipeline. It cannot diverge on its own - it appends exactly two variables per table it lowers, in
   * declaration order, or throws - and this pins the ordering that keeps a MIXED contract's root equal to its
   * baseline: the pass that runs first in the ordinary pipeline appends first.
   *
   * What it still refuses is the root that `prepareSplitRoot` left with no write to a received-value table,
   * because every writer moved to a facet. That is a loud refusal, not a divergence.
   */
  it('fails closed, by name, on a received-value table whose writers all move off the root', () => {
    const source = `pragma solidcash >=0.8.0;
interface IH { function inc(uint value); function dec(uint value); }
contract Mixed() {
  uint total;
  function(uint) external[] p;
  function(uint) external[] q;
  function a(function(uint) external cb, address t) public {
    this.p.push(cb); this.q.push(IH(t).inc); this.total = this.total + 1; require(true);
  }
  function b(function(uint) external cb, address t) public {
    this.p.push(cb); this.q.push(IH(t).dec); this.total = this.total + 2; require(true);
  }
}`;
    // `q` is lowered by the array pass, `p` by the received-value pass, and the ORDER is the pipeline's:
    // the array pass runs first and appends first. `prepareSplitAst` reproduces exactly this.
    expect(fnPtrSlots(compileString(source, { forceStateful: true }).stateLayout))
      .toEqual(['total@0.0', 'q@0.1', '__fnsel_q@0.2', 'p@0.3', '__fnsel_p@0.4']);
    expect(() => compileStringSplit(source, { forceStateful: true, forceSplit: true }))
      .toThrow(/Function-pointer array 'p': it is never written in contract code/);
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
    // `find(...)?.target` is undefined when the route is missing, and `undefined !== 'root'` PASSES, so the
    // route must be pinned present before its target is judged.
    const setRoute = bundle.manifest.routes.find((route) => route.function === 'set');
    expect(setRoute).toBeDefined();
    expect(setRoute!.target).not.toBe('root');
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
    // Both halves were vacuous on an empty collection: `.every` over no facets is true, and `find(...)?.target`
    // over a missing route is undefined, which is `not.toBe('root')`. Pin both collections first.
    const facets = Object.values(bundle.facets);
    expect(facets).toHaveLength(1);
    expect(facets.every((facet) => facet.constructorInputs.length > 0)).toBe(true);
    expect(facets.every((facet) => facet.constructorInputs
      .every((input) => input.name !== 'supply'))).toBe(true);
    const transferRoute = bundle.manifest.routes.find((route) => route.function === 'transfer');
    expect(transferRoute).toBeDefined();
    expect(transferRoute!.target).not.toBe('root');
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
