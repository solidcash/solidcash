import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { FrameKind } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { readSatoshiContainers, satoshiContainerLockingBytecode } from '../../../src/framed/deploy/records.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { alicePriv } from '../../fixture/vars.js';
import {
  USER_LOCK, compileFramed, deployPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A callee frame's send to a user's lock, on the plain call path (`callFramedEntry`).
 *
 * The callee's frame lists the send as the entry lists its own: an output at the recipient's lock, which the body's
 * own pin binds to the lock and amount it computed, led by the paying contract's container or its drained marker.
 * `Forwarder.forward` passes on the value it is entered with, so the value pays the send and the forwarder keeps
 * nothing; `Payer.pay`, two frames below the entry, pays from its own containers and keeps the change. A frame of the
 * entry's own contract that sends, `Desk.give` reached through the desk's own address, is refused by name: the entry's
 * own sends count the same containers.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IForwarder { function forward(address payable to) external payable; }',
  'interface IPayer { function pay(address payable to, uint256 amount) external; }',
  'interface IDesk { function give(address payable to, uint256 amount) external; }',
  'contract Forwarder {',
  '  uint256 public forwarded;',
  '  function forward(address payable to) external payable { forwarded += msg.value; to.transfer(msg.value); }',
  '}',
  'contract Payer {',
  '  uint256 public paid;',
  '  function pay(address payable to, uint256 amount) external { paid += amount; to.transfer(amount); }',
  '}',
  'contract Relay {',
  '  IPayer public payer;',
  '  constructor(IPayer p) { payer = p; }',
  '  function relay(address payable to, uint256 amount) external { payer.pay(to, amount); }',
  '}',
  'contract Desk {',
  '  IForwarder public forwarder;',
  '  Relay public relayer;',
  '  constructor(IForwarder f, Relay r) { forwarder = f; relayer = r; }',
  '  function send(address payable to) external payable { forwarder.forward{value: msg.value}(to); }',
  '  function relayed(address payable to, uint256 amount) external { relayer.relay(to, amount); }',
  '  function give(address payable to, uint256 amount) external { to.transfer(amount); }',
  '  function viaSelf(address payable to, uint256 amount) external { IDesk(address(this)).give(to, amount); }',
  '}',
].join('\n');

const artifacts = compileFramed(SOURCE);

/** A user the callees pay. */
const RECIPIENT = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x45));

interface Chain {
  readonly world: World;
  readonly forwarder: PlainDeployment;
  readonly payer: PlainDeployment;
  readonly relay: PlainDeployment;
  readonly desk: PlainDeployment;
}

let chainRun: Promise<Chain> | undefined;
/** The forwarder, the payer and the relay over it, then the desk over both, each deployed plain. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x6e);
    const forwarder = await deployPlain(world, artifacts.Forwarder!);
    const payer = await deployPlain(world, artifacts.Payer!);
    const relay = await deployPlain(world, artifacts.Relay!, [payer.address]);
    const desk = await deployPlain(world, artifacts.Desk!, [forwarder.address, relay.address]);
    return { world, forwarder, payer, relay, desk };
  })();
  return chainRun;
}

/** One entry of the desk, entered by the user with `value`, which every callee's deployment is named for. */
async function enter(
  c: Chain, functionName: string, args: readonly FunctionArgument[], value?: bigint,
): Promise<FramedCallResult> {
  const callerUtxo = await c.world.userCoin();
  const deployment = (name: keyof Chain & string): Pick<PlainDeployment, 'artifact' | 'categoryId'> => {
    const deployed = c[name] as PlainDeployment;
    return { artifact: deployed.artifact, categoryId: deployed.categoryId };
  };
  return callFramedEntry({
    provider: c.world.network, artifact: c.desk.artifact, categoryId: c.desk.categoryId, functionName,
    args: [...args], callerUtxo, callerLockingBytecode: USER_LOCK,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: c.world.changeAddress,
    vm: compositionMachine(), ...(value === undefined ? {} : { value }),
    externals: { Forwarder: deployment('forwarder'), Payer: deployment('payer'), Relay: deployment('relay') },
  });
}

/** What a settled call pays the recipient's lock, output by output. */
function paidToRecipient(result: FramedCallResult): readonly bigint[] {
  expect(refusedVerdicts(result)).toBeUndefined();
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result.transaction.outputs.filter((output) => binToHex(output.lockingBytecode) === binToHex(RECIPIENT))
    .map((output) => output.valueSatoshis);
}

/** One stored counter of a deployment, read back through the read path. */
async function counter(c: Chain, deployed: PlainDeployment, functionName: string): Promise<unknown> {
  const read = await readFramedEntry({
    provider: c.world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** What a deployment's containers hold. */
async function held(c: Chain, deployed: PlainDeployment): Promise<bigint> {
  const containers = await readSatoshiContainers(c.world.network, deployed.categoryId);
  return containers.reduce((sum, utxo) => sum + utxo.satoshis, 0n);
}

describe('a callee frame that sends to a user\'s lock', () => {
  it('passes on the value it is entered with, keeping nothing in its containers', async () => {
    const c = await chain();
    const result = await enter(c, 'send', [RECIPIENT], 5_000n);
    expect(paidToRecipient(result)).toStrictEqual([5_000n]);
    expect(result.completed.map((frame) => [frame.functionName, frame.kind])).toEqual(expect.arrayContaining([
      ['Desk.send()', FrameKind.ROOT], ['Forwarder.forward()', FrameKind.CALL],
    ]));
    expect(await counter(c, c.forwarder, 'forwarded')).toBe(5_000n);
    expect(await held(c, c.forwarder)).toBe(0n);
  }, 600_000);

  it('pays from its own containers two frames below the entry, keeping the change', async () => {
    const c = await chain();
    // A payment to the payer's container lock is the coin it holds.
    await c.world.network.addUtxo(binToHex(satoshiContainerLockingBytecode(c.payer.categoryId)),
      { txid: '6f'.repeat(32), vout: 0, satoshis: 10_000n });
    const result = await enter(c, 'relayed', [RECIPIENT, 3_000n]);
    expect(paidToRecipient(result)).toStrictEqual([3_000n]);
    expect(result.completed.map((frame) => frame.functionName)).toEqual(expect.arrayContaining([
      'Desk.relayed()', 'Relay.relay()', 'Payer.pay()',
    ]));
    expect(await counter(c, c.payer, 'paid')).toBe(3_000n);
    expect(await held(c, c.payer)).toBe(7_000n);
  }, 600_000);

  it('refuses by name a send from a frame of the entry\'s own contract', async () => {
    const c = await chain();
    await expect(enter(c, 'viaSelf', [RECIPIENT, 1_000n])).rejects.toThrow('the callee "Desk.give()" sends value from '
      + 'the entry\'s own contract "Desk", whose containers the entry\'s own sends count');
  }, 600_000);
});
