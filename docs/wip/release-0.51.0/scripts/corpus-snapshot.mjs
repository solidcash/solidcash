// usage: W=<worktree> node corpus-snapshot.mjs <label> <optionsJSON> <out.json> [shard] [shards]
// Compile every .scash in the five corpus directories with <worktree>'s compiler and record each artifact's size and hash;
// compare two snapshots to see which contracts a compiler change moves. 352 files on 2026-11-15.
import { readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const W = process.env.W;
const { compileFileMulti } = await import(`${W}/packages/solidc/dist/index.js`);
const { asmToBytecode } = await import(`${W}/packages/utils/dist/index.js`);
const [label, optionsJson, out, shardArg, shardsArg] = process.argv.slice(2);
const options = JSON.parse(optionsJson);
const shard = Number(shardArg ?? 0); const shards = Number(shardsArg ?? 1);
const dirs = [`${W}/packages/solidc/test/valid-contract-files`, `${W}/packages/solidcash/test/fixture`,
  `${W}/packages/solidcash/contracts`, `${W}/packages/solidcash/contracts/examples`, `${W}/examples`];
const files = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.scash')).map((f) => `${d}/${f}`)).sort();
const result = {};
const silent = { suppressWarnings: true };
files.forEach((file, i) => {
  if (i % shards !== shard) return;
  const key = file.replace(`${W}/`, '');
  try {
    const map = compileFileMulti(file, { ...options, ...silent });
    result[key] = {};
    for (const [name, a] of Object.entries(map)) {
      let code = '';
      try { code = Buffer.from(asmToBytecode(a.bytecode)).toString('hex'); } catch { code = a.bytecode; }
      result[key][name] = {
        sha: createHash('sha256').update(code).digest('hex').slice(0, 16), len: code.length / 2,
        recordSound: a.recordSound, genesisCalls: a.genesisCalls, callBatch: a.callBatch,
        abi: (a.abi ?? []).map((fn) => `${fn.name}(${(fn.inputs ?? []).map((x) => x.name).join(',')})${fn.callBatchRow ? '[row]' : ''}`),
      };
    }
  } catch (e) {
    result[key] = { error: String(e?.message ?? e).split('\n')[0].slice(0, 300) };
  }
});
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(label, 'done', Object.keys(result).length);
