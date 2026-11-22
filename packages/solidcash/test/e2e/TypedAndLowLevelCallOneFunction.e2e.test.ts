/**
 * An evmCompat root function that makes a typed external call and a low-level call in one function: a compat
 * `call{value: 0}(payload)` (a `lowLevelCalls` row), whose callee runs on the low-level path or, when its block holds
 * more than its master and records, as a direct group; or an option-free `call(payload)` (an `__raw__` external call).
 * Each honest shape settles both callees beside the root, on the VM as the mock chain accepts it.
 */
import { describe, expect, it } from 'vitest';
import { ContractFactory } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getSigners } from '../test-util.js';

const OPTIONS = { evmCompat: true, forceStateful: true, messageBus: false } as any;
const limits = { maximumInputBytes: 100_000, maximumTransactionBytes: 10_000_000, maximumNftCommitmentBytes: 128 };

const COUNTER = `
pragma solidity ^0.8.0;
contract Counter {
  uint256 public hits;
  function bump(uint256 v) external { hits = hits + v; }
}`;

// A compat callee whose block holds an entry, so it runs as a direct group.
const LEDGER = `
pragma solidity ^0.8.0;
contract Ledger {
  mapping(address => uint256) public credits;
  function credit(address who, uint256 v) external { credits[who] += v; }
}`;

// A typed callee that calls on.
const RELAY = `
pragma solidity ^0.8.0;
interface ICounter { function bump(uint256 v) external; }
contract Relay {
  ICounter target;
  uint256 public relays;
  function setTarget(ICounter t) external { target = t; }
  function relay(uint256 v) external { target.bump(v); relays = relays + 1; }
  function relayTwice(uint256 v) external {
    for (uint256 i = 0; i < 2; i++) { target.bump(v); }
    relays = relays + 1;
  }
}`;

const ROOT = `
pragma solidity ^0.8.0;
interface ICounter { function bump(uint256 v) external; }
interface ILedger { function credit(address who, uint256 v) external; }
interface IRelay { function relay(uint256 v) external; function relayTwice(uint256 v) external; }
contract Root {
  ICounter typed;
  ICounter plain;
  ILedger ledger;
  IRelay relayer;
  uint256 public runs;
  function setUp(ICounter t, ICounter p, ILedger l, IRelay r) external { typed = t; plain = p; ledger = l; relayer = r; }
  function typedThenCompat(uint256 v) external {
    typed.bump(v);
    (bool ok, ) = address(plain).call{value: 0}(abi.encodeWithSelector(ICounter.bump.selector, v));
    require(ok);
    runs = runs + 1;
  }
  function compatThenTyped(uint256 v) external {
    (bool ok, ) = address(plain).call{value: 0}(abi.encodeWithSelector(ICounter.bump.selector, v));
    require(ok);
    typed.bump(v);
    runs = runs + 1;
  }
  function typedThenCompatFull(uint256 v) external {
    typed.bump(v);
    (bool ok, ) = address(ledger).call{value: 0}(abi.encodeWithSelector(ILedger.credit.selector, msg.sender, v));
    require(ok);
    runs = runs + 1;
  }
  function typedThenRaw(uint256 v) external {
    typed.bump(v);
    (bool ok, ) = address(plain).call(abi.encodeWithSelector(ICounter.bump.selector, v));
    require(ok);
    runs = runs + 1;
  }
  function typedThenPayload(bytes memory input, uint256 v) external {
    typed.bump(v);
    (bool ok, ) = address(plain).call{value: 0}(input);
    require(ok);
    runs = runs + 1;
  }
  function relayThenCompat(uint256 v) external {
    relayer.relay(v);
    (bool ok, ) = address(plain).call{value: 0}(abi.encodeWithSelector(ICounter.bump.selector, v));
    require(ok);
    runs = runs + 1;
  }
  function relayTwiceThenCompat(uint256 v) external {
    relayer.relayTwice(v);
    (bool ok, ) = address(plain).call{value: 0}(abi.encodeWithSelector(ICounter.bump.selector, v));
    require(ok);
    runs = runs + 1;
  }
}`;

interface Setup {
  root: any; typed: any; plain: any; ledger: any; relay: any; relayed: any; bob: any;
}

async function setup(): Promise<Setup> {
  const provider = createTestProvider();
  (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
  const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 40 });
  const counterArtifact = compileString(COUNTER, OPTIONS);
  const typed = await new ContractFactory(counterArtifact, alice).deploy();
  const plain = await new ContractFactory(counterArtifact, alice).deploy();
  const relayed = await new ContractFactory(counterArtifact, alice).deploy();
  const ledger = await new ContractFactory(compileString(LEDGER, OPTIONS), alice).deploy();
  const relay = await new ContractFactory(compileString(RELAY, OPTIONS), alice).deploy();
  await relay.setTarget(relayed.address).send();
  const root = await new ContractFactory(compileString(ROOT, OPTIONS), alice).deploy();
  await root.setUp(typed.address, plain.address, ledger.address, relay.address).send();
  return { root, typed, plain, ledger, relay, relayed, bob };
}

const hits = async (counter: any): Promise<bigint> => (await counter.getState()).hits;

describe('an evmCompat root that makes a typed call and a low-level call in one function', () => {
  it('typed call, then a compat call whose callee runs on the low-level path', async () => {
    const { root, typed, plain, bob } = await setup();
    await root.connect(bob).typedThenCompat(5n).send();
    expect(await hits(typed)).toBe(5n);
    expect(await hits(plain)).toBe(5n);
    expect((await root.getState()).runs).toBe(1n);
  }, 300_000);

  it('a compat call, then a typed call', async () => {
    const { root, typed, plain, bob } = await setup();
    await root.connect(bob).compatThenTyped(6n).send();
    expect(await hits(typed)).toBe(6n);
    expect(await hits(plain)).toBe(6n);
    expect((await root.getState()).runs).toBe(1n);
  }, 300_000);

  it('typed call, then a compat call whose callee runs as a direct group', async () => {
    const { root, typed, ledger, bob } = await setup();
    await root.connect(bob).typedThenCompatFull(7n).send();
    expect(await hits(typed)).toBe(7n);
    expect(await ledger.state.credits(addressToLockScript(bob.getAddress()))).toBe(7n);
    expect((await root.getState()).runs).toBe(1n);
  }, 300_000);

  it('typed call, then an option-free raw call', async () => {
    const { root, typed, plain, bob } = await setup();
    await root.connect(bob).typedThenRaw(8n).send();
    expect(await hits(typed)).toBe(8n);
    expect(await hits(plain)).toBe(8n);
    expect((await root.getState()).runs).toBe(1n);
  }, 300_000);

  it('typed call, then a compat call with a parameter payload and .withCall()', async () => {
    const { root, typed, plain, bob } = await setup();
    // bump(9): its selector and one EVM word.
    const payload = new Uint8Array([
      ...Buffer.from(plain.inner.artifact.abi.find((fn: any) => fn.name === 'bump').selector, 'hex'),
      ...new Uint8Array(31), 9,
    ]);
    await root.connect(bob).typedThenPayload(payload, 9n).withCall(plain, 'bump', [9n]).send();
    expect(await hits(typed)).toBe(9n);
    expect(await hits(plain)).toBe(9n);
    expect((await root.getState()).runs).toBe(1n);
  }, 300_000);

  // The called contract's callee holds its record in a block slot of its own, so the compat callee's outputs, placed
  // after the band of call records, stay at its inputs' indexes.
  it('typed call to a contract that calls on, then a compat call', async () => {
    const { root, plain, relay, relayed, bob } = await setup();
    await root.connect(bob).relayThenCompat(10n).send();
    expect(await hits(relayed)).toBe(10n);
    expect((await relay.getState()).relays).toBe(1n);
    expect(await hits(plain)).toBe(10n);
    expect((await root.getState()).runs).toBe(1n);
  }, 300_000);

  it('refuses by name, before sending, a callee the called contract calls in a loop, beside a compat call',
    async () => {
      const { root, plain, relay, relayed, bob } = await setup();
      const refusal = await root.connect(bob).relayTwiceThenCompat(3n).send()
        .then(() => undefined, (error: unknown) => error);
      const message = (refusal as Error | undefined)?.message ?? '';
      expect(message).toMatch(/^The call of Counter\.bump cannot be laid out beside the callee of /);
      expect(message).toContain('Root.relayTwiceThenCompat\'s low-level call 0: Relay.relayTwice calls it in a loop');
      expect(await hits(relayed)).toBe(0n);
      expect(await hits(plain)).toBe(0n);
      expect((await relay.getState()).relays).toBe(0n);
    }, 300_000);
});
