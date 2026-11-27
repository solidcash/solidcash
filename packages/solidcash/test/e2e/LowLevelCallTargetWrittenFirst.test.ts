import { describe, expect, it } from 'vitest';
import { ExternalCallTargetWrittenBeforeCallError } from '../../src/index.js';
import { ContractFactory } from '../../src/stateful/index.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getSigners } from '../test-util.js';

// A Solidity-compat low-level call publishes its target and payload so the builder can co-spend the callee without a
// `.withCall()` (sc-auto-wire-low-level-calls). The target's source reads the caller's state as it stands before the
// spend, so for a call after a write of its target it named the contract from before the write, which the covenant's
// pin refuses: the spend failed at preflight. The artifact now marks such a call (`targetWrittenBeforeCall`), and the
// builder refuses by name to resolve its callee; the author passes it with `.withCall()`.
const OPTIONS = { evmCompat: true, forceStateful: true } as any;
const limits = { maximumInputBytes: 100_000, maximumTransactionBytes: 10_000_000, maximumNftCommitmentBytes: 128 };

const LEDGER = `
pragma solidity ^0.8.0;
contract Ledger {
  int256 public balance;
  function adjust(int256 delta) external { balance = balance + delta; }
}`;

const SHIFTER = `
pragma solidity ^0.8.0;
interface ILedger { function adjust(int256 delta) external; }
contract Shifter {
  ILedger ledger;
  function setLedger(ILedger l) external { ledger = l; }
  function retargetThenShift(ILedger l, int256 delta) external {
    ledger = l;
    (bool ok, ) = address(ledger).call{value: 0}(abi.encodeWithSelector(ILedger.adjust.selector, delta));
    require(ok);
  }
  function shiftThenRetarget(ILedger l, int256 delta) external {
    (bool ok, ) = address(ledger).call{value: 0}(abi.encodeWithSelector(ILedger.adjust.selector, delta));
    require(ok);
    ledger = l;
  }
}`;

describe('a compat low-level call through a stored target its function writes first', () => {
  const ledgerArt = compileString(LEDGER, OPTIONS);
  const shifterArt = compileString(SHIFTER, OPTIONS);

  /** A shifter whose stored ledger is the first of two ledgers. */
  async function setup(): Promise<{ shifter: any; first: any; second: any }> {
    const provider = createTestProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    const [alice] = await getSigners(1, { provider, fundingUtxos: 40 });
    const first = await new ContractFactory(ledgerArt, alice).deploy();
    const second = await new ContractFactory(ledgerArt, alice).deploy();
    const shifter = await new ContractFactory(shifterArt, alice).deploy();
    await shifter.setLedger(first.address).send();
    return { shifter, first, second };
  }

  it('publishes the call that runs after the write, and not the one before it', () => {
    const row = (entry: string): { targetWrittenBeforeCall?: true } | undefined => shifterArt.abi
      .find((fn) => fn.name === entry)?.lowLevelCalls?.[0];
    expect(row('retargetThenShift')?.targetWrittenBeforeCall).toBe(true);
    expect(row('shiftThenRetarget')).toBeDefined();
    expect(row('shiftThenRetarget')?.targetWrittenBeforeCall).toBeUndefined();
  });

  it('refuses by name to resolve the callee from the state before the write', async () => {
    const { shifter, first, second } = await setup();
    const sent = shifter.retargetThenShift(second.address, 5n).send();
    await expect(sent).rejects.toThrow(ExternalCallTargetWrittenBeforeCallError);
    await expect(sent).rejects.toThrow(/'retargetThenShift' writes the target of its call to address\.call/);
    await expect(sent).rejects.toThrow(/withCall\(contract, functionName, args\)/);
    expect((await first.getState()).balance).toBe(0n);
  });

  it('runs on the written ledger the author passes', async () => {
    const { shifter, first, second } = await setup();
    await shifter.retargetThenShift(second.address, 5n).withCall(second, 'adjust', [5n]).send();
    expect((await second.getState()).balance).toBe(5n);
    expect((await first.getState()).balance).toBe(0n);
  });

  it('still resolves the stored ledger for a call made before the write', async () => {
    const { shifter, first, second } = await setup();
    await shifter.shiftThenRetarget(second.address, 5n).send();
    expect((await first.getState()).balance).toBe(5n);
    expect((await second.getState()).balance).toBe(0n);
  });
});
