import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

describe('external argument array indices', () => {
  it.each(['SECOND', 'FIRST + 1', 'offset + 1'])('preserves the expression for values[%s]', (index) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface ISink { function put(uint value) external; }
      contract Caller(address sink) {
        uint constant FIRST = 0;
        uint constant SECOND = 1;
        function run(uint[3] memory values, uint offset) public {
          ISink(sink).put(values[${index}]);
          require(true);
        }
      }`, { forceStateful: true, solidityImportCompat: true, messageBus: true,
      messageBusKernel: true, maximumInputBytes: 1_000_000, suppressWarnings: true });
    const source = artifact.abi.find((fn) => fn.name === 'run')!.externalCalls![0].argSources![0];
    expect(source).toMatchObject({ kind: 'expression', expression: {
      kind: 'arrayAccess', left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
    } });
    expect(source.expression!.right).toMatchObject(index === 'SECOND'
      ? { kind: 'literal', value: '1' }
      : { kind: 'binary', operator: '+', right: { kind: 'literal', value: '1' } });
  });
});
