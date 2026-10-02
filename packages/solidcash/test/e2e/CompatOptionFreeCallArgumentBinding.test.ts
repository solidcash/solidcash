import { describe, expect, it } from 'vitest';
import { binToHex, hash160, hexToBin } from '@bitauth/libauth';
import { Contract, ContractFactory, StatefulContract } from '../../src/index.js';
import { compileString } from '../direct-compile.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider, getSigners, setupStatefulUtxos } from '../test-util.js';

// An option-free `(bool ok, bytes r) = addr.call(payload)` is lowered to an opaque `__raw__` external call whose
// return is read from a return event. The target identity is pinned in the epilogue, but the callee's selector and
// arguments were unbound, so a spender co-spending the genuine callee could run it with other arguments. The call
// site now binds the selector and the visible arguments the same redeem-end way the `{value:}` pin does, reading
// the callee's unlocking pushes before its redeem script. The epilogue's 20-byte identity target is also tightened
// to a canonical lock of the identity (the shared emitCompatAddressMatch), not any script carrying it at an offset.
const OPTIONS = { solidityImportCompat: true } as any;

const LEDGER = `pragma solidcash >=0.8.0;
contract Ledger() {
  bigint credited;
  function credit(int amount, address who, bool flag) external returns (int) {
    this.credited = this.credited + amount; return amount;
  }
  function touch(int amount, address who, bool flag) external returns (int) { return amount; }
}`;

const VAULT = `pragma solidcash >=0.8.0;
interface ILedger {
  function credit(int amount, address who, bool flag) external returns (int);
  function touch(int amount, address who, bool flag) external returns (int);
}
contract Vault(address ledger) {
  bigint pulled;
  function pull(int amount, address who, bool flag) {
    bool ok, bytes r = ledger.call(abi.encodeWithSelector(ILedger.credit.selector, amount, who, flag));
    require(ok);
    this.pulled = this.pulled + amount;
  }
}`;

// Two P2PKH-shaped locks with non-repeating hashes, used as `address` argument values.
const WHO = hexToBin(`76a914${'1a2b3c4d5e6f70819293a4b5c6d7e8f90a1b2c3d'}88ac`);
const WHO2 = hexToBin(`76a914${'0192a3b4c5d6e7f8091a2b3c4d5e6f7081920304'}88ac`);
const settles = /preflight failed at input 0: Program failed an OP_(EQUAL|NUMEQUAL)?VERIFY operation/;

describe('Solidity-compat option-free low-level call: the callee runs the payload', () => {
  const ledgerArt = compileString(LEDGER, OPTIONS);
  const vaultArt = compileString(VAULT, OPTIONS);

  async function setup(): Promise<{ ledger: any; vault: any }> {
    const provider = createTestProvider();
    const lc = new Contract(ledgerArt, [], { provider });
    const ls = await setupStatefulUtxos(provider, lc, ledgerArt.stateLayout!, { credited: 0n }, { saltContract: true });
    const ledgerInner = lc.withCategory(hexToBin(ls.categoryId));
    const vc = new Contract(vaultArt, [hexToBin(ledgerInner.lockingBytecode)], { provider });
    const vs = await setupStatefulUtxos(provider, vc, vaultArt.stateLayout!, { pulled: 0n }, { saltContract: true });
    return {
      ledger: StatefulContract.withCategory(lc, ls.categoryId),
      vault: StatefulContract.withCategory(vc, vs.categoryId),
    };
  }

  it('lowers to an opaque __raw__ external call', () => {
    const fn = vaultArt.abi.find((f) => f.name === 'pull')!;
    expect(fn.externalCalls?.some((e) => e.opaqueReturn && e.interfaceName === '__raw__')).toBe(true);
  });

  it('settles the honest call with matching arguments', async () => {
    const { ledger, vault } = await setup();
    const tx = await vault.pull(100n, WHO, true).withExternalCall(ledger, 'credit', [100n, WHO, true]).send();
    expect(tx.txid).toBeDefined();
    expect((await ledger.getState()).credited).toBe(100n);
  });

  it('refuses the genuine callee run with another uint argument', async () => {
    const { ledger, vault } = await setup();
    await expect(vault.pull(100n, WHO, true).withExternalCall(ledger, 'credit', [101n, WHO, true]).send())
      .rejects.toThrow(settles);
    expect((await ledger.getState()).credited).toBe(0n);
  });

  it('refuses another address argument', async () => {
    const { ledger, vault } = await setup();
    await expect(vault.pull(100n, WHO, true).withExternalCall(ledger, 'credit', [100n, WHO2, true]).send())
      .rejects.toThrow(settles);
    expect((await ledger.getState()).credited).toBe(0n);
  });

  it('refuses another bool argument', async () => {
    const { ledger, vault } = await setup();
    await expect(vault.pull(100n, WHO, true).withExternalCall(ledger, 'credit', [100n, WHO, false]).send())
      .rejects.toThrow(settles);
    expect((await ledger.getState()).credited).toBe(0n);
  });

  it('refuses the callee running a function other than the payload selector', async () => {
    const { ledger, vault } = await setup();
    await expect(vault.pull(100n, WHO, true).withExternalCall(ledger, 'touch', [100n, WHO, true]).send())
      .rejects.toThrow(settles);
    expect((await ledger.getState()).credited).toBe(0n);
  });
});

// The 20-byte identity target branch (bytes20 -> address) accepts a canonical lock of the identity and nothing else.
const ID_LEDGER = `pragma solidcash >=0.8.0;
contract Ledger() {
  bigint credited;
  function credit(int amount) external returns (int) { this.credited = this.credited + amount; return amount; }
}`;
const ID_VAULT = `pragma solidcash >=0.8.0;
interface ILedger { function credit(int amount) external returns (int); }
contract Vault(bytes20 ledgerId) {
  bigint pulled;
  function pull(int amount) {
    bool ok, bytes r = address(ledgerId).call(abi.encodeWithSelector(ILedger.credit.selector, amount));
    require(ok);
    this.pulled = this.pulled + amount;
  }
}`;

describe('Solidity-compat option-free low-level call: a 20-byte identity target', () => {
  const ledgerArt = compileString(ID_LEDGER, OPTIONS);
  const vaultArt = compileString(ID_VAULT, OPTIONS);
  async function genLedger(provider: any): Promise<{ sc: any; id: Uint8Array }> {
    const c = new Contract(ledgerArt, [], { provider });
    const s = await setupStatefulUtxos(provider, c, ledgerArt.stateLayout!, { credited: 0n }, { saltContract: true });
    const inner = c.withCategory(hexToBin(s.categoryId));
    return {
      sc: StatefulContract.withCategory(c, s.categoryId),
      id: hash160(hexToBin(inner.lockingBytecode)) as Uint8Array,
    };
  }
  async function genVault(provider: any, id: Uint8Array): Promise<any> {
    const c = new Contract(vaultArt, [id], { provider });
    const s = await setupStatefulUtxos(provider, c, vaultArt.stateLayout!, { pulled: 0n }, { saltContract: true });
    return StatefulContract.withCategory(c, s.categoryId);
  }

  it('settles when the co-spent callee P2SH32 lock HASH160s to the identity', async () => {
    const provider = createTestProvider();
    const ledger = await genLedger(provider);
    const vault = await genVault(provider, ledger.id);
    const tx = await vault.pull(100n).withExternalCall(ledger.sc, 'credit', [100n]).send();
    expect(tx.txid).toBeDefined();
    expect((await ledger.sc.getState()).credited).toBe(100n);
  });

  it('refuses a different callee as the identity target', async () => {
    const provider = createTestProvider();
    const real = await genLedger(provider);
    const other = await genLedger(provider);
    const vault = await genVault(provider, real.id);
    await expect(vault.pull(100n).withExternalCall(other.sc, 'credit', [100n]).send()).rejects.toThrow(settles);
  });
});

// The target identity is a canonical lock of the 20-byte identity, not any script carrying it at a hash offset. The
// `{value:0}` pin has no master-preservation, so swapping only the callee's source lock isolates the target check.
const PIN_LEDGER = `
pragma solidity ^0.8.0;
contract Ledger { uint256 public credited; function credit(uint256 amount) external { credited = credited + amount; } }`;
const PIN_VAULT = `
pragma solidity ^0.8.0;
interface ILedger { function credit(uint256 amount) external; }
contract Vault {
  bytes20 ledgerId;
  uint256 public pulled;
  function setLedger(bytes20 id) external { ledgerId = id; }
  function pull(uint256 amount) external {
    (bool ok, ) = address(ledgerId).call{value: 0}(abi.encodeWithSelector(ILedger.credit.selector, amount));
    require(ok);
    pulled = pulled + amount;
  }
}`;

describe('Solidity-compat target identity: a non-lock carrying the identity is refused', () => {
  const limits = { maximumInputBytes: 100_000, maximumTransactionBytes: 10_000_000, maximumNftCommitmentBytes: 128 };
  const ledgerArt = compileString(PIN_LEDGER, { solidityImportCompat: true, forceStateful: true, messageBus: false } as any);
  const vaultArt = compileString(PIN_VAULT, { solidityImportCompat: true, forceStateful: true, messageBus: false } as any);

  it('rejects the caller covenant when the co-spent lock is a non-lock carrying the identity', async () => {
    const provider = createTestProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 40 });
    const lc = new Contract(ledgerArt, [], { provider });
    const ls = await setupStatefulUtxos(provider, lc, ledgerArt.stateLayout!, { credited: 0n }, { saltContract: true });
    const ledgerLock = hexToBin(lc.withCategory(hexToBin(ls.categoryId)).lockingBytecode);
    const ledger = StatefulContract.withCategory(lc, ls.categoryId);
    const ledgerId = hash160(ledgerLock) as Uint8Array;
    const vault = await new ContractFactory(vaultArt, alice).deploy();
    await vault.setLedger(ledgerId).send();

    const builder = await vault.connect(bob).pull(100n).withCall(ledger, 'credit', [100n]).build();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const calleeIndex = sourceOutputs.findIndex((o: any) => binToHex(o.lockingBytecode) === binToHex(ledgerLock));
    expect(calleeIndex).toBeGreaterThanOrEqual(0);
    // Spendable P2S non-lock carrying ledgerId at bytes [3,23): OP_1 OP_DROP PUSH20 ledgerId OP_DROP OP_1.
    const nonLock = hexToBin(`5175${'14'}${binToHex(ledgerId)}${'75'}${'51'}`);
    sourceOutputs[calleeIndex] = { ...sourceOutputs[calleeIndex], lockingBytecode: nonLock };
    const transaction = builder.buildLibauthTransaction();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction }))).not.toBe(true);
  });
});
