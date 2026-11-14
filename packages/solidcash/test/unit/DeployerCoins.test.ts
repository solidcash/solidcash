/**
 * B9.1, B9.2, B9.3 and B9.10 with a hand-built DeployerAbi: the compiler's Deploy<C> is exercised separately in
 * solidc's `DeployerCreation.test.ts`. These tests pin the SDK's own contract with the deployer.
 */
import { describe, expect, it } from 'vitest';
import {
  encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256, hexToBin, decodeTransaction,
} from '@bitauth/libauth';
import { SignatureTemplate } from '../../src/index.js';
import type { Artifact, DeployerAbi } from '@solidcash/utils';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import {
  assertDeployerCallee, broadcastDeployerPreps, buildDeployerPrep, buildDeployerPreps, buildDeployerSweep,
  buildDeployerUnlocking,
  decodeDeployBinding, decodeDeployerPrep, decideDeployerPath, deployerFallbackCase, deployerLocktime,
  encodeDeployBinding, encodeDeployerCallees, extractDeployBindingFromTrace, readDeployerSiteVisits,
  runDeployerInputsLocal, verifyBirth,
} from '../../src/stateful/deployer.js';
import {
  clearGenesisReservations, coinsAvailableForCallerFee, isReservedGenesisOutpoint,
} from '../../src/stateful/genesis-reservations.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';

const P2SH32 = (redeem: Uint8Array): Uint8Array => encodeLockingBytecodeP2sh32(hash256(redeem));

const CREATE_SELECTOR = 'af341413';
const SWEEP_SELECTOR = '740b423a';

const createAbi = (extra: DeployerAbi['abi'][number]['inputs'] = []): DeployerAbi['abi'] => [{
  name: 'create',
  selector: CREATE_SELECTOR,
  inputs: [
    { name: '__internal__budgetPad', type: 'bytes' },
    { name: '__internal__authorIndex', type: 'bigint' },
    { name: '__internal__identity', type: 'bigint' },
    { name: '__internal__code', type: 'bytes' },
    ...extra,
    { name: '__internal__deployValue', type: 'bigint' },
    { name: '__internal__msgSenderCategory', type: 'bytes32' },
    { name: '__internal__genesisCallees', type: 'bytes' },
  ],
} as never, { name: 'sweep', selector: SWEEP_SELECTOR, inputs: [] } as never];

function fakeDeployer(options: {
  callSlots?: number;
  genesisOutputs?: number;
  code?: Uint8Array;
  redeem?: Uint8Array;
  inputs?: DeployerAbi['abi'][number]['inputs'];
  coinValue?: string;
} = {}): DeployerAbi {
  const bytecode = options.redeem ?? Uint8Array.of(0x51);
  const code = options.code ?? Uint8Array.of(0x51);
  return {
    version: 1,
    bytecode: Buffer.from(bytecode).toString('hex'),
    lockingBytecode: Buffer.from(P2SH32(bytecode)).toString('hex'),
    template: Buffer.from(hash256(code)).toString('hex'),
    code: Buffer.from(code).toString('hex'),
    birthTrailer: false,
    coinValue: options.coinValue ?? '5000',
    sweepAge: 1440,
    abi: createAbi(options.inputs),
    genesisOutputs: options.genesisOutputs ?? 2,
    callSlots: options.callSlots ?? 0,
    satoshiContainer: 'none',
    tokenRows: [],
    collectionRows: [],
    readsBlockData: false,
    constructorReadsSender: false,
    sidecars: { keccak: 0, ecrecover: 0 },
  };
}

const aliceLock = (): Uint8Array => encodeLockingBytecodeP2pkh(alicePkh);

function aliceUnlocker(_provider: MockNetworkProvider): Unlocker {
  return new SignatureTemplate(alicePriv).unlockP2PKH() as Unlocker;
}

const coin = (tag: number, satoshis: bigint): Utxo => ({
  txid: tag.toString(16).padStart(64, '0'), vout: 0, satoshis,
});

describe('B9.1: the prep chain', () => {
  it('locks deployer and author coins, chains change, and reserves the chain', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const signer = aliceUnlocker(provider);
    const authorLock = aliceLock();
    const changeLock = Uint8Array.from([0x51]);
    const a = fakeDeployer();
    const b = fakeDeployer({ genesisOutputs: 3 });
    const funding = [coin(0xa1, 200_000n)];

    const { transactions, preps } = await buildDeployerPreps({
      children: [
        { deployer: a, contractName: 'A' },
        { deployer: b, contractName: 'B' },
        { deployer: a, contractName: 'A2' },
      ],
      fundingUtxos: funding,
      authorSigner: signer,
      authorLockingBytecode: authorLock,
      changeLockingBytecode: changeLock,
      provider,
    });

    expect(transactions).toHaveLength(3);
    expect(preps.map((prep) => prep.broadcast)).toEqual([false, false, false]);
    preps.forEach((prep, index) => {
      const transaction = decodeDeployerPrep(prep);
      expect(Buffer.from(transaction.outputs[0].lockingBytecode).toString('hex'))
        .toBe(index === 1 ? b.lockingBytecode : a.lockingBytecode);
      expect(transaction.outputs[0].valueSatoshis).toBe(BigInt(index === 1 ? b.coinValue : a.coinValue));
      expect(Buffer.from(transaction.outputs[1].lockingBytecode).toString('hex'))
        .toBe(Buffer.from(authorLock).toString('hex'));
      expect(prep.category).toBe(prep.deployerCoin.txid);
      expect(prep.deployerCoin.vout).toBe(0);
      expect(prep.authorCoin.vout).toBe(1);
    });
    const [first, second, third] = preps.map(decodeDeployerPrep);
    expect(second.inputs[0].outpointIndex).toBe(2);
    expect(Buffer.from(second.inputs[0].outpointTransactionHash).toString('hex'))
      .toBe(preps[0].category);
    expect(third.inputs[0].outpointIndex).toBe(2);
    expect(Buffer.from(third.inputs[0].outpointTransactionHash).toString('hex'))
      .toBe(preps[1].category);
    expect(preps[2].changeCoin!.vout).toBe(2);
    expect(preps[2].changeCoin!.lockingBytecode).toEqual(changeLock);

    expect(isReservedGenesisOutpoint(`${funding[0].txid}:0`)).toBe(true);
    expect(isReservedGenesisOutpoint(`${preps[0].authorCoin.txid}:1`)).toBe(true);
    expect(isReservedGenesisOutpoint(`${preps[0].changeCoin!.txid}:2`)).toBe(true);
    expect(coinsAvailableForCallerFee(funding)).toEqual([]);
  });

  it('refuses a reserved funding coin', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const funding = [coin(0xb1, 100_000n)];
    await buildDeployerPrep({
      children: [{ deployer: fakeDeployer(), contractName: 'A' }],
      fundingUtxos: funding,
      authorSigner: aliceUnlocker(provider),
      authorLockingBytecode: aliceLock(),
      changeLockingBytecode: Uint8Array.of(0x51),
      provider,
    });
    await expect(buildDeployerPrep({
      children: [{ deployer: fakeDeployer(), contractName: 'A' }],
      fundingUtxos: funding,
      authorSigner: aliceUnlocker(provider),
      authorLockingBytecode: aliceLock(),
      changeLockingBytecode: Uint8Array.of(0x51),
      provider,
    })).rejects.toThrow(/already reserved/);
  });

  it('broadcasts a chain in order and releases the input reservations', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const funding = [coin(0xb2, 100_000n)];
    await provider.seedUtxo(Buffer.from(aliceLock()).toString('hex'), funding[0]);
    const { prep } = await buildDeployerPrep({
      children: [{ deployer: fakeDeployer(), contractName: 'A' }],
      fundingUtxos: funding,
      authorSigner: aliceUnlocker(provider),
      authorLockingBytecode: aliceLock(),
      changeLockingBytecode: Uint8Array.of(0x51),
      provider,
    });
    expect(isReservedGenesisOutpoint(`${funding[0].txid}:0`)).toBe(true);
    await broadcastDeployerPreps([prep], provider);
    expect(prep.broadcast).toBe(true);
    expect(isReservedGenesisOutpoint(`${funding[0].txid}:0`)).toBe(false);
    expect(isReservedGenesisOutpoint(`${prep.authorCoin.txid}:1`)).toBe(true);
  });

  it('signs the same chain twice to the same txids', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const options = {
      children: [{ deployer: fakeDeployer(), contractName: 'A' }],
      fundingUtxos: [coin(0xc1, 100_000n)],
      authorSigner: aliceUnlocker(provider),
      authorLockingBytecode: aliceLock(),
      changeLockingBytecode: Uint8Array.of(0x51),
      provider,
    };
    const first = await buildDeployerPrep(options);
    clearGenesisReservations();
    const second = await buildDeployerPrep(options);
    expect(second.prep.category).toBe(first.prep.category);
  });
});

describe('B9.2: the create unlocking layout', () => {
  it('puts the callee list at byte 5 and Q at byte 6 + 2s for s = 0', () => {
    const deployer = fakeDeployer({ callSlots: 0 });
    const unlocking = buildDeployerUnlocking({
      deployer, callees: [], authorIndex: 1, identity: true, forBroadcast: true,
    });
    expect(unlocking.slice(0, 5)).toEqual(Uint8Array.from([0x04, 0xaf, 0x34, 0x14, 0x13]));
    expect(unlocking[5]).toBe(0);
    expect(unlocking[6]).toBe(0x20);
    expect(unlocking.slice(7, 39)).toEqual(new Uint8Array(32));
  });

  it('lays out two callees and Q at byte 6 + 2s', () => {
    const deployer = fakeDeployer({ callSlots: 2 });
    const unlocking = buildDeployerUnlocking({
      deployer, callees: [3, 4], authorIndex: 1, identity: false, forBroadcast: true,
    });
    expect(unlocking[5]).toBe(4);
    expect(unlocking.slice(6, 10)).toEqual(Uint8Array.from([3, 0, 4, 0]));
    expect(unlocking[10]).toBe(0x20);
    expect(unlocking.slice(11, 43)).toEqual(new Uint8Array(32));
    expect(() => encodeDeployerCallees(deployer, [3], true)).toThrow(/call slots/);
    expect(() => encodeDeployerCallees(deployer, [3, undefined], true)).toThrow(/no callee/);
  });

  it('lays bound Q ‖ A verbatim after the callee list', () => {
    const deployer = fakeDeployer({ callSlots: 2 });
    const bound = Uint8Array.from([0x01, 0xaa, 0x01, 0xbb]);
    const unlocking = buildDeployerUnlocking({
      deployer, callees: [7, 8], boundBytes: bound, authorIndex: 1, identity: false, forBroadcast: true,
    });
    expect(unlocking.slice(6, 10)).toEqual(Uint8Array.from([7, 0, 8, 0]));
    expect(unlocking.slice(10, 14)).toEqual(bound);
    expect(unlocking[14]).toBe(0x01);
    expect(unlocking[15]).toBe(0x51);
  });

  it('refuses an unlocking over 10,000 bytes', () => {
    const deployer = fakeDeployer({ code: new Uint8Array(10_100).fill(0x51) });
    expect(() => buildDeployerUnlocking({
      deployer, callees: [], authorIndex: 1, forBroadcast: true,
    })).toThrow(/10,000-byte limit/);
  });
});

describe('B9.5: the trace binding', () => {
  const lock = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x11), 0x87]);
  /**
   * A creator's site as the compiler emits it (A6 steps 3 and 4): `<Q ‖ A> <d_in> OP_INPUTBYTECODE`, the selector and
   * callee-list check, the Q ‖ A check, `<d_in> OP_UTXOBYTECODE <DEPLOY(C)> OP_EQUALVERIFY` (here the lock is an
   * invoked definition, as the optimiser leaves a constant used twice), and the X ‖ 02 check.
   */
  const site = [
    { opcode: 0xca }, { opcode: 0x56 }, { opcode: 0x7f }, { opcode: 0x7c },
    { opcode: 0x06, data: Uint8Array.of(0x04, 0xaf, 0x34, 0x14, 0x13, 0x00) }, { opcode: 0x88 },
    { opcode: 0x6b }, { opcode: 0x82 }, { opcode: 0x6c }, { opcode: 0x7c }, { opcode: 0x7f }, { opcode: 0x75 },
    { opcode: 0x88 }, { opcode: 0x57 }, { opcode: 0xc7 }, { opcode: 0x53 }, { opcode: 0x8a }, { opcode: 0x88 },
    { opcode: 0x57 }, { opcode: 0xc8 }, { opcode: 0x76 }, { opcode: 0x52 }, { opcode: 0x7e }, { opcode: 0x58 },
    { opcode: 0xd1 }, { opcode: 0x88 },
  ];
  const state = (stack: Uint8Array[], controlStack: unknown[] = []) => ({
    ip: 0, instructions: site, stack, controlStack, functionTable: { '03': Uint8Array.from([35, ...lock]) },
  });

  it('reads Q ‖ A, one item under d_in, and the deployer lock the site checks', () => {
    const bound = Uint8Array.of(1, 2, 3, 4, 5);
    const trace = [state([Uint8Array.of(9), bound, Uint8Array.of(7)])] as never;
    const visit = extractDeployBindingFromTrace(trace, 7);
    expect(visit?.bound).toEqual(bound);
    expect(visit?.deployerLock).toBe(Buffer.from(lock).toString('hex'));
    expect(visit?.lastIp).toBe(site.length - 1);
    expect(extractDeployBindingFromTrace(trace, 8)).toBeUndefined();
  });

  it('skips a site in a branch that does not run, and an OP_INPUTBYTECODE that is no site', () => {
    const skipped = [state([Uint8Array.of(1), Uint8Array.of(7)], [false])] as never;
    expect(readDeployerSiteVisits(skipped)).toEqual([]);
    const plain = [{ ...state([Uint8Array.of(1), Uint8Array.of(7)]), instructions: [{ opcode: 0xca }, { opcode: 0x82 }] }];
    expect(readDeployerSiteVisits(plain as never)).toEqual([]);
  });

  it('decodes Q ‖ A into the sender, the value and both argument lists, and encodes it back', () => {
    const deployer = fakeDeployer({
      inputs: [{ name: 'owner', type: 'bytes20' }, { name: 'x', type: 'int' }, { name: 'y', type: 'int' }] as never,
    });
    const binding = {
      senderCategory: new Uint8Array(32).fill(0xc1), value: 5000n,
      constructorArgs: [-3n], contractArgs: [alicePkh, 300n],
    };
    const bound = encodeDeployBinding(binding, deployer, 1);
    // Q = push(category) ‖ push(v) ‖ push(y); A = push(x) ‖ push(owner).
    expect(Buffer.from(bound).toString('hex'))
      .toBe(`20${'c1'.repeat(32)}028813` + `0183` + `022c01` + `14${Buffer.from(alicePkh).toString('hex')}`);
    expect(decodeDeployBinding(bound, deployer, 1)).toEqual(binding);
    expect(() => decodeDeployBinding(Uint8Array.from([...bound, 0x51]), deployer, 1)).toThrow(/more than create's/);
  });
});

describe('B9.3: the local run', () => {
  const program = (unlockingBytecode: Uint8Array) => {
    const lock = Uint8Array.of(0x51);
    return {
      transaction: {
        version: 2, locktime: 0,
        inputs: [{
          outpointIndex: 0,
          outpointTransactionHash: new Uint8Array(32),
          sequenceNumber: 0xfffffffe,
          unlockingBytecode,
        }],
        outputs: [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1000n }],
      },
      sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: 5000n }],
    };
  };

  it('returns each input\'s operation cost', () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const { transaction, sourceOutputs } = program(new Uint8Array());
    const runs = runDeployerInputsLocal(provider, transaction, sourceOutputs);
    expect(runs).toHaveLength(1);
    expect(runs[0].operationCost).toBeGreaterThan(0n);
  });

  it('throws with the input index and the VM error', () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const { transaction, sourceOutputs } = program(Uint8Array.of(0x00));
    expect(() => runDeployerInputsLocal(provider, transaction, sourceOutputs))
      .toThrow(/Input 0 failed the local run/);
  });
});

describe('B9.10: proof of birth and sweep', () => {
  it('accepts a prep transaction whose output 0 is DEPLOY(C)', async () => {
    const provider = new MockNetworkProvider();
    const deployer = fakeDeployer();
    const lock = Uint8Array.of(0x51);
    const utxo = coin(0xd1, 10_000n);
    await provider.addUtxo(Buffer.from(lock).toString('hex'), utxo);
    const builder = new TransactionBuilder({ provider });
    builder.addInput(utxo, {
      generateLockingBytecode: () => lock,
      generateUnlockingBytecode: () => new Uint8Array(),
    });
    builder.addOutput({ to: hexToBin(deployer.lockingBytecode), amount: 1200n });
    const transaction = await builder.send();
    expect(await verifyBirth(provider, transaction.txid, [deployer])).toBe(true);
    expect(await verifyBirth(provider, transaction.txid, [fakeDeployer({ redeem: Uint8Array.of(0x52) })])).toBe(false);
    expect(await verifyBirth(provider, '00'.repeat(32), [deployer])).toBe(false);
  });

  it('builds a sweep with sequence 1,440, one tokenless output and 1 sat/B', () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const deployer = fakeDeployer();
    const result = buildDeployerSweep({
      coins: [
        { utxo: { ...coin(0xe1, 5000n), lockingBytecode: hexToBin(deployer.lockingBytecode) }, deployer },
        { utxo: { ...coin(0xe2, 5000n), lockingBytecode: hexToBin(deployer.lockingBytecode) }, deployer },
      ],
      toLockingBytecode: Uint8Array.of(0x51),
      provider,
    });
    const decoded = decodeTransaction(hexToBin(result.transactionHex)) as {
      version: number; locktime: number;
      inputs: { sequenceNumber: number; unlockingBytecode: Uint8Array }[];
      outputs: { lockingBytecode: Uint8Array; valueSatoshis: bigint; token?: unknown }[];
    };
    expect(decoded.version).toBe(2);
    expect(decoded.inputs.map((input) => input.sequenceNumber)).toEqual([1440, 1440]);
    expect(decoded.inputs[0].unlockingBytecode.slice(0, 5))
      .toEqual(Uint8Array.from([0x04, 0x74, 0x0b, 0x42, 0x3a]));
    expect(decoded.outputs).toHaveLength(1);
    expect(decoded.outputs[0].token).toBeUndefined();
    const size = BigInt(hexToBin(result.transactionHex).length);
    expect(result.fee).toBe(size);
    expect(decoded.outputs[0].valueSatoshis).toBe(10_000n - result.fee);
  });
});

describe('B9.5/B9.6: callee checks', () => {
  it('names the missing callee option', () => {
    const artifact = {
      contractName: 'C',
      abi: [{ name: 'f', callRecord: true }],
      recordSound: true,
    } as unknown as Artifact;
    expect(() => assertDeployerCallee('C', artifact, 'f')).not.toThrow();
    expect(() => assertDeployerCallee('C', { ...artifact, recordSound: false } as Artifact, 'f'))
      .toThrow(/not record-sound/);
    expect(() => assertDeployerCallee('C', artifact, 'g')).toThrow(/has no function/);
    const voidEntry = {
      contractName: 'C', recordSound: true, abi: [{ name: 'v', outputs: [] }],
    } as unknown as Artifact;
    expect(() => assertDeployerCallee('C', voidEntry, 'v')).toThrow(/callRecords: 'all'/);
  });
});

describe('B9.9: locktime', () => {
  it('uses the tip height for block.number and the median time past minus 1 for block.timestamp', async () => {
    const provider = new MockNetworkProvider();
    expect(await deployerLocktime(fakeDeployer(), provider)).toBeUndefined();
    expect(await deployerLocktime({ ...fakeDeployer(), constructorBlockField: 'number' }, provider))
      .toBe(await provider.getBlockHeight());
    expect(await deployerLocktime({ ...fakeDeployer(), constructorBlockField: 'timestamp' }, provider))
      .toBe((await provider.getMedianTimePast()) - 1);
    expect(await provider.getMedianTimePast()).toBe(provider.getBlockTime());
  });
});

describe('B9.4: the fallback table', () => {
  const artifact = (deployer: DeployerAbi | undefined): Artifact => ({ deployer } as Artifact);
  it('selects the path and refuses a fallback when viaDeployer is explicit', () => {
    const deployer = fakeDeployer();
    const funder = {
      generateLockingBytecode: () => aliceLock(),
      generateUnlockingBytecode: () => new Uint8Array(),
    };
    expect(decideDeployerPath(artifact(deployer), { funder }).path).toBe('deployer');
    expect(decideDeployerPath(artifact(deployer), { funder, viaDeployer: false }).path).toBe('genesis');
    const fallback = decideDeployerPath(artifact(deployer), { funder, salt: Uint8Array.of(1) });
    expect(fallback.path).toBe('genesis');
    expect(fallback.path === 'genesis' && fallback.warning).toMatch(/salt/);
    expect(decideDeployerPath(artifact(deployer), { funder, salt: Uint8Array.of(1), viaDeployer: true }).path)
      .toBe('error');
    expect(decideDeployerPath(artifact(undefined), { funder }).path).toBe('genesis');
    expect(decideDeployerPath(artifact(undefined), { funder, viaDeployer: true }).path).toBe('error');
  });
  it('names the cases A12 lists', () => {
    const deployer = fakeDeployer();
    const funder = {
      generateLockingBytecode: () => aliceLock(),
      generateUnlockingBytecode: () => new Uint8Array(),
    };
    expect(deployerFallbackCase(artifact(deployer), { funder })).toBeUndefined();
    expect(deployerFallbackCase(artifact(deployer), { funder, salt: Uint8Array.of(1) })).toBe('salt');
    expect(deployerFallbackCase(artifact(deployer), { funder, threadCount: 2 })).toBe('thread-count');
    expect(deployerFallbackCase(artifact(deployer), { funder, initialState: { n: 1n } })).toBe('initial-state');
    expect(deployerFallbackCase(artifact(deployer), {
      funder, funderLock: Uint8Array.of(0x51), extraOutputs: [],
    })).toBeUndefined();
    expect(deployerFallbackCase(artifact(deployer), { funder, metadataProbe: true })).toBe('metadata-probe');
    expect(deployerFallbackCase(artifact(undefined), { funder })).toBeUndefined();
  });
});
