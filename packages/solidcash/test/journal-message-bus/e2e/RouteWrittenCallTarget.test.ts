/**
 * A call through a target its function writes before the call, composed atomically through the message-bus route.
 * A runtime handler checks each call's row where the call runs, from the call's own target; a target the body read
 * into a compiler local at its top (`__extaddr_feed_source`, `__extaddr_ll_token`) was checked against that local,
 * the value from before the write. A target the body writes first must bind the written value, as on the EVM. (A
 * handler the route checks before its body runs is refused from the route by name instead,
 * ROUTE_TARGET_WRITTEN_BEFORE_CALL; its function keeps its direct entry, BusCallSiteTarget.test.ts.)
 *
 * Each composition is evaluated on every input by the BCH 2026 VM (the semantic provider's relaxed size limits).
 */
import { hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const BUS = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

/** A typed call through a stored target the function writes first (StateTargetCallSite's Reader). */
const READER = `
  interface IOracle { function price() external returns (int); }
  contract Oracle() { int reads; function price() public returns (int) { this.reads = this.reads + 1; return 7; } }
  contract Hostile() {
    int reads;
    function price() public returns (int) { this.reads = this.reads + 1; return 1000000; }
  }
  contract Reader() {
    address oracle;
    int last;
    function retargetThenRead(address o) public { this.oracle = o; this.last = IOracle(this.oracle).price(); }
  }`;

/** A typed call through a stored struct's field (`__extaddr_feed_source`) the function writes first. */
const FEEDER = `
  interface IPinger { function ping() external; }
  contract Pinger() { int pings; function ping() public { this.pings = this.pings + 1; } }
  contract Feeder() {
    struct Feed { IPinger source; int weight; }
    Feed feed;
    function setFeed(address s) public { feed = Feed(IPinger(s), 1); require(true); }
    function retargetThenPing(address s) public { feed = Feed(IPinger(s), 2); feed.source.ping(); require(true); }
  }`;

/** SafeERC20's raw call through a stored token (`__extaddr_ll_token`) the function writes first. */
const STORED_PAYER = `
  contract Token() {
    bigint moved;
    function transfer(address, uint amount) external returns (bool) { this.moved = amount; return true; }
  }
  contract StoredPayer() {
    address token;
    bigint paid;
    function retargetThenPayOut(address t, uint amount) external {
      this.token = t;
      (bool success, bytes data) = token.call(abi.encodeWithSelector(0xa9059cbb, address(this), amount));
      require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
      this.paid = amount;
    }
  }`;

type Provider = ReturnType<typeof createMessageBusCapstoneTestProvider>;

async function connect(
  provider: Provider, artifact: Artifact, state: Record<string, unknown>,
): Promise<StatefulContract> {
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, state, { saltContract: true });
  return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
}

const lockOf = (contract: StatefulContract): Uint8Array => hexToBin(contract.inner.lockingBytecode);

/** 'accepted' when the composition builds and every input passes the VM, else where and why it was refused. */
async function verdict(build: () => Promise<TransactionBuilder>): Promise<string> {
  try {
    return messageBusVmAccepts(await build()) ? 'accepted' : 'refused by the VM';
  } catch (error) {
    return `refused before the VM: ${(error instanceof Error ? error.message : String(error)).slice(0, 400)}`;
  }
}

/** Whether `artifact`'s route admits the handler of `name`. */
const routed = (artifact: Artifact, name: string): boolean | undefined => artifact.messageBus?.handlers
  .find((handler) => handler.name === name)?.eligible;

describe('a routed call through a target its function writes first', () => {
  it('routes a typed call to the written target, and refuses the target from before the write', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(READER, BUS);
    expect(routed(artifacts.Reader, 'retargetThenRead')).toBe(true);
    const oracle = await connect(provider, artifacts.Oracle, { reads: 0n });
    const hostile = await connect(provider, artifacts.Hostile, { reads: 0n });
    const reader = await connect(provider, artifacts.Reader, { oracle: lockOf(oracle), last: 0n });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const compose = (callee: StatefulContract) => (): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: reader, functionName: 'retargetThenRead', args: [lockOf(hostile)] },
        { contract: callee, functionName: 'price', args: [] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();

    expect(await verdict(compose(hostile))).toBe('accepted');
    expect(await verdict(compose(oracle))).not.toBe('accepted');
  }, 300_000);

  it('never routes a typed call through a stored chain to the chain from before the write', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(FEEDER, BUS);
    const first = await connect(provider, artifacts.Pinger, { pings: 0n });
    const second = await connect(provider, artifacts.Pinger, { pings: 0n });
    const feeder = await connect(provider, artifacts.Feeder, {});
    await (feeder as any).setFeed(lockOf(first)).send();
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const compose = (callee: StatefulContract) => (): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: feeder, functionName: 'retargetThenPing', args: [lockOf(second)] },
        { contract: callee, functionName: 'ping', args: [] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();

    // The handler checks its row where the call runs, which reads the chain again after the write.
    expect(routed(artifacts.Feeder, 'retargetThenPing')).toBe(true);
    expect(await verdict(compose(second))).toBe('accepted');
    expect(await verdict(compose(first))).not.toBe('accepted');
  }, 300_000);

  it('routes a raw call to the written token, and refuses the token from before the write (evmCompat)', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(STORED_PAYER, { ...BUS, evmCompat: true });
    // A bounded raw-call consumer checks its row where the call runs, which reads the token again after the write.
    expect(routed(artifacts.StoredPayer, 'retargetThenPayOut')).toBe(true);
    const first = await connect(provider, artifacts.Token, { moved: 0n });
    const second = await connect(provider, artifacts.Token, { moved: 0n });
    const payer = await connect(provider, artifacts.StoredPayer, { token: lockOf(first), paid: 0n });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const compose = (callee: StatefulContract) => (): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: payer, functionName: 'retargetThenPayOut', args: [lockOf(second), 5n] },
        { contract: callee, functionName: 'transfer', args: [lockOf(payer), 5n] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();

    expect(await verdict(compose(second))).toBe('accepted');
    expect(await verdict(compose(first))).not.toBe('accepted');
  }, 300_000);
});
