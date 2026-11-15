/**
 * A7, A14 item 5: a constructor's callee whose block a run sizes, or whose call reaches other contracts, takes the block
 * of its ordinary call's build: the entries, inserts, payments and events of a loop, a dynamic array's chunks, an entry a
 * branch deletes (DS-6), a collection's walk, the blocks of the contracts it calls or reads (a low-level call's among
 * them), the oracle pool coins its block reads co-spend, and a keccak256 loop's side-cars from the shared pool (A14
 * item 6), before the block of a contract it calls; and the chunks, walk and loop side-cars of a contract it calls that
 * pushes, iterates or hashes in a loop. The build runs for the child as the sender the genesis step resolves, so an
 * entry msg.sender keys, a loop's among them, and every copy of msg.sender it stores, with the chunks and the chunked
 * value its 35 bytes size, are the child's. Each creation is checked by the VM; each tamper case changes one part of a
 * finished creation and expects the input that binds it to refuse.
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
import { broadcastDeployerPreps, buildDeployerPrep } from '../../src/stateful/deployer.js';
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

/** A 35-byte lock that is neither the child's nor any coin's: what a forged creation stores instead of the child. */
const OTHER_P2SH32 = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x5a), 0x87);

/** The child's master lock in a captured creation: the P2SH32 output that carries a minting NFT not of `callee`. */
function childLock(captured: Captured, callee: string): Uint8Array {
  const master = captured.transaction.outputs.find((output) => output.token?.nft?.capability === 'minting'
    && binToHex(output.token.category) !== callee && output.lockingBytecode.length === 35
    && output.lockingBytecode[0] === 0xaa);
  if (master === undefined) throw new Error('the creation creates no child master');
  return Uint8Array.from(master.lockingBytecode);
}

/** The NFT outputs of `category` whose commitment holds `lock`. */
const holding = (captured: Captured, category: string, lock: Uint8Array): number[] => captured.transaction.outputs
  .map((output, index) => (output.token !== undefined && binToHex(output.token.category) === category
    && binToHex(output.token.nft?.commitment ?? new Uint8Array()).includes(binToHex(lock)) ? index : -1))
  .filter((index) => index >= 0);

/** `captured` with `from` replaced by `to`, a lock of the same length, in the commitment of output `index`. */
const storing = (captured: Captured, index: number, from: Uint8Array, to: Uint8Array): Captured => withOutput(
  captured, index, (output) => ({
    ...output,
    token: {
      ...output.token,
      nft: {
        ...output.token.nft,
        commitment: hexToBin(binToHex(output.token.nft.commitment).split(binToHex(from)).join(binToHex(to))),
      },
    },
  }),
);

/** Neither the stand-in sender of a callee's build nor its edge record reaches the creation (A7). */
function expectNoStandInSender(captured: Captured, child: Uint8Array, callee: string): void {
  // An edge record the callee pins for a call of its own is of its own category.
  expect(captured.transaction.outputs.some((output) => binToHex(output.lockingBytecode) === '5161'
    && (output.token === undefined || binToHex(output.token.category) !== callee))).toBe(false);
  // The child's lock holds its master only; no coin the creation spends sits there.
  expect(captured.transaction.outputs.filter((output) => same(output.lockingBytecode, child))).toHaveLength(1);
  expect(captured.sourceOutputs.some((output) => same(output.lockingBytecode, child))).toBe(false);
}

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

describe('a creating call whose child\'s callee stores msg.sender (A7, A14 item 4)', () => {
  it('pushes the child the creator makes onto an array, where its lock runs past a chunk', async () => {
    const source = `interface I { function f() external returns (bool); }
      contract T { address[] members; function add(address a) public { members.push(a); }
        function f() external returns (bool) { members.push(msg.sender); return true; } }
      contract Child { bool ok; constructor(I t) { ok = t.f(); } function read() { require(ok); } }
      contract Factory { int made; function make(I a) { new Child(a); made = made + 1; } }`;
    const s = setup();
    const artifacts = compileStringMulti(source, {
      allowUnsafeOperations: true, __deployerNew: true, genesisCalls: true,
    } as never);
    const t = await s.deploy(artifacts.T!, { initialState: {} });
    const factory = await s.deploy(artifacts.Factory!, { initialState: { made: 0n } });
    const wallet = await s.wallet();
    // 1 + 26 + 26 + 36 bytes of members: a 25-byte sender's push fits the first chunk, the child's does not.
    for (const member of [encodeLockingBytecodeP2pkh(alicePkh), encodeLockingBytecodeP2pkh(bobPkh), OTHER_P2SH32]) {
      await (t.contract.connect(wallet) as any).call.add(member).send();
    }
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await s.provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    await s.wallet();
    const result = await StatefulContract.deployFrom({
      provider: s.provider, factory: factory.contract, deployFunctionName: 'make',
      deployFunctionArgs: [addressToLockScript(t.contract.address)], childArtifacts: { Child: artifacts.Child! },
      fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: change.address,
      childCallees: [{ deployment: 0, callees: [{ contract: t.contract }] }],
    });
    const creation = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(creation as never)).toBe(true);
    expect(creation.transaction.outputs.some((output) => binToHex(output.lockingBytecode) === '5161')).toBe(false);
    // The second chunk, which holds the last bytes of the child's lock, changed: refused by T.
    const tLock = addressToLockScript(t.contract.address);
    const { getDataNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const dataLock = addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId));
    const chunks = creation.transaction.outputs.map((output, index) => (output.token !== undefined
      && binToHex(output.token.category) === t.categoryId && output.token.nft?.capability === 'mutable'
      && !same(output.lockingBytecode, dataLock) && !same(output.lockingBytecode, tLock) ? index : -1))
      .filter((index) => index >= 0);
    expect(chunks).toHaveLength(2);
    for (const index of chunks) {
      expect(inputPasses(s.provider, withOutput(creation, index, bumpCommitment), masterInput(creation, tLock))).toBe(false);
    }
    const members = ((await t.contract.getState()) as { members?: Uint8Array[] }).members!;
    expect(members).toHaveLength(4);
    expect(binToHex(members[3]!)).toBe(binToHex(addressToLockScript(result.children![0]!.address)));
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

describe('a callee that hashes in a loop through the shared side-car pool (A7, A14 items 5 and 6)', () => {
  const SOURCE = `${P} interface I { function f(bytes b, int k) external returns (bool); }
    contract T { bytes32 h; function f(bytes b, int k) external returns (bool) {
      bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; return true; } }
    contract C { bool ok; constructor(I t, bytes b, int k) { ok = t.f(b, k); } function read() { require(ok); } }`;

  it('co-spends a shared side-car per iteration after the callee\'s block, and refuses another digest', async () => {
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const { DeployerSidecarError } = await import('../../src/stateful/deployer.js');
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(SOURCE, compileOptions('C'));
    const b = Uint8Array.of(1, 2, 3);
    const extra = { initArgs: [tLock, b, 2n], constructorCallees: [{ contract: t.contract }] };
    // No coin of the shared pool: refused before anything is sent, as a fixed side-car is.
    const sentBefore = s.sent.length;
    const refusal = await s.deploy(c, extra).then(() => undefined, (error: unknown) => error);
    expect(refusal).toBeInstanceOf(DeployerSidecarError);
    expect((refusal as Error).message).toMatch(/No shared keccak sidecar coin was found for the callee 'T\.f'/);
    expect(s.sent.length).toBe(sentBefore);

    const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
    for (const index of [0, 1, 2, 3]) {
      await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-loop-callee', sharedLock, index));
    }
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    const master = masterInput(captured, tLock);
    // One side-car per iteration, read at the callee's master + blockSize + k and recreated at its own index.
    const sidecars = outputsAt(captured, sharedLock);
    expect(sidecars).toEqual([master + 3, master + 4]);
    expect(sidecars.every((index) => same(captured.sourceOutputs[index].lockingBytecode, sharedLock))).toBe(true);
    // Each side-car commits the digest of its preimage, and the run reads the last iteration's digest into `h`.
    for (const index of sidecars) {
      expect(inputPasses(s.provider, withOutput(captured, index, bumpCommitment), index)).toBe(false);
    }
    expect(inputPasses(s.provider, withOutput(captured, sidecars[1]!, bumpCommitment), master)).toBe(false);

    await s.deploy(c, extra);
    expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));
  });

  it('co-spends the loop\'s side-cars before a nested callee\'s block, and refuses another digest or a moved side-car',
    async () => {
      const source = `${P} interface IU { function g(int x) external returns (int); }
        interface I { function f(IU u, bytes b, int k) external returns (bool); }
        contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x * 2; } }
        contract T { bytes32 h; int n; function f(IU u, bytes b, int k) external returns (bool) {
          bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; n = u.g(k); return true; } }
        contract C { bool ok; constructor(I t, IU u, bytes b, int k) { ok = t.f(u, b, k); } function read() { require(ok); } }`;
      const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
      const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
      const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
      const s = setup();
      const u = await s.deploy(compileString(source, compileOptions('U')));
      const t = await s.deploy(compileString(source, compileOptions('T')));
      const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
      for (const index of [0, 1, 2, 3]) {
        await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-loop-call-callee', sharedLock, index));
      }
      const tLock = addressToLockScript(t.contract.address);
      const uLock = addressToLockScript(u.contract.address);
      // A one-byte preimage, which a loop's read once took for a call ordinal.
      const b = Uint8Array.of(3);
      const c = compileString(source, compileOptions('C'));
      const extra = {
        initArgs: [tLock, uLock, b, 2n], constructorCallees: [{ contract: t.contract, externalContracts: [u.contract] }],
      };
      const captured = await s.capture(c, extra);
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
      expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
      // The side-cars follow the callee's block of master, record and record slot, each recreated at its own index
      // with the digest; the nested callee's block follows them.
      const master = masterInput(captured, tLock);
      const sidecars = outputsAt(captured, sharedLock);
      expect(sidecars).toEqual([master + 3, master + 4]);
      for (const index of sidecars) {
        expect(same(captured.sourceOutputs[index].lockingBytecode, sharedLock)).toBe(true);
        expect(binToHex(captured.transaction.outputs[index]!.token!.nft!.commitment)).toBe(binToHex(keccak(b)));
      }
      expect(masterInput(captured, uLock)).toBe(master + 5);
      // Another digest: refused by the side-car and by the callee that reads it.
      const forged = withOutput(captured, master + 4, bumpCommitment);
      expect(inputPasses(s.provider, forged, master + 4)).toBe(false);
      expect(inputPasses(s.provider, forged, master)).toBe(false);
      // The side-car moved past the nested callee's block.
      const swap = <T>(items: readonly T[]): T[] => items.map((item, at) => (
        at === master + 4 ? items[master + 5]! : at === master + 5 ? items[master + 4]! : item));
      expect(inputPasses(s.provider, {
        sourceOutputs: swap(captured.sourceOutputs),
        transaction: {
          ...captured.transaction, inputs: swap(captured.transaction.inputs), outputs: swap(captured.transaction.outputs),
        },
      }, master)).toBe(false);

      const created = await s.deploy(c, extra);
      expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
      expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));
      expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(4n);
      expect(((await u.contract.getState()) as { calls?: bigint }).calls).toBe(1n);
    });

  it('takes the fixed side-car of a callee whose block a run sizes from the shared pool too', async () => {
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const source = `${P} interface I { function f(bytes32 b, int x) external returns (bool); }
      contract T { bytes32 h; int[] a; function f(bytes32 b, int x) external returns (bool) {
        a.push(x); h = keccak256(b); return true; } }
      contract C { bool ok; constructor(I t, bytes32 b, int x) { ok = t.f(b, x); } function read() { require(ok); } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
    for (const index of [0, 1]) {
      await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-sized-callee', sharedLock, index));
    }
    const tLock = addressToLockScript(t.contract.address);
    const b = new Uint8Array(32).fill(7);
    const extra = { initArgs: [tLock, b, 5n], constructorCallees: [{ contract: t.contract }] };
    const captured = await s.capture(compileString(source, compileOptions('C')), extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    const master = masterInput(captured, tLock);
    const [sidecar] = outputsAt(captured, sharedLock);
    expect(sidecar).toBeGreaterThan(master);
    expect(inputPasses(s.provider, withOutput(captured, sidecar!, bumpCommitment), master)).toBe(false);
    await s.deploy(compileString(source, compileOptions('C')), extra);
    expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));
  });
});

describe('a callee whose sized block is keyed by msg.sender (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f(int x) external returns (bool); }
    contract T { int[] a; mapping(address => int) owner;
      function put(int x) public { owner[msg.sender] = x; }
      function f(int x) external returns (bool) { a.push(x); owner[msg.sender] = x; return true; } }
    contract C { bool ok; constructor(I t, int x) { ok = t.f(x); } function read() { require(ok); } }`;

  it('keys the entry by the child the genesis step names, and refuses a creation that keys another', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    // Another key in the mapping, so the child's entry is inserted after a node of the chain.
    await (t.contract.connect(await s.wallet()) as any).call.put(4n).send();
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(SOURCE, compileOptions('C'));
    const extra = { initArgs: [tLock, 9n], constructorCallees: [{ contract: t.contract }] };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    // Neither stand-in of the sender reaches the creation: no edge record, no coin at the child's master lock.
    expect(captured.transaction.outputs.some((output) => binToHex(output.lockingBytecode) === '5161')).toBe(false);
    const master = masterInput(captured, tLock);
    const { getEntryNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const ownerLock = addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'owner'));
    const entries = outputsAt(captured, ownerLock);
    // The child's node and its relinked predecessor.
    expect(entries).toHaveLength(2);
    for (const index of entries) {
      expect(inputPasses(s.provider, withOutput(captured, index, bumpCommitment), master)).toBe(false);
    }

    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
    expect(await (t.contract as any).owner(addressToLockScript(created.contract.address))).toBe(9n);
    expect(await (t.contract as any).owner(encodeLockingBytecodeP2pkh(alicePkh))).toBe(4n);
  });
});

describe('a callee whose sized block stores msg.sender (A7, A14 item 5)', () => {
  const ARRAY = `${P} interface I { function f() external returns (bool); }
    contract T { address[] members; function add(address a) public { members.push(a); }
      function f() external returns (bool) { members.push(msg.sender); return true; } }
    contract C { bool ok; constructor(I t) { ok = t.f(); } function read() { require(ok); } }`;

  it('pushes the child where its lock runs past a chunk a 25-byte sender would fit, and refuses another member', async () => {
    const { parseChunkCommitment, buildChunkCommitment } = await import('@solidcash/utils');
    const s = setup();
    const t = await s.deploy(compileString(ARRAY, compileOptions('T')));
    const wallet = await s.wallet();
    // The framed array holds 1 + 26 + 26 + 36 = 89 bytes: one more P2PKH member fits the first 120-byte chunk
    // (115), the child's 35-byte lock does not (125), so the creation lays out a second chunk.
    for (const member of [encodeLockingBytecodeP2pkh(alicePkh), encodeLockingBytecodeP2pkh(bobPkh), OTHER_P2SH32]) {
      await (t.contract.connect(wallet) as any).call.add(member).send();
    }
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(ARRAY, compileOptions('C'));
    const extra = { initArgs: [tLock], constructorCallees: [{ contract: t.contract }] };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    // The stock VM, standard and with a real network's limits, accepts it too.
    expect(createVirtualMachineBch2026(true).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    const child = childLock(captured, t.categoryId);
    expectNoStandInSender(captured, child, t.categoryId);
    const master = masterInput(captured, tLock);
    const { getDataNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const dataLock = addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId));
    const chunks = captured.transaction.outputs.map((output, index) => ({ output, index }))
      .filter(({ output }) => output.token !== undefined && binToHex(output.token.category) === t.categoryId
        && output.token.nft?.capability === 'mutable' && !same(output.lockingBytecode, dataLock)
        && !same(output.lockingBytecode, tLock))
      .map(({ output, index }) => ({ index, ...parseChunkCommitment(binToHex(output.token!.nft!.commitment)) }))
      .sort((left, right) => left.chunkIndex - right.chunkIndex);
    expect(chunks.map((chunk) => [chunk.chunkIndex, chunk.chunkData.length])).toEqual([[0, 120], [1, 5]]);
    const blob = Uint8Array.from(chunks.flatMap((chunk) => [...chunk.chunkData]));
    // Four members, the last the child: `OP_4`, then each member's push.
    expect(blob[0]).toBe(0x54);
    expect(binToHex(blob).endsWith(`23${binToHex(child)}`)).toBe(true);

    // Another 35-byte lock as the new member, chunked as the child's was: refused by the callee, which pushes the
    // sender the genesis step names.
    const forged = hexToBin(binToHex(blob).slice(0, -70) + binToHex(OTHER_P2SH32));
    let rechunked = captured;
    for (const chunk of chunks) {
      const data = forged.slice(chunk.chunkIndex * 120, chunk.chunkIndex * 120 + chunk.chunkData.length);
      const commitment = hexToBin(buildChunkCommitment(chunk.chunkIndex, data));
      rechunked = withOutput(rechunked, chunk.index, (output) => ({
        ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } },
      }));
    }
    expect(inputPasses(s.provider, rechunked, master)).toBe(false);
    // The last chunk changed, the two chunks swapped, and the record's length changed: each refused.
    expect(inputPasses(s.provider, withOutput(captured, chunks[1]!.index, bumpCommitment), master)).toBe(false);
    const [first, second] = [chunks[0]!.index, chunks[1]!.index];
    expect(inputPasses(s.provider, withOutput(withOutput(captured, first, () => captured.transaction.outputs[second]),
      second, () => captured.transaction.outputs[first]), master)).toBe(false);
    const [record] = outputsAt(captured, dataLock);
    expect(inputPasses(s.provider, withOutput(captured, record!, bumpCommitment), master)).toBe(false);

    const created = await s.deploy(c, extra);
    const members = ((await t.contract.getState()) as { members?: Uint8Array[] }).members!;
    expect(members.map((member) => binToHex(member))).toEqual([
      binToHex(encodeLockingBytecodeP2pkh(alicePkh)), binToHex(encodeLockingBytecodeP2pkh(bobPkh)),
      binToHex(OTHER_P2SH32), binToHex(addressToLockScript(created.contract.address)),
    ]);
  });

  const STRUCT = `${P} interface I { function f(int x, bytes note) external returns (bool); }
    contract T { struct Rec { address who; bytes note; } int[] a; mapping(int => Rec) recs;
      function f(int x, bytes note) external returns (bool) { a.push(x); recs[x] = Rec(msg.sender, note); return true; } }
    contract C { bool ok; constructor(I t, int x, bytes note) { ok = t.f(x, note); } function read() { require(ok); } }`;

  it('writes the child into a struct value that its lock takes past the inline limit, and refuses another', async () => {
    const s = setup();
    const t = await s.deploy(compileString(STRUCT, compileOptions('T')));
    // Plain coins at the funder's lock for the block's output-only slots.
    await s.wallet();
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(STRUCT, compileOptions('C'));
    // The value is the who push and the note push: 26 + 31 = 57 bytes for a P2PKH sender, inline; 36 + 31 = 67 for
    // the child, past the 60-byte limit, so it keeps a head and its root and continues in a chunk of its own.
    const note = new Uint8Array(30).fill(7);
    const extra = { initArgs: [tLock, 5n, note], constructorCallees: [{ contract: t.contract }] };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect(createVirtualMachineBch2026(true).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    const child = childLock(captured, t.categoryId);
    expectNoStandInSender(captured, child, t.categoryId);
    const master = masterInput(captured, tLock);
    const { getEntryNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const entryLock = addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'recs'));
    const { sha256 } = await import('@noble/hashes/sha2.js');
    const value = Uint8Array.of(0x23, ...child, 0x1e, ...note);
    // The child's node: its key, then the value's length, its root and its first 28 bytes.
    const node = outputsAt(captured, entryLock).find((index) => binToHex(captured.transaction.outputs[index]!.token!.nft!
      .commitment).endsWith(binToHex(Uint8Array.of(value.length, 0, 0, 0, ...sha256(value), ...value.slice(0, 28)))));
    expect(node).toBeDefined();
    // Its continuation: the value's last 39 bytes, at an address of its own.
    const continuation = captured.transaction.outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === t.categoryId
      && binToHex(output.token.nft?.commitment ?? new Uint8Array()) === `0000${binToHex(value.slice(28))}`);
    expect(continuation).toBeGreaterThan(master);
    // The child's lock changed in the node, the continuation changed: each refused.
    const flipped = withOutput(captured, node!, (output) => {
      const commitment = Uint8Array.from(output.token.nft.commitment);
      commitment[commitment.length - 20] ^= 1;
      return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
    });
    expect(inputPasses(s.provider, flipped, master)).toBe(false);
    expect(inputPasses(s.provider, withOutput(captured, continuation, bumpCommitment), master)).toBe(false);

    const created = await s.deploy(c, extra);
    const stored = await (t.contract as any).recs(5n) as { who: Uint8Array; note: Uint8Array };
    expect(binToHex(stored.who)).toBe(binToHex(addressToLockScript(created.contract.address)));
    expect(binToHex(stored.note)).toBe(binToHex(note));
  });

  // Shapes whose stored copy keeps the layout a 25-byte sender gives: the creation's run pins the child in place.
  const SHAPES: Array<{ name: string; body: string; read: (t: any, child: Uint8Array) => Promise<Uint8Array> }> = [
    { name: 'an address array', body: 'address[] members; function f(int x) external returns (bool) { members.push(msg.sender); return true; }',
      read: async (t) => (await t.getState()).members[0] },
    { name: 'a mapping value', body: 'int[] a; mapping(int => address) owners; function f(int x) external returns (bool) { a.push(x); owners[x] = msg.sender; return true; }',
      read: async (t) => t.owners(5n) },
    { name: 'a struct field of a mapping value', body: 'struct Rec { address who; int x; } int[] a; mapping(int => Rec) recs; function f(int x) external returns (bool) { a.push(x); recs[x] = Rec(msg.sender, x); return true; }',
      read: async (t) => (await t.recs(5n)).who },
    { name: 'a struct field of an array element', body: 'struct Rec { address who; int x; } Rec[] log; function f(int x) external returns (bool) { log.push(Rec(msg.sender, x)); return true; }',
      read: async (t) => (await t.getState()).log[0].who },
    { name: 'a state variable', body: 'int[] a; address last; function f(int x) external returns (bool) { a.push(x); last = msg.sender; return true; }',
      read: async (t) => (await t.getState()).last },
    { name: 'the value of the entry it keys', body: 'int[] a; mapping(address => address) m; function f(int x) external returns (bool) { a.push(x); m[msg.sender] = msg.sender; return true; }',
      read: async (t, child) => t.m(child) },
  ];
  for (const shape of SHAPES) {
    it(`stores the child as ${shape.name}, and refuses a creation that stores another lock`, async () => {
      const source = `${P} interface I { function f(int x) external returns (bool); } contract T { ${shape.body} }
        contract C { bool ok; constructor(I t, int x) { ok = t.f(x); } function read() { require(ok); } }`;
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      await s.wallet();
      const tLock = addressToLockScript(t.contract.address);
      const c = compileString(source, compileOptions('C'));
      const extra = { initArgs: [tLock, 5n], constructorCallees: [{ contract: t.contract }] };
      const captured = await s.capture(c, extra);
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
      expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
      const child = childLock(captured, t.categoryId);
      expectNoStandInSender(captured, child, t.categoryId);
      const master = masterInput(captured, tLock);
      const stores = holding(captured, t.categoryId, child);
      expect(stores.length).toBeGreaterThan(0);
      for (const index of stores) {
        expect(inputPasses(s.provider, storing(captured, index, child, OTHER_P2SH32), master)).toBe(false);
      }
      const created = await s.deploy(c, extra);
      const lock = addressToLockScript(created.contract.address);
      expect(binToHex(await shape.read(t.contract, lock))).toBe(binToHex(lock));
    });
  }
});

describe('a callee that writes a collection in a loop under keys msg.sender names (A7, A14 item 5)', () => {
  // One key: a loop's inserts that chain from one node are ordered by key, and a child's keys may fall either way.
  const SOURCE = `${P} interface I { function f(int[] ks) external returns (bool); }
    contract T { mapping(address => mapping(int => int)) m;
      function put(int[] ks) public { for (int i = 0; i < ks.length; i++) { m[msg.sender][ks[i]] = 100 + ks[i]; } }
      function f(int[] ks) external returns (bool) { for (int i = 0; i < ks.length; i++) { m[msg.sender][ks[i]] = ks[i]; } return true; } }
    contract C { bool ok; constructor(I t, int a) { ok = t.f([a]); } function read() { require(ok); } }`;

  it('keys the loop\'s entry by the child, beside another sender\'s, and refuses a creation that changes it', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    // Another sender's entries under the same keys, so the child's is inserted among nodes of the chain.
    await (t.contract.connect(await s.wallet()) as any).call.put([3n, 4n]).send();
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(SOURCE, compileOptions('C'));
    // The array the constructor builds is no constructor parameter, so the callee's arguments are given.
    const extra = { initArgs: [tLock, 4n], constructorCallees: [{ contract: t.contract, args: [[4n]] }] };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    expectNoStandInSender(captured, childLock(captured, t.categoryId), t.categoryId);
    const master = masterInput(captured, tLock);
    const { getEntryNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const entries = outputsAt(captured, addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'm')));
    // The child's node and the relinked node before it.
    expect(entries).toHaveLength(2);
    for (const index of entries) {
      expect(inputPasses(s.provider, withOutput(captured, index, bumpCommitment), master)).toBe(false);
    }

    const created = await s.deploy(c, extra);
    const child = addressToLockScript(created.contract.address);
    expect(await (t.contract as any).m(child, 4n)).toBe(4n);
    expect(await (t.contract as any).m(child, 3n)).toBe(0n);
    expect(await (t.contract as any).m(encodeLockingBytecodeP2pkh(alicePkh), 4n)).toBe(104n);
  });
});

describe('a callee that iterates a collection (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f() external returns (int); }
    contract T { int total; enumerable mapping(bytes20 => int) bal; function put(bytes20 k, int v) public { bal[k] = v; }
      function f() external returns (int) { int sum = 0; for (int value of this.bal) { sum = sum + value; } total = sum; return sum; } }
    contract C { int got; constructor(I t) { got = t.f(); } function read() { require(got > 0); } }`;

  it('co-spends the walk after the callee\'s block, and refuses a creation that records another sum', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const wallet = await s.wallet();
    await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(1), 5n).send();
    await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(2), 7n).send();
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(SOURCE, compileOptions('C'));
    const extra = { initArgs: [tLock], constructorCallees: [{ contract: t.contract }] };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    const master = masterInput(captured, tLock);
    const { getDataNftAddress, getEntryNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    // The walk reads the HEAD and both entries, each recreated as it was at its own index, after the callee's block
    // of master, record and the record slot.
    const entryLock = addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'bal'));
    const walked = captured.sourceOutputs.map((output, index) => (same(output.lockingBytecode, entryLock) ? index : -1))
      .filter((index) => index >= 0);
    expect(walked).toEqual([master + 3, master + 4, master + 5]);
    expect(outputsAt(captured, entryLock)).toEqual(walked);
    const [record] = outputsAt(captured, addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId)));
    expect(inputPasses(s.provider, withOutput(captured, record!, bumpCommitment), master)).toBe(false);

    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { got?: bigint }).got).toBe(12n);
    expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(12n);
  });
});

describe('a callee that makes a low-level call and reads its result (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface IU { function g(int x) external returns (int); }
    interface I { function f(address u, int x) external returns (bool); }
    contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x * 2; } }
    contract T { int n; function f(address u, int x) external returns (bool) {
      (bool ok, bytes memory data) = u.call(abi.encodeWithSelector(IU.g.selector, x));
      require(ok && data.length > 0); n = n + 1; return ok; } }
    contract C { bool ok; constructor(I t, address u, int x) { ok = t.f(u, x); } function read() { require(ok); } }`;

  it('lays out the block of the function the payload names, and refuses another record or argument', async () => {
    const s = setup();
    const u = await s.deploy(compileString(SOURCE, compileOptions('U')));
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
    const master = masterInput(captured, tLock);
    const uMaster = masterInput(captured, uLock);
    // U's call record: a carrier of U's category at lock 51, which T reads as the call's result and U pins.
    const carrier = captured.transaction.outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === u.categoryId && binToHex(output.lockingBytecode) === '51');
    expect(carrier).toBeGreaterThan(0);
    expect(inputPasses(s.provider, withOutput(captured, carrier, bumpCommitment), uMaster)).toBe(false);
    // U run with another argument than the payload's: T binds U's unlocking pushes to the payload's arguments.
    const unlocking = Uint8Array.from(captured.transaction.inputs[uMaster]!.unlockingBytecode);
    const argument = unlocking.findIndex((byte, index) => byte === 0x01 && unlocking[index + 1] === 21);
    expect(argument).toBeGreaterThanOrEqual(0);
    unlocking[argument + 1] = 22;
    const reargued: Captured = {
      sourceOutputs: captured.sourceOutputs,
      transaction: {
        ...captured.transaction,
        inputs: captured.transaction.inputs.map((input, index) => (
          index === uMaster ? { ...input, unlockingBytecode: unlocking } : input)),
      },
    };
    expect(inputPasses(s.provider, reargued, master)).toBe(false);

    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    expect(((await u.contract.getState()) as { calls?: bigint }).calls).toBe(1n);
  });
});

describe('a callee whose function calls a contract that pushes, iterates or hashes in a loop (A7, A14 items 5 and 6)', () => {
  it('lays out the nested callee\'s new chunks, and refuses a creation whose chunk or result is another', async () => {
    const source = `${P} interface I { function f(int x) external returns (int); }
      interface ID { function g(I t, int x) external returns (int); }
      contract T { int[] a; function f(int x) external returns (int) { a.push(x); a.push(x + 1); return a.length; } }
      contract D { int got; function g(I t, int x) external returns (int) { got = t.f(x); return got; } }
      contract C { int got; constructor(ID d, I t, int x) { got = d.g(t, x); } function read() { require(got > 0); } }`;
    const { getDynamicChunkAddress } = await import('../../src/stateful/covenant-helpers.js');
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const d = await s.deploy(compileString(source, compileOptions('D')));
    const tLock = addressToLockScript(t.contract.address);
    const dLock = addressToLockScript(d.contract.address);
    const c = compileString(source, compileOptions('C'));
    const extra = {
      initArgs: [dLock, tLock, 5n], constructorCallees: [{ contract: d.contract, externalContracts: [t.contract] }],
    };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    // The nested callee's block of master, record and record slot, then its chunk.
    const dMaster = masterInput(captured, dLock);
    const tMaster = masterInput(captured, tLock);
    expect(tMaster).toBeGreaterThan(dMaster);
    const chunks = outputsAt(captured, addressToLockScript(getDynamicChunkAddress(
      t.contract.inner as never, t.categoryId, 'a', 'int256[]')));
    expect(chunks).toEqual([tMaster + 3]);
    expect(inputPasses(s.provider, withOutput(captured, chunks[0]!, bumpCommitment), tMaster)).toBe(false);
    // Another result in the nested call's record: refused by the callee that reads it.
    expect(inputPasses(s.provider, withOutput(captured, tMaster + 2, bumpCommitment), dMaster)).toBe(false);

    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { got?: bigint }).got).toBe(2n);
    expect(((await t.contract.getState()) as { a?: bigint[] }).a).toEqual([5n, 6n]);
  });

  it('co-spends the nested callee\'s walk, and refuses a creation whose entry or sum is another', async () => {
    const source = `${P} interface I { function f() external returns (int); }
      interface ID { function g(I t) external returns (int); }
      contract T { int total; enumerable mapping(bytes20 => int) bal; function put(bytes20 k, int v) public { bal[k] = v; }
        function f() external returns (int) { int sum = 0; for (int value of this.bal) { sum = sum + value; } total = sum; return sum; } }
      contract D { int got; function g(I t) external returns (int) { got = t.f(); return got; } }
      contract C { int got; constructor(ID d, I t) { got = d.g(t); } function read() { require(got > 0); } }`;
    const { getDataNftAddress, getEntryNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const d = await s.deploy(compileString(source, compileOptions('D')));
    const wallet = await s.wallet();
    await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(1), 5n).send();
    await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(2), 7n).send();
    const tLock = addressToLockScript(t.contract.address);
    const dLock = addressToLockScript(d.contract.address);
    const c = compileString(source, compileOptions('C'));
    const extra = {
      initArgs: [dLock, tLock], constructorCallees: [{ contract: d.contract, externalContracts: [t.contract] }],
    };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    const dMaster = masterInput(captured, dLock);
    const tMaster = masterInput(captured, tLock);
    // The walk follows the nested callee's block of master, record and record slot, each entry at its own index.
    const entryLock = addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'bal'));
    const walked = captured.sourceOutputs.map((output, index) => (same(output.lockingBytecode, entryLock) ? index : -1))
      .filter((index) => index >= 0);
    expect(walked).toEqual([tMaster + 3, tMaster + 4, tMaster + 5]);
    expect(outputsAt(captured, entryLock)).toEqual(walked);
    expect(inputPasses(s.provider, withOutput(captured, tMaster + 4, bumpCommitment), tMaster)).toBe(false);
    const [tRecord] = outputsAt(captured, addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId)));
    expect(inputPasses(s.provider, withOutput(captured, tRecord!, bumpCommitment), tMaster)).toBe(false);
    expect(inputPasses(s.provider, withOutput(captured, tMaster + 2, bumpCommitment), dMaster)).toBe(false);

    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { got?: bigint }).got).toBe(12n);
    expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(12n);
  });

  it('co-spends the nested callee\'s loop side-cars from the shared pool, and refuses another digest', async () => {
    const source = `${P} interface I { function f(bytes b, int k) external returns (bool); }
      interface ID { function g(I t, bytes b, int k) external returns (bool); }
      contract T { bytes32 h; function f(bytes b, int k) external returns (bool) {
        bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; return true; } }
      contract D { bool ok; function g(I t, bytes b, int k) external returns (bool) { ok = t.f(b, k); return ok; } }
      contract C { bool ok; constructor(ID d, I t, bytes b, int k) { ok = d.g(t, b, k); } function read() { require(ok); } }`;
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const { DeployerSidecarError } = await import('../../src/stateful/deployer.js');
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const d = await s.deploy(compileString(source, compileOptions('D')));
    const tLock = addressToLockScript(t.contract.address);
    const dLock = addressToLockScript(d.contract.address);
    const b = Uint8Array.of(1, 2);
    const c = compileString(source, compileOptions('C'));
    const extra = {
      initArgs: [dLock, tLock, b, 2n], constructorCallees: [{ contract: d.contract, externalContracts: [t.contract] }],
    };
    // No coin of the shared pool: refused before anything is sent.
    const sentBefore = s.sent.length;
    const refusal = await s.deploy(c, extra).then(() => undefined, (error: unknown) => error);
    expect(refusal).toBeInstanceOf(DeployerSidecarError);
    expect((refusal as Error).message)
      .toMatch(/No shared keccak sidecar coin was found for the callee 'D\.g' \(its call of T\.f\)/);
    expect(s.sent.length).toBe(sentBefore);

    const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
    for (const index of [0, 1, 2, 3]) {
      await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-loop-nested-callee', sharedLock, index));
    }
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    expect([...p2pkhPaid(captured)]).toEqual([walletLock]);
    const dMaster = masterInput(captured, dLock);
    const tMaster = masterInput(captured, tLock);
    const sidecars = outputsAt(captured, sharedLock);
    expect(sidecars).toEqual([tMaster + 3, tMaster + 4]);
    for (const index of sidecars) {
      expect(same(captured.sourceOutputs[index].lockingBytecode, sharedLock)).toBe(true);
      expect(binToHex(captured.transaction.outputs[index]!.token!.nft!.commitment)).toBe(binToHex(keccak(b)));
    }
    const forged = withOutput(captured, tMaster + 4, bumpCommitment);
    expect(inputPasses(s.provider, forged, tMaster + 4)).toBe(false);
    expect(inputPasses(s.provider, forged, tMaster)).toBe(false);
    expect(inputPasses(s.provider, withOutput(captured, tMaster + 2, bumpCommitment), dMaster)).toBe(false);

    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
    expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));
  });

  it('gives the callee\'s own side-car and its nested callee\'s loop side-cars distinct coins of the shared pool',
    async () => {
      const source = `${P} interface I { function f(bytes b, int k) external returns (bool); }
        interface ID { function g(I t, bytes32 c, bytes b, int k) external returns (bool); }
        contract T { bytes32 h; function f(bytes b, int k) external returns (bool) {
          bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; return true; } }
        contract D { bytes32 hd; bool ok; function g(I t, bytes32 c, bytes b, int k) external returns (bool) {
          hd = keccak256(c); ok = t.f(b, k); return ok; } }
        contract C { bool ok; constructor(ID d, I t, bytes32 c, bytes b, int k) { ok = d.g(t, c, b, k); }
          function read() { require(ok); } }`;
      const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
      const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
      const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      const d = await s.deploy(compileString(source, compileOptions('D')));
      const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
      for (const index of [0, 1, 2, 3, 4]) {
        await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-callee-and-nested', sharedLock, index));
      }
      const tLock = addressToLockScript(t.contract.address);
      const dLock = addressToLockScript(d.contract.address);
      const word = new Uint8Array(32).fill(9);
      const b = Uint8Array.of(1, 2);
      const c = compileString(source, compileOptions('C'));
      const extra = {
        initArgs: [dLock, tLock, word, b, 2n],
        constructorCallees: [{ contract: d.contract, externalContracts: [t.contract] }],
      };
      const captured = await s.capture(c, extra);
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
      const dMaster = masterInput(captured, dLock);
      const tMaster = masterInput(captured, tLock);
      // The callee's side-car in its block, the nested callee's two after its own block: three distinct coins.
      const sidecars = outputsAt(captured, sharedLock);
      expect(sidecars).toHaveLength(3);
      expect(sidecars[0]!).toBeLessThan(tMaster);
      expect(sidecars.slice(1)).toEqual([tMaster + 3, tMaster + 4]);
      const coins = sidecars.map((index) => `${binToHex(captured.transaction.inputs[index]!.outpointTransactionHash)}:`
        + `${captured.transaction.inputs[index]!.outpointIndex}`);
      expect(new Set(coins).size).toBe(3);
      expect(binToHex(captured.transaction.outputs[sidecars[0]!]!.token!.nft!.commitment)).toBe(binToHex(keccak(word)));
      // Another digest in either: refused by the contract that reads it.
      expect(inputPasses(s.provider, withOutput(captured, sidecars[0]!, bumpCommitment), dMaster)).toBe(false);
      expect(inputPasses(s.provider, withOutput(captured, sidecars[2]!, bumpCommitment), tMaster)).toBe(false);

      const created = await s.deploy(c, extra);
      expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
      expect(binToHex(((await d.contract.getState()) as { hd?: Uint8Array }).hd!)).toBe(binToHex(keccak(word)));
    });
});
