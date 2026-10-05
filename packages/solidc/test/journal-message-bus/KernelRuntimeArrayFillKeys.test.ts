import { compileString, parseCode } from '../../src/compiler.js';
import { FunctionDefinitionNode, SourceFileNode } from '../../src/ast/AST.js';
import { cloneNode } from '../../src/ast/clone.js';
import { captureConstructedKeyVectorProvenance } from '../../src/semantic/CaptureConstructedKeyVectorProvenance.js';
import { describe, expect, it } from 'vitest';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('kernel runtime-sized constructed-key initialization', () => {
  it('captures a complete typed producer/consumer proof by stable function identity before lowering', () => {
    const ast = parseCode(`contract Registry() {
      mapping(int => int) records;
      function apply(int count, int base) public {
        int[] memory first = new int[](count);
        for (int producer = 0; producer < count; producer = producer + 1) {
          first[producer] = base + producer;
        }
        for (int consumer = 0; consumer < count; consumer = consumer + 1) {
          this.records[first[consumer]] = consumer;
        }
        require(true);
      }
    }`) as SourceFileNode;
    const source = ast.contract.functions.find((fn) => fn.name === 'apply')!;
    captureConstructedKeyVectorProvenance([source]);

    const identity = source.messageBusSourceFunctionIdentity!;
    const proof = source.messageBusConstructedKeyVectorProofPrograms?.get(identity);
    expect(identity).toContain('apply(int256,int256)');
    expect(proof).toMatchObject({
      version: 1,
      sourceFunctionIdentity: identity,
      sourceFunctionSignature: 'apply(int256,int256)',
      sourceParameterTypes: ['int256', 'int256'],
      candidateVectorOrdinals: [0],
    });
    expect(proof?.sourceProgram).not.toBe(source.body);

    // Physical route synthesis clones the function repeatedly. The proof must follow those clones by the
    // source-function key, without relying on the local vector spelling (`first`).
    const clone = cloneNode(source) as FunctionDefinitionNode;
    expect(clone.messageBusConstructedKeyVectorProofPrograms?.get(identity)).toBe(proof);
    expect(clone.messageBusConstructedKeyVectorProofPrograms?.has('first')).toBe(false);
  });

  it('records a names-free pre-admission allocation-write-consumer execution edge without publishing it', () => {
    const sourceFor = (vectorName: string): ReturnType<typeof parseCode> => parseCode(`contract Registry() {
      mapping(int => int) records;
      function apply(int count, int base) public {
        int[] memory ${vectorName} = new int[](count);
        for (int producer = 0; producer < count; producer = producer + 1) {
          ${vectorName}[producer] = base + producer;
        }
        for (int consumer = 0; consumer < count; consumer = consumer + 1) {
          this.records[${vectorName}[consumer]] = consumer;
        }
        require(true);
      }
    }`) as SourceFileNode;
    const first = sourceFor('first').contract.functions.find((fn) => fn.name === 'apply')!;
    const deliberatelyNonSemanticName = sourceFor('deliberatelyNonSemanticName')
      .contract.functions.find((fn) => fn.name === 'apply')!;
    captureConstructedKeyVectorProvenance([first, deliberatelyNonSemanticName]);

    const plan = first.messageBusKernelJournalStreamPlan;
    expect(plan).toMatchObject({
      version: 1,
      edges: [{
        allocationOrdinal: 0,
        allocation: { statementPath: [0] },
        // The parser lowers each source `for` initializer to its own executable statement, so these are the
        // post-parse execution coordinates rather than source-text line numbers.
        producerLoop: { statementPath: [2] },
        producerWrite: { statementPath: [2, 0] },
        consumerLoop: { statementPath: [4] },
        consumerWrite: { statementPath: [4, 0] },
        consumerKeyComponent: 0,
      }],
    });
    expect(plan).toEqual(deliberatelyNonSemanticName.messageBusKernelJournalStreamPlan);
    expect(JSON.stringify(plan)).not.toContain('first');
    expect(JSON.stringify(plan)).not.toContain('deliberatelyNonSemanticName');

    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function apply(int count, int base) public {
        int[] memory keys = new int[](count);
        for (int producer = 0; producer < count; producer = producer + 1) { keys[producer] = base + producer; }
        for (int consumer = 0; consumer < count; consumer = consumer + 1) { this.records[keys[consumer]] = consumer; }
        require(true);
      }
    }`, KERNEL);
    expect(JSON.stringify(artifact)).not.toContain('messageBusKernelJournalStreamPlan');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps a separately produced local key vector deterministically frozen pending route replay binding', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function apply(int count, int base) public {
        int[] memory keys = new int[](count);
        for (int producer = 0; producer < count; producer = producer + 1) {
          keys[producer] = base + producer;
        }
        for (int consumer = 0; consumer < count; consumer = consumer + 1) {
          this.records[keys[consumer]] = consumer;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('publishes a source-name-free replay descriptor for one fully serializable constructed key vector', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function apply(int count, int base) public {
        int[] memory deliberatelyNonSemanticName = new int[](count);
        for (int producer = 0; producer < count; producer = producer + 1) {
          deliberatelyNonSemanticName[producer] = base + producer;
        }
        for (int consumer = 0; consumer < count; consumer = consumer + 1) {
          this.records[deliberatelyNonSemanticName[consumer]] = consumer;
        }
        require(true);
      }
    }`, KERNEL);
    const entry = artifact.abi.find((candidate) => candidate.name === 'apply');
    expect(entry?.constructedKeyVectors).toEqual([{
      version: 1,
      vectorOrdinal: 0,
      elementType: 'int256',
      allocationLength: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      producer: {
        domain: {
          kind: 'pre-test',
          start: { kind: 'literal', type: 'bigint', value: '0' },
          bound: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
          step: { kind: 'literal', type: 'bigint', value: '1' },
          comparison: '<',
        },
        writes: [{
          index: { kind: 'source', source: { kind: 'loopIndex' } },
          value: {
            kind: 'binary', operator: '+',
            left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
            right: { kind: 'source', source: { kind: 'loopIndex' } },
          },
        }],
      },
      consumer: {
        index: { kind: 'source', source: { kind: 'loopIndex' } },
        vectorElementComponent: 0,
        keyComponentCount: 1,
        fixedComponents: [],
      },
    }]);
    expect(JSON.stringify(entry?.constructedKeyVectors)).not.toContain('deliberatelyNonSemanticName');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('omits a descriptor rather than serializing a local alias as source provenance', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function apply(int count, int base) public {
        int limit = count;
        int[] memory keys = new int[](limit);
        for (int producer = 0; producer < limit; producer = producer + 1) {
          keys[producer] = base + producer;
        }
        for (int consumer = 0; consumer < limit; consumer = consumer + 1) {
          this.records[keys[consumer]] = consumer;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.abi.find((candidate) => candidate.name === 'apply')?.constructedKeyVectors).toBeUndefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('derives the exact key recipe for a canonical full-array helper fill', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int base) internal pure {
        for (int cursor = 0; cursor < keys.length; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base) public {
        int[] memory keys = new int[](count);
        fill(keys, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor + 10;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const loop = artifact.abi.find((entry) => entry.name === 'apply')?.sortedUpsertLoopInfo?.[0];
    expect(loop).toMatchObject({
      collection: 'records',
      varyingArrayParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
      varyingKeyExpressions: [expect.objectContaining({ kind: 'ternary' })],
    });
  });

  it.each([
    ['an exact one-trailing-hole domain', 'cursor < keys.length - 1'],
  ])('derives the exact key recipe for %s', (_label, loopHeader) => {
    const header = loopHeader.includes(';')
      ? `for (int cursor = 0; ${loopHeader})`
      : `for (int cursor = 0; ${loopHeader}; cursor = cursor + 1)`;
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int limit) internal pure {
        ${header} { keys[cursor] = cursor + 20; }
      }
      function apply(int count, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'apply')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    expect(expression).toMatchObject({
      kind: 'ternary',
      ifFalse: { kind: 'literal', value: '0' },
    });
    const operators: string[] = [];
    const collectOperators = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (typeof record.operator === 'string') operators.push(record.operator);
      for (const value of Object.values(record)) collectOperators(value);
    };
    collectOperators(expression);
    expect(operators).toContain('<');
    expect(operators).not.toContain('%');
  });

  it('derives a conditional key recipe for a canonical public partial bound', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'apply')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    expect(expression).toMatchObject({
      kind: 'ternary',
      ifFalse: { kind: 'literal', value: '0' },
    });
    const operators: string[] = [];
    const collectOperators = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (typeof record.operator === 'string') operators.push(record.operator);
      for (const value of Object.values(record)) collectOperators(value);
    };
    collectOperators(expression);
    expect(operators).toContain('<');
  });

  it('preserves source-order last-write semantics in a partial fill', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
          keys[cursor] = base + cursor + 100;
        }
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'apply')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    expect(expression).toMatchObject({
      kind: 'ternary',
      ifTrue: {
        kind: 'binary', operator: '+', right: { kind: 'literal', value: '100' },
      },
    });
    const literalValues: string[] = [];
    const collectLiterals = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (record.kind === 'literal' && typeof record.value === 'string') literalValues.push(record.value);
      for (const value of Object.values(record)) collectLiterals(value);
    };
    collectLiterals(expression);
    expect(literalValues).toContain('100');
  });

  it('folds an exact pure single-return helper into a replayable public bound', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function identity(int value) internal pure returns (int) { return value; }
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < identity(limit); cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'apply')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    const operators: string[] = [];
    const collectOperators = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (record.kind === 'binary' && typeof record.operator === 'string') operators.push(record.operator);
      for (const value of Object.values(record)) collectOperators(value);
    };
    collectOperators(expression);
    expect(operators).toContain('<');
  });

  it('folds the exactly typed overload and retains checked bound arithmetic', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function boundary(bytes value) internal pure returns (int) { return int(value); }
      function boundary(int value) internal pure returns (int) { return value + 1; }
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < boundary(limit); cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'apply')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    const operators: string[] = [];
    let retainedCheckedIncrement = false;
    const collectOperators = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (record.kind === 'binary' && typeof record.operator === 'string') operators.push(record.operator);
      if (record.kind === 'binary' && record.operator === '+') {
        const right = record.right as Record<string, unknown> | undefined;
        if (right?.kind === 'literal' && right.value === '1') retainedCheckedIncrement = true;
      }
      for (const value of Object.values(record)) collectOperators(value);
    };
    collectOperators(expression);
    expect(operators).toContain('+');
    expect(retainedCheckedIncrement).toBe(true);
  });

  it.each([
    ['a state-dependent helper',
      'int cap; function boundary(int value) internal view returns (int) { return this.cap; }'],
    ['a transaction-dependent helper',
      'function boundary(int value) internal view returns (int) { return tx.inputs.length; }'],
    ['a recursive helper',
      'function boundary(int value) internal pure returns (int) { return boundary(value); }'],
    ['a mutating helper',
      'int cap; function boundary(int value) internal returns (int) { this.cap = value; return value; }'],
  ])('keeps %s out of a constructed-array bound recipe', (_label, helper) => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      ${helper}
      function fill(int[] memory keys, int base, int limit) internal {
        for (int cursor = 0; cursor < boundary(limit); cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('does not guess between ambiguous bound-helper overloads', () => {
    expect(() => compileString(`contract Registry() {
      mapping(int => int) records;
      function boundary(int value) internal pure returns (int) { return value; }
      function boundary(uint value) internal pure returns (int) { return int(value); }
      function fill(int[] memory keys, int base) internal pure {
        for (int cursor = 0; cursor < boundary(1); cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base) public {
        int[] memory keys = new int[](count);
        fill(keys, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL)).toThrow(/No unique declaration|ambiguous.*overload/i);
  });

  it('keeps a multi-return helper out of a constructed-array bound recipe', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function boundary(int value) internal pure returns (int, int) { return (value, value); }
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < boundary(limit)[0]; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('does not approximate the final counter after a possibly empty partial fill', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int base, int limit) internal pure {
        int cursor = 0;
        while (cursor < limit) {
          keys[cursor] = base + cursor;
          cursor = cursor + 1;
        }
        keys[0] = cursor;
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it.each([
    ['an offset write index', 'int step', 'cursor < keys.length', 'cursor = cursor + 1',
      'keys[cursor + 1] = cursor + 20;'],
    ['a runtime stride', 'int step', 'cursor < keys.length', 'cursor = cursor + step',
      'keys[cursor] = cursor + 20;'],
    ['a mutated runtime bound', 'int limit', 'cursor < limit', 'cursor = cursor + 1',
      'keys[cursor] = cursor + 20; limit = limit - 1;'],
  ])('keeps %s fenced when the exact written index set is unavailable', (
    _label, helperParameter, condition, update, body,
  ) => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, ${helperParameter}) internal pure {
        for (int cursor = 0; ${condition}; ${update}) { ${body} }
      }
      function apply(int count, int boundary) public {
        int[] memory keys = new int[](count);
        fill(keys, boundary);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('derives the exact sparse domain and default value for a literal-stride fill', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int unused) internal pure {
        for (int cursor = 0; cursor < keys.length; cursor = cursor + 2) {
          keys[cursor] = cursor + 20;
        }
      }
      function apply(int count, int boundary) public {
        int[] memory keys = new int[](count);
        fill(keys, boundary);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'apply')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    expect(expression).toMatchObject({
      kind: 'ternary',
      ifFalse: { kind: 'literal', value: '0' },
    });
    const operators: string[] = [];
    const collectOperators = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (typeof record.operator === 'string') operators.push(record.operator);
      for (const value of Object.values(record)) collectOperators(value);
    };
    collectOperators(expression);
    expect(operators).toEqual(expect.arrayContaining(['>=', '<', '%', '==', '&&', '-']));
  });
});
