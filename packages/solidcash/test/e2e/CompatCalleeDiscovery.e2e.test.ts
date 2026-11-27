/**
 * A Solidity-compat `call{value: 0}(payload)` whose stateful callee's block holds more than its master and records runs
 * that callee as a direct external group (7766bf6f5). That group goes through transitive discovery as a typed call's
 * callee does: a callee that calls on co-spends the contract it calls, and one whose run cannot be laid out (it, or
 * the contract it calls, reads blockhash(n); it makes a low-level call with a payload) is refused by name, with the
 * errors discovery gives a typed call's callee, before anything is sent. Each sent transaction is checked by the VM
 * as the mock chain accepts it.
 */
import { describe, expect, it } from 'vitest';
import { ContractFactory } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getSigners } from '../test-util.js';

const OPTIONS = { evmCompat: true, forceStateful: true } as any;
const limits = { maximumInputBytes: 100_000, maximumTransactionBytes: 10_000_000, maximumNftCommitmentBytes: 128 };

const COUNTER = `
pragma solidity ^0.8.0;
contract Counter {
  uint256 public hits;
  function bump(uint256 v) external { hits = hits + v; }
}`;

const STAMP = `
pragma solidity ^0.8.0;
contract Stamp {
  bytes32 public last;
  function stamp(uint256 n) external { last = blockhash(n); }
}`;

// The compat callee: each function writes an entry, so its block holds more than its master and records.
const LEDGER = `
pragma solidity ^0.8.0;
interface ICounter { function bump(uint256 v) external; }
interface IStamp { function stamp(uint256 n) external; }
contract Ledger {
  mapping(address => uint256) public credits;
  bytes32 public lastHash;
  ICounter counter;
  IStamp stamper;
  function setUp(ICounter c, IStamp s) external { counter = c; stamper = s; }
  function credit(address who, uint256 v) external { credits[who] += v; counter.bump(v); }
  function creditIf(address who, uint256 v, bool make) external { credits[who] += v; if (make) { counter.bump(v); } }
  function creditStamped(address who, uint256 v) external { credits[who] += v; stamper.stamp(v); }
  function creditOwnStamp(address who, uint256 v) external { credits[who] += v; lastHash = blockhash(v); }
  function creditForward(address who, uint256 v) external {
    credits[who] += v;
    (bool ok, ) = address(counter).call{value: 0}(abi.encodeWithSelector(ICounter.bump.selector, v));
    require(ok);
  }
}`;

const VAULT = `
pragma solidity ^0.8.0;
interface ILedger {
  function credit(address who, uint256 v) external;
  function creditIf(address who, uint256 v, bool make) external;
  function creditStamped(address who, uint256 v) external;
  function creditOwnStamp(address who, uint256 v) external;
  function creditForward(address who, uint256 v) external;
}
contract Vault {
  ILedger ledger;
  uint256 public pulled;
  function setLedger(ILedger l) external { ledger = l; }
  function pull(uint256 amount) external {
    (bool ok, ) = address(ledger).call{value: 0}(abi.encodeWithSelector(ILedger.credit.selector, msg.sender, amount));
    require(ok);
    pulled = pulled + amount;
  }
  function pullIf(uint256 amount, bool make) external {
    (bool ok, ) = address(ledger).call{value: 0}(
      abi.encodeWithSelector(ILedger.creditIf.selector, msg.sender, amount, make));
    require(ok);
    pulled = pulled + amount;
  }
  function pullStamped(uint256 amount) external {
    (bool ok, ) = address(ledger).call{value: 0}(
      abi.encodeWithSelector(ILedger.creditStamped.selector, msg.sender, amount));
    require(ok);
    pulled = pulled + amount;
  }
  function pullOwnStamp(uint256 amount) external {
    (bool ok, ) = address(ledger).call{value: 0}(
      abi.encodeWithSelector(ILedger.creditOwnStamp.selector, msg.sender, amount));
    require(ok);
    pulled = pulled + amount;
  }
  function pullForward(uint256 amount) external {
    (bool ok, ) = address(ledger).call{value: 0}(
      abi.encodeWithSelector(ILedger.creditForward.selector, msg.sender, amount));
    require(ok);
    pulled = pulled + amount;
  }
}`;

interface Setup { vault: any; ledger: any; counter: any; stamp: any; bob: any }

async function setup(): Promise<Setup> {
  const provider = createTestProvider();
  (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
  const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 40 });
  const counter = await new ContractFactory(compileString(COUNTER, OPTIONS), alice).deploy();
  const stamp = await new ContractFactory(compileString(STAMP, OPTIONS), alice).deploy();
  const ledger = await new ContractFactory(compileString(LEDGER, OPTIONS), alice).deploy();
  await ledger.setUp(counter.address, stamp.address).send();
  const vault = await new ContractFactory(compileString(VAULT, OPTIONS), alice).deploy();
  await vault.setLedger(ledger.address).send();
  return { vault, ledger, counter, stamp, bob };
}

const refusalOf = (promise: Promise<unknown>): Promise<string> => promise.then(
  () => 'sent', (error: unknown) => (error instanceof Error ? error.message : String(error)),
);

describe('a compat call\'s callee that runs as a direct group goes through transitive discovery', () => {
  it('co-spends the contract the compat callee calls: its entry, the call it makes and the caller settle', async () => {
    const { vault, ledger, counter, bob } = await setup();
    await vault.connect(bob).pull(100n).send();
    expect(await ledger.state.credits(addressToLockScript(bob.getAddress()))).toBe(100n);
    expect((await counter.getState()).hits).toBe(100n);
    expect((await vault.getState()).pulled).toBe(100n);
  }, 300_000);

  it('decides the compat callee\'s guard: false leaves the contract it would call unspent, true calls it', async () => {
    const { vault, ledger, counter, bob } = await setup();
    const masterOf = async (): Promise<string> => {
      const { masterUtxo } = await counter.getFullState();
      return `${masterUtxo.txid}:${masterUtxo.vout}`;
    };
    const before = await masterOf();
    await vault.connect(bob).pullIf(7n, false).send();
    expect(await ledger.state.credits(addressToLockScript(bob.getAddress()))).toBe(7n);
    expect((await counter.getState()).hits).toBe(0n);
    expect(await masterOf()).toBe(before);
    await vault.connect(bob).pullIf(8n, true).send();
    expect(await ledger.state.credits(addressToLockScript(bob.getAddress()))).toBe(15n);
    expect((await counter.getState()).hits).toBe(8n);
    expect((await vault.getState()).pulled).toBe(15n);
  }, 300_000);

  it('refuses by name, before sending, a compat callee that calls a contract which reads blockhash(n)', async () => {
    const { vault, ledger, bob } = await setup();
    const message = await refusalOf(vault.connect(bob).pullStamped(5n).send());
    expect(message).toMatch(/^The call of Stamp\.stamp cannot be laid out: it reads blockhash\(n\), and an /);
    expect(await ledger.state.credits(addressToLockScript(bob.getAddress()))).toBe(0n);
    expect((await vault.getState()).pulled).toBe(0n);
  }, 300_000);

  it('refuses by name, before sending, a compat callee that reads blockhash(n) itself', async () => {
    const { vault, ledger, bob } = await setup();
    const message = await refusalOf(vault.connect(bob).pullOwnStamp(5n).send());
    expect(message).toMatch(/^The call of Ledger\.creditOwnStamp cannot be laid out: it reads blockhash\(n\), and an /);
    expect(await ledger.state.credits(addressToLockScript(bob.getAddress()))).toBe(0n);
  }, 300_000);

  it('refuses by name, before sending, a compat callee that makes a low-level call with a payload', async () => {
    const { vault, ledger, counter, bob } = await setup();
    const message = await refusalOf(vault.connect(bob).pullForward(5n).send());
    expect(message).toMatch(/^The call of Ledger\.creditForward cannot be laid out: its low-level call 0 \(a call with a /);
    expect(await ledger.state.credits(addressToLockScript(bob.getAddress()))).toBe(0n);
    expect((await counter.getState()).hits).toBe(0n);
  }, 300_000);
});
