import { describe, expect, it } from 'vitest';
import type { ExternalCallAbi } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract Analysis() {
  int x;
  mapping(int => int) balances;
  function leaf(int k) internal { this.x = this.x + k; }
  // Keep the mutual cycle non-tail-recursive so the tail-recursion lowering pass does not intentionally replace
  // it with a program-counter loop before invocation analysis records the remaining call graph.
  function left(int k) internal { right(k); leaf(k); }
  function right(int k) internal { if (k > 0) left(k - 1); }
  function run(int k) { left(k); require(k >= 0); }
  function readBalance(int k) view { require(balances[k] >= 0); }
  function flat() { this.x = 1; require(this.x == 1); }
}`;

describe('Release 0 shared invocation analysis', () => {
  it('emits deterministic closures, SCCs, and state footprints without changing bytecode', () => {
    const first = compileString(SOURCE, { forceStateful: true });
    const second = compileString(SOURCE, { forceStateful: true });
    expect(first.bytecode).toBe(second.bytecode);
    expect(first.invocationAnalysis).toEqual(second.invocationAnalysis);

    const analysis = first.invocationAnalysis!;
    expect(analysis.version).toBe(1);
    expect(analysis.protocolVersions).toEqual([1]);
    const run = analysis.functions.find((fn) => fn.name === 'run')!;
    const flat = analysis.functions.find((fn) => fn.name === 'flat')!;
    expect(run.recursive).toBe(true);
    expect(run.closure.length).toBeGreaterThan(2);
    expect(run.reads).toContain('state:x');
    expect(run.writes).toContain('state:x');
    expect(analysis.functions.find((fn) => fn.name === 'readBalance')?.reads)
      .toContain('collection:balances:*');
    expect(flat.recursive).toBe(false);
    expect(analysis.components.some((component) => component.recursive
      && component.functions.length === 2)).toBe(true);
  });

  it('emits the complete compiler-resolved graph footprint per callsite', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ITarget {
        public bigint counter;
        function step(bigint n) returns (bigint, bool);
      }
      contract GraphSummary(address target) {
        string note;
        event Seen(bigint value);
        function run(bigint n, bytes recipient) public returns (bigint, bool) {
          bigint value, bool ok = ITarget(target).step(n);
          bigint settled = ITarget(target).outState.counter;
          this.note = "done";
          this.transfer(recipient, n);
          emit Seen(settled);
          require(ok);
          return (value, ok);
        }
      }`, { forceStateful: true });
    const abi = artifact.abi.find((fn) => fn.name === 'run')!;
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'run')!;
    expect(summary.externalCalls).toEqual(abi.externalCalls);
    expect(summary.outputs).toEqual([{ type: 'bigint' }, { type: 'bool' }]);
    expect(summary.resultDependencies).toEqual([{
      callsiteId: 0,
      returnTypes: ['bigint', 'bool'],
      opaque: false,
    }]);
    expect(summary.bounded).toBe(true);
    expect(summary.maximumDirectInvocations).toBe(1);
    expect(summary.externalOutStateReads).toEqual(abi.externalOutStateReads);
    expect(summary.emits).toEqual(abi.emits);
    expect(summary.transferCount).toBe(abi.transferCount);
    expect(summary.transfers).toEqual([{
      transferIndex: 0,
      recipient: { kind: 'forward', paramIndex: 1 },
      amount: { kind: 'forward', paramIndex: 0 },
      recipientRecipe: { kind: 'handlerInput', inputIndex: 1 },
      amountRecipe: { kind: 'handlerInput', inputIndex: 0 },
    }]);
    expect(summary.transfers).toEqual(abi.transfers);
    expect(summary.dynamicWrites).toEqual(abi.dynamicWrites);
    expect(summary.blockLayout).toEqual(abi.blockLayout);
    expect(summary.externalCalls?.[0]).toMatchObject({
      callsiteId: 0,
      occurrence: 'once',
      interfaceName: 'ITarget',
      functionName: 'step',
      hasReturnValues: true,
      returnTypes: ['bigint', 'bool'],
      argSources: [{ kind: 'forward', paramIndex: 0 }],
    });
  });

  it('classifies callsite occurrence without treating control-dependent rows as unconditional', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ITarget { function step(bigint n); }
      contract Occurrences() {
        function once(address target, bigint n) public {
          ITarget(target).step(n);
          require(true);
        }
        function maybe(address target, bigint n, bool take) public {
          if (take) { ITarget(target).step(n); }
          require(true);
        }
        function repeated(address target, bigint n, bigint count) public {
          for (bigint i = 0; i < count; i = i + 1) { ITarget(target).step(n); }
          require(count >= 0);
        }
      }`, { forceStateful: true });
    const occurrence = (name: string): string => artifact.invocationAnalysis!.functions
      .find((fn) => fn.name === name)!.externalCalls![0].occurrence;
    expect(occurrence('once')).toBe('once');
    expect(occurrence('maybe')).toBe('conditional');
    expect(occurrence('repeated')).toBe('loop');
    expect(artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'once'))
      .toMatchObject({ bounded: true, maximumDirectInvocations: 1 });
    // A conditional callsite is reached at most once by construction: the classifier only assigns
    // `conditional` on a branch that no loop encloses. That ceiling is now published per callsite rather than
    // left implicit, so a branch-only function is bounded. The reached count is still 0 or 1, and the ceiling
    // is what the summary aggregates - `bounded: false` here was conservative, not a different measurement.
    expect(artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'maybe'))
      .toMatchObject({ bounded: true, maximumDirectInvocations: 1 });
    expect(artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'maybe')!
      .externalCalls![0]).toMatchObject({ occurrence: 'conditional', maximumOccurrences: 1 });
    expect(artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'maybe')!
      .externalCalls![0].minimumOccurrences).toBeUndefined();
    // A runtime trip count with no dominating literal ceiling still proves nothing, in either direction.
    expect(artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'repeated'))
      .toMatchObject({ bounded: false });
  });

  it('does not classify a low-level producer in a branch predicate as an optional arm', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract PredicateCalls() {
        function probe(address target, bytes payload) private returns (bool) {
          (bool ok, bytes memory result) = target.call(payload);
          return ok && result.length >= 0;
        }
        function run(address target, bytes payload) public {
          if (!probe(target, payload)) { require(false); }
          require(true);
        }
      }`, { solidityImportCompat: true, messageBus: true, messageBusKernel: true });
    const call = artifact.invocationAnalysis!.functions
      .find((fn) => fn.name === 'run')!.externalCalls![0];
    expect(call).toMatchObject({ callsiteId: 0, occurrence: 'once', maximumOccurrences: 1 });
  });

  it('publishes an exact floor only where the reached count cannot vary', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ITarget { function step(bigint n); }
      contract ExactFloors() {
        function exact(address target, bigint n) public {
          for (bigint i = 0; i < 3; i = i + 1) { ITarget(target).step(n); }
          require(n >= 0);
        }
        function nested(address target, bigint n) public {
          for (bigint i = 0; i < 3; i = i + 1) {
            for (bigint j = 0; j < 2; j = j + 1) { ITarget(target).step(n); }
          }
          require(n >= 0);
        }
        function guardedBody(address target, bigint n, bool take) public {
          for (bigint i = 0; i < 3; i = i + 1) { if (take) { ITarget(target).step(n); } }
          require(n >= 0);
        }
        function underBranch(address target, bigint n, bool take) public {
          if (take) { for (bigint i = 0; i < 3; i = i + 1) { ITarget(target).step(n); } }
          require(n >= 0);
        }
        function earlyReturn(address target, bigint n, bool take) public {
          for (bigint i = 0; i < 3; i = i + 1) { if (take) { return; } ITarget(target).step(n); }
          require(n >= 0);
        }
      }`, { forceStateful: true });
    const row = (name: string): ExternalCallAbi => artifact.invocationAnalysis!.functions
      .find((fn) => fn.name === name)!.externalCalls![0];
    // A canonical literal trip count with nothing conditional on the path reaches exactly three rows.
    expect(row('exact')).toMatchObject({
      occurrence: 'loop', minimumOccurrences: 3, maximumOccurrences: 3, occurrenceBoundSource: 'literal',
    });
    // Nesting MULTIPLIES: an inner literal loop under an outer one reaches outer*inner rows. Publishing the
    // inner count alone understated the ceiling by a factor of the outer trip count.
    expect(row('nested')).toMatchObject({
      occurrence: 'loop', minimumOccurrences: 6, maximumOccurrences: 6,
    });
    // Each of these keeps the ceiling and loses the floor, because each can reach the callsite zero times.
    for (const name of ['guardedBody', 'underBranch', 'earlyReturn']) {
      expect(row(name)).toMatchObject({ occurrence: 'loop', maximumOccurrences: 3 });
      expect(row(name).minimumOccurrences).toBeUndefined();
    }
  });

  it('emits a conservative direct-call ceiling for a canonical literal loop', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ITarget { function step(bigint n); }
      contract LiteralLoop() {
        function repeated(address target, bigint n) public {
          for (bigint i = 0; i < 3; i = i + 1) {
            ITarget(target).step(n);
          }
          require(n >= 0);
        }
      }`, { forceStateful: true });
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'repeated')!;
    expect(summary.externalCalls?.[0]).toMatchObject({
      occurrence: 'loop',
      maximumOccurrences: 3,
    });
    expect(summary).toMatchObject({ bounded: true, maximumDirectInvocations: 3 });
  });

  it('links a produced call result to a later external-call argument consumer', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProducer { function quote(bigint n) returns (bigint); }
      interface IConsumer { function settle(bigint quoted); }
      contract ResultFlow() {
        function run(address producer, address consumer, bigint n) public {
          bigint quoted = IProducer(producer).quote(n);
          IConsumer(consumer).settle(quoted);
          require(quoted >= 0);
        }
      }`, { forceStateful: true });
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'run')!;
    expect(summary.resultConsumers).toEqual([{
      consumerCallsiteId: 1,
      argument: 0,
      producerCallsiteId: 0,
      resultIndex: 0,
    }]);
    expect(artifact.abi.find((fn) => fn.name === 'run')!.resultConsumers)
      .toEqual(summary.resultConsumers);
  });

  it('publishes the producer callsite for a directly nested external-call argument', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProducer { function quote(bigint n) returns (bigint); }
      interface IConsumer { function settle(bigint quoted); }
      contract NestedResultFlow() {
        function run(address producer, address consumer, bigint n) public {
          IConsumer(consumer).settle(IProducer(producer).quote(n));
          require(n >= 0);
        }
      }`, { forceStateful: true, messageBus: true, suppressWarnings: true });
    const calls = artifact.invocationAnalysis!.functions
      .find((fn) => fn.name === 'run')!.externalCalls!;
    expect(calls.map((call) => [call.callsiteId, call.functionName])).toEqual([
      [0, 'quote'], [1, 'settle'],
    ]);
    expect(calls[1].argSources?.[0]).toMatchObject({
      kind: 'expression',
      expression: {
        kind: 'producerResult',
        callsiteId: 0,
        resultIndex: 0,
        type: 'bigint',
      },
    });
    expect(artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'run')!.resultConsumers)
      .toEqual([{ consumerCallsiteId: 1, argument: 0, producerCallsiteId: 0, resultIndex: 0 }]);
  });

  it('links each used tuple result through its synthetic local definition', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProducer { function quote(bigint n) returns (bigint, bool); }
      interface IConsumer { function settle(bigint quoted, bool accepted); }
      contract TupleResultFlow() {
        function run(address producer, address consumer, bigint n) public {
          bigint quoted, bool accepted = IProducer(producer).quote(n);
          IConsumer(consumer).settle(quoted, accepted);
          require(accepted);
        }
      }`, { forceStateful: true });
    expect(artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'run')!.resultConsumers)
      .toEqual([
        { consumerCallsiteId: 1, argument: 0, producerCallsiteId: 0, resultIndex: 0 },
        { consumerCallsiteId: 1, argument: 1, producerCallsiteId: 0, resultIndex: 1 },
      ]);
  });

  it('links a produced result through an exact state-field write to a later call', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProducer { function quote(bigint n) returns (bigint); }
      interface IConsumer { function settle(bigint quoted); }
      struct Item { bigint id; }
      contract StateResultFlow() {
        Item[] items;
        function run(address producer, address consumer, bigint i, bigint n) public {
          if (n > 0) { items[i].id = n; }
          items[i].id = IProducer(producer).quote(n);
          IConsumer(consumer).settle(items[i].id);
          require(n >= 0);
        }
      }`, { forceStateful: true });
    const fn = artifact.abi.find((candidate) => candidate.name === 'run')!;
    expect(fn.resultConsumers).toEqual([{
      consumerCallsiteId: 1,
      argument: 0,
      producerCallsiteId: 0,
      resultIndex: 0,
    }]);
    expect(fn.externalCalls?.[1].argSources?.[0]).toMatchObject({
      kind: 'expression',
      expression: {
        kind: 'producerResult',
        callsiteId: 0,
        resultIndex: 0,
        type: 'bigint',
      },
    });
  });

  it('deduplicates repeated uses of one exact producer component in a consumer argument', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProducer { function quote(bigint n) returns (bigint); }
      interface IConsumer { function settle(bigint quoted); }
      contract RepeatedResultFlow() {
        function run(address producer, address consumer, bigint n) public {
          bigint quoted = IProducer(producer).quote(n);
          IConsumer(consumer).settle(quoted + quoted);
          require(quoted >= 0);
        }
      }`, { forceStateful: true });
    const fn = artifact.abi.find((candidate) => candidate.name === 'run')!;
    expect(fn.resultConsumers).toEqual([{
      consumerCallsiteId: 1,
      argument: 0,
      producerCallsiteId: 0,
      resultIndex: 0,
    }]);
    expect(fn.externalCalls?.[1].argSources?.[0]).toMatchObject({
      kind: 'expression',
      expression: {
        kind: 'binary',
        left: { kind: 'producerResult', callsiteId: 0, resultIndex: 0 },
        right: { kind: 'producerResult', callsiteId: 0, resultIndex: 0 },
      },
    });
  });

  it('links a produced result to each conditionally reached callsite', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function ready(bigint n) returns (bool); }
      interface IAction { function run(bigint n); }
      contract ConditionalResultFlow() {
        function dispatch(address probe, address action, bigint n) public {
          bool ready = IProbe(probe).ready(n);
          if (!ready) {
            IAction(action).run(0);
            IAction(action).run(n);
          }
          require(n >= 0);
        }
      }`, { forceStateful: true, messageBus: true, suppressWarnings: true });
    const fn = artifact.invocationAnalysis!.functions.find((candidate) => candidate.name === 'dispatch')!;
    expect(fn.externalCalls?.map((call) => call.occurrence)).toEqual([
      'once', 'conditional', 'conditional',
    ]);
    for (const call of fn.externalCalls!.slice(1)) {
      expect(call.condition).toMatchObject({
        kind: 'unary',
        operator: '!',
        expression: { kind: 'producerResult', callsiteId: 0, resultIndex: 0 },
      });
    }
    expect(fn.resultConsumers).toEqual([
      { consumerCallsiteId: 1, condition: true, producerCallsiteId: 0, resultIndex: 0 },
      { consumerCallsiteId: 2, condition: true, producerCallsiteId: 0, resultIndex: 0 },
    ]);
    expect(artifact.abi.find((candidate) => candidate.name === 'dispatch')!.resultConsumers)
      .toEqual(fn.resultConsumers);
  });

  it('preserves sibling call activation across inlined helper postconditions', () => {
    const artifact = compileString(`pragma solidity >=0.8.0;
      interface ITarget { function act(bigint n) external returns (bool); }
      contract InlinedConditionalResultFlow() {
        function optional(address target, bigint n) private returns (bool) {
          bool success, bytes result = target.call(abi.encodeCall(ITarget.act, (n)));
          return success && (result.length == 0 || abi.decode(result, (bool)));
        }
        function checked(address target, bigint n) private {
          bool success, bytes result = target.call(abi.encodeCall(ITarget.act, (n)));
          require(success && (result.length == 0 || abi.decode(result, (bool))));
        }
        function dispatch(address target, bigint n) public {
          if (!optional(target, n)) {
            checked(target, 0);
            checked(target, n);
          }
          require(n >= 0);
        }
      }`, {
      forceStateful: true, messageBus: true, suppressWarnings: true, solidityImportCompat: true,
    });
    const fn = artifact.invocationAnalysis!.functions.find((candidate) => candidate.name === 'dispatch')!;
    expect(fn.externalCalls?.map((call) => call.occurrence)).toEqual([
      'once', 'conditional', 'conditional',
    ]);
    expect(fn.externalCalls?.[1].condition).toBeDefined();
    expect(fn.externalCalls?.[1].condition).toEqual(fn.externalCalls?.[2].condition);
    expect(JSON.stringify(fn.externalCalls?.[2].condition)).not.toContain('"callsiteId":1');
  });

  // A partially written state-array entry is rebuilt as `T(.., thisField, ..)`: the front end reuses the read
  // node as the rebuilt field's argument, and a later rebuild of another field restates the entry with that same
  // argument. The published argument must be the value the handler wrote, never the read folded back on itself.
  it('publishes a state-array entry field written before a later whole-entry rebuild', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IData { function publish(uint256 id, bool flag, uint256 amount) external; }
      contract FieldProvenance() {
        struct Inner { uint8 state; bool flag; uint256 amount; }
        Inner[] jobs;
        IData data;
        function post(uint256 n) public {
          jobs.push();
          uint256 id = jobs.length - 1;
          Inner storage job = jobs[id];
          job.flag = n > 0;
          job.amount = n + 1;
          data.publish(id, job.flag, job.amount);
          require(n > 0);
        }
      }`, { forceStateful: true, messageBus: true, suppressWarnings: true });
    const fn = artifact.abi.find((candidate) => candidate.name === 'post')!;
    const sources = fn.externalCalls!.find((call) => call.functionName === 'publish')!.argSources!;
    expect(sources[1]).toMatchObject({
      kind: 'expression',
      expression: {
        kind: 'binary',
        operator: '>',
        left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      },
    });
    expect(sources[2]).toMatchObject({
      kind: 'expression',
      expression: {
        kind: 'binary',
        operator: '+',
        left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      },
    });
    expect(JSON.stringify(sources)).not.toContain('"reference"');
  });

  // Conditional writes are tracked per field: a branch that cannot change the observed field must not discard an
  // unconditional write to it, and a field the handler never wrote stays the entry read rather than a rebuild.
  it('keeps state-array field provenance across a conditional write to a sibling field', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IData { function publish(uint256 id, bool flag, uint8 state) external; }
      contract FieldProvenanceConditional() {
        struct Inner { uint8 state; bool flag; uint256 amount; }
        Inner[] jobs;
        IData data;
        function post(uint256 n) public {
          jobs.push();
          uint256 id = jobs.length - 1;
          if (n > 1) { jobs[id].amount = n; }
          jobs[id].flag = n > 0;
          data.publish(id, jobs[id].flag, jobs[id].state);
          require(n > 0);
        }
      }`, { forceStateful: true, messageBus: true, suppressWarnings: true });
    const fn = artifact.abi.find((candidate) => candidate.name === 'post')!;
    const sources = fn.externalCalls!.find((call) => call.functionName === 'publish')!.argSources!;
    expect(sources[1]).toMatchObject({
      kind: 'expression',
      expression: {
        kind: 'binary',
        operator: '>',
        left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      },
    });
    expect(sources[2]).toMatchObject({
      kind: 'expression',
      expression: { kind: 'field', name: 'state' },
    });
    // The field the handler never wrote stays a read of the entry (`jobs`), whichever spelling the array cache
    // local left behind, so the SDK can evaluate it against chain state.
    expect(JSON.stringify(sources[2])).toContain('"jobs"');
    expect(JSON.stringify(sources)).not.toContain('"reference"');
  });

  it('publishes an exact affine pre-test domain after path-sensitive loop-entry assignments', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ITarget { function step(bigint value); }
      contract AffineLoopEntry() {
        function run(address target, bigint n, bool bump, bool wide) public {
          bigint original = n;
          n = original + 2;
          bigint bound = 0;
          bound = n;
          if (bump) { bound = bound + 1; }
          bigint delta = wide ? 2 : 1;
          for (bigint i = 1; i < bound; i = i + delta) {
            ITarget(target).step(i);
          }
          require(n >= 0);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, suppressWarnings: true,
    });
    const call = artifact.abi.find((fn) => fn.name === 'run')!.externalCalls![0];
    expect(call.iterationDomain).toMatchObject({
      counterName: 'i',
      initialValue: { kind: 'literal', value: '1' },
      stepValue: {
        kind: 'ternary',
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 3 } },
        ifTrue: { kind: 'literal', value: '2' },
        ifFalse: { kind: 'literal', value: '1' },
      },
      continueCondition: {
        kind: 'binary', operator: '<',
        left: { kind: 'identifier', name: 'i' },
        right: {
          kind: 'ternary',
          condition: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
        },
      },
    });
    expect(call.iterationDomain?.maximumIterations).toBeGreaterThan(0);
    expect(call.minimumOccurrences).toBeUndefined();
  });

  it('uses an authenticated prior producer result in the loop domain and publishes its consumer lane', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function limit(bigint seed) returns (bigint, bool); }
      interface ITarget { function step(bigint value); }
      contract ResultBoundLoop() {
        function run(address probe, address target, bigint seed) public {
          bigint limit, bool enabled = IProbe(probe).limit(seed);
          bigint bound = enabled ? limit : 0;
          for (bigint i = 0; i < bound; i = i + 1) {
            ITarget(target).step(i);
          }
          require(seed >= 0);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, suppressWarnings: true,
    });
    const fn = artifact.abi.find((candidate) => candidate.name === 'run')!;
    expect(fn.externalCalls?.map((call) => [call.callsiteId, call.functionName])).toEqual([
      [0, 'limit'], [1, 'step'],
    ]);
    expect(fn.externalCalls?.[1].iterationDomain?.continueCondition).toMatchObject({
      kind: 'binary', operator: '<',
      right: {
        kind: 'ternary',
        condition: { kind: 'producerResult', callsiteId: 0, resultIndex: 1 },
        ifTrue: { kind: 'producerResult', callsiteId: 0, resultIndex: 0 },
      },
    });
    expect(fn.resultConsumers).toEqual(expect.arrayContaining([
      {
        consumerCallsiteId: 1, iterationDomain: true,
        producerCallsiteId: 0, resultIndex: 0,
      },
      {
        consumerCallsiteId: 1, iterationDomain: true,
        producerCallsiteId: 0, resultIndex: 1,
      },
    ]));
    expect(JSON.stringify(fn.externalCalls?.[1].iterationDomain)).not.toContain('externalCall');
    const analyzed = artifact.invocationAnalysis!.functions.find((candidate) => candidate.name === 'run')!;
    expect(analyzed.externalCalls?.[1].iterationDomain).toEqual(fn.externalCalls?.[1].iterationDomain);
    expect(analyzed.resultConsumers).toEqual(fn.resultConsumers);
  });

  it('preserves a loop call result-to-returned-array link across memory lowering', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface ISource {
        function size() external view returns (uint256);
        function read(uint256 index) external view returns (uint256);
      }
      contract ResultArrayLoop(address source) {
        function collect(uint256 offset) public view returns (uint256[] memory) {
          uint256 length = ISource(source).size() - offset;
          uint256[] memory result = new uint256[](length);
          for (uint256 index = 0; index < length; index++) {
            result[index] = ISource(source).read(index + offset);
          }
          return result;
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, solidityImportCompat: true, suppressWarnings: true,
    });
    const fn = artifact.abi.find((candidate) => candidate.name === 'collect')!;
    expect(fn.externalCalls?.map((call) => [call.callsiteId, call.functionName])).toEqual([
      [0, 'size'], [1, 'read'],
    ]);
    expect(fn.externalCalls?.[1]).toMatchObject({
      occurrence: 'loop', resultArrayOutput: 0,
      iterationDomain: { counterName: 'index' },
    });
  });

  it('withholds an affine domain when a dependency changes inside the loop', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ITarget { function step(bigint value); }
      contract MutatingLoopBound() {
        function run(address target, bigint bound) public {
          for (bigint i = 0; i < bound; i = i + 1) {
            bound = bound - 1;
            ITarget(target).step(i);
          }
          require(bound >= 0);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, suppressWarnings: true,
    });
    expect(artifact.abi.find((fn) => fn.name === 'run')?.externalCalls?.[0].iterationDomain)
      .toBeUndefined();
  });
});
