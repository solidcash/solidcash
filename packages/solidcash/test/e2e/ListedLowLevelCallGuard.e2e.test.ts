/**
 * A Solidity-compat low-level call `t.call{value: 0}(payload)` that the transaction's own contract R makes under a
 * guard, with its stateful callee named by an explicit `.withCall(contract, functionName, args)` list (the SDK does
 * not auto-wire a conditional call). The list names the callee, not whether R makes the call, so the guard is decided
 * as for a call the SDK resolves. T reads no msg.sender, so the builder lays no caller edge for the call and nothing in
 * R's covenant would refuse T running uncalled: the listed call is refused by name, before sending, when its guard is
 * false or cannot be decided, and made when it holds. Each sent transaction is checked by the VM.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { CallGuardUndecidedError, ListedCallNotMadeError, SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract, registerDeployment } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const SOURCE = `pragma solidcash ^0.51.0;
  interface IT { function set(int h, int c) external; }
  contract T { int height; int clock; int calls;
    function set(int h, int c) external { height = h; clock = c; calls = calls + 1; } }
  contract R { int runs;
    function compatIf(address t, bool make) external {
      if (make) {
        (bool ok, bytes data) = t.call{value: 0}(abi.encodeWithSelector(IT.set.selector, 3, 3));
        require(ok);
      }
      runs = runs + 1;
    }
    function compatNever(address t) external {
      if (tx.inputs.length > 1000) {
        (bool ok, bytes data) = t.call{value: 0}(abi.encodeWithSelector(IT.set.selector, 4, 4));
        require(ok);
      }
      runs = runs + 1;
    }
    function compatLoop(address t, uint n) external {
      for (uint i = 0; i < 1; i++) {
        if (n > 0) {
          (bool ok, bytes data) = t.call{value: 0}(abi.encodeWithSelector(IT.set.selector, 5, 5));
          require(ok);
        }
      }
      runs = runs + 1;
    }
  }`;

const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, messageBus: false, evmCompat: true, primaryContractName: primary,
}) as never;

let serial = 0x8e00;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };
type TState = { height?: bigint; clock?: bigint; calls?: bigint };

const same = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);
const spends = (sent: Sent, lock: Uint8Array): boolean => sent.sourceOutputs
  .some((output) => same(output.lockingBytecode, lock));

interface Chain {
  /** R's function `name`, sent by a wallet with T listed by `.withCall()` as the callee of R's low-level call. */
  outcome(name: string, args: unknown[], listed: unknown[]): Promise<{ text: string; error?: unknown }>;
  sentCount(): number;
  tState(): Promise<Required<TState>>;
  runs(): Promise<bigint>;
  tLock: Uint8Array;
}

async function chain(): Promise<Chain> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const sent: Sent[] = [];
  const original = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    sent.push({ transaction, sourceOutputs });
    return original(hex);
  };
  const deploy = async (artifact: Artifact): Promise<DeployResult<Artifact>> => {
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    return StatefulContract.deploy(artifact, [] as never, {
      provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
    } as never);
  };
  const t = await deploy(compileString(SOURCE, compileOptions('T')));
  const r = await deploy(compileString(SOURCE, compileOptions('R')));
  const wallet = new Signer(alicePriv, provider);
  for (let coin = 0; coin < 16; coin += 1) {
    await provider.seedUtxo(wallet.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
  }
  const [tLock, rLock] = [t, r].map((deployed) => addressToLockScript(deployed.contract.address));
  registerDeployment(provider, {
    contractName: 'T', address: t.contract.target, lockingBytecode: binToHex(tLock), contract: t.contract,
  } as never);
  const tState = async (): Promise<Required<TState>> => {
    const state = (await t.contract.getState()) as TState;
    return { height: state.height ?? 0n, clock: state.clock ?? 0n, calls: state.calls ?? 0n };
  };
  const outcome = async (
    name: string, args: unknown[], listed: unknown[],
  ): Promise<{ text: string; error?: unknown }> => {
    try {
      await (r.contract.connect(wallet) as any).call[name](...args).withCall(t.contract, 'set', listed).send();
      const last = sent[sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(provider).verify(last as never)).toBe(true);
      expect(spends(last, rLock)).toBe(true);
      const state = await tState();
      return { text: `sent; T ${spends(last, tLock) ? '' : 'not '}spent; T ${state.height}/${state.clock}/${state.calls}` };
    } catch (error) {
      return { text: `refused: ${(error as Error).message}`, error };
    }
  };
  const runs = async (): Promise<bigint> => ((await r.contract.getState()) as { runs?: bigint }).runs ?? 0n;
  return { outcome, sentCount: () => sent.length, tState, runs, tLock };
}

describe('R\'s compat low-level call to T, with T listed by withCall(), under a guard', () => {
  it('makes the listed call when its guard holds, and refuses it by name, before sending, when the guard is false',
    async () => {
      const c = await chain();
      const made = await c.outcome('compatIf', [c.tLock, true], [3n, 3n]);
      expect(made.text).toBe('sent; T spent; T 3/3/1');
      expect(await c.runs()).toBe(1n);

      const before = c.sentCount();
      const skipped = await c.outcome('compatIf', [c.tLock, false], [3n, 3n]);
      expect(skipped.text).toMatch(/^refused: R\.compatIf's call of T\.set \(low-level call 0\) is listed with withCall/);
      expect(skipped.text).toContain('`make`');
      expect(skipped.error).toBeInstanceOf(ListedCallNotMadeError);
      expect(c.sentCount()).toBe(before);
      expect(await c.tState()).toEqual({ height: 3n, clock: 3n, calls: 1n });
      expect(await c.runs()).toBe(1n);
    });

  it('refuses by name, before sending, a listed call under a guard the compiler cannot publish', async () => {
    const c = await chain();
    const before = c.sentCount();
    const { text, error } = await c.outcome('compatNever', [c.tLock], [4n, 4n]);
    expect(text).toMatch(/^refused: R\.compatNever's call of T\.set \(low-level call 0\) cannot be built: it runs only /);
    expect(error).toBeInstanceOf(CallGuardUndecidedError);
    expect(c.sentCount()).toBe(before);
    expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
    expect(await c.runs()).toBe(0n);
  });
});

describe('R\'s compat low-level call to T in a loop, with T listed by withCall()', () => {
  // The call's row publishes no number of turns for its loop, so the SDK cannot tell whether R makes the call: with
  // n = 0, as here, the loop makes none and the listed T would run uncalled. (A call a loop may make more than once
  // does not compile in the direct convention: LOW_LEVEL_CALL_IN_LOOP.)
  it('refuses the listed call by name, before sending', async () => {
    const c = await chain();
    const before = c.sentCount();
    const { text, error } = await c.outcome('compatLoop', [c.tLock, 0n], [5n, 5n]);
    expect(text).toMatch(/^refused: R\.compatLoop's call of T\.set \(low-level call 0\) cannot be built: /);
    expect(text).toContain('it runs once per turn of a loop');
    expect(error).toBeInstanceOf(CallGuardUndecidedError);
    expect(c.sentCount()).toBe(before);
    expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
    expect(await c.runs()).toBe(0n);
  });
});
