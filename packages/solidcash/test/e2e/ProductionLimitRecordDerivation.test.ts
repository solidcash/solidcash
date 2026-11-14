/**
 * Under the production limits the SDK derives a call's records from a reduced probe trace, which keeps no state
 * between an output introspection and its OP_EQUALVERIFY. A long dynamic state value (chunks) and a mapping written in
 * a runtime loop (loop entries) still derive, and each call passes stock libauth's standard VM.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);

type Spend = { transaction: any; sourceOutputs: any[] };

/** Records every broadcast with the coins it spends, read from the ledger while they are still live. */
function captureBroadcasts(provider: MockNetworkProvider): Spend[] {
  const captured: Spend[] = [];
  const inner = provider.sendRawTransaction.bind(provider);
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
    const txid = await inner(hex);
    captured.push({ transaction, sourceOutputs });
    return txid;
  };
  return captured;
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

async function setup(
  source: string, initialState: Record<string, unknown>,
): Promise<{ captured: Spend[]; contract: any }> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funding: Utxo = { txid: 'b1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const deployed = await StatefulContract.deploy(compileString(source, { suppressWarnings: true } as never), [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState,
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  for (const txid of ['b2', 'b3', 'b4', 'b5']) {
    await provider.seedUtxo(binToHex(aliceLock), { txid: txid.repeat(32), vout: 0, satoshis: 300_000n });
  }
  return { captured, contract: deployed.contract.connect(new Signer(alicePriv, provider)) };
}

describe('records derived from a reduced probe trace under the production limits', () => {
  it('writes a dynamic value long enough for several chunks', async () => {
    const { captured, contract } = await setup(`contract Named {
    string name;
    int n;
    function rename(string next) public { this.name = next; this.n = this.n + 1; }
}`, { name: '', n: 0n });
    const long = 'solidcash '.repeat(30);
    await contract.rename(long).send();
    expect(verify(captured[captured.length - 1]!)).toBe(true);
    const state = await contract.getState() as { name?: string; n?: bigint };
    expect(state.name).toBe(long);
    expect(state.n).toBe(1n);
  }, 600_000);

  it('writes a mapping entry for each turn of a runtime loop', async () => {
    const { captured, contract } = await setup(`contract Table {
    mapping(int => int) m;
    int n;
    function fill(int k) public { for (int i = 0; i < k; i++) { m[i] = i + 10; } this.n = this.n + 1; }
    function check(int key, int value) public { require(m[key] == value); this.n = this.n + 1; }
}`, { n: 0n });
    await contract.fill(3n).send();
    expect(verify(captured[captured.length - 1]!)).toBe(true);
    await contract.check(0n, 10n).send();
    await contract.check(2n, 12n).send();
    expect(verify(captured[captured.length - 1]!)).toBe(true);
    expect(((await contract.getState()) as { n?: bigint }).n).toBe(3n);
  }, 600_000);
});
