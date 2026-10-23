import { describe, expect, it } from 'vitest';
import {
  binToHex, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import {
  ATOMIC_MESSAGE_BUS_DOMAIN_HEX, MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN,
  bytesEqual, bytesToHex, FrameKind, TokenCapability, type FunctionSplitBundle, type StateLayout,
} from '@solidcash/utils';
import { framedValidator } from 'solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../../src/network/NetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  MasterPoolDeployment,
  classifyFramedDeployment,
  deployFunctionSplitShard,
  readFramedDeployment,
  readFramedState,
  resizeFramedPool,
} from '../../../src/framed/deploy/index.js';
import { poolGenesisSatoshis } from '../../../src/framed/deploy/pool.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { callFramedProxyEntry, deployFramedProxy } from '../../../src/framed/proxy/deploy.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * Per-entry pools for `split: 'func'`.
 *
 * Genesis, classification, split/merge and calls go through the shipped framed functions. The chain here is
 * the provider the call reads; nothing is broadcast, and a refused pool fails before `sendRawTransaction`.
 */

const FRAMED = { composition: 'framed' as const, suppressWarnings: true };
const ADMIN = `0x${binToHex(alicePub)}`;
const SOURCE = `pragma solidcash ^0.14.0;
contract Ledger {
  int x;
  pubkey constant ADMIN = pubkey(${ADMIN});
  function f(int k) { this.x = k; require(this.x == k); }
  function g(int k) { f(k); require(this.x == k); }
  function h(int k) { this.f(k); require(this.x == k); }
  function look() view returns (int) { return this.x; }
  function peek() { int v = this.look(); require(v == this.x); }
  function ext(int k) external { this.x = k; require(this.x == k); }
  function fork(int n, sig s) split(n) { require(checkSig(s, ADMIN)); require(n >= 1); }
}`;

const bundle = compileStringSplit(SOURCE, { split: 'func', ...FRAMED });
const CATEGORY = Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0xa5 : 0x5a));
const CATEGORY_ID = bytesToHex(CATEGORY);
const VALIDATOR = framedValidator.buildValidatorProgram();
const CALLER = new Uint8Array(25).fill(0x02);

function shardOf(name: string): (typeof bundle.shards)[number] {
  const found = bundle.shards.find((shard) => shard.function === name);
  if (found === undefined) throw new Error(`missing shard ${name}`);
  return found;
}

function filledLock(name: string): Uint8Array {
  return deployFunctionSplitShard(shardOf(name), CATEGORY, VALIDATOR).lockingBytecode;
}

function masterUtxo(vout: number, lock: Uint8Array | undefined, commitment = ''): Utxo {
  return {
    txid: 'ab'.repeat(32),
    vout,
    satoshis: 1_200n + BigInt(vout),
    ...(lock === undefined ? {} : { lockingBytecode: lock }),
    token: {
      category: CATEGORY_ID,
      amount: 0n,
      nft: { capability: 'minting', commitment },
    },
  };
}

function providerOf(utxos: readonly Utxo[], sent: { n: number }): NetworkProvider {
  return {
    network: 'mocknet',
    getUtxosByTokenCategory: async () => utxos,
    sendRawTransaction: async () => {
      sent.n += 1;
      return '11'.repeat(32);
    },
  } as unknown as NetworkProvider;
}

const funder = {
  generateLockingBytecode: (): Uint8Array => CALLER,
  generateUnlockingBytecode: (): Uint8Array => new Uint8Array(),
};

describe('function-split pools', () => {
  it('mints one empty-commitment pool per entry at that entry lock, and one addrV', () => {
    const deployment = MasterPoolDeployment.createFunctionSplit({
      bundle, category: CATEGORY, validatorProgram: VALIDATOR, size: { masters: 3, validators: 2 },
    });
    const pools = deployment.getGenesisPools();
    const minting = pools.filter((pool) => pool.capability === TokenCapability.MINTING);
    const validator = pools[pools.length - 1]!;
    expect(minting).toHaveLength(bundle.shards.length);
    const dispatched = bundle.abi.filter((fn) =>
      !(fn.modifiers ?? []).some((modifier) => modifier === 'split' || modifier === 'merge'));
    expect(bundle.shards.length).toBe(dispatched.length);
    expect(new Set(minting.map((pool) => bytesToHex(pool.lockingBytecode))).size).toBe(bundle.shards.length);
    for (const pool of pools) {
      expect(pool.commitment.length).toBe(0);
      expect([...pool.category]).toStrictEqual([...CATEGORY]);
    }
    for (const pool of minting) {
      expect(pool.count).toBe(3);
      expect(bytesEqual(pool.lockingBytecode, deployment.getAddress())).toBe(false);
    }
    expect(validator.capability).toBe(TokenCapability.MUTABLE);
    expect(validator.count).toBe(2);
    expect(validator.lockingBytecode).toStrictEqual(deployment.getAddress());
    const locks = deployment.getEntryLocks();
    expect(locks.map((lock) => bytesToHex(lock))).toStrictEqual(
      minting.map((pool) => bytesToHex(pool.lockingBytecode)),
    );
    // Every shard presents the same address, and that address is not a function lock.
    const addresses = bundle.shards.map((shard) =>
      deployFunctionSplitShard(shard, CATEGORY, VALIDATOR).address);
    for (const address of addresses) expect(address).toStrictEqual(deployment.getAddress());
  });

  it('groups masters by lock, including a minting NFT whose commitment is not empty', () => {
    const layout = bundle.logical.stateLayout as StateLayout;
    const fLock = filledLock('f');
    const hLock = filledLock('h');
    const tagged = classifyFramedDeployment([
      masterUtxo(0, fLock, ''),
      masterUtxo(1, fLock, 'ab'),
      masterUtxo(2, hLock, ''),
    ], layout);
    expect(tagged.masters).toHaveLength(3);
    expect(tagged.mastersByLock.size).toBe(2);
    expect(tagged.mastersByLock.get(bytesToHex(fLock))?.map((utxo) => utxo.vout)).toStrictEqual([0, 1]);
    expect(tagged.mastersByLock.get(bytesToHex(hLock))?.map((utxo) => utxo.vout)).toStrictEqual([2]);

    const monolith = classifyFramedDeployment([
      masterUtxo(1, fLock, 'abcd'),
      masterUtxo(0, fLock, ''),
    ], layout);
    expect(monolith.mastersByLock.size).toBe(1);
    expect([...monolith.mastersByLock.values()][0]).toHaveLength(2);

    const untagged = classifyFramedDeployment([
      masterUtxo(0, undefined, 'ff'),
      masterUtxo(1, undefined, ''),
    ], layout);
    expect(untagged.masters).toHaveLength(2);
    expect([...untagged.mastersByLock.keys()]).toStrictEqual(['']);
  });

  it('spends the entry lock and refuses an empty pool by name before a transaction', async () => {
    const sent = { n: 0 };
    const fLock = filledLock('f');
    const hLock = filledLock('h');
    const call = {
      provider: providerOf([masterUtxo(0, hLock)], sent),
      artifact: bundle.logical,
      categoryId: CATEGORY_ID,
      functionName: 'f',
      args: [1n],
      callerUtxo: { txid: 'cc'.repeat(32), vout: 0, satoshis: 50_000n },
      callerLockingBytecode: CALLER,
      funder,
      split: bundle,
      validatorProgram: VALIDATOR,
    };
    await expect(callFramedEntry(call)).rejects.toThrow(/function "f" has no master in its pool/);
    expect(sent.n).toBe(0);

    const present = providerOf([masterUtxo(0, fLock), masterUtxo(1, hLock)], sent);
    await expect(callFramedEntry({ ...call, provider: present })).rejects.toThrow(/holds no validator/);
    expect(sent.n).toBe(0);

    await expect(callFramedEntry({
      ...call, provider: providerOf([], sent), split: undefined,
    })).rejects.toThrow(/holds no master/);
    expect(sent.n).toBe(0);
  });

  it('resizes only the named entry and leaves another entry\'s pool untouched', async () => {
    const sent = { n: 0 };
    await expect(resizeFramedPool('split', {
      provider: providerOf([masterUtxo(0, filledLock('h'))], sent),
      artifact: bundle.logical,
      categoryId: CATEGORY_ID,
      count: 1,
      admin: funder as never,
      fundingUtxos: [],
      funder,
      changeAddress: 'bitcoincash:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      selector: shardOf('f').selector,
      split: bundle,
      validatorProgram: VALIDATOR,
    })).rejects.toThrow(/function "f" has no master in its pool/);
    expect(sent.n).toBe(0);
    await expect(resizeFramedPool('split', {
      provider: providerOf([masterUtxo(0, filledLock('f'))], sent),
      artifact: bundle.logical,
      categoryId: CATEGORY_ID,
      count: 1,
      admin: funder as never,
      fundingUtxos: [],
      funder,
      changeAddress: 'bitcoincash:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      selector: 'deadbeef',
      split: bundle,
      validatorProgram: VALIDATOR,
    })).rejects.toThrow(/no shard for selector deadbeef/);
    expect(sent.n).toBe(0);
  });

  it('keeps an external shard off INTERNAL, a public shard on it, and a view on STATIC', () => {
    expect(shardOf('ext').acceptedFrameKinds).not.toContain('INTERNAL');
    expect(shardOf('f').acceptedFrameKinds).toContain('INTERNAL');
    expect(shardOf('look').acceptedFrameKinds).toContain('STATIC');
    expect(shardOf('g').artifact.composition?.stopSites?.entries
      .find((entry) => entry.functionName.endsWith('.g()'))?.calls ?? []).toEqual([]);
    const calls = shardOf('h').artifact.composition?.stopSites?.entries
      .find((entry) => entry.functionName.endsWith('.h()'))?.calls ?? [];
    expect(calls).toEqual([expect.objectContaining({
      functionName: 'f', selector: shardOf('f').selector.toLowerCase(), target: '',
    })]);
  });

  it('fails a proxy closed on an unknown selector before a transaction', async () => {
    const sent = { n: 0 };
    await expect(callFramedProxyEntry({
      provider: providerOf([], sent),
      implementationArtifact: bundle.logical,
      proxyCategoryId: CATEGORY_ID,
      implementationCategoryId: bytesToHex(
        Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0x94 : 0x6b)),
      ),
      functionName: 'missing',
      callerUtxo: { txid: 'cc'.repeat(32), vout: 0, satoshis: 50_000n },
      callerLockingBytecode: CALLER,
      funder,
      split: bundle,
    })).rejects.toThrow(/no shard for "missing"/);
    expect(sent.n).toBe(0);
  });
});

/**
 * The same pools, spent through the shipped deploy and call path and judged by the composition machine.
 */

let coinNonce = 0xa0;

function freshCoin(satoshis: bigint): Utxo {
  coinNonce += 1;
  return { txid: coinNonce.toString(16).padStart(64, '0'), vout: 0, satoshis };
}

interface LiveDeployment {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly changeAddress: string;
  readonly split: FunctionSplitBundle;
}

function shardLock(split: FunctionSplitBundle, name: string, categoryId: string): Uint8Array {
  const shard = split.shards.find((candidate) => candidate.function === name);
  if (shard === undefined) throw new Error(`missing shard ${name}`);
  return deployFunctionSplitShard(shard, hexToBin(categoryId), VALIDATOR).lockingBytecode;
}

async function deployLive(split: FunctionSplitBundle): Promise<LiveDeployment> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const funding = freshCoin(800_000n);
  await provider.addUtxo(binToHex(callerLock), funding);
  const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
  if (typeof encoded === 'string') throw new Error(encoded);
  const changeAddress = encoded.address;
  const { categoryId } = await deployStatefulContract(split.logical, [], {
    provider, fundingUtxo: funding, funder: signature.unlockP2PKH(), changeAddress,
    threadCount: 1, validatorCount: 1, functionSplit: split,
  });
  return { provider, categoryId, callerLock, funder: signature.unlockP2PKH(), changeAddress, split };
}

async function enterLive(
  live: LiveDeployment, functionName: string, args: readonly bigint[],
): Promise<FramedCallResult> {
  const callerUtxo = freshCoin(300_000n);
  await live.provider.addUtxo(binToHex(live.callerLock), callerUtxo);
  return callFramedEntry({
    provider: live.provider, artifact: live.split.logical, categoryId: live.categoryId, functionName,
    args, callerUtxo, callerLockingBytecode: live.callerLock, funder: live.funder, split: live.split,
    vm: compositionMachine(), validatorProgram: VALIDATOR,
  });
}

function verdictText(result: FramedCallResult): string {
  return result.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
}

function commitmentHex(commitment: Uint8Array | string | undefined): string {
  if (commitment === undefined) return '';
  return typeof commitment === 'string' ? commitment.toLowerCase() : binToHex(commitment);
}

/** A kernel spend carries a verifier NFT (`L3V1`) and the atomic envelope domain in an unlocking script. */
function assertNoKernelBus(result: FramedCallResult): void {
  const verifier = binToHex(MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN);
  for (const output of result.sourceOutputs) {
    expect(commitmentHex(output.token?.nft?.commitment).startsWith(verifier)).toBe(false);
  }
  for (const output of result.transaction.outputs) {
    const token = (output as { token?: { nft?: { commitment?: Uint8Array | string } } }).token;
    expect(commitmentHex(token?.nft?.commitment).startsWith(verifier)).toBe(false);
  }
  for (const input of result.transaction.inputs) {
    expect(binToHex(input.unlockingBytecode).toLowerCase().includes(ATOMIC_MESSAGE_BUS_DOMAIN_HEX)).toBe(false);
  }
}

function mintingLocks(result: FramedCallResult): string[] {
  return result.sourceOutputs.flatMap((output) => (
    output.token?.nft?.capability === 'minting' && output.lockingBytecode !== undefined
      ? [bytesToHex(output.lockingBytecode)] : []
  ));
}

describe('function-split calls on the composition machine', () => {
  it('spends one master for an inlined call and two for this.f(), and a view writes nothing', async () => {
    const live = await deployLive(bundle);
    const looked = await enterLive(live, 'look', []);
    expect(looked.accepted, verdictText(looked)).toBe(true);
    expect(looked.values).toStrictEqual([0n]);
    expect(looked.completed.map((frame) => frame.kind)).toStrictEqual([FrameKind.ROOT]);
    const record = looked.draft.layout.participants.find((placed) => placed.kind === 'state')!;
    expect(bytesToHex(looked.transaction.outputs[record.index]!.token!.nft!.commitment))
      .toBe(bytesToHex(looked.sourceOutputs[record.index]!.token!.nft!.commitment));

    const inlined = await enterLive(live, 'g', [8n]);
    expect(inlined.accepted, verdictText(inlined)).toBe(true);
    expect(mintingLocks(inlined)).toStrictEqual([bytesToHex(shardLock(bundle, 'g', live.categoryId))]);
    expect((await readFramedState(live.provider, live.categoryId, bundle.logical.stateLayout!)).byNft[0]!.x)
      .toBe(8n);

    const called = await enterLive(live, 'h', [9n]);
    expect(called.accepted, verdictText(called)).toBe(true);
    expect(called.completed.map((frame) => [frame.functionName, frame.kind])).toStrictEqual([
      ['Ledger.f()', FrameKind.CALL], ['Ledger.h()', FrameKind.ROOT],
    ]);
    const fLock = bytesToHex(shardLock(bundle, 'f', live.categoryId));
    const hLock = bytesToHex(shardLock(bundle, 'h', live.categoryId));
    expect(mintingLocks(called).sort()).toStrictEqual([fLock, hLock].sort());
    const callee = called.completed.find((frame) => frame.kind === FrameKind.CALL)!;
    const calleeMaster = called.draft.layout.participants.find((placed) => placed.id === callee.master)!;
    const address = deployFunctionSplitShard(
      shardOf('f'), hexToBin(live.categoryId), VALIDATOR,
    ).address;
    expect(bytesEqual(called.draft.blockOf(callee.master).self, address)).toBe(true);
    expect(bytesToHex(called.sourceOutputs[calleeMaster.index]!.lockingBytecode!)).toBe(fLock);
    expect((await readFramedState(live.provider, live.categoryId, bundle.logical.stateLayout!)).byNft[0]!.x)
      .toBe(9n);

    const machine = compositionMachine();
    const masters = called.draft.layout.participants.filter((placed) => placed.kind === 'master');
    const swapped = called.transaction.inputs.map((input, index) => {
      const other = masters.find((placed) => placed.index !== index && masters.some((master) => master.index === index));
      if (other === undefined) return input;
      return { ...input, unlockingBytecode: called.transaction.inputs[other.index]!.unlockingBytecode };
    });
    expect(machine.stateSuccess(machine.evaluate({
      inputIndex: calleeMaster.index, sourceOutputs: called.sourceOutputs, transaction: called.transaction,
    }))).toBe(true);
    expect(machine.stateSuccess(machine.evaluate({
      inputIndex: calleeMaster.index, sourceOutputs: called.sourceOutputs,
      transaction: { ...called.transaction, inputs: swapped },
    }))).not.toBe(true);

    const tainted = called.transaction.outputs.map((output, index) => {
      if (index !== calleeMaster.index) return output;
      return {
        ...output,
        token: { ...output.token!, nft: { ...output.token!.nft!, commitment: Uint8Array.of(0xab) } },
      };
    });
    expect(machine.stateSuccess(machine.evaluate({
      inputIndex: calleeMaster.index, sourceOutputs: called.sourceOutputs,
      transaction: { ...called.transaction, outputs: tainted },
    }))).not.toBe(true);

    const peeked = await enterLive(live, 'peek', []);
    expect(peeked.accepted, verdictText(peeked)).toBe(true);
    expect(peeked.completed.map((frame) => [frame.functionName, frame.kind])).toStrictEqual([
      ['Ledger.look()', FrameKind.STATIC], ['Ledger.peek()', FrameKind.ROOT],
    ]);
    expect((await readFramedState(live.provider, live.categoryId, bundle.logical.stateLayout!)).byNft[0]!.x)
      .toBe(9n);
  }, 120_000);

  it('mints on the named entry lock and leaves another entry pool in place', async () => {
    const live = await deployLive(bundle);
    const before = await readFramedDeployment(live.provider, live.categoryId, bundle.logical.stateLayout!);
    const hLock = bytesToHex(shardLock(bundle, 'h', live.categoryId));
    const fLock = bytesToHex(shardLock(bundle, 'f', live.categoryId));
    const hBefore = before.mastersByLock.get(hLock)?.length ?? 0;
    const funding = freshCoin(200_000n);
    await live.provider.addUtxo(binToHex(live.callerLock), funding);
    await resizeFramedPool('split', {
      provider: live.provider, artifact: bundle.logical, categoryId: live.categoryId, count: 1,
      admin: new SignatureTemplate(alicePriv), fundingUtxos: [funding], funder: live.funder,
      changeAddress: live.changeAddress, selector: shardOf('f').selector, split: bundle,
      validatorProgram: VALIDATOR,
    });
    const after = await readFramedDeployment(live.provider, live.categoryId, bundle.logical.stateLayout!);
    expect(after.mastersByLock.get(hLock)?.length).toBe(hBefore);
    expect(after.mastersByLock.get(fLock)?.length).toBe((before.mastersByLock.get(fLock)?.length ?? 0) + 1);
  }, 120_000);

  it('checks addrV on a foreign call and spends the callee function master', async () => {
    const callerBundle = compileStringSplit(`pragma solidcash ^0.14.0;
      interface ILedger { function f(int k) external; }
      contract Caller {
        int n;
        function go(address ledger) { ILedger(ledger).f(1); this.n = 1; require(this.n == 1); }
      }`, { split: 'func', ...FRAMED });
    const ledger = await deployLive(bundle);
    const caller = await deployLive(callerBundle);
    const ledgerAddress = deployFunctionSplitShard(shardOf('f'), hexToBin(ledger.categoryId), VALIDATOR).address;
    const fLock = shardLock(bundle, 'f', ledger.categoryId);
    const go = callerBundle.shards.find((shard) => shard.function === 'go')!;
    const { asmToBytecode } = await import('@solidcash/utils');
    expect(Buffer.from(asmToBytecode(go.artifact.bytecode)).toString('hex').includes(bytesToHex(fLock))).toBe(false);
    const callerUtxo = freshCoin(300_000n);
    await caller.provider.addUtxo(binToHex(caller.callerLock), callerUtxo);
    // The callee's coins live on the ledger's provider. A call reads both categories from one provider, so the
    // ledger's token UTXOs are copied onto the caller's chain before the entry runs.
    const ledgerUtxos = await ledger.provider.getUtxosByTokenCategory(ledger.categoryId);
    for (const utxo of ledgerUtxos) {
      await caller.provider.addUtxo(binToHex(utxo.lockingBytecode ?? new Uint8Array()), utxo);
    }
    const result = await callFramedEntry({
      provider: caller.provider, artifact: callerBundle.logical, categoryId: caller.categoryId,
      functionName: 'go', args: [ledgerAddress], callerUtxo, callerLockingBytecode: caller.callerLock,
      funder: caller.funder, split: callerBundle, vm: compositionMachine(), validatorProgram: VALIDATOR,
      externals: { ILedger: { artifact: shardOf('f').artifact, categoryId: ledger.categoryId } },
    });
    expect(result.accepted, verdictText(result)).toBe(true);
    expect(result.completed.map((frame) => [frame.functionName, frame.kind])).toStrictEqual([
      ['Ledger.f()', FrameKind.CALL], ['Caller.go()', FrameKind.ROOT],
    ]);
    const callee = result.completed.find((frame) => frame.functionName === 'Ledger.f()')!;
    expect(bytesEqual(result.draft.blockOf(callee.master).self, ledgerAddress)).toBe(true);
    const placed = result.draft.layout.participants.find((participant) => participant.id === callee.master)!;
    expect(bytesToHex(result.sourceOutputs[placed.index]!.lockingBytecode!)).toBe(bytesToHex(fLock));
    const machine = compositionMachine();
    const callerMaster = result.draft.layout.participants.find((participant) => participant.id === 'root')
      ?? result.draft.layout.participants.find((participant) => participant.kind === 'master'
        && participant.id !== callee.master)!;
    const swapped = result.transaction.inputs.map((input, index) => {
      if (index === placed.index) {
        return { ...input, unlockingBytecode: result.transaction.inputs[callerMaster.index]!.unlockingBytecode };
      }
      return input;
    });
    expect(machine.stateSuccess(machine.evaluate({
      inputIndex: placed.index, sourceOutputs: result.sourceOutputs,
      transaction: { ...result.transaction, inputs: swapped },
    }))).not.toBe(true);
  }, 120_000);

  it('spends the implementation shard matching the selector, as a delegate on the proxy', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const callerFunder = signature.unlockP2PKH();
    const implFunding = freshCoin(500_000n);
    const proxyFunding = freshCoin(500_000n);
    const initCoin = freshCoin(300_000n);
    const callCoin = freshCoin(300_000n);
    for (const coin of [implFunding, proxyFunding, initCoin, callCoin]) {
      await network.addUtxo(binToHex(callerLock), coin);
    }
    const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
    if (typeof encoded === 'string') throw new Error(encoded);
    // The implementation names `implementation`, so the generated proxy redeclares that field in the same record.
    const proxyBundle = compileStringSplit(`pragma solidcash ^0.14.0;
      contract Ledger {
        address public implementation;
        int x;
        function f(int k) { this.x = k; require(this.x == k); }
      }`, { split: 'func', ...FRAMED });
    const deployment = await deployFramedProxy({
      provider: network, implementationArtifact: proxyBundle.logical,
      implementationDeploy: { fundingUtxo: implFunding, funder: callerFunder, changeAddress: encoded.address },
      proxyDeploy: { fundingUtxo: proxyFunding, funder: callerFunder, changeAddress: encoded.address },
      initialize: { functionName: 'f', args: [4n] },
      callerLockingBytecode: callerLock,
      callerFunding: { utxo: initCoin, funder: callerFunder, changeAddress: encoded.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.accepted).toBe(true);
    const category = hexToBin(deployment.implementation.categoryId);
    for (const shard of proxyBundle.shards) {
      const deployed = deployFunctionSplitShard(shard, category, VALIDATOR);
      await network.addUtxo(binToHex(deployed.lockingBytecode), {
        ...freshCoin(1_200n),
        token: {
          category: deployment.implementation.categoryId, amount: 0n,
          nft: { capability: 'minting', commitment: '' },
        },
      });
    }
    const call = await callFramedProxyEntry({
      provider: network, implementationArtifact: proxyBundle.logical,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'f', args: [6n], callerUtxo: callCoin, callerLockingBytecode: callerLock, funder: callerFunder,
      changeAddress: encoded.address, split: proxyBundle, vm: compositionMachine(),
    });
    expect(call.accepted, call.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ')).toBe(true);
    expect(call.completed.map((frame) => [frame.functionName, frame.kind])).toEqual(
      expect.arrayContaining([['Ledger.f()', FrameKind.DELEGATE]]),
    );
    const delegate = call.completed.find((frame) => frame.kind === FrameKind.DELEGATE)!;
    const placed = call.draft.layout.participants.find((participant) => participant.id === delegate.master)!;
    expect(bytesToHex(call.sourceOutputs[placed.index]!.lockingBytecode!))
      .toBe(bytesToHex(shardLock(proxyBundle, 'f', deployment.implementation.categoryId)));
    expect(bytesEqual(call.draft.blockOf(delegate.master).self, deployment.proxy.address)).toBe(true);
    expect(bytesEqual(deployment.proxy.address, deployment.implementation.address)).toBe(false);
  }, 120_000);

  it('mints poolSize empty-commitment masters at each entry lock in the genesis transaction', async () => {
    const masters = 2;
    const validators = 1;
    const floor = poolGenesisSatoshis({ masters, validators }, 1200n, bundle.shards.length);
    const oneLock = poolGenesisSatoshis({ masters, validators }, 1200n);
    expect(floor).toBe(oneLock + BigInt(bundle.shards.length - 1) * BigInt(masters) * 1200n);

    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const funding = freshCoin(800_000n);
    await provider.addUtxo(binToHex(callerLock), funding);
    const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
    if (typeof encoded === 'string') throw new Error(encoded);
    const { categoryId, tx } = await deployStatefulContract(bundle.logical, [], {
      provider, fundingUtxo: funding, funder: signature.unlockP2PKH(), changeAddress: encoded.address,
      threadCount: masters, validatorCount: validators, functionSplit: bundle,
    });
    const category = hexToBin(categoryId);
    const outputs = tx.outputs as readonly {
      lockingBytecode: Uint8Array;
      token?: { category: Uint8Array; nft?: { capability: string; commitment: Uint8Array } };
    }[];
    const minting = outputs.filter((output) => output.token?.nft?.capability === 'minting');
    expect(minting).toHaveLength(masters * bundle.shards.length);
    const byLock = new Map<string, number>();
    for (const output of minting) {
      expect(binToHex(output.token!.category)).toBe(categoryId);
      expect(output.token!.nft!.commitment.length).toBe(0);
      const lock = binToHex(output.lockingBytecode);
      byLock.set(lock, (byLock.get(lock) ?? 0) + 1);
    }
    expect(byLock.size).toBe(bundle.shards.length);
    const address = binToHex(deployFunctionSplitShard(bundle.shards[0]!, category, VALIDATOR).address);
    for (const shard of bundle.shards) {
      const deployed = deployFunctionSplitShard(shard, category, VALIDATOR);
      expect(byLock.get(binToHex(deployed.lockingBytecode))).toBe(masters);
      expect(binToHex(deployed.address)).toBe(address);
    }
    const validatorsOut = outputs.filter((output) => output.token?.nft?.capability === 'mutable'
      && binToHex(output.lockingBytecode) === address);
    expect(validatorsOut).toHaveLength(validators);
    for (const output of validatorsOut) expect(output.token!.nft!.commitment.length).toBe(0);
    const held = await provider.getUtxosByTokenCategory(categoryId);
    expect(held.filter((utxo) => utxo.token?.nft?.capability === 'minting'))
      .toHaveLength(masters * bundle.shards.length);
  }, 120_000);

  it('accepts a two-contract cycle on the framed validator and refuses the caller shard as the callee', async () => {
    const alphaBundle = compileStringSplit(`pragma solidcash ^0.14.0;
      interface IBeta { function step(address origin) external; }
      contract Alpha {
        int n;
        function start(address other) {
          this.n = 1;
          IBeta(other).step(address(this));
          require(this.n == 2);
        }
        function finish() { this.n = 2; require(this.n == 2); }
      }`, { split: 'func', ...FRAMED });
    const betaBundle = compileStringSplit(`pragma solidcash ^0.14.0;
      interface IAlpha { function finish() external; }
      contract Beta {
        int m;
        function step(address origin) {
          this.m = 1;
          IAlpha(origin).finish();
          require(this.m == 1);
        }
      }`, { split: 'func', ...FRAMED });
    for (const split of [alphaBundle, betaBundle]) {
      expect(split.logical.messageBus?.available ?? false).toBe(false);
      expect(split.logical.kernelExecutionPlans).toBeUndefined();
      expect(split.logical.messageBus?.verifierProgram).toBeUndefined();
      for (const shard of split.shards) {
        expect(shard.artifact.messageBus?.available ?? false).toBe(false);
        expect(shard.artifact.kernelExecutionPlans).toBeUndefined();
      }
    }
    const alpha = await deployLive(alphaBundle);
    const beta = await deployLive(betaBundle);
    const betaStep = betaBundle.shards.find((shard) => shard.function === 'step')!;
    const betaAddress = deployFunctionSplitShard(betaStep, hexToBin(beta.categoryId), VALIDATOR).address;
    const callerUtxo = freshCoin(300_000n);
    await alpha.provider.addUtxo(binToHex(alpha.callerLock), callerUtxo);
    const betaUtxos = await beta.provider.getUtxosByTokenCategory(beta.categoryId);
    for (const utxo of betaUtxos) {
      await alpha.provider.addUtxo(binToHex(utxo.lockingBytecode ?? new Uint8Array()), utxo);
    }
    const result = await callFramedEntry({
      provider: alpha.provider, artifact: alphaBundle.logical, categoryId: alpha.categoryId,
      functionName: 'start', args: [betaAddress], callerUtxo, callerLockingBytecode: alpha.callerLock,
      funder: alpha.funder, split: alphaBundle, vm: compositionMachine(), validatorProgram: VALIDATOR,
      externals: { IBeta: { artifact: betaStep.artifact, categoryId: beta.categoryId } },
    });
    expect(result.accepted, verdictText(result)).toBe(true);
    assertNoKernelBus(result);
    const verifierDomain = binToHex(MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN);
    const kernelVerifierInputs = result.sourceOutputs.filter((output) =>
      commitmentHex(output.token?.nft?.commitment).startsWith(verifierDomain));
    expect(kernelVerifierInputs, 'kernel verifier input').toHaveLength(0);
    const messageEnvelopes = result.transaction.inputs.filter((input) =>
      binToHex(input.unlockingBytecode).toLowerCase().includes(ATOMIC_MESSAGE_BUS_DOMAIN_HEX));
    expect(messageEnvelopes, 'message envelope').toHaveLength(0);
    expect(result.completed.map((frame) => [frame.functionName, frame.kind])).toStrictEqual([
      ['Alpha.finish()', FrameKind.CALL],
      ['Beta.step()', FrameKind.CALL],
      ['Alpha.start()', FrameKind.ROOT],
    ]);
    const finish = result.completed.find((frame) => frame.functionName === 'Alpha.finish()')!;
    const step = result.completed.find((frame) => frame.functionName === 'Beta.step()')!;
    const finishAt = result.draft.layout.participants.find((participant) => participant.id === finish.master)!;
    const stepAt = result.draft.layout.participants.find((participant) => participant.id === step.master)!;
    expect(bytesToHex(result.sourceOutputs[finishAt.index]!.lockingBytecode!))
      .toBe(bytesToHex(shardLock(alphaBundle, 'finish', alpha.categoryId)));
    expect(bytesToHex(result.sourceOutputs[stepAt.index]!.lockingBytecode!))
      .toBe(bytesToHex(shardLock(betaBundle, 'step', beta.categoryId)));
    const machine = compositionMachine();
    const callerShardAsCallee = result.transaction.inputs.map((input, index) => (
      index === finishAt.index
        ? { ...input, unlockingBytecode: result.transaction.inputs[stepAt.index]!.unlockingBytecode }
        : input
    ));
    expect(machine.stateSuccess(machine.evaluate({
      inputIndex: finishAt.index, sourceOutputs: result.sourceOutputs,
      transaction: { ...result.transaction, inputs: callerShardAsCallee },
    })), 'caller shard spent as the callee').not.toBe(true);
    expect((await readFramedState(alpha.provider, alpha.categoryId, alphaBundle.logical.stateLayout!)).byNft[0]!.n)
      .toBe(2n);
  }, 180_000);
});
