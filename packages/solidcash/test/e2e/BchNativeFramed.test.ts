/**
 * BchNative under the framed convention. The bearer token is a category of its own, so a framed genesis creates it
 * beside the contract's, and a framed master pays it out of its container: a token run after the container its frame
 * spends (spec 4b). A premint of the contract's own category, which a framed composition refuses (spec S2), is
 * refused before anything is signed, and a frame that names no container cannot draw one down.
 */
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileFile } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { Contract } from '../../src/Contract.js';
import { callFramedEntry } from '../../src/framed/call/index.js';
import {
  framedTokenContainerLockingBytecode, framedTokenContainerUnlockingBytecode,
} from '../../src/framed/call/token-containers.js';
import { readFramedEntry } from '../../src/framed/read/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { addressToLockScript } from '../../src/utils.js';
import { aliceAddress, alicePkh, alicePriv, aliceTokenAddress, bobPkh } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';
import { expectScriptRejection } from '../test-util.js';

const SOURCE = new URL('../fixture/bch_native_framed_token.scash', import.meta.url);

describe('BchNative, framed', () => {
  const artifact = compileFile(SOURCE, { composition: 'framed', suppressWarnings: true });
  const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
  const bobLock = encodeLockingBytecodeP2pkh(bobPkh);
  const alice = new SignatureTemplate(alicePriv);

  async function deploy(nativeToken: Parameters<typeof deployStatefulContract>[2]['nativeToken']): Promise<{
    provider: MockNetworkProvider; categoryId: string; tokenCategory: string;
    tx: Awaited<ReturnType<typeof deployStatefulContract>>['tx'];
  }> {
    // Real consensus limits: the input size and operation-cost budget a node enforces.
    const provider = new MockNetworkProvider();
    const fundingUtxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 3_000_000n };
    const tokenFunding = { txid: 'f2'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(binToHex(aliceLock), fundingUtxo);
    await provider.addUtxo(binToHex(aliceLock), tokenFunding);
    await fundShippedFacets(provider);
    const result = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      initArgs: [hexToBin(tokenFunding.txid)], nativeToken: { funding: tokenFunding, ...nativeToken },
    });
    return { provider, categoryId: result.categoryId, tokenCategory: tokenFunding.txid, tx: result.tx };
  }

  /** A fresh tokenless coin at the caller's lock, and the call options it funds. */
  let coin = 0;
  async function caller(provider: MockNetworkProvider, categoryId: string): Promise<{
    provider: MockNetworkProvider; artifact: typeof artifact; categoryId: string; callerUtxo: Utxo;
    callerLockingBytecode: Uint8Array; funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
    vm: ReturnType<typeof createVirtualMachineBch2026ForProvider>;
  }> {
    coin += 1;
    const callerUtxo = { txid: coin.toString(16).padStart(64, 'c'), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(binToHex(aliceLock), callerUtxo);
    return {
      provider, artifact, categoryId, callerUtxo, callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(),
      vm: createVirtualMachineBch2026ForProvider(provider),
    };
  }

  async function heldBy(provider: MockNetworkProvider, categoryId: string, lock: Uint8Array): Promise<unknown> {
    return (await readFramedEntry({
      provider, artifact, categoryId, functionName: 'heldBy', args: [lock],
      vm: createVirtualMachineBch2026ForProvider(provider),
    })).value;
  }

  async function tokensAt(provider: MockNetworkProvider, lock: Uint8Array, category: string): Promise<bigint> {
    return (await provider.getUtxosForLockingBytecode(lock))
      .filter((utxo) => utxo.token?.category === category)
      .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);
  }

  it('keys its reserve by its own bearer category, which the genesis creates and premints', async () => {
    expect(artifact.composition?.convention).toBe('framed');
    const wrap = artifact.abi.find((entry) => entry.name === 'wrap')!;
    expect(wrap.tokenContainerAccesses).toEqual([expect.objectContaining({
      keySource: 'state', keyStateVariable: '_nativeCategory',
    })]);
    await expect(deploy({ funding: undefined, reserve: 1_000n })).rejects.toThrow(/category of its own/);

    const { provider, categoryId, tokenCategory, tx } = await deploy({ reserve: 1_000n });
    expect(tx.inputs.map((input) => binToHex(input.outpointTransactionHash))).toContain(tokenCategory);
    const container = addressToLockScript(getTokenContainerAddress(
      new Contract(artifact, [] as never, { provider, category: hexToBin(categoryId) }), categoryId, tokenCategory,
    ));
    expect(binToHex(container)).toBe(binToHex(framedTokenContainerLockingBytecode(categoryId, tokenCategory)));
    expect(await tokensAt(provider, container, tokenCategory)).toBe(1_000n);
    // No output carries a fungible amount of the contract's own category.
    expect(tx.outputs.filter((output) => output.token !== undefined
      && binToHex(output.token.category) === categoryId && output.token.amount > 0n)).toEqual([]);
  });

  it('wraps bearer tokens into a new container and unwraps them from it to another holder', async () => {
    const { provider, categoryId, tokenCategory, tx } = await deploy({
      bearer: { amount: 1_000n, to: aliceTokenAddress },
    });
    const vout = tx.outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === tokenCategory);
    const bearer: Utxo = {
      txid: tx.txid, vout, satoshis: tx.outputs[vout]!.valueSatoshis, token: { category: tokenCategory, amount: 1_000n },
    };
    const wrapped = await callFramedEntry({
      ...(await caller(provider, categoryId)), functionName: 'wrap', args: [400n],
      tokenDeposits: [{ utxo: bearer, unlocker: alice.unlockP2PKH(), amount: 400n }],
    });
    expect(wrapped.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(wrapped.broadcast).toBeDefined();
    const container = framedTokenContainerLockingBytecode(categoryId, tokenCategory);
    expect(await tokensAt(provider, container, tokenCategory)).toBe(400n);
    expect(await heldBy(provider, categoryId, aliceLock)).toBe(400n);

    const unwrapped = await callFramedEntry({
      ...(await caller(provider, categoryId)), functionName: 'unwrap', args: [bobLock, 250n],
    });
    expect(unwrapped.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(unwrapped.broadcast).toBeDefined();
    expect(await tokensAt(provider, bobLock, tokenCategory)).toBe(250n);
    expect(await tokensAt(provider, container, tokenCategory)).toBe(150n);
    expect(await heldBy(provider, categoryId, aliceLock)).toBe(150n);

    // A ledger of 150 does not unwrap 200, and the container keeps what it holds.
    const overdrawn = await callFramedEntry({
      ...(await caller(provider, categoryId)), functionName: 'unwrap', args: [bobLock, 200n],
    }).catch((error: Error) => error);
    expect(overdrawn instanceof Error || overdrawn.accepted === false).toBe(true);
    expect(await tokensAt(provider, container, tokenCategory)).toBe(150n);

    // The whole reserve unwraps, which leaves the container drained.
    const drained = await callFramedEntry({
      ...(await caller(provider, categoryId)), functionName: 'unwrap', args: [aliceLock, 150n],
    });
    expect(drained.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(await tokensAt(provider, container, tokenCategory)).toBe(0n);
    expect(await heldBy(provider, categoryId, aliceLock)).toBe(0n);
  }, 600_000);

  it('refuses a frame that names no container drawing one down in place', async () => {
    const { provider, categoryId, tokenCategory } = await deploy({ reserve: 1_000n });
    const container = framedTokenContainerLockingBytecode(categoryId, tokenCategory);
    const [reserve] = await provider.getUtxosForLockingBytecode(container);
    expect(reserve?.token?.amount).toBe(1_000n);

    // The honest ping, captured, then the chain rewound to before it.
    const options = await caller(provider, categoryId);
    const snapshot = await provider.takeSnapshot();
    const honest = await callFramedEntry({ ...options, functionName: 'ping', args: [] });
    expect(honest.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    const masterIndex = honest.draft.layout.participants[0]!.index;
    const hex = honest.broadcast!.hex;
    await snapshot.restore();

    // The same transaction co-spends the reserve under the ping master's authority, recreates it in place with 400
    // fewer tokens, and pays those to the caller. The container's own covenant admits it: the amount is the master's.
    const forge = (unlockingBytecode: Uint8Array): { raw: string; containerIndex: number } => {
      const forged = decodeTransactionUnsafe(hexToBin(hex)) as ReturnType<typeof decodeTransactionUnsafe>;
      const containerIndex = forged.inputs.length;
      forged.inputs.push({
        outpointTransactionHash: hexToBin(reserve!.txid),
        outpointIndex: reserve!.vout,
        sequenceNumber: forged.inputs[0]!.sequenceNumber,
        unlockingBytecode,
      });
      const change = forged.outputs.pop()!;
      change.valueSatoshis -= 10_000n;
      while (forged.outputs.length < containerIndex) {
        forged.outputs.push({ lockingBytecode: Uint8Array.of(0x6a), valueSatoshis: 0n });
      }
      forged.outputs.push({
        lockingBytecode: container, valueSatoshis: reserve!.satoshis,
        token: { category: hexToBin(tokenCategory), amount: 600n },
      });
      forged.outputs.push({
        lockingBytecode: aliceLock, valueSatoshis: 1_000n, token: { category: hexToBin(tokenCategory), amount: 400n },
      });
      forged.outputs.push(change);
      return { raw: binToHex(encodeTransaction(forged)), containerIndex };
    };
    const send = (raw: string): Promise<string> => provider.sendRawTransaction(raw)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    const unlocking = framedTokenContainerUnlockingBytecode(categoryId, tokenCategory, masterIndex);
    const outcome = await send(forge(unlocking).raw);
    expect(outcome).not.toBe('ACCEPTED');
    expectScriptRejection(outcome, masterIndex);
    // The same spend with the flag pushed as 2 names no master's own container: the container refuses it itself.
    expect(unlocking[1]).toBe(0x51);
    const flagged = forge(Uint8Array.from(unlocking, (byte, at) => (at === 1 ? 0x52 : byte)));
    expect(await send(flagged.raw)).not.toBe('ACCEPTED');
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const containerAccepts = (raw: string): unknown => vm.stateSuccess(vm.evaluate({
      inputIndex: flagged.containerIndex,
      sourceOutputs: [...honest.sourceOutputs, {
        lockingBytecode: container, valueSatoshis: reserve!.satoshis,
        token: { category: hexToBin(tokenCategory), amount: 1_000n },
      }],
      transaction: decodeTransactionUnsafe(hexToBin(raw)) as ReturnType<typeof decodeTransactionUnsafe>,
    }));
    expect(containerAccepts(forge(unlocking).raw)).toBe(true);
    expect(containerAccepts(flagged.raw)).not.toBe(true);
    // The captured ping without the container settles.
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
  }, 600_000);
});
