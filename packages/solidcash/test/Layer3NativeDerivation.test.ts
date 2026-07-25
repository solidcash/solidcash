import { compileString } from 'solidc';
import { Contract, layer3 } from '../src/index.js';
import { createTestProvider } from './test-util.js';

const SINK = `pragma solidcash >=0.8.0;
interface ISink { function ping(int x); }
contract Sink() is ISink {
  function ping(int x) { require(x >= 0); }
  function other(int x) { require(x >= 0); }
}`;

const REPEATED = `pragma solidcash >=0.8.0;
interface ISink { function ping(int x); }
contract Repeated(bytes first, bytes second) {
  function invoke(int value) {
    ISink(first).ping(value);
    ISink(second).ping(9);
    require(value >= 0);
  }
}`;

const EXPRESSION = `pragma solidcash >=0.8.0;
interface ISink { function ping(int x); }
contract Expression(bytes target) {
  function invoke(int value) {
    ISink(target).ping(value + 1);
    require(value >= 0);
  }
}`;

describe('Layer-3 compiler-derived native call tables', () => {
  it('derives repeated callsites in compiler order and injects the same calls into the participant', () => {
    const provider = createTestProvider();
    const sink0 = new Contract(compileString(SINK), [], { provider });
    const sink1 = new Contract(compileString(SINK), [], { provider });
    const probe = new Contract(
      compileString(REPEATED), [sink0.lockingBytecode, sink1.lockingBytecode], { provider },
    );
    const blocks: layer3.BalancedBlock[] = [
      { dataSlots: 0, events: 0 }, { dataSlots: 0, events: 0 },
    ];
    const layout = layer3.balancedLayout(blocks, 2);
    const rows = layer3.deriveNativeExternalCalls({
      caller: probe, functionName: 'invoke', functionArgs: [7n],
      callerInput: 0, layout, targets: { ISink: [sink0, sink1] },
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.caller)).toEqual([0, 0]);
    expect(rows[0].callPrefixHex).toBe(`04${layer3.methodSelector('ping(int256)')}57`);
    expect(rows[1].callPrefixHex).toBe(`04${layer3.methodSelector('ping(int256)')}59`);
    expect(Object.isFrozen(rows)).toBe(true);
    expect(Object.isFrozen(rows[0])).toBe(true);

    const source = layer3.generateBalancedParticipant({
      contractName: 'Final', functionName: 'invoke', functionParams: 'int value',
      constructorParams: 'bytes first, bytes second',
      preamble: 'interface ISink { function ping(int x); }',
      selfPos: 0, blocks, calleeSlots: 2, invocations: [],
      controllerCategory: '11'.repeat(32), controllerLbc: 'aa20', externalCalls: rows,
    });
    expect(source).toContain('ISink(first).ping(value);');
    expect(source).toContain('ISink(second).ping(9);');
  });

  it('rejects manually authored rows at both public generation layers', () => {
    const blocks: layer3.BalancedBlock[] = [
      { dataSlots: 0, events: 0 }, { dataSlots: 0, events: 0 },
    ];
    const layout = layer3.balancedLayout(blocks, 1);
    const manual = [{
      caller: 0, calleeAddrHex: 'aa20', selectorHex: 'deadbeef', callPrefixHex: '04deadbeef',
    }];
    expect(() => layer3.balancedMemberBody(
      layout, 0, [], '11'.repeat(32), 'aa20', [], false, [], manual,
    )).toThrow('must be derived from compiler artifact metadata');
    expect(() => layer3.generateBalancedParticipant({
      contractName: 'Manual', functionName: 'run', selfPos: 0, blocks, calleeSlots: 1,
      invocations: [], controllerCategory: '11'.repeat(32), controllerLbc: 'aa20',
      externalCalls: manual as unknown as layer3.DerivedExternalCallTable,
    })).toThrow('must be derived from compiler artifact metadata');
  });

  it('fails closed when compiler metadata cannot derive an argument expression', () => {
    const provider = createTestProvider();
    const sink = new Contract(compileString(SINK), [], { provider });
    const probe = new Contract(compileString(EXPRESSION), [sink.lockingBytecode], { provider });
    const layout = layer3.balancedLayout([
      { dataSlots: 0, events: 0 }, { dataSlots: 0, events: 0 },
    ], 1);
    expect(() => layer3.deriveNativeExternalCalls({
      caller: probe, functionName: 'invoke', functionArgs: [7n],
      callerInput: 0, layout, targets: { ISink: sink },
    })).toThrow("argument source 'expression' is not statically derivable");
  });
});
