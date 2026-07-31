import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions,
  decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { encodePushdataValue } from '@solidcash/utils';
import { Contract, StatefulContract } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';

const verifyPreflightAtCaller =
  'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';
const verifyAtCallee =
  /mandatory-script-verify-flag-failed .*error in evaluating input index 2: Program failed an OP_VERIFY operation/;
const duplicateOutpoint = new RegExp(
  'mandatory-script-verify-flag-failed .*transaction attempts to spend the same outpoint in multiple inputs'
  + '.*outpointTransactionHash: [0-9a-f]{64}, outpointIndex: 0',
);

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

async function deployFixedArray() {
  const provider = createTestProvider();
  const calleeArtifact = compileString(`pragma solidcash >=0.8.0;
    contract FixedArrayTarget() {
      bigint[3] slots;
      function set(bigint index, bigint value) public {
        this.slots[index] = value;
        require(index >= 0 && index < 3 && value >= 0);
      }
      function check(bigint index, bigint expected) public {
        require(this.slots[index] == expected);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
  const calleeInner = new Contract(calleeArtifact, [], { provider });
  const { categoryId: calleeCategory } = await setupStatefulUtxos(
    provider, calleeInner, calleeArtifact.stateLayout!, {}, { saltContract: true },
  );
  const callee = StatefulContract.withCategory(calleeInner, calleeCategory);
  await provider.addUtxo(
    getEntryNftAddress(callee.inner, calleeCategory, 'slots'),
    randomUtxo({
      satoshis: 10000n,
      token: {
        category: calleeCategory,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(Uint8Array.from([
            ...encodePushdataValue(1n, 'bigint'),
            ...encodePushdataValue(0n, 'bigint'),
          ])),
        },
      },
    }),
  );
  const callerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface IFixedArrayTarget { function set(bigint index, bigint value); }
    contract FixedArrayCaller(bytes target) {
      function setSame(bigint index, bigint first, bigint second) public {
        IFixedArrayTarget(target).set(index, first);
        IFixedArrayTarget(target).set(index, second);
        require(true);
      }
      function setDifferent(bigint firstIndex, bigint secondIndex) public {
        IFixedArrayTarget(target).set(firstIndex, 7);
        IFixedArrayTarget(target).set(secondIndex, 11);
        require(true);
      }
    }`, { forceStateful: true, experimentalRepeatedExternalBatch: true });
  const callerInner = new Contract(
    callerArtifact, [calleeInner.withCategory(hexToBin(calleeCategory)).lockingBytecode], { provider },
  );
  const { categoryId: callerCategory } = await setupStatefulUtxos(
    provider, callerInner, callerArtifact.stateLayout!, {}, { saltContract: true },
  );
  const caller = StatefulContract.withCategory(callerInner, callerCategory, {
    externals: { IFixedArrayTarget: callee },
  });
  return { caller, callee };
}

describe('Release 5 repeated external callee batch SDK E2E', () => {
  it.each([
    [2, 'run', [2n, 3n], {
      transactionBytes: 3575,
      inputs: [
        {
          hashes: 19, instructions: 1118, maximumOperationCost: 910400,
          operationCost: 128876, peakStackBytes: 1590, peakStackItems: 12,
          pushedBytes: 13394, unlockingBytes: 1097,
        },
        {
          hashes: 6, instructions: 100, maximumOperationCost: 244800,
          operationCost: 11835, peakStackBytes: 261, peakStackItems: 4,
          pushedBytes: 683, unlockingBytes: 265,
        },
        {
          hashes: 23, instructions: 2492, maximumOperationCost: 1192800,
          operationCost: 273265, peakStackBytes: 2970, peakStackItems: 22,
          pushedBytes: 19584, unlockingBytes: 1450,
        },
        {
          hashes: 6, instructions: 100, maximumOperationCost: 244800,
          operationCost: 11836, peakStackBytes: 262, peakStackItems: 4,
          pushedBytes: 684, unlockingBytes: 265,
        },
      ],
    }],
    [3, 'runTriple', [2n, 3n, 4n], {
      transactionBytes: 3603,
      inputs: [
        {
          hashes: 19, instructions: 1245, maximumOperationCost: 911200,
          operationCost: 141996, peakStackBytes: 1656, peakStackItems: 13,
          pushedBytes: 13813, unlockingBytes: 1098,
        },
        {
          hashes: 6, instructions: 100, maximumOperationCost: 244800,
          operationCost: 11835, peakStackBytes: 261, peakStackItems: 4,
          pushedBytes: 683, unlockingBytes: 265,
        },
        {
          hashes: 23, instructions: 3170, maximumOperationCost: 1213600,
          operationCost: 343506, peakStackBytes: 3048, peakStackItems: 22,
          pushedBytes: 22008, unlockingBytes: 1476,
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

  it('settles repeated writes to one fixed-array entry with one final flush', async () => {
    const { caller, callee } = await deployFixedArray();
    await caller.setSame(1n, 7n, 11n).send();
    await callee.check(1n, 11n).send();
  });

  it('rejects aliasing two fixed-array indices into the one-entry admitted route', async () => {
    const { caller } = await deployFixedArray();
    await expect(caller.setDifferent(1n, 2n).send())
      .rejects.toThrow(/collection witness '__scb_key_slots_0' is ambiguous/);
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
      transactionBytes: 3715,
      inputs: [
        {
          hashes: 19, instructions: 995, maximumOperationCost: 908800,
          operationCost: 118474, peakStackBytes: 1942, peakStackItems: 10,
          pushedBytes: 15294, unlockingBytes: 1095,
        },
        {
          hashes: 6, instructions: 100, maximumOperationCost: 244800,
          operationCost: 11835, peakStackBytes: 261, peakStackItems: 4,
          pushedBytes: 683, unlockingBytes: 265,
        },
        {
          hashes: 23, instructions: 4884, maximumOperationCost: 1306400,
          operationCost: 533636, peakStackBytes: 3395, peakStackItems: 22,
          pushedBytes: 40684, unlockingBytes: 1592,
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

    await expect(callerWithSubstitute.run(2n, 3n).send()).rejects.toThrow(verifyPreflightAtCaller);
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

    await expect(caller.run(2n, 3n).send()).rejects.toThrow(verifyPreflightAtCaller);
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

    await expect(send(binToHex(encodeTransaction(forged)))).rejects.toThrow(verifyAtCallee);

    const decoySecondPush = decodeTransactionUnsafe(hexToBin(captured));
    const decoyInput = decoySecondPush.inputs.find((input) => {
      const first = decodeAuthenticationInstructions(input.unlockingBytecode)[0];
      return 'data' in first && binToHex(first.data) === '53434231';
    });
    expect(decoyInput).toBeDefined();
    const shiftedUnlock = new Uint8Array(decoyInput!.unlockingBytecode.length + 1);
    shiftedUnlock.set(decoyInput!.unlockingBytecode.slice(0, 5));
    shiftedUnlock[5] = 0; // canonical empty decoy becomes the positional second push
    shiftedUnlock.set(decoyInput!.unlockingBytecode.slice(5), 6);
    decoyInput!.unlockingBytecode = shiftedUnlock;
    await expect(send(binToHex(encodeTransaction(decoySecondPush)))).rejects.toThrow('min relay fee not met');

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
    await expect(send(binToHex(encodeTransaction(duplicateInput)))).rejects.toThrow(duplicateOutpoint);

    const missingCaller = decodeTransactionUnsafe(hexToBin(captured));
    const callerInputIndex = missingCaller.inputs.findIndex((input) => {
      const first = decodeAuthenticationInstructions(input.unlockingBytecode)[0];
      return 'data' in first && first.data.length === 4 && binToHex(first.data) !== '53434231';
    });
    expect(callerInputIndex).toBeGreaterThanOrEqual(0);
    missingCaller.inputs.splice(callerInputIndex, 1);
    await expect(send(binToHex(encodeTransaction(missingCaller))))
      .rejects.toThrow(/bad-txns-in-belowout: value in \(\d+\) < value out \(\d+\)/);

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });
});
