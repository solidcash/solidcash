import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hexToBin } from '@bitauth/libauth';
import { INDEX_NONE, bytesToHex, validatorAddress } from '@solidcash/utils';
import { framedValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { participant } from '../../../src/framed/composer/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { dynamicChunkId } from '../../../src/framed/proxy/entry-writes.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A record of a dynamic array whose write shortens it across a chunk boundary, through the proxy hop.
 *
 * `Desk` keeps `Ticket[] tickets`, whose bytes live in a run of chunk records at the array's own collection covenant.
 * `open` appends a ticket holding a 35-byte agent lock and a 26-byte id; `release` reads the ticket, calls the journal
 * and clears both, so the value its body writes needs fewer chunks than the run the deployment holds: three to two,
 * and two to one. The entry's segment before the call holds the run kept, as its read finds it; the one after the
 * call writes the shorter run and consumes every chunk past it with no successor: the chunk is spent on the write
 * path and its index carries a plain output paid to the caller. A later entry reads the shorter run back, and the
 * same transaction with the dropped chunk recreated at its index is refused by the frame, which the validator's
 * census alone would admit there: the segment that held the chunk kept named that index.
 */

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const category = (seed: number): string => binToHex(Uint8Array.from({ length: 32 }, (_unused, index) =>
  (seed * 31 + index * 13) & 0xff));
const JOURNAL_CATEGORY = category(0x29);
const JOURNAL_ADDRESS = validatorAddress(hexToBin(JOURNAL_CATEGORY), VALIDATOR_PROGRAM);

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface IJournal { function note(int id); }',
  'contract Journal { int public notes; function note(int id) { require(this.notes == 0); } }',
  'contract Desk {',
  '  struct Roles { address owner; address agent; }',
  '  struct Ticket { uint8 state; Roles roles; string label; int ticket; }',
  '  address public implementation;',
  '  address public journal;',
  '  Ticket[] tickets;',
  '  function initialize(address j) { this.journal = j; }',
  '  function open(string label, address agent, int ticket) {',
  '    this.tickets.push();',
  '    int id = this.tickets.length - 1;',
  '    this.tickets[id].state = 1;',
  '    this.tickets[id].roles.owner = msg.sender;',
  '    this.tickets[id].roles.agent = agent;',
  '    this.tickets[id].label = label;',
  '    this.tickets[id].ticket = ticket;',
  '  }',
  '  function release(int id) {',
  '    require(this.tickets[id].roles.owner == msg.sender, "not owner");',
  '    IJournal(this.journal).note(id);',
  '    this.tickets[id].roles.agent = address(0);',
  '    this.tickets[id].ticket = 0;',
  '  }',
  '  function settle(int id) {',
  '    require(this.tickets[id].ticket == 0 && this.tickets[id].roles.agent == address(0), "still held");',
  '    this.tickets[id].state = 2;',
  '  }',
  '  function ticketOf(int id) view returns (int) { return this.tickets[id].ticket; }',
  '  function labelOf(int id) view returns (string) { return this.tickets[id].label; }',
  '}',
].join('\n');

const ARTIFACTS = compileStringMulti(SOURCE, { composition: 'framed' });
const DESK = ARTIFACTS.Desk!;
const JOURNAL = ARTIFACTS.Journal!;
const CALLER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
/** A 35-byte lock, so clearing the agent takes its bytes out of the record. */
const AGENT = encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(0x5a));
/** An id of 26 bytes in its minimal encoding. */
const TICKET = 2n ** 200n + 12_345n;

type Machine = ReturnType<typeof compositionMachine>;
type Outputs = FramedProxyCallResult['transaction']['outputs'];

/** The desk deployed behind its generated proxy, a function that calls one of its entries, and its live run. */
async function proxiedDesk(seed: number): Promise<{
  readonly call: (entry: string, args: readonly unknown[]) => Promise<FramedProxyCallResult>;
  readonly read: (entry: string, args: readonly unknown[]) => Promise<unknown>;
  readonly liveChunks: () => Promise<number>;
}> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const journalFunding = { txid: JOURNAL_CATEGORY, vout: 0, satoshis: 500_000n };
  await network.addUtxo(wallet.address, journalFunding);
  await deployStatefulContract(JOURNAL, [], {
    fundingUtxo: journalFunding, funder, changeAddress: wallet.address, provider: network,
  });
  await fundShippedFacets(network);
  let serial = seed;
  const coin = async (): Promise<{ txid: string; vout: number; satoshis: bigint }> => {
    serial += 1;
    const utxo = { txid: category(serial), vout: 0, satoshis: 300_000n };
    await network.addUtxo(binToHex(CALLER_LOCK), utxo);
    return utxo;
  };
  const implementationFunding = { txid: category(seed + 100), vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: category(seed + 101), vout: 0, satoshis: 500_000n };
  for (const utxo of [implementationFunding, proxyFunding]) await network.addUtxo(wallet.address, utxo);
  const signature = new SignatureTemplate(alicePriv);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: DESK,
    proxyArtifact: buildProxyArtifact(DESK),
    implementationDeploy: { fundingUtxo: implementationFunding, funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [JOURNAL_ADDRESS] },
    callerLockingBytecode: CALLER_LOCK,
    callerFunding: { utxo: await coin(), funder: signature.unlockP2PKH(), changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  const proxyCategoryId = deployment.proxy.categoryId;
  return {
    call: async (entry, args) => callFramedProxyEntry({
      provider: network,
      implementationArtifact: DESK,
      proxyArtifact: buildProxyArtifact(DESK),
      proxyCategoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: entry,
      args: args as never,
      externals: { IJournal: { artifact: JOURNAL, categoryId: JOURNAL_CATEGORY } },
      callerUtxo: await coin(),
      callerLockingBytecode: CALLER_LOCK,
      funder: signature.unlockP2PKH(),
      changeAddress: wallet.address,
      vm: compositionMachine(),
    }),
    read: async (entry, args) => {
      const answered = await readFramedEntry({
        provider: network, artifact: DESK, categoryId: proxyCategoryId, functionName: entry, args: [...args] as never,
        vm: compositionMachine(),
      });
      expect(answered.accepted, answered.objection).toBe(true);
      return answered.value;
    },
    // The desk holds no mapping, so every chunk its proxy's category holds is one of the run's.
    liveChunks: async () => (await readFramedDeployment(network, proxyCategoryId, DESK.stateLayout!)).chunks.length,
  };
}

/** The ids of the verdicts the machine refused, with their objections. */
const refusals = (verdicts: readonly { id: string; accepted: boolean; objection?: string }[]): string[] =>
  verdicts.filter((verdict) => !verdict.accepted).map((verdict) => `${verdict.id}: ${verdict.objection ?? ''}`);

/** The machine's verdict on one participant's input of a settled hop, with its outputs optionally rewritten. */
function verdictOf(result: FramedProxyCallResult, id: string, mutate?: (outputs: Outputs) => Outputs): string {
  const machine: Machine = compositionMachine();
  const state = machine.evaluate({
    inputIndex: participant(result.draft.layout, id).index,
    sourceOutputs: result.sourceOutputs,
    transaction: { ...result.transaction, outputs: mutate?.(result.transaction.outputs) ?? result.transaction.outputs },
  });
  return machine.stateSuccess(state) === true ? 'accepted' : `refused: ${String(state.error)}`;
}

/** A record of the desk whose release takes its run from `before` chunks to `after`, through the hop. */
async function shortened(seed: number, label: string, before: number, after: number): Promise<void> {
  const desk = await proxiedDesk(seed);
  const opened = await desk.call('open', [label, AGENT, TICKET]);
  expect(refusals(opened.verdicts)).toStrictEqual([]);
  expect(opened.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(await desk.liveChunks()).toBe(before);

  const released = await desk.call('release', [0n]);
  expect(refusals(released.verdicts)).toStrictEqual([]);
  expect(released.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(await desk.liveChunks()).toBe(after);
  // Every chunk past the written width is spent and its index carries a plain output to the caller, holding the
  // chunk's own satoshis; the segment after the call declares it consumed with no output.
  const implementation = released.draft.blockOf('implementation-master');
  for (let chunk = after; chunk < before; chunk += 1) {
    const index = participant(released.draft.layout, dynamicChunkId('tickets', chunk)).index;
    const source = released.sourceOutputs[index]!;
    const output = released.transaction.outputs[index]!;
    expect(source.token?.nft?.capability).toBe('mutable');
    expect(output.token).toBeUndefined();
    expect(bytesToHex(output.lockingBytecode)).toBe(bytesToHex(CALLER_LOCK));
    expect(output.valueSatoshis).toBe(source.valueSatoshis);
    const declared = implementation.segments.map((segment) => segment.find((entry) => entry.in === index));
    expect(declared.map((entry) => entry?.out)).toStrictEqual([index, INDEX_NONE]);
  }

  // The dropped chunk recreated at its index is a successor no declaration settles: the frame refuses it, while the
  // validator, whose census admits an index the held segment names, does not.
  const index = participant(released.draft.layout, dynamicChunkId('tickets', before - 1)).index;
  const recreated = (outputs: Outputs): Outputs => outputs.map((output, at) => (at === index
    ? { ...released.sourceOutputs[at]! } as Outputs[number] : output));
  expect(verdictOf(released, 'implementation-master')).toBe('accepted');
  expect(verdictOf(released, 'implementation-master', recreated)).toContain('refused');
  expect(verdictOf(released, 'validator', recreated)).toBe('accepted');

  // The shorter run reads back: an entry that requires the cleared fields settles, and the read path decodes them.
  const settled = await desk.call('settle', [0n]);
  expect(refusals(settled.verdicts)).toStrictEqual([]);
  expect(settled.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(await desk.liveChunks()).toBe(after);
  expect(await desk.read('ticketOf', [0n])).toBe(0n);
  expect(await desk.read('labelOf', [0n])).toBe(label);
}

describe('a dynamic array record whose write shortens its run, through the hop', () => {
  it('releases a ticket from three chunks to two, then reads it back', async () => {
    await shortened(0x40, 'r'.repeat(170), 3, 2);
  }, 600_000);

  it('releases a ticket from two chunks to one, then reads it back', async () => {
    await shortened(0x60, 's'.repeat(50), 2, 1);
  }, 600_000);
});
