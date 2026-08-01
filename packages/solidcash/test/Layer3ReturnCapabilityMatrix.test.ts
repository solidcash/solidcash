import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Status = 'native-worklist-vm' | 'compiled-manual-plan-vm' | 'planner-rejection';

const MATRIX: readonly { capability: string; status: Status; file: string; title: string }[] = [
  { capability: 'scalar result-dependent continuation', status: 'native-worklist-vm', file: 'e2e/Layer3ResultFanInX3.test.ts', title: 'settles two producer results under one caller' },
  { capability: 'ordered two-result fan-in', status: 'native-worklist-vm', file: 'e2e/Layer3ResultFanInX3.test.ts', title: 'settles two producer results under one caller' },
  { capability: 'return then void', status: 'native-worklist-vm', file: 'e2e/Layer3ResultFanInX3.test.ts', title: 'settles a returning call followed by a void call' },
  { capability: 'void then return', status: 'native-worklist-vm', file: 'e2e/Layer3ResultFanInX3.test.ts', title: 'settles a void call followed by a returning call' },
  { capability: 'transitive heterogeneous chain', status: 'compiled-manual-plan-vm', file: 'e2e/Layer3ResultGraph.test.ts', title: 'settles a six-participant transitive chain whose five result schemas all differ' },
  { capability: 'tuple schema', status: 'compiled-manual-plan-vm', file: 'e2e/Layer3ResultGraph.test.ts', title: 'rejects a forged non-leading tuple field produced by the deepest consumer' },
  { capability: 'named struct schema', status: 'compiled-manual-plan-vm', file: 'e2e/Layer3ResultGraph.test.ts', title: 'rejects a forged struct field midway along the transitive chain' },
  { capability: 'dynamic string schema', status: 'compiled-manual-plan-vm', file: 'e2e/Layer3ResultGraph.test.ts', title: 'rejects a forged dynamic string result midway along the transitive chain' },
  { capability: 'dynamic bytes schema', status: 'compiled-manual-plan-vm', file: 'e2e/Layer3ResultGraph.test.ts', title: 'rejects a forged dynamic bytes result consumed by the root' },
  { capability: 'forward consumed result into later argument', status: 'native-worklist-vm', file: 'e2e/Layer3ResultFanInX3.test.ts', title: 'settles two producer results under one caller' },
  { capability: 'structural owner cycle', status: 'native-worklist-vm', file: 'Layer3CompiledGraph.test.ts', title: 'separates resolvable result dependencies from structural owner cycles' },
  { capability: 'result-dependency cycle', status: 'planner-rejection', file: 'Layer3CompiledGraph.test.ts', title: 'separates resolvable result dependencies from structural owner cycles' },
] as const;

describe('invocation-transcript-v1 return capability matrix', () => {
  it('classifies every named return/fan-in boundary and pins its executable evidence', () => {
    expect(MATRIX).toHaveLength(12);
    expect(new Set(MATRIX.map(({ capability }) => capability)).size).toBe(12);
    expect(MATRIX.filter(({ status }) => status === 'native-worklist-vm')).toHaveLength(6);
    expect(MATRIX.filter(({ status }) => status === 'compiled-manual-plan-vm')).toHaveLength(5);
    expect(MATRIX.filter(({ status }) => status === 'planner-rejection')).toHaveLength(1);
    const here = dirname(fileURLToPath(import.meta.url));
    for (const { file, title } of MATRIX) {
      expect(readFileSync(resolve(here, file), 'utf8'), `${file}: missing evidence '${title}'`).toContain(title);
    }
  });
});
