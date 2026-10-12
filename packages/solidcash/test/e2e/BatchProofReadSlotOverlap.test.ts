import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, cashAddressToLockingBytecode, decodeAuthenticationInstructions, decodeTransactionUnsafe,
  encodeAuthenticationInstructionsMaybeMalformed, encodeDataPush, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import {
  buildEntryNftCovenantScript, computeCollectionHash, scriptToBytecode,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { decodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';

/**
 * A sorted-batch census counts each target's proof input once and a pure-read slot's fixed input once more when it
 * holds a node of the collection. A proof witness naming the read slot's input counts one physical input twice,
 * which leaves room for a collection input no per-position check covers. The covenant refuses a proof input that is
 * also a pure-read slot's input.
 *
 * The forged spend moves the updated node to the read slot's input (recreated there unchanged, as the untaken read's
 * preservation asks), points the proof at it, and spends a victim node at the target's own input, sending the
 * victim's NFT out of the collection. The mock injects the funder directly.
 */

const SOURCE = `contract BatchProofReadSlot {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function writeRead(int k, int v, int r, int sel) external {
    m[k] = v;
    if (sel > 0) { require(m[r] > 0); }
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const TARGET = 7n;
const VICTIM = 9n;
const READ_KEY = 11n;
const PROOF = /^__internal__vmapBatchProof_(\d+)$/;
const slotOf = (key: bigint): string => binToHex(keyToSlot(bigIntToVmNumber(key)));
const pushOf = (value: number): Uint8Array => encodeDataPush(bigIntToVmNumber(BigInt(value)));
const randomTxid = (): string => (0x8000 + Math.floor(Math.random() * 0x7fff)).toString(16).padStart(64, '0');

interface Deployed {
  provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string;
  inputs: readonly { name: string }[]; proofName: string; targetIndex: number; readIndex: number;
}

async function deploy(): Promise<Deployed> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const pinned = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
  const fn = artifact.abi.find((candidate) => candidate.name === 'writeRead')!;
  const proofs = fn.inputs.filter((input) => PROOF.test(input.name));
  expect(proofs).toHaveLength(1);
  const target = Number(PROOF.exec(proofs[0].name)![1]);
  const entries = fn.blockLayout!.slots.filter((slot) => slot.kind === 'entry');
  expect(entries).toHaveLength(2);
  const targetIndex = entries.find((slot) => slot.slotIndex === target)!.offset;
  const readIndex = entries.find((slot) => slot.slotIndex !== target)!.offset;
  const sc = StatefulContract.withCategory(contract, categoryId);
  await sc.getFunction('set')(TARGET, 50n).send();
  await sc.getFunction('set')(VICTIM, 60n).send();
  await sc.getFunction('set')(READ_KEY, 70n).send();
  return {
    provider, sc, pinned, cat: categoryId, inputs: fn.inputs, proofName: proofs[0].name, targetIndex, readIndex,
  };
}

async function capture(provider: Provider, run: () => Promise<unknown>): Promise<string> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return captured;
}

/** The honest update of TARGET with the read untaken, forged so its proof names the read slot's input. */
async function proofAtReadSlot(deployed: Deployed, hex: string): Promise<string> {
  const { provider, pinned, cat, inputs, proofName, targetIndex, readIndex } = deployed;
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  const address = getEntryNftAddress(pinned, cat, 'm');
  const lock = (cashAddressToLockingBytecode(address) as { bytecode: Uint8Array }).bytecode;
  const redeem = scriptToBytecode(buildEntryNftCovenantScript(hexToBin(cat),
    computeCollectionHash('m:mapping(int256 => int256)')));
  const nodes = await provider.getUtxos(address);
  const nodeOf = (key: bigint): (typeof nodes)[number] => nodes.find((u) => binToHex(
    decodeEntryCommitment(hexToBin(u.token!.nft!.commitment)).slot) === slotOf(key))!;
  const target = nodeOf(TARGET);
  const victim = nodeOf(VICTIM);
  const spent = tx.inputs[targetIndex];
  expect([binToHex(spent.outpointTransactionHash), spent.outpointIndex]).toEqual([target.txid, target.vout]);
  const category = tx.outputs[targetIndex].token!.category.slice();

  // The master's unlocking bytecode is [selector?, arg n-1 .. arg 0, redeem]: the proof names the read slot.
  const instructions = decodeAuthenticationInstructions(tx.inputs[0].unlockingBytecode);
  const at = instructions.length - 2 - inputs.findIndex((input) => input.name === proofName);
  expect(binToHex(encodeAuthenticationInstructionsMaybeMalformed([instructions[at]])))
    .toBe(binToHex(pushOf(targetIndex)));
  instructions[at] = decodeAuthenticationInstructions(pushOf(readIndex))[0];
  tx.inputs[0] = { ...tx.inputs[0], unlockingBytecode: encodeAuthenticationInstructionsMaybeMalformed(instructions) };

  // The updated node sits at the read slot and is recreated there unchanged.
  tx.inputs[readIndex] = { ...spent };
  tx.outputs[readIndex] = {
    lockingBytecode: lock, valueSatoshis: target.satoshis,
    token: { amount: 0n, category, nft: { capability: 'mutable', commitment: hexToBin(target.token!.nft!.commitment) } },
  } as any;
  // The victim takes the target's own input and leaves the collection.
  tx.inputs[targetIndex] = {
    outpointTransactionHash: hexToBin(victim.txid), outpointIndex: victim.vout, sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([0x00, 0x51, ...encodeDataPush(redeem)]),
  };
  tx.outputs.push({
    lockingBytecode: hexToBin(FUNDER), valueSatoshis: victim.satoshis,
    token: { amount: 0n, category: category.slice(),
      nft: { capability: 'mutable', commitment: hexToBin(victim.token!.nft!.commitment) } },
  } as any);

  const funderTxid = randomTxid();
  await (provider as any).addUtxo(FUNDER, { txid: funderTxid, vout: 0, satoshis: 40000n });
  tx.inputs.push({
    outpointTransactionHash: hexToBin(funderTxid), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([0x01, 0x51]),
  });
  tx.outputs.push({ lockingBytecode: hexToBin(FUNDER), valueSatoshis: 25000n });
  return binToHex(encodeTransaction(tx as Tx));
}

const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);

describe('sorted batch census: a proof input is never a pure-read slot input', () => {
  it('settles a batch write beside a read of another key, with the read taken and not taken', async () => {
    const { sc } = await deploy();
    await sc.getFunction('writeRead')(TARGET, 55n, READ_KEY, 1n).send();
    await expect(sc.getFunction('check')(TARGET, 55n).send()).resolves.toBeDefined();
    await sc.getFunction('writeRead')(TARGET, 56n, READ_KEY, 0n).send();
    await expect(sc.getFunction('check')(TARGET, 56n).send()).resolves.toBeDefined();
    await sc.getFunction('writeRead')(8n, 5n, READ_KEY, 0n).send();
    await expect(sc.getFunction('check')(8n, 5n).send()).resolves.toBeDefined();
    await sc.getFunction('writeRead')(12n, 6n, READ_KEY, 1n).send();
    await expect(sc.getFunction('check')(12n, 6n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(READ_KEY, 70n).send()).resolves.toBeDefined();
  }, 300_000);

  // The funder is injected into the mock's UTXO set.
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))(
    'refuses a proof witness that names the read slot input', async () => {
      const deployed = await deploy();
      const { provider, sc } = deployed;
      const hex = await capture(provider, () => sc.getFunction('writeRead')(TARGET, 55n, READ_KEY, 0n).send());
      expectScriptRejection(await outcomeOf(provider, await proofAtReadSlot(deployed, hex)), 0);

      await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
      await expect(sc.getFunction('check')(VICTIM, 60n).send()).resolves.toBeDefined();
      await expect(sc.getFunction('check')(TARGET, 55n).send()).resolves.toBeDefined();
    }, 300_000,
  );
});
