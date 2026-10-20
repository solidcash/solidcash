#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Show that `splice(start, spanLength, a, b)` and a `copyWithin`-based tail shift are NOT equivalent.
 *
 * The outliner's rewrite replaces a span of `spanLength` elements with exactly two elements (`id`, OP_INVOKE),
 * so the tail shifts left by `spanLength - 2`. That looks like a `copyWithin` plus a length trim, which would
 * avoid `splice`'s per-edit tail move. This harness demonstrates the divergence and is the evidence for the
 * negative result.
 *
 * Two divergence classes show up:
 *
 *   - `spanLength === 1`: the replacement is LONGER than the span (net +1), so `shrink` is negative and the
 *     overlapping copy runs the wrong way.
 *   - spans near the end of the array: `copyWithin` clamps the source end to the array length, so the final
 *     elements of the tail are silently dropped instead of kept, while `splice` retains them.
 *
 * Both occur on real compiles, which is why a `spanLength >= 2` guard alone was still wrong and why the
 * unguarded variant hung.
 *
 *   node scripts/equiv-splice-copywithin.mjs
 */
const rand = (n) => Math.floor(Math.random() * n);
let mismatches = 0;
let firstExample = null;
const mismatchesBySpan = new Map();
for (let trial = 0; trial < 200000; trial += 1) {
  const len = 3 + rand(40);
  const array = Array.from({ length: len }, (_unused, index) => index);
  const spanLength = 1 + rand(4);
  const start = rand(len);

  const viaSplice = array.slice();
  viaSplice.splice(start, spanLength, 'A', 'B');

  const viaCopyWithin = array.slice();
  const tail = start + spanLength;
  const shrink = spanLength - 2;
  viaCopyWithin.copyWithin(start + 2, tail);
  viaCopyWithin.length -= shrink;
  viaCopyWithin[start] = 'A';
  viaCopyWithin[start + 1] = 'B';

  if (JSON.stringify(viaSplice) !== JSON.stringify(viaCopyWithin)) {
    mismatches += 1;
    mismatchesBySpan.set(spanLength, (mismatchesBySpan.get(spanLength) ?? 0) + 1);
    firstExample ??= { start, spanLength, len, viaSplice, viaCopyWithin };
  }
}

console.log('trials: 200000');
console.log('mismatches:', mismatches);
if (firstExample) {
  console.log('\nfirst mismatch:', JSON.stringify({
    len: firstExample.len, start: firstExample.start, spanLength: firstExample.spanLength,
  }));
  console.log('  splice     :', firstExample.viaSplice.join(','));
  console.log('  copyWithin :', firstExample.viaCopyWithin.join(','));
  console.log('\nmismatches by spanLength:',
    JSON.stringify(Object.fromEntries([...mismatchesBySpan].sort((left, right) => left[0] - right[0]))));
}
process.exitCode = mismatches === 0 ? 0 : 1;
