#!/usr/bin/env node
/**
 * Microbenchmark: per-edit tail shift via `splice` vs a bulk `copyWithin` shift, on the array shapes the
 * outliner actually rewrites (a large numeric script and a large object array).
 *
 *   node scripts/micro-splice.mjs
 */
const build = (n, objects) => objects
  ? Array.from({ length: n }, (_u, i) => ({ line: i, col: i % 80, src: 'x' }))
  : Array.from({ length: n }, (_u, i) => i % 256);

// Descending, non-overlapping spans, as in the rewrite. Replacement is 2 elements.
const makeEdits = (n, count, spanLength) => {
  const edits = [];
  let cursor = n - spanLength;
  for (let i = 0; i < count && cursor > 0; i += 1) {
    edits.push({ start: cursor, spanLength });
    cursor -= spanLength + 40;
  }
  return edits;
};

const viaSplice = (array, edits) => {
  const work = array.slice();
  for (const { start, spanLength } of edits) work.splice(start, spanLength, 0, 0);
  return work;
};

const viaCopyWithin = (array, edits) => {
  const work = array.slice();
  for (const { start, spanLength } of edits) {
    const tail = start + spanLength;
    work.copyWithin(start + 2, tail);
    work.length -= spanLength - 2;
    work[start] = 0;
    work[start + 1] = 0;
  }
  return work;
};

const time = (label, fn, array, edits) => {
  const t0 = process.hrtime.bigint();
  fn(array, edits);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`  ${label.padEnd(16)} ${ms.toFixed(1)} ms`);
  return ms;
};

for (const [name, objects] of [['numeric', false], ['object', true]]) {
  for (const n of [50000, 200000]) {
    const array = build(n, objects);
    const edits = makeEdits(n, 2000, 6);
    console.log(`\n${name} array, length ${n}, ${edits.length} edits (span 6):`);
    const a = time('splice', viaSplice, array, edits);
    const b = time('copyWithin', viaCopyWithin, array, edits);
    console.log(`  -> copyWithin is ${(a / b).toFixed(2)}x ${b < a ? 'FASTER' : 'SLOWER'}`);
  }
}

// --- consolidated one-rebuild-per-body vs per-edit splice, on the same edit lists ---
const viaConsolidated = (array, edits) => {
  const blocks = [];
  let cursor = array.length;
  for (const { start, spanLength } of edits) {
    blocks.push({ kind: 'segment', from: start + spanLength, to: cursor });
    blocks.push({ kind: 'replacement', at: start });
    cursor = start;
  }
  blocks.push({ kind: 'segment', from: 0, to: cursor });
  const out = [];
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.kind === 'replacement') { out.push(0, 0); continue; }
    for (let copy = block.from; copy < block.to; copy += 1) out.push(array[copy]);
  }
  return out;
};

console.log('\n=== consolidated (one rebuild per body) vs per-edit splice ===');
for (const [name, objects] of [['numeric', false], ['object', true]]) {
  for (const n of [50000, 200000]) {
    const array = build(n, objects);
    const edits = makeEdits(n, 2000, 6);
    console.log(`\n${name} array, length ${n}, ${edits.length} edits:`);
    const a = time('splice', viaSplice, array, edits);
    const c = time('consolidated', viaConsolidated, array, edits);
    console.log(`  -> consolidated is ${(a / c).toFixed(1)}x ${c < a ? 'FASTER' : 'SLOWER'}`);
  }
}
