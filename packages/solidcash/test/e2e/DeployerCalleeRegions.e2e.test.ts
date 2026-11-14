/**
 * A7, A14 item 5: a constructor's callee whose block a run sizes, or whose call reaches other contracts, takes the block
 * of its ordinary call's build: the entries, inserts, payments and events of a loop, a dynamic array's chunks, an entry a
 * branch deletes (DS-6), the blocks of the contracts it calls or reads, and the oracle pool coins its block reads
 * co-spend. Each creation is checked by the VM; each tamper case changes one output of a finished creation and expects
 * the input that pins it to refuse. The shapes the build cannot give a creation are refused before anything is sent.
 *
 * The ordinary build of a loop's payments fails on the production profile (the same call fails as an ordinary call
 * there), so those cases run on the relaxed mock, whose minted coins only pad the build: the creation spends none.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { broadcastDeployerPreps, buildDeployerPrep, DeployerCalleeError } from '../../src/stateful/deployer.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.50.0;';
const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, messageBus: false, primaryContractName: primary,
}) as never;

let serial = 0xc00;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Captured = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

interface Setup {
  provider: MockNetworkProvider;
  deploy(artifact: Artifact, extra?: Record<string, unknown>): Promise<DeployResult<Artifact>>;
  wallet(): Promise<Signer>;
  /** The creation of `artifact` with `extra`, captured instead of broadcast; its prep is broadcast. */
  capture(artifact: Artifact, extra: Record<string, unknown>): Promise<Captured>;
  /** Every transaction sent so far, with the outputs its inputs spend. */
  sent: Captured[];
}

function setup(profile: 'production' | 'relaxed' = 'production'): Setup {
  const provider = profile === 'production' ? new MockNetworkProvider({ profile: 'production' }) : new MockNetworkProvider();
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const fund = async (): Promise<Utxo> => {
    const utxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), utxo);
    return utxo;
  };
  const sent: Captured[] = [];
  let capturing: Artifact | undefined;
  let captured: Captured | undefined;
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
    if (capturing !== undefined && sourceOutputs.some((output) => (
      binToHex(output.lockingBytecode) === capturing!.deployer!.lockingBytecode))) {
      captured = { transaction, sourceOutputs };
      throw new Error('creation captured');
    }
    sent.push({ transaction, sourceOutputs });
    return original(hex);
  };
  const deploy = async (artifact: Artifact, extra: Record<string, unknown> = {}): Promise<DeployResult<Artifact>> => (
    StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await fund(), funder, changeAddress: change.address, senderLockingBytecode: authorLock,
      ...extra,
    } as never));
  const wallet = async (): Promise<Signer> => {
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
    }
    return signer;
  };
  const capture = async (artifact: Artifact, extra: Record<string, unknown>): Promise<Captured> => {
    const fundingUtxo = await fund();
    const { prep } = await buildDeployerPrep({
      children: [{ deployer: artifact.deployer!, contractName: artifact.contractName }],
      fundingUtxos: [fundingUtxo], authorSigner: funder, authorLockingBytecode: authorLock,
      changeLockingBytecode: authorLock, provider,
    });
    await broadcastDeployerPreps([prep], provider);
    capturing = artifact;
    captured = undefined;
    try {
      await expect(StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
        deployerPrep: prep, ...extra,
      } as never)).rejects.toThrow('creation captured');
    } finally {
      capturing = undefined;
    }
    return captured!;
  };
  return { provider, deploy, wallet, capture, sent };
}

/** The P2PKH locks a captured creation pays: the wallet's change and the payees a callee names, nothing else. */
const p2pkhPaid = (captured: Captured): Set<string> => new Set(captured.transaction.outputs
  .map((output) => binToHex(output.lockingBytecode)).filter((lock) => lock.startsWith('76a914')));
const walletLock = binToHex(encodeLockingBytecodeP2pkh(alicePkh));

/** The VM's verdict on one input of a captured creation. */
function inputPasses(provider: MockNetworkProvider, captured: Captured, inputIndex: number): boolean {
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ ...captured, inputIndex } as never) as never) === true;
}

/** `captured` with output `index` replaced. */
function withOutput(captured: Captured, index: number, change: (output: any) => any): Captured {
  return {
    sourceOutputs: captured.sourceOutputs,
    transaction: {
      ...captured.transaction,
      outputs: captured.transaction.outputs.map((output, at) => (at === index ? change(output) : output)),
    },
  };
}

/** The same output with the last byte of its NFT commitment changed, or one byte where it held none. */
const bumpCommitment = (output: any): any => {
  const commitment: Uint8Array = output.token.nft.commitment.length === 0
    ? Uint8Array.of(1) : Uint8Array.from(output.token.nft.commitment);
  if (output.token.nft.commitment.length > 0) commitment[commitment.length - 1] ^= 1;
  return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
};

const same = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);
const masterInput = (captured: Captured, lock: Uint8Array): number => captured.sourceOutputs
  .findIndex((output) => same(output.lockingBytecode, lock));
/** The indexes of the outputs at `lock`. */
const outputsAt = (captured: Captured, lock: Uint8Array): number[] => captured.transaction.outputs
  .map((output, index) => (same(output.lockingBytecode, lock) ? index : -1)).filter((index) => index >= 0);

describe('a callee that writes and inserts a mapping in a loop (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f(int k) external returns (bool); }
    contract T { mapping(int => int) m; function put(int k, int v) public { m[k] = v; }
      function f(int k) external returns (bool) { for (int i = 0; i < k; i++) { m[i] = i + 1; } return true; } }
    contract C { bool ok; constructor(I t, int k) { ok = t.f(k); } function read() { require(ok); } }`;

  it('updates the present key and inserts the others, and refuses a creation that changes an entry', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    await (t.contract.connect(await s.wallet()) as any).call.put(1n, 50n).send();
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(SOURCE, compileOptions('C'));
    const extra = { initArgs: [tLock, 3n], constructorCallees: [{ contract: t.contract }] };

    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    const master = masterInput(captured, tLock);
    const { getEntryNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const entries = outputsAt(captured, addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'm')));
    // Keys 0 and 2 are inserted beside the head and key 1's node: four entry outputs in all.
    expect(entries).toHaveLength(4);
    for (const index of entries) {
      expect(inputPasses(s.provider, withOutput(captured, index, bumpCommitment), master)).toBe(false);
    }

    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
    for (const k of [0n, 1n, 2n]) expect(await (t.contract as any).m(k)).toBe(k + 1n);
  });
});

describe('a callee that pushes onto a dynamic array (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f(int x) external returns (int); }
    contract T { int[] a; function f(int x) external returns (int) { a.push(x); a.push(x + 1); return a.length; } }
    contract C { int got; constructor(I t, int x) { got = t.f(x); } function read() { require(got > 0); } }`;

  it('lays out the new chunk, and refuses a creation whose chunk holds other elements', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(SOURCE, compileOptions('C'));
    const extra = { initArgs: [tLock, 5n], constructorCallees: [{ contract: t.contract }] };

    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    const master = masterInput(captured, tLock);
    const { getDataNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const dataLock = addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId));
    // The array's chunks: T's mutable NFTs at neither its master's lock nor its records'.
    const chunks = captured.transaction.outputs.map((output, index) => ({ output, index }))
      .filter(({ output }) => output.token !== undefined && binToHex(output.token.category) === t.categoryId
        && output.token.nft?.capability === 'mutable' && !same(output.lockingBytecode, dataLock)
        && !same(output.lockingBytecode, tLock)).map(({ index }) => index);
    expect(chunks.length).toBeGreaterThan(0);
    expect(inputPasses(s.provider, withOutput(captured, chunks[0]!, bumpCommitment), master)).toBe(false);

    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { got?: bigint }).got).toBe(2n);
  });
});

describe('a callee that deletes an entry in a branch (DS-6; A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f(int k, int sel) external returns (bool); }
    contract T { mapping(int => int) m; function put(int k, int v) public { m[k] = v; }
      function f(int k, int sel) external returns (bool) { if (sel > 0) { require(k != 3); delete m[k]; } return true; } }
    contract C { bool ok; constructor(I t, int k, int sel) { ok = t.f(k, sel); } function read() { require(ok); } }`;

  for (const sel of [1n, 0n]) {
    it(`${sel > 0n ? 'deletes' : 'keeps'} the entry, and refuses a creation that keeps another value`, async () => {
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      await (t.contract.connect(await s.wallet()) as any).call.put(5n, 50n).send();
      const tLock = addressToLockScript(t.contract.address);
      const c = compileString(SOURCE, compileOptions('C'));
      const extra = { initArgs: [tLock, 5n, sel], constructorCallees: [{ contract: t.contract }] };
      const captured = await s.capture(c, extra);
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
      expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
      const { getEntryNftAddress } = await import('../../src/stateful/covenant-helpers.js');
      const entries = outputsAt(captured, addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'm')));
      const master = masterInput(captured, tLock);
      for (const index of entries) {
        expect(inputPasses(s.provider, withOutput(captured, index, bumpCommitment), master)).toBe(false);
      }
      await s.deploy(c, extra);
      expect(await (t.contract as any).m(5n)).toBe(sel > 0n ? 0n : 50n);
    });
  }
});

describe('a callee that reads the block from its oracle pool (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f() external returns (int); }
    contract T { int n; function f() external returns (int) { n = int(block.number); return n; } }
    contract C { int got; constructor(I t) { got = t.f(); } function read() { require(got > 0); } }`;

  it('co-spends the pool\'s info coin, and refuses a creation that records another height', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(SOURCE, compileOptions('C'));
    const extra = { initArgs: [tLock], constructorCallees: [{ contract: t.contract }] };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    const pool = (t.contract.inner as unknown as { oraclePool: string }).oraclePool;
    const info = captured.sourceOutputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === pool && output.token.nft?.commitment[0] === 0);
    expect(info).toBeGreaterThan(0);
    const master = masterInput(captured, tLock);
    const { getDataNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const [record] = outputsAt(captured, addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId)));
    expect(inputPasses(s.provider, withOutput(captured, record!, bumpCommitment), master)).toBe(false);

    const created = await s.deploy(c, extra);
    const n = ((await t.contract.getState()) as { n?: bigint }).n!;
    expect(n).toBe(BigInt(await s.provider.getBlockHeight()));
    expect(((await created.contract.getState()) as { got?: bigint }).got).toBe(n);
  });

  it('builds the creation again when a block between its prep and itself moves the info coin', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const c = compileString(SOURCE, compileOptions('C'));
    const pool = (t.contract.inner as unknown as { oraclePool: string }).oraclePool;
    const infoCoins = async (): Promise<string[]> => (await s.provider.getUtxosByTokenCategory(pool))
      .filter((utxo) => utxo.token?.nft?.commitment.startsWith('00')).map((utxo) => `${utxo.txid}:${utxo.vout}`);
    const before = await infoCoins();
    // A block arrives right after the prep: the pool's keeper moves every info coin to the new height.
    const send = s.provider.sendRawTransaction.bind(s.provider);
    let sends = 0;
    (s.provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      const txid = await send(hex);
      sends += 1;
      if (sends === 1) await s.provider.mine(1);
      return txid;
    };
    const height = await s.provider.getBlockHeight();
    const created = await s.deploy(c, {
      initArgs: [addressToLockScript(t.contract.address)], constructorCallees: [{ contract: t.contract }],
    });
    expect(sends).toBe(2);
    const creation = s.sent[s.sent.length - 1]!;
    const spent = creation.transaction.inputs.map((input) => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(spent.some((outpoint) => before.includes(outpoint))).toBe(false);
    expect(((await created.contract.getState()) as { got?: bigint }).got).toBe(BigInt(height + 1));
  });
});

describe('a callee that reads a block hash from its oracle pool (A7, A14 item 5)', () => {
  it('co-spends the ring slot and the info coin, and refuses a creation that records another hash', async () => {
    const source = `${P} interface I { function f() external returns (bool); }
      contract T { bytes32 h; function f() external returns (bool) { h = blockhash(block.number - 1); return true; } }
      contract C { bool ok; constructor(I t) { ok = t.f(); } function read() { require(ok); } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(source, compileOptions('C'));
    const extra = { initArgs: [tLock], constructorCallees: [{ contract: t.contract }] };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    const { getDataNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const [record] = outputsAt(captured, addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId)));
    expect(inputPasses(s.provider, withOutput(captured, record!, bumpCommitment), masterInput(captured, tLock))).toBe(false);
    await s.deploy(c, extra);
    const h = ((await t.contract.getState()) as { h?: Uint8Array }).h!;
    expect(h).toHaveLength(32);
    expect(binToHex(h)).not.toBe('00'.repeat(32));
  });
});

describe('a callee that calls or reads another contract (A7, A14 item 5)', () => {
  const U = `${P} contract U { int calls; int v; constructor() { v = 17; }
    function g(int x) external returns (int) { calls = calls + 1; return x * 2; }
    function value() external returns (int) { return v; } }`;
  const SOURCE = `${P} interface IU { function g(int x) external returns (int); function value() external returns (int); }
    interface I { function f(IU u, int x) external returns (int); function r(IU u) external returns (int); }
    contract T { int n; function f(IU u, int x) external returns (int) { n = u.g(x); return n; }
      function r(IU u) external returns (int) { n = u.value() + 1; return n; } }
    contract C { int got; constructor(I t, IU u, int x) { got = t.f(u, x); } function read() { require(got > 0); } }
    contract D { int got; constructor(I t, IU u) { got = t.r(u); } function read() { require(got > 0); } }`;

  it('lays out the nested callee\'s block, and refuses a creation whose nested record is another', async () => {
    const s = setup();
    const u = await s.deploy(compileString(U, compileOptions('U')));
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const tLock = addressToLockScript(t.contract.address);
    const uLock = addressToLockScript(u.contract.address);
    const c = compileString(SOURCE, compileOptions('C'));
    const extra = {
      initArgs: [tLock, uLock, 21n], constructorCallees: [{ contract: t.contract, externalContracts: [u.contract] }],
    };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    // U's own call record: a carrier of U's category at lock 51, which T reads and compares.
    const uCategory = u.categoryId;
    const carrier = captured.transaction.outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === uCategory && binToHex(output.lockingBytecode) === '51');
    expect(carrier).toBeGreaterThan(0);
    const tampered = withOutput(captured, carrier, bumpCommitment);
    expect(inputPasses(s.provider, tampered, masterInput(captured, tLock))).toBe(false);

    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { got?: bigint }).got).toBe(42n);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(42n);
    expect(((await u.contract.getState()) as { calls?: bigint }).calls).toBe(1n);
  });

  it('lays out a read of another contract', async () => {
    const s = setup();
    const u = await s.deploy(compileString(U, compileOptions('U')));
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const d = await s.deploy(compileString(SOURCE, compileOptions('D')), {
      initArgs: [addressToLockScript(t.contract.address), addressToLockScript(u.contract.address)],
      constructorCallees: [{ contract: t.contract, externalContracts: [u.contract] }],
    });
    expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(18n);
  });
});

describe('a callee that pays from a loop (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f(int k, bytes20 to) external returns (bool); }
    contract T { int n; function f(int k, bytes20 to) external returns (bool) {
      for (int i = 0; i < k; i++) { this.transfer(new LockingBytecodeP2PKH(to), 1000 + i * 7); } n = n + 1; return true; } }
    contract C { bool ok; constructor(I t, int k, bytes20 to) { ok = t.f(k, to); } function read() { require(ok); } }`;
  const payee = encodeLockingBytecodeP2pkh(bobPkh);

  it('lays out the loop\'s payments where the ordinary build gives them, and refuses a short one', async () => {
    // The relaxed mock lends the ordinary build its pads; the creation replaces each with a wallet coin.
    const s = setup('relaxed');
    await s.wallet();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const container = getSatoshiContainerAddress(t.contract.inner as never, t.categoryId);
    await s.provider.seedUtxo(container, { txid: nextTxid(), vout: 0, satoshis: 20_000n });
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(SOURCE, compileOptions('C'));
    const extra = { initArgs: [tLock, 3n, bobPkh], constructorCallees: [{ contract: t.contract }] };
    const captured = await s.capture(c, extra);
    // The stock VM, standard and with a real network's limits, accepts the creation.
    expect(createVirtualMachineBch2026(true).verify(captured as never)).toBe(true);
    const { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } = await import('@solidcash/utils');
    expect(captured.sourceOutputs.some((output) => binToHex(output.lockingBytecode)
      === BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX.toLowerCase())).toBe(false);
    expect([...p2pkhPaid(captured)].sort()).toEqual([walletLock, binToHex(payee)].sort());
    const payments = outputsAt(captured, payee);
    expect(payments.map((index) => captured.transaction.outputs[index]!.valueSatoshis)).toEqual([1000n, 1007n, 1014n]);
    const short = withOutput(captured, payments[1]!, (output) => ({ ...output, valueSatoshis: output.valueSatoshis - 1n }));
    expect(inputPasses(s.provider, short, masterInput(captured, tLock))).toBe(false);

    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
    expect((await s.provider.getUtxos(container)).map((utxo) => utxo.satoshis)).toEqual([20_000n - 3021n]);
  });

  it('lays out a loop that pays and emits, in the order the run makes them, and refuses another event', async () => {
    const source = `${P} interface I { function f(int k, bytes20 to) external returns (bool); }
      contract T { int n; event E(int i); function f(int k, bytes20 to) external returns (bool) {
        for (int i = 0; i < k; i++) { this.transfer(new LockingBytecodeP2PKH(to), 1000); emit E(i); } return true; } }
      contract C { bool ok; constructor(I t, int k, bytes20 to) { ok = t.f(k, to); } function read() { require(ok); } }`;
    const s = setup('relaxed');
    await s.wallet();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    await s.provider.seedUtxo(getSatoshiContainerAddress(t.contract.inner as never, t.categoryId), {
      txid: nextTxid(), vout: 0, satoshis: 20_000n,
    });
    const tLock = addressToLockScript(t.contract.address);
    const captured = await s.capture(compileString(source, compileOptions('C')), {
      initArgs: [tLock, 2n, bobPkh], constructorCallees: [{ contract: t.contract }],
    });
    expect(createVirtualMachineBch2026(true).verify(captured as never)).toBe(true);
    const { getEventNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const events = outputsAt(captured, addressToLockScript(getEventNftAddress(t.contract.inner as never, t.categoryId, 'E(int256)')));
    const payments = outputsAt(captured, payee);
    // Each iteration pays, then emits: payment, event, payment, event.
    expect(events).toHaveLength(2);
    expect(payments).toEqual([events[0]! - 1, events[1]! - 1]);
    expect(inputPasses(s.provider, withOutput(captured, events[1]!, bumpCommitment), masterInput(captured, tLock)))
      .toBe(false);
  });

  // The ordinary call path builds runtime-loop payments under the production limits, so the callee's block builds too.
  it('builds the loop\'s payments on the production profile as well', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    await s.provider.seedUtxo(getSatoshiContainerAddress(t.contract.inner as never, t.categoryId), {
      txid: nextTxid(), vout: 0, satoshis: 20_000n,
    });
    // Real limits lend no pads: the callee block's padding takes plain wallet coins at the funder's lock.
    for (let coin = 0; coin < 6; coin += 1) {
      await s.provider.seedUtxo(binToHex(encodeLockingBytecodeP2pkh(alicePkh)), {
        txid: nextTxid(), vout: 0, satoshis: 10_000n,
      });
    }
    const before = s.sent.length;
    const created = await s.deploy(compileString(SOURCE, compileOptions('C')), {
      initArgs: [addressToLockScript(t.contract.address), 3n, bobPkh], constructorCallees: [{ contract: t.contract }],
    });
    expect(created.categoryId).toMatch(/^[0-9a-f]{64}$/);
    expect(s.sent.length).toBeGreaterThan(before);
  });
});

describe('a creating call whose child\'s callee writes a mapping in a loop (A7, A14 item 4)', () => {
  it('lays out the callee\'s loop entries after the creator\'s layout', async () => {
    const source = `interface I { function f(int k) external returns (bool); }
      contract T { mapping(int => int) m; function f(int k) external returns (bool) {
        for (int i = 0; i < k; i++) { m[i] = i + 10; } return true; } }
      contract Child { bool ok; constructor(I t) { ok = t.f(2); } function read() { require(ok); } }
      contract Factory { int made; function make(I a) { new Child(a); made = made + 1; } }`;
    const s = setup();
    const artifacts = compileStringMulti(source, {
      allowUnsafeOperations: true, __deployerNew: true, genesisCalls: true,
    } as never);
    const t = await s.deploy(artifacts.T!, { initialState: {} });
    const factory = await s.deploy(artifacts.Factory!, { initialState: { made: 0n } });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await s.provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    // The callee's block takes plain coins of the paying wallet at its output-only indexes.
    await s.wallet();
    const result = await StatefulContract.deployFrom({
      provider: s.provider, factory: factory.contract, deployFunctionName: 'make',
      deployFunctionArgs: [addressToLockScript(t.contract.address)], childArtifacts: { Child: artifacts.Child! },
      fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: change.address,
      childCallees: [{ deployment: 0, callees: [{ contract: t.contract }] }],
    });
    expect(((await result.children![0]!.getState()) as { ok?: boolean }).ok).toBe(true);
    expect(await (t.contract as any).m(0n)).toBe(10n);
    expect(await (t.contract as any).m(1n)).toBe(11n);
    const creation = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(creation as never)).toBe(true);
  });
});

describe('a creating call whose child\'s callee reads the block (A7, A14 item 4)', () => {
  it('builds the creating call again when a block between its prep and itself moves the info coin', async () => {
    const source = `interface I { function f() external returns (int); }
      contract T { int n; function f() external returns (int) { n = int(block.number); return n; } }
      contract Child { int got; constructor(I t) { got = t.f(); } function read() { require(got > 0); } }
      contract Factory { int made; function make(I a) { new Child(a); made = made + 1; } }`;
    const s = setup();
    const artifacts = compileStringMulti(source, {
      allowUnsafeOperations: true, __deployerNew: true, genesisCalls: true,
    } as never);
    const t = await s.deploy(artifacts.T!, { initialState: {} });
    const factory = await s.deploy(artifacts.Factory!, { initialState: { made: 0n } });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await s.provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    await s.wallet();
    const pool = (t.contract.inner as unknown as { oraclePool: string }).oraclePool;
    const infoCoins = async (): Promise<string[]> => (await s.provider.getUtxosByTokenCategory(pool))
      .filter((utxo) => utxo.token?.nft?.commitment.startsWith('00')).map((utxo) => `${utxo.txid}:${utxo.vout}`);
    const before = await infoCoins();
    const send = s.provider.sendRawTransaction.bind(s.provider);
    let sends = 0;
    (s.provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      const txid = await send(hex);
      sends += 1;
      if (sends === 1) await s.provider.mine(1);
      return txid;
    };
    const height = await s.provider.getBlockHeight();
    const result = await StatefulContract.deployFrom({
      provider: s.provider, factory: factory.contract, deployFunctionName: 'make',
      deployFunctionArgs: [addressToLockScript(t.contract.address)], childArtifacts: { Child: artifacts.Child! },
      fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: change.address,
      childCallees: [{ deployment: 0, callees: [{ contract: t.contract }] }],
    });
    // The prep, then one creation: the first creation built was never sent.
    expect(sends).toBe(2);
    const creation = s.sent[s.sent.length - 1]!;
    const spent = creation.transaction.inputs.map((input) => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(spent.some((outpoint) => before.includes(outpoint))).toBe(false);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(creation as never)).toBe(true);
    expect(((await result.children![0]!.getState()) as { got?: bigint }).got).toBe(BigInt(height + 1));
  });
});

describe('callee shapes a constructor\'s call refuses (A7, A14 item 5)', () => {
  const refusal = async (source: string, args: (t: DeployResult<Artifact>) => unknown[]): Promise<{
    error: unknown; sentBefore: number; sentAfter: number;
  }> => {
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const sentBefore = s.sent.length;
    const error = await s.deploy(compileString(source, compileOptions('C')), {
      initArgs: args(t), constructorCallees: [{ contract: t.contract }],
    }).then(() => undefined, (caught: unknown) => caught);
    return { error, sentBefore, sentAfter: s.sent.length };
  };

  it('refuses a keccak256 loop, whose side-cars carry the callee\'s brand', async () => {
    const { error, sentBefore, sentAfter } = await refusal(`${P} interface I { function f(bytes b, int k) external returns (bool); }
      contract T { bytes32 h; function f(bytes b, int k) external returns (bool) {
        bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; return true; } }
      contract C { bool ok; constructor(I t, bytes b, int k) { ok = t.f(b, k); } function read() { require(ok); } }`,
    (t) => [addressToLockScript(t.contract.address), Uint8Array.of(1, 2), 2n]);
    expect(error).toBeInstanceOf(DeployerCalleeError);
    expect((error as Error).message)
      .toMatch(/hashes or recovers keys in a loop, whose side-cars its ordinary call takes from the pool branded/);
    expect(sentAfter).toBe(sentBefore);
  });

  it('refuses a sized block keyed by msg.sender, which only the genesis step resolves', async () => {
    const { error, sentBefore, sentAfter } = await refusal(`${P} interface I { function f(int x) external returns (bool); }
      contract T { int[] a; mapping(address => int) owner;
        function f(int x) external returns (bool) { a.push(x); owner[msg.sender] = x; return true; } }
      contract C { bool ok; constructor(I t, int x) { ok = t.f(x); } function read() { require(ok); } }`,
    (t) => [addressToLockScript(t.contract.address), 9n]);
    expect(error).toBeInstanceOf(DeployerCalleeError);
    expect((error as Error).message)
      .toMatch(/it keys a collection by msg\.sender, and its block is laid out by the ordinary build/);
    expect(sentAfter).toBe(sentBefore);
  });

  it('refuses a collection iteration, whose ordinary build with a call record fails', async () => {
    const s = setup();
    const source = `${P} interface I { function f() external returns (int); }
      contract T { int total; enumerable mapping(bytes20 => int) bal; function put(bytes20 k, int v) public { bal[k] = v; }
        function f() external returns (int) { int sum = 0; for (int value of this.bal) { sum = sum + value; } total = sum; return sum; } }
      contract C { int got; constructor(I t) { got = t.f(); } function read() { require(got > 0); } }`;
    const t = await s.deploy(compileString(source, compileOptions('T')));
    await (t.contract.connect(await s.wallet()) as any).call.put(new Uint8Array(20).fill(1), 5n).send();
    const sentBefore = s.sent.length;
    const error = await s.deploy(compileString(source, compileOptions('C')), {
      initArgs: [addressToLockScript(t.contract.address)], constructorCallees: [{ contract: t.contract }],
    }).then(() => undefined, (caught: unknown) => caught);
    expect(error).toBeInstanceOf(DeployerCalleeError);
    expect((error as Error).message).toMatch(/the ordinary build of its call, which lays out its block, fails/);
    expect(s.sent.length).toBe(sentBefore);
  });
});
