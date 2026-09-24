/**
 * KernelExecutionPlan bytecode commitment: plan digest embedded in route bytecode (SCKP commitment).
 * KernelExecutionPlan version gate: StatefulContract plan readers gate on kernelPlanVersion.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Artifact } from '@solidcash/utils';
import {
  encodeKernelPlanDigestBytecode,
  hasUniqueKernelPlanDigestCommitment,
  KERNEL_PLAN_DIGEST_COMMITMENT_TAG_HEX,
} from '@solidcash/utils';
import {
  authorizeComposeParticipantLayout,
  clearComposeKernelAuthorityResults,
} from '../../src/message-bus/compose-kernel-authority.js';
import {
  assertReadableKernelExecutionPlans,
  createKernelExecutionPlan,
  digestKernelExecutionPlan,
  stampKernelExecutionPlanCommitment,
} from '../../src/message-bus/kernel-execution-plan.js';
import {
  readKernelExecutionPlans,
  requireKernelExecutionPlanDigest,
} from '../../src/stateful/KernelExecutionPlanReader.js';

function bareArtifact(bytecode = 'OP_1'): Artifact {
  return {
    contractName: 'PlanProbe',
    constructorInputs: [],
    abi: [],
    bytecode,
    source: '',
    messageBus: {
      version: 1,
      selector: '53434231',
      maximumRows: 8,
      maximumBlobBytes: 223,
      route: { name: 'route', inputs: [], functionIndex: 0 },
      handlers: [],
    },
  } as unknown as Artifact;
}

describe('KernelExecutionPlan bytecode commitment kernel plan digest bytecode commitment', () => {
  it('encodeKernelPlanDigestBytecode produces a unique SCKP push/drop marker', () => {
    const plan = createKernelExecutionPlan({
      handlerId: 'handler:a9059cbb',
      handlerName: 'transfer',
      dynamicWrites: [],
    });
    const digest = digestKernelExecutionPlan(plan);
    const marker = encodeKernelPlanDigestBytecode(digest);
    expect(marker.startsWith(KERNEL_PLAN_DIGEST_COMMITMENT_TAG_HEX)).toBe(true);
    expect(marker.endsWith(' OP_DROP')).toBe(true);
    expect(hasUniqueKernelPlanDigestCommitment(marker, digest)).toBe(true);
    expect(hasUniqueKernelPlanDigestCommitment('OP_1', digest)).toBe(false);
  });

  it('stampKernelExecutionPlanCommitment embeds digest in bytecode and publishes plans', () => {
    const artifact = bareArtifact('OP_TRUE');
    const plan = createKernelExecutionPlan({
      handlerId: 'handler:deadbeef',
      dynamicWrites: ['balances'],
    });
    const { digest, bytecodeCommitment } = stampKernelExecutionPlanCommitment(artifact, plan);

    expect(artifact.bytecode).toContain(bytecodeCommitment);
    expect(hasUniqueKernelPlanDigestCommitment(artifact.bytecode, digest)).toBe(true);
    expect(artifact.messageBus?.kernelExecutionPlans?.version).toBe(1);
    expect(artifact.messageBus?.kernelExecutionPlans?.plans).toEqual([
      expect.objectContaining({
        handlerId: 'handler:deadbeef',
        kernelPlanVersion: 1,
        digest,
      }),
    ]);

    // Transplant metadata without bytecode: reader fails closed.
    const transplanted = bareArtifact('OP_TRUE');
    transplanted.messageBus!.kernelExecutionPlans = artifact.messageBus!.kernelExecutionPlans;
    expect(() => assertReadableKernelExecutionPlans(transplanted))
      .toThrow(/not uniquely committed by route bytecode/);
  });

  it('authorizeComposeParticipantLayout returns bytecodeCommitment matching the digest', () => {
    clearComposeKernelAuthorityResults();
    const result = authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'cafef00d',
      handlerDiagnosticName: 'reset',
      publishedBase: 2,
      claimCount: 1,
    });
    expect(result.bytecodeCommitment).toBe(encodeKernelPlanDigestBytecode(result.digest));
    expect(result.bytecodeCommitment).toContain(result.digest);
  });

  it('production compose stamps __kernel_plan_bytecode__ relocation', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const bus = join(here, '../../src/message-bus');
    const composeSrc = [
      readFileSync(join(bus, 'compose.ts'), 'utf8'),
      readFileSync(join(bus, 'compose-assemble.ts'), 'utf8'),
    ].join('\n');
    const authoritySrc = readFileSync(join(bus, 'compose-kernel-authority.ts'), 'utf8');
    expect(authoritySrc).toContain('bytecodeCommitment');
    expect(authoritySrc).toContain('encodeKernelExecutionPlanBytecodeCommitment');
    expect(composeSrc).toContain('__kernel_plan_bytecode__');
    expect(composeSrc).toContain('kernelAuthority.bytecodeCommitment');
  });

  it('KernelExecutionPlan digest: create/digest live in utils for compile-time SCKP embedding', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const utilsPlan = readFileSync(
      join(here, '../../../utils/src/kernel-execution-plan.ts'),
      'utf8',
    );
    const solidcCompiler = readFileSync(
      join(here, '../../../solidc/src/compiler.ts'),
      'utf8',
    );
    expect(utilsPlan).toContain('export function digestKernelExecutionPlan');
    expect(utilsPlan).toContain('export function createKernelExecutionPlan');
    expect(solidcCompiler).toContain('stampKernelExecutionPlanDigestsAtCompile');
    expect(solidcCompiler).toContain('embedKernelPlanDigestInBytecode');
  });
});

describe('KernelExecutionPlan version gate StatefulContract kernelPlanVersion reader gate', () => {
  it('readKernelExecutionPlans refuses missing publication and wrong version', () => {
    expect(() => readKernelExecutionPlans(bareArtifact()))
      .toThrow(/no published kernelExecutionPlans/);

    const artifact = bareArtifact('OP_1');
    const plan = createKernelExecutionPlan({ handlerId: 'handler:abcd', dynamicWrites: [] });
    stampKernelExecutionPlanCommitment(artifact, plan);

    const ok = readKernelExecutionPlans(artifact);
    expect(ok).toHaveLength(1);
    expect(ok[0]?.kernelPlanVersion).toBe(1);
    expect(requireKernelExecutionPlanDigest(artifact, 'handler:abcd')).toBe(ok[0]?.digest);

    // Corrupt version after stamp — reader gate must refuse.
    artifact.messageBus!.kernelExecutionPlans = {
      version: 1,
      plans: [{
        handlerId: 'handler:abcd',
        kernelPlanVersion: 99,
        digest: ok[0]!.digest,
      }],
    };
    expect(() => readKernelExecutionPlans(artifact))
      .toThrow(/unsupported kernelPlanVersion 99/);
  });

  it('production StatefulContract reader module wires assertReadableKernelExecutionPlans', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const readerSrc = readFileSync(
      join(here, '../../src/stateful/KernelExecutionPlanReader.ts'),
      'utf8',
    );
    const indexSrc = readFileSync(join(here, '../../src/stateful/index.ts'), 'utf8');
    expect(readerSrc).toContain('assertReadableKernelExecutionPlans');
    expect(readerSrc).toContain('export function readKernelExecutionPlans');
    expect(indexSrc).toContain("from './KernelExecutionPlanReader.js'");
  });
});
