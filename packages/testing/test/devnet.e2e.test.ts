/**
 * Cross-process acceptance for `solidhat node`: a real child process serves the devnet, a second child runs
 * `solidhat run scripts/deploy.ts --network localhost`, and this test process reads the result over the wire.
 *
 * Every child is spawned (never `exec`), recorded, and killed in `finally`. The node is asked for `--port 0` and the
 * resolved port is parsed from the `listening` line, so no fixed port is assumed.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ElectrumClient } from '@electrum-cash/network';
import { ElectrumWebSocket } from '@electrum-cash/web-socket';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ORACLE_USER = `contract OracleUser() {
  uint seen;
  function record() public { this.seen = block.number; require(true); }
  function reset() public { this.seen = 0; require(true); }
}`;

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const cli = path.join(repoRoot, 'packages/solidhat/dist/cli.js');
const fixture = path.join(here, 'fixtures/devnet');

interface NodeHandle {
  readonly child: ChildProcessWithoutNullStreams;
  readonly port: number;
  readonly genesisHash: string;
  readonly chainId: string;
  readonly httpUrl: string;
  readonly wsUrl: string;
  readonly evmRpc: boolean;
  readonly blockOracle: { lock: string; category: string; outpoint: { txid: string; vout: number } } | null;
  readonly accounts: { index: number; address: string; path: string; wif?: string }[];
  readonly lines: string[];
  exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

const children = new Set<ChildProcessWithoutNullStreams>();

function spawnCli(args: string[], cwd: string): ChildProcessWithoutNullStreams {
  const child = spawn(process.execPath, [cli, ...args], {
    cwd,
    env: { ...process.env, SOLIDHAT_LEGACY_NODE: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch { /* already gone */ }
      reject(new Error(`child ${child.pid} did not exit within ${timeoutMs}ms`));
    }, timeoutMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

/** Spawn `solidhat node --port 0 --json` and resolve once the `listening` event names the port. */
async function startNode(extraArgs: string[] = [], cwd = fixture): Promise<NodeHandle> {
  const child = spawnCli(['node', '--port', '0', '--json', '--no-keys', ...extraArgs], cwd);
  const lines: string[] = [];
  const accounts: NodeHandle['accounts'] = [];
  let listening: Record<string, unknown> | undefined;
  let readySeen = false;
  let stderr = '';

  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`node did not report listening; stderr: ${stderr}`)), 90_000);
    const onLine = (line: string): void => {
      if (line.trim().length === 0) return;
      lines.push(line);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return;
      }
      if (parsed.event === 'listening') listening = parsed;
      if (parsed.event === 'account') {
        accounts.push(parsed as unknown as NodeHandle['accounts'][number]);
      }
      if (parsed.event === 'ready') readySeen = true;
      if (listening !== undefined && readySeen) {
        clearTimeout(timer);
        resolve();
      }
    };
    let buffer = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) onLine(line);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.once('exit', (code) => {
      if (listening === undefined) {
        clearTimeout(timer);
        reject(new Error(`node exited (${code}) before listening; stderr: ${stderr}`));
      }
    });
  });

  const info = listening as Record<string, unknown>;
  return {
    child,
    port: Number(info.port),
    genesisHash: String(info.genesisHash),
    chainId: String(info.chainId),
    httpUrl: String(info.httpUrl),
    wsUrl: String(info.wsUrl),
    evmRpc: info.evmRpc === true,
    blockOracle: (info.blockOracle ?? null) as NodeHandle['blockOracle'],
    accounts,
    lines,
    exit,
  };
}

async function stopNode(node: NodeHandle): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  if (node.child.exitCode !== null) return { code: node.child.exitCode, signal: null };
  node.child.kill('SIGTERM');
  return waitForExit(node.child, 15_000);
}

interface Rpc {
  readonly result?: unknown;
  readonly error?: { code: number; message: string };
}

async function rpc(node: NodeHandle, method: string, params: unknown[] = []): Promise<Rpc> {
  const response = await fetch(node.httpUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return (await response.json()) as Rpc;
}

async function call<T>(node: NodeHandle, method: string, params: unknown[] = []): Promise<T> {
  const response = await rpc(node, method, params);
  if (response.error) throw new Error(`${method}: ${response.error.message}`);
  return response.result as T;
}

/** A raw `@electrum-cash/network` client, constructed the way the acceptance checklist spells it. */
async function rawClient(node: NodeHandle): Promise<ElectrumClient> {
  const socket = new ElectrumWebSocket('127.0.0.1', { port: node.port, encrypted: false });
  const client = new ElectrumClient('app', '1.5.0', socket);
  await client.connect();
  return client;
}

function doubleSha256Reversed(bytes: Uint8Array): string {
  const first = createHash('sha256').update(bytes).digest();
  return createHash('sha256').update(first).digest().reverse().toString('hex');
}

function writeProject(dir: string, port: number): void {
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(fixture, 'scripts/deploy.ts'), path.join(dir, 'scripts/deploy.ts'));
  fs.writeFileSync(
    path.join(dir, 'solidcash.config.ts'),
    [
      "import { defineConfig } from '@solidcash/solidhat/config';",
      'export default defineConfig({',
      '  networks: {',
      `    localhost: { type: 'mem-cash', network: 'mocknet', memCash: { port: ${port} } },`,
      '  },',
      '});',
      '',
    ].join('\n'),
  );
}

function makeProjectDir(): string {
  return fs.mkdtempSync(path.join(here, 'fixtures/devnet/project-'));
}

describe('solidhat node end to end', () => {
  let node: NodeHandle;
  let projectDir: string;

  beforeAll(async () => {
    node = await startNode();
    projectDir = makeProjectDir();
    writeProject(projectDir, node.port);
  }, 120_000);

  afterAll(async () => {
    await stopNode(node);
    if (projectDir !== undefined) fs.rmSync(projectDir, { recursive: true, force: true });
    for (const child of children) {
      try {
        child.kill('SIGKILL');
      } catch { /* already gone */ }
    }
  }, 60_000);

  it('reports a listening event with chain identity and no keys', () => {
    expect(node.port).toBeGreaterThan(0);
    expect(node.httpUrl).toBe(`http://127.0.0.1:${node.port}`);
    expect(node.wsUrl).toBe(`ws://127.0.0.1:${node.port}`);
    expect(node.chainId).toBe('mem-cash-devnet');
    expect(node.genesisHash).toMatch(/^[0-9a-f]{64}$/);
    expect(node.evmRpc).toBe(false);
    expect(node.blockOracle).not.toBeNull();
    const listeningLine = node.lines.find((line) => line.includes('"event":"listening"'));
    expect(listeningLine).toBeDefined();
    expect(listeningLine).not.toContain('wif');
    expect(listeningLine).not.toContain('Mnemonic');
    expect(node.accounts).toHaveLength(20);
    for (const account of node.accounts) expect(account.wif).toBeUndefined();
  });

  it('serves 20 accounts at the HRE branch, a chain identity, and auto mining', async () => {
    const accounts = await call<{ index: number; address: string; path: string; balance: string; utxos: number }[]>(
      node,
      'devnet.accounts',
      [0, 20],
    );
    expect(accounts).toHaveLength(20);
    accounts.forEach((account, index) => {
      expect(account.index).toBe(index);
      expect(account.path).toBe(`m/44'/60'/0'/0/${index}`);
      expect(account.address.startsWith('bchtest:')).toBe(true);
      expect(account.utxos).toBe(128);
      expect(BigInt(account.balance)).toBe(1_000_000_000_000n);
    });

    const info = await call<{
      height: number;
      mining: { mode: string };
      genesisHash: string;
      blockHash: string;
      medianTimePast: number;
    }>(node, 'devnet.info');
    expect(info.height).toBe(200);
    expect(info.mining.mode).toBe('auto');
    expect(info.genesisHash).toBe(node.genesisHash);

    const headers = await call<{ count: number; hex: string; max: number }>(
      node,
      'blockchain.block.headers',
      [0, 201],
    );
    expect(headers.count).toBe(201);
    expect(headers.hex).toHaveLength(201 * 160);
    const chunks = headers.hex.match(/.{160}/g) ?? [];
    expect(chunks).toHaveLength(201);
    expect(doubleSha256Reversed(Buffer.from(chunks[200] as string, 'hex'))).toBe(info.blockHash);
  });

  it('negotiates 1.5 with a raw Electrum client and verifies an SPV proof independently', async () => {
    const client = await rawClient(node);
    try {
      const version = await client.request('server.version', 'app', '1.5.0');
      expect(version).toEqual(['mem-cash-server 0.0.11', '1.5']);
      const features = await client.request('server.features') as {
        genesis_hash: string;
        devnet?: Record<string, unknown>;
      };
      expect(features.genesis_hash).toBe(node.genesisHash);
      expect(features.devnet).toBeDefined();
      expect(features.devnet).not.toHaveProperty('evm_rpc');

      const tip = await client.request('blockchain.headers.get_tip') as { height: number; hex: string };
      expect(tip.height).toBe(200);

      const position = await client.request('blockchain.transaction.id_from_pos', 1, 0, true) as {
        tx_hash: string;
        merkle: string[];
      };
      const proof = await client.request('blockchain.transaction.get_merkle', position.tx_hash, 1) as {
        block_height: number;
        pos: number;
        merkle: string[];
      };
      const headerHex = await client.request('blockchain.block.header', 1) as string;
      const headerBytes = Buffer.from(headerHex, 'hex');
      let current = Buffer.from(position.tx_hash, 'hex').reverse();
      let index = proof.pos;
      for (const siblingHex of proof.merkle) {
        const sibling = Buffer.from(siblingHex, 'hex').reverse();
        const pair = index % 2 === 0
          ? Buffer.concat([current, sibling])
          : Buffer.concat([sibling, current]);
        const first = createHash('sha256').update(pair).digest();
        current = createHash('sha256').update(first).digest();
        index = Math.floor(index / 2);
      }
      const root = Buffer.from(headerBytes.subarray(36, 68)).reverse().toString('hex');
      expect(current.reverse().toString('hex')).toBe(root);
      expect(doubleSha256Reversed(headerBytes)).toMatch(/^[0-9a-f]{64}$/);

      const raw = await client.request('blockchain.transaction.get', position.tx_hash) as string;
      expect(raw.length).toBeGreaterThan(0);
    } finally {
      await client.disconnect(false, false);
    }
  }, 60_000);

  it('notifies two concurrent clients of a block mined over HTTP', async () => {
    const first = await rawClient(node);
    const second = await rawClient(node);
    try {
      const notifications: { client: string; height: number }[] = [];
      const record = (client: string) => (payload: { method?: string; params?: unknown[] }) => {
        if (payload.method !== 'blockchain.headers.subscribe') return;
        const header = payload.params?.[0] as { height?: number } | undefined;
        if (header?.height !== undefined) notifications.push({ client, height: header.height });
      };
      first.on('notification', record('first'));
      second.on('notification', record('second'));
      await first.subscribe('blockchain.headers.subscribe');
      await second.subscribe('blockchain.headers.subscribe');
      const before = await call<{ height: number }>(node, 'devnet.mine', [1]);
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(notifications.some((entry) => entry.client === 'first' && entry.height === before.height)).toBe(true);
      expect(notifications.some((entry) => entry.client === 'second' && entry.height === before.height)).toBe(true);
      const tipA = await first.request('blockchain.headers.get_tip') as { height: number };
      const tipB = await second.request('blockchain.headers.get_tip') as { height: number };
      expect(tipA.height).toBe(before.height);
      expect(tipB.height).toBe(before.height);
    } finally {
      await first.disconnect(false, false);
      await second.disconnect(false, false);
    }
  }, 60_000);

  it('runs a deploy script in a second process that exits by itself, and a third process reads its UTXOs', async () => {
    const { deriveLogicalCreateAddress } = await import(
      '@solidcash/solidcash/dist/stateful/logical-identity.js'
    );
    const accounts = await call<{ address: string }[]>(node, 'devnet.accounts', [0, 1]);
    const deployer = accounts[0]!.address;

    const runOnce = async (): Promise<{ nonce: number; predicted: string; address: string; stdout: string }> => {
      const child = spawnCli(['run', 'scripts/deploy.ts', '--network', 'localhost', '--no-compile'], projectDir);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      const exit = await waitForExit(child, 120_000);
      expect(stderr).not.toMatch(/DEPLOY ERROR/);
      expect(exit).toEqual({ code: 0, signal: null });
      const nonce = Number(/NONCE (\d+)/.exec(stdout)?.[1]);
      const predicted = /PREDICTED (\S+)/.exec(stdout)?.[1] as string;
      const address = /DEPLOYED (\S+)/.exec(stdout)?.[1] as string;
      expect(Number.isInteger(nonce)).toBe(true);
      expect(predicted).toBeDefined();
      expect(address).toBeDefined();
      return { nonce, predicted, address, stdout };
    };

    // First process: CREATE nonce 0, and its own getNonce()+getCreateAddress prediction is exactly where it lands.
    const first = await runOnce();
    expect(first.nonce).toBe(0);
    expect(first.address).toBe(deriveLogicalCreateAddress(deployer, 0));
    expect(first.predicted).toBe(first.address);

    // Third process: a raw Electrum client reading the deployed contract's scripthash.
    const client = await rawClient(node);
    try {
      const scripthash = (await (async () => {
        const { addressToLockScript } = await import('@solidcash/solidcash/dist/utils.js');
        const { sha256 } = await import('@bitauth/libauth/build/lib/crypto/default-crypto-instances.js');
        const { binToHex } = await import('@bitauth/libauth/build/lib/format/hex.js');
        return binToHex(sha256.hash(addressToLockScript(first.address)));
      })());
      const utxos = await client.request('blockchain.scripthash.listunspent', scripthash, 'include_tokens') as unknown[];
      expect(utxos.length).toBeGreaterThan(0);
      const balance = await client.request('blockchain.scripthash.get_balance', scripthash) as { confirmed: number };
      expect(balance.confirmed).toBeGreaterThan(0);
    } finally {
      await client.disconnect(false, false);
    }

    // A second separate process seeds from the chain and deploys at CREATE nonce 1.
    const snapshotBeforeSecond = await call<{ id: string; height: number }>(node, 'devnet.snapshot');
    const second = await runOnce();
    expect(second.nonce).toBe(1);
    expect(second.address).toBe(deriveLogicalCreateAddress(deployer, 1));
    expect(second.predicted).toBe(second.address);
    expect(second.address).not.toBe(first.address);

    // The first contract still resolves while the second exists.
    const clientAgain = await rawClient(node);
    try {
      const { addressToLockScript } = await import('@solidcash/solidcash/dist/utils.js');
      const { sha256 } = await import('@bitauth/libauth/build/lib/crypto/default-crypto-instances.js');
      const { binToHex } = await import('@bitauth/libauth/build/lib/format/hex.js');
      const firstScriptHash = binToHex(sha256.hash(addressToLockScript(first.address)));
      const utxos = await clientAgain.request(
        'blockchain.scripthash.listunspent',
        firstScriptHash,
        'include_tokens',
      ) as unknown[];
      expect(utxos.length).toBeGreaterThan(0);
    } finally {
      await clientAgain.disconnect(false, false);
    }

    // Process B's deployment is reverted; a fresh process (A) redeploys into the freed nonce 1 slot.
    expect(await call(node, 'devnet.revert', [snapshotBeforeSecond.id])).toBe(true);
    const afterRevert = await runOnce();
    expect(afterRevert.nonce).toBe(1);
    expect(afterRevert.address).toBe(second.address);
    const clientFinal = await rawClient(node);
    try {
      const { addressToLockScript } = await import('@solidcash/solidcash/dist/utils.js');
      const { sha256 } = await import('@bitauth/libauth/build/lib/crypto/default-crypto-instances.js');
      const { binToHex } = await import('@bitauth/libauth/build/lib/format/hex.js');
      const scriptHash = binToHex(sha256.hash(addressToLockScript(afterRevert.address)));
      const utxos = await clientFinal.request('blockchain.scripthash.listunspent', scriptHash, 'include_tokens') as unknown[];
      expect(utxos.length).toBeGreaterThan(0);
    } finally {
      await clientFinal.disconnect(false, false);
    }
  }, 360_000);

  it('drives the chain through devnet.* and restores state with snapshot/revert', async () => {
    const before = await call<{ height: number; medianTimePast: number }>(node, 'devnet.info');
    const snapshot = await call<{ id: string; height: number }>(node, 'devnet.snapshot');

    const injected = await call<{ txid: string }>(node, 'devnet.injectUtxo', [
      '76a914' + '22'.repeat(20) + '88ac',
      { txid: 'dd'.repeat(32), vout: 0, satoshis: '42000' },
    ]);
    expect(injected.txid).toBe('dd'.repeat(32));
    expect(await call<{ satoshis: string } | null>(node, 'devnet.utxo', [injected.txid, 0])).not.toBeNull();

    const mined = await call<{ height: number }>(node, 'devnet.mine', [3]);
    expect(mined.height).toBe(before.height + 3);

    const moved = await call<{ medianTimePast: number }>(node, 'devnet.increaseTime', [86_400]);
    expect(moved.medianTimePast - before.medianTimePast).toBeGreaterThanOrEqual(86_390);

    const verified = await call<{ ok: boolean }>(node, 'devnet.verifyHeaders');
    expect(verified.ok).toBe(true);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(await call(node, 'devnet.revert', [snapshot.id])).toBe(true);
      expect(await call(node, 'devnet.utxo', [injected.txid, 0])).toBeNull();
      const restored = await call<{ height: number }>(node, 'devnet.info');
      expect(restored.height).toBe(snapshot.height);
    }

    const reset = await call<{ height: number }>(node, 'devnet.reset');
    expect(reset.height).toBe(200);
    expect((await call<{ ok: boolean }>(node, 'devnet.verifyHeaders')).ok).toBe(true);
  }, 60_000);

  it('deploys and reads a block.number contract against the spawned node across mine, time, revert and reset', async () => {
    const { createHardhatRuntimeEnvironment } = await import('../src/hre.js');
    const { resolveConfig } = await import('../src/config.js');
    const { compileString } = await import('@solidcash/solidc');

    const hre = createHardhatRuntimeEnvironment(resolveConfig({
      defaultNetwork: 'localhost',
      networks: { localhost: { type: 'mem-cash', memCash: { port: node.port } } },
    }), 'localhost');
    const provider = hre.network.provider as unknown as {
      mine(count?: number): Promise<void>;
      disconnect(): Promise<void>;
    };

    const readOracle = async (): Promise<{ number: number; timestamp: number } | undefined> => {
      const features = await call<{ devnet: { block_oracle: { outpoint: { txid: string; vout: number } } | null } }>(
        node,
        'server.features',
      );
      const advertised = features.devnet.block_oracle;
      if (advertised === null) return undefined;
      const utxo = await call<{ token?: { nft?: { commitment: string } } } | null>(
        node,
        'devnet.utxo',
        [advertised.outpoint.txid, advertised.outpoint.vout],
      );
      const commitment = utxo?.token?.nft?.commitment;
      if (commitment === undefined) return undefined;
      const bytes = Buffer.from(commitment, 'hex');
      // owner pkh (20), then 5-byte fields: 4 LE bytes + a 0x00 terminator.
      return { number: bytes.readUInt32LE(20), timestamp: bytes.readUInt32LE(25) };
    };

    try {
      const [signer] = await hre.ethers.getSigners(1);
      const artifact = compileString(ORACLE_USER, { composition: 'direct' });
      const contract = await hre.ethers.getContractFactory(artifact, signer).deploy();

      const connected = await call<{ height: number }>(node, 'devnet.info');
      expect((await readOracle())?.number).toBe(connected.height);
      await contract.call.record().send();
      expect((await readOracle())?.number).toBe((await call<{ height: number }>(node, 'devnet.info')).height);

      // A block mined from another process advances the oracle; the reader still records.
      await call(node, 'devnet.mine', [1]);
      const afterMine = await call<{ height: number }>(node, 'devnet.info');
      expect((await readOracle())?.number).toBe(afterMine.height);
      await contract.call.record().send();

      // Time travel from another process moves the committed timestamp.
      await call(node, 'devnet.increaseTime', [3600]);
      const afterTime = await call<{ timestamp: number }>(node, 'devnet.info');
      expect((await readOracle())?.timestamp).toBe(afterTime.timestamp);
      await contract.call.record().send();

      // Snapshot -> time travel -> record -> revert -> record keeps working.
      const snapshot = await call<{ id: string }>(node, 'devnet.snapshot');
      await call(node, 'devnet.increaseTime', [86_400]);
      await contract.call.record().send();
      expect(await call(node, 'devnet.revert', [snapshot.id])).toBe(true);
      await provider.mine(1);
      await contract.call.record().send();
      expect((await readOracle())?.number).toBe((await call<{ height: number }>(node, 'devnet.info')).height);

      // Reset restores the post-prepare baseline (oracle included); the reader is deployed again and reads it.
      await call(node, 'devnet.reset');
      await provider.mine(1);
      const baselineHeight = (await call<{ height: number }>(node, 'devnet.info')).height;
      expect((await readOracle())?.number).toBe(baselineHeight);
      const redeployed = await hre.ethers.getContractFactory(artifact, signer).deploy();
      await redeployed.call.record().send();
      expect((await readOracle())?.number).toBe((await call<{ height: number }>(node, 'devnet.info')).height);
    } finally {
      await provider.disconnect();
    }
  }, 300_000);

  it('gates the EVM namespace in both directions and keeps provider.send() off the wire', async () => {
    const neutral = 'EVM method not supported by this devnet. BCH-native methods and an optional chain-control ' +
      'compatibility set are served; EVM execution is not emulated. Install the EVM compatibility extension to ' +
      'serve the chain-control set.';
    for (const method of ['evm_mine', 'eth_blockNumber', 'eth_call', 'web3_clientVersion', 'net_version']) {
      const response = await rpc(node, method);
      expect(response.error).toEqual({ code: -32601, message: neutral });
    }
    expect((await rpc(node, 'devnet.nope')).error).toEqual({ code: -32601, message: 'Unknown method: devnet.nope' });
    const features = await call<{ devnet: Record<string, unknown> }>(node, 'server.features');
    expect(features.devnet).not.toHaveProperty('evm_rpc');

    // The provider translates `evm_mine` locally: no EVM name reaches the wire.
    const { default: MemCashNetworkProvider } = await import(
      '@solidcash/solidcash/dist/network/MemCashNetworkProvider.js'
    );
    const provider = new MemCashNetworkProvider(undefined, {
      hostname: '127.0.0.1',
      port: node.port,
      encrypted: false,
      mnemonic: 'test test test test test test test test test test test junk',
    });
    try {
      const beforeStats = await call<{ requests: { byMethod: Record<string, number> } }>(node, 'devnet.stats');
      const evmBefore = Object.fromEntries(
        Object.entries(beforeStats.requests.byMethod)
          .filter(([name]) => /^(eth_|evm_|hardhat_|web3_|net_)/.test(name)),
      );
      const heightBefore = (await call<{ height: number }>(node, 'devnet.info')).height;
      expect(await provider.send('evm_mine')).toBe('0x0');
      const heightAfter = (await call<{ height: number }>(node, 'devnet.info')).height;
      expect(heightAfter).toBe(heightBefore + 1);
      expect(provider.evmRpc).toBe(false);
      const stats = await call<{ requests: { byMethod: Record<string, number> } }>(node, 'devnet.stats');
      const evmAfter = Object.fromEntries(
        Object.entries(stats.requests.byMethod)
          .filter(([name]) => /^(eth_|evm_|hardhat_|web3_|net_)/.test(name)),
      );
      // The names above came from this test's deliberate HTTP gate calls; the provider added none.
      expect(evmAfter).toEqual(evmBefore);
      expect(await provider.send('eth_blockNumber')).toMatch(/^0x[0-9a-f]+$/);
      expect(await provider.send('eth_chainId')).toBe('0x0');
      expect(await provider.send('hardhat_reset')).toBeNull();
      await expect(provider.send('eth_call')).rejects.toThrow(/unsupported JSON-RPC method/);
    } finally {
      await provider.disconnect();
    }
  }, 90_000);

  it('stops on SIGTERM with exit code 0, releases the port, and restarts deterministically', async () => {
    const firstGenesis = node.genesisHash;
    const firstAccounts = node.accounts.map((account) => account.address).slice(0, 3);
    const exit = await stopNode(node);
    expect(exit).toEqual({ code: 0, signal: null });

    // The port is free: a server can bind it again.
    const probe = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.listen(node.port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
    });
    expect(probe).toBe(true);

    node = await startNode();
    expect(node.genesisHash).toBe(firstGenesis);
    expect(node.accounts.map((account) => account.address).slice(0, 3)).toEqual(firstAccounts);
  }, 120_000);
});

describe('solidhat node --evm-rpc', () => {
  it('serves the twelve chain-control names and advertises evm_rpc', async () => {
    const node = await startNode(['--evm-rpc']);
    try {
      expect(node.evmRpc).toBe(true);
      const features = await call<{ devnet: { evm_rpc?: boolean } }>(node, 'server.features');
      expect(features.devnet.evm_rpc).toBe(true);
      const info = await call<{ height: number; evmRpc: boolean }>(node, 'devnet.info');
      expect(info.evmRpc).toBe(true);
      expect(await call(node, 'evm_mine')).toBe('0x0');
      expect(await call<string>(node, 'eth_blockNumber')).toBe(`0x${(info.height + 1).toString(16)}`);
      const snapshot = await call<string>(node, 'evm_snapshot');
      await call(node, 'evm_mine');
      expect(await call(node, 'evm_revert', [snapshot])).toBe(true);
      expect(await call<string>(node, 'eth_blockNumber')).toBe(`0x${(info.height + 1).toString(16)}`);
      expect(await call(node, 'evm_revert', ['0xdoesnotexist'])).toBe(false);
      for (const method of ['eth_call', 'eth_getLogs', 'eth_sendRawTransaction']) {
        const response = await rpc(node, method);
        expect(response.error?.code).toBe(-32601);
      }
    } finally {
      const exit = await stopNode(node);
      expect(exit.code).toBe(0);
    }
  }, 180_000);
});
