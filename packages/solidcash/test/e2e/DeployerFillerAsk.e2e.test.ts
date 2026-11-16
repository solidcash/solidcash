/**
 * Merge-only: how deployer-fixes' filler meets genesis-pins' `childContainers` in a creating call (A14 item 11).
 *
 * A payable child with no value has an optional satoshi row with nothing required, which holds the OP_1 filler.
 * Satoshis asked for that row in `childContainers` open the container at its lock instead (an amount from 1 to
 * 1,199 raised to RESERVE); they never go to the filler, which anyone can spend. The creation pays exactly the fee.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, cashAddressToLockingBytecode, decodeTransaction, encodeLockingBytecodeP2pkh, hash256, hexToBin,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract, getSatoshiContainerAddress } from '../../src/stateful/index.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const FEE = 20_000n;

async function createWithAsk(satoshis: bigint) {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const artifacts = compileStringMulti(`
    contract Child { int n; constructor() payable { n = 7; } }
    contract PayFactory { int childCount;
      function make() { new Child(); childCount = childCount + 1; }
    }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
  const deploymentFunding: Utxo = { txid: 'c1'.repeat(32), vout: 0, satoshis: 100000n };
  await provider.seedUtxo(binToHex(authorLock), deploymentFunding);
  const deployed = await StatefulContract.deploy(artifacts.PayFactory, [], {
    provider, fundingUtxo: deploymentFunding, funder,
    initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
  });
  const prepFunding: Utxo = { txid: 'c2'.repeat(32), vout: 0, satoshis: 100000n };
  await provider.seedUtxo(binToHex(authorLock), prepFunding);

  const before = await provider.takeSnapshot();
  const result = await StatefulContract.deployFrom({
    provider, factory: deployed.contract, deployFunctionName: 'make',
    deployFunctionArgs: [], childArtifact: artifacts.Child, childConstructorArgs: [],
    fundingUtxo: prepFunding, funder, changeAddress: change.address, fee: FEE,
    childContainers: [{ deployment: 0, satoshis }],
  });
  expect(((await result.child.getState()) as { n?: bigint }).n).toBe(7n);
  const lock = cashAddressToLockingBytecode(
    getSatoshiContainerAddress((result.child as any).inner, result.childCategoryId),
  );
  if (typeof lock === 'string') throw new Error(lock);
  const outputs = result.tx.outputs;
  const atLock = outputs.filter((output) => binToHex(output.lockingBytecode) === binToHex(lock.bytecode));
  const fillers = outputs.filter((output) => binToHex(output.lockingBytecode) === '51');

  // What the creation paid: a prep output's value from its transaction, any other coin's from the ledger before.
  const prepOutputs = new Map<string, bigint>();
  for (const hex of result.prepTransactions ?? []) {
    const prep = decodeTransaction(hexToBin(hex));
    if (typeof prep === 'string') throw new Error(prep);
    const txid = binToHex(hash256(hexToBin(hex)).slice().reverse());
    prep.outputs.forEach((output, vout) => prepOutputs.set(`${txid}:${vout}`, output.valueSatoshis));
  }
  await before.restore();
  let inputTotal = 0n;
  for (const input of result.tx.inputs) {
    const txid = binToHex(input.outpointTransactionHash);
    const value = prepOutputs.get(`${txid}:${input.outpointIndex}`)
      ?? (await provider.getLedgerOutput(txid, input.outpointIndex))?.satoshis;
    if (value === undefined) throw new Error(`no source output for ${txid}:${input.outpointIndex}`);
    inputTotal += value;
  }
  const paid = inputTotal - outputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
  return { atLock: atLock.map((output) => output.valueSatoshis), fillers: fillers.map((o) => o.valueSatoshis), paid };
}

describe('satoshis asked for an optional row with nothing required (A14 item 11, merged branches)', () => {
  it('opens the container at its lock with what was asked, and no filler', async () => {
    const { atLock, fillers, paid } = await createWithAsk(5_000n);
    expect(atLock).toEqual([5_000n]);
    expect(fillers).toEqual([]);
    expect(paid).toBe(FEE);
  }, 600_000);

  it('raises an amount from 1 to 1,199 to RESERVE', async () => {
    const { atLock, fillers, paid } = await createWithAsk(500n);
    expect(atLock).toEqual([1_200n]);
    expect(fillers).toEqual([]);
    expect(paid).toBe(FEE);
  }, 600_000);

  it('keeps the filler when 0 is asked', async () => {
    const { atLock, fillers, paid } = await createWithAsk(0n);
    expect(atLock).toEqual([]);
    expect(fillers).toEqual([1_000n]);
    expect(paid).toBe(FEE);
  }, 600_000);
});
