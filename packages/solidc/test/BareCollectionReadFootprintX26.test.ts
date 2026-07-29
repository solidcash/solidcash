import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

// Message-bus compilation is several seconds per contract; the default budget is not enough under the
// parallel-file load the solidc project runs with.
const COMPILE_TIMEOUT_MS = 120_000;

const busOptions = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

/**
 * X26 - a bare `m[k]` READ contributed nothing to `analyseFunctionFootprint`, and that was a silent
 * under-reservation rather than a harmless omission.
 *
 * `ArrayAccessNode` carries `array`/`index`, never `name`/`keys`, so the footprint's shaped lookup found no
 * resource for the bare spelling. The bus route's collection-eligibility branch is gated on that footprint, so a
 * handler whose only collection access was a bare read published `blockSize = 2` with no entry slot - while the
 * SAME route's covenant went on addressing block-relative slot +2. Blocks are concatenated, so the next
 * participant's block is placed at `base + 2`: the slot the route reads and writes.
 *
 * The first test is the class-level guard: a declared block must COVER every block-relative slot its own
 * covenant addresses. It is what makes the defect observable without composing a transaction, and it fails on
 * the pre-fix compiler for `BARE_READ` while passing for the dotted spelling of the same program.
 */

/** Transaction-introspection opcodes that address ONE input or output by an index taken off the stack. */
const INDEXED_OPCODES: Record<string, string> = {
  c6: 'UTXOVALUE', c7: 'UTXOBYTECODE', c8: 'OUTPOINTTXHASH', c9: 'OUTPOINTINDEX',
  ca: 'INPUTBYTECODE', cb: 'INPUTSEQUENCENUMBER', cc: 'OUTPUTVALUE', cd: 'OUTPUTBYTECODE',
  ce: 'UTXOTOKENCATEGORY', cf: 'UTXOTOKENCOMMITMENT', d0: 'UTXOTOKENAMOUNT',
  d1: 'OUTPUTTOKENCATEGORY', d2: 'OUTPUTTOKENCOMMITMENT', d3: 'OUTPUTTOKENAMOUNT',
};

/**
 * Every block-relative slot the emitted program addresses, read straight off the bytecode.
 *
 * A block-relative access is `OP_INPUTINDEX <k> OP_ADD <indexed-op>` (offset k), `OP_INPUTINDEX OP_1ADD
 * <indexed-op>` (offset 1) or a bare `OP_INPUTINDEX <indexed-op>` (offset 0). Subroutine extraction pushes
 * function bodies as data, so the scan covers the top-level script AND every OP_DEFINE'd span - an ASM grep of
 * the top level alone returns a false negative for an outlined body.
 */
function blockRelativeOffsets(artifact: { bytecode: string }): Set<number> {
  const hex = artifact.bytecode.split(' ')
    .filter((token) => /^[0-9a-f]+$/i.test(token) && token.length > 8).join('');
  const offsets = new Set<number>();
  for (let i = 0; i + 6 <= hex.length; i += 2) {
    if (hex.slice(i, i + 2) !== 'c0') continue;
    if (hex.slice(i + 2, i + 4) === '8b') {
      if (INDEXED_OPCODES[hex.slice(i + 4, i + 6)]) offsets.add(1);
      continue;
    }
    const push = parseInt(hex.slice(i + 2, i + 4), 16);
    if (push >= 0x51 && push <= 0x60 && hex.slice(i + 4, i + 6) === '93') {
      if (INDEXED_OPCODES[hex.slice(i + 6, i + 8)]) offsets.add(push - 0x50);
      continue;
    }
    if (INDEXED_OPCODES[hex.slice(i + 2, i + 4)]) offsets.add(0);
  }
  return offsets;
}

const readOnlyCollectionHandler = (read: string): string => `pragma solidcash >=0.8.0;
contract X26ReadOnly() {
  mapping(bytes20 => bigint) balances;
  bigint total;
  function bump(bytes20 who) public {
    this.total = this.total + ${read};
    require(true);
  }
}`;

const BARE_READ = readOnlyCollectionHandler('balances[who]');
const DOTTED_READ = readOnlyCollectionHandler('this.balances[who]');

/** A bare-read handler beside a sibling that writes the same collection through the dotted spelling. */
const MIXED_SIBLINGS = `pragma solidcash >=0.8.0;
contract X26Mixed() {
  mapping(bytes20 => bigint) balances;
  bigint total;
  function bump(bytes20 who) public {
    this.total = this.total + balances[who];
    require(true);
  }
  function put(bytes20 who, bigint v) public {
    this.balances[who] = v;
    require(true);
  }
}`;

/** The same bare read, moved into an internal helper the entry point calls. */
const BARE_READ_IN_HELPER = `pragma solidcash >=0.8.0;
contract X26Helper() {
  mapping(bytes20 => bigint) balances;
  bigint total;
  function bump(bytes20 who) public {
    helper(who);
    require(true);
  }
  function helper(bytes20 who) internal {
    this.total = this.total + balances[who];
  }
}`;

describe('X26: a declared block covers every slot its own covenant addresses', () => {
  it('the bare-read bus route declares the entry slot it addresses', () => {
    const artifact = compileString(BARE_READ, busOptions);
    const layout = artifact.hiddenBatch!.route.blockLayout!;
    // Measured on the pre-fix compiler: blockSize 2, offsets {0,1,2} - the covenant reads and writes +2 with
    // ten introspection opcodes while telling every later participant the block is two slots wide.
    expect([...blockRelativeOffsets(artifact)].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(layout.blockSize).toBe(3);
    expect(layout.slots.map((slot) => `${slot.kind}@${slot.offset}`))
      .toEqual(['master@0', 'dataNft@1', 'entry@2']);
    for (const offset of blockRelativeOffsets(artifact)) {
      expect(offset).toBeLessThan(layout.blockSize);
    }
  }, COMPILE_TIMEOUT_MS);

  it('the dotted spelling is the control: it always declared that slot', () => {
    const artifact = compileString(DOTTED_READ, busOptions);
    const layout = artifact.hiddenBatch!.route.blockLayout!;
    expect([...blockRelativeOffsets(artifact)].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(layout.blockSize).toBe(3);
  }, COMPILE_TIMEOUT_MS);

  it('the two spellings compile to a BYTE-IDENTICAL bus route and route ABI', () => {
    const bare = compileString(BARE_READ, busOptions);
    const dotted = compileString(DOTTED_READ, busOptions);
    // They were already byte-identical on the DIRECT route; the bus route is what diverged.
    expect(compileString(BARE_READ, { forceStateful: true }).bytecode)
      .toBe(compileString(DOTTED_READ, { forceStateful: true }).bytecode);
    expect(bare.bytecode).toBe(dotted.bytecode);
    expect(JSON.stringify(bare.hiddenBatch!.route)).toBe(JSON.stringify(dotted.hiddenBatch!.route));
  }, COMPILE_TIMEOUT_MS);

  it('a bare-read handler is no longer dropped from a batch its dotted sibling keys', () => {
    const artifact = compileString(MIXED_SIBLINGS, busOptions);
    const handlers = artifact.hiddenBatch!.handlers;
    // Before the fix `bump` carried no key witness, so the mixed-scalar rule rejected it while `put` batched.
    expect(handlers.map((handler) => `${handler.name}:${handler.eligible}`)).toEqual(['bump:true', 'put:true']);
    // Both resolve to ONE route input and therefore one physical entry slot, which is what the witness naming
    // rule exists to guarantee.
    for (const handler of handlers) {
      expect(handler.batchKeyWitnesses?.map((witness) => witness.routeInput)).toEqual(['__scb_key_balances_0']);
    }
    expect(artifact.hiddenBatch!.route.entryAccesses).toHaveLength(1);
    expect(artifact.hiddenBatch!.route.entryAccesses![0].operations).toEqual(['read', 'write']);
  }, COMPILE_TIMEOUT_MS);

  it('a bare read reached only through an internal helper is refused by name, not by an internal error', () => {
    // The route synthesis walks the entry point's own body for keys, so the collection is visible to the
    // footprint (which follows the call graph) but has no directly-keyed access to bind. Before the fix the
    // footprint saw nothing at all and code generation aborted with the internal
    // "Function '__scb1' writes a resource at entry slot 0 that has no entry descriptor".
    const artifact = compileString(BARE_READ_IN_HELPER, busOptions);
    expect(artifact.hiddenBatch).toBeUndefined();
    const diagnostic = (artifact.diagnostics ?? []).find(
      (entry) => entry.code === 'hidden-batch-route-not-synthesized',
    );
    expect(diagnostic?.message).toContain('collection-helper-route-not-enabled');
  }, COMPILE_TIMEOUT_MS);
});
