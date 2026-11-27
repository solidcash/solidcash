/**
 * Whether a called contract makes a call of its own, decided before the transaction is built (A calls D, which calls T
 * when its guard holds), on the direct convention. A guard that reads the result of D's earlier call is decided as the
 * root decides its own: the SDK runs that call and reads its result, so a false guard leaves T unspent and as it was,
 * and a true one calls T. A guard the SDK cannot evaluate leaves a typed call planned, which is safe: D pins a caller
 * edge for it and counts the edges it pinned, so when the guard is false D's own covenant refuses the edge the build
 * laid, and nothing lands. A raw call to a contract that reads no msg.sender carries no edge, so it is refused by name.
 * Each sent transaction is checked by the VM.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { CallGuardUndecidedError, SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract, registerDeployment } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const source = (setSelector: string): string => `pragma solidcash ^0.53.0;
  interface IT { function set(int h, int c) external; }
  interface IU { function get() external returns (int); }
  interface ID {
    function byResult(IU u, IT t, int atLeast) external;
    function byDifficulty(IT t, int atLeast) external;
    function rawByDifficulty(address t, int atLeast) external;
  }
  contract T { int height; int clock; int calls;
    function set(int h, int c) external { height = h; clock = c; calls = calls + 1; } }
  contract U { int n; function get() external returns (int) { return n + 7; } }
  contract D { int runs;
    function byResult(IU u, IT t, int atLeast) external { if (u.get() >= atLeast) { t.set(4, 4); } runs = runs + 1; }
    function byDifficulty(IT t, int atLeast) external {
      if (int(block.difficulty) >= atLeast) { t.set(5, 5); }
      runs = runs + 1;
    }
    function rawByDifficulty(address t, int atLeast) external {
      if (int(block.difficulty) >= atLeast) {
        (bool ok, bytes data) = t.call(abi.encodeWithSelector(0x${setSelector}, 6, 6));
        require(ok);
      }
      runs = runs + 1;
    } }
  contract A { int runs;
    function byResult(ID d, IU u, IT t, int atLeast) external { d.byResult(u, t, atLeast); runs = runs + 1; }
    function byDifficulty(ID d, IT t, int atLeast) external { d.byDifficulty(t, atLeast); runs = runs + 1; }
    function rawByDifficulty(ID d, address t, int atLeast) external { d.rawByDifficulty(t, atLeast); runs = runs + 1; } }`;

const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, primaryContractName: primary,
}) as never;

// A floor no mock block's difficulty reaches.
const OUT_OF_REACH = 1n << 200n;

let serial = 0x6c00;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };
type TState = { height?: bigint; clock?: bigint; calls?: bigint };

const same = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);
const spends = (sent: Sent, lock: Uint8Array): boolean => sent.sourceOutputs
  .some((output) => same(output.lockingBytecode, lock));

interface Chain {
  d: DeployResult<Artifact>;
  /** A's function `name`, sent by a wallet; it rejects with the build's refusal, if any. */
  send(name: string, args: unknown[]): Promise<Sent>;
  /** The send written out whole: refused with its message, or sent with what it did to T. */
  outcome(name: string, args: unknown[]): Promise<{ text: string; error?: unknown }>;
  sentCount(): number;
  tState(): Promise<Required<TState>>;
  runs(deployed: DeployResult<Artifact>): Promise<bigint>;
  tLock: Uint8Array;
  uLock: Uint8Array;
  dLock: Uint8Array;
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
  const tArtifact = compileString(source('00000000'), compileOptions('T'));
  const setSelector = tArtifact.abi.find((fn) => fn.name === 'set')!.selector!.replace(/^0x/, '');
  const deploy = async (artifact: Artifact): Promise<DeployResult<Artifact>> => {
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    return StatefulContract.deploy(artifact, [] as never, {
      provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
    } as never);
  };
  const t = await deploy(tArtifact);
  const u = await deploy(compileString(source(setSelector), compileOptions('U')));
  const d = await deploy(compileString(source(setSelector), compileOptions('D')));
  const a = await deploy(compileString(source(setSelector), compileOptions('A')));
  const wallet = new Signer(alicePriv, provider);
  for (let coin = 0; coin < 16; coin += 1) {
    await provider.seedUtxo(wallet.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
  }
  const [tLock, uLock, dLock] = [t, u, d].map((deployed) => addressToLockScript(deployed.contract.address));
  // D names T and U under the interfaces it calls them through; a raw call finds T by its deployed address.
  const register = d.contract as unknown as { _registerResolvedExternal(name: string, contract: unknown): void };
  register._registerResolvedExternal('IT', t.contract);
  register._registerResolvedExternal('IU', u.contract);
  registerDeployment(provider, {
    contractName: 'T', address: t.contract.target, lockingBytecode: binToHex(tLock), contract: t.contract,
  } as never);
  const tState = async (): Promise<Required<TState>> => {
    const state = (await t.contract.getState()) as TState;
    return { height: state.height ?? 0n, clock: state.clock ?? 0n, calls: state.calls ?? 0n };
  };
  const send = async (name: string, args: unknown[]): Promise<Sent> => {
    await (a.contract.connect(wallet) as any).call[name](...args).withExternalCall(d.contract).send();
    const last = sent[sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(provider).verify(last as never)).toBe(true);
    // The call itself: A's call of D spends D.
    expect(spends(last, dLock)).toBe(true);
    return last;
  };
  const outcome = async (name: string, args: unknown[]): Promise<{ text: string; error?: unknown }> => {
    try {
      const last = await send(name, args);
      const state = await tState();
      return { text: `sent; T ${spends(last, tLock) ? '' : 'not '}spent; T ${state.height}/${state.clock}/${state.calls}` };
    } catch (error) {
      return { text: `refused: ${(error as Error).message}`, error };
    }
  };
  const runs = async (deployed: DeployResult<Artifact>): Promise<bigint> => (
    ((await deployed.contract.getState()) as { runs?: bigint }).runs ?? 0n);
  return { d, send, outcome, sentCount: () => sent.length, tState, runs, tLock, uLock, dLock };
}

describe('a called contract\'s call under a guard the SDK decides, or refuses, before building (A calls D, which calls '
  + 'T when its guard holds)', () => {
  it('decides D\'s call from the result of D\'s earlier call, which the SDK runs as the root runs its own: T unspent '
    + 'when the guard is false, called when it is true', async () => {
    const c = await chain();

    // U.get() answers 7, and 7 >= 8 is false: D calls U, not T.
    const unmet = await c.send('byResult', [c.dLock, c.uLock, c.tLock, 8n]);
    expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
    expect(spends(unmet, c.tLock)).toBe(false);
    expect(spends(unmet, c.uLock)).toBe(true);
    expect(await c.runs(c.d)).toBe(1n);

    // 7 >= 7 is true: D calls T.
    const met = await c.send('byResult', [c.dLock, c.uLock, c.tLock, 7n]);
    expect(spends(met, c.tLock)).toBe(true);
    expect(await c.tState()).toEqual({ height: 4n, clock: 4n, calls: 1n });
    expect(await c.runs(c.d)).toBe(2n);
  });

  it('keeps a typed call under a guard the compiler cannot publish: refused by D\'s own covenant when the guard is '
    + 'false, made when it is true', async () => {
    const c = await chain();
    const before = c.sentCount();
    const never = await c.outcome('byDifficulty', [c.dLock, c.tLock, OUT_OF_REACH]);
    expect(never.text).toMatch(/^refused: .*preflight failed at input \d+: Program failed an OP_VERIFY operation/);
    expect(c.sentCount()).toBe(before);
    expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
    expect(await c.runs(c.d)).toBe(0n);

    expect((await c.outcome('byDifficulty', [c.dLock, c.tLock, 0n])).text).toBe('sent; T spent; T 5/5/1');
    expect(await c.runs(c.d)).toBe(1n);
  });

  it('refuses by name, before sending, a raw call under a guard the compiler cannot publish, whatever it holds',
    async () => {
      const c = await chain();
      const before = c.sentCount();
      for (const atLeast of [0n, OUT_OF_REACH]) {
        const { text, error } = await c.outcome('rawByDifficulty', [c.dLock, c.tLock, atLeast]);
        expect(text).toMatch(/^refused: D\.rawByDifficulty's call of T\.set \(line \d+\) cannot be built: it runs only /);
        expect(text).toContain('under a guard the compiler publishes no form of, so the SDK cannot tell before it '
          + 'builds the transaction whether D makes the call. Spending T on a guess would let it run without being '
          + 'called when the guard is false.');
        expect(error).toBeInstanceOf(CallGuardUndecidedError);
      }
      expect(c.sentCount()).toBe(before);
      expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
      expect(await c.runs(c.d)).toBe(0n);
    });
});
