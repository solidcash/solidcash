/**
 * sourceCallsite attribution / delegate ABI selector-first join / PredOut preflight claims name-authority and PredOut preflight leftovers.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDelegateAbiFunction } from '../../src/message-bus/delegate.js';
import { bindConsumerCallsites } from '../../src/message-bus/graph.js';
import type { Artifact, ExternalCallAbi } from '@solidcash/utils';

describe('delegate ABI selector-first join delegate selector-aware ABI find', () => {
  const artifact = {
    contractName: 'Impl',
    abi: [
      { name: 'renamedImpl', selector: 'aabbccdd', inputs: [] },
      { name: 'other', selector: '11223344', inputs: [] },
    ],
    messageBus: {
      version: 1 as const,
      selector: '53434231',
      maximumRows: 8,
      maximumBlobBytes: 520,
      convention: 'kernel-row-loop' as const,
      handlers: [
        { name: 'doWork', selector: 'aabbccdd', inputs: [], eligible: true },
      ],
    },
  } as unknown as Artifact;

  it('binds by explicit functionSelector even when ABI name differs (alpha-rename)', () => {
    const fn = findDelegateAbiFunction(artifact, 'doWork', 'aabbccdd');
    expect(fn.name).toBe('renamedImpl');
    expect(fn.selector).toBe('aabbccdd');
  });

  it('prefers messageBus handler selector when only diagnostic name is supplied', () => {
    const fn = findDelegateAbiFunction(artifact, 'doWork');
    expect(fn.selector).toBe('aabbccdd');
    expect(fn.name).toBe('renamedImpl');
  });

  it('fails closed when supplied selector is missing', () => {
    expect(() => findDelegateAbiFunction(artifact, 'doWork', 'deadbeef'))
      .toThrow(/no function with selector 'deadbeef'/);
  });

  it('legacy name-only still works when no selector path exists', () => {
    const legacy = {
      contractName: 'Legacy',
      abi: [{ name: 'onlyName', inputs: [] }],
    } as unknown as Artifact;
    expect(findDelegateAbiFunction(legacy, 'onlyName').name).toBe('onlyName');
  });
});

describe('sourceCallsite attribution bindConsumerCallsites unique attribution', () => {
  const dualSameName: ExternalCallAbi[] = [
    {
      callsiteId: 1,
      interfaceName: 'I',
      functionName: 'push',
      hasReturnValues: false,
      returnTypes: [],
      resultEncoding: 'legacy',
    },
    {
      callsiteId: 2,
      interfaceName: 'I',
      functionName: 'push',
      hasReturnValues: false,
      returnTypes: [],
      resultEncoding: 'legacy',
    },
  ];

  it('kernel requireUniqueAttribution fails closed on same-name multi-candidate collapse', () => {
    // once + loop → not positional; same-name candidates would first-match without the gate.
    const mixed: ExternalCallAbi[] = [
      {
        callsiteId: 1,
        interfaceName: 'I',
        functionName: 'push',
        occurrence: 'once',
        hasReturnValues: false,
        returnTypes: [],
        resultEncoding: 'legacy',
      },
      {
        callsiteId: 2,
        interfaceName: 'I',
        functionName: 'push',
        occurrence: 'loop',
        maximumOccurrences: 8,
        hasReturnValues: false,
        returnTypes: [],
        resultEncoding: 'legacy',
      },
    ];
    expect(() => bindConsumerCallsites(
      0,
      mixed,
      [{ functionName: 'push' }, { functionName: 'push' }],
      { requireUniqueAttribution: true },
    )).toThrow(/publish sourceCallsiteId \(name-first attribution disabled\)/);
  });

  it('sourceCallsiteId binds the exact published callsite (no first-match)', () => {
    const bound = bindConsumerCallsites(
      0,
      dualSameName,
      [
        { functionName: 'push', sourceCallsiteId: 2 },
        { functionName: 'push', sourceCallsiteId: 1 },
      ],
      { requireUniqueAttribution: true },
    );
    expect(bound[0]?.callsiteId).toBe(2);
    expect(bound[1]?.callsiteId).toBe(1);
  });

  it('legacy path still first-matches when unique attribution is not required', () => {
    // Two reached rows against one once-callsite + one loop callsite → not positional; first-match applies.
    const mixed: ExternalCallAbi[] = [
      {
        callsiteId: 1,
        interfaceName: 'I',
        functionName: 'push',
        occurrence: 'once',
        hasReturnValues: false,
        returnTypes: [],
        resultEncoding: 'legacy',
      },
      {
        callsiteId: 2,
        interfaceName: 'I',
        functionName: 'push',
        occurrence: 'loop',
        maximumOccurrences: 8,
        hasReturnValues: false,
        returnTypes: [],
        resultEncoding: 'legacy',
      },
    ];
    const bound = bindConsumerCallsites(
      0,
      mixed,
      ['push', 'push'],
    );
    // Same-schema candidates → legacy first-match collapses onto callsite 1.
    expect(bound[0]?.callsiteId).toBe(1);
    expect(bound[1]?.callsiteId).toBe(1);
  });
});

describe('PredOut preflight claims PredOut claims threaded into default preflight', () => {
  it('preflightMessageBusTransaction forwards predOutClaimsByParticipant to layout assert', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../src/message-bus/preflight.ts'), 'utf8');
    expect(src).toContain('predOutClaimsByParticipant: options?.predOutClaimsByParticipant');
    expect(src).toMatch(
      /assertAssemblyLayoutWitnessesMatchResolve\(\s*builder,\s*assembly,\s*\{[\s\S]*?predOutClaimsByParticipant/,
    );
  });

  it('compose assemble publishes PredOut claims into preflight options', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const bus = join(here, '../../src/message-bus');
    const src = [
      readFileSync(join(bus, 'compose.ts'), 'utf8'),
      readFileSync(join(bus, 'compose-admit.ts'), 'utf8'),
      readFileSync(join(bus, 'compose-assemble.ts'), 'utf8'),
    ].join('\n');
    expect(src).toContain('assembledPredOutClaimsByParticipant');
    expect(src).toMatch(
      /predOutClaimsByParticipant:\s*(?:ctx\.)?assembledPredOutClaimsByParticipant/,
    );
    expect(src).toMatch(/PredOut preflight claims:.*PredOut/);
  });
});
