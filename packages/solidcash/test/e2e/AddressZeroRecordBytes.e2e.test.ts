/**
 * A data record keeps the bytes its covenant wrote for every value a call leaves as it was. The SDK spells an `address`
 * of 20 zero bytes as address(0), the empty push, while a covenant that stores those bytes writes a 20-byte push: a
 * Solidity port's `who` after a refused recovery, or a callee that stores 20 zero bytes in an `address`. Rebuilt from
 * its parsed values, such a record changes bytes no call changed. On the production profile, each sent transaction is
 * checked by the VM.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const ZERO = '00'.repeat(20);
const COMPILE = { deployer: true, genesisCalls: true, messageBus: false } as const;

let serial = 0xa00;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

/** A production-profile mock that records each sent transaction with the outputs its inputs spend. */
function setup(): {
  provider: MockNetworkProvider;
  deploy(artifact: Artifact): Promise<DeployResult<Artifact>>;
  wallet(coins: number): Promise<Signer>;
  sent: Sent[];
} {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const sent: Sent[] = [];
  const send = provider.sendRawTransaction.bind(provider);
  (provider as unknown as { sendRawTransaction(hex: string): Promise<string> }).sendRawTransaction = async (hex) => {
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    sent.push({ transaction, sourceOutputs });
    return send(hex);
  };
  const deploy = async (artifact: Artifact): Promise<DeployResult<Artifact>> => {
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    return StatefulContract.deploy(artifact, [] as never, {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: change.address,
      senderLockingBytecode: authorLock,
    } as never);
  };
  const wallet = async (coins: number): Promise<Signer> => {
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < coins; index += 1) {
      await provider.seedUtxo(signer.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
    }
    return signer;
  };
  return { provider, deploy, wallet, sent };
}

/** The record a sent transaction spends and the one it creates at a data-NFT lock, as hex. */
function recordAt(sent: Sent, lock: Uint8Array): { spent: string; created: string } {
  const at = (outputs: any[]): string => {
    const output = outputs.find((candidate) => binToHex(candidate.lockingBytecode) === binToHex(lock));
    if (output?.token?.nft === undefined) throw new Error('no record at the lock');
    return binToHex(output.token.nft.commitment);
  };
  return { spent: at(sent.sourceOutputs), created: at(sent.transaction.outputs) };
}

describe('a record keeps the bytes of each value a call leaves as it was', () => {
  it('a Solidity port\'s who, after a refused recovery, through a later write and a read-only call', async () => {
    const { ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const s = setup();
    const source = 'pragma solidity ^0.8.0; contract G { address public who; uint256 public n; '
      + 'function f(bytes32 h, uint8 v, bytes32 r, bytes32 s) external returns (bool) { '
      + 'who = ecrecover(h, v, r, s); n = n + 1; return true; } '
      + 'function bump() external returns (bool) { n = n + 1; return true; } '
      + 'function same() external returns (bool) { return who == address(0); } }';
    const { contract, categoryId } = await s.deploy(compileString(source, {
      ...COMPILE, primaryContractName: 'G', ecrecover: 'evm', evmCompat: true,
    } as never));
    // The contract's recovery pool, which a call whose arguments the run learns lays out before the run.
    const salt = hexToBin(categoryId).slice().reverse();
    const locks = [
      ...(['A', 'B2', 'M', 'B3'] as const).map((role) => ecrecoverComputeLockingBytecode(salt, role)),
      keccakComputeLockingBytecode(salt, true),
    ];
    for (const lock of locks) {
      await s.provider.seedUtxo(binToHex(lock), {
        txid: nextTxid(), vout: 0, satoshis: 100_000n,
        token: { category: 'ed'.repeat(31) + '15', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const connected = contract.connect(await s.wallet(8)) as unknown as {
      call: Record<'f' | 'bump' | 'same', (...args: unknown[]) => { send(): Promise<unknown> }>;
    };
    const recordLock = addressToLockScript(getDataNftAddress(contract.inner as never, categoryId));
    const state = async (): Promise<{ who: string; n: bigint }> => {
      const read = (await contract.getState()) as { who?: Uint8Array; n?: bigint };
      return { who: binToHex(read.who ?? new Uint8Array()), n: read.n ?? 0n };
    };
    const vm = createVirtualMachineBch2026ForProvider(s.provider);

    // v = 0: the precompile refuses it, and the port stores the zero address as 20 zero bytes.
    await connected.call.f(new Uint8Array(32).fill(0x11), 0n, new Uint8Array(32).fill(0x22),
      new Uint8Array(32).fill(0x33)).send();
    let sent = s.sent[s.sent.length - 1]!;
    expect(vm.verify(sent as never)).toBe(true);
    expect(recordAt(sent, recordLock).created.startsWith(`14${ZERO}`)).toBe(true);
    expect(await state()).toEqual({ who: ZERO, n: 1n });

    // A call that writes n only: who keeps its 20 bytes in the record the call rewrites.
    await connected.call.bump().send();
    sent = s.sent[s.sent.length - 1]!;
    expect(vm.verify(sent as never)).toBe(true);
    expect(recordAt(sent, recordLock).created.startsWith(`14${ZERO}`)).toBe(true);
    expect(await state()).toEqual({ who: ZERO, n: 2n });

    // A call that writes nothing, which the SDK builds without a derivation: the record is republished as it was.
    await connected.call.same().send();
    sent = s.sent[s.sent.length - 1]!;
    expect(vm.verify(sent as never)).toBe(true);
    const { spent, created } = recordAt(sent, recordLock);
    expect(created).toBe(spent);
    expect(await state()).toEqual({ who: ZERO, n: 2n });
  });

  it('a callee\'s address of 20 zero bytes, written in the caller\'s call and kept by a later one', async () => {
    const source = 'pragma solidcash ^0.50.0; '
      + 'interface I { function set(bytes b) external returns (bool); function bump() external returns (bool); } '
      + 'contract T { address who; int n; '
      + 'function set(bytes b) external returns (bool) { who = b; n = n + 1; return true; } '
      + 'function bump() external returns (bool) { n = n + 1; return true; } } '
      + 'contract D { int calls; '
      + 'function g(I t, bytes b) external returns (bool) { bool ok = t.set(b); calls = calls + 1; return ok; } '
      + 'function h(I t) external returns (bool) { bool ok = t.bump(); calls = calls + 1; return ok; } }';
    const s = setup();
    const t = await s.deploy(compileString(source, { ...COMPILE, primaryContractName: 'T' } as never));
    const d = await s.deploy(compileString(source, { ...COMPILE, primaryContractName: 'D' } as never));
    const wallet = await s.wallet(8);
    const tLock = addressToLockScript(t.contract.address);
    const tRecordLock = addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId));
    const vm = createVirtualMachineBch2026ForProvider(s.provider);
    const callee = async (): Promise<{ who: string; n: bigint }> => {
      const read = (await t.contract.getState()) as { who?: Uint8Array; n?: bigint };
      return { who: binToHex(read.who ?? new Uint8Array()), n: read.n ?? 0n };
    };

    // The callee's run writes the 20 bytes: the record it derives holds them, which the rebuild spelled as empty.
    await (d.contract.connect(wallet) as any).call.g(tLock, new Uint8Array(20)).withExternalCall(t.contract).send();
    let sent = s.sent[s.sent.length - 1]!;
    expect(vm.verify(sent as never)).toBe(true);
    expect(recordAt(sent, tRecordLock).created.startsWith(`14${ZERO}`)).toBe(true);
    expect(await callee()).toEqual({ who: ZERO, n: 1n });

    // A call of the callee that writes n only keeps who's 20 bytes.
    await (d.contract.connect(wallet) as any).call.h(tLock).withExternalCall(t.contract).send();
    sent = s.sent[s.sent.length - 1]!;
    expect(vm.verify(sent as never)).toBe(true);
    expect(recordAt(sent, tRecordLock).created.startsWith(`14${ZERO}`)).toBe(true);
    expect(await callee()).toEqual({ who: ZERO, n: 2n });
    expect(((await d.contract.getState()) as { calls?: bigint }).calls).toBe(2n);
  });
});
