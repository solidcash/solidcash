import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Signer, getContractFactory } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { addressToLockScript, lockingBytecodeToSolidityAddressPayload } from '../../../src/utils.js';
import { callPerCallEntry, type PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { compositionEventLogs } from '../../../src/per-call/receipt/index.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A contract admits only the plain contract whose address its constructor stored, on the plain call path.
 *
 * Both contracts are deployed through the factory, without a proxy, and the guarded contract's constructor takes the
 * calling contract's address as its handle reports it (`getAddress()`): `addrV(category)`, the address the calling
 * contract's frames present as `msg.sender` (spec open point 13, plan D9). The factory stores an address argument
 * that names a deployment it registered as the lock that deployment is registered under. A per-call deployment was
 * registered under its handle's lock, the unfilled artifact's, which no frame presents, so the constructor stored that
 * lock and the calling contract's call was refused at the guard. A per-call deployment is registered under its own
 * address, so the stored address is the one the caller's frame states: its call settles, and a user who calls the
 * guarded entry directly is still refused by the guard.
 *
 * Every surface that hands the address back names that same lock: the record's read answers its identity, and an
 * event carries the whole lock, both the caller's `msg.sender` in the callee's event and an address argument packed
 * into a long payload past 128 bytes (`abi.encodePacked(uint160(a))`), each read from the composition's receipt and
 * from the chain's event outputs.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IGuarded {',
  '  function hit(uint256 v) external;',
  '  function note(uint256 id, bytes memory data) external;',
  '}',
  'contract Caller {',
  '  uint256 public pokes;',
  '  function poke(IGuarded g, uint256 v) external { pokes = pokes + 1; g.hit(v); }',
  '  function relay(IGuarded g, uint256 id, bytes memory head, address who, uint256 v) external {',
  '    g.note(id, bytes.concat(head, abi.encodePacked(uint160(who)), abi.encodePacked(v)));',
  '  }',
  '}',
  'contract Guarded {',
  '  Caller public root;',
  '  uint256 public value;',
  '  event Hit(address from, uint256 v);',
  '  event Noted(uint256 indexed id, bytes data);',
  '  constructor(address a) { root = Caller(a); }',
  '  function hit(uint256 v) external {',
  '    require(msg.sender == address(root), "not root");',
  '    value = v;',
  '    emit Hit(msg.sender, v);',
  '  }',
  '  function note(uint256 id, bytes memory data) external {',
  '    require(msg.sender == address(root), "not root");',
  '    emit Noted(id, data);',
  '  }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { solidityImportCompat: true, composition: 'per-call' } as never);
const CALLER: Artifact = artifacts.Caller!;
const GUARDED: Artifact = artifacts.Guarded!;

/** One mock chain with both contracts deployed by one user through the factory. */
interface Chain {
  readonly provider: MockNetworkProvider;
  readonly user: Signer;
  readonly caller: StatefulContract;
  readonly guarded: StatefulContract;
  /** The calling contract's address as its handle reports it, which the guarded constructor took. */
  readonly callerAddress: string;
  /** A fresh coin of the user's. */
  readonly coin: () => Promise<Utxo>;
}

let chainRun: Promise<Chain> | undefined;

function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await fundShippedFacets(provider);
    const user = new Signer(new Uint8Array(32).fill(0xe1), provider);
    let serial = 0;
    const coin = async (): Promise<Utxo> => {
      serial += 1;
      const utxo = { txid: `6c${serial.toString(16).padStart(6, '0')}`.padEnd(64, 'd'), vout: 0, satoshis: 5_000_000n };
      await provider.addUtxo(user.getAddress(), utxo);
      return utxo;
    };
    for (let index = 0; index < 3; index += 1) await coin();
    const caller = await getContractFactory(CALLER, user).deploy() as unknown as StatefulContract;
    const callerAddress = await caller.getAddress();
    const guarded = await getContractFactory(GUARDED, user).deploy(callerAddress) as unknown as StatefulContract;
    return { provider, user, caller, guarded, callerAddress, coin };
  })();
  return chainRun;
}

/** One entry of a deployment, entered by the user's own fresh coin, naming the guarded deployment as a callee. */
async function enter(
  world: Chain, artifact: Artifact, deployed: StatefulContract, functionName: string,
  args: readonly FunctionArgument[],
): Promise<PerCallCallResult> {
  return callPerCallEntry({
    provider: world.provider,
    artifact,
    categoryId: deployed.categoryId,
    functionName,
    args,
    callerUtxo: await world.coin(),
    callerLockingBytecode: world.user.getLockingBytecode(),
    funder: world.user.unlockP2PKH(),
    changeAddress: world.user.getAddress(),
    vm: compositionMachine(),
    externals: { Guarded: { artifact: GUARDED, categoryId: world.guarded.categoryId } },
  });
}

/** A view's value, read from the deployment's records through the read path. */
async function view(world: Chain, artifact: Artifact, deployed: StatefulContract, functionName: string): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: world.provider, artifact, categoryId: deployed.categoryId, functionName, args: [],
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** The 20-byte identity the read path answers for an address, as hex. */
function identityOf(lock: Uint8Array): string {
  return binToHex(lockingBytecodeToSolidityAddressPayload(lock)!);
}

/** A decoded event value's bytes, as hex. */
function hexOf(value: unknown): string {
  return value instanceof Uint8Array ? binToHex(value) : String(value).replace(/^0x/, '').toLowerCase();
}

/** One event's fields as the composition's receipt decodes them from the outputs the frames listed. */
function receiptEvent(result: PerCallCallResult, eventName: string): Record<string, unknown> {
  const logs = compositionEventLogs(result.draft, [CALLER, GUARDED]).filter((log) => log.eventName === eventName);
  expect(logs.map((log) => log.contract)).toStrictEqual(['Guarded']);
  return logs[0]!.args as Record<string, unknown>;
}

/** One event's fields as the guarded deployment's handle reads them back from the chain, for one transaction. */
async function chainEvent(world: Chain, eventName: string, txid: string): Promise<Record<string, unknown>> {
  const handle = world.guarded as unknown as {
    queryFilter: (event: string) => Promise<readonly { readonly args: Record<string, unknown>; readonly txid?: string }[]>;
  };
  const logs = (await handle.queryFilter(eventName)).filter((log) => log.txid === txid);
  expect(logs.length).toBe(1);
  return logs[0]!.args;
}

describe('a plain contract guards an entry with the address of the plain contract that calls it', () => {
  it('stores the address the caller reports, and the caller\'s call settles past the guard', async () => {
    const world = await chain();
    const callerLock = addressToLockScript(world.callerAddress);
    expect(callerLock.length).toBe(35);
    expect(binToHex((await view(world, GUARDED, world.guarded, 'root')) as Uint8Array)).toBe(identityOf(callerLock));

    const guardedLock = addressToLockScript(await world.guarded.getAddress());
    const result = await enter(world, CALLER, world.caller, 'poke', [guardedLock, 7n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    expect(await view(world, GUARDED, world.guarded, 'value')).toBe(7n);
    expect(await view(world, CALLER, world.caller, 'pokes')).toBe(1n);

    // The callee's event carries its caller, the lock the caller's reported address names.
    const txid = result.broadcast!.txid;
    for (const fields of [receiptEvent(result, 'Hit'), await chainEvent(world, 'Hit', txid)]) {
      expect([hexOf(fields.from), fields.v]).toStrictEqual([binToHex(callerLock), 7n]);
    }
  }, 600_000);

  it('refuses a user who calls the guarded entry directly, at the guard, with nothing broadcast', async () => {
    const world = await chain();
    const before = await view(world, GUARDED, world.guarded, 'value');
    const result = await enter(world, GUARDED, world.guarded, 'hit', [9n]);
    expect(result.accepted).toBe(false);
    expect(result.broadcast).toBeUndefined();
    expect(result.verdicts.find((verdict) => verdict.id === 'master')?.objection).toContain('not root');
    expect(await view(world, GUARDED, world.guarded, 'value')).toBe(before);
  }, 600_000);

  it('carries the caller\'s reported address whole inside a long packed payload, to the receipt and the chain', async () => {
    const world = await chain();
    const callerLock = addressToLockScript(world.callerAddress);
    const guardedLock = addressToLockScript(await world.guarded.getAddress());
    // The address is packed 70 bytes in, and the payload runs past 128 bytes, as a long event record does.
    const head = new Uint8Array(70).fill(0x11);
    const result = await enter(world, CALLER, world.caller, 'relay', [guardedLock, 4n, head, world.callerAddress, 5n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    const txid = result.broadcast!.txid;

    for (const fields of [receiptEvent(result, 'Noted'), await chainEvent(world, 'Noted', txid)]) {
      const data = hexOf(fields.data);
      expect(fields.id).toBe(4n);
      expect(data.slice(0, 140)).toBe(binToHex(head));
      expect(data.slice(140, 210)).toBe(binToHex(callerLock));
      expect(data.length / 2).toBeGreaterThan(128);
    }
  }, 600_000);
});
