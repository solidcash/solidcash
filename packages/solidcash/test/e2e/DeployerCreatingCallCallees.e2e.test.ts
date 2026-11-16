/**
 * A7, A14 item 4 step 6: a creating call whose children co-spend side-cars or call contracts. Each child's side-cars
 * (from the shared pool, A14 item 6) and callee blocks follow every index the creator's layout uses, in run order; its
 * `create` reads its side-cars at the base its unlocking names. Two children may call in one creating call when their
 * callees are distinct inputs: one master runs one arm, so two calls of one contract are refused. Every creation is
 * checked by the VM; the tamper cases change one witness of a finished creation and expect the input that checks it to
 * refuse.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { compileStringMulti } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { computeSideCarStandIn } from '../../src/stateful/stateful-abi-resolve.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployFromResult, DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

let serial = 0x900;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Captured = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

const CALLEE = `interface I { function f(int x) external returns (bool); }
  contract T { int total; function f(int x) external returns (bool) { total = total + x; return true; } }`;

/** A provider, a funded author, the compiled `source`, and a deployed factory and two callees of it. */
async function creator(source: string): Promise<{
  provider: MockNetworkProvider; artifacts: Record<string, Artifact>; factory: DeployResult<Artifact>;
  t1: DeployResult<Artifact>; t2: DeployResult<Artifact>; fund: () => Promise<Utxo>; changeAddress: string;
  sent: Captured[];
}> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const fund = async (): Promise<Utxo> => {
    const utxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), utxo);
    return utxo;
  };
  const artifacts = compileStringMulti(source, {
    allowUnsafeOperations: true, __deployerNew: true, genesisCalls: true,
  } as never);
  const deploy = async (artifact: Artifact, initialState: Record<string, unknown>): Promise<DeployResult<Artifact>> => (
    StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await fund(), funder, initialState, changeAddress: change.address,
      senderLockingBytecode: authorLock,
    } as never));
  const t1 = await deploy(artifacts.T!, { total: 0n });
  const t2 = await deploy(artifacts.T!, { total: 0n });
  const factory = await deploy(artifacts.Factory!, { made: 0n });
  // Each transaction sent, with the outputs its inputs spend, read before it spends them.
  const sent: Captured[] = [];
  const original = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      return spent === undefined ? undefined : solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    sent.push({ transaction, sourceOutputs });
    return original(hex);
  };
  return { provider, artifacts, factory, t1, t2, fund, changeAddress: change.address, sent };
}

/** The creation among `sent` that spends a coin at `deployerLock`. */
function creationOf(sent: readonly Captured[], deployerLock: string): Captured {
  const creation = [...sent].reverse().find(({ sourceOutputs }) => sourceOutputs
    .some((output) => output !== undefined && binToHex(output.lockingBytecode) === deployerLock));
  if (creation === undefined) throw new Error('no creation was sent');
  return creation;
}

function inputPasses(provider: MockNetworkProvider, captured: Captured, inputIndex: number): boolean {
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ ...captured, inputIndex } as never) as never) === true;
}

describe('two children whose constructors call, in one creating call (A7, A14 item 4)', () => {
  const SOURCE = `${CALLEE}
    contract Child { bool ok; constructor(I t) { ok = t.f(5); } function read() { require(ok); } }
    contract Factory { int made; function make(I a, I b) { new Child(a); new Child(b); made = made + 2; } }`;

  it('answers each child from its own callee, and refuses a callee list that names the other one', async () => {
    const { provider, artifacts, factory, t1, t2, fund, changeAddress, sent } = await creator(SOURCE);
    const lock1 = addressToLockScript(t1.contract.address);
    const lock2 = addressToLockScript(t2.contract.address);
    const result: DeployFromResult<Artifact> = await StatefulContract.deployFrom({
      provider, factory: factory.contract, deployFunctionName: 'make', deployFunctionArgs: [lock1, lock2],
      childArtifacts: { Child: artifacts.Child! }, fundingUtxo: await fund(),
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress,
      childCallees: [
        { deployment: 0, callees: [{ contract: t1.contract }] },
        { deployment: 1, callees: [{ contract: t2.contract }] },
      ],
    });
    expect(result.children).toHaveLength(2);
    for (const child of result.children) expect(((await child.getState()) as { ok?: boolean }).ok).toBe(true);
    expect(((await t1.contract.getState()) as { total?: bigint }).total).toBe(5n);
    expect(((await t2.contract.getState()) as { total?: bigint }).total).toBe(5n);
    expect(((await result.factory.getState()) as { made?: bigint }).made).toBe(2n);

    const deployerLock = artifacts.Factory!.childDeployers!.Child!.lockingBytecode;
    const creation = creationOf(sent, deployerLock);
    expect(createVirtualMachineBch2026ForProvider(provider).verify(creation as never)).toBe(true);
    // Each child's callee list names its own callee's master. Swapped, each create reads the other's record.
    const deployers = creation.sourceOutputs.map((output, index) => ({ output, index }))
      .filter(({ output }) => binToHex(output.lockingBytecode) === deployerLock).map(({ index }) => index);
    const masters = [lock1, lock2].map((lock) => creation.sourceOutputs
      .findIndex((output) => binToHex(output.lockingBytecode) === binToHex(lock)));
    expect(deployers).toHaveLength(2);
    expect(masters.every((index) => index > 0)).toBe(true);
    const listed = deployers.map((index) => {
      const unlocking = creation.transaction.inputs[index]!.unlockingBytecode;
      return unlocking[6]! | (unlocking[7]! << 8);
    });
    expect([...listed].sort()).toEqual([...masters].sort());
    const swapped = {
      ...creation,
      transaction: {
        ...creation.transaction,
        inputs: creation.transaction.inputs.map((input, index) => {
          if (index !== deployers[0]) return input;
          const unlocking = Uint8Array.from(input.unlockingBytecode);
          const other = listed[1]!;
          unlocking[6] = other & 0xff;
          unlocking[7] = (other >> 8) & 0xff;
          return { ...input, unlockingBytecode: unlocking };
        }),
      },
    };
    expect(inputPasses(provider, swapped, deployers[0]!)).toBe(false);
  });

  it('refuses two children that call one contract, naming both deployments, before broadcasting', async () => {
    const { provider, artifacts, factory, t1, fund, changeAddress, sent } = await creator(SOURCE);
    const lock1 = addressToLockScript(t1.contract.address);
    const before = sent.length;
    await expect(StatefulContract.deployFrom({
      provider, factory: factory.contract, deployFunctionName: 'make', deployFunctionArgs: [lock1, lock1],
      childArtifacts: { Child: artifacts.Child! }, fundingUtxo: await fund(),
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress,
      childConstructorCallees: [{ contract: t1.contract }],
    })).rejects.toThrow(
      /deployment 1 \('Child'\) calls it, and its master is already an input of call slot 0 of deployment 0/,
    );
    expect(sent.length).toBe(before);
    expect(((await t1.contract.getState()) as { total?: bigint }).total).toBe(0n);
  });
});

describe('a child whose constructor hashes through a side-car, in a creating call (A4.4, A14 items 4 and 6)', () => {
  const SOURCE = `${CALLEE}
    contract Child { bool ok; bytes32 h; constructor(I t, bytes b) { ok = t.f(5); h = keccak256(b); }
      function read() { require(ok); } }
    contract Hasher { bytes32 h; constructor(bytes b) { h = keccak256(b); } function read() { require(h != 0x); } }
    contract Factory { int made;
      function make(I t, bytes b) { new Child(t, b); made = made + 1; }
      function hash(bytes b) { new Hasher(b); made = made + 1; } }`;

  it('co-spends the shared side-car after the creator\'s layout, and refuses another digest in it', async () => {
    const { provider, artifacts, factory, fund, changeAddress, sent } = await creator(SOURCE);
    const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
    await provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-creating-call', sharedLock, 0));
    const preimage = Uint8Array.from([9, 8, 7]);
    const result = await StatefulContract.deployFrom({
      provider, factory: factory.contract, deployFunctionName: 'hash', deployFunctionArgs: [preimage],
      childArtifacts: { Hasher: artifacts.Hasher! }, fundingUtxo: await fund(),
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress,
    });
    expect(binToHex(((await result.child.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak_256(preimage)));
    const deployerLock = artifacts.Factory!.childDeployers!.Hasher!.lockingBytecode;
    const creation = creationOf(sent, deployerLock);
    expect(createVirtualMachineBch2026ForProvider(provider).verify(creation as never)).toBe(true);
    const sidecar = creation.sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(sharedLock));
    // The side-car's input and its recreation share one index, past the creator's block and the child's group.
    expect(binToHex(creation.transaction.outputs[sidecar]!.lockingBytecode)).toBe(binToHex(sharedLock));
    expect(sidecar).toBeGreaterThan(creation.transaction.outputs.findIndex((output) => output.token?.nft?.capability
      === 'minting' && binToHex(output.token.category) === result.childCategoryId));
    const dIn = creation.sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === deployerLock);
    expect(inputPasses(provider, creation, dIn)).toBe(true);
    // The side-car's recreation commits another digest: the child's create reads it and pins another record.
    const forged = {
      ...creation,
      transaction: {
        ...creation.transaction,
        outputs: creation.transaction.outputs.map((output, index) => {
          if (index !== sidecar) return output;
          const commitment = Uint8Array.from(output.token!.nft!.commitment);
          commitment[0] ^= 1;
          return { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } } };
        }),
      },
    };
    expect(inputPasses(provider, forged, dIn)).toBe(false);
  });

  it('lays out a child\'s side-car and its callee block in one creating call', async () => {
    const { provider, artifacts, factory, t1, fund, changeAddress } = await creator(SOURCE);
    const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
    await provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-creating-call-2', sharedLock, 0));
    const preimage = Uint8Array.from([1, 1, 2, 3, 5]);
    const lock1 = addressToLockScript(t1.contract.address);
    const result = await StatefulContract.deployFrom({
      provider, factory: factory.contract, deployFunctionName: 'make', deployFunctionArgs: [lock1, preimage],
      childArtifacts: { Child: artifacts.Child! }, fundingUtxo: await fund(),
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress,
      childConstructorCallees: [{ contract: t1.contract }],
    });
    const state = (await result.child.getState()) as { ok?: boolean; h?: Uint8Array };
    expect(state.ok).toBe(true);
    expect(binToHex(state.h!)).toBe(binToHex(keccak_256(preimage)));
    expect(((await t1.contract.getState()) as { total?: bigint }).total).toBe(5n);
  });

  it('co-spends a shared ecrecover group for a child that recovers a key', async () => {
    const source = `${CALLEE}
      contract Rec(pubkey expected) { bool ok;
        constructor(bytes32 h, int v, bytes32 r, bytes32 s) { ok = ecrecoverPubKey(h, v, r, s) == expected; }
        function read() { require(ok); } }
      contract Factory { int made;
        function recover(pubkey e, bytes32 h, int v, bytes32 r, bytes32 s) {
          new Rec{args: (e)}(h, v, r, s); made = made + 1; } }`;
    const { provider, artifacts, factory, fund, changeAddress, sent } = await creator(source);
    const { ethers } = await import('ethers');
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    for (const [index, role] of (['A', 'B2', 'M', 'B3'] as const).entries()) {
      await provider.seedUtxo(binToHex(ecrecoverComputeLockingBytecode(new Uint8Array(32), role)), {
        txid: `${(0xb0 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
        token: { category: 'ed'.repeat(31) + '14', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const wallet = new ethers.Wallet(`0x${'55'.repeat(32)}`);
    const message = 'creating-call-ecrecover';
    const parsed = ethers.Signature.from(await wallet.signMessage(message));
    const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex.replace(/^0x/, ''))).reverse();
    const expected = hexToBin(wallet.signingKey.compressedPublicKey.replace(/^0x/, ''));
    const result = await StatefulContract.deployFrom({
      provider, factory: factory.contract, deployFunctionName: 'recover',
      deployFunctionArgs: [
        expected, little(ethers.hashMessage(message)), BigInt(parsed.v), little(parsed.r), little(parsed.s),
      ],
      childArtifacts: { Rec: artifacts.Rec! }, fundingUtxo: await fund(),
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress,
    });
    expect(((await result.child.getState()) as { ok?: boolean }).ok).toBe(true);
    const creation = creationOf(sent, artifacts.Factory!.childDeployers!.Rec!.lockingBytecode);
    expect(createVirtualMachineBch2026ForProvider(provider).verify(creation as never)).toBe(true);
  });

  it('refuses a child side-car with no coin of the shared pool, before broadcasting', async () => {
    const { provider, artifacts, factory, fund, changeAddress, sent } = await creator(SOURCE);
    const before = sent.length;
    await expect(StatefulContract.deployFrom({
      provider, factory: factory.contract, deployFunctionName: 'hash', deployFunctionArgs: [Uint8Array.of(1)],
      childArtifacts: { Hasher: artifacts.Hasher! }, fundingUtxo: await fund(),
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress,
    })).rejects.toThrow(/No shared keccak sidecar coin was found for deployment 0 \('Hasher'\)/);
    expect(sent.length).toBe(before);
  });
});

describe('a child whose callee checks tx.time, in a creating call (A5, A14 item 7)', () => {
  const SOURCE = `interface I { function f(int t) external returns (bool); }
    contract T { int total; function f(int t) external returns (bool) { require(tx.time >= t); total = total + 1; return true; } }
    contract Child { bool ok; constructor(I t, int when) { ok = t.f(when); } function read() { require(ok); } }
    contract Factory { int made;
      function make(I t, int when) { new Child(t, when); made = made + 1; }
      function guarded(I t, int when, int h) { require(tx.time >= h); new Child(t, when); made = made + 1; } }`;

  it('sets the creation\'s locktime to the callee\'s bound, which the callee refuses one lower', async () => {
    const { provider, artifacts, factory, t1, fund, changeAddress, sent } = await creator(SOURCE);
    const when = BigInt(await provider.getBlockHeight() - 5);
    const lock1 = addressToLockScript(t1.contract.address);
    const result = await StatefulContract.deployFrom({
      provider, factory: factory.contract, deployFunctionName: 'make', deployFunctionArgs: [lock1, when],
      childArtifacts: { Child: artifacts.Child! }, fundingUtxo: await fund(),
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress,
      childConstructorCallees: [{ contract: t1.contract }],
    });
    expect(((await result.child.getState()) as { ok?: boolean }).ok).toBe(true);
    expect(((await t1.contract.getState()) as { total?: bigint }).total).toBe(1n);
    const creation = creationOf(sent, artifacts.Factory!.childDeployers!.Child!.lockingBytecode);
    expect(creation.transaction.locktime).toBe(Number(when));
    const master = creation.sourceOutputs.findIndex((output) => output !== undefined
      && binToHex(output.lockingBytecode) === binToHex(lock1));
    expect(inputPasses(provider, creation, master)).toBe(true);
    const lower = { ...creation, transaction: { ...creation.transaction, locktime: Number(when) - 1 } };
    expect(inputPasses(provider, lower, master)).toBe(false);
  });

  it('refuses a callee time check beside the creator\'s height check, naming both, before broadcasting', async () => {
    const { provider, artifacts, factory, t1, fund, changeAddress, sent } = await creator(SOURCE);
    const lock1 = addressToLockScript(t1.contract.address);
    const when = BigInt(await provider.getMedianTimePast() - 1000);
    const before = sent.length;
    const refusal = await StatefulContract.deployFrom({
      provider, factory: factory.contract, deployFunctionName: 'guarded', deployFunctionArgs: [lock1, when, 10n],
      childArtifacts: { Child: artifacts.Child! }, fundingUtxo: await fund(),
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress,
      childConstructorCallees: [{ contract: t1.contract }],
    }).then(() => undefined, (error: unknown) => error);
    const { DeployerLocktimeConflictError } = await import('../../src/stateful/index.js');
    expect(refusal).toBeInstanceOf(DeployerLocktimeConflictError);
    expect((refusal as Error).message).toMatch(/the callee 'T\.f' of call slot 0, which checks tx\.time >= \d{9,}/);
    expect((refusal as Error).message).toMatch(/'Factory'.*tx\.time >= 10\b/);
    expect(sent.length).toBe(before);
  });
});
