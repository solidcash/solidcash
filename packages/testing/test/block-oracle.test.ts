/**
 * The block-info oracle across the devnet lifecycle.
 *
 * The node task installs the oracle in `prepare`; this file installs the same runtime on an in-process server, then
 * checks the advertised commitment holds the block after the tip across mine, time travel, snapshot/revert and reset,
 * and that a `block.number` reader contract deploys, records, and keeps recording after each of those.
 */
import { compileString } from '@solidcash/solidc';
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

async function readCommitment(): Promise<Commitment | undefined> {
  const features = await rpc<{ devnet: { block_oracle: { outpoint: { txid: string; vout: number } } | null } }>(
    'server.features',
  );
  const advertised = features.devnet.block_oracle;
  if (advertised === null) return undefined;
  const utxo = await rpc<{ token?: { nft?: { commitment: string } } } | null>('devnet.utxo', [
    advertised.outpoint.txid,
    advertised.outpoint.vout,
  ]);
  const commitment = utxo?.token?.nft?.commitment;
  if (commitment === undefined) return undefined;
  const bytes = Buffer.from(commitment, 'hex');
  // Layout: owner pkh (20 bytes), then 5-byte fields (4 LE bytes + a 0x00 terminator for OP_BIN2NUM).
  return {
    number: bytes.readUInt32LE(20),
    timestamp: bytes.readUInt32LE(25),
  };
}

/** The block mined after a tip with no pending timestamp: the oracle's commitment while that tip stands. */
function pendingAfter(tip: { height: number; timestamp: number }): { number: number; timestamp: number } {
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
  it('is advertised before listening with the block the next transaction is mined into', async () => {
    const info = await rpc<{ height: number; timestamp: number; blockOracle: unknown }>('devnet.info');
    expect(info.blockOracle).not.toBeNull();
    const commitment = await readCommitment();
    expect(commitment).toEqual(pendingAfter(info));
  });

  it('tracks mine, time travel, snapshot/revert and reset from another process', async () => {
    const before = await readCommitment();
    await rpc('devnet.mine', [2]);
    const mined = await rpc<{ height: number; timestamp: number }>('devnet.info');
    expect(await readCommitment()).toEqual(pendingAfter(mined));

    // A pending timestamp is the next block's, so a transaction sent now reads the time its receipt block carries.
    const at = mined.timestamp + 600;
    await rpc('devnet.setNextBlockTimestamp', [at]);
    expect(await readCommitment()).toEqual({ number: mined.height + 1, timestamp: at });
    await rpc('devnet.mine', [1]);
    const stamped = await rpc<{ height: number; timestamp: number }>('devnet.info');
    expect(stamped.timestamp).toBe(at);
    expect(await readCommitment()).toEqual(pendingAfter(stamped));

    const snapshot = await rpc<{ id: string }>('devnet.snapshot');
    await rpc('devnet.increaseTime', [3600]);
    const moved = await rpc<{ medianTimePast: number; timestamp: number }>('devnet.info');
    const afterTime = await readCommitment();
    expect(afterTime!.timestamp).toBe(moved.timestamp + 1);
    expect(afterTime!.timestamp).toBeGreaterThan(stamped.timestamp + 3000);

    expect(await rpc('devnet.revert', [snapshot.id])).toBe(true);
    expect(await readCommitment()).toEqual(pendingAfter(stamped));

    await rpc('devnet.reset');
    expect(await readCommitment()).toEqual(before);
  }, 60_000);

  it('deploys a block.number reader, records the live tip, and keeps recording across rewind and reset', async () => {
    const hre = runtimeFor(handle!.port);
    const [signer] = await hre.ethers.getSigners(1);
    const artifact = compileString(ORACLE_USER, { composition: 'direct' });
    const contract = await hre.ethers.getContractFactory(artifact, signer).deploy();

    const tipBefore = await rpc<{ height: number }>('devnet.info');
    const commitmentBefore = await readCommitment();
    expect(commitmentBefore?.number).toBe(tipBefore.height + 1);

    // A stateful record co-spends the oracle UTXO and recreates it from the live commitment.
    await contract.call.record().send();
    // The record's own block advanced the tip, and the oracle was refreshed inside that tip-change slot.
    expect((await readCommitment())?.number).toBe((await rpc<{ height: number }>('devnet.info')).height + 1);

    // A block mined from another process advances the commitment; the next record still works.
    await rpc('devnet.mine', [1]);
    const tipAfter = await rpc<{ height: number }>('devnet.info');
    expect((await readCommitment())?.number).toBe(tipAfter.height + 1);
    await contract.call.record().send();

    // Time travel, then rewind: the reader survives both and sees the restored tip.
    const snapshot = await rpc<{ id: string }>('devnet.snapshot');
    await rpc('devnet.increaseTime', [86400]);
    await contract.call.record().send();
    expect(await rpc('devnet.revert', [snapshot.id])).toBe(true);
    await rpc('devnet.mine', [1]);
    const afterRevert = await rpc<{ height: number }>('devnet.info');
    await contract.call.record().send();
    expect((await readCommitment())?.number).toBe(afterRevert.height + 2);

    // Reset restores the post-prepare baseline, which contains the oracle but predates this deployment, so the
    // reader is deployed again against the restored chain and records the baseline tip.
    await rpc('devnet.reset');
    expect((await readCommitment())?.number).toBe(21);
    const redeployed = await hre.ethers.getContractFactory(artifact, signer).deploy();
    await redeployed.call.record().send();
    expect((await readCommitment())?.number).toBe((await rpc<{ height: number }>('devnet.info')).height + 1);
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
