import { binToHex, cashAddressToLockingBytecode, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getSigners } from '../test-util.js';

// A low-level `{value: v}` call that stays one, the classic withdraw `msg.sender.call{value: amt}("")`, pays its target
// an output the covenant checks. Its expression form had no transfer slot and its target no named value, so the
// payment dropped and the spender kept it. `transfer` and `send` pay a Solidity address identity's P2PKH lock the same
// way: they paid an output locked by the identity's raw 20 bytes.

/** A vault that zeroes what it owes before paying it out through a low-level call, `transfer` or `send`. */
const VAULT = `pragma solidity ^0.8.0;
contract Vault {
  uint256 public owed;
  function withdraw() external {
    uint256 amt = owed;
    owed = 0;
    (bool ok, ) = msg.sender.call{value: amt}("");
    require(ok, "WITHDRAW_FAILED");
  }
  function withdrawPayable() external {
    uint256 amt = owed;
    owed = 0;
    (bool ok, ) = payable(msg.sender).call{value: amt}("");
    require(ok, "WITHDRAW_FAILED");
  }
  function payLiteral() external {
    uint256 amt = owed;
    owed = 0;
    (bool ok, ) = address(0x1111111111111111111111111111111111111111).call{value: amt}("");
    require(ok, "PAY_FAILED");
  }
  function withdrawTransfer() external {
    uint256 amt = owed;
    owed = 0;
    payable(msg.sender).transfer(amt);
  }
  function withdrawSend() external {
    uint256 amt = owed;
    owed = 0;
    require(payable(msg.sender).send(amt), "SEND_FAILED");
  }
  function transferLiteral() external {
    uint256 amt = owed;
    owed = 0;
    payable(address(0x1111111111111111111111111111111111111111)).transfer(amt);
  }
  function sendLiteral() external {
    uint256 amt = owed;
    owed = 0;
    require(payable(address(0x1111111111111111111111111111111111111111)).send(amt), "SEND_FAILED");
  }
}`;

const OWED = 5_000n;
/** Another wallet's lock, where a redirected payment would go. */
const ELSEWHERE = hexToBin(`76a914${'33'.repeat(20)}88ac`);
/** The P2PKH lock of the literal's 20-byte identity, which the value call, `transfer` and `send` pay. */
const LITERAL_LOCK = `76a914${'11'.repeat(20)}88ac`;
/** Each payment and whom it pays: the caller, or the literal. */
const PAYMENTS: ReadonlyArray<readonly [string, string, 'caller' | 'literal']> = [
  ['withdraw', 'msg.sender.call{value:}', 'caller'],
  ['withdrawPayable', 'payable(msg.sender).call{value:}', 'caller'],
  ['payLiteral', 'a literal\'s call{value:}', 'literal'],
  ['withdrawTransfer', 'payable(msg.sender).transfer', 'caller'],
  ['withdrawSend', 'payable(msg.sender).send', 'caller'],
  ['transferLiteral', 'a literal\'s transfer', 'literal'],
  ['sendLiteral', 'a literal\'s send', 'literal'],
];

/** A real node's 2026 VM: the standard instruction set under BCH's own size limits. */
const productionVm = createVirtualMachineBch2026ForProvider(new MockNetworkProvider({ profile: 'production' }));
type Program = Parameters<typeof productionVm.evaluate>[0];
type Spend = Program['transaction'];
type Coins = Program['sourceOutputs'];

/** Whether input 0, the vault, accepts its unlocking in `transaction` on the production VM. */
const vaultAccepts = (transaction: Spend, sourceOutputs: Coins): true | string => productionVm.stateSuccess(
  productionVm.evaluate({ inputIndex: 0, sourceOutputs, transaction }),
);

function lockOf(address: string): string {
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') throw new Error(decoded);
  return binToHex(decoded.bytecode);
}

describe('a low-level {value:} call, a transfer and a send pay their target', () => {
  const artifact = compileString(VAULT, { evmCompat: true, forceStateful: true });

  it('publishes a transfer slot for each payment', () => {
    for (const [entry] of PAYMENTS) {
      expect(artifact.abi.find((fn) => fn.name === entry)!.transferCount).toBe(1);
    }
  });

  it.each(PAYMENTS)('%s pays through %s what it owed, and refuses the spend that drops or redirects it, on the '
    + 'production VM', async (entry, _form, payee) => {
    const provider = createTestProvider();
    const [owner, holder] = await getSigners(2, { provider, fundingUtxos: 8 });
    const vault: any = await getContractFactory(artifact, owner)
      .deploy({ initialBalance: 30_000n, initialState: { owed: OWED } });

    const builder = await vault.connect(holder)[entry]().build();
    const transaction: Spend = builder.buildLibauthTransaction();
    const sourceOutputs: Coins = generateLibauthSourceOutputs(builder.inputs);
    expect(vaultAccepts(transaction, sourceOutputs)).toBe(true);

    const recipient = payee === 'literal' ? LITERAL_LOCK : lockOf(holder.getAddress());
    const paid = transaction.outputs.findIndex((output) => output.valueSatoshis === OWED
      && binToHex(output.lockingBytecode) === recipient);
    expect(paid).toBeGreaterThanOrEqual(0);

    const dropped = structuredClone(transaction);
    dropped.outputs.splice(paid, 1);
    expect(vaultAccepts(dropped, sourceOutputs)).not.toBe(true);
    const redirected = structuredClone(transaction);
    redirected.outputs[paid].lockingBytecode = ELSEWHERE;
    expect(vaultAccepts(redirected, sourceOutputs)).not.toBe(true);
  });

  it('pays the target of the stateless form too', () => {
    const stateless = compileString('contract C() { function f(sig s, pubkey pk) {'
      + ' (bool ok, bytes d) = msg.sender.call{value: 100}(0x); require(checkSig(s, pk)); } }');
    expect(stateless.abi.find((fn) => fn.name === 'f')!.transferCount).toBe(1);
  });
});
