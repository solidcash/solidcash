/**
 * A call the transaction's own contract R makes under a guard, with its callee named by an explicit
 * `withExternalCall(contract, functionName, args)` list rather than resolved by the SDK. The list names the callee, not
 * whether R makes the call: the guard is decided as for a resolved call. A raw call to a callee that reads no
 * msg.sender carries no caller edge, so nothing in R's covenant would refuse T running uncalled: such a listed call is
 * refused by name, before sending, when its guard reads false or cannot be decided, and made when the guard holds.
 * R's typed calls to T, made more than once, run as frames of T's multi-call spend, planned from R's loops and guards:
 * a frame they skip is left out, with no refusal. Each sent transaction is checked by the VM.
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

const source = (setSelector: string): string => `pragma solidcash ^0.52.0;
  interface IT { function set(int h, int c) external; function get() external view returns (int); }
  contract T { int height; int clock; int calls;
    function set(int h, int c) external { height = h; clock = c; calls = calls + 1; }
    function get() external view returns (int) { return calls; } }
  contract R { int runs;
    function rawIf(address t, bool make) external {
      if (make) {
        (bool ok, bytes data) = t.call(abi.encodeWithSelector(0x${setSelector}, 3, 3));
        require(ok);
      }
      runs = runs + 1;
    }
    function rawNever(address t) external {
      if (int(block.difficulty) < 0) {
        (bool ok, bytes data) = t.call(abi.encodeWithSelector(0x${setSelector}, 4, 4));
        require(ok);
      }
      runs = runs + 1;
    }
    function typedTimes(IT t, int n) external {
      for (int i = 0; i < n; i++) { t.set(5, 5); }
      runs = runs + 1;
    }
    function typedIf(IT t, bool make) external {
      int seen = t.get();
      if (make) { t.set(3, 3); }
      runs = runs + 1 + seen;
    }
  }`;

// With `callBatch`, T carries its multi-call entry, through which R's calls in a loop run as frames of one spend.
const compileOptions = (primary: string, callBatch = false): never => ({
  deployer: true, genesisCalls: true, messageBus: false, primaryContractName: primary,
  ...(callBatch && { callBatch: true }),
}) as never;

let serial = 0x7e00;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };
/** Each of R's calls as `withExternalCall(T, functionName, args)` lists it. */
type Listed = ReadonlyArray<readonly [functionName: string, args: unknown[]]>;
type TState = { height?: bigint; clock?: bigint; calls?: bigint };

const same = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);
const spends = (sent: Sent, lock: Uint8Array): boolean => sent.sourceOutputs
  .some((output) => same(output.lockingBytecode, lock));

interface Chain {
  /** R's function `name`, sent by a wallet with T listed explicitly as the callee of each of R's calls, in order. */
  outcome(name: string, args: unknown[], listed: Listed): Promise<{ text: string; error?: unknown }>;
  sentCount(): number;
  tState(): Promise<Required<TState>>;
  runs(): Promise<bigint>;
  tLock: Uint8Array;
}

async function chain(callBatch = false): Promise<Chain> {
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
  const tArtifact = compileString(source('00000000'), compileOptions('T', callBatch));
  const setSelector = tArtifact.abi.find((fn) => fn.name === 'set')!.selector!.replace(/^0x/, '');
  const deploy = async (artifact: Artifact): Promise<DeployResult<Artifact>> => {
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    return StatefulContract.deploy(artifact, [] as never, {
      provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
    } as never);
  };
  const t = await deploy(tArtifact);
  const r = await deploy(compileString(source(setSelector), compileOptions('R')));
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
    name: string, args: unknown[], listed: Listed,
  ): Promise<{ text: string; error?: unknown }> => {
    try {
      let call = (r.contract.connect(wallet) as any).call[name](...args);
      for (const [functionName, callArgs] of listed) call = call.withExternalCall(t.contract, functionName, callArgs);
      await call.send();
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

describe('R\'s raw call to T, with T listed by withExternalCall(), under a guard', () => {
  it('makes the listed call when its guard holds, and refuses it by name, before sending, when the guard is false',
    async () => {
      const c = await chain();
      const made = await c.outcome('rawIf', [c.tLock, true], [['set', [3n, 3n]]]);
      expect(made.text).toBe('sent; T spent; T 3/3/1');
      expect(await c.runs()).toBe(1n);

      const before = c.sentCount();
      const skipped = await c.outcome('rawIf', [c.tLock, false], [['set', [3n, 3n]]]);
      expect(skipped.text).toMatch(/^refused: R\.rawIf's call of T\.set \(line \d+\) is listed with withExternalCall\(\), /);
      expect(skipped.text).toContain('`make`');
      expect(skipped.error).toBeInstanceOf(ListedCallNotMadeError);
      expect(c.sentCount()).toBe(before);
      expect(await c.tState()).toEqual({ height: 3n, clock: 3n, calls: 1n });
      expect(await c.runs()).toBe(1n);
    });

  // A typed call in a loop runs as frames of T's multi-call spend on the direct convention. The frames are planned from
  // the loop's turns, the listed slot's too: a loop that does not turn spends no frame, and T stays unspent.
  it('a listed typed call in a loop: T stays unspent when the loop does not turn, and is called when it turns once',
    async () => {
      const c = await chain(true);
      const skipped = await c.outcome('typedTimes', [c.tLock, 0n], [['set', [5n, 5n]]]);
      expect(skipped.text).toBe('sent; T not spent; T 0/0/0');
      expect(await c.runs()).toBe(1n);

      const made = await c.outcome('typedTimes', [c.tLock, 1n], [['set', [5n, 5n]]]);
      expect(made.text).toBe('sent; T spent; T 5/5/1');
      expect(await c.runs()).toBe(2n);
    });

  // get() and set() form a counted frame group of T's multi-call spend. With the guard false the planner drops the
  // listed set's frame: T runs get() alone, as a standalone spend, and set() does not run.
  it('a listed typed call of a frame group under a false guard is left out: T runs only the call R makes',
    async () => {
      const c = await chain(true);
      const made = await c.outcome('typedIf', [c.tLock, true], [['get', []], ['set', [3n, 3n]]]);
      expect(made.text).toBe('sent; T spent; T 3/3/1');
      expect(await c.runs()).toBe(1n);

      // get() reads calls = 1, so R's runs goes from 1 to 3; T keeps 3/3/1.
      const skipped = await c.outcome('typedIf', [c.tLock, false], [['get', []], ['set', [3n, 3n]]]);
      expect(skipped.text).toBe('sent; T spent; T 3/3/1');
      expect(await c.runs()).toBe(3n);
    });

  it('refuses by name, before sending, a listed call under a guard the compiler cannot publish', async () => {
    const c = await chain();
    const before = c.sentCount();
    const { text, error } = await c.outcome('rawNever', [c.tLock], [['set', [4n, 4n]]]);
    expect(text).toMatch(/^refused: R\.rawNever's call of T\.set \(line \d+\) cannot be built: it runs only under a /);
    expect(error).toBeInstanceOf(CallGuardUndecidedError);
    expect(c.sentCount()).toBe(before);
    expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
    expect(await c.runs()).toBe(0n);
  });
});
