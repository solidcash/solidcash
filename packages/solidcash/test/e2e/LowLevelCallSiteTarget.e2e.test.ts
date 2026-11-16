/**
 * A low-level call through a target its function writes before the call. The address-local pass reads a raw call's
 * receiver into a compiler local at the top of the body: a stored address (`payee.call{value: v}("")`) or a stored
 * struct's field (`split.to.call{value: v}("")`, an `__extaddr_ll_` local). The covenant paid and pinned that local
 * where the call ran, so after `payee = p` it paid the address the variable held at the top of the body, which the
 * EVM's call does not go to. Now the call site reads the written value.
 *
 * Each spend runs on the production profile's VM. The redirected spends are refused by the paying contract's input.
 */
import {
  binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, hexToBin,
} from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getSigners } from '../test-util.js';

/** A payer that sends through a stored address, or a stored struct's field, which a function rewrites around a send. */
const NATIVE_PAYER = `pragma solidcash >=0.8.0;
contract Payer {
  struct Split { address to; int share; }
  address payee;
  Split split;
  int sends;
  function setPayee(address p) external { payee = p; split = Split(p, 1); }
  function repointThenPay(address p, int amount) external {
    payee = p;
    (bool ok, bytes data) = payee.call{value: amount}("");
    require(ok && data.length == 0);
    sends = sends + 1;
  }
  function resplitThenPay(address p, int amount) external {
    split = Split(p, 2);
    (bool ok, bytes data) = split.to.call{value: amount}("");
    require(ok && data.length == 0);
    sends = sends + 1;
  }
  function payThenRepoint(address p, int amount) external {
    (bool ok, bytes data) = payee.call{value: amount}("");
    require(ok && data.length == 0);
    payee = p;
    sends = sends + 1;
  }
}`;

/** The same payer written as a Solidity port. */
const SOLIDITY_PAYER = `pragma solidity ^0.8.0;
contract Payer {
  address payable payee;
  uint256 public sends;
  function setPayee(address payable p) external { payee = p; }
  function repointThenPay(address payable p, uint256 amount) external {
    payee = p;
    (bool ok, ) = payee.call{value: amount}("");
    require(ok, "PAY_FAILED");
    sends = sends + 1;
  }
  function payThenRepoint(address payable p, uint256 amount) external {
    (bool ok, ) = payee.call{value: amount}("");
    require(ok, "PAY_FAILED");
    payee = p;
    sends = sends + 1;
  }
}`;

const AMOUNT = 5_000n;
const EVM_OPTIONS = { evmCompat: true, forceStateful: true } as const;

/** A real node's 2026 VM: the standard instruction set under BCH's own size limits. */
const productionVm = createVirtualMachineBch2026ForProvider(new MockNetworkProvider({ profile: 'production' }));
type Program = Parameters<typeof productionVm.evaluate>[0];
type Spend = Program['transaction'];
type Coins = Program['sourceOutputs'];

/** Whether input 0, the paying contract, accepts its unlocking in `transaction` on the production VM. */
const payerAccepts = (transaction: Spend, sourceOutputs: Coins): true | string => productionVm.stateSuccess(
  productionVm.evaluate({ inputIndex: 0, sourceOutputs, transaction }),
);

function lockOf(address: string): Uint8Array {
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') throw new Error(decoded);
  return decoded.bytecode;
}

/** The index of the output paying `amount` to `lock`, or -1. */
const paymentTo = (transaction: Spend, lock: Uint8Array, amount = AMOUNT): number => transaction.outputs
  .findIndex((output) => output.valueSatoshis === amount && binToHex(output.lockingBytecode) === binToHex(lock));

/** A payer holding 30,000 satoshis whose stored payee is the first wallet, and the locks of two wallets. */
async function payerWithPayee(artifact: Artifact): Promise<{ payer: any; first: Uint8Array; second: Uint8Array }> {
  const provider = createTestProvider();
  const [owner, firstWallet, secondWallet] = await getSigners(3, { provider, fundingUtxos: 8 });
  const payer: any = await getContractFactory(artifact, owner).deploy({ initialBalance: 30_000n });
  const first = lockOf(firstWallet.getAddress());
  await payer.setPayee(first).send();
  return { payer, first, second: lockOf(secondWallet.getAddress()) };
}

/**
 * The spend `call` builds: it passes the VM, pays `paid` the amount and pays `unpaid` nothing, and the same spend with
 * that payment moved to `unpaid` is refused by the payer.
 */
async function expectPays(call: any, paid: Uint8Array, unpaid: Uint8Array): Promise<void> {
  const builder = await call.build();
  const transaction: Spend = builder.buildLibauthTransaction();
  const sourceOutputs: Coins = generateLibauthSourceOutputs(builder.inputs);
  expect(payerAccepts(transaction, sourceOutputs)).toBe(true);
  const payment = paymentTo(transaction, paid);
  expect(payment).toBeGreaterThanOrEqual(0);
  expect(paymentTo(transaction, unpaid)).toBe(-1);
  const moved = structuredClone(transaction);
  moved.outputs[payment].lockingBytecode = unpaid;
  expect(payerAccepts(moved, sourceOutputs)).not.toBe(true);
}

for (const form of [
  { name: 'native', source: NATIVE_PAYER, options: { forceStateful: true } },
  { name: 'evmCompat', source: SOLIDITY_PAYER, options: EVM_OPTIONS },
]) {
  describe(`a value call through a stored address its function writes (${form.name})`, () => {
    const artifact = compileString(form.source, form.options);

    it('pays the written address when the write comes first, and the spend that pays the old one is refused',
      async () => {
        const { payer, first, second } = await payerWithPayee(artifact);
        await expectPays(payer.repointThenPay(second, AMOUNT), second, first);

        const tx = await payer.repointThenPay(second, AMOUNT).send();
        expect(paymentTo(decodeTransactionUnsafe(hexToBin(tx.hex)), second)).toBeGreaterThanOrEqual(0);
        expect((await payer.getState()).sends).toBe(1n);
      });

    it('pays the address the variable held when the write comes after the call', async () => {
      const { payer, first, second } = await payerWithPayee(artifact);
      await expectPays(payer.payThenRepoint(second, AMOUNT), first, second);
    });
  });
}

describe('a value call through a stored struct\'s field its function writes first (native)', () => {
  it('pays the written field, and the spend that pays the old one is refused', async () => {
    const { payer, first, second } = await payerWithPayee(compileString(NATIVE_PAYER, { forceStateful: true }));
    await expectPays(payer.resplitThenPay(second, AMOUNT), second, first);
  });
});
