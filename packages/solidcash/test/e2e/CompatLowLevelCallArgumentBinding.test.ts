import { describe, expect, it } from 'vitest';
import { binToHex, cashAddressToLockingBytecode, hexToBin } from '@bitauth/libauth';
import { ContractFactory } from '../../src/index.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getSigners } from '../test-util.js';

// A Solidity-compat `addr.call{value: v}(payload)` (OZ Address.functionCallWithValue; the option-free expression form
// is an `__raw__` external call instead) pins its co-spent callee to the target and the payload's selector
// (CompatLowLevelCallTargetPin). The callee's arguments are its own unlocking pushes, so a spender co-spending the
// genuine callee could still run its function with other arguments. The covenant now reads the callee's argument
// pushes from the end of its unlocking (the last pushes before the redeem script, whatever hidden witnesses precede
// them) and requires each to be the payload's: EVM words of encodeWithSelector decoded per type (an address word to
// a lock of that 20-byte identity), SolidCash pushes of encodeCall byte for byte. An argument the compiler sees but
// cannot bind that way is refused at compile time; a payload whose encoding it cannot see keeps the pin alone.
const OPTIONS = { solidityImportCompat: true, forceStateful: true, messageBus: false } as any;
const limits = { maximumInputBytes: 100_000, maximumTransactionBytes: 10_000_000, maximumNftCommitmentBytes: 128 };

const LEDGER = `
pragma solidity ^0.8.0;
contract Ledger {
  uint256 public credited;
  address public lastWho;
  bool public lastFlag;
  bytes4 public lastTag;
  int256 public balance;
  function credit(uint256 amount, address who, bool flag, bytes4 tag) external {
    credited = credited + amount;
    lastWho = who;
    lastFlag = flag;
    lastTag = tag;
  }
  function adjust(int256 delta) external { balance = balance + delta; }
}`;

const NOTEBOOK = `
pragma solidity ^0.8.0;
contract Notebook {
  uint256 public noted;
  function note(string calldata memo, uint256 n) external { noted = noted + n + bytes(memo).length; }
}`;

const INTERFACE = `
interface ILedger {
  function credit(uint256 amount, address who, bool flag, bytes4 tag) external;
  function adjust(int256 delta) external;
}
interface INotebook { function note(string calldata memo, uint256 n) external; }`;

const VAULT = `
pragma solidity ^0.8.0;
${INTERFACE}
contract Vault {
  struct Config { ILedger ledger; uint256 pulled; }
  Config public config;
  INotebook notebook;
  function setLedger(ILedger ledger) external { config.ledger = ledger; }
  function setNotebook(INotebook book) external { notebook = book; }
  function pull(uint256 amount, address who, bool flag, bytes4 tag) external {
    bytes memory data = abi.encodeWithSelector(ILedger.credit.selector, amount, who, flag, tag);
    (bool ok, ) = address(config.ledger).call{value: 0}(data);
    require(ok);
    config.pulled = config.pulled + amount;
  }
  function shift(int256 delta) external {
    (bool ok, ) = address(config.ledger).call{value: 0}(abi.encodeWithSelector(ILedger.adjust.selector, delta));
    require(ok);
  }
  function memo(string calldata text, uint256 n) external {
    (bool ok, ) = address(notebook).call{value: 0}(abi.encodeCall(INotebook.note, (text, n)));
    require(ok);
  }
}`;

// The vault's own covenant refuses: the mock names the failing input.
const refusedAtInput0 = /preflight failed at input 0: Program failed an OP_(EQUAL|NUMEQUAL)?VERIFY operation/;
const TAG = hexToBin('11223344');

function lockingBytecodeOf(address: string): Uint8Array {
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') throw new Error(decoded);
  return decoded.bytecode;
}

describe('Solidity-compat low-level call: the callee runs with the payload\'s arguments', () => {
  const ledgerArt = compileString(LEDGER, OPTIONS);
  const notebookArt = compileString(NOTEBOOK, OPTIONS);
  const vaultArt = compileString(VAULT, OPTIONS);

  async function setup(): Promise<{ vault: any; ledger: any; notebook: any; alice: any; bob: any }> {
    const provider = createTestProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 40 });
    const ledger = await new ContractFactory(ledgerArt, alice).deploy();
    const notebook = await new ContractFactory(notebookArt, alice).deploy();
    const vault = await new ContractFactory(vaultArt, alice).deploy();
    await vault.setLedger(ledger.address).send();
    await vault.setNotebook(notebook.address).send();
    return { vault, ledger, notebook, alice, bob };
  }

  it('settles the honest EVM-word call through the auto-wired callee, which records every argument', async () => {
    const { vault, ledger, bob } = await setup();
    await vault.connect(bob).pull(100n, bob.address, true, TAG).send();
    const state = await ledger.getState();
    expect(state.credited).toBe(100n);
    expect(binToHex(state.lastWho)).toBe(binToHex(lockingBytecodeOf(bob.address)));
    expect(state.lastFlag).toBe(true);
    expect(binToHex(state.lastTag)).toBe('11223344');
    expect((await vault.getState()).config.pulled).toBe(100n);
  });

  it('settles a zero address and a negative int', async () => {
    const { vault, ledger, bob } = await setup();
    await vault.connect(bob).pull(5n, '0x0000000000000000000000000000000000000000', false, TAG).send();
    expect((await ledger.getState()).lastWho.length).toBe(0);
    await vault.connect(bob).shift(-5n).send();
    expect((await ledger.getState()).balance).toBe(-5n);
  });

  it('refuses the right callee and function run with another uint', async () => {
    const { vault, ledger, bob } = await setup();
    await expect(vault.connect(bob).pull(100n, bob.address, true, TAG)
      .withCall(ledger, 'credit', [101n, bob.address, true, TAG]).send()).rejects.toThrow(refusedAtInput0);
    expect((await ledger.getState()).credited).toBe(0n);
  });

  it('refuses another address, and a non-lock carrying the address\'s 20-byte identity', async () => {
    const { vault, ledger, alice, bob } = await setup();
    await expect(vault.connect(bob).pull(100n, bob.address, true, TAG)
      .withCall(ledger, 'credit', [100n, alice.address, true, TAG]).send()).rejects.toThrow(refusedAtInput0);
    // 24 bytes, no lock of any kind, with bob's public-key hash at offset 3, where a bare 20-byte projection reads it.
    const pkh = lockingBytecodeOf(bob.address).slice(3, 23);
    const disguised = Uint8Array.from([0x00, 0x00, 0x00, ...pkh, 0x00]);
    await expect(vault.connect(bob).pull(100n, bob.address, true, TAG)
      .withCall(ledger, 'credit', [100n, disguised, true, TAG]).send()).rejects.toThrow(refusedAtInput0);
    expect((await ledger.getState()).credited).toBe(0n);
  });

  it('refuses another bool and another bytes4', async () => {
    const { vault, ledger, bob } = await setup();
    await expect(vault.connect(bob).pull(100n, bob.address, true, TAG)
      .withCall(ledger, 'credit', [100n, bob.address, false, TAG]).send()).rejects.toThrow(refusedAtInput0);
    await expect(vault.connect(bob).pull(100n, bob.address, true, TAG)
      .withCall(ledger, 'credit', [100n, bob.address, true, hexToBin('11223345')]).send())
      .rejects.toThrow(refusedAtInput0);
    expect((await ledger.getState()).credited).toBe(0n);
  });

  it('refuses another int, including the same magnitude with the other sign', async () => {
    const { vault, ledger, bob } = await setup();
    await expect(vault.connect(bob).shift(-5n).withCall(ledger, 'adjust', [5n]).send())
      .rejects.toThrow(refusedAtInput0);
    await expect(vault.connect(bob).shift(-5n).withCall(ledger, 'adjust', [-6n]).send())
      .rejects.toThrow(refusedAtInput0);
    expect((await ledger.getState()).balance).toBe(0n);
  });

  it('binds an encodeCall payload\'s pushes, a string included', async () => {
    const { vault, notebook, bob } = await setup();
    await vault.connect(bob).memo('hello', 7n).send();
    expect((await notebook.getState()).noted).toBe(12n);
    await expect(vault.connect(bob).memo('hello', 7n).withCall(notebook, 'note', ['hellp', 7n]).send())
      .rejects.toThrow(refusedAtInput0);
    await expect(vault.connect(bob).memo('hello', 7n).withCall(notebook, 'note', ['hello', 8n]).send())
      .rejects.toThrow(refusedAtInput0);
    expect((await notebook.getState()).noted).toBe(12n);
  });
});

describe('Solidity-compat low-level call: an argument that cannot be bound is refused by name', () => {
  const vault = (body: string): string => `
pragma solidity ^0.8.0;
${INTERFACE}
contract Vault {
  ILedger ledger;
  uint256 count;
  ${body}
}`;

  it('refuses an ABI-dynamic argument in an EVM-encoded payload', () => {
    expect(() => compileString(vault(`function relay(string calldata text, uint256 n) external {
      (bool ok, ) = address(ledger).call{value: 0}(abi.encodeWithSelector(INotebook.note.selector, text, n));
      require(ok);
      count = count + 1;
    }`), OPTIONS)).toThrow(/COMPAT_CALL_UNBOUND_ARGUMENTS.*argument 0 \('string'\) is ABI-dynamic/);
  });

  it('compiles payloads that carry no argument', () => {
    expect(() => compileString(vault(`function ping() external {
      (bool ok, ) = address(ledger).call{value: 0}(abi.encodeWithSignature("ping()"));
      require(ok);
      count = count + 1;
    }
    function poke() external {
      bytes memory empty = "";
      (bool sent, ) = address(ledger).call{value: 0}(empty);
      require(sent);
      count = count + 2;
    }`), OPTIONS)).not.toThrow();
  });
});
