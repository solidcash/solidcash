/**
 * deployability certificate: deployability / budget certificates on message-bus artifacts.
 * Compiler stamps a concrete `asserted` | `over-budget` certificate; `"not-asserted"` ambiguity is retired.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertDeployabilityCertificate,
  buildDeployabilityCertificate,
  P2SH_BYTECODE_LIMIT,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

describe('deployability certificate deployability / budget certificates', () => {
  it('buildDeployabilityCertificate asserts within P2SH and marks over-budget above limit', () => {
    const asserted = buildDeployabilityCertificate({
      measuredBytecodeBytes: 1_200,
      maximumRows: 8,
      maximumBlobBytes: 520,
      maximumParticipants: 8,
    });
    expect(asserted.status).toBe('asserted');
    expect(asserted.withinP2shLimit).toBe(true);
    expect(asserted.p2shBytecodeLimit).toBe(P2SH_BYTECODE_LIMIT);
    expect(asserted.budgets).toEqual({
      maximumRows: 8,
      maximumBlobBytes: 520,
      maximumParticipants: 8,
    });
    expect(() => assertDeployabilityCertificate(asserted)).not.toThrow();

    const over = buildDeployabilityCertificate({
      measuredBytecodeBytes: P2SH_BYTECODE_LIMIT + 1,
    });
    expect(over.status).toBe('over-budget');
    expect(over.withinP2shLimit).toBe(false);
    expect(() => assertDeployabilityCertificate(over)).toThrow(/over P2SH budget/);
  });

  it('assertDeployabilityCertificate fails closed when certificate is missing (legacy not-asserted)', () => {
    expect(() => assertDeployabilityCertificate(undefined))
      .toThrow(/certificate missing \(legacy not-asserted\)/);
  });

  it('fixtures kernel compile stamps asserted deployability on messageBus (shipped path)', () => {
    const artifact = compileString(`contract Journal() {
      mapping(int => int) values;
      function set(int key, int value) {
        this.values[key] = value;
        require(true);
      }
    }`, KERNEL);

    const cert = artifact.messageBus?.deployability;
    expect(cert).toBeDefined();
    expect(cert?.version).toBe(1);
    expect(cert?.status).toBe('asserted');
    expect(cert?.withinP2shLimit).toBe(true);
    expect(cert?.measuredBytecodeBytes).toBeGreaterThan(0);
    expect(cert?.measuredBytecodeBytes).toBeLessThanOrEqual(P2SH_BYTECODE_LIMIT);
    expect(cert?.budgets?.maximumBlobBytes).toBe(10_000);
    // Not left as stringly "not-asserted".
    expect(cert).not.toEqual('not-asserted');
    expect(() => assertDeployabilityCertificate(cert)).not.toThrow();
  });

  it('compiler production path calls buildDeployabilityCertificate when publishing messageBus', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      join(here, '../../../solidc/src/compiler.ts'),
      'utf8',
    );
    expect(src).toContain('buildDeployabilityCertificate');
    expect(src).toContain('deployability: buildDeployabilityCertificate');
    expect(src).toMatch(/measuredBytecodeBytes:\s*asmToBytecode\(artifact\.bytecode\)\.length/);
  });

  it('kernel-beta-manifest no longer uses stringly deployability not-asserted', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(readFileSync(
      join(here, '../../../../scripts/kernel-beta-manifest.json'),
      'utf8',
    )) as {
      coldCompiles: Array<{ name: string; deployability: unknown }>;
    };
    for (const entry of manifest.coldCompiles) {
      expect(typeof entry.deployability).toBe('object');
      expect(entry.deployability).not.toBe('not-asserted');
      const cert = entry.deployability as {
        version: number; status: string; withinP2shLimit: boolean;
      };
      expect(cert.version).toBe(1);
      expect(['asserted', 'over-budget']).toContain(cert.status);
    }
    const marketplace = manifest.coldCompiles.find((entry) => entry.name === 'marketplace-v1');
    expect((marketplace?.deployability as { status: string }).status).toBe('over-budget');
    const unicrow = manifest.coldCompiles.find((entry) => entry.name === 'unicrow-claim');
    expect((unicrow?.deployability as { status: string }).status).toBe('asserted');
  });
});
