import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { asmToBytecode } from '@solidcash/utils';

export interface X168CaseSpec {
  id: string;
  sourceRoot: 'repo' | 'eacc';
  file: string;
  contract: string;
  sourceSha256: string;
  options?: Record<string, unknown>;
}

export interface X168ResolvedCaseSpec extends X168CaseSpec {
  resolvedFile: string;
}

export const X168_CASE_IDS = [
  'SplitCounter', 'Multi7201-together', 'Pair-union', 'Sized', 'OracleUser', 'SplitInit-oracle',
  'local-Unicrow', 'local-UnicrowClaim', 'local-UnicrowDispute', 'eacc-MarketplaceV1',
] as const;

export function validateX168Manifest(
  value: unknown, roots: { repo: string; eacc: string },
): X168ResolvedCaseSpec[] {
  if (!Array.isArray(value)) throw new Error('X168 manifest refusal: root must be an array');
  const specs = value as X168CaseSpec[];
  const ids = specs.map((spec) => spec?.id);
  if (specs.length !== X168_CASE_IDS.length || JSON.stringify(ids) !== JSON.stringify(X168_CASE_IDS)) {
    throw new Error(`X168 manifest refusal: expected exact ordered case set ${X168_CASE_IDS.join(', ')}`);
  }
  if (new Set(ids).size !== ids.length) throw new Error('X168 manifest refusal: case ids are not unique');
  return specs.map((spec) => {
    if (spec.sourceRoot !== 'repo' && spec.sourceRoot !== 'eacc') {
      throw new Error(`X168 manifest refusal: ${spec.id} has unknown source root`);
    }
    if (!spec.file || spec.file.startsWith('/') || spec.file.includes('..')) {
      throw new Error(`X168 manifest refusal: ${spec.id} source path is not root-relative`);
    }
    if (!spec.contract) throw new Error(`X168 manifest refusal: ${spec.id} has no contract identity`);
    if (!/^[0-9a-f]{64}$/.test(spec.sourceSha256)) {
      throw new Error(`X168 manifest refusal: ${spec.id} has invalid source digest`);
    }
    const path = resolve(roots[spec.sourceRoot], spec.file);
    const source = readFileSync(path, 'utf8');
    const digest = createHash('sha256').update(source).digest('hex');
    if (digest !== spec.sourceSha256) {
      throw new Error(`X168 manifest refusal: ${spec.id} source digest mismatch (${digest})`);
    }
    if (!new RegExp(`\\bcontract\\s+${spec.contract}\\b`).test(source)) {
      throw new Error(`X168 manifest refusal: ${spec.id} source does not declare ${spec.contract}`);
    }
    return { ...spec, resolvedFile: path };
  });
}

export function reportSplitCase(spec: X168CaseSpec, bundle: any): any {
  if (bundle?.root?.contractName !== spec.contract) {
    throw new Error(`X168 attribution refusal: ${spec.id} compiled ${bundle?.root?.contractName ?? 'no contract'} instead of ${spec.contract}`);
  }
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
