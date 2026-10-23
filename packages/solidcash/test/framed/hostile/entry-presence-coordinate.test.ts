import { describe, expect, it } from 'vitest';
import { binToHex, utf8ToBin } from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import {
  deployFramedMaster, evaluateMasterSpend, node, spent,
} from '../../../../solidc/test/framed/master/record-spend.js';
import { Contract, SignatureTemplate, type TransactionBuilder } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { compileString } from '../../direct-compile.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * An entry's presence gates the check that holds its input to the contract's category and the mutable capability,
 * so a coordinate that names no input must not read as absent.
 *
 * A framed frame reads the entry at the coordinate its own block declares. The one coordinate it reads as absent is
 * the no-index sentinel a node an earlier frame created carries; any other is read at the input it names, so one
 * naming no input fails. Before that, `0x8001` (-1) read as absent: settlement never visits a negative index, so the
 * body took the declared view as the entry with no entry spent. The head now refuses any declared index the
 * transaction does not have before a body reads it (`declared-coordinate-range.test.ts`). A direct frame reads
 * presence at its fixed slot.
 */

const WHO = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x33), 0x88, 0xac]);
const ALLOWED = node(keyToSlot(WHO), new Uint8Array(32), new Uint8Array([1]));

const FRAMED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Gate {'
  + '   mapping(address => uint) allowed;'
  + '   uint claims;'
  + '   function claim(address who) {'
  + '     require(allowed[who] == 1, "not allowed");'
  + '     claims = claims + 1;'
  + '   }'
  + ' }';

describe('a framed frame reads an entry\'s presence at its declared coordinate', () => {
  const gate = deployFramedMaster(FRAMED_SOURCE, 'entry presence coordinate');
  const claims = (count: bigint): Uint8Array => gate.record({ claims: count });
  const recordSpent = spent(gate.recordLock, 2, claims(0n), claims(1n));

  it('accepts the entry spent at the input its declaration names', () => {
    const verdict = evaluateMasterSpend(gate, {
      args: [WHO], records: [recordSpent, spent(gate.collectionLock('allowed'), 3, ALLOWED)],
    });
    expect(verdict.accepted, verdict.objection).toBe(true);
  });

  it('refuses the entry declared at a coordinate that names no input, with no entry spent', () => {
    const verdict = evaluateMasterSpend(gate, {
      args: [WHO],
      records: [recordSpent],
      declared: [
        { in: 2, out: 2, viewIn: claims(0n), viewOut: claims(1n) },
        { in: 0x8001, out: 0x8001, viewIn: ALLOWED, viewOut: ALLOWED },
      ],
    });
    expect(verdict.accepted).toBe(false);
    // The head's walk refuses the index before the body reads presence there.
    expect(verdict.objection).toBe('Program failed an OP_VERIFY operation.');
  });
});

const DIRECT_SOURCE = `pragma solidcash >=0.8.0;
contract Gate() {
  mapping(address => uint256) allowed;
  uint256 claims;
  function allow(address who) { this.allowed[who] = 1; }
  function claim(address who) { require(this.allowed[who] == 1, "not allowed"); this.claims = this.claims + 1; }
}`;

describe('a direct frame reads an entry\'s presence at its fixed slot', () => {
  const provider = new MockNetworkProvider();
  const artifact = compileString(DIRECT_SOURCE);
  let deployments = 0;

  /** A claim over a gate that allowed `WHO`: the master, its record, then the entry, each recreated in place. */
  async function claimSpend(): Promise<{ builder: TransactionBuilder; entryIndex: number; masterIndex: number }> {
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    deployments += 1;
    const txid = binToHex(sha256(utf8ToBin(`entry presence coordinate ${deployments}`)));
    const fundingUtxo = { txid, vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    const { contract: gate } = await deployStatefulContract(artifact, [], {
      provider,
      fundingUtxo,
      funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: funder.address,
    });
    await gate.allow(WHO).send();
    const builder = await gate.call.claim(WHO).build();
    const entryIndex = builder.inputs.findIndex((input) =>
      input.token?.nft?.commitment.startsWith(binToHex(keyToSlot(WHO))) === true);
    const masterIndex = builder.inputs.findIndex((input) => input.token?.nft?.capability === 'minting');
    expect(entryIndex).toBeGreaterThan(masterIndex);
    return { builder, entryIndex, masterIndex };
  }

  /** The machine's verdict on one input of the built transaction. */
  function accepts(builder: TransactionBuilder, inputIndex: number): boolean {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    return vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
  }

  it('accepts the entry spent at its slot', async () => {
    const { builder } = await claimSpend();
    expect(builder.inputs.every((_input, index) => accepts(builder, index))).toBe(true);
  }, 120_000);

  it('refuses the entry re-minted under another category at the same lock, and the entry left out', async () => {
    const changed = await claimSpend();
    const entry = changed.builder.inputs[changed.entryIndex]!;
    const recreated = changed.builder.outputs[changed.entryIndex]!;
    expect(recreated.token?.nft?.commitment).toBe(entry.token!.nft!.commitment);
    const foreign = binToHex(sha256(utf8ToBin('entry presence coordinate foreign category')));
    entry.token = { ...entry.token!, category: foreign };
    recreated.token = { ...recreated.token!, category: foreign };
    expect(accepts(changed.builder, changed.masterIndex)).toBe(false);

    const unsupplied = await claimSpend();
    unsupplied.builder.inputs.splice(unsupplied.entryIndex, 1);
    expect(accepts(unsupplied.builder, unsupplied.masterIndex)).toBe(false);
  }, 120_000);
});
