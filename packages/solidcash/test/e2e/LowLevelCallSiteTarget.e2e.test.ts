/**
 * A low-level call through a target its function writes before the call. The address-local pass reads a raw call's
 * receiver into a compiler local at the top of the body: a stored address (`payee.call{value: v}("")`), a stored
 * struct's field (`split.to.call{value: v}("")`, an `__extaddr_ll_` local) or the stored token a raw call's payload
 * goes to (`token.call(payload)`). The covenant paid and pinned that local where the call ran, and checked the raw
 * call's callee against it after the body, so after `payee = p` it paid, or called, the address the variable held at
 * the top of the body, which the EVM's call does not go to. Now the call site reads the written value, and a builder
 * refuses to resolve the raw call's callee from the state before the write.
 *
 * Each spend runs on the production profile's VM. The redirected and stale spends are refused by the caller's input.
 */
import {
  binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, hexToBin,
} from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, ExternalCallTargetWrittenBeforeCallError } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { StatefulContract, getContractFactory, registerDeployment } from '../../src/stateful/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getSigners, setupStatefulUtxos } from '../test-util.js';

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

/** A token whose transfer records the amount it moved and answers `true`. */
const TOKEN = `pragma solidcash >=0.8.0;
contract Token {
  bigint moved;
  function transfer(address, uint amount) external returns (bool) {
    this.moved = amount;
    return true;
  }
}`;

/** SafeERC20's raw call through a stored token address (`__extaddr_ll_token`), rewritten before or after the call. */
const STORED_PAYER = `pragma solidcash >=0.8.0;
contract StoredPayer {
  address token;
  bigint paid;
  function setToken(address t) external { this.token = t; }
  function retargetThenPayOut(address t, uint amount) external {
    this.token = t;
    (bool success, bytes data) = token.call(abi.encodeWithSelector(0xa9059cbb, address(this), amount));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
    this.paid = amount;
  }
  function payOutThenRetarget(address t, uint amount) external {
    (bool success, bytes data) = token.call(abi.encodeWithSelector(0xa9059cbb, address(this), amount));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
    this.paid = amount;
    this.token = t;
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

type Provider = ReturnType<typeof createTestProvider>;
type Deployed = { contract: any; address: Uint8Array };

const deploy = async (provider: Provider, artifact: Artifact): Promise<Deployed> => {
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const address = hexToBin(base.withCategory(hexToBin(setup.categoryId)).lockingBytecode);
  const contract = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
  registerDeployment(provider, {
    contractName: artifact.contractName, address: contract.target, lockingBytecode: binToHex(address), contract,
  });
  return { contract, address };
};

describe('a raw call through a stored token its function writes (evmCompat)', () => {
  const tokenArtifact = compileString(TOKEN, EVM_OPTIONS);
  const payerArtifact = compileString(STORED_PAYER, EVM_OPTIONS);

  /** Two tokens and a payer whose stored token is the first. */
  async function tokens(): Promise<{ first: Deployed; second: Deployed; payer: Deployed }> {
    const provider = createTestProvider();
    const first = await deploy(provider, tokenArtifact);
    const second = await deploy(provider, tokenArtifact);
    const payer = await deploy(provider, payerArtifact);
    await payer.contract.setToken(first.address).send();
    return { first, second, payer };
  }

  it('runs on the written token when the write comes first', async () => {
    const { first, second, payer } = await tokens();
    await payer.contract.retargetThenPayOut(second.address, 5n)
      .withExternalCall(second.contract, 'transfer', [payer.address, 5n]).send();
    expect((await second.contract.getState()).moved).toBe(5n);
    expect((await first.contract.getState()).moved).toBe(0n);
    expect((await payer.contract.getState()).paid).toBe(5n);
  });

  it('refuses the token the variable held before the write', async () => {
    const { first, second, payer } = await tokens();
    // The payer, input 0, checks its co-spent callee against the written token.
    await expect(payer.contract.retargetThenPayOut(second.address, 5n)
      .withExternalCall(first.contract, 'transfer', [payer.address, 5n]).send())
      .rejects.toThrow(/input 0\b/);
    expect((await first.contract.getState()).moved).toBe(0n);
    expect((await payer.contract.getState()).paid).toBe(0n);
  });

  it('refuses by name to resolve the callee from the state before the write', async () => {
    const { payer, second } = await tokens();
    const sent = payer.contract.retargetThenPayOut(second.address, 5n).send();
    await expect(sent).rejects.toThrow(ExternalCallTargetWrittenBeforeCallError);
    await expect(sent).rejects.toThrow(/'retargetThenPayOut' writes the target of its call/);
  });

  it('runs on the token the variable held when the write comes after the call', async () => {
    const { first, second, payer } = await tokens();
    await payer.contract.payOutThenRetarget(second.address, 5n)
      .withExternalCall(first.contract, 'transfer', [payer.address, 5n]).send();
    expect((await first.contract.getState()).moved).toBe(5n);
    expect((await second.contract.getState()).moved).toBe(0n);
  });
});
