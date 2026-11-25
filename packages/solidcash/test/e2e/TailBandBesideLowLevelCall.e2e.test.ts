/**
 * A low-level call's co-spent callee or raw coin sits right after every external call's block, and its outputs follow
 * the band of call records placed after those blocks. A call record in that band would take its output's index.
 * A raw `.withCall(utxo)` coin whose covenant checks its own output, beside a contract that calls on, keeps its index:
 * the contract's callee holds its record in a block of its own. A view and a write of one callee, beside a compat call,
 * run as frames of the callee's multi-call spend, whose records sit in its block. Each sent transaction is checked by
 * the VM.
 */
import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { Contract } from '../../src/index.js';
import { ContractFactory } from '../../src/stateful/index.js';
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

const HOLDER = `
pragma solidity ^0.8.0;
contract Holder {
  uint256 public value;
  function get() external view returns (uint256) { return value; }
  function set(uint256 v) external { value = v; }
}`;

const RELAY = `
pragma solidity ^0.8.0;
interface ICounter { function bump(uint256 v) external; }
contract Relay {
  ICounter target;
  uint256 public relays;
  function setTarget(ICounter t) external { target = t; }
  function relay(uint256 v) external { target.bump(v); relays = relays + 1; }
}`;

// A coin whose covenant requires its own lock at its own output index.
const KEEPER = `pragma solidcash >=0.8.0;
contract Keeper() {
  function spend() {
    require(tx.outputs[this.activeInputIndex].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);
  }
}`;

const ROOT = `
pragma solidity ^0.8.0;
interface ICounter { function bump(uint256 v) external; }
interface IHolder { function get() external view returns (uint256); function set(uint256 v) external; }
interface IRelay { function relay(uint256 v) external; }
contract Root {
  ICounter plain;
  IHolder holder;
  IRelay relayer;
  address keeper;
  uint256 public total;
  function setUp(ICounter p, IHolder h, IRelay r, address k) external { plain = p; holder = h; relayer = r; keeper = k; }
  function viewWriteThenCompat(uint256 v) external {
    uint256 before = holder.get();
    holder.set(v);
    (bool ok, ) = address(plain).call{value: 0}(abi.encodeWithSelector(ICounter.bump.selector, v));
    require(ok);
    total = before;
  }
  function relayThenKeeper(uint256 v) external {
    relayer.relay(v);
    (bool ok, ) = keeper.call{value: 0}(abi.encodeWithSelector(bytes4(0x11223344)));
    require(ok);
    total = v;
  }
}`;

interface Setup {
  provider: any; root: any; plain: any; holder: any; relay: any; relayed: any; bob: any; keeper: Contract;
}

async function setup(): Promise<Setup> {
  const provider = createTestProvider();
  (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
  const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 40 });
  const counterArtifact = compileString(COUNTER, OPTIONS);
  const plain = await new ContractFactory(counterArtifact, alice).deploy();
  const relayed = await new ContractFactory(counterArtifact, alice).deploy();
  // Two calls of Holder in one function run as frames of its multi-call spend.
  const holder = await new ContractFactory(compileString(HOLDER, { ...OPTIONS, callBatch: true }), alice).deploy();
  const relay = await new ContractFactory(compileString(RELAY, OPTIONS), alice).deploy();
  await relay.setTarget(relayed.address).send();
  const keeper = new Contract(compileString(KEEPER), [], { provider });
  const root = await new ContractFactory(compileString(ROOT, OPTIONS), alice).deploy();
  await root.setUp(plain.address, holder.address, relay.address, hexToBin(keeper.lockingBytecode)).send();
  return { provider, root, plain, holder, relay, relayed, bob, keeper };
}

const hits = async (counter: any): Promise<bigint> => (await counter.getState()).hits;

describe('a low-level call\'s co-spent callee or coin beside the band of call records', () => {
  it('a typed call to a contract that calls on, then a compat call to a raw coin whose covenant checks its own output',
    async () => {
      const { provider, root, relay, relayed, bob, keeper } = await setup();
      await provider.addUtxo(keeper.lockingBytecode, { txid: 'ab'.repeat(32), vout: 0, satoshis: 10_000n });
      const [coin] = await provider.getUtxos(keeper.address);
      await root.connect(bob).relayThenKeeper(5n).withCall({ ...coin, unlocker: keeper.unlock.spend() }).send();
      expect(await hits(relayed)).toBe(5n);
      expect((await relay.getState()).relays).toBe(1n);
      expect((await root.getState()).total).toBe(5n);
      expect(await provider.getUtxos(keeper.address)).toHaveLength(1);
    }, 300_000);

  it('a view and a write of one callee, as frames of its multi-call spend, then a compat call', async () => {
    const { root, plain, holder, bob } = await setup();
    await root.connect(bob).viewWriteThenCompat(4n).send();
    expect(await hits(plain)).toBe(4n);
    expect((await holder.getState()).value).toBe(4n);
    expect((await root.getState()).total).toBe(0n);
  }, 300_000);
});
