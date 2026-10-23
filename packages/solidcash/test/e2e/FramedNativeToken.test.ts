/**
 * The full ERC-20 BchNative token under the framed convention, split one entry per master program, on the consensus
 * limits a node enforces: every entry fits one input, a transfer credits the recipient in a frame of its own, and the
 * token wraps and unwraps through its container.
 */
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileFileSplit } from '@solidcash/solidc';
import { asmToScript, scriptToBytecode, type FunctionSplitBundle } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { callFramedEntry, type FramedCallResult } from '../../src/framed/call/index.js';
import {
  framedTokenContainerLockingBytecode, framedTokenContainerUnlockingBytecode,
} from '../../src/framed/call/token-containers.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { SignatureTemplate } from '../../src/index.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import {
  aliceAddress, alicePkh, alicePriv, aliceTokenAddress, bobPkh, bobPriv, carolPkh,
} from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';
import { expectScriptRejection } from '../test-util.js';

const SOURCE = new URL('../../contracts/examples/FramedNativeToken.scash', import.meta.url);

describe('FramedNativeToken', () => {
  const bundle = compileFileSplit(SOURCE, {
    split: 'func', composition: 'framed', suppressWarnings: true,
  }) as unknown as FunctionSplitBundle;
  const alice = { lock: encodeLockingBytecodeP2pkh(alicePkh), signer: new SignatureTemplate(alicePriv) };
  const bob = { lock: encodeLockingBytecodeP2pkh(bobPkh), signer: new SignatureTemplate(bobPriv) };
  const carolLock = encodeLockingBytecodeP2pkh(carolPkh);

  it('fits every entry in one input', () => {
    for (const shard of bundle.shards) {
      expect(scriptToBytecode(asmToScript(shard.artifact.bytecode)).length, shard.function).toBeLessThan(10_000);
    }
    expect(bundle.shards.map((shard) => shard.function)).toEqual(expect.arrayContaining([
      'totalSupply', 'balanceOf', 'allowance', 'transfer', 'approve', 'transferFrom', 'wrap', 'unwrap',
    ]));
  });

  async function deploy(): Promise<{
    provider: MockNetworkProvider; categoryId: string; category: string; bearer: Utxo;
    call: (who: typeof alice, functionName: string, args: unknown[],
      extra?: { tokenDeposits?: unknown[]; publish?: boolean }) => Promise<FramedCallResult>;
    settled: (result: FramedCallResult) => void;
  }> {
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const fundingUtxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 5_000_000n };
    const tokenFunding = { txid: 'f2'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(binToHex(alice.lock), fundingUtxo);
    await provider.addUtxo(binToHex(alice.lock), tokenFunding);
    await fundShippedFacets(provider);
    const category = tokenFunding.txid;
    const deployed = await deployStatefulContract(bundle.logical, [], {
      provider, fundingUtxo, funder: alice.signer.unlockP2PKH(), changeAddress: aliceAddress,
      functionSplit: bundle, initArgs: [hexToBin(category)],
      nativeToken: { funding: tokenFunding, bearer: { amount: 1_000n, to: aliceTokenAddress } },
    });
    const { categoryId } = deployed;
    const vout = deployed.tx.outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === category);
    const bearer: Utxo = {
      txid: deployed.tx.txid, vout, satoshis: deployed.tx.outputs[vout]!.valueSatoshis,
      token: { category, amount: 1_000n },
    };

    let coin = 0;
    const call = async (
      who: typeof alice, functionName: string, args: unknown[], extra: { tokenDeposits?: unknown[]; publish?: boolean } = {},
    ): Promise<FramedCallResult> => {
      coin += 1;
      const callerUtxo = { txid: coin.toString(16).padStart(64, 'c'), vout: 0, satoshis: 300_000n };
      await provider.addUtxo(binToHex(who.lock), callerUtxo);
      return callFramedEntry({
        provider, artifact: bundle.logical, split: bundle, categoryId, functionName, args: args as never,
        callerUtxo, callerLockingBytecode: who.lock, funder: who.signer.unlockP2PKH(), vm, ...extra as object,
      });
    };
    const settled = (result: FramedCallResult): void => {
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
      expect(result.broadcast).toBeDefined();
    };
    return { provider, categoryId, category, bearer, call, settled };
  }

  it('wraps, transfers, spends an allowance and unwraps on real consensus limits', async () => {
    const { provider, categoryId, category, bearer, call, settled } = await deploy();
    const view = async (functionName: string, args: unknown[]): Promise<unknown> =>
      (await call(alice, functionName, args, { publish: false })).value;
    const tokensAt = async (lock: Uint8Array): Promise<bigint> => (await provider.getUtxosForLockingBytecode(lock))
      .filter((utxo) => utxo.token?.category === category)
      .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);

    settled(await call(alice, 'wrap', [600n], {
      tokenDeposits: [{ utxo: bearer, unlocker: alice.signer.unlockP2PKH(), amount: 600n }],
    }));
    expect(await view('balanceOf', [alice.lock])).toBe(600n);
    expect(await view('totalSupply', [])).toBe(600n);
    expect(await tokensAt(framedTokenContainerLockingBytecode(categoryId, category))).toBe(600n);

    // The recipient is credited in a frame of its own; nobody else may call that frame.
    settled(await call(alice, 'transfer', [bob.lock, 200n]));
    expect(await view('balanceOf', [alice.lock])).toBe(400n);
    expect(await view('balanceOf', [bob.lock])).toBe(200n);
    const forged = await call(alice, 'credit', [alice.lock, 1_000n]).catch((error: Error) => error);
    expect(forged instanceof Error || !forged.accepted).toBe(true);

    settled(await call(alice, 'approve', [bob.lock, 150n]));
    settled(await call(bob, 'transferFrom', [alice.lock, carolLock, 100n]));
    expect(await view('allowance', [alice.lock, bob.lock])).toBe(50n);
    expect(await view('balanceOf', [alice.lock])).toBe(300n);
    expect(await view('balanceOf', [carolLock])).toBe(100n);

    settled(await call(bob, 'unwrap', [bob.lock, 200n]));
    expect(await view('balanceOf', [bob.lock])).toBe(0n);
    expect(await view('totalSupply', [])).toBe(400n);
    expect(await tokensAt(bob.lock)).toBe(200n);
    expect(await tokensAt(framedTokenContainerLockingBytecode(categoryId, category))).toBe(400n);
  }, 900_000);

  it('refuses a shard with no token code drawing the container down in place', async () => {
    const { provider, categoryId, category, bearer, call, settled } = await deploy();
    settled(await call(alice, 'wrap', [600n], {
      tokenDeposits: [{ utxo: bearer, unlocker: alice.signer.unlockP2PKH(), amount: 600n }],
    }));
    const container = framedTokenContainerLockingBytecode(categoryId, category);
    const [reserve] = await provider.getUtxosForLockingBytecode(container);
    expect(reserve?.token?.amount).toBe(600n);

    // The honest approve, captured, then the chain rewound to before it; its coin is funded before the snapshot.
    const callerUtxo = { txid: 'ee'.repeat(32), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(binToHex(alice.lock), callerUtxo);
    const snapshot = await provider.takeSnapshot();
    const honest = await callFramedEntry({
      provider, artifact: bundle.logical, split: bundle, categoryId, functionName: 'approve', args: [bob.lock, 1n],
      callerUtxo, callerLockingBytecode: alice.lock, funder: alice.signer.unlockP2PKH(),
      vm: createVirtualMachineBch2026ForProvider(provider),
    });
    settled(honest);
    const masterIndex = honest.draft.layout.participants[0]!.index;
    const hex = honest.broadcast!.hex;
    await snapshot.restore();

    // The approve master's authority co-spends the reserve, recreated in place with 250 fewer tokens.
    const forged = decodeTransactionUnsafe(hexToBin(hex)) as ReturnType<typeof decodeTransactionUnsafe>;
    const containerIndex = forged.inputs.length;
    forged.inputs.push({
      outpointTransactionHash: hexToBin(reserve!.txid),
      outpointIndex: reserve!.vout,
      sequenceNumber: forged.inputs[0]!.sequenceNumber,
      unlockingBytecode: framedTokenContainerUnlockingBytecode(categoryId, category, masterIndex),
    });
    const change = forged.outputs.pop()!;
    change.valueSatoshis -= 10_000n;
    while (forged.outputs.length < containerIndex) {
      forged.outputs.push({ lockingBytecode: Uint8Array.of(0x6a), valueSatoshis: 0n });
    }
    forged.outputs.push({
      lockingBytecode: container, valueSatoshis: reserve!.satoshis,
      token: { category: hexToBin(category), amount: 350n },
    });
    forged.outputs.push({
      lockingBytecode: alice.lock, valueSatoshis: 1_000n, token: { category: hexToBin(category), amount: 250n },
    });
    forged.outputs.push(change);
    const outcome = await provider.sendRawTransaction(binToHex(encodeTransaction(forged)))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).not.toBe('ACCEPTED');
    expectScriptRejection(outcome, masterIndex);
  }, 900_000);
});
