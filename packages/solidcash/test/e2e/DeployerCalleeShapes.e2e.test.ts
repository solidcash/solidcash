/**
 * A7, A14 item 5: a constructor's callee runs as an ordinary spend inside the creation, so its block holds what its own
 * call would: its satoshi and token containers and their transfers, read-only entries, events under a condition, a wide
 * event's chunks, its keccak256 and ecrecover side-cars, a recovery loop's triples (from the shared pool, A14 item 6),
 * and the child as the msg.sender it stores. Each creation is checked by the VM; each tamper case changes one output of
 * a finished creation and expects the callee's input to refuse it. A callee whose ordinary build would run it on other
 * arguments than the child passes is refused before anything is sent.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { broadcastDeployerPreps, buildDeployerPrep } from '../../src/stateful/deployer.js';
import { getSatoshiContainerAddress, getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.50.0;';
const compileOptions = (primary: string, extra: Record<string, unknown> = {}): never => ({
  deployer: true, genesisCalls: true, messageBus: false, primaryContractName: primary, ...extra,
}) as never;

let serial = 0x700;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Captured = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

interface Setup {
  provider: MockNetworkProvider;
  authorLock: Uint8Array;
  changeAddress: string;
  funder: Unlocker;
  fund(satoshis?: bigint): Promise<Utxo>;
  deploy(artifact: Artifact, extra?: Record<string, unknown>, args?: unknown[]): Promise<DeployResult<Artifact>>;
  signer(): Promise<Signer>;
  /** The creation of `artifact` with `extra`, captured instead of broadcast. */
  capture(artifact: Artifact, extra: Record<string, unknown>): Promise<Captured>;
}

function setup(): Setup {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const fund = async (satoshis = 2_000_000n): Promise<Utxo> => {
    const utxo: Utxo = { txid: nextTxid(), vout: 0, satoshis };
    await provider.seedUtxo(binToHex(authorLock), utxo);
    return utxo;
  };
  const deploy = async (
    artifact: Artifact, extra: Record<string, unknown> = {}, args: unknown[] = [],
  ): Promise<DeployResult<Artifact>> => StatefulContract.deploy(artifact, args as never, {
    provider, fundingUtxo: await fund(), funder, changeAddress: change.address, senderLockingBytecode: authorLock,
    ...extra,
  } as never);
  const signer = async (): Promise<Signer> => {
    const wallet = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(wallet.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
    }
    return wallet;
  };
  const capture = async (artifact: Artifact, extra: Record<string, unknown>): Promise<Captured> => {
    const fundingUtxo = await fund();
    const { prep } = await buildDeployerPrep({
      children: [{ deployer: artifact.deployer!, contractName: artifact.contractName }],
      fundingUtxos: [fundingUtxo], authorSigner: funder, authorLockingBytecode: authorLock,
      changeLockingBytecode: authorLock, provider,
    });
    await broadcastDeployerPreps([prep], provider);
    const original = provider.sendRawTransaction.bind(provider);
    let captured: Captured | undefined;
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      const transaction = decodeTransactionUnsafe(hexToBin(hex));
      const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
        const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
        if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
        return solidCashOutputToLibauthOutput({
          to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
        });
      }));
      if (!sourceOutputs.some((output) => binToHex(output.lockingBytecode) === artifact.deployer!.lockingBytecode)) {
        return original(hex);
      }
      captured = { transaction, sourceOutputs };
      throw new Error('creation captured');
    };
    try {
      await expect(StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
        deployerPrep: prep, ...extra,
      } as never)).rejects.toThrow('creation captured');
    } finally {
      (provider as any).sendRawTransaction = original;
    }
    return captured!;
  };
  return { provider, authorLock, changeAddress: change.address, funder, fund, deploy, signer, capture };
}

/** The VM's verdict on one input of `transaction`. */
function inputPasses(provider: MockNetworkProvider, transaction: any, sourceOutputs: any[], inputIndex: number): boolean {
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ transaction, sourceOutputs, inputIndex } as never) as never) === true;
}

/** The whole transaction's VM verdict. */
function verifies(provider: MockNetworkProvider, captured: Captured): boolean {
  return createVirtualMachineBch2026ForProvider(provider).verify(captured as never) === true;
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

const payee = encodeLockingBytecodeP2pkh(bobPkh);
const same = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);

describe('a callee that pays from its satoshi container (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f(int x, address to) external returns (bool); }
    contract T { int n;
      function f(int x, address to) external returns (bool) {
        n = n + 1; payable(to).transfer(1500); if (x > 0) { payable(to).transfer(700 + x); } return true; } }
    contract C { bool ok; constructor(I t, int x, address to) { ok = t.f(x, to); } function read() { require(ok); } }`;

  async function seeded(): Promise<{ s: Setup; t: DeployResult<Artifact>; c: Artifact; container: string }> {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const container = getSatoshiContainerAddress(t.contract.inner as never, t.categoryId);
    await s.provider.seedUtxo(container, { txid: nextTxid(), vout: 0, satoshis: 10_000n });
    return { s, t, c: compileString(SOURCE, compileOptions('C')), container };
  }

  for (const x of [5n, 0n]) {
    it(`pays a fixed transfer and ${x > 0n ? 'a taken' : 'a skipped'} conditional one from the callee's container`, async () => {
      const { s, t, c, container } = await seeded();
      const tLock = addressToLockScript(t.contract.address);
      const result = await s.deploy(c, { initArgs: [tLock, x, payee], constructorCallees: [{ contract: t.contract }] });
      expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
      expect(((await result.contract.getState()) as { ok?: boolean }).ok).toBe(true);
      const paid = result.tx.outputs.filter((output) => same(output.lockingBytecode, payee))
        .map((output) => output.valueSatoshis).sort();
      expect(paid).toEqual(x > 0n ? [1500n, 705n].sort() : [1500n]);
      const kept = (await s.provider.getUtxos(container)).map((utxo) => utxo.satoshis);
      expect(kept).toEqual([10_000n - 1500n - (x > 0n ? 705n : 0n)]);
    });
  }

  it('refuses a creation whose callee transfer is short or paid elsewhere, or whose container gives up more', async () => {
    const { s, t, c, container } = await seeded();
    const tLock = addressToLockScript(t.contract.address);
    const captured = await s.capture(c, { initArgs: [tLock, 5n, payee], constructorCallees: [{ contract: t.contract }] });
    expect(verifies(s.provider, captured)).toBe(true);
    const master = captured.sourceOutputs.findIndex((output) => same(output.lockingBytecode, tLock));
    const transfer = captured.transaction.outputs.findIndex((output) => same(output.lockingBytecode, payee)
      && output.valueSatoshis === 1500n);
    const short = withOutput(captured, transfer, (output) => ({ ...output, valueSatoshis: 1400n }));
    expect(inputPasses(s.provider, short.transaction, short.sourceOutputs, master)).toBe(false);
    const redirected = withOutput(captured, transfer, (output) => ({ ...output, lockingBytecode: tLock }));
    expect(inputPasses(s.provider, redirected.transaction, redirected.sourceOutputs, master)).toBe(false);
    // The recreated container keeps 100 satoshis less than its coin less the transfers: the callee refuses the loss.
    const containerLock = addressToLockScript(container);
    const kept = captured.transaction.outputs.findIndex((output) => same(output.lockingBytecode, containerLock));
    expect(captured.transaction.outputs[kept]!.valueSatoshis).toBe(10_000n - 1500n - 705n);
    const drained = withOutput(captured, kept, (output) => ({ ...output, valueSatoshis: output.valueSatoshis - 100n }));
    expect(inputPasses(s.provider, drained.transaction, drained.sourceOutputs, master)).toBe(false);
  });
});

describe('a callee that pays units from its token container (A7, A14 item 5)', () => {
  const ASSET = 'a1b2c3d4e5f60718293a4b5c6d7e8f900123456789abcdef0011223344556677';
  const SOURCE = `${P} interface I { function f(address to, int k) external returns (bool); }
    contract T(bytes32 asset) { int n;
      function f(address to, int k) external returns (bool) {
        this.n = this.n + 1; this.tokens[asset].transfer(to, k); return true; } }
    contract C { bool ok; constructor(I t, address to, int k) { ok = t.f(to, k); } function read() { require(ok); } }`;

  async function seeded(units: bigint): Promise<{ s: Setup; t: DeployResult<Artifact>; c: Artifact; container: string }> {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')), {}, [hexToBin(ASSET)]);
    const container = getTokenContainerAddress(t.contract.inner as never, t.categoryId, ASSET);
    await s.provider.seedUtxo(container, {
      txid: nextTxid(), vout: 0, satoshis: 1200n, token: { category: ASSET, amount: units },
    });
    return { s, t, c: compileString(SOURCE, compileOptions('C')), container };
  }

  it('moves units to the payee and recreates the container with the rest', async () => {
    const { s, t, c, container } = await seeded(100n);
    const tLock = addressToLockScript(t.contract.address);
    const result = await s.deploy(c, { initArgs: [tLock, payee, 30n], constructorCallees: [{ contract: t.contract }] });
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    const sent = result.tx.outputs.find((output) => same(output.lockingBytecode, payee) && output.token !== undefined);
    expect(binToHex(sent!.token!.category)).toBe(ASSET);
    expect(sent!.token!.amount).toBe(30n);
    expect((await s.provider.getUtxos(container)).map((utxo) => utxo.token?.amount)).toEqual([70n]);
  });

  it('drains the container to its filler when the transfer takes every unit', async () => {
    const { s, t, c, container } = await seeded(30n);
    const tLock = addressToLockScript(t.contract.address);
    await s.deploy(c, { initArgs: [tLock, payee, 30n], constructorCallees: [{ contract: t.contract }] });
    expect(await s.provider.getUtxos(container)).toEqual([]);
  });

  it('refuses a creation whose token transfer carries fewer units', async () => {
    const { s, t, c } = await seeded(100n);
    const tLock = addressToLockScript(t.contract.address);
    const captured = await s.capture(c, { initArgs: [tLock, payee, 30n], constructorCallees: [{ contract: t.contract }] });
    expect(verifies(s.provider, captured)).toBe(true);
    const master = captured.sourceOutputs.findIndex((output) => same(output.lockingBytecode, tLock));
    const transfer = captured.transaction.outputs.findIndex((output) => same(output.lockingBytecode, payee)
      && output.token !== undefined);
    const short = withOutput(captured, transfer, (output) => ({ ...output, token: { ...output.token, amount: 29n } }));
    expect(inputPasses(s.provider, short.transaction, short.sourceOutputs, master)).toBe(false);
  });
});

describe('a callee that reads an entry, or emits under a condition (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f(int k) external returns (int); }
    contract T { mapping(int => int) m; int last; event Seen(int k, int v);
      function put(int k, int v) public { m[k] = v; }
      function f(int k) external returns (int) { last = m[k]; if (last > 0) { emit Seen(k, last); } return last; } }
    contract C { int got; constructor(I t, int k) { got = t.f(k); } function read(int v) { require(got == v); } }`;

  for (const [k, v] of [[3n, 7n], [4n, 0n]] as const) {
    it(`reads ${v > 0n ? 'a present key and emits' : 'an absent key from its predecessor and emits nothing'}`, async () => {
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const wallet = await s.signer();
      await (t.contract.connect(wallet) as any).call.put(3n, 7n).send();
      await (t.contract.connect(wallet) as any).call.put(9n, 1n).send();
      const tLock = addressToLockScript(t.contract.address);
      const c = await s.deploy(compileString(SOURCE, compileOptions('C')), {
        initArgs: [tLock, k], constructorCallees: [{ contract: t.contract }],
      });
      expect(((await t.contract.getState()) as { last?: bigint }).last).toBe(v);
      expect(((await c.contract.getState()) as { got?: bigint }).got).toBe(v);
      const { getEventNftAddress } = await import('../../src/stateful/covenant-helpers.js');
      const eventLock = addressToLockScript(getEventNftAddress(t.contract.inner as never, t.categoryId, 'Seen(int256,int256)'));
      expect(c.tx.outputs.filter((output) => same(output.lockingBytecode, eventLock))).toHaveLength(v > 0n ? 1 : 0);
      await (c.contract.connect(wallet) as any).call.read(v).send();
    });
  }

  it('refuses a creation that rewrites the entry it reads, or the event it emits', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const wallet = await s.signer();
    await (t.contract.connect(wallet) as any).call.put(3n, 7n).send();
    const tLock = addressToLockScript(t.contract.address);
    const captured = await s.capture(compileString(SOURCE, compileOptions('C')), {
      initArgs: [tLock, 3n], constructorCallees: [{ contract: t.contract }],
    });
    expect(verifies(s.provider, captured)).toBe(true);
    const master = captured.sourceOutputs.findIndex((output) => same(output.lockingBytecode, tLock));
    const { getEntryNftAddress, getEventNftAddress } = await import('../../src/stateful/covenant-helpers.js');
    const entryLock = addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'm'));
    const eventLock = addressToLockScript(getEventNftAddress(t.contract.inner as never, t.categoryId, 'Seen(int256,int256)'));
    const at = (lock: Uint8Array): number => captured.transaction.outputs
      .findIndex((output) => same(output.lockingBytecode, lock));
    // The read entry's value raised from 7 to 8: an ordinary read preserves the node it reads.
    const rewritten = withOutput(captured, at(entryLock), (output) => {
      const commitment = Uint8Array.from(output.token.nft.commitment);
      commitment[commitment.length - 1] += 1;
      return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
    });
    expect(inputPasses(s.provider, rewritten.transaction, rewritten.sourceOutputs, master)).toBe(false);
    const forged = withOutput(captured, at(eventLock), (output) => ({
      ...output, token: { ...output.token, nft: { ...output.token.nft, commitment: Uint8Array.of(1, 2) } },
    }));
    expect(inputPasses(s.provider, forged.transaction, forged.sourceOutputs, master)).toBe(false);
  });
});

describe('a callee that emits a wide event (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f(bytes32 x) external returns (bool); }
    contract T { int n; event Big(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
      function f(bytes32 x) external returns (bool) { n = n + 1; emit Big(x, x, x, x, x); return true; } }
    contract C { bool ok; constructor(I t, bytes32 x) { ok = t.f(x); } function read() { require(ok); } }`;

  it('lays out the event and its continuation chunk, and refuses a chunk with another payload', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const c = compileString(SOURCE, compileOptions('C'));
    const tLock = addressToLockScript(t.contract.address);
    const x = new Uint8Array(32).fill(0x5a);
    const captured = await s.capture(c, { initArgs: [tLock, x], constructorCallees: [{ contract: t.contract }] });
    expect(verifies(s.provider, captured)).toBe(true);
    const ofCategory = captured.transaction.outputs.map((output, index) => ({ output, index }))
      .filter(({ output }) => output.token !== undefined && binToHex(output.token.category) === t.categoryId
        && output.token.nft?.capability === 'none' && binToHex(output.lockingBytecode) !== '51');
    // The head chunk and one continuation: the encoded payload of five words outgrows one 128-byte commitment.
    const sizes = ofCategory.map(({ output }) => output.token!.nft!.commitment.length);
    expect(sizes).toHaveLength(2);
    expect(sizes[0]).toBe(128);
    expect(sizes[1]).toBeGreaterThan(0);
    const master = captured.sourceOutputs.findIndex((output) => same(output.lockingBytecode, tLock));
    const chunk = ofCategory[1]!.index;
    const forged = withOutput(captured, chunk, (output) => ({
      ...output, token: { ...output.token, nft: { ...output.token.nft, commitment: new Uint8Array(32).fill(0x11) } },
    }));
    expect(inputPasses(s.provider, forged.transaction, forged.sourceOutputs, master)).toBe(false);
  });
});

describe('a callee that hashes or recovers through side-cars of the shared pool (A7, A14 items 5 and 6)', () => {
  const salt = new Uint8Array(32);

  it('co-spends a shared keccak256 side-car at the callee\'s side-car slot', async () => {
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const source = `${P} interface I { function f(bytes b, bytes c) external returns (bool); }
      contract T { bytes32 h; bytes32 g; function f(bytes b, bytes c) external returns (bool) {
        h = keccak256(b); g = keccak256(c); return true; } }
      contract C { bool ok; constructor(I t, bytes b, bytes c) { ok = t.f(b, c); } function read() { require(ok); } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(source, compileOptions('C'));
    const b = Uint8Array.from([1, 2, 3]);
    const d = Uint8Array.from([4, 5]);
    const deploy = (): Promise<DeployResult<Artifact>> => s.deploy(c, {
      initArgs: [tLock, b, d], constructorCallees: [{ contract: t.contract }],
    });
    // No coin of the shared pool: refused before anything is built.
    await expect(deploy()).rejects.toThrow(/No shared keccak sidecar coin was found for the callee 'T\.f'/);
    // The pool must offer one coin per keccak256 call, though the two preimages share one side-car.
    const sharedLock = keccakComputeLockingBytecode(salt, true);
    for (const index of [0, 1]) {
      await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-callee', sharedLock, index));
    }
    const result = await deploy();
    const state = (await t.contract.getState()) as { h?: Uint8Array; g?: Uint8Array };
    expect(binToHex(state.h!)).toBe(binToHex(keccak(b)));
    expect(binToHex(state.g!)).toBe(binToHex(keccak(d)));
    // The side-car recreates at its own index, which is the callee's side-car slot: two past its master.
    const master = result.tx.outputs.findIndex((output) => same(output.lockingBytecode, tLock));
    expect(binToHex(result.tx.outputs[master + 2]!.lockingBytecode)).toBe(binToHex(sharedLock));

    // A second creation, captured: a side-car whose recreation commits another digest is refused by the callee.
    const captured = await s.capture(c, { initArgs: [tLock, b, d], constructorCallees: [{ contract: t.contract }] });
    expect(verifies(s.provider, captured)).toBe(true);
    const calleeMaster = captured.sourceOutputs.findIndex((output) => same(output.lockingBytecode, tLock));
    const sidecar = captured.transaction.outputs.findIndex((output) => same(output.lockingBytecode, sharedLock));
    const forged = withOutput(captured, sidecar, (output) => {
      const commitment = Uint8Array.from(output.token.nft.commitment);
      commitment[0] ^= 1;
      return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
    });
    expect(inputPasses(s.provider, forged.transaction, forged.sourceOutputs, calleeMaster)).toBe(false);
  });

  it('takes distinct shared coins for two callees and the constructor\'s own side-car', async () => {
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const source = `${P} interface I { function f(bytes b, bytes c) external returns (bool); }
      contract T { bytes32 h; bytes32 g; function f(bytes b, bytes c) external returns (bool) {
        h = keccak256(b); g = keccak256(c); return true; } }
      contract C { bool ok; bytes32 own;
        constructor(I t, I u, bytes b, bytes c, bytes x) {
          bool first = t.f(b, c); bool second = u.f(c, b); ok = first && second; own = keccak256(x); }
        function read() { require(ok); } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const u = await s.deploy(compileString(source, compileOptions('T')));
    const sharedLock = keccakComputeLockingBytecode(salt, true);
    for (const index of [0, 1, 2, 3]) {
      await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-two-callees', sharedLock, index));
    }
    const b = Uint8Array.from([7]);
    const c = Uint8Array.from([8, 9]);
    const x = Uint8Array.from([10, 11, 12]);
    const created = await s.deploy(compileString(source, compileOptions('C')), {
      initArgs: [addressToLockScript(t.contract.address), addressToLockScript(u.contract.address), b, c, x],
      constructorCallees: [{ contract: t.contract }, { contract: u.contract }],
    });
    const state = (await created.contract.getState()) as { ok?: boolean; own?: Uint8Array };
    expect(state.ok).toBe(true);
    expect(binToHex(state.own!)).toBe(binToHex(keccak(x)));
    expect(binToHex(((await u.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(c)));
    const spent = created.tx.inputs.map((input) => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(spent).size).toBe(spent.length);
    expect(created.tx.outputs.filter((output) => same(output.lockingBytecode, sharedLock))).toHaveLength(3);
  });

  it('co-spends a shared keccak256 chain in the callee\'s trailing region', async () => {
    const { keccakChainLockingBytecode, planKeccakChain } = await import('@solidcash/utils');
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const source = `${P} interface I { function f(bytes b) external returns (bytes32); }
      contract T { int n; function f(bytes b) external returns (bytes32) { n = n + 1; return keccak256(b); } }
      contract C { bytes32 h; constructor(I t, bytes b) { h = t.f(b); } function read() { require(h != 0x); } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    expect(t.contract.inner.artifact.abi.find((entry) => entry.name === 'f')?.keccakChainReads).toBe(true);
    const preimage = new Uint8Array(200).map((_, index) => index & 0xff);
    for (const [step, entry] of planKeccakChain(preimage).entries()) {
      const lock = keccakChainLockingBytecode(salt, entry.kind, true);
      await s.provider.seedUtxo(binToHex(lock), computeSideCarStandIn('keccak-callee-chain', lock, step));
    }
    const tLock = addressToLockScript(t.contract.address);
    const c = await s.deploy(compileString(source, compileOptions('C')), {
      initArgs: [tLock, preimage], constructorCallees: [{ contract: t.contract }],
    });
    expect(binToHex(((await c.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(preimage)));
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
  });

  it('co-spends a shared ecrecover group at the callee\'s side-car slots', async () => {
    const { ethers } = await import('ethers');
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const wallet = new ethers.Wallet(`0x${'44'.repeat(32)}`);
    const message = 'callee-ecrecover';
    const parsed = ethers.Signature.from(await wallet.signMessage(message));
    const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex.replace(/^0x/, ''))).reverse();
    const expected = hexToBin(wallet.signingKey.compressedPublicKey.replace(/^0x/, ''));
    const source = `${P} interface I { function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool); }
      contract T(pubkey expected) { bool ok;
        function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
          ok = ecrecoverPubKey(h, v, r, s) == expected; return ok; } }
      contract C { bool ok; constructor(I t, bytes32 h, int v, bytes32 r, bytes32 s) { ok = t.f(h, v, r, s); }
        function read() { require(ok); } }`;
    const s = setup();
    for (const [index, role] of (['A', 'B2', 'M', 'B3'] as const).entries()) {
      await s.provider.seedUtxo(binToHex(ecrecoverComputeLockingBytecode(salt, role)), {
        txid: `${(0xa0 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
        token: { category: 'ed'.repeat(31) + '13', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const t = await s.deploy(compileString(source, compileOptions('T')), {}, [expected]);
    const tLock = addressToLockScript(t.contract.address);
    const c = await s.deploy(compileString(source, compileOptions('C')), {
      initArgs: [tLock, little(ethers.hashMessage(message)), BigInt(parsed.v), little(parsed.r), little(parsed.s)],
      constructorCallees: [{ contract: t.contract }],
    });
    expect(((await t.contract.getState()) as { ok?: boolean }).ok).toBe(true);
    expect(((await c.contract.getState()) as { ok?: boolean }).ok).toBe(true);
  });
});

describe('a callee that stores msg.sender in an entry or a record (A7, A14 item 5)', () => {
  /** A 35-byte lock that is neither the child's nor any coin's. */
  const OTHER = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x5b), 0x87);
  // The first is a fixed layout. A struct value takes its old value as a witness, which the ordinary build of the call
  // lays out, the second one past the inline limit as well: 36 + 31 bytes for the child, 26 + 31 for a P2PKH sender.
  const SHAPES: Array<{ name: string; body: string; args: unknown[]; read: (t: any) => Promise<Uint8Array> }> = [
    { name: 'a mapping value', body: 'mapping(int => address) owners; function f(int x, bytes note) external returns (bool) { owners[x] = msg.sender; return true; }',
      args: [5n, new Uint8Array()], read: async (t) => t.owners(5n) },
    { name: 'a struct field of a mapping value', body: 'struct Rec { address who; int x; } mapping(int => Rec) recs; function f(int x, bytes note) external returns (bool) { recs[x] = Rec(msg.sender, x); return true; }',
      args: [5n, new Uint8Array()], read: async (t) => (await t.recs(5n)).who },
    { name: 'a struct field its lock takes past the inline limit', body: 'struct Rec { address who; bytes note; } mapping(int => Rec) recs; function f(int x, bytes note) external returns (bool) { recs[x] = Rec(msg.sender, note); return true; }',
      args: [5n, new Uint8Array(30).fill(7)], read: async (t) => (await t.recs(5n)).who },
    { name: 'a struct field of a record', body: 'struct Rec { address who; int x; } Rec last; function f(int x, bytes note) external returns (bool) { last = Rec(msg.sender, x); return true; }',
      args: [5n, new Uint8Array()], read: async (t) => (await t.getState()).last.who },
  ];
  for (const shape of SHAPES) {
    it(`stores the child as ${shape.name}, and refuses a creation that stores another lock`, async () => {
      const source = `${P} interface I { function f(int x, bytes note) external returns (bool); } contract T { ${shape.body} }
        contract C { bool ok; constructor(I t, int x, bytes note) { ok = t.f(x, note); } function read() { require(ok); } }`;
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      await s.signer();
      const tLock = addressToLockScript(t.contract.address);
      const c = compileString(source, compileOptions('C'));
      const extra = { initArgs: [tLock, ...shape.args], constructorCallees: [{ contract: t.contract }] };
      const captured = await s.capture(c, extra);
      expect(verifies(s.provider, captured)).toBe(true);
      const master = captured.sourceOutputs.findIndex((output) => same(output.lockingBytecode, tLock));
      // The child's master: the P2SH32 output that carries a minting NFT of its own category.
      const child = Uint8Array.from(captured.transaction.outputs.find((output) => output.token?.nft?.capability === 'minting'
        && binToHex(output.token.category) !== t.categoryId && output.lockingBytecode.length === 35)!.lockingBytecode);
      expect(captured.transaction.outputs.some((output) => binToHex(output.lockingBytecode) === '5161')).toBe(false);
      // Each output of T that holds the child's lock, or its first 20 bytes where the value runs on into a chunk, with
      // another lock's there instead: refused.
      const [held, other] = [binToHex(child.slice(0, 20)), binToHex(OTHER.slice(0, 20))];
      const stores = captured.transaction.outputs.map((output, index) => (output.token !== undefined
        && binToHex(output.token.category) === t.categoryId
        && binToHex(output.token.nft?.commitment ?? new Uint8Array()).includes(held) ? index : -1))
        .filter((index) => index >= 0);
      expect(stores.length).toBeGreaterThan(0);
      for (const index of stores) {
        const forged = withOutput(captured, index, (output) => ({
          ...output,
          token: {
            ...output.token,
            nft: {
              ...output.token.nft, commitment: hexToBin(binToHex(output.token.nft.commitment).split(held).join(other)),
            },
          },
        }));
        expect(inputPasses(s.provider, forged.transaction, forged.sourceOutputs, master)).toBe(false);
      }
      const created = await s.deploy(c, extra);
      const lock = addressToLockScript(created.contract.address);
      expect(binToHex(await shape.read(t.contract))).toBe(binToHex(lock));
    });
  }
});

describe('a callee that writes an entry under a condition (A7, A14 item 5)', () => {
  const SOURCE = `${P} interface I { function f(int x) external returns (bool); }
    contract T { mapping(int => int) m; event E(int v);
      function put(int k, int v) public { m[k] = v; }
      function f(int x) external returns (bool) { if (x > 0) { m[x] = 1; emit E(x); } return true; } }
    contract C { bool ok; constructor(I t, int x) { ok = t.f(x); } function read() { require(ok); } }`;

  for (const [x, existing] of [[2n, false], [3n, true], [0n, false], [-4n, true]] as const) {
    it(`${x > 0n ? 'writes' : 'skips'} the entry of ${x}${existing ? ', which exists' : ''}`, async () => {
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const wallet = await s.signer();
      if (existing) await (t.contract.connect(wallet) as any).call.put(x, 9n).send();
      const tLock = addressToLockScript(t.contract.address);
      await s.deploy(compileString(SOURCE, compileOptions('C')), {
        initArgs: [tLock, x], constructorCallees: [{ contract: t.contract }],
      });
      const value = await (t.contract as any).m(x);
      expect(value).toBe(x > 0n ? 1n : existing ? 9n : 0n);
    });
  }
});

describe('a callee that checks tx.time (A5, A14 item 7)', () => {
  const SOURCE = `${P} interface I { function f(int t) external returns (bool); }
    contract T { int n; function f(int t) external returns (bool) { require(tx.time >= t); n = n + 1; return true; } }
    contract C { bool ok; constructor(I t, int when) { ok = t.f(when); } function read() { require(ok); } }
    contract D { bool ok; int born; constructor(I t, int when) { ok = t.f(when); born = int(block.timestamp); }
      function read() { require(ok); } }`;

  it('sets the creation\'s locktime to the callee\'s bound, which the callee refuses one lower', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const tLock = addressToLockScript(t.contract.address);
    const when = BigInt(await s.provider.getBlockHeight() - 3);
    const extra = { initArgs: [tLock, when], constructorCallees: [{ contract: t.contract }] };
    const c = compileString(SOURCE, compileOptions('C'));
    const captured = await s.capture(c, extra);
    expect(captured.transaction.locktime).toBe(Number(when));
    expect(verifies(s.provider, captured)).toBe(true);
    const master = captured.sourceOutputs.findIndex((output) => same(output.lockingBytecode, tLock));
    const lower = { ...captured, transaction: { ...captured.transaction, locktime: Number(when) - 1 } };
    expect(inputPasses(s.provider, lower.transaction, lower.sourceOutputs, master)).toBe(false);
    const created = await s.deploy(c, extra);
    expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
  });

  it('meets a callee time check and a constructor\'s block.timestamp with one value', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const when = BigInt(await s.provider.getMedianTimePast() - 500);
    const d = await s.deploy(compileString(SOURCE, compileOptions('D')), {
      initArgs: [addressToLockScript(t.contract.address), when], constructorCallees: [{ contract: t.contract }],
      oraclePool: 'be'.repeat(32),
    });
    // The lowest value that satisfies both: the callee's bound, which is a time, as the constructor needs.
    expect(d.tx.locktime).toBe(Number(when));
    expect(((await d.contract.getState()) as { born?: bigint }).born).toBe(when);
  });

  it('refuses a callee height check beside a constructor that reads block.timestamp, naming both', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const { DeployerLocktimeConflictError } = await import('../../src/stateful/index.js');
    const refusal = await s.deploy(compileString(SOURCE, compileOptions('D')), {
      initArgs: [addressToLockScript(t.contract.address), 7n], constructorCallees: [{ contract: t.contract }],
      oraclePool: 'bf'.repeat(32),
    }).then(() => undefined, (error: unknown) => error);
    expect(refusal).toBeInstanceOf(DeployerLocktimeConflictError);
    expect((refusal as Error).message).toMatch(/the creation of 'D', whose constructor reads block\.timestamp/);
    expect((refusal as Error).message).toMatch(/the callee 'T\.f' of call slot 0, which checks tx\.time >= 7\b/);
  });
});

describe('a callee that recovers keys in a loop (A7, A14 items 5 and 6)', () => {
  const SOURCE = `${P} interface I { function f(bytes32 h, int v, bytes32 r, bytes32 s, int k) external returns (bool); }
    contract T(pubkey owner) { int n; function f(bytes32 h, int v, bytes32 r, bytes32 s, int k) external returns (bool) {
      for (int i = 0; i < k; i++) { require(ecrecoverPubKey(h, v, r, s) == owner); } n = n + 1; return true; } }
    contract C { bool ok; constructor(I t, bytes32 h, int v, bytes32 r, bytes32 s) { ok = t.f(h, v, r, s, 2); }
      function read() { require(ok); } }`;

  it('co-spends a shared triple per iteration after the callee\'s block, and refuses another key or a moved one',
    async () => {
      const { ethers } = await import('ethers');
      const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
      const wallet = new ethers.Wallet(`0x${'44'.repeat(32)}`);
      const message = 'callee-recovery-loop';
      const parsed = ethers.Signature.from(await wallet.signMessage(message));
      const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex.replace(/^0x/, ''))).reverse();
      const expected = hexToBin(wallet.signingKey.compressedPublicKey.replace(/^0x/, ''));
      const salt = new Uint8Array(32);
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')), {}, [expected]);
      const tLock = addressToLockScript(t.contract.address);
      const c = compileString(SOURCE, compileOptions('C'));
      const extra = {
        initArgs: [tLock, little(ethers.hashMessage(message)), BigInt(parsed.v), little(parsed.r), little(parsed.s)],
        constructorCallees: [{ contract: t.contract }],
      };
      // No coin of the shared pool: refused before anything is built.
      await expect(s.deploy(c, extra)).rejects.toThrow(/No shared ecrecover sidecar coin was found for the callee 'T\.f'/);
      for (const [roleIndex, role] of (['A', 'B2', 'M', 'B3'] as const).entries()) {
        for (const index of [0, 1, 2, 3]) {
          await s.provider.seedUtxo(binToHex(ecrecoverComputeLockingBytecode(salt, role)), {
            txid: `${(0xb0 + roleIndex).toString(16)}${index.toString(16).padStart(2, '0')}`.padEnd(64, '0'), vout: 0,
            satoshis: 100_000n,
            token: { category: 'ed'.repeat(31) + '15', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
          });
        }
      }
      const captured = await s.capture(c, extra);
      expect(verifies(s.provider, captured)).toBe(true);
      // Iteration k: A at the callee's master + 3 + 3k (after master, record and the record slot), B2 two on, the
      // middle input a wallet coin with the filler.
      const master = captured.sourceOutputs.findIndex((output) => same(output.lockingBytecode, tLock));
      const lockA = ecrecoverComputeLockingBytecode(salt, 'A');
      const lockB = ecrecoverComputeLockingBytecode(salt, 'B2');
      for (const k of [0, 1]) {
        const a = master + 3 + 3 * k;
        expect(same(captured.sourceOutputs[a].lockingBytecode, lockA)).toBe(true);
        expect(same(captured.sourceOutputs[a + 2].lockingBytecode, lockB)).toBe(true);
        expect(same(captured.transaction.outputs[a + 2]!.lockingBytecode, lockB)).toBe(true);
      }
      // Another key in B's recreation, and A moved where B is read.
      const forged = withOutput(captured, master + 5, (output) => {
        const commitment = Uint8Array.from(output.token.nft.commitment);
        commitment[1] ^= 1;
        return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
      });
      expect(inputPasses(s.provider, forged.transaction, forged.sourceOutputs, master)).toBe(false);
      const swap = <T>(items: readonly T[]): T[] => items.map((item, at) => (
        at === master + 3 ? items[master + 5]! : at === master + 5 ? items[master + 3]! : item));
      expect(inputPasses(s.provider, {
        ...captured.transaction, inputs: swap(captured.transaction.inputs), outputs: swap(captured.transaction.outputs),
      }, swap(captured.sourceOutputs), master)).toBe(false);

      const created = await s.deploy(c, extra);
      expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
      expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    });
});

describe('callee shapes a constructor\'s call does not lay out (A7, A14 item 5)', () => {
  it('refuses a callee that recovers keys in a loop through a helper, before building, with the reason', async () => {
    const source = `${P} interface I { function f(bytes32 h, int v, bytes32 r, bytes32 s, int k) external returns (bool); }
      contract T { int n;
        function rec(bytes32 h, int v, bytes32 r, bytes32 s) private returns (pubkey) { return ecrecoverPubKey(h, v, r, s); }
        function f(bytes32 h, int v, bytes32 r, bytes32 s, int k) external returns (bool) {
          for (int i = 0; i < k; i++) { require(rec(h, v, r, s) != 0x); } n = n + 1; return true; } }
      contract C { bool ok; constructor(I t, bytes32 h, int v, bytes32 r, bytes32 s) { ok = t.f(h, v, r, s, 2); }
        function read() { require(ok); } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const sent: string[] = [];
    const original = s.provider.sendRawTransaction.bind(s.provider);
    (s.provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      sent.push(hex);
      return original(hex);
    };
    const { DeployerCalleeError } = await import('../../src/stateful/index.js');
    const refusal = await s.deploy(compileString(source, compileOptions('C')), {
      initArgs: [addressToLockScript(t.contract.address), new Uint8Array(32), 27n, new Uint8Array(32), new Uint8Array(32)],
      constructorCallees: [{ contract: t.contract }],
    }).then(() => undefined, (error: unknown) => error);
    expect(refusal).toBeInstanceOf(DeployerCalleeError);
    expect((refusal as Error).message).toMatch(/'T\.f' cannot be bound: it recovers keys in a loop through a helper/);
    // The refusal comes before the prep, so nothing was sent.
    expect(sent).toHaveLength(0);
  });

  it('refuses a callee whose ordinary build reorders its loop\'s keys, which the child would not pass, before sending',
    async () => {
      const source = `${P} interface I { function f(int[] ks) external returns (bool); }
        contract T { mapping(int => int) m;
          function f(int[] ks) external returns (bool) { for (int i = 0; i < ks.length; i++) { m[ks[i]] = i + 1; } return true; } }
        contract C { bool ok; constructor(I t, int a, int b) { ok = t.f([a, b]); } function read() { require(ok); } }`;
      const { keyToSlot, bytesToSlotValue } = await import('../../src/stateful/SortedList.js');
      const { bigIntToVmNumber } = await import('@bitauth/libauth');
      const slot = (key: bigint): bigint => bytesToSlotValue(keyToSlot(bigIntToVmNumber(key)));
      // Two keys the empty mapping inserts after its head, the first of them above the second: the build puts the
      // chain's inserts in key order, and so passes the array in another order than the constructor's.
      const pairs = [1n, 2n, 3n, 4n, 5n].flatMap((a) => [1n, 2n, 3n, 4n, 5n].map((b) => [a, b] as const));
      const [a, b] = pairs.find(([left, right]) => slot(left) > slot(right))!;
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      await s.signer();
      const sent: string[] = [];
      const original = s.provider.sendRawTransaction.bind(s.provider);
      (s.provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
        sent.push(hex);
        return original(hex);
      };
      const { DeployerCalleeError } = await import('../../src/stateful/index.js');
      const refusal = await s.deploy(compileString(source, compileOptions('C')), {
        initArgs: [addressToLockScript(t.contract.address), a, b],
        constructorCallees: [{ contract: t.contract, args: [[a, b]] }],
      }).then(() => undefined, (error: unknown) => error);
      expect(refusal).toBeInstanceOf(DeployerCalleeError);
      expect((refusal as Error).message).toMatch(
        /'T\.f' cannot be bound: the ordinary build of its call runs it on other arguments than the constructor passes/);
      expect(sent).toHaveLength(0);
    });

  for (const [form, call] of [
    ['a typed call', 'last = u.g(msg.sender);'],
    ['a low-level call', '(bool ok, bytes memory data) = address(u).call(abi.encodeWithSelector(IU.g.selector, msg.sender)); '
      + 'require(ok && data.length > 0);'],
  ] as const) {
    it(`refuses a callee that passes msg.sender on in ${form}, before sending`, async () => {
      const source = `${P} interface IU { function g(address who) external returns (address); }
        interface I { function f(IU u) external returns (bool); }
        contract U { address seen; function g(address who) external returns (address) { seen = who; return who; } }
        contract T { address last; function f(IU u) external returns (bool) { ${call} return true; } }
        contract C { bool ok; constructor(I t, IU u) { ok = t.f(u); } function read() { require(ok); } }`;
      const s = setup();
      const u = await s.deploy(compileString(source, compileOptions('U')));
      const t = await s.deploy(compileString(source, compileOptions('T')));
      const sent: string[] = [];
      const original = s.provider.sendRawTransaction.bind(s.provider);
      (s.provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
        sent.push(hex);
        return original(hex);
      };
      const { DeployerCalleeError } = await import('../../src/stateful/index.js');
      const refusal = await s.deploy(compileString(source, compileOptions('C')), {
        initArgs: [addressToLockScript(t.contract.address), addressToLockScript(u.contract.address)],
        constructorCallees: [{ contract: t.contract, externalContracts: [u.contract] }],
      }).then(() => undefined, (error: unknown) => error);
      expect(refusal).toBeInstanceOf(DeployerCalleeError);
      expect((refusal as Error).message).toMatch(/'T\.f' cannot be bound: it passes msg\.sender to a contract it calls/);
      expect(sent).toHaveLength(0);
    });
  }
});
