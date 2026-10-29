import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { framedValidator } from '@solidcash/solidc/runtime';
import { compileString } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { eventChunkLockingBytecode } from '../../../src/framed/deploy/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A framed event whose payload can outgrow one NFT commitment, on a chain that holds commitments to 128 bytes.
 *
 * `Swap` carries two addresses and four `uint` words, wider than 128 bytes at its widest, so the frame lists two outputs
 * for it: the first 128 bytes of the payload at the event covenant and the rest at its continuation covenant. `Created`
 * is as wide at its widest, but the locks its addresses carry here fit its payload in the first chunk, so its second
 * output is empty. A narrower event emitted after both takes the output after their chunks. The receipt joins the
 * chunks back into the events the body emitted, and a `Swap` the body skips lists both outputs with the empty
 * commitment.
 */

const SOURCE = `pragma solidity ^0.8.0;
contract Pool {
  uint public total;
  event Swap(address indexed sender, uint a0, uint a1, uint b0, uint b1, address indexed to);
  event Created(address indexed a, address indexed b, address c, uint n);
  event Note(uint value);
  function go(uint a, address to) public {
    total = total + a;
    if (a > 1) emit Swap(msg.sender, a * 2 ** 200, a + 1, a + 2, a + 3, to);
    emit Created(msg.sender, to, to, a);
    emit Note(a);
  }
}`;

const artifact = compileString(SOURCE, {
  composition: 'framed', suppressWarnings: true, evmCompat: true, forceStateful: true, commitmentLimit: 128,
});
const VALIDATOR = framedValidator.buildValidatorProgram();
const LIMITS = {
  maximumInputBytes: 10_000_000, maximumStackItemBytes: 10_000_000, maximumTransactionBytes: 100_000_000,
  maximumNftCommitmentBytes: 128, operationCostBudgetPerByte: 1_000_000,
};

let nonce = 0x7400;
function freshCoin(satoshis: bigint): Utxo {
  nonce += 1;
  return { txid: nonce.toString(16).padStart(64, '0'), vout: 0, satoshis };
}

async function deployAndCall(a: bigint): Promise<{ result: FramedCallResult; category: Uint8Array }> {
  const provider = new MockNetworkProvider({ consensusLimits: LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const funding = freshCoin(800_000n);
  await provider.addUtxo(binToHex(callerLock), funding);
  const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
  if (typeof encoded === 'string') throw new Error(encoded);
  const { categoryId } = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo: funding, funder: signature.unlockP2PKH(), changeAddress: encoded.address,
    threadCount: 1, validatorCount: 1,
  });
  const callerUtxo = freshCoin(300_000n);
  await provider.addUtxo(binToHex(callerLock), callerUtxo);
  const result = await callFramedEntry({
    provider, artifact, categoryId, functionName: 'go', args: [a, callerLock], callerUtxo,
    callerLockingBytecode: callerLock, funder: signature.unlockP2PKH(), validatorProgram: VALIDATOR,
    vm: createVirtualMachineBch2026ForProvider(provider, undefined, { standard: false }),
  });
  return { result, category: Uint8Array.from(Buffer.from(categoryId, 'hex')) };
}

const objections = (result: FramedCallResult): string => result.verdicts.filter((verdict) => !verdict.accepted)
  .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');

describe('a framed event wider than one commitment', () => {
  it('publishes the wide emit as two chunks', () => {
    const go = artifact.abi.find((entry) => entry.name === 'go')!;
    expect(go.emits?.map((emit) => [emit.eventName, emit.chunks]))
      .toStrictEqual([['Swap', 2], ['Created', 2], ['Note', undefined]]);
  });

  it('settles the payload across the event and continuation outputs, and the receipt joins them', async () => {
    const { result, category } = await deployAndCall(5n);
    expect(result.accepted, objections(result)).toBe(true);
    const listed = result.draft.blockOf('master').events;
    expect(listed).toHaveLength(5);
    const [head, tail, created, createdTail, note] = listed.map((index) => result.transaction.outputs[index]!);
    expect(head!.token!.nft!.commitment.length).toBe(128);
    expect(tail!.token!.nft!.commitment.length).toBeGreaterThan(0);
    expect(binToHex(tail!.lockingBytecode))
      .toBe(binToHex(eventChunkLockingBytecode(category, 'Swap(address,uint256,uint256,uint256,uint256,address)', false, 1)));
    expect(created!.token!.nft!.commitment.length).toBeLessThan(128);
    expect(createdTail!.token!.nft!.commitment.length).toBe(0);
    expect(note!.token!.nft!.commitment.length).toBeGreaterThan(0);
    const logs = compositionEventLogs(result.draft, [artifact], { validatorProgram: VALIDATOR });
    expect(logs.map((log) => log.eventName)).toStrictEqual(['Swap', 'Created', 'Note']);
    expect(logs[0]!.values.slice(1, 5)).toStrictEqual([5n * 2n ** 200n, 6n, 7n, 8n]);
    expect(logs[1]!.values[3]).toBe(5n);
    expect(logs[2]!.values).toStrictEqual([5n]);
  }, 600_000);

  it('lists both chunks of a skipped wide emit with the empty commitment', async () => {
    const { result } = await deployAndCall(1n);
    expect(result.accepted, objections(result)).toBe(true);
    const listed = result.draft.blockOf('master').events;
    expect(listed.map((index) => result.transaction.outputs[index]!.token!.nft!.commitment.length))
      .toStrictEqual([0, 0, expect.any(Number), 0, expect.any(Number)]);
    expect(compositionEventLogs(result.draft, [artifact], { validatorProgram: VALIDATOR }).map((log) => log.eventName))
      .toStrictEqual(['Created', 'Note']);
  }, 600_000);
});
