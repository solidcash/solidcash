/**
 * R5: omitted empty provenance ≠ legacy-logical; kernel parents refuse legacy-logical.
 */
import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { assertExplicitSourceCallsiteProvenance } from '../../src/message-bus/graph.js';

const artifact = (convention?: 'kernel-row-loop'): { artifact: Artifact } => ({
  artifact: {
    contractName: 'P',
    constructorInputs: [],
    abi: [],
    bytecode: '',
    source: '',
    messageBus: convention === undefined ? undefined : {
      version: 1,
      selector: '00',
      convention,
      maximumRows: 4,
      maximumBlobBytes: 100,
      route: { name: 'r', inputs: [], functionIndex: 0 },
      handlers: [],
    },
  } as unknown as Artifact,
});

describe('R5 assertExplicitSourceCallsiteProvenance', () => {
  it('refuses sourceCallsiteId without provenance stamp', () => {
    expect(() => assertExplicitSourceCallsiteProvenance(
      [{ sourceCallsiteId: 4 }],
      [{ parent: 0, callee: 0 }],
      [artifact()],
    )).toThrow(/without sourceCallsiteProvenance/);
  });

  it('accepts compiler provenance under kernel parent', () => {
    expect(() => assertExplicitSourceCallsiteProvenance(
      [
        {},
        { sourceCallsiteId: 4, sourceCallsiteProvenance: 'compiler' },
      ],
      [
        { parent: null, callee: 0 },
        { parent: 0, callee: 1 },
      ],
      [artifact('kernel-row-loop'), artifact('kernel-row-loop')],
    )).not.toThrow();
  });

  it('refuses legacy-logical when parent owner is kernel-row-loop', () => {
    expect(() => assertExplicitSourceCallsiteProvenance(
      [
        {},
        { sourceCallsiteId: 4, sourceCallsiteProvenance: 'legacy-logical' },
      ],
      [
        { parent: null, callee: 0 },
        { parent: 0, callee: 1 },
      ],
      [artifact('kernel-row-loop'), artifact()],
    )).toThrow(/legacy-logical provenance under kernel-row-loop/);
  });

  it('allows legacy-logical when parent owner is non-kernel', () => {
    expect(() => assertExplicitSourceCallsiteProvenance(
      [
        {},
        { sourceCallsiteId: 4, sourceCallsiteProvenance: 'legacy-logical' },
      ],
      [
        { parent: null, callee: 0 },
        { parent: 0, callee: 1 },
      ],
      [artifact(), artifact()],
    )).not.toThrow();
  });
});
