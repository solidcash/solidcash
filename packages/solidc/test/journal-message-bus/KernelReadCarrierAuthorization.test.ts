import {
  ArrayType, IntType, KERNEL_JOURNAL_DISPOSITION_COMMITMENT_TAG_HEX, type SortedUpsertLoopAbi,
} from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  FunctionDefinitionNode, IntLiteralNode, MappingAccessNode, MappingAssignNode, ParameterNode, SourceFileNode,
  WhileNode,
} from '../../src/ast/AST.js';
import { cloneNode } from '../../src/ast/clone.js';
import { compileString, parseCode } from '../../src/compiler.js';
import {
  authorizeKernelReadCarrier, deriveKernelJournalDispositionHandlerScope, discoverKernelReadCarrier,
  freezeKernelJournalDispositions, refreshKernelReadCarrierAuthorization, sameKernelJournalDispositions,
} from '../../src/semantic/KernelReadCarrierAuthorization.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  __artifactCache: false,
  __strictNoInternalRecovery: true,
} as const;

const carrierSource = (
  contract: string, source: string, firstDestination: string, secondDestination: string,
  handler: string, count: string, counter: string,
): string => `contract ${contract}() {
  mapping(int => int) ${source};
  mapping(int => int) ${firstDestination};
  mapping(int => int) ${secondDestination};
  function ${handler}(int ${count}) public {
    for (int ${counter} = 0; ${counter} < ${count}; ${counter} = ${counter} + 1) {
      this.${firstDestination}[${counter}] = this.${source}[${counter}];
      this.${secondDestination}[${counter}] = this.${source}[${counter}];
    }
    require(true);
  }
}`;

const discover = (code: string): {
  ast: SourceFileNode;
  fn: FunctionDefinitionNode;
  plan: NonNullable<FunctionDefinitionNode['messageBusKernelReadCarrierDiscovery']>;
} => {
  const ast = parseCode(code) as SourceFileNode;
  const fn = ast.contract.functions.find((candidate) => candidate.isEntryPoint)!;
  const plan = discoverKernelReadCarrier(fn, ast.contract.collections)!;
  return { ast, fn, plan };
};

const bindCompletedCounter = (
  fn: FunctionDefinitionNode,
  accesses: readonly SortedUpsertLoopAbi[],
): void => {
  const read = accesses.find((access) => access.op === 'read')!;
  for (const name of [read.varyingArrayParam, read.oldValuesWitnessParam!]) {
    if (!fn.parameters.some((parameter) => parameter.name === name)) {
      fn.parameters.push(new ParameterNode(new ArrayType(new IntType(true, 256)), name));
    }
  }
  fn.messageBusKernelReadCarrierSyntheticParameterRoles = new Map([
    [read.varyingArrayParam, 'counter-permutation'],
    [read.oldValuesWitnessParam!, 'old-values-witness'],
  ]);
  const loopShape = JSON.parse(fn.messageBusKernelReadCarrierDiscovery!.loopShape) as unknown[];
  const bound = loopShape[3] as ['parameter', number];
  fn.runtimeCounterLoopCounters = new Map([[read.varyingArrayParam, {
    name: '<compiler-role>', initialValue: 0n, stepValue: 1n, boundParameterOrdinal: bound[1],
  }]]);
};

describe('kernel read-carrier two-pass authorization', () => {
  it('freezes a source-name-free discovery digest which survives pristine and route cloning', () => {
    const first = discover(carrierSource(
      'LedgerAlpha', 'originLedger', 'leftLedger', 'rightLedger', 'copyLedger', 'countLedger', 'indexLedger',
    ));
    const renamed = discover(carrierSource(
      'Registry', 'before', 'primary', 'secondary', 'apply', 'length', 'cursor',
    ));

    expect(first.plan).toEqual(renamed.plan);
    expect(first.plan.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(first.plan))
      .not.toMatch(/LedgerAlpha|originLedger|leftLedger|rightLedger|copyLedger|countLedger|indexLedger/);
    expect(Object.isFrozen(first.plan)).toBe(true);
    expect(Object.isFrozen(first.plan.destinationCollectionOrdinals)).toBe(true);
    expect(Object.isFrozen(first.plan.executionCoordinate)).toBe(true);
    expect(JSON.parse(first.plan.loopShape)).toEqual([
      'pre-test', '<', ['integer', '0'], ['parameter', 0], ['integer', '1'],
    ]);
    expect(JSON.parse(first.plan.keyShape)).toEqual([['counter']]);

    const pristine = cloneNode(first.fn) as FunctionDefinitionNode;
    const normal = cloneNode(pristine) as FunctionDefinitionNode;
    const speed = cloneNode(pristine) as FunctionDefinitionNode;
    const binder = cloneNode(normal) as FunctionDefinitionNode;
    for (const clone of [pristine, normal, speed, binder]) {
      // Frozen class instances are deliberately shared authority, rather than mutable plain-object copies.
      expect(clone.messageBusKernelReadCarrierDiscovery).toBe(first.plan);
      expect(clone.messageBusKernelReadCarrierDiscovery?.digest).toBe(first.plan.digest);
    }

    const rewritten = cloneNode(first.fn) as FunctionDefinitionNode;
    const loop = rewritten.body.statements[1] as WhileNode;
    const write = loop.block.statements[0] as MappingAssignNode;
    (write.expression as MappingAccessNode).keys = [new IntLiteralNode(7n)];
    expect(discoverKernelReadCarrier(rewritten, first.ast.contract.collections)).toBeUndefined();
    expect(rewritten.messageBusKernelReadCarrierDiscovery).toBeUndefined();
  });

  it('authorizes only the completed descriptor family which matches the source discovery', () => {
    const code = carrierSource('Ledger', 'source', 'left', 'right', 'copy', 'count', 'index');
    const { ast, fn, plan } = discover(code);
    const artifact = compileString(code, { ...KERNEL, suppressWarnings: true });
    const completed = artifact.abi.find((entry) => entry.name === 'copy')!;
    const accesses = completed.sortedUpsertLoopInfo ?? [];
    bindCompletedCounter(fn, accesses);
    const authorization = authorizeKernelReadCarrier(fn, completed, ast.contract.collections);

    expect(authorization).toMatchObject({
      version: 1,
      discoveryDigest: plan.digest,
      selectorHex: completed.selector,
      streamDescriptorDigests: accesses.map(() => expect.stringMatching(/^[0-9a-f]{64}$/)),
      completedDescriptorDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      digest: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(Object.isFrozen(authorization)).toBe(true);

    const replace = (index: number, replacement: Partial<SortedUpsertLoopAbi>): SortedUpsertLoopAbi[] =>
      accesses.map((access, current) => current === index ? { ...access, ...replacement } : access);
    const withAccesses = (replacement: readonly SortedUpsertLoopAbi[]): typeof completed => ({
      ...completed, sortedUpsertLoopInfo: replacement,
    });
    const readIndex = accesses.findIndex((access) => access.op === 'read');
    const setIndex = accesses.findIndex((access) => access.op === 'set');
    expect(authorizeKernelReadCarrier(fn, withAccesses(replace(readIndex, {
      oldValuesWitnessDomain: 'selected-source',
    })),
    ast.contract.collections)).toBeUndefined();
    expect(authorizeKernelReadCarrier(fn, withAccesses(replace(setIndex, { journalExecutionGroup: 999 })),
      ast.contract.collections)).toBeUndefined();
    expect(authorizeKernelReadCarrier(fn, withAccesses(accesses.slice(0, -1)),
      ast.contract.collections)).toBeUndefined();

    // Both sides can agree on the same corrupted key/condition recipe. Source discovery remains the authority,
    // so agreement between generated descriptors alone is insufficient.
    const shiftedKey = {
      kind: 'binary', operator: '+', left: { kind: 'source', source: { kind: 'loopIndex' } },
      right: { kind: 'literal', type: 'bigint', value: '1' },
    } as const;
    const matchingShift = accesses.map((access) => ({ ...access, varyingKeyExpressions: [shiftedKey] }));
    expect(authorizeKernelReadCarrier(fn, withAccesses(matchingShift), ast.contract.collections)).toBeUndefined();
    const matchingCondition = accesses.map((access) => ({
      ...access, condition: { kind: 'literal', type: 'bool', value: true } as const,
    }));
    expect(authorizeKernelReadCarrier(fn, withAccesses(matchingCondition),
      ast.contract.collections)).toBeUndefined();
    expect(authorizeKernelReadCarrier(fn, withAccesses(replace(readIndex, {
      settlementIdentity: { ...accesses[readIndex].settlementIdentity!, accessStreamIndex: 7 },
    })), ast.contract.collections)).toBeUndefined();
    expect(authorizeKernelReadCarrier(fn, withAccesses(replace(setIndex, {
      inputCountParam: '__internal__count',
    })),
    ast.contract.collections)).toBeUndefined();
    for (const hostile of [
      { constructedKeyReplay: true },
      { multiArmConstructedKeyReplay: true },
      { crossArrayKeyReplay: true },
      { nestedHelperReturnReplay: true },
      { sameIterationMutableSelectionReplay: true },
      { keyDecodeTupleIndex: 0 },
      { keyDecodeTupleTypes: ['int256'] },
      { valueTraceLocal: 'trace' },
      { valueTraceInitial: { kind: 'literal', type: 'bigint', value: '0' } },
      { valueTraceUpdates: [] },
      { valueTraceAfterUpdates: [] },
      { prefixCountCondition: { kind: 'literal', type: 'bool', value: true } },
      { iterationExactBound: true },
      { iterationStep: { kind: 'literal', type: 'bigint', value: '1' } },
    ] satisfies Array<Partial<SortedUpsertLoopAbi>>) {
      expect(authorizeKernelReadCarrier(fn, withAccesses(replace(setIndex, hostile)),
        ast.contract.collections)).toBeUndefined();
    }
    expect(authorizeKernelReadCarrier(fn, withAccesses(replace(readIndex, {
      collectionHash: '00'.repeat(20),
    })), ast.contract.collections)).toBeUndefined();
    expect(authorizeKernelReadCarrier(fn, withAccesses(replace(setIndex, {
      fixedKeyParams: ['forged'],
    })), ast.contract.collections)).toBeUndefined();
    expect(authorizeKernelReadCarrier(fn, { ...completed, selector: '00000000' },
      ast.contract.collections)).toBeUndefined();
    expect(authorizeKernelReadCarrier(fn, {
      ...completed,
      inputs: completed.inputs.map((input, index) => index === 0 ? { ...input, type: 'uint256' } : input),
    }, ast.contract.collections)).toBeUndefined();
    fn.messageBusKernelReadCarrierSyntheticParameterRoles!.set(
      accesses[readIndex].varyingArrayParam, 'old-values-witness',
    );
    expect(authorizeKernelReadCarrier(fn, completed, ast.contract.collections)).toBeUndefined();
    bindCompletedCounter(fn, accesses);
    fn.runtimeCounterLoopCounters!.get(accesses[readIndex].varyingArrayParam)!.boundParameterOrdinal = 7;
    expect(authorizeKernelReadCarrier(fn, completed, ast.contract.collections)).toBeUndefined();
    bindCompletedCounter(fn, accesses);
    expect(authorizeKernelReadCarrier(fn, {
      ...completed,
      entryAccesses: [{ collection: 'source', keyParams: [], operations: ['read'] }],
    }, ast.contract.collections)).toBeUndefined();
    const structuralLoopEntries = accesses.map((access) => ({
      collection: access.collection, keyParams: [], operations: ['write'], inLoop: true,
    })) as unknown as NonNullable<typeof completed.entryAccesses>;
    expect(authorizeKernelReadCarrier(fn, {
      ...completed, entryAccesses: structuralLoopEntries,
    }, ast.contract.collections)).toEqual(authorization);
    expect(authorizeKernelReadCarrier(fn, {
      ...completed, entryAccesses: [...structuralLoopEntries, structuralLoopEntries[0]],
    }, ast.contract.collections)).toBeUndefined();

    // A clone may mechanically carry a verdict from a prior completed pass. Refresh must discard it before
    // checking the descriptors produced by this pass, never treating the copied object as authority.
    fn.messageBusKernelReadCarrierDiscovery = plan;
    fn.messageBusKernelReadCarrierAuthorization = authorization;
    expect(refreshKernelReadCarrierAuthorization(fn,
      withAccesses(replace(setIndex, { journalExecutionGroup: 999 })),
      ast.contract.collections)).toBeUndefined();
    expect(fn.messageBusKernelReadCarrierAuthorization).toBeUndefined();
  }, 60_000);

  it('derives and publishes the same authenticated capability on normal and speed/binder compilation', () => {
    const code = carrierSource('Registry', 'before', 'primary', 'secondary', 'apply', 'length', 'cursor');
    const { ast, fn } = discover(code);
    const digests: string[] = [];
    for (const optimizeForCompilationSpeed of [false, true]) {
      const artifact = compileString(code, { ...KERNEL, optimizeForCompilationSpeed, suppressWarnings: true });
      const completed = artifact.abi.find((entry) => entry.name === 'apply')!;
      const accesses = completed.sortedUpsertLoopInfo ?? [];
      bindCompletedCounter(fn, accesses);
      digests.push(authorizeKernelReadCarrier(fn, completed, ast.contract.collections)!.digest);
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
        .toMatchObject({ eligible: true });
      expect(artifact.messageBus?.kernelEntryJournal?.capabilities).toContainEqual(expect.objectContaining({
        kind: 'internal-read-carrier', version: 1,
      }));
      expect(JSON.stringify(artifact)).not.toContain('messageBusKernelReadCarrier');
    }
    expect(new Set(digests).size).toBe(1);
  }, 120_000);

  it('does not allow a caller-seeded box to alter compiler-owned protocol publication', () => {
    const box = {
      publishKernelJournalDispositionProtocol: true,
      expectedKernelJournalDispositions: [{
        selectorHex: '00000000', completedDescriptorDigest: '11'.repeat(32), mode: 'carrier', streams: [{
          journalAccessStreamIndex: 0, descriptorDigest: '22'.repeat(32), disposition: 'carrier',
        }],
      }],
    };
    const source = carrierSource('Dormant', 'before', 'primary', 'secondary', 'apply', 'length', 'cursor');
    const baseline = compileString(source, { ...KERNEL, suppressWarnings: true });
    const artifact = compileString(
      source,
      { ...KERNEL, suppressWarnings: true, __kernelReadCarrierAuthorizationBox: box } as never,
    );
    // The compiler overwrites this diagnostic/release field with its own release state. It is not authority:
    // the caller has no one-shot binding token, and the independently compiled artifact remains byte-identical.
    expect(box.publishKernelJournalDispositionProtocol).toBe(true);
    expect(artifact.messageBus?.kernelEntryJournal).toEqual(baseline.messageBus?.kernelEntryJournal);
    expect(artifact.bytecode).toBe(baseline.bytecode);
    expect(artifact.bytecode).toContain(KERNEL_JOURNAL_DISPOSITION_COMMITMENT_TAG_HEX);
  }, 60_000);

  it('does not mint discovery authority for mixed key domains', () => {
    const shiftedAst = parseCode(`contract C() {
        mapping(int => int) a; mapping(int => int) b; mapping(int => int) c;
        function f(int n) public {
          for (int i = 0; i < n; i = i + 1) { this.b[i] = this.a[i]; this.c[i] = this.a[i + 1]; }
          require(true);
        }
      }`) as SourceFileNode;
    const shifted = discoverKernelReadCarrier(shiftedAst.contract.functions[0], shiftedAst.contract.collections);
    expect(shifted).toBeUndefined();

    const conditionalAst = parseCode(`contract C() {
      mapping(int => int) a; mapping(int => int) b;
      function f(int n, bool enabled) public {
        if (enabled) {
          for (int i = 0; i < n; i = i + 1) { this.b[i] = this.a[i]; }
        }
        require(true);
      }
    }`) as SourceFileNode;
    expect(discoverKernelReadCarrier(
      conditionalAst.contract.functions[0], conditionalAst.contract.collections,
    )).toBeUndefined();
  });

  it('binds the exact bound parameter without rejecting unrelated public arguments', () => {
    const code = `contract C() {
      mapping(int => int) a; mapping(int => int) b;
      function f(bool unused, int n) public {
        for (int i = 0; i < n; i = i + 1) { this.b[i] = this.a[i]; }
        require(unused || !unused);
      }
    }`;
    const { ast, fn, plan } = discover(code);
    expect(JSON.parse(plan.loopShape)[3]).toEqual(['parameter', 1]);
    const completed = compileString(code, { ...KERNEL, suppressWarnings: true })
      .abi.find((entry) => entry.name === 'f')!;
    bindCompletedCounter(fn, completed.sortedUpsertLoopInfo ?? []);
    expect(authorizeKernelReadCarrier(fn, completed, ast.contract.collections)).toBeDefined();
  }, 60_000);

  it('authorizes alpha-renamed declarations from selector and explicit operand roles', () => {
    const cases = [
      carrierSource('Alpha', 'source', 'left', 'right', 'copy', 'length', 'cursor'),
      carrierSource('Beta', 'origin', 'primary', 'secondary', 'apply', 'count', 'index'),
    ];
    const selectors: string[] = [];
    for (const code of cases) {
      const { ast, fn } = discover(code);
      const completed = compileString(code, { ...KERNEL, suppressWarnings: true })
        .abi.find((entry) => entry.name === fn.name)!;
      bindCompletedCounter(fn, completed.sortedUpsertLoopInfo ?? []);
      expect(authorizeKernelReadCarrier(fn, completed, ast.contract.collections)).toBeDefined();
      selectors.push(completed.selector!);
    }
    // Function spelling changes selector identity, while local/parameter/collection spellings remain dataflow
    // inputs rather than authorization conventions.
    expect(new Set(selectors).size).toBe(2);
  }, 120_000);

  it('does not infer compiler-owned carrier operands from their spelling', () => {
    const code = carrierSource('Store', 'origin', 'first', 'second', 'move', 'length', 'cursor');
    const { ast, fn } = discover(code);
    const completed = compileString(code, { ...KERNEL, suppressWarnings: true })
      .abi.find((entry) => entry.name === 'move')!;
    const accesses = completed.sortedUpsertLoopInfo ?? [];
    bindCompletedCounter(fn, accesses);
    const read = accesses.find((access) => access.op === 'read')!;
    const permutation = 'scheduleOperand';
    const witness = 'carrierOperand';
    for (const parameter of fn.parameters) {
      if (parameter.name === read.varyingArrayParam) parameter.name = permutation;
      if (parameter.name === read.oldValuesWitnessParam) parameter.name = witness;
    }
    const counter = fn.runtimeCounterLoopCounters!.get(read.varyingArrayParam)!;
    fn.runtimeCounterLoopCounters = new Map([[permutation, counter]]);
    fn.messageBusKernelReadCarrierSyntheticParameterRoles = new Map([
      [permutation, 'counter-permutation'], [witness, 'old-values-witness'],
    ]);
    const renamed = accesses.map((access): SortedUpsertLoopAbi => ({
      ...access,
      varyingArrayParam: permutation,
      ...(access.valueArrayParam === read.oldValuesWitnessParam && { valueArrayParam: witness }),
      ...(access.oldValuesWitnessParam === read.oldValuesWitnessParam && { oldValuesWitnessParam: witness }),
      ...(access.valueArrayIndexParam === read.varyingArrayParam && { valueArrayIndexParam: permutation }),
    }));
    const renamedCompleted = {
      ...completed,
      inputs: completed.inputs.map((input) => ({
        ...input,
        name: input.name === read.varyingArrayParam ? permutation
          : input.name === read.oldValuesWitnessParam ? witness : input.name,
      })),
      sortedUpsertLoopInfo: renamed,
    };
    expect(authorizeKernelReadCarrier(fn, renamedCompleted,
      ast.contract.collections)).toBeDefined();
    fn.messageBusKernelReadCarrierSyntheticParameterRoles = undefined;
    expect(authorizeKernelReadCarrier(fn, renamedCompleted,
      ast.contract.collections)).toBeUndefined();
  }, 60_000);

  it('binds an ordered, alpha-renamed disposition manifest and rejects stream-set drift', () => {
    const manifests = [
      carrierSource('Alpha', 'origin', 'left', 'right', 'apply', 'length', 'cursor'),
      carrierSource('Beta', 'origin', 'left', 'right', 'apply', 'count', 'index'),
    ].map((code) => {
      const { ast, fn } = discover(code);
      const completed = compileString(code, { ...KERNEL, suppressWarnings: true })
        .abi.find((entry) => entry.name === 'apply')!;
      bindCompletedCounter(fn, completed.sortedUpsertLoopInfo ?? []);
      const authorization = authorizeKernelReadCarrier(fn, completed, ast.contract.collections)!;
      const carrierScope = {
        selectorHex: authorization.selectorHex,
        completedDescriptorDigest: authorization.completedDescriptorDigest,
        streamDescriptorDigests: authorization.streamDescriptorDigests,
      } as const;
      const scope = deriveKernelJournalDispositionHandlerScope(completed, carrierScope)!;
      expect(scope.mode).toBe('carrier');
      expect(scope.streams.map((stream) => stream.journalAccessStreamIndex)).toEqual([0, 1, 2]);
      expect(scope.streams.every((stream) => stream.disposition === 'carrier')).toBe(true);
      expect(JSON.stringify(scope)).not.toMatch(/origin|left|right|length|count|cursor|index/);
      // An AST-backed descriptor can retain own undefined properties which artifact JSON omits. That
      // representation change is not flow drift and must yield the same eager descriptor identity.
      const eager = deriveKernelJournalDispositionHandlerScope(completed)!;
      const serialized = JSON.parse(JSON.stringify(completed)) as typeof completed;
      expect(deriveKernelJournalDispositionHandlerScope(serialized)).toEqual(eager);

      const accesses = completed.sortedUpsertLoopInfo!;
      const withAccesses = (sortedUpsertLoopInfo: readonly SortedUpsertLoopAbi[]): typeof completed => ({
        ...completed, sortedUpsertLoopInfo,
      });
      expect(deriveKernelJournalDispositionHandlerScope(withAccesses(accesses.slice(0, -1)), carrierScope))
        .toBeUndefined();
      expect(deriveKernelJournalDispositionHandlerScope(withAccesses([...accesses].reverse()), carrierScope))
        .toBeUndefined();
      expect(deriveKernelJournalDispositionHandlerScope(withAccesses([
        accesses[0], { ...accesses[1], journalAccessStreamIndex: 0 }, accesses[2],
      ]), carrierScope)).toBeUndefined();
      expect(deriveKernelJournalDispositionHandlerScope(withAccesses([...accesses, {
        ...accesses[2], journalAccessStreamIndex: 3,
      }]), carrierScope)).toBeUndefined();
      return freezeKernelJournalDispositions([scope]);
    });
    expect(sameKernelJournalDispositions(manifests[0], manifests[1])).toBe(true);
    expect(Object.isFrozen(manifests[0])).toBe(true);
    expect(Object.isFrozen(manifests[0][0].streams)).toBe(true);
  }, 120_000);
});
