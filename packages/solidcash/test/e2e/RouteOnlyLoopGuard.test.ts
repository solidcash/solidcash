import { decodeAuthenticationInstructions, encodeAuthenticationInstructions } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

// A message-bus build binds `runLimited`'s looped call to Ledger only on its route, which re-derives the loop row by
// row and never runs the entry body. The entry's own body co-spends nothing for that call, so its per-iteration path
// carries a fail-closed guard: a direct spend of the entry's own selector passes with an empty loop (count 0, no
// callee), and a forged direct spend that enters the loop (count >= 1) is rejected at the caller input, while a
// routed spend binds its callee row by row and passes.
const SOURCE = `pragma solidity ^0.8.0;
  interface ILedger { function set(uint outer, uint inner, uint value) external; }
  contract Ledger {
    mapping(uint => mapping(uint => uint)) values;
    function set(uint outer, uint inner, uint value) public { values[outer][inner] = value; require(true); }
  }
  contract Driver(address target) {
    function runLimited(uint count) public {
      require(count <= 3);
      for (uint i = 0; i < count; i = i + 1) ILedger(target).set(2, i, i + 20);
      require(true);
    }
  }`;

const OPTIONS = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  messageBusEntryPoolCapacity: 3, evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

async function deploy(): Promise<{
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>;
  driver: any; ledger: any; artifacts: ReturnType<typeof compileStringMulti>;
}> {
  const artifacts = compileStringMulti(SOURCE, OPTIONS);
  const provider = createMessageBusCapstoneTestProvider();
  const signer = new Signer(new Uint8Array(32).fill(0x63), provider);
  for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
    txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
  });
  const ledgerInner = new Contract(artifacts.Ledger, [], { provider });
  const ledgerSetup = await setupStatefulUtxos(
    provider, ledgerInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
  );
  const ledger = StatefulContract.withCategory(ledgerInner, ledgerSetup.categoryId).connect(signer);
  const driverInner = new Contract(artifacts.Driver, [ledger.inner.lockingBytecode], { provider });
  const driverSetup = await setupStatefulUtxos(
    provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
  );
  const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
  driver._registerResolvedExternal('ILedger', ledger);
  return { provider, driver, ledger, artifacts };
}

describe('a routeOnly looped call fails a direct spend that enters the loop', () => {
  it('marks the entry routeOnly', async () => {
    const artifacts = compileStringMulti(SOURCE, OPTIONS);
    expect(artifacts.Driver.abi.find((entry) => entry.name === 'runLimited')?.routeOnly).toBe(true);
  });

  it('passes a zero-iteration direct spend and rejects a forged one that enters the loop', async () => {
    const { provider, driver } = await deploy();
    // runLimited(0n) composes no route (one participant), so it spends the entry's own selector directly.
    const built = await driver.call.runLimited(0n).build();
    const transaction = built.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const callerIndex = built.inputs.findIndex((input: any) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction?.name === 'runLimited');
    expect(callerIndex).toBeGreaterThanOrEqual(0);

    // Shape 1: the honest zero-iteration direct spend passes - it only advances the entry's own state.
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: callerIndex, sourceOutputs, transaction,
    }))).toBe(true);

    // Shape 2: forge the same direct spend to a non-empty loop by raising its `count` argument (the push just below
    // the redeem script) from 0 to 1. The entry body runs the loop once with no Ledger co-spend, so the guard fails.
    const pushes = decodeAuthenticationInstructions(transaction.inputs[callerIndex].unlockingBytecode);
    pushes[pushes.length - 2] = { opcode: 0x51 } as never; // OP_1: count = 1
    const forged = {
      ...transaction,
      inputs: transaction.inputs.map((input, index) => (index === callerIndex
        ? { ...input, unlockingBytecode: encodeAuthenticationInstructions(pushes) } : { ...input })),
    };
    // stateSuccess returns true on success, else the VM failure string. The guard is an OP_VERIFY in the loop body.
    const outcome = vm.stateSuccess(vm.evaluate({ inputIndex: callerIndex, sourceOutputs, transaction: forged }));
    expect(outcome).not.toBe(true);
    expect(String(outcome)).toContain('OP_VERIFY');
  }, 180_000);

  it('passes a routed spend that enters the loop, binding its callee row by row', async () => {
    const { provider, driver, ledger } = await deploy();
    // runLimited(1n) has a callee, so the composer routes it: every input of the composed transaction passes.
    const built = await driver.call.runLimited(1n).build();
    const transaction = built.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(transaction.inputs.map((_input, inputIndex) => vm.stateSuccess(vm.evaluate({
      inputIndex, sourceOutputs, transaction,
    })))).toEqual(transaction.inputs.map(() => true));
    // The route binds the row and settles the callee, so sending it records Ledger's entry.
    await expect(driver.call.runLimited(1n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(await ledger.getEntries('values')).toHaveLength(1);
  }, 180_000);
});
