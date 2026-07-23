import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions,
  decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';

const INTERFACE = `
interface ICounter {
  function add(int amount);
  function clear();
  function multiply(int factor);
}
`;

const CALLEE = `
pragma solidcash >=0.8.0;
${INTERFACE}
contract Counter() is ICounter {
  int counter;
  function add(int amount) public {
    this.counter = this.counter + amount;
    require(amount >= 0);
  }
  function check(int expected) public {
    require(this.counter == expected);
  }
  function clear() public {
    this.counter = 0;
    require(true);
  }
  function multiply(int factor) public {
    this.counter = this.counter * factor;
    require(factor >= 0);
  }
}
`;

const CALLER = `
pragma solidcash >=0.8.0;
${INTERFACE}
contract Caller(bytes counterAddress) {
  int runs;
  function run(int first, int second) public {
    ICounter(counterAddress).add(first);
    ICounter(counterAddress).add(second);
    this.runs = this.runs + 1;
    require(first >= 0 && second >= 0);
  }
  function checkRuns(int expected) public {
    require(this.runs == expected);
  }
  function runTriple(int first, int second, int factor) public {
    ICounter(counterAddress).add(first);
    ICounter(counterAddress).add(second);
    ICounter(counterAddress).multiply(factor);
    this.runs = this.runs + 1;
    require(first >= 0 && second >= 0 && factor >= 0);
  }
  function runEight() public {
    ICounter(counterAddress).clear();
    ICounter(counterAddress).clear();
    ICounter(counterAddress).clear();
    ICounter(counterAddress).clear();
    ICounter(counterAddress).clear();
    ICounter(counterAddress).clear();
    ICounter(counterAddress).clear();
    ICounter(counterAddress).clear();
    this.runs = this.runs + 1;
    require(true);
  }
}
`;

async function deploy(options: { calleeBatch?: boolean } = {}) {
  const provider = createTestProvider();
  const calleeArtifact = compileString(CALLEE, {
    forceStateful: true,
    experimentalHiddenBatch: options.calleeBatch ?? true,
  });
  const calleeInner = new Contract(calleeArtifact, [], { provider });
  const { categoryId: calleeCategory } = await setupStatefulUtxos(
    provider, calleeInner, calleeArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const callee = StatefulContract.withCategory(calleeInner, calleeCategory);

  const callerArtifact = compileString(CALLER, {
    forceStateful: true,
    experimentalRepeatedExternalBatch: true,
  });
  const calleeAddress = calleeInner.withCategory(hexToBin(calleeCategory)).lockingBytecode;
  const callerInner = new Contract(callerArtifact, [calleeAddress], { provider });
  const { categoryId: callerCategory } = await setupStatefulUtxos(
    provider, callerInner, callerArtifact.stateLayout!, { runs: 0n }, { saltContract: true },
  );
  const caller = StatefulContract.withCategory(callerInner, callerCategory, {
    externals: { ICounter: callee },
  });
  return {
    provider, caller, callee, calleeCategory, callerCategory, callerInner, calleeArtifact,
  };
}

describe('Release 5 repeated external callee batch SDK E2E', () => {
  it.each([
    [2, 'run', [2n, 3n], {
      transactionBytes: 5915,
      inputs: [
        {
          hashes: 33, instructions: 1079, maximumOperationCost: 1636800,
          operationCost: 138080, peakStackBytes: 3022, peakStackItems: 12,
          pushedBytes: 23810, unlockingBytes: 2005,
        },
        {
          hashes: 6, instructions: 100, maximumOperationCost: 244800,
          operationCost: 11835, peakStackBytes: 261, peakStackItems: 4,
          pushedBytes: 683, unlockingBytes: 265,
        },
        {
          hashes: 45, instructions: 2743, maximumOperationCost: 2338400,
          operationCost: 316607, peakStackBytes: 5834, peakStackItems: 20,
          pushedBytes: 33602, unlockingBytes: 2882,
        },
        {
          hashes: 6, instructions: 100, maximumOperationCost: 244800,
          operationCost: 11836, peakStackBytes: 262, peakStackItems: 4,
          pushedBytes: 684, unlockingBytes: 265,
        },
      ],
    }],
    [3, 'runTriple', [2n, 3n, 4n], {
      transactionBytes: 5943,
      inputs: [
        {
          hashes: 33, instructions: 1202, maximumOperationCost: 1637600,
          operationCost: 150798, peakStackBytes: 3088, peakStackItems: 13,
          pushedBytes: 24227, unlockingBytes: 2006,
        },
        {
          hashes: 6, instructions: 100, maximumOperationCost: 244800,
          operationCost: 11835, peakStackBytes: 261, peakStackItems: 4,
          pushedBytes: 683, unlockingBytes: 265,
        },
        {
          hashes: 45, instructions: 3424, maximumOperationCost: 2359200,
          operationCost: 386913, peakStackBytes: 5912, peakStackItems: 20,
          pushedBytes: 35791, unlockingBytes: 2908,
        },
        {
          hashes: 6, instructions: 100, maximumOperationCost: 244800,
          operationCost: 11836, peakStackBytes: 262, peakStackItems: 4,
          pushedBytes: 684, unlockingBytes: 265,
        },
      ],
    }],
  ] as const)('pins BCH 2026 resource usage for the %i-row transaction', async (_rows, name, args, expected) => {
    const { caller } = await deploy();
    const builder = await caller.getFunction(name)(...args).build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026();
    const inputs = builder.inputs.map((_input, inputIndex) => {
      const result = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      if (!('metrics' in result)) throw new Error(String(result));
      return {
        instructions: result.metrics.evaluatedInstructionCount,
        operationCost: result.metrics.operationCost,
        maximumOperationCost: result.metrics.maximumOperationCost,
        pushedBytes: result.metrics.stackPushedBytes,
        hashes: result.metrics.hashDigestIterations,
        unlockingBytes: transaction.inputs[inputIndex].unlockingBytecode.length,
        ...(() => {
          const trace = vm.debug({ inputIndex, sourceOutputs, transaction }) as unknown as Array<{
            stack: Uint8Array[];
            alternateStack: Uint8Array[];
          }>;
          return {
            peakStackItems: Math.max(...trace.map((state) =>
              state.stack.length + state.alternateStack.length)),
            peakStackBytes: Math.max(...trace.map((state) =>
              [...state.stack, ...state.alternateStack]
                .reduce((sum, item) => sum + item.length, 0))),
          };
        })(),
      };
    });
    expect({ transactionBytes: encodeTransaction(transaction).length, inputs }).toEqual(expected);
  });

  it('co-spends one callee owner and applies both logical calls in order', async () => {
    const { caller, callee, calleeCategory } = await deploy();

    const builder = await caller.run(2n, 3n).build();
    expect(builder.inputs.filter((input) =>
      input.token?.category === calleeCategory && input.token.nft?.capability === 'minting')).toHaveLength(1);
    const calleeInputIndex = builder.inputs.findIndex((input) =>
      input.token?.category === calleeCategory && input.token.nft?.capability === 'minting');
    const instructions = decodeAuthenticationInstructions(
      builder.buildLibauthTransaction().inputs[calleeInputIndex].unlockingBytecode,
    );
    expect('data' in instructions[0] && binToHex(instructions[0].data)).toBe('53434231');
    expect('data' in instructions[1] && binToHex(instructions[1].data).startsWith('53434231')).toBe(true);

    await caller.run(2n, 3n).send();

    await caller.checkRuns(1n).send();
    await callee.check(5n).send();
  });

  it('fails closed before transaction construction when the callee lacks SCB1 capability', async () => {
    const { caller } = await deploy({ calleeBatch: false });
    await expect(caller.run(2n, 3n).send()).rejects.toThrow(/does not advertise.*SCB1/);
  });

  it('executes a three-row mixed-handler corpus shape through one callee transition', async () => {
    const { caller, callee, calleeCategory } = await deploy();
    const builder = await caller.runTriple(2n, 3n, 4n).build();
    expect(builder.inputs.filter((input) =>
      input.token?.category === calleeCategory && input.token.nft?.capability === 'minting')).toHaveLength(1);

    await caller.runTriple(2n, 3n, 4n).send();
    await caller.checkRuns(1n).send();
    await callee.check(20n).send();
  });

  it('binds and executes the eight-row maximum through a positional PUSHDATA1 blob', async () => {
    const { caller, callee, calleeCategory } = await deploy();
    const builder = await caller.runEight().build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026();
    const measured = builder.inputs.map((_input, inputIndex) => {
      const result = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      if (!('metrics' in result)) throw new Error(String(result));
      return {
        instructions: result.metrics.evaluatedInstructionCount,
        operationCost: result.metrics.operationCost,
        maximumOperationCost: result.metrics.maximumOperationCost,
        pushedBytes: result.metrics.stackPushedBytes,
        hashes: result.metrics.hashDigestIterations,
        unlockingBytes: transaction.inputs[inputIndex].unlockingBytecode.length,
        ...(() => {
          const trace = vm.debug({ inputIndex, sourceOutputs, transaction }) as unknown as Array<{
            stack: Uint8Array[];
            alternateStack: Uint8Array[];
          }>;
          return {
            peakStackItems: Math.max(...trace.map((state) =>
              state.stack.length + state.alternateStack.length)),
            peakStackBytes: Math.max(...trace.map((state) =>
              [...state.stack, ...state.alternateStack]
                .reduce((sum, item) => sum + item.length, 0))),
          };
        })(),
      };
    });
    expect({
      transactionBytes: encodeTransaction(transaction).length,
      inputs: measured,
    }).toEqual({
      transactionBytes: 6055,
      inputs: [
        {
          hashes: 33, instructions: 952, maximumOperationCost: 1635200,
          operationCost: 127276, peakStackBytes: 3374, peakStackItems: 10,
          pushedBytes: 25708, unlockingBytes: 2003,
        },
        {
          hashes: 6, instructions: 100, maximumOperationCost: 244800,
          operationCost: 11835, peakStackBytes: 261, peakStackItems: 4,
          pushedBytes: 683, unlockingBytes: 265,
        },
        {
          hashes: 45, instructions: 5461, maximumOperationCost: 2452000,
          operationCost: 610442, peakStackBytes: 6259, peakStackItems: 17,
          pushedBytes: 55566, unlockingBytes: 3024,
        },
        {
          hashes: 6, instructions: 100, maximumOperationCost: 244800,
          operationCost: 11836, peakStackBytes: 262, peakStackItems: 4,
          pushedBytes: 684, unlockingBytes: 265,
        },
      ],
    });
    expect(builder.inputs.filter((input) =>
      input.token?.category === calleeCategory && input.token.nft?.capability === 'minting')).toHaveLength(1);

    await caller.runEight().send();
    await caller.checkRuns(1n).send();
    await callee.check(0n).send();
  });

  it('rejects substituting a different SCB1-capable contract for the pinned callee owner', async () => {
    const { provider, callerInner, callerCategory, calleeArtifact } = await deploy();
    const substituteInner = new Contract(calleeArtifact, [], { provider });
    const { categoryId: substituteCategory } = await setupStatefulUtxos(
      provider, substituteInner, calleeArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const substitute = StatefulContract.withCategory(substituteInner, substituteCategory);
    const callerWithSubstitute = StatefulContract.withCategory(callerInner, callerCategory, {
      externals: { ICounter: substitute },
    });

    await expect(callerWithSubstitute.run(2n, 3n).send()).rejects.toThrow();
  });

  it.each([
    ['omission', (blob: Uint8Array) => {
      const mutated = blob.slice(0, 20);
      mutated[6] = 1;
      return mutated;
    }],
    ['injection', (blob: Uint8Array) => {
      const third = blob.slice(7, 20);
      third[4] = 2;
      const mutated = new Uint8Array(blob.length + third.length);
      mutated.set(blob);
      mutated.set(third, blob.length);
      mutated[6] = 3;
      return mutated;
    }],
    ['argument reordering', (blob: Uint8Array) => {
      const mutated = blob.slice();
      [mutated[19], mutated[32]] = [mutated[32], mutated[19]];
      return mutated;
    }],
    ['unchecked suffix', (blob: Uint8Array) => {
      const mutated = new Uint8Array(blob.length + 1);
      mutated.set(blob);
      mutated[mutated.length - 1] = 0x51;
      return mutated;
    }],
    ['row-count substitution', (blob: Uint8Array) => {
      const mutated = blob.slice();
      mutated[6] = 3;
      return mutated;
    }],
  ])('rejects a callee unlocking blob with %s even when the callee route accepts it', async (_name, mutate) => {
    const { caller, callee } = await deploy();
    const originalFactory = callee.inner.createCompilerRouteUnlocker.bind(callee.inner);
    callee.inner.createCompilerRouteUnlocker = ((abiFunction, selector) => {
      const originalUnlocker = originalFactory(abiFunction, selector);
      return ((blob: Uint8Array, ...rest: unknown[]) =>
        originalUnlocker(mutate(blob), ...rest)) as typeof originalUnlocker;
    }) as typeof callee.inner.createCompilerRouteUnlocker;

    await expect(caller.run(2n, 3n).send()).rejects.toThrow();
  });

  it('rejects forged settlement and a duplicate physical callee input, then accepts the untouched transaction', async () => {
    const {
      provider, caller, calleeCategory,
    } = await deploy();
    const send = provider.sendRawTransaction.bind(provider);
    let captured = '';
    (provider as any).sendRawTransaction = async (transactionHex: string): Promise<string> => {
      captured = transactionHex;
      throw new Error('capture-only');
    };
    try {
      await expect(caller.run(2n, 3n).send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');

    const forged = decodeTransactionUnsafe(hexToBin(captured));
    const calleeOutput = forged.outputs.find((output) =>
      output.token?.nft?.capability === 'mutable'
      && binToHex(output.token.category) === calleeCategory);
    expect(calleeOutput).toBeDefined();
    calleeOutput!.token!.nft!.commitment[0] ^= 1;

    await expect(send(binToHex(encodeTransaction(forged)))).rejects.toThrow();

    const duplicateInput = decodeTransactionUnsafe(hexToBin(captured));
    const calleeInput = duplicateInput.inputs.find((input) => {
      const first = decodeAuthenticationInstructions(input.unlockingBytecode)[0];
      return 'data' in first && binToHex(first.data) === '53434231';
    });
    expect(calleeInput).toBeDefined();
    duplicateInput.inputs.push({
      ...calleeInput!,
      outpointTransactionHash: calleeInput!.outpointTransactionHash.slice(),
      unlockingBytecode: calleeInput!.unlockingBytecode.slice(),
    });
    await expect(send(binToHex(encodeTransaction(duplicateInput)))).rejects.toThrow();

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });
});
