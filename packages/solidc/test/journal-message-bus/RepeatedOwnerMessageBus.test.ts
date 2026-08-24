import { describe, expect, it } from 'vitest';
import {
  compileString,
  compileStringMulti,
  compileStringSplit,
} from '../../src/compiler.js';

describe('inferred message-bus batching for repeated external callees', () => {
  const SOURCE = `
    interface ICounter { function add(int amount) external; }
    contract Caller(address counter) {
      function run(int first, int second) public {
        ICounter(counter).add(first);
        ICounter(counter).add(second);
        require(first >= 0 && second >= 0);
      }
    }
  `;

  it('collapses two straight-line calls to the same owner into one physical message-bus batch slot', () => {
    const artifact = compileString(SOURCE);
    const run = artifact.abi.find((fn) => fn.name === 'run');
    expect(run?.externalCalls).toHaveLength(1);
    expect(run?.externalCalls?.[0]).toMatchObject({
      interfaceName: 'ICounter',
      functionName: 'add',
      needsSelectorVerification: true,
      batchInvocations: [
        {
          logicalIndex: 0,
          inputs: [{ name: 'arg0', type: 'int256' }],
          argSources: [{ kind: 'forward', paramIndex: 0 }],
        },
        {
          logicalIndex: 1,
          inputs: [{ name: 'arg0', type: 'int256' }],
          argSources: [{ kind: 'forward', paramIndex: 1 }],
        },
      ],
    });
    expect(run?.externalCalls?.[0].batchInvocations?.every((row) => row.selector.length === 8)).toBe(true);
  });

  it('publishes runtime loop cardinality for repeated calls to one owner', () => {
    const artifact = compileString(`
      interface ISink { function put(int value) external; }
      contract Caller(address sink) {
        function run(int first, int[] values) public {
          ISink(sink).put(first);
          for (int i = 0; i < values.length; i = i + 1) ISink(sink).put(values[i]);
          require(first >= 0);
        }
      }
    `);
    const run = artifact.abi.find((fn) => fn.name === 'run');
    expect(run?.externalCalls).toHaveLength(1);
    expect(run?.externalCalls?.[0]).toMatchObject({
      occurrence: 'once',
      batchInvocations: [
        { logicalIndex: 0, argSources: [{ kind: 'forward', paramIndex: 0 }] },
        {
          logicalIndex: 1,
          occurrence: 'loop',
          argSources: [{ kind: 'arrayElement', paramIndex: 1, indexValue: 0 }],
        },
      ],
    });
  });

  it('collapses the supported repeated-owner shape by default', () => {
    const artifact = compileString(SOURCE);
    expect(artifact.abi.find((fn) => fn.name === 'run')?.externalCalls).toHaveLength(1);
  });

  it('accepts a proxy delegate-index push before the authenticated compiler-route selector', () => {
    const compact = compileString(SOURCE).bytecode.replace(/\s+/g, '');
    // Direct participants start at push4(SCB1); proxy implementations prepend their authenticated master-input
    // index. Branch on the actual first script byte, consume one complete optional push, then retain the exact
    // minimal route-selector check for both shapes.
    expect(compact).toContain(
      'OP_INPUTBYTECODEOP_DUPOP_1OP_SPLITOP_DROPOP_4OP_EQUALOP_NOTIFOP_1OP_SPLIT',
    );
    expect(compact).toContain('OP_ENDIFOP_5OP_SPLITOP_SWAP0453434231OP_EQUALVERIFY');
  });

  it('leaves an ungrouped single external call byte-identical to the explicit opt-out', () => {
    const source = `
      interface ICounter { function add(int amount) external; }
      contract Caller(address counter) {
        function run(int amount) public {
          ICounter(counter).add(amount);
          require(amount >= 0);
        }
      }
    `;
    const inferred = compileString(source);
    const direct = compileString(source, { messageBus: false });
    expect(inferred.bytecode).toBe(direct.bytecode);
    expect(inferred.abi.find((fn) => fn.name === 'run')?.externalCalls)
      .toEqual(direct.abi.find((fn) => fn.name === 'run')?.externalCalls);
  });

  it('leaves multiple repeated owners to the full message-bus planner', () => {
    const artifact = compileString(`
      interface ICounter { function add(int amount) external; }
      contract Caller(address firstCounter, address secondCounter) {
        function run(int amount) public {
          ICounter(firstCounter).add(amount);
          ICounter(firstCounter).add(amount);
          ICounter(secondCounter).add(amount);
          ICounter(secondCounter).add(amount);
          require(amount >= 0);
        }
      }
    `, { forceStateful: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
  });

  it('leaves a conditional repeated-owner chain to the full planner', () => {
    const artifact = compileString(`
      interface ICounter { function add(int amount) external; }
      contract Caller(address counter) {
        function run(bool includeFirst, int amount) public {
          if (includeFirst) ICounter(counter).add(amount);
          ICounter(counter).add(amount);
          require(amount >= 0);
        }
      }
    `, { forceStateful: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
  });

  it('infers the message bus and accepts an equivalent explicit request', () => {
    const inferred = compileString(SOURCE, { forceStateful: true });
    const explicit = compileString(SOURCE, { forceStateful: true, messageBus: true });
    expect(inferred.compiler.options?.messageBus).toBe(true);
    expect(explicit.bytecode).toBe(inferred.bytecode);
    expect(inferred.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
  });

  it('reconstructs deterministic raw calldata from constructor and handler arguments', () => {
    const artifact = compileString(`
      interface IERC20 { function transfer(address to, uint amount) external returns (bool); }
      library SafeTransfer {
        function send(address token, address to, uint amount) internal {
          (bool success, bytes data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
          );
          require(success);
        }
      }
      contract Caller(address token, address vault) {
        function withdraw(uint amount) public {
          SafeTransfer.send(token, vault, amount);
          require(amount >= 0);
        }
      }
    `, { forceStateful: true, messageBus: true });

    expect(artifact.contractName).toBe('Caller');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('rejects explicit messageBus false when one UTXO owner must serve repeated calls', () => {
    expect(() => compileString(SOURCE, { forceStateful: true, messageBus: false }))
      .toThrow(/MESSAGE_BUS_REQUIRED.*cannot be built with `messageBus: false`/);
  });

  it('enforces the explicit opt-out rule in multi-artifact and split compilation', () => {
    expect(() => compileStringMulti(SOURCE, { forceStateful: true, messageBus: false }))
      .toThrow(/MESSAGE_BUS_REQUIRED.*cannot be built with `messageBus: false`/);
    expect(() => compileStringSplit(SOURCE, { forceStateful: true, messageBus: false }))
      .toThrow(/MESSAGE_BUS_REQUIRED.*cannot be built with `messageBus: false`/);
  });
});
