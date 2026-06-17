import { describe, it, expect } from 'vitest';
import {
  createVirtualMachineBch2026,
  decodeAuthenticationInstructions,
  encodeAuthenticationInstructions,
  encodeDataPush,
  binToHex,
  type AuthenticationInstruction,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import {
  Contract,
  TransactionBuilder,
  MockNetworkProvider,
  randomUtxo,
} from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';

// Security regression test for the OP_INVOKE dispatcher selector size check.
//
// Multi-function contracts emit a dispatcher that rolls the user-supplied selector to the top of
// the stack and OP_INVOKEs the matching OP_DEFINE'd function. Entry-point functions get a 4-byte
// hash selector; internal functions get small-int IDs (OP_0, OP_1, ...). Internal functions are
// compiled without removeFinalVerify / cleanStack, so they leave their return value on the stack.
//
// Before the fix, the simple dispatcher did `OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE` with NO selector
// validation. A crafted unlocking script could push an internal functionId in place of the real
// selector, jump straight into that internal function, skip every entry-point require(), and -- if
// the invoked code happened to leave exactly one truthy stack item -- VALIDATE the transaction.
//
// Concretely, for the contract below the unlocking script `[OP_0, <redeemScript>]` (empty-push
// selector = helper's functionId, no args) is a real auth bypass: P2SH eval pushes the constructor
// arg x, the dispatcher OP_INVOKEs `helper` with the empty selector, helper reads x via OP_PICK,
// returns x + 1, and leaves a single truthy item. Pre-fix this validated with no require() run.
// (Verified directly: stripping the size check from the redeem bytecode makes exactly this spend
// return `true` from vm.verify.)
//
// The fix emits `OP_SIZE OP_4 OP_NUMEQUALVERIFY` before OP_INVOKE, requiring the selector to be
// exactly 4 bytes. The empty-push internal id (size 0) and any other short id are rejected with an
// OP_VERIFY failure before OP_INVOKE, closing the bypass.

const CONTRACT_SOURCE = `
contract Dispatch(int x) {
    function entryA(int a) { require(a == x); }
    function entryB(int b) { require(b == x + 1); }
    function helper(int c) internal returns (int) { return c + 1; }
}
`;

// helper is internal so the OP_DEFINE namespace contains a non-entry-point id (OP_0 / empty push).
// It is never called from an entry point yet survives in bytecode as `OP_0 OP_DEFINE`, and `return
// c + 1` leaves a truthy value -- exactly the stack-leaving target the bypass aimed at.

const X = 7n;

// OP_0 pushes an empty stack item. This is helper's functionId as compared by OP_INVOKE (note: a
// 1-byte 0x00 push is a *different* item and resolves to no defined function).
const OP_0_INSTRUCTION: AuthenticationInstruction = { opcode: 0 };

/** Build a valid spend of the Dispatch contract calling entryA(X). */
function buildValidSpend(): {
  transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>;
  sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>;
  selectorHex: string;
} {
  const artifact = compileString(CONTRACT_SOURCE);
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [X], { provider });

  // Only p2sh32 is relevant; the dispatcher is identical regardless of P2SH variant.
  expect(contract.addressType).toBe('p2sh32');

  const utxo = randomUtxo({ satoshis: 100_000n });
  provider.addUtxo(contract.address, utxo);

  const builder = new TransactionBuilder({ provider })
    .addInput(utxo, contract.unlock.entryA(X))
    .addOutput({ to: contract.address, amount: 99_000n });

  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);

  const entryA = artifact.abi.find((f) => f.name === 'entryA');
  if (!entryA?.selector) throw new Error('entryA selector missing from ABI');

  return { transaction, sourceOutputs, selectorHex: entryA.selector };
}

/** Extract the redeem-script push (last instruction of a P2SH unlocking bytecode). */
function redeemPushInstruction(unlockingBytecode: Uint8Array): AuthenticationInstruction {
  const instructions = decodeAuthenticationInstructions(unlockingBytecode);
  return instructions[instructions.length - 1];
}

describe('Dispatch selector size check (OP_INVOKE auth bypass regression)', () => {
  it('accepts a valid 4-byte entry selector', () => {
    const { transaction, sourceOutputs } = buildValidSpend();
    const vm = createVirtualMachineBch2026();
    const result = vm.verify({ inputIndex: 0, sourceOutputs, transaction });
    // vm.verify returns true on success or a string error on failure.
    expect(result).toBe(true);
  });

  it('rejects the empty-push internal functionId exploit ([OP_0, redeemScript])', () => {
    const { transaction, sourceOutputs } = buildValidSpend();

    // Real auth-bypass shape: drop all args, use the empty push (helper's id) as the selector,
    // keep the redeem script. Pre-fix this validated; the size check (size 0 != 4) must reject it.
    const redeem = redeemPushInstruction(transaction.inputs[0].unlockingBytecode);
    transaction.inputs[0].unlockingBytecode = encodeAuthenticationInstructions([
      OP_0_INSTRUCTION,
      redeem,
    ]);

    const vm = createVirtualMachineBch2026();
    const result = vm.verify({ inputIndex: 0, sourceOutputs, transaction });
    // Must be a string error (not true): the size check closes the internal-function bypass.
    expect(typeof result).toBe('string');
  });

  it('rejects a 1-byte selector injected in place of the 4-byte selector', () => {
    const { transaction, sourceOutputs, selectorHex } = buildValidSpend();

    // Swap the real 4-byte selector push for a 1-byte push, keeping args and redeem intact. Any
    // non-4-byte selector must fail OP_SIZE OP_4 OP_NUMEQUALVERIFY before OP_INVOKE.
    const instructions = decodeAuthenticationInstructions(transaction.inputs[0].unlockingBytecode);
    const selectorIndex = instructions.findIndex(
      (ins) => 'data' in ins && ins.data !== undefined && binToHex(ins.data) === selectorHex,
    );
    expect(selectorIndex).toBeGreaterThanOrEqual(0);
    instructions[selectorIndex] = decodeAuthenticationInstructions(
      encodeDataPush(new Uint8Array([0x01])),
    )[0];
    transaction.inputs[0].unlockingBytecode = encodeAuthenticationInstructions(instructions);

    const vm = createVirtualMachineBch2026();
    const result = vm.verify({ inputIndex: 0, sourceOutputs, transaction });
    expect(typeof result).toBe('string');
  });
});
