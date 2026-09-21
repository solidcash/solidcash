/**
 * Would outlining the top-level script and the OP_DEFINE'd bodies as ONE corpus beat the two separate passes?
 *
 * Today `outlineSharedFunctionBodies` shares across the bodies and `poolTopLevelConstants` shares within the
 * top level. A span or constant that appears once in a body and once at the top level is invisible to both.
 * This replays a combined pass over the finished script and reports what it still finds - i.e. what the split
 * is leaving behind.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileFile } from '../packages/solidc/src/index.js';
import { asmToScript, bytecodeToScript, calculateBytesize, encodeInt, Op } from '../packages/utils/src/index.js';
import { outlineSharedSpans } from '../packages/utils/src/outline.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.resolve(here, '../packages/solidc/test/valid-contract-files');
/** The top-level script with each pushed body replaced by a placeholder, plus the bodies themselves. */
function split(script) {
    const top = [];
    const bodies = [];
    for (let i = 0; i < script.length; i += 1) {
        if (script[i + 2] === Op.OP_DEFINE && typeof script[i] !== 'number') {
            bodies.push(bytecodeToScript(script[i]));
            top.push(script[i], script[i + 1], script[i + 2]);
            i += 2;
            continue;
        }
        top.push(script[i]);
    }
    return [top, ...bodies];
}
let combinedTotal = 0;
let separateTotal = 0;
const rows = [];
for (const file of fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort()) {
    let script;
    try {
        script = asmToScript(compileFile(path.join(CORPUS, file)).bytecode);
    }
    catch {
        continue;
    }
    const parts = split(script);
    if (parts.length < 2)
        continue;
    const asBodies = (list) => list.map((s) => ({ script: s, locationData: s.map(() => undefined) }));
    let next = -900n;
    const allocate = () => { next -= 1n; return encodeInt(next); };
    const combined = outlineSharedSpans(asBodies(parts), allocate, () => 2).savedBytes;
    next = -900n;
    const top = outlineSharedSpans(asBodies([parts[0]]), allocate, () => 2).savedBytes;
    next = -900n;
    const bodies = parts.length > 1
        ? outlineSharedSpans(asBodies(parts.slice(1)), allocate, () => 2).savedBytes : 0;
    combinedTotal += combined;
    separateTotal += top + bodies;
    const extra = combined - (top + bodies);
    if (extra > 0)
        rows.push({ name: file, extra, total: calculateBytesize(script) });
}
rows.sort((a, b) => b.extra - a.extra);
for (const r of rows.slice(0, 15)) {
    console.log(`${String(r.extra).padStart(6)}B extra (${((r.extra / r.total) * 100).toFixed(1)}% of ${r.total}B)\t${r.name}`);
}
console.log(`\ncombined residual ${combinedTotal}B vs separate ${separateTotal}B `
    + `-> a unified pass would find ${combinedTotal - separateTotal}B more`);
//# sourceMappingURL=unified-outline-prize.js.map