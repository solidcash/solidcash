import { ConsensusCommon } from '@bitauth/libauth';
import {
  PositionHint, Op, Script, controlStackDepth, encodeInt, invocationDepths, literalDefinitions,
  MAXIMUM_CONTROL_STACK_DEPTH, nestingSafeFunctionIds, outlineSharedSpans, scriptToBytecode,
} from '../src/index.js';
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

  // The third parameter used to be a `candidateLimit`/`maximumRounds` search bound; it is now `peekIdPushBytes`,
  // which reports the encoded push width of the NEXT identifier so the cost model is exact rather than costing
  // every site at the widest identifier a helper can need. Passing a number here silently produced
  // "peekIdPushBytes is not a function" at runtime, which is what a stale call site looks like.
  it('costs sites against the caller-reported identifier width', () => {
    const source = [body([...REPEATED, ...FILLER]), body([...FILLER, ...REPEATED])];
    // A one-byte identifier is the cheapest a site can be, so sharing stays profitable and still happens.
    expect(outlineSharedSpans(source, allocateId, () => 1).functions.length).toBeGreaterThan(0);
    // Costing every site at an absurd identifier width makes no candidate profitable, so nothing is shared.
    expect(outlineSharedSpans(source, allocateId, () => 1_000).functions).toEqual([]);
  });

  it('shares leftover short spans after a wider window has already outlined the long matches', () => {
    const short: Script = [...FILLER, ...FILLER, Op.OP_DUP];
    // After the first (window-12) pass, long matches are OP_INVOKE barriers. A 7-byte tail still repeats
    // across bodies; window 5 is the first seed that can see it. Four sites repay a 1-byte identifier.
    const outlined: Script = [Uint8Array.of(0x8c), Op.OP_INVOKE];
    const leftover = outlineSharedSpans(
      [
        body([...outlined, Op.OP_DROP, ...short]),
        body([...outlined, Op.OP_2DROP, ...short]),
        body([...outlined, Op.OP_1ADD, ...short]),
        body([...outlined, Op.OP_NEGATE, ...short]),
      ],
      allocateId,
      () => 1,
      'savings',
      5,
    );
    expect(leftover.savedBytes).toBeGreaterThan(0);
    expect(leftover.functions.length).toBeGreaterThan(0);
    expect(leftover.functions.some((fn) => fn.script.length <= 8)).toBe(true);
  });

  it('still shares leftover short spans without full-body diagonal memo tables', () => {
    const short: Script = [...FILLER, ...FILLER, Op.OP_DUP];
    const outlined: Script = [Uint8Array.of(0x8c), Op.OP_INVOKE];
    const leftover = outlineSharedSpans(
      [
        body([...outlined, Op.OP_DROP, ...short]),
        body([...outlined, Op.OP_2DROP, ...short]),
        body([...outlined, Op.OP_1ADD, ...short]),
        body([...outlined, Op.OP_NEGATE, ...short]),
      ],
      allocateId,
      () => 1,
      'savings',
      5,
    );
    expect(leftover.savedBytes).toBeGreaterThan(0);
    expect(leftover.functions.length).toBeGreaterThan(0);
  });

  it('still shares leftover short spans when the follow-up pass is capped at two rounds', () => {
    const short: Script = [...FILLER, ...FILLER, Op.OP_DUP];
    const outlined: Script = [Uint8Array.of(0x8c), Op.OP_INVOKE];
    const leftover = outlineSharedSpans(
      [
        body([...outlined, Op.OP_DROP, ...short]),
        body([...outlined, Op.OP_2DROP, ...short]),
        body([...outlined, Op.OP_1ADD, ...short]),
        body([...outlined, Op.OP_NEGATE, ...short]),
      ],
      allocateId,
      () => 1,
      'savings',
      5,
      4096,
      undefined,
      2,
    );
    expect(leftover.savedBytes).toBeGreaterThan(0);
    expect(leftover.functions.length).toBeGreaterThan(0);
    expect(leftover.functions.some((fn) => fn.script.length <= 8)).toBe(true);
  });

  it('still outlines at leftover window 5 and speed-hint window 8 with sliding hashes', () => {
    const source = [body([...REPEATED, ...FILLER]), body([...FILLER, ...REPEATED])];
    expect(outlineSharedSpans(source, allocateId, () => 1, 'savings', 8).functions.length).toBeGreaterThan(0);
    expect(outlineSharedSpans(source, allocateId, () => 1, 'savings', 5).functions.length).toBeGreaterThan(0);
  });

  it('two-round window-8 search still shares the long span', () => {
    const source = [body([...REPEATED, ...FILLER]), body([...FILLER, ...REPEATED])];
    const two = outlineSharedSpans(source, allocateId, () => 1, 'savings', 8, 12288, undefined, 2);
    const four = outlineSharedSpans(source, allocateId, () => 1, 'savings', 8, 12288, undefined, 4);
    expect(two.functions.length).toBeGreaterThan(0);
    expect(two.savedBytes).toBeGreaterThan(0);
    expect(two.savedBytes).toBe(four.savedBytes);
  });

  it('still leftover-outlines when later rounds reuse interned fingerprints', () => {
    const source = [body([...REPEATED, ...FILLER]), body([...FILLER, ...REPEATED])];
    const leftover = outlineSharedSpans(source, allocateId, () => 1, 'savings', 5, 4096, undefined, 2);
    expect(leftover.functions.length).toBeGreaterThan(0);
    expect(leftover.savedBytes).toBeGreaterThan(0);
  });

  it('still leftover-outlines when body ids are packed in Int32Array', () => {
    const source = [body([...REPEATED, ...FILLER]), body([...FILLER, ...REPEATED])];
    const leftover = outlineSharedSpans(source, allocateId, () => 1, 'savings', 5, 4096, undefined, 2);
    expect(leftover.functions.length).toBeGreaterThan(0);
  });

  it('does not mutate caller scripts when leftover outlining copies only rewritten bodies', () => {
    const left = [...REPEATED, ...FILLER];
    const right = [...FILLER, ...REPEATED];
    const lonely = [...FILLER, Op.OP_NOP];
    const source = [body(left), body(right), body(lonely)];
    const leftover = outlineSharedSpans(source, allocateId, () => 1, 'savings', 5, 4096, undefined, 2);
    expect(leftover.functions.length).toBeGreaterThan(0);
    expect(lonely).toEqual([...FILLER, Op.OP_NOP]);
    expect(source[2].script).toBe(lonely);
  });

  it('allows the compiler to probe a narrower minimum without changing the conservative default', () => {
    const eleven = REPEATED.slice(0, 11);
    const source = [body([...eleven, ...FILLER]), body([...FILLER, ...eleven])];
    expect(outlineSharedSpans(source, allocateId, () => 1).functions).toEqual([]);
    expect(outlineSharedSpans(source, allocateId, () => 1, 'savings', 11).functions).toHaveLength(1);
  });

  it('extends a repeated seed when another occurrence ends exactly at the seed boundary', () => {
    const seed = REPEATED.slice(0, 12);
    const result = outlineSharedSpans(
      [body([...seed, ...FILLER]), body(seed)], allocateId, () => 1,
    );
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].script).toEqual(seed);
  });

  it('allows a bounded candidate-group probe without changing the default', () => {
    const source = [body([...REPEATED, ...FILLER]), body([...FILLER, ...REPEATED])];
    const bounded = outlineSharedSpans(source, allocateId, () => 1, 'savings', 12, 1);
    expect(bounded.functions.length).toBeGreaterThan(0);
    expect(bounded.savedBytes).toBeGreaterThan(0);
  });

  it('reuses first-round discovery across rankings without changing the selected output', () => {
    const source = [
      body([...REPEATED, ...FILLER, ...REPEATED]),
      body([...FILLER, ...REPEATED, ...FILLER, ...REPEATED]),
    ];
    const allocator = (): (() => Uint8Array) => {
      let id = -12;
      return () => { id -= 1; return Uint8Array.of(0x80 | Math.abs(id)); };
    };
    const cache = new Map<string, unknown>();
    outlineSharedSpans(source, allocator(), () => 1, 'savings', 12, 1024, cache);
    const cached = outlineSharedSpans(source, allocator(), () => 1, 'density', 12, 1024, cache);
    const uncached = outlineSharedSpans(source, allocator(), () => 1, 'density', 12, 1024);

    expect(cached).toEqual(uncached);
  });

  it('recosts narrower-width discovery for wider identifiers without changing the selected output', () => {
    const source = [
      body([...REPEATED, ...FILLER, ...REPEATED]),
      body([...FILLER, ...REPEATED, ...FILLER, ...REPEATED]),
    ];
    const allocator = (): (() => Uint8Array) => {
      let id = -12;
      return () => { id -= 1; return Uint8Array.of(0x80 | Math.abs(id)); };
    };
    const cache = new Map<string, unknown>();
    outlineSharedSpans(source, allocator(), () => 1, 'savings', 12, 1024, cache);
    const cached = outlineSharedSpans(source, allocator(), () => 3, 'density', 12, 1024, cache);
    const uncached = outlineSharedSpans(source, allocator(), () => 3, 'density', 12, 1024);

    expect(cached).toEqual(uncached);
  });

  it('reuses immutable corpus preparation across window probes without changing the selected output', () => {
    const source = [
      body([...REPEATED, ...FILLER, ...REPEATED]),
      body([...FILLER, ...REPEATED, ...FILLER, ...REPEATED]),
    ];
    const allocator = (): (() => Uint8Array) => {
      let id = -12;
      return () => { id -= 1; return Uint8Array.of(0x80 | Math.abs(id)); };
    };
    const cache = new Map<string, unknown>();
    outlineSharedSpans(source, allocator(), () => 1, 'savings', 12, 1024, cache);
    const cached = outlineSharedSpans(source, allocator(), () => 1, 'savings', 10, 1024, cache);
    const uncached = outlineSharedSpans(source, allocator(), () => 1, 'savings', 10, 1024);

    expect(cached).toEqual(uncached);
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

  it('never relocates invocation, bytecode-relative, defining, or alternate-stack opcodes', () => {
    for (const barrier of [
      Op.OP_INVOKE, Op.OP_ACTIVEBYTECODE, Op.OP_DEFINE, Op.OP_CHECKSIG, Op.OP_CODESEPARATOR,
      Op.OP_TOALTSTACK, Op.OP_FROMALTSTACK,
    ]) {
      const guarded: Script = [...REPEATED, barrier, ...REPEATED];
      const result = outlineSharedSpans([body(guarded), body([...FILLER, ...guarded])], allocateId);
      // The runs either side are individually worth sharing, so this proves the barrier is skipped rather than
      // that nothing happened at all.
      expect(result.functions.length).toBeGreaterThan(0);
      for (const shared of result.functions) expect(shared.script).not.toContain(barrier);
    }
  });

  it('keeps a complete encoded-id and OP_INVOKE pair behind the default invocation barrier', () => {
    const nestedId = 73;
    const invokePair: Script = [encodeInt(BigInt(nestedId)), Op.OP_INVOKE];
    const guarded: Script = [...REPEATED.slice(0, 12), ...invokePair, ...REPEATED.slice(12)];
    const result = outlineSharedSpans(
      [body([...guarded, ...FILLER]), body([...FILLER, ...guarded])],
      allocateId,
      () => 1,
    );

    expect(result.functions.length).toBeGreaterThan(0);
    for (const shared of result.functions) expect(shared.script).not.toContain(Op.OP_INVOKE);
  });

  it('relocates only complete allowlisted encoded-id and OP_INVOKE pairs', () => {
    const nestedId = 73;
    const encodedId = encodeInt(BigInt(nestedId));
    const guarded: Script = [...REPEATED.slice(0, 12), encodedId, Op.OP_INVOKE, ...REPEATED.slice(12)];
    const source = [body([...guarded, ...FILLER]), body([...FILLER, ...guarded])];
    const cache = new Map<string, unknown>();
    const allowed = new Set<number>();
    const run = (): ReturnType<typeof outlineSharedSpans> => outlineSharedSpans(
      source, allocateId, () => 1, 'savings', 12, 1024, cache, 6, allowed,
    );

    // The same policy object may be populated between conservative compiler passes. Candidate caches must be
    // scoped to its current contents or this first, barrier-bound result would poison the allowlisted retry.
    expect(run().functions.every((shared) => !shared.script.includes(Op.OP_INVOKE))).toBe(true);
    allowed.add(nestedId);
    const result = run();

    const nested = result.functions.find((shared) => shared.script.includes(Op.OP_INVOKE));
    expect(nested).toBeDefined();
    const invokeIndex = nested!.script.indexOf(Op.OP_INVOKE);
    expect(invokeIndex).toBeGreaterThan(0);
    expect(nested!.script[invokeIndex - 1]).toEqual(encodedId);
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

  it('matches an allow-listed id pushed by its single opcode only where the caller asks for it', () => {
    // A normalised body pushes ids 1..16 by OP_1..OP_16, which the data-push match never decodes.
    const folded: Script = [...REPEATED.slice(0, 12), Op.OP_7, Op.OP_INVOKE, ...REPEATED.slice(12)];
    const source = [body([...folded, ...FILLER]), body([...FILLER, ...folded])];
    const run = (allowed: number, foldedPushes: boolean): ReturnType<typeof outlineSharedSpans> => outlineSharedSpans(
      source, allocateId, () => 1, 'savings', 12, 1024, undefined, 6, new Set([allowed]), false, foldedPushes,
    );
    const nests = (result: ReturnType<typeof outlineSharedSpans>): boolean =>
      result.functions.some((shared) => shared.script.includes(Op.OP_INVOKE));

    const unasked = run(7, false);
    expect(unasked.functions.length).toBeGreaterThan(0);
    expect(nests(unasked)).toBe(false);
    const asked = run(7, true);
    const nested = asked.functions.find((shared) => shared.script.includes(Op.OP_INVOKE));
    expect(nested).toBeDefined();
    expect(nested!.script[nested!.script.indexOf(Op.OP_INVOKE) - 1]).toBe(Op.OP_7);
    // An id outside the allow-list stays a barrier in either push form.
    expect(nests(run(8, true))).toBe(false);
  });

  describe('the balanced alternate-stack policy', () => {
    // Every branch and loop iteration leaves the alternate depth where its opener found it, and nothing pops below
    // the start: the property a shared body needs to have no alternate-stack interface.
    const altBalanced = (script: Script): boolean => {
      const opened: number[] = [];
      let depth = 0;
      for (const element of script) {
        if (element === Op.OP_IF || element === Op.OP_NOTIF || element === Op.OP_BEGIN) opened.push(depth);
        if (element === Op.OP_ELSE && opened[opened.length - 1] !== depth) return false;
        if ((element === Op.OP_ENDIF || element === Op.OP_UNTIL) && opened.pop() !== depth) return false;
        if (element === Op.OP_TOALTSTACK) depth += 1;
        if (element === Op.OP_FROMALTSTACK) depth -= 1;
        if (depth < 0) return false;
      }
      return depth === 0 && opened.length === 0;
    };
    const share = (repeated: Script, policy: 'barrier' | 'balanced'): ReturnType<typeof outlineSharedSpans> =>
      outlineSharedSpans(
        [body([...repeated, ...FILLER]), body([...FILLER, ...repeated])],
        allocateId, () => 1, 'savings', 12, 1024, undefined, 6, undefined, policy,
      );
    const carries = (result: ReturnType<typeof outlineSharedSpans>, opcode: number): boolean =>
      result.functions.some((shared) => shared.script.includes(opcode));

    it('relocates a span that pops only what it pushed itself', () => {
      const parked: Script = [
        ...REPEATED.slice(0, 12), Op.OP_TOALTSTACK, ...REPEATED.slice(12, 18), Op.OP_FROMALTSTACK,
        ...REPEATED.slice(18),
      ];
      const barrier = share(parked, 'barrier');
      expect(barrier.functions.length).toBeGreaterThan(0);
      expect(carries(barrier, Op.OP_TOALTSTACK) || carries(barrier, Op.OP_FROMALTSTACK)).toBe(false);

      const balanced = share(parked, 'balanced');
      expect(balanced.functions.some((shared) => shared.script.includes(Op.OP_TOALTSTACK)
        && shared.script.includes(Op.OP_FROMALTSTACK))).toBe(true);
      for (const shared of balanced.functions) expect(altBalanced(shared.script)).toBe(true);
    });

    it.each([
      // The pop takes an item the span did not push: the caller's.
      ['pops below its start', [...REPEATED.slice(0, 12), Op.OP_FROMALTSTACK, ...REPEATED.slice(12)]],
      // The push is left for code outside the span: the first half of a handoff.
      ['leaves its push behind', [...REPEATED.slice(0, 12), Op.OP_TOALTSTACK, ...REPEATED.slice(12)]],
      // One branch pushes and the other does not, so the later pop takes the caller's item on the other path.
      // The runs around each construct are 12 elements: shorter ones do not repay a two-byte identifier.
      ['changes the depth on one path', [
        ...REPEATED.slice(0, 12), Op.OP_IF, Op.OP_TOALTSTACK, Op.OP_ENDIF, ...REPEATED.slice(12),
        Op.OP_FROMALTSTACK,
      ]],
      // A branch that ends at another depth than its opener, before the OP_ELSE.
      ['changes the depth before its OP_ELSE', [
        ...REPEATED.slice(0, 12), Op.OP_IF, Op.OP_TOALTSTACK, Op.OP_ELSE, Op.OP_TOALTSTACK, Op.OP_ENDIF,
        ...REPEATED.slice(12), Op.OP_FROMALTSTACK,
      ]],
      // A loop iteration that moves the depth: the linear count is right for one iteration only.
      ['changes the depth in a loop iteration', [
        ...REPEATED.slice(0, 12), Op.OP_BEGIN, Op.OP_TOALTSTACK, Op.OP_1, Op.OP_UNTIL, ...REPEATED.slice(12),
        Op.OP_FROMALTSTACK,
      ]],
    ] as const)('never relocates alternate-stack use that %s', (_name, repeated) => {
      const result = share([...repeated], 'balanced');
      // The runs around the alternate-stack use are worth sharing, so the refusal is of the use, not of everything.
      expect(result.functions.length).toBeGreaterThan(0);
      for (const shared of result.functions) {
        expect(altBalanced(shared.script)).toBe(true);
        expect(shared.script).not.toContain(Op.OP_FROMALTSTACK);
      }
    });
  });

  describe('nesting-safe helpers', () => {
    const LEAF: Script = [Op.OP_DUP, Op.OP_SHA256, Op.OP_CAT];

    it('proves a helper from its own body and the helpers it invokes, and refuses each unsafe body', () => {
      const bodies = new Map<number, Script>([
        [1, LEAF],
        [2, [Op.OP_IF, ...LEAF, Op.OP_ELSE, Op.OP_DROP, Op.OP_ENDIF]],
        [3, [Op.OP_TOALTSTACK, ...LEAF, Op.OP_FROMALTSTACK]],
        // Invokes proven helpers, in the folded and the data-push form of their ids.
        [4, [Op.OP_1, Op.OP_INVOKE, encodeInt(2n), Op.OP_INVOKE]],
        // Defines a function.
        [10, [...LEAF, Op.OP_DEFINE]],
        // Reads or signs the active bytecode.
        [11, [Op.OP_ACTIVEBYTECODE, ...LEAF]],
        [12, [...LEAF, Op.OP_CHECKSIG]],
        // Takes part in an alternate-stack handoff: pops the caller's item, leaves its own, or differs by path.
        [13, [Op.OP_FROMALTSTACK, ...LEAF]],
        [14, [...LEAF, Op.OP_TOALTSTACK]],
        [15, [Op.OP_IF, Op.OP_TOALTSTACK, Op.OP_ENDIF, Op.OP_FROMALTSTACK]],
        // Leaves control flow open, or closes it out of kind.
        [16, [Op.OP_IF, ...LEAF]],
        [17, [Op.OP_BEGIN, Op.OP_ELSE, Op.OP_1, Op.OP_UNTIL]],
        // Invokes a computed id, an id nothing here defines, an unsafe helper, or itself through another.
        [18, [Op.OP_ADD, Op.OP_INVOKE]],
        [19, [encodeInt(99n), Op.OP_INVOKE]],
        [20, [encodeInt(10n), Op.OP_INVOKE]],
        [21, [encodeInt(22n), Op.OP_INVOKE]],
        [22, [encodeInt(21n), Op.OP_INVOKE]],
      ]);
      expect([...nestingSafeFunctionIds(bodies)].sort((left, right) => left - right)).toEqual([1, 2, 3, 4]);
    });

    it('bounds the control stack an invocation adds, and refuses what it cannot bound', () => {
      expect(MAXIMUM_CONTROL_STACK_DEPTH).toBe(ConsensusCommon.maximumControlStackDepth);
      const key = (id: bigint): string => Array.from(encodeInt(id), (byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      const bodies = new Map<string, Script>([
        // Its own frame.
        [key(1n), [Op.OP_DUP, Op.OP_DROP]],
        // A conditional around a call of 1: 1 + 1 + 1.
        [key(2n), [Op.OP_IF, Op.OP_1, Op.OP_INVOKE, Op.OP_ENDIF]],
        // A loop and a conditional around a call of 2: 1 + 2 + 3.
        [key(3n), [Op.OP_BEGIN, Op.OP_IF, encodeInt(2n), Op.OP_INVOKE, Op.OP_ENDIF, Op.OP_1, Op.OP_UNTIL]],
        // A computed id, recursion, an id nothing defines, and a definition made while running.
        [key(4n), [Op.OP_ADD, Op.OP_INVOKE]],
        [key(5n), [encodeInt(6n), Op.OP_INVOKE]],
        [key(6n), [encodeInt(5n), Op.OP_INVOKE]],
        [key(7n), [encodeInt(42n), Op.OP_INVOKE]],
        [key(8n), [Op.OP_DUP, encodeInt(9n), Op.OP_DEFINE]],
      ]);
      const depths = invocationDepths(bodies);
      expect([1n, 2n, 3n].map((id) => depths.get(key(id)))).toEqual([1, 3, 6]);
      for (const id of [4n, 5n, 6n, 7n, 8n]) expect(depths.get(key(id))).toBeUndefined();

      // A dispatcher's computed invocation inside a conditional, at the depth its caller gives it.
      const dispatcher: Script = [Op.OP_1, Op.OP_IF, Op.OP_DUP, Op.OP_INVOKE, Op.OP_ENDIF];
      expect(controlStackDepth(dispatcher, (id) => depths.get(id), 6)).toEqual({ deepest: 7, open: 0 });
      expect(controlStackDepth(dispatcher, (id) => depths.get(id))).toBeUndefined();
      const program: Script = [Uint8Array.of(Op.OP_DUP), Op.OP_7, Op.OP_DEFINE, Op.OP_IF];
      expect(controlStackDepth(program, (id) => depths.get(id))).toBeUndefined();
      expect(controlStackDepth(program, (id) => depths.get(id), undefined, true)).toEqual({ deepest: 1, open: 1 });
    });

    it('reads only literal definitions from a program', () => {
      const definitions = literalDefinitions([
        Uint8Array.of(Op.OP_DUP), Op.OP_7, Op.OP_DEFINE,
        Op.OP_DUP, Op.OP_SWAP, encodeInt(9n), Op.OP_DEFINE,
      ]);
      expect([...definitions.keys()]).toEqual(['07']);
      expect(definitions.get('07')).toEqual({ bodyIndex: 0, body: Uint8Array.of(Op.OP_DUP) });
    });
  });

  // PARAMETERIZED sharing is DISABLED as unsound (see `outline.ts`, and `8c727b03f`): it parks per-site operands
  // on the altstack, and because outlined bodies re-enter the corpus on later rounds, a nested parameterized
  // helper can retrieve the wrong altstack value - observed as "OP_INVOKE an undefined function identifier" on
  // ChainedPush. This row therefore pins that it does NOT happen. Restore the assertions below, and this title,
  // if the nesting proof lands and the feature is re-enabled.
  it('does NOT share straight-line spans whose pushed constants differ (parameterization is disabled)', () => {
    const operations: Script[] = [
      [Op.OP_ADD, Op.OP_SWAP, Op.OP_SUB, Op.OP_OVER, Op.OP_BOOLAND, Op.OP_ROT, Op.OP_BOOLOR, Op.OP_TUCK],
      [Op.OP_NUMEQUAL, Op.OP_NIP, Op.OP_LESSTHAN, Op.OP_DROP, Op.OP_SHA256, Op.OP_DUP, Op.OP_CAT, Op.OP_SIZE],
      [Op.OP_HASH160, Op.OP_OVER, Op.OP_GREATERTHAN, Op.OP_NIP, Op.OP_SHA1, Op.OP_SWAP, Op.OP_ADD, Op.OP_TUCK],
      [Op.OP_HASH256, Op.OP_ROT, Op.OP_NUMNOTEQUAL, Op.OP_DROP, Op.OP_RIPEMD160, Op.OP_DUP, Op.OP_CAT, Op.OP_SIZE],
    ];
    const parameterized = (offset: number): Script => operations.flatMap((segment, index) => [
      Uint8Array.of(offset + index + 17), ...segment,
    ]);
    const result = outlineSharedSpans([
      body(parameterized(0)),
      body(parameterized(32)),
    ], allocateId);

    expect(result.functions.find((fn) => fn.script.includes(Op.OP_TOALTSTACK))).toBeUndefined();
    // And no helper parks operands on the altstack by any other route, which is the property that made it unsound.
    for (const fn of result.functions) {
      expect(fn.script).not.toContain(Op.OP_TOALTSTACK);
      expect(fn.script).not.toContain(Op.OP_FROMALTSTACK);
    }
  });
});
