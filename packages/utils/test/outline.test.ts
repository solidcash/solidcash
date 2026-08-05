import { PositionHint, Op, Script, outlineSharedSpans, scriptToBytecode } from '../src/index.js';
import type { FullLocationData, SingleLocationData } from '../src/index.js';

const location: SingleLocationData = { location: undefined, positionHint: PositionHint.START };
const locations = (script: Script): FullLocationData => script.map(() => location);
const body = (script: Script): { script: Script; locationData: FullLocationData } =>
  ({ script, locationData: locations(script) });

// Control-flow-free and internally non-repeating, so the only match the search can find is the whole run - long
// enough to clear the minimum window and repay a definition plus its invocations.
const REPEATED: Script = [
  Op.OP_DUP, Op.OP_SHA256, Op.OP_SWAP, Op.OP_CAT, Op.OP_SIZE, Op.OP_NIP,
  Op.OP_BIN2NUM, Op.OP_ADD, Op.OP_DROP, Op.OP_1ADD, Op.OP_TUCK, Op.OP_OVER,
  Op.OP_ROT, Op.OP_2DUP, Op.OP_3DUP, Op.OP_2OVER, Op.OP_2ROT, Op.OP_2SWAP,
  Op.OP_IFDUP, Op.OP_DEPTH, Op.OP_HASH160, Op.OP_HASH256, Op.OP_RIPEMD160, Op.OP_SHA1,
];
const FILLER: Script = [Op.OP_2DROP, Op.OP_NIP, Op.OP_TUCK];

let nextId = -12;
const allocateId = (): Uint8Array => {
  nextId -= 1;
  return Uint8Array.of(0x80 | Math.abs(nextId));
};

describe('cross-function bytecode outlining', () => {
  it('moves a span repeated across bodies into one shared function', () => {
    const result = outlineSharedSpans(
      [body([...REPEATED, ...FILLER]), body([...FILLER, ...REPEATED])],
      allocateId,
    );

    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].script).toEqual(REPEATED);
    expect(result.savedBytes).toBeGreaterThan(0);
    for (const rewritten of result.bodies) {
      expect(rewritten.script).toContain(Op.OP_INVOKE);
      expect(rewritten.script.length).toBe(FILLER.length + 2);
      expect(rewritten.locationData).toHaveLength(rewritten.script.length);
    }
  });

  it('leaves a lone occurrence alone', () => {
    const result = outlineSharedSpans([body([...REPEATED, ...FILLER])], allocateId);
    expect(result.functions).toEqual([]);
    expect(result.savedBytes).toBe(0);
  });

  it('keeps a conditional whole rather than stranding its OP_ELSE', () => {
    // The repeated run sits between OP_IF and OP_ELSE. A depth-only balance check would happily share
    // "<run> OP_ELSE <run>" - depth never moves - and the invoked body would abort with "OP_ELSE outside of a
    // conditional". Whatever is shared here must carry its own OP_IF.
    const conditional: Script = [
      Op.OP_1, Op.OP_IF, ...REPEATED, Op.OP_ELSE, ...REPEATED, Op.OP_ENDIF,
    ];
    const result = outlineSharedSpans([body(conditional), body([...FILLER, ...conditional])], allocateId);

    for (const shared of result.functions) {
      let depth = 0;
      for (const element of shared.script) {
        if (element === Op.OP_ELSE) expect(depth).toBeGreaterThanOrEqual(1);
        if (element === Op.OP_IF || element === Op.OP_NOTIF) depth += 1;
        if (element === Op.OP_ENDIF) depth -= 1;
        expect(depth).toBeGreaterThanOrEqual(0);
      }
      expect(depth).toBe(0);
    }
  });

  it('never relocates bytecode-relative or defining opcodes', () => {
    for (const barrier of [Op.OP_ACTIVEBYTECODE, Op.OP_DEFINE, Op.OP_CHECKSIG, Op.OP_CODESEPARATOR]) {
      const guarded: Script = [...REPEATED, barrier, ...REPEATED];
      const result = outlineSharedSpans([body(guarded), body([...FILLER, ...guarded])], allocateId);
      // The runs either side are individually worth sharing, so this proves the barrier is skipped rather than
      // that nothing happened at all.
      expect(result.functions.length).toBeGreaterThan(0);
      for (const shared of result.functions) expect(shared.script).not.toContain(barrier);
    }
  });

  it('preserves the concatenated bytes of every body plus its shared functions', () => {
    const original = [body([...REPEATED, ...FILLER, ...REPEATED]), body([...FILLER, ...REPEATED])];
    const before = original.map((entry) => scriptToBytecode(entry.script).length);
    const result = outlineSharedSpans(original, allocateId);
    const definitionBytes = result.functions
      .reduce((total, shared) => total + scriptToBytecode(shared.script).length, 0);
    const after = result.bodies.reduce((total, entry) => total + scriptToBytecode(entry.script).length, 0);
    expect(after + definitionBytes).toBeLessThan(before[0] + before[1]);
  });

  it('remaps instruction pointers onto the rewritten body', () => {
    const source: Script = [...FILLER, ...REPEATED, ...FILLER];
    const result = outlineSharedSpans([body(source), body([...REPEATED, ...FILLER])], allocateId);
    const [first] = result.bodies;
    // One longer than the body: the trailing entry maps a require's implicit final-verify pointer.
    expect(first.indexMap).toHaveLength(source.length + 1);
    // Monotonic and always inside the rewritten body, so a require never points past the end.
    let previous = -1;
    for (const mapped of first.indexMap) {
      expect(mapped).toBeGreaterThanOrEqual(previous);
      expect(mapped).toBeLessThanOrEqual(first.script.length);
      previous = mapped;
    }
    // Instructions before the shared span keep their position.
    expect(first.indexMap[0]).toBe(0);
  });

  it('does not retain one-invoke aliases after multi-round outlining', () => {
    const repeatedBlock: Script = [...REPEATED, ...FILLER, ...REPEATED, ...FILLER];
    const result = outlineSharedSpans([
      body([...repeatedBlock, Op.OP_2DROP, ...repeatedBlock]),
      body([...FILLER, ...repeatedBlock, Op.OP_NIP, ...repeatedBlock]),
    ], allocateId);
    const key = (id: Uint8Array): string => [...id].join(',');
    const ids = new Set(result.functions.map((fn) => key(fn.id)));
    for (const fn of result.functions) {
      const isAlias = fn.script.length === 2 && fn.script[1] === Op.OP_INVOKE
        && fn.script[0] instanceof Uint8Array
        && ids.has(key(fn.script[0]));
      expect(isAlias).toBe(false);
    }
  });
});
