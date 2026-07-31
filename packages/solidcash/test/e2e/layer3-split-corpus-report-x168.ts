import { writeFileSync } from 'fs';
import { asmToBytecode } from '@solidcash/utils';

export interface X168CaseSpec {
  id: string;
  file: string;
  options?: Record<string, unknown>;
}

export function reportSplitCase(spec: X168CaseSpec, bundle: any): any {
  const infos = bundle?.manifest?.facets;
  if (!Array.isArray(infos)) throw new Error(`X168 attribution refusal: ${spec.id} has no facet manifest`);
  const names = infos.map((facet: any) => facet.name);
  if (new Set(names).size !== names.length) {
    throw new Error(`X168 attribution refusal: ${spec.id} has duplicate facet names`);
  }
  const artifactNames = Object.keys(bundle.facets ?? {}).sort();
  if (JSON.stringify([...names].sort()) !== JSON.stringify(artifactNames)) {
    throw new Error(`X168 attribution refusal: ${spec.id} manifest/artifact facet sets disagree`);
  }
  const allowedTargets = new Set(['root', ...names]);
  const routes = bundle.manifest.routes ?? [];
  for (const route of routes) {
    if (!allowedTargets.has(route.target)) {
      throw new Error(`X168 attribution refusal: ${spec.id}/${route.function} names unknown target ${route.target}`);
    }
  }
  const membership = (target: string): string[] => routes.filter((route: any) => route.target === target)
    .map((route: any) => route.function).sort();
  return {
    id: spec.id,
    file: spec.file,
    options: spec.options ?? {},
    facetCount: infos.length,
    root: {
      artifactBytes: asmToBytecode(bundle.root.bytecode).length,
      functions: membership('root'),
    },
    facets: infos.map((info: any) => ({
      name: info.name,
      estimatedRedeemBytes: info.estimatedRedeemBytes,
      artifactBytes: asmToBytecode(bundle.facets[info.name].bytecode).length,
      functions: membership(info.name),
    })),
  };
}

export function writeSplitCorpusReport(path: string, cases: any[]): void {
  if (!path.startsWith('/tmp/')) {
    throw new Error('X168 measurement refusal: L3_X168_OUT must be an absolute /tmp path');
  }
  if (cases.length === 0) throw new Error('X168 measurement refusal: case manifest produced zero cases');
  writeFileSync(path, `${JSON.stringify({ cases }, null, 2)}\n`);
}
