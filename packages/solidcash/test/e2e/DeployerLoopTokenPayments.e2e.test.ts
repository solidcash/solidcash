/**
 * A runtime loop's token and NFT payments in a creating call (A14 item 4).
 *
 * The creator pays from its token container in a runtime loop after a loop of deployer `new`s. As the call path does,
 * the SDK plans the payments from the loop's bound and reads each recipient, amount, commitment and capability from the
 * creator's run; they sit in the runtime effect span after the last child's genesis group (B8.9), and the container is
 * recreated with what they leave. Each creation is checked with stock libauth's standard VM, honest and tampered.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const bobLock = binToHex(encodeLockingBytecodeP2pkh(bobPkh));
const alice = new SignatureTemplate(alicePriv);

type Spend = { transaction: any; sourceOutputs: any[] };

const CHILD = 'contract Child(int x) { int n; constructor() { n = x; } function bump() { this.n = this.n + 1; } }';

/** Pays fungible tokens from a runtime loop after a loop of `new`, with an optional fixed transfer between them. */
const FT_SOURCE = (fixed: boolean): string => `${CHILD}
  contract Factory { int made;
    function make(int k, int a, bytes32 cat, bytes20 to) {
      for (int i = 0; i < k; i++) { new Child{args: (a + i)}(); }
      ${fixed ? 'this.tokens[cat].transfer(new LockingBytecodeP2PKH(to), 3);' : ''}
      for (int j = 0; j < k; j++) { this.tokens[cat].transfer(new LockingBytecodeP2PKH(to), 10 + j); }
      this.made = this.made + k;
    }
  }`;

/** Mints an NFT from a minting container in a runtime loop after a loop of `new`. */
const NFT_SOURCE = `${CHILD}
  contract Factory { int made;
    function make(int k, int a, bytes32 cat, bytes20 to) {
      for (int i = 0; i < k; i++) { new Child{args: (a + i)}(); }
      for (int j = 0; j < k; j++) { this.tokens[cat].transferNft(new LockingBytecodeP2PKH(to), bytes(j + 7), 0); }
      this.made = this.made + k;
    }
  }`;

type Container = { amount: bigint; nft?: { capability: 'none' | 'mutable' | 'minting'; commitment: string } };

async function create(source: string, container: Container, k: bigint, fixedTransfer = false): Promise<{
  run: () => ReturnType<typeof StatefulContract.deployFrom>; captured: Spend[]; categoryId: string;
  slotOffset: number; stride: number;
}> {
  clearGenesisReservations();
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured: Spend[] = [];
  const send = provider.sendRawTransaction.bind(provider);
  provider.sendRawTransaction = async (hex: string) => {
    const transaction = decodeTransaction(hexToBin(hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('a spent coin is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    const txid = await send(hex);
    captured.push({ transaction, sourceOutputs });
    return txid;
  };
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifacts = compileStringMulti(source, { allowUnsafeOperations: true } as never);
  const funding: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const deployed = await StatefulContract.deploy(artifacts.Factory, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: { made: 0n },
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  const containerAddress = (category: string): string => getTokenContainerAddress(
    deployed.contract.inner as never, deployed.categoryId, category,
  );
  const { categoryId } = await provider.addTokenUtxosDynamic((category) => [{
    address: containerAddress(category), satoshis: 1200n, token: container,
  }]);
  const prep: Utxo = { txid: 'e2'.repeat(32), vout: 0, satoshis: 400_000n };
  await provider.seedUtxo(binToHex(aliceLock), prep);
  const run = (): ReturnType<typeof StatefulContract.deployFrom> => StatefulContract.deployFrom({
    provider, factory: deployed.contract, deployFunctionName: 'make',
    deployFunctionArgs: [k, 5n, categoryId, bobPkh] as never,
    childArtifact: artifacts.Child, fundingUtxo: prep, funder: alice.unlockP2PKH(), changeAddress: change.address,
    ...(fixedTransfer
      ? { childTokenTransfers: [{ categoryId, to: hexToBin(bobLock), amount: 3n }] }
      : {}),
  });
  const make = artifacts.Factory.abi.find((entry) => entry.name === 'make')!;
  const slot = make.blockLayout!.slots.find((candidate) => candidate.kind === 'deploy')!;
  return {
    run, captured, categoryId,
    slotOffset: slot.offset, stride: artifacts.Factory.childDeployers!.Child!.genesisOutputs,
  };
}

/** Signs the wallet's P2PKH inputs again, as a builder signs its own transaction, and asks the standard VM. */
function verify(spend: Spend): true | string {
  const copy: Spend = structuredClone(spend);
  copy.transaction.inputs.forEach((_input: unknown, inputIndex: number) => {
    if (binToHex(copy.sourceOutputs[inputIndex].lockingBytecode) !== binToHex(aliceLock)) return;
    copy.transaction.inputs[inputIndex].unlockingBytecode = alice.unlockP2PKH().generateUnlockingBytecode({
      transaction: copy.transaction, sourceOutputs: copy.sourceOutputs, inputIndex,
    });
  });
  return vm.verify(copy as never) as true | string;
}

/** True when the creator's input, input 0, passes on its own. */
const creatorPasses = (spend: Spend): boolean => vm.stateSuccess(
  vm.evaluate({ ...structuredClone(spend), inputIndex: 0 } as never),
) === true;

const categoryOf = (output: any): string => (output.token === undefined ? '' : binToHex(output.token.category));

/** The output that recreates the container: its category, at a lock no payment uses. */
const containerOutput = (spend: Spend, category: string): number => spend.transaction.outputs.findIndex(
  (output: any) => categoryOf(output) === category && binToHex(output.lockingBytecode) !== bobLock,
);

describe('A14 item 4: a runtime loop\'s token payments in a creating call', () => {
  it('pays fungible tokens after a loop of `new`, from the run, and keeps the rest in the container', async () => {
    const { run, captured, categoryId, slotOffset, stride } = await create(FT_SOURCE(false), { amount: 1000n }, 2n);
    const result = await run();
    expect(result.children).toHaveLength(2);
    const creation = captured[captured.length - 1]!;
    expect(verify(creation)).toBe(true);

    // The span starts after the second child's group: two payments of 10 and 11 tokens to `to`.
    const spanBase = slotOffset + 2 * stride;
    const payments = [spanBase, spanBase + 1];
    expect(payments.map((index) => binToHex(creation.transaction.outputs[index].lockingBytecode)))
      .toEqual([bobLock, bobLock]);
    expect(payments.map((index) => creation.transaction.outputs[index].token.amount)).toEqual([10n, 11n]);
    const kept = containerOutput(creation, categoryId);
    expect(creation.transaction.outputs[kept].token.amount).toBe(979n);

    // One token moved from the container to a payment: the payment differs from the creator's record.
    const overpaid: Spend = structuredClone(creation);
    overpaid.transaction.outputs[payments[1]!].token.amount += 1n;
    overpaid.transaction.outputs[kept].token.amount -= 1n;
    expect(creatorPasses(overpaid)).toBe(false);
    // One token moved from the container to a new output of the wallet's: the container keeps too little.
    const skimmed: Spend = structuredClone(creation);
    skimmed.transaction.outputs[kept].token.amount -= 1n;
    skimmed.transaction.outputs.push({
      lockingBytecode: aliceLock, valueSatoshis: 1000n,
      token: { category: hexToBin(categoryId), amount: 1n },
    });
    skimmed.transaction.outputs[skimmed.transaction.outputs.length - 2].valueSatoshis -= 1000n;
    expect(creatorPasses(skimmed)).toBe(false);
  }, 600_000);

  it('pays a fixed token transfer and a runtime loop\'s payments from one container', async () => {
    const { run, captured, categoryId } = await create(FT_SOURCE(true), { amount: 1000n }, 2n, true);
    await run();
    const creation = captured[captured.length - 1]!;
    expect(verify(creation)).toBe(true);
    const paid = creation.transaction.outputs.filter((output: any) => binToHex(output.lockingBytecode) === bobLock)
      .map((output: any) => output.token.amount);
    expect(paid).toEqual([3n, 10n, 11n]);
    expect(creation.transaction.outputs[containerOutput(creation, categoryId)].token.amount).toBe(976n);
  }, 600_000);

  it('mints an NFT per run of a runtime loop from a minting container, after a loop of `new`', async () => {
    const { run, captured, categoryId, slotOffset, stride } = await create(
      NFT_SOURCE, { amount: 0n, nft: { capability: 'minting', commitment: '' } }, 2n,
    );
    const result = await run();
    expect(result.children).toHaveLength(2);
    const creation = captured[captured.length - 1]!;
    expect(verify(creation)).toBe(true);
    const spanBase = slotOffset + 2 * stride;
    const minted = [spanBase, spanBase + 1].map((index) => creation.transaction.outputs[index]);
    expect(minted.map((output: any) => binToHex(output.lockingBytecode))).toEqual([bobLock, bobLock]);
    expect(minted.map((output: any) => categoryOf(output))).toEqual([categoryId, categoryId]);
    expect(minted.map((output: any) => [output.token.nft.capability, binToHex(output.token.nft.commitment)]))
      .toEqual([['none', '07'], ['none', '08']]);
    // The container keeps its minting NFT.
    expect(creation.transaction.outputs[containerOutput(creation, categoryId)].token.nft.capability).toBe('minting');

    const forged: Spend = structuredClone(creation);
    forged.transaction.outputs[spanBase + 1].token.nft.commitment = Uint8Array.of(0x09);
    expect(creatorPasses(forged)).toBe(false);
    // A third NFT minted beside the two the run makes: the container's mint bound refuses it.
    const extra: Spend = structuredClone(creation);
    extra.transaction.outputs.push({
      lockingBytecode: aliceLock, valueSatoshis: 1000n,
      token: { category: hexToBin(categoryId), amount: 0n, nft: { capability: 'none', commitment: Uint8Array.of(0x07) } },
    });
    extra.transaction.outputs[extra.transaction.outputs.length - 2].valueSatoshis -= 1000n;
    expect(creatorPasses(extra)).toBe(false);
  }, 600_000);

  it('refuses before broadcasting when the payments empty the container, or exceed it', async () => {
    const emptied = await create(FT_SOURCE(false), { amount: 21n }, 2n);
    await expect(emptied.run()).rejects.toThrow(/empties its token container .* leave a token in it/);
    expect(emptied.captured).toHaveLength(1);
    const short = await create(FT_SOURCE(false), { amount: 20n }, 2n);
    await expect(short.run()).rejects.toThrow(/pays 21 tokens of .*, but its container holds 20/);
    expect(short.captured).toHaveLength(1);
  }, 600_000);
});
