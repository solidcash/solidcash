/**
 * Whether the transaction's own contract R makes a call, decided before the transaction is built, on the direct
 * convention (R calls T when its guard holds). A guard the SDK can evaluate in R's frame (an earlier call's result,
 * block.number) decides it: false leaves T unspent and as it was, true calls T. A guard the SDK cannot evaluate
 * leaves the call planned. For a typed call that is safe: R pins a caller edge for each call it makes and counts the
 * edges it pinned, so when the guard is false R's own covenant refuses the edge the build laid, and nothing lands.
 * A raw call to a callee that reads no msg.sender carries no edge, so nothing in R would refuse T running uncalled:
 * that call is refused by name. Each sent transaction is checked by the VM.
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

const source = (setSelector: string): string => `pragma solidcash ^0.52.0;
  interface IT { function set(int h, int c) external; }
  interface IU { function get() external returns (int); }
  contract T { int height; int clock; int calls;
    function set(int h, int c) external { height = h; clock = c; calls = calls + 1; } }
  contract U { int n; function get() external returns (int) { return n + 7; } }
  contract R { int runs;
    function typedNever(IT t) external {
      if (int(block.difficulty) < 0) { t.set(1, 1); }
      runs = runs + 1;
    }
    function typedAlways(IT t) external {
      if (int(block.difficulty) >= 0) { t.set(2, 2); }
      runs = runs + 1;
    }
    function rawNever(address t) external {
      if (int(block.difficulty) < 0) {
        (bool ok, bytes data) = t.call(abi.encodeWithSelector(0x${setSelector}, 3, 3));
        require(ok);
      }
      runs = runs + 1;
    }
    function rawAlways(address t) external {
      if (int(block.difficulty) >= 0) {
        (bool ok, bytes data) = t.call(abi.encodeWithSelector(0x${setSelector}, 4, 4));
        require(ok);
      }
      runs = runs + 1;
    }
    function byResult(IU u, IT t, int atLeast) external { if (u.get() >= atLeast) { t.set(5, 5); } runs = runs + 1; }
    function byHeight(IT t, int atLeast) external { if (int(block.number) >= atLeast) { t.set(6, 6); } runs = runs + 1; }
  }`;

const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, primaryContractName: primary,
}) as never;

let serial = 0x6e00;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };
type TState = { height?: bigint; clock?: bigint; calls?: bigint };

const same = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);
const spends = (sent: Sent, lock: Uint8Array): boolean => sent.sourceOutputs
  .some((output) => same(output.lockingBytecode, lock));

interface Chain {
  /** R's function `name`, sent by a wallet with T and U resolved from R's connections and the deployments. */
  send(name: string, args: unknown[]): Promise<Sent>;
  /** The send written out whole: refused with its message, or sent with what it did to T. */
  outcome(name: string, args: unknown[]): Promise<{ text: string; error?: unknown }>;
  sentCount(): number;
  tState(): Promise<Required<TState>>;
  runs(): Promise<bigint>;
  tLock: Uint8Array;
  uLock: Uint8Array;
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
  const r = await deploy(compileString(source(setSelector), compileOptions('R')));
  const wallet = new Signer(alicePriv, provider);
  for (let coin = 0; coin < 16; coin += 1) {
    await provider.seedUtxo(wallet.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
  }
  const [tLock, uLock, rLock] = [t, u, r].map((deployed) => addressToLockScript(deployed.contract.address));
  // R names T and U under the interfaces it calls them through; a raw call finds T by its deployed address.
  const register = r.contract as unknown as { _registerResolvedExternal(name: string, contract: unknown): void };
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
    await (r.contract.connect(wallet) as any).call[name](...args).send();
    const last = sent[sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(provider).verify(last as never)).toBe(true);
    expect(spends(last, rLock)).toBe(true);
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
  const runs = async (): Promise<bigint> => ((await r.contract.getState()) as { runs?: bigint }).runs ?? 0n;
  return { send, outcome, sentCount: () => sent.length, tState, runs, tLock, uLock };
}

describe('the transaction\'s own contract calls T when its guard holds (R calls T)', () => {
  it('a typed call under a guard the compiler cannot publish: refused by R\'s own covenant when the guard is false, '
    + 'made when it is true', async () => {
    const c = await chain();
    // block.difficulty is never negative: R never makes this call, and the edge the build lays for it is one R did
    // not pin, which R's count refuses at its own input.
    const before = c.sentCount();
    const never = await c.outcome('typedNever', [c.tLock]);
    expect(never.text).toMatch(/^refused: .*preflight failed at input 0: Program failed an OP_VERIFY operation/);
    expect(c.sentCount()).toBe(before);
    expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
    expect(await c.runs()).toBe(0n);

    const always = await c.outcome('typedAlways', [c.tLock]);
    expect(always.text).toBe('sent; T spent; T 2/2/1');
    expect(await c.runs()).toBe(1n);
  });

  it('refuses by name, before sending, a raw call under a guard the compiler cannot publish, whatever it holds',
    async () => {
      const c = await chain();
      const before = c.sentCount();
      for (const name of ['rawNever', 'rawAlways']) {
        const { text, error } = await c.outcome(name, [c.tLock]);
        expect(text).toMatch(new RegExp(`^refused: R\\.${name}'s call of T\\.set \\(line \\d+\\) cannot be built: it `
          + 'runs only under a guard the compiler publishes no form of'));
        expect(error).toBeInstanceOf(CallGuardUndecidedError);
      }
      expect(c.sentCount()).toBe(before);
      expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
      expect(await c.runs()).toBe(0n);
    });

  it('decides guards it can evaluate: an earlier call\'s result and block.number, each false then true', async () => {
    const c = await chain();
    // U.get() answers 7.
    expect((await c.outcome('byResult', [c.uLock, c.tLock, 8n])).text).toBe('sent; T not spent; T 0/0/0');
    expect((await c.outcome('byResult', [c.uLock, c.tLock, 7n])).text).toBe('sent; T spent; T 5/5/1');
    expect((await c.outcome('byHeight', [c.tLock, 1_000_000_000n])).text).toBe('sent; T not spent; T 5/5/1');
    expect((await c.outcome('byHeight', [c.tLock, 0n])).text).toBe('sent; T spent; T 6/6/2');
    expect(await c.runs()).toBe(4n);
  });
});
