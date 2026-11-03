/**
 * Per-contract block-info oracles across the devnet lifecycle.
 *
 * The node task starts the oracle keeper in `prepare`; this file starts the same runtime on an in-process server. A
 * `block.number` reader's genesis mints its own oracle, and the node keeps that oracle's commitment on the block the
 * next transaction is mined into across mine, time travel, snapshot/revert and reset while the reader keeps
 * recording. A reader a factory creates after the node started mints its oracle in the creating transaction, and the
 * node finds and keeps that one too.
 */
import { encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress, secp256k1 } from '@bitauth/libauth';
import { compileString, compileStringSplit } from '@solidcash/solidc';
import { SignatureTemplate } from '@solidcash/solidcash';
import { framedCall, framedDeploy } from '@solidcash/solidcash/framed';
import { blockOracleLockingBytecode, hash160, type FunctionSplitBundle } from '@solidcash/utils';
import { createServer, type ServerHandle } from '@mem-cash/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBlockOracleRuntime, type BlockOracleRuntime } from '../src/block-oracle.js';
import { createHardhatRuntimeEnvironment } from '../src/hre.js';
import { resolveConfig } from '../src/config.js';
import type { HardhatRuntimeEnvironment } from '../src/hre.js';

const ORACLE_USER = `contract OracleUser() {
  uint seen;
  function record() public { this.seen = block.number; require(true); }
  function reset() public { this.seen = 0; require(true); }
}`;

/** A factory that creates a `block.timestamp` reader in its own transaction. */
const CLOCK_FACTORY = `pragma solidity ^0.8.0;
contract Clock {
  uint256 public stamp;
  function touch() external { stamp = block.timestamp; }
}
contract Factory {
  uint256 public made;
  function make(bytes32 salt) external returns (address clock) {
    bytes memory code = type(Clock).creationCode;
    assembly { clock := create2(0, add(code, 32), mload(code), salt) }
    made = made + 1;
  }
}`;

let handle: ServerHandle | undefined;
let oracle: BlockOracleRuntime | undefined;
const runtimes: HardhatRuntimeEnvironment[] = [];

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(handle!.httpUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = (await response.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result as T;
}

interface Commitment {
  readonly number: number;
  readonly timestamp: number;
}

/** The commitment of the oracle `categoryId` owns, read at its lock. */
async function readCommitment(hre: HardhatRuntimeEnvironment, categoryId: string): Promise<Commitment | undefined> {
  const lock = blockOracleLockingBytecode(Uint8Array.from(Buffer.from(categoryId, 'hex')));
  const utxos = await hre.network.provider.getUtxosForLockingBytecode(lock);
  const commitment = utxos.find((utxo) => utxo.token?.nft?.capability === 'mutable')?.token?.nft?.commitment;
  if (commitment === undefined) return undefined;
  const bytes = Buffer.from(commitment, 'hex');
  // Layout: owner pkh (20 bytes), then 5-byte fields (4 LE bytes + a 0x00 terminator for OP_BIN2NUM).
  return {
    number: bytes.readUInt32LE(20),
    timestamp: bytes.readUInt32LE(25),
  };
}

/** The block mined after a tip with no pending timestamp: the oracle's commitment while that tip stands. */
function pendingAfter(tip: { height: number; timestamp: number }): Commitment {
  return { number: tip.height + 1, timestamp: tip.timestamp + 1 };
}

function runtimeFor(port: number): HardhatRuntimeEnvironment {
  const hre = createHardhatRuntimeEnvironment(resolveConfig({
    defaultNetwork: 'localhost',
    networks: { localhost: { type: 'mem-cash', memCash: { port } } },
  }), 'localhost');
  runtimes.push(hre);
  return hre;
}

beforeAll(async () => {
  handle = await createServer({
    port: 0,
    devnet: { accounts: { count: 1 }, height: 20 },
    logging: { level: 'error' },
    prepare: (prepared) => {
      oracle = createBlockOracleRuntime({ indexer: prepared.indexer, enabled: true });
      oracle.install();
      prepared.setBlockOracle(oracle.advertisement());
      oracle.subscribeAdvertisement((advertisement) => prepared.setBlockOracle(advertisement));
      prepared.onTipChange((change) => oracle?.onTipChange(change as never));
      prepared.onSnapshot((id) => oracle?.onSnapshot(id));
      prepared.onDropSnapshot((id) => oracle?.onDropSnapshot(id));
    },
  });
});

afterAll(async () => {
  for (const hre of runtimes.splice(0)) {
    await (hre.network.provider as unknown as { disconnect?: () => Promise<void> }).disconnect?.();
  }
  await handle?.close({ drainMs: 10 });
});

describe('block-info oracle across the devnet lifecycle', () => {
  it('is advertised before listening', async () => {
    const info = await rpc<{ blockOracle: unknown }>('devnet.info');
    expect(info.blockOracle).not.toBeNull();
    const features = await rpc<{ devnet: { block_oracle: unknown } }>('server.features');
    expect(features.devnet.block_oracle).not.toBeNull();
  });

  it('keeps a reader\'s own oracle on the next block across mine, time travel, snapshot/revert and reset', async () => {
    const hre = runtimeFor(handle!.port);
    const [signer] = await hre.ethers.getSigners(1);
    const artifact = compileString(ORACLE_USER, { composition: 'direct' });
    const { categoryId } = await hre.ethers.getContractFactory(artifact, signer).deploy();
    const deployed = await rpc<{ height: number; timestamp: number }>('devnet.info');
    expect(await readCommitment(hre, categoryId)).toEqual(pendingAfter(deployed));

    await rpc('devnet.mine', [2]);
    const mined = await rpc<{ height: number; timestamp: number }>('devnet.info');
    expect(await readCommitment(hre, categoryId)).toEqual(pendingAfter(mined));

    const snapshot = await rpc<{ id: string }>('devnet.snapshot');
    await rpc('devnet.increaseTime', [3600]);
    const moved = await rpc<{ medianTimePast: number; timestamp: number }>('devnet.info');
    const afterTime = await readCommitment(hre, categoryId);
    expect(afterTime!.timestamp).toBe(moved.timestamp + 1);
    expect(afterTime!.timestamp).toBeGreaterThan(mined.timestamp + 3000);

    expect(await rpc('devnet.revert', [snapshot.id])).toBe(true);
    expect(await readCommitment(hre, categoryId)).toEqual(pendingAfter(mined));

    // The reset baseline predates the reader, so its oracle is gone with it.
    await rpc('devnet.reset');
    expect(await readCommitment(hre, categoryId)).toBeUndefined();
  }, 120_000);

  it('deploys a block.number reader, records the next block, and keeps recording across rewind and reset', async () => {
    const hre = runtimeFor(handle!.port);
    const [signer] = await hre.ethers.getSigners(1);
    const artifact = compileString(ORACLE_USER, { composition: 'direct' });
    const contract = await hre.ethers.getContractFactory(artifact, signer).deploy();
    const oracleNumber = async (categoryId = contract.categoryId): Promise<number | undefined> =>
      (await readCommitment(hre, categoryId))?.number;

    const tipBefore = await rpc<{ height: number }>('devnet.info');
    expect(await oracleNumber()).toBe(tipBefore.height + 1);

    // A stateful record co-spends the reader's oracle and recreates it unchanged.
    await contract.call.record().send();
    // The record's own block advanced the tip, and the oracle was refreshed inside that tip-change slot.
    expect(await oracleNumber()).toBe((await rpc<{ height: number }>('devnet.info')).height + 1);

    // A block mined from another process advances the commitment; the next record still works.
    await rpc('devnet.mine', [1]);
    const tipAfter = await rpc<{ height: number }>('devnet.info');
    expect(await oracleNumber()).toBe(tipAfter.height + 1);
    await contract.call.record().send();

    // Time travel, then rewind: the reader survives both and sees the restored tip.
    const snapshot = await rpc<{ id: string }>('devnet.snapshot');
    await rpc('devnet.increaseTime', [86400]);
    await contract.call.record().send();
    expect(await rpc('devnet.revert', [snapshot.id])).toBe(true);
    await rpc('devnet.mine', [1]);
    const afterRevert = await rpc<{ height: number }>('devnet.info');
    await contract.call.record().send();
    expect(await oracleNumber()).toBe(afterRevert.height + 2);

    // Reset restores the post-prepare baseline, which predates this deployment and its oracle, so the reader is
    // deployed again against the restored chain and its new oracle records the next block.
    await rpc('devnet.reset');
    expect(await oracleNumber()).toBeUndefined();
    const redeployed = await hre.ethers.getContractFactory(artifact, signer).deploy();
    await redeployed.call.record().send();
    expect(await oracleNumber(redeployed.categoryId)).toBe((await rpc<{ height: number }>('devnet.info')).height + 1);
  }, 240_000);

  it('finds and keeps the oracle of a reader a factory creates after the node started', async () => {
    const hre = runtimeFor(handle!.port);
    const provider = hre.network.provider as unknown as Parameters<typeof framedCall.callFramedEntry>[0]['provider'] & {
      connect(): Promise<void>;
      addUtxo(lockingBytecode: string, utxo: { txid?: string; vout: number; satoshis: bigint }): Promise<{
        txid: string; vout: number; satoshis: bigint;
      }>;
    };
    await provider.connect();
    const framed = { composition: 'framed', evmCompat: true, suppressWarnings: true, split: 'func' } as const;
    const clock = compileStringSplit(CLOCK_FACTORY, { ...framed, primaryContractName: 'Clock' }) as FunctionSplitBundle;
    const factory = compileStringSplit(CLOCK_FACTORY, { ...framed, primaryContractName: 'Factory' }) as FunctionSplitBundle;

    // A caller of our own, funded with genesis-eligible coins the node injects at its P2PKH.
    const key = Uint8Array.from({ length: 32 }, (_byte, index) => (index === 31 ? 0x07 : 0x5e));
    const publicKey = secp256k1.derivePublicKeyCompressed(key);
    if (typeof publicKey === 'string') throw new Error(publicKey);
    const lock = encodeLockingBytecodeP2pkh(hash160(publicKey));
    const funder = new SignatureTemplate(key).unlockP2PKH();
    const encoded = lockingBytecodeToCashAddress({ bytecode: lock, prefix: 'bchreg' });
    if (typeof encoded === 'string') throw new Error(encoded);
    let coins = 0;
    const coin = (satoshis: bigint): Promise<{ txid: string; vout: number; satoshis: bigint }> => {
      coins += 1;
      return provider.addUtxo(Buffer.from(lock).toString('hex'), {
        txid: `c1${(0x1000 + coins).toString(16)}`.padEnd(64, '7'), vout: 0, satoshis,
      });
    };

    // The factory names the clock's constants, from the public SDK.
    const constants = framedDeploy.framedChildConstants({
      artifact: clock.logical, split: clock, provider, pool: { masters: 1, validators: 1 },
    });
    const { categoryId: factoryCategory } = await framedDeploy.deployFramedStatefulContract(factory.logical, [], {
      provider, fundingUtxo: await coin(3_000_000n), funder, changeAddress: encoded.address,
      threadCount: 1, validatorCount: 1, functionSplit: factory,
      childLocks: constants.childLocks, childCollections: constants.childCollections,
      childOutputCount: constants.childOutputCount,
    });
    const caller = await coin(5_000_000n);
    const creation = await framedCall.callFramedEntry({
      provider, artifact: factory.logical, categoryId: factoryCategory, functionName: 'make',
      args: [new Uint8Array(32)], callerUtxo: caller, callerLockingBytecode: lock, funder,
      split: framedDeploy.functionSplitFor(provider, factoryCategory) ?? factory,
      creates: { artifact: clock.logical, split: clock, pool: constants.childPool },
    });
    const refused = creation.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
    expect(creation.accepted, refused).toBe(true);

    // The clock's category is the caller's coin. Its oracle was minted by the creating transaction, after the node
    // started, and the node keeps it on the block the next transaction is mined into.
    const clockCategory = caller.txid;
    const created = await rpc<{ height: number; timestamp: number }>('devnet.info');
    expect(await readCommitment(hre, clockCategory)).toEqual(pendingAfter(created));
    await rpc('devnet.mine', [2]);
    const mined = await rpc<{ height: number; timestamp: number }>('devnet.info');
    const kept = await readCommitment(hre, clockCategory);
    expect(kept).toEqual(pendingAfter(mined));

    // A later call on the clock reads the time its own oracle holds.
    const touched = await framedCall.callFramedEntry({
      provider, artifact: clock.logical, categoryId: clockCategory, functionName: 'touch',
      callerUtxo: await coin(1_000_000n), callerLockingBytecode: lock, funder, split: clock,
    });
    expect(touched.accepted, touched.verdicts.map((verdict) => verdict.objection ?? '').join('; ')).toBe(true);
    const { byNft } = await framedDeploy.readFramedState(provider, clockCategory, clock.logical.stateLayout!);
    expect((Object.assign({}, ...byNft) as Record<string, unknown>).stamp).toBe(BigInt(kept!.timestamp));
  }, 240_000);

  it('fails a block-reading contract fast when the oracle is disabled', async () => {
    const plain = await createServer({
      port: 0,
      devnet: { accounts: { count: 1 }, height: 12 },
      logging: { level: 'error' },
    });
    try {
      const hre = createHardhatRuntimeEnvironment(resolveConfig({
        defaultNetwork: 'localhost',
        networks: { localhost: { type: 'mem-cash', memCash: { port: plain.port } } },
      }), 'localhost');
      runtimes.push(hre);
      const [signer] = await hre.ethers.getSigners(1);
      const artifact = compileString(ORACLE_USER, { composition: 'direct' });
      const attempt = (async () => {
        const contract = await hre.ethers.getContractFactory(artifact, signer).deploy();
        await contract.call.record().send();
      })();
      await expect(attempt).rejects.toThrow(/block oracle|provides none/i);
    } finally {
      await plain.close({ drainMs: 10 });
    }
  }, 120_000);
});
