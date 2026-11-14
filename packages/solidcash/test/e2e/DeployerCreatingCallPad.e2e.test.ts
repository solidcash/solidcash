/**
 * A14 item 4 step 5: `__internal__budgetPad` in a creating call.
 *
 * Every unlocking byte grants operation budget, and `create` drops the pad before the constructor runs. A child whose
 * constructor loops past what its `create` unlocking funds is created with a pad sized from the local run, never more
 * than a 10,000-byte unlocking allows. Checked with stock libauth's standard VM: the creation passes, and the same
 * creation with a shorter pad is refused by the deployer input.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, decodeTransaction,
  encodeAuthenticationInstructions, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
  sha256,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);
const SEED = '01'.repeat(32);

const SOURCE = `
contract Heavy(int rounds) {
  bytes32 h;
  constructor() {
    bytes32 x = 0x${SEED};
    for (int i = 0; i < rounds; i++) { x = sha256(x); }
    h = x;
  }
  function touch() { this.h = this.h; }
}
contract Factory { int made; function make(int r) { new Heavy{args: (r)}(); this.made = this.made + 1; } }`;

type Spend = { transaction: any; sourceOutputs: any[] };

async function create(rounds: bigint): Promise<{
  result: Awaited<ReturnType<typeof StatefulContract.deployFrom>>; creation: Spend; input: number;
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
  const artifacts = compileStringMulti(SOURCE, { allowUnsafeOperations: true } as never);
  const funding: Utxo = { txid: 'a1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const deployed = await StatefulContract.deploy(artifacts.Factory, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: { made: 0n },
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  const prep: Utxo = { txid: 'a2'.repeat(32), vout: 0, satoshis: 400_000n };
  await provider.seedUtxo(binToHex(aliceLock), prep);
  const deployerLock = artifacts.Factory.childDeployers!.Heavy!.lockingBytecode;
  const result = await StatefulContract.deployFrom({
    provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: [rounds],
    childArtifact: artifacts.Heavy, fundingUtxo: prep, funder: alice.unlockP2PKH(), changeAddress: change.address,
  });
  const creation = captured[captured.length - 1]!;
  const input = creation.sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === deployerLock);
  return { result, creation, input };
}

/** The pad: the last push before the redeem push of a `create` unlocking (A4.2). */
function padOf(unlocking: Uint8Array): Uint8Array {
  const instructions = decodeAuthenticationInstructions(unlocking);
  return (instructions[instructions.length - 2] as { data?: Uint8Array }).data ?? new Uint8Array();
}

/** The same creation with the deployer input's pad replaced. */
function withPad(spend: Spend, input: number, pad: Uint8Array): Spend {
  const copy: Spend = structuredClone(spend);
  const instructions = decodeAuthenticationInstructions(copy.transaction.inputs[input].unlockingBytecode);
  copy.transaction.inputs[input].unlockingBytecode = Uint8Array.from([
    ...encodeAuthenticationInstructions(instructions.slice(0, -2)),
    ...encodeDataPush(pad),
    ...encodeAuthenticationInstructions(instructions.slice(-1)),
  ]);
  return copy;
}

const iterated = (rounds: number): string => {
  let value = hexToBin(SEED);
  for (let round = 0; round < rounds; round += 1) value = sha256.hash(value);
  return binToHex(value);
};

describe('A14 item 4 step 5: the budget pad of a creating call', () => {
  it('pads the create of a constructor whose loop costs more than its unlocking funds, from the run', async () => {
    const { result, creation, input } = await create(1200n);
    const state = await result.child.getState() as { h?: Uint8Array | string };
    expect(typeof state.h === 'string' ? state.h : binToHex(state.h!)).toBe(iterated(1200));
    expect(vm.verify(creation as never)).toBe(true);

    const unlocking: Uint8Array = creation.transaction.inputs[input].unlockingBytecode;
    const pad = padOf(unlocking);
    expect(pad.length).toBeGreaterThan(0);
    expect(unlocking.length).toBeLessThanOrEqual(10_000);
    // Three hundred bytes less budget: the constructor's loop runs out of operations in the deployer input.
    const short = withPad(creation, input, pad.slice(300));
    const state300 = vm.evaluate({ ...short, inputIndex: input } as never);
    expect(vm.stateSuccess(state300)).not.toBe(true);
    expect(String((state300 as { error?: string }).error)).toMatch(/operation cost/);
  }, 600_000);

  it('leaves the pad empty for a constructor its unlocking funds', async () => {
    const { creation, input } = await create(100n);
    expect(padOf(creation.transaction.inputs[input].unlockingBytecode)).toHaveLength(0);
    expect(vm.verify(creation as never)).toBe(true);
  }, 600_000);

  it('refuses a constructor that needs more than a 10,000-byte unlocking funds, before broadcasting', async () => {
    await expect(create(20_000n)).rejects.toThrow(/needs more operations than a 10,000-byte/);
  }, 600_000);
});
