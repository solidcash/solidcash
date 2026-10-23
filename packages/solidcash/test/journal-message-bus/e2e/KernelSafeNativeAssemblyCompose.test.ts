import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

const SOURCE = `pragma solidcash ^0.14.0;
contract NativeAssemblyAccumulator() {
  int total;

  function add(int amount) public {
    assembly {
      OP_2 OP_3 OP_ADD OP_5 OP_NUMEQUALVERIFY

      OP_1 OP_IF
        OP_9 OP_TOALTSTACK OP_FROMALTSTACK OP_9 OP_NUMEQUALVERIFY
      OP_ELSE
        OP_10 OP_DROP
      OP_ENDIF

      OP_7 OP_8 OP_1 OP_PICK OP_7 OP_NUMEQUALVERIFY OP_2DROP
      OP_7 OP_8 OP_1 OP_ROLL OP_7 OP_NUMEQUALVERIFY OP_8 OP_NUMEQUALVERIFY
    }
    this.total = this.total + amount;
    require(true);
  }
}`;

describe('kernel-safe native assembly compose', () => {
  it.each([
    ['borrows a compiler-managed main-stack value', 'OP_DROP'],
    ['leaves a value on the compiler-managed main stack', 'OP_1'],
    ['evaluates a transaction signature', 'OP_0 OP_0 OP_CHECKSIG OP_DROP'],
  ])('refuses assembly that %s', (_description, assembly) => {
    const artifact = compileString(`contract NativeAssemblyFence() {
      function rejected() public { assembly { ${assembly} } require(true); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'rejected'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_OPAQUE_EFFECT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('executes closed pure assembly before an ordinary scalar write on repeated rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add'))
      .toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([
      { function: 'add', args: [2n] },
      { function: 'add', args: [3n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }

    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).getState())
      .resolves.toMatchObject({ total: 5n });
  }, 180_000);
});
