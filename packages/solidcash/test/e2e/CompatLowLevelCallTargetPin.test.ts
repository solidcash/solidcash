import { describe, expect, it } from 'vitest';
import { binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import { ContractFactory } from '../../src/index.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getSigners } from '../test-util.js';

// A Solidity-compat `addr.call{value: v}(payload)` (OZ SafeERC20 reaches one through Address.functionCallWithValue)
// is a low-level call whose co-spent callee the covenant used to accept blindly: it checked only that SOME input
// sat at the caller-chosen `callInputIndex`, so the caller's own input satisfied it and the "call" never ran. The
// covenant now pins that input to the call's target and, when the callee's unlocking leads with a selector push, the
// dispatched selector to the payload's; the compiler publishes the target and payload so the SDK co-spends the callee
// without a `.withCall()`. The payload's arguments are bound too (CompatLowLevelCallArgumentBinding).
const OPTIONS = { evmCompat: true, forceStateful: true, messageBus: false } as any;
const limits = { maximumInputBytes: 100_000, maximumTransactionBytes: 10_000_000, maximumNftCommitmentBytes: 128 };

const LEDGER = `
pragma solidity ^0.8.0;
contract Ledger {
  uint256 public credited;
  address public lastCaller;
  function credit(uint256 amount) external { credited = credited + amount; lastCaller = msg.sender; }
  function reset() external { credited = 0; }
}`;

const VAULT = `
pragma solidity ^0.8.0;
interface ILedger { function credit(uint256 amount) external; }
contract Vault {
  struct Config { ILedger ledger; uint256 deposited; }
  Config public config;
  function setLedger(ILedger ledger) external { config.ledger = ledger; }
  function pull(uint256 amount) external {
    bytes memory data = abi.encodeWithSelector(ILedger.credit.selector, amount);
    (bool ok, bytes memory ret) = address(config.ledger).call{value: 0}(data);
    require(ok && ret.length >= 0);
    config.deposited = config.deposited + amount;
  }
}`;

// The vault's own covenant refuses: the mock names the failing input.
const refusedAtInput0 = /preflight failed at input 0: Program failed an OP_(EQUAL)?VERIFY operation/;

function lockingBytecodeOf(address: string): string {
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') throw new Error(decoded);
  return binToHex(decoded.bytecode);
}

describe('Solidity-compat low-level call: the co-spent callee is pinned to the call target', () => {
  const ledgerArt = compileString(LEDGER, OPTIONS);
  const vaultArt = compileString(VAULT, OPTIONS);
  const creditSelector = ledgerArt.abi.find((fn) => fn.name === 'credit')!.selector!;

  async function setup(): Promise<{ vault: any; ledger: any; otherLedger: any; bob: any }> {
    const provider = createTestProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 40 });
    const ledger = await new ContractFactory(ledgerArt, alice).deploy();
    const otherLedger = await new ContractFactory(ledgerArt, alice).deploy();
    const vault = await new ContractFactory(vaultArt, alice).deploy();
    await vault.setLedger(ledger.address).send();
    return { vault, ledger, otherLedger, bob };
  }

  it('publishes the call target and payload for the SDK', () => {
    const [call] = vaultArt.abi.find((fn) => fn.name === 'pull')!.lowLevelCalls!;
    expect(call.targetSource).toEqual({
      kind: 'expression',
      expression: { kind: 'field', name: 'ledger', expression: { kind: 'state', name: 'config' } },
    });
    expect(call.dataSource).toEqual({
      kind: 'expression',
      expression: {
        kind: 'abiEncodeWithSelector',
        args: [
          { kind: 'literal', type: 'bytes4', value: creditSelector },
          { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
        ],
      },
    });
  });

  it('settles the honest call through the auto-wired callee, which sees the vault as msg.sender', async () => {
    const { vault, ledger, bob } = await setup();
    const tx = await vault.connect(bob).pull(100n).send();
    const spent = decodeTransactionUnsafe(hexToBin(tx.hex)).inputs.length;
    expect(spent).toBeGreaterThanOrEqual(3); // vault master, ledger master, funding
    const ledgerState = await ledger.getState();
    expect(ledgerState.credited).toBe(100n);
    expect(binToHex(ledgerState.lastCaller)).toBe(lockingBytecodeOf(vault.address));
    expect((await vault.getState()).config.deposited).toBe(100n);
  });

  it('refuses a call whose callee input is not the target (the caller\'s own funding input)', async () => {
    const { vault, ledger, bob } = await setup();
    const [funding] = await bob.getUtxos();
    await expect(vault.connect(bob).pull(100n).withCall({ ...funding, unlocker: bob.unlockP2PKH() }).send())
      .rejects.toThrow(refusedAtInput0);
    expect((await ledger.getState()).credited).toBe(0n);
  });

  it('refuses a different instance of the callee contract', async () => {
    const { vault, ledger, otherLedger, bob } = await setup();
    await expect(vault.connect(bob).pull(100n).withCall(otherLedger, 'credit', [100n]).send())
      .rejects.toThrow(refusedAtInput0);
    expect((await ledger.getState()).credited).toBe(0n);
    expect((await otherLedger.getState()).credited).toBe(0n);
  });

  it('refuses the target callee running a function other than the payload\'s', async () => {
    const { vault, ledger, bob } = await setup();
    await expect(vault.connect(bob).pull(100n).withCall(ledger, 'reset', []).send())
      .rejects.toThrow(refusedAtInput0);
    expect((await ledger.getState()).credited).toBe(0n);
  });
});
