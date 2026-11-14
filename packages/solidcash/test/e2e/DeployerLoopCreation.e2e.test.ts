/**
 * Deployer `new`s in a runtime loop (B8.6).
 *
 * Each iteration of a runtime loop binds its own deployer input: a creation whose later child carries other
 * arguments than the creator's run gives fails the creator's input, not only the child's. Before the fix, every
 * iteration re-checked the first deployer input, so any child after the first could carry any arguments.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeTransaction,
  encodeLockingBytecodeP2pkh, hash256, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

async function setup(source: string, factoryName: string) {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const artifacts = compileStringMulti(source, { allowUnsafeOperations: true } as never);
  const deploymentFunding: Utxo = { txid: 'e7'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(authorLock), deploymentFunding);
  const deployed = await StatefulContract.deploy(artifacts[factoryName], [], {
    provider, fundingUtxo: deploymentFunding, funder, initialBalance: 50_000n,
    initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
  } as never);
  const preps: Utxo[] = [];
  for (const byte of ['e8', 'e9']) {
    const prep: Utxo = { txid: byte.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(authorLock), prep);
    preps.push(prep);
  }
  return { provider, funder, change: change.address, artifacts, deployed, preps };
}

/** The creation's source outputs, for a VM run of one of its inputs. */
async function sourceOutputsOf(provider: MockNetworkProvider, tx: any, prepTransactions: string[], restore: () => Promise<void>) {
  const prepOutputs = new Map<string, any>();
  for (const hex of prepTransactions) {
    const prep = decodeTransaction(hexToBin(hex));
    if (typeof prep === 'string') throw new Error(prep);
    const txid = binToHex(hash256(hexToBin(hex)).slice().reverse());
    prep.outputs.forEach((output, vout) => prepOutputs.set(`${txid}:${vout}`, output));
  }
  await restore();
  const outputs = [];
  for (const input of tx.inputs) {
    const key = `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`;
    const prep = prepOutputs.get(key);
    if (prep !== undefined) { outputs.push(prep); continue; }
    const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
    if (spent === undefined) throw new Error(`no source for ${key}`);
    outputs.push(solidCashOutputToLibauthOutput({
      to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
    } as never));
  }
  return outputs;
}

describe('deployer `new`s in a runtime loop', () => {
  it('binds every child of a runtime loop, not only the first', async () => {
    const { provider, funder, change, artifacts, deployed, preps } = await setup(`
      contract Child(bytes20 owner) { int counter; function bump() { counter = counter + 1; } }
      contract LoopFactory { int childCount;
        function makeK(int k, bytes20 owner) {
          for (int i = 0; i < k; i = i + 1) { new Child{args: (owner)}(); }
          childCount = childCount + k;
        }
      }`, 'LoopFactory');
    const deployerLock = (artifacts.LoopFactory as any).childDeployers.Child.lockingBytecode as string;
    const before = await provider.takeSnapshot();
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'makeK',
      deployFunctionArgs: [2n, alicePkh], childArtifact: artifacts.Child, childConstructorArgs: [alicePkh],
      fundingUtxos: preps, deployments: 2, funder, changeAddress: change,
    });
    expect(result.children).toHaveLength(2);
    const tx = decodeTransaction(hexToBin(await provider.getRawTransaction(result.tx.txid)));
    if (typeof tx === 'string') throw new Error(tx);
    const sourceOutputs = await sourceOutputsOf(provider, tx, result.prepTransactions ?? [], before.restore);
    const vm = createVirtualMachineBch2026();
    expect(vm.verify({ transaction: tx, sourceOutputs } as never)).toBe(true);
    const deployerInputs = sourceOutputs.map((output, index) => [binToHex(output.lockingBytecode), index] as const)
      .filter(([lock]) => lock === deployerLock).map(([, index]) => index);
    expect(deployerInputs).toHaveLength(2);
    // Give each child in turn another owner in its deployer input: the factory's own input must refuse both.
    for (const target of deployerInputs) {
      const tampered = structuredClone(tx);
      const unlocking = binToHex(tx.inputs[target].unlockingBytecode);
      expect(unlocking.split(binToHex(alicePkh))).toHaveLength(2);
      tampered.inputs[target].unlockingBytecode = hexToBin(unlocking.replace(binToHex(alicePkh), binToHex(bobPkh)));
      const state = vm.evaluate({ transaction: tampered, sourceOutputs, inputIndex: 0 } as never);
      expect(vm.stateSuccess(state)).not.toBe(true);
    }
  }, 600_000);

});
