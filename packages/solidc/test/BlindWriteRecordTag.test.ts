import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildPushdataCommitment, encodeIntegerValue } from '@solidcash/utils';
import { compileString } from '../src/compiler.js';
import { Contract } from '../../solidcash/src/index.js';
import type { Utxo } from '../../solidcash/src/interfaces.js';
import MockNetworkProvider from '../../solidcash/src/network/MockNetworkProvider.js';
import { StatefulContract } from '../../solidcash/src/stateful/index.js';
import { callRecordCommitment, callRecordDigest } from '../../solidcash/src/stateful/call-record.js';
import { createVirtualMachineBch2026ForProvider } from '../../solidcash/src/network/createVirtualMachine.js';
import { expectScriptRejection, setupStatefulUtxos } from '../../solidcash/test/test-util.js';
import { deployFramedMaster, masterSpendProgram, spent } from './framed/master/record-spend.js';

/**
 * A tagged layout's records share one lock and category, so only the leading nftIndex tag tells them apart. An entry
 * that writes every field of a record without reading one must still hold the input it replaces to that record's
 * tag: otherwise a sibling record laid there is consumed and re-created under the written record's tag, and the
 * genuine record stays unspent beside it.
 */

const SOURCE = `pragma solidcash ^0.51.0;
contract Ledger {
  uint8 x;
  uint8 y;
  bigint big;
  function setXY(uint8 p, uint8 q) public { this.x = p; this.y = q; }
  function setBig(bigint v) public { this.big = v; }
}`;

type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Input = Tx['inputs'][number];
type Output = Tx['outputs'][number];
type Provider = MockNetworkProvider;

// P2SH32 of `OP_1`, spent with a push of its redeem script.
const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const FUNDER_UNLOCK = Uint8Array.from([0x01, 0x51]);
const STATE = { x: 1n, y: 2n, big: 3n };

const decode = (hex: string): Tx => decodeTransactionUnsafe(hexToBin(hex));
const encode = (tx: Tx): string => binToHex(encodeTransaction(tx));
const outcomeOf = (provider: Provider, tx: Tx): Promise<string> => provider.sendRawTransaction(encode(tx))
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);
const spends = (input: Input, utxo: Utxo): boolean => binToHex(input.outpointTransactionHash) === utxo.txid
  && input.outpointIndex === utxo.vout;
/** The input spending `utxo`, unlocked as `like` is. */
const spending = (utxo: Utxo, like: Input): Input => ({
  ...like, outpointTransactionHash: hexToBin(utxo.txid), outpointIndex: utxo.vout,
});

async function capture(provider: Provider, run: () => Promise<unknown>): Promise<Tx> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return decode(captured);
}

let funderNonce = 0x6100;

/** A spendable funder of 50,000 satoshis, its input, and the change output a spend returns to it. */
async function funder(provider: Provider, change: bigint): Promise<{ input: Input; change: Output }> {
  const txid = (funderNonce++).toString(16).padStart(64, '0');
  await provider.addUtxo(FUNDER, { txid, vout: 0, satoshis: 50000n });
  return {
    input: { outpointTransactionHash: hexToBin(txid), outpointIndex: 0, sequenceNumber: 0xffffffff,
      unlockingBytecode: FUNDER_UNLOCK },
    change: { lockingBytecode: hexToBin(FUNDER), valueSatoshis: change } as Output,
  };
}

interface Deployed {
  provider: Provider;
  artifact: ReturnType<typeof compileString>;
  ledger: StatefulContract<any>;
  /** The data records in nftIndex order: x and y, then big. */
  records: Utxo[];
}

async function deploy(callBatch: boolean): Promise<Deployed> {
  const artifact = compileString(SOURCE, { messageBus: false, callBatch });
  expect(artifact.stateLayout?.dataNftCount).toBe(2);
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId, dataNftUtxos } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, STATE, { saltContract: true },
  );
  const ledger = StatefulContract.withCategory(contract, categoryId) as StatefulContract<any>;
  return { provider, artifact, ledger, records: dataNftUtxos };
}

/** The honest standalone `setBig(5)`: the master at 0, record 1 at 1, rebuilt at output 1. */
async function blindWrite(d: Deployed): Promise<Tx> {
  const honest = await capture(d.provider, () => (d.ledger as any).setBig(5n).send());
  expect(spends(honest.inputs[1]!, d.records[1]!)).toBe(true);
  expect(honest.inputs.some((input) => spends(input, d.records[0]!))).toBe(false);
  expect(binToHex(honest.outputs[1]!.token!.nft!.commitment))
    .toBe(buildPushdataCommitment(d.artifact.stateLayout!, { ...STATE, big: 5n }, 1));
  return honest;
}

describe('a blind write in a tagged layout', () => {
  it.each([
    ['a direct entry', false],
    ['a frame of the multi-call entry run standalone', true],
  ] as const)('holds %s to the tag of the record it replaces', async (_name, callBatch) => {
    const d = await deploy(callBatch);
    const honest = await blindWrite(d);
    const spend = async (record: Utxo): Promise<Tx> => {
      const pay = await funder(d.provider, 40000n);
      return {
        version: honest.version,
        locktime: honest.locktime,
        inputs: [honest.inputs[0]!, spending(record, honest.inputs[1]!), pay.input],
        outputs: [honest.outputs[0]!, honest.outputs[1]!, pay.change],
      } as Tx;
    };
    // Record 0 under setBig: same lock, category and value as record 1, only its tag differs.
    expectScriptRejection(await outcomeOf(d.provider, await spend(d.records[0]!)), 0);
    expect(await outcomeOf(d.provider, await spend(d.records[1]!))).toBe('ACCEPTED');
    expect(await d.ledger.getState()).toMatchObject({ ...STATE, big: 5n });
  }, 300_000);

  it('holds a blind-writing frame of a multi-call spend to the tag of its record item', async () => {
    const d = await deploy(true);
    const standalone = await blindWrite(d);
    const abiFunction = d.artifact.abi.find((fn) => fn.name === 'setBig')!;
    expect(abiFunction.callBatchRow).toBe(true);
    // Outputs: the master, records 0 and 1, then the frame's call record at output 3.
    // No contract reads the frame's record, so it names no reader.
    const args = abiFunction.inputs.map((input) => (input.name === 'v' ? 5n
      : input.name === '__internal__returnOutputIdx' ? 3n
        : input.name === '__internal__genesisCall' ? new Uint8Array()
          : input.name === '__internal__callRecordReader' ? -1n : 0n));
    const frames = [{ abiFunction, args }];
    const category = standalone.outputs[0]!.token!.category;
    const carrier: Output = {
      lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1000n,
      token: { category, amount: 0n, nft: { capability: 'none',
        commitment: callRecordCommitment(new Uint8Array(0), callRecordDigest(abiFunction, args, {}, 0)!) } },
    } as Output;
    const kept = (utxo: Utxo): Output => ({
      ...standalone.outputs[1]!,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment: hexToBin(utxo.token!.nft!.commitment) } },
    } as Output);
    // The entry loads record item j from input 1 + j; the frame rewrites item 1 and leaves item 0.
    const batch = async (first: Utxo, second: Utxo): Promise<Tx> => {
      const pay = await funder(d.provider, 40000n);
      return {
        version: standalone.version,
        locktime: standalone.locktime,
        inputs: [
          { ...standalone.inputs[0]!, unlockingBytecode: d.ledger.inner.createCallBatchUnlocker(frames)
            .generateUnlockingBytecode({} as never) },
          spending(first, standalone.inputs[1]!),
          spending(second, standalone.inputs[1]!),
          pay.input,
        ],
        outputs: [standalone.outputs[0]!, kept(first), standalone.outputs[1]!, carrier, pay.change],
      } as Tx;
    };
    // The records swapped: item 1 is record 0, which the frame would replace with a second record 1.
    expectScriptRejection(await outcomeOf(d.provider, await batch(d.records[1]!, d.records[0]!)), 0);
    expect(await outcomeOf(d.provider, await batch(d.records[0]!, d.records[1]!))).toBe('ACCEPTED');
    expect(await d.ledger.getState()).toMatchObject({ ...STATE, big: 5n });
  }, 300_000);

  it('holds a framed blind write to the tag of the declared record', () => {
    const deployed = deployFramedMaster(SOURCE, 'blind write record tag');
    const layout = deployed.artifact.stateLayout!;
    expect(layout.dataNftCount).toBe(2);
    const record = (values: typeof STATE, nftIndex: number): Uint8Array => hexToBin(
      buildPushdataCommitment(layout, values, nftIndex),
    );
    const after = record({ ...STATE, big: 5n }, 1);
    const accepts = (before: Uint8Array): true | string => {
      const program = masterSpendProgram(deployed, {
        entry: 'setBig', args: [encodeIntegerValue(5n)], records: [spent(deployed.recordLock, 2, before, after)],
      });
      const vm = createVirtualMachineBch2026ForProvider();
      return vm.stateSuccess(vm.evaluate({ inputIndex: 1, ...program }));
    };
    expect(accepts(record(STATE, 0))).not.toBe(true);
    expect(accepts(record(STATE, 1))).toBe(true);
  });
});
