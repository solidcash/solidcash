/**
 * The `solidhat node` / `solidcash node` action.
 *
 * Starts one `@mem-cash/server` process on a shared chain, installs the block-info oracle during `prepare`, prints the
 * funded-account table (human or `--json`), and exits 0 on SIGINT/SIGTERM after releasing the port.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateBip39Mnemonic } from '@bitauth/libauth/build/lib/key/bip39.js';
import type { HardhatRuntimeEnvironment } from './hre.js';
import type { NetworkConfig } from './config.js';
import type { TaskArguments } from './tasks.js';
import { createBlockOracleRuntime, type BlockOracleAdvertisement } from './block-oracle.js';

/** The Hardhat test phrase; the node and the provider share this zero-config default. */
const DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';
const DEFAULT_ACCOUNTS_PATH = "m/44'/60'/0'/0";

interface ServerHandleLike {
  readonly httpUrl: string;
  readonly wsUrl: string;
  readonly httpsUrl?: string;
  readonly wssUrl?: string;
  readonly host: string;
  readonly port: number;
  readonly chainId: string;
  readonly genesisHash: string;
  readonly devnet: {
    height: number;
    timestamp: number;
    medianTimePast: number;
    blockHash: string;
    mining: { mode: string; intervalMs: number | null };
    consensus: { vmVersion: string; enforceDust: boolean };
  };
  readonly indexer: unknown;
  readonly setBlockOracle: (value: BlockOracleAdvertisement | null) => void;
  readonly onTipChange: (listener: (change: never) => void) => () => void;
  readonly onSnapshot: (listener: (id: string) => void) => () => void;
  readonly onDropSnapshot: (listener: (id: string) => void) => () => void;
  readonly close: (options?: { drainMs?: number }) => Promise<void>;
}

interface ServerModule {
  createServer(options: Record<string, unknown>): Promise<ServerHandleLike>;
  deriveAccounts(params: {
    mnemonic: string;
    path: string;
    initialIndex: number;
    count: number;
    prefix: 'bchtest' | 'bchreg';
  }): {
    index: number;
    path: string;
    address: string;
    wif: string;
  }[];
  RELAXED_CONSENSUS: Record<string, unknown>;
  PRODUCTION_CONSENSUS: Record<string, unknown>;
}

function stringArg(args: TaskArguments, name: string): string | undefined {
  const value = args[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberArg(args: TaskArguments, name: string): number | undefined {
  const value = stringArg(args, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a number, received "${value}"`);
  return parsed;
}

function enumArg<T extends string>(
  args: TaskArguments,
  name: string,
  allowed: readonly T[],
): T | undefined {
  const value = stringArg(args, name);
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`--${name} must be one of ${allowed.join(', ')}, received "${value}"`);
  }
  return value as T;
}

function bchToSatoshis(bch: number): bigint {
  return BigInt(Math.round(bch * 100_000_000));
}

/** Format satoshis as a BCH amount with no trailing zeros. */
function formatBch(satoshis: string): string {
  const value = BigInt(satoshis);
  const whole = value / 100_000_000n;
  const fraction = (value % 100_000_000n).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction.length === 0 ? `${whole}` : `${whole}.${fraction}`;
}

interface TlsMaterial {
  readonly key: string;
  readonly cert: string;
}

/** A self-signed certificate for the loopback TLS listener, generated with the host's openssl. */
function selfSignedCertificate(): TlsMaterial {
  const dir = mkdtempSync(join(tmpdir(), 'solidcash-tls-'));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30',
      '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-keyout', keyPath, '-out', certPath,
    ], { stdio: 'ignore' });
    return { key: readFileSync(keyPath, 'utf8'), cert: readFileSync(certPath, 'utf8') };
  } catch (error) {
    throw new Error(
      '--tls needs a certificate: pass --tls-cert and --tls-key, or make openssl available '
      + `(${error instanceof Error ? error.message : String(error)})`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function runDevnetNode(args: TaskArguments, hre: HardhatRuntimeEnvironment): Promise<void> {
  const json = args.json === true;
  const quiet = args.quiet === true;
  const noKeys = args['no-keys'] === true;

  const netName = hre.network.name;
  const netCfg = (hre.config.networks as Record<string, NetworkConfig | undefined>)[netName];
  const devnetCfg = netCfg?.devnet ?? {};
  const accountsCfg = hre.config.accounts ?? {};

  const host = stringArg(args, 'host') ?? devnetCfg.host ?? '127.0.0.1';
  const port = numberArg(args, 'port') ?? devnetCfg.port ?? 8545;
  const tlsCertPath = stringArg(args, 'tls-cert');
  const tlsKeyPath = stringArg(args, 'tls-key');
  const tlsEnabled = args.tls === true;
  if (!tlsEnabled && (tlsCertPath !== undefined || tlsKeyPath !== undefined)) {
    throw new Error('--tls-cert and --tls-key require --tls');
  }
  if (tlsEnabled && (tlsCertPath === undefined) !== (tlsKeyPath === undefined)) {
    throw new Error('--tls-cert and --tls-key must be given together');
  }
  const tls = tlsEnabled
    ? {
        ...(tlsCertPath !== undefined && tlsKeyPath !== undefined
          ? { cert: readFileSync(tlsCertPath, 'utf8'), key: readFileSync(tlsKeyPath, 'utf8') }
          : selfSignedCertificate()),
        port: numberArg(args, 'tls-port') ?? (port === 0 ? 0 : port + 1),
      }
    : undefined;
  const mining = enumArg(args, 'mining', ['auto', 'manual', 'interval'] as const)
    ?? devnetCfg.mining ?? 'auto';
  const intervalMs = numberArg(args, 'interval') ?? devnetCfg.intervalMs ?? 1000;
  const coinbase = enumArg(args, 'coinbase', ['burn', 'account', 'none'] as const) ?? 'burn';
  const bchNetwork = enumArg(args, 'bch-network', ['mocknet', 'regtest'] as const)
    ?? devnetCfg.network ?? 'mocknet';
  const chainId = stringArg(args, 'chain-id') ?? devnetCfg.chainId ?? 'mem-cash-devnet';
  const accountCount = numberArg(args, 'accounts') ?? devnetCfg.accounts?.count ?? accountsCfg.count ?? 20;
  const initialIndex = devnetCfg.accounts?.initialIndex ?? accountsCfg.initialIndex ?? 0;
  const path = stringArg(args, 'path') ?? devnetCfg.accounts?.path ?? accountsCfg.path ?? DEFAULT_ACCOUNTS_PATH;
  const height = numberArg(args, 'height') ?? devnetCfg.height ?? 200;
  const genesisTimestamp = numberArg(args, 'timestamp') ?? devnetCfg.timestamp ?? 1_700_000_000;
  const balanceBch = numberArg(args, 'balance') ?? devnetCfg.balance ?? 10_000;
  const coins = numberArg(args, 'coins') ?? devnetCfg.coins ?? 128;
  const mnemonic = args['random-mnemonic'] === true
    ? generateBip39Mnemonic()
    : stringArg(args, 'mnemonic') ?? netCfg?.mnemonic ?? hre.config.mnemonic ?? DEFAULT_MNEMONIC;
  // Mainnet rules by default: a devnet must refuse what mainnet refuses unless someone explicitly asks for relaxed.
  const consensusName = enumArg(args, 'consensus', ['relaxed', 'production'] as const) ?? 'production';
  const vm = enumArg(args, 'vm', ['BCH_2023_05', 'BCH_2025_05', 'BCH_2026_05', 'BCH_SPEC'] as const);
  const logLevel = enumArg(args, 'log-level', ['error', 'warn', 'info', 'debug'] as const);
  const oracleEnabled = args['no-block-oracle'] !== true && devnetCfg.blockOracle !== false;
  const funding = args['no-fund'] !== true;
  const evmRequested = args['evm-rpc'] === true || devnetCfg.evm === true;

  const server = (await import('@mem-cash/server')) as unknown as ServerModule;

  // A relaxed devnet takes the selected network's `consensus` over its own profile, and enforces what it then
  // advertises. A production devnet is BCH mainnet's: mem-cash verifies a profile that enforces dust with libauth's
  // stock limits whatever the profile states, so a network's `consensus` (a mock's own limits, or the limits a compile
  // reads before it connects) merged into it would be advertised and never enforced. Clients pad each input to the
  // advertised operation-cost budget: padded to a project's 1,000,000 units a byte, their transactions were refused at
  // mainnet's 800. So production takes none of it.
  const production = consensusName === 'production';
  const consensus = {
    ...(production ? server.PRODUCTION_CONSENSUS : server.RELAXED_CONSENSUS),
    ...(vm === undefined ? {} : { vmVersion: vm }),
    ...(production ? {} : netCfg?.consensus ?? {}),
  };

  const extensions: unknown[] = [];
  if (evmRequested) {
    try {
      const evm = (await import('@mem-cash/server-evm')) as { evmCompat(): unknown };
      extensions.push(evm.evmCompat());
    } catch {
      throw new Error('--evm-rpc requires @mem-cash/server-evm; install it or drop the flag.');
    }
  }

  let oracle: ReturnType<typeof createBlockOracleRuntime> | undefined;
  const unsubscribes: (() => void)[] = [];

  const devnetOptions = {
    chainId,
    network: bchNetwork,
    mnemonic,
    accounts: {
      count: accountCount,
      initialIndex,
      path,
      balanceSatoshis: bchToSatoshis(balanceBch),
      coinsPerAccount: coins,
    },
    height,
    genesisTimestamp,
    mining: {
      mode: mining,
      intervalMs,
      emptyBlocks: args['interval-empty'] === true,
      coinbase,
    },
    consensus,
    funding,
  };

  let handle: ServerHandleLike;
  try {
    handle = await server.createServer({
      host,
      port,
      ...(tls === undefined ? {} : { tls }),
      devnet: devnetOptions,
      extensions,
      limits: {
        ...(numberArg(args, 'max-connections') === undefined ? {} : { maxConnections: numberArg(args, 'max-connections') }),
        ...(numberArg(args, 'max-message-bytes') === undefined ? {} : { maxMessageBytes: numberArg(args, 'max-message-bytes') }),
        ...(numberArg(args, 'max-snapshots') === undefined ? {} : { maxSnapshots: numberArg(args, 'max-snapshots') }),
      },
      security: {
        allowRemote: args['unsafe-expose'] === true,
        ...(stringArg(args, 'token') === undefined ? {} : { token: stringArg(args, 'token') }),
        ...(Array.isArray(args['allow-origin']) ? { allowedOrigins: args['allow-origin'] as string[] } : {}),
        ...(Array.isArray(args['allow-host']) ? { allowedHosts: args['allow-host'] as string[] } : {}),
      },
      logging: {
        ...(logLevel === undefined ? {} : { level: logLevel }),
        json,
        // JSON mode emits one event per line; structured server logs would duplicate the `listening` event.
        quiet: quiet || json,
        ...(args.trace === true ? { traceRequests: true } : {}),
      },
      prepare: (prepared: ServerHandleLike) => {
        if (!oracleEnabled) {
          prepared.setBlockOracle(null);
          return;
        }
        oracle = createBlockOracleRuntime({
          indexer: prepared.indexer as never,
          enabled: true,
        });
        oracle.install();
        prepared.setBlockOracle(oracle.advertisement());
        oracle.subscribeAdvertisement((advertisement) => prepared.setBlockOracle(advertisement));
        unsubscribes.push(
          prepared.onTipChange((change) => oracle?.onTipChange(change as never)),
          prepared.onSnapshot((id) => oracle?.onSnapshot(id)),
          prepared.onDropSnapshot((id) => oracle?.onDropSnapshot(id)),
        );
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/EADDRINUSE/.test(message)) {
      throw new Error(
        `Port ${port} is already in use. Another devnet may be running; use --port 0 to pick a free port.`,
      );
    }
    throw error;
  }

  const accounts = server.deriveAccounts({
    mnemonic,
    path,
    initialIndex,
    count: accountCount,
    prefix: bchNetwork === 'regtest' ? 'bchreg' : 'bchtest',
  });
  const info = handle.devnet;
  const evmRpc = evmRequested;

  if (json) {
    process.stdout.write(`${JSON.stringify({
      event: 'listening',
      httpUrl: handle.httpUrl,
      wsUrl: handle.wsUrl,
      ...(handle.httpsUrl === undefined ? {} : { httpsUrl: handle.httpsUrl, wssUrl: handle.wssUrl }),
      port: handle.port,
      host: handle.host,
      genesisHash: handle.genesisHash,
      chainId: handle.chainId,
      evmRpc,
      height: info.height,
      mining: info.mining.mode,
      blockOracle: oracle?.advertisement() ?? null,
    })}\n`);
    for (const account of accounts) {
      process.stdout.write(`${JSON.stringify({
        event: 'account',
        index: account.index,
        address: account.address,
        path: account.path,
        balance: `${formatBch(String(bchToSatoshis(balanceBch)))} BCH`,
        ...(noKeys ? {} : { wif: account.wif }),
      })}\n`);
    }
    process.stdout.write(`${JSON.stringify({
      event: 'ready',
      port: handle.port,
      accounts: accounts.length,
      mining: info.mining.mode,
    })}\n`);
  } else {
    const lines: string[] = [];
    lines.push(`mem-cash devnet · ${info.consensus.vmVersion} (${consensusName}) · chain "${handle.chainId}"`);
    lines.push('');
    lines.push(`  HTTP        ${handle.httpUrl}`);
    lines.push(`  WebSocket   ${handle.wsUrl}`);
    if (handle.httpsUrl !== undefined) {
      lines.push(`  HTTPS       ${handle.httpsUrl}`);
      lines.push(`  WSS         ${handle.wssUrl}`);
      lines.push('              (open the HTTPS URL once and accept the certificate for a browser wallet)');
    }
    lines.push(`  Genesis     ${handle.genesisHash.slice(0, 20)}…  (height 0)`);
    lines.push(`  Tip         ${info.height}  ${info.blockHash.slice(0, 20)}…`);
    lines.push(`  Mining      ${info.mining.mode}${info.mining.mode === 'auto'
      ? ' — one block per accepted broadcast request, burn coinbase' : ''}`);
    lines.push(`  EVM compat  ${evmRpc ? 'on — chain-control names via @mem-cash/server-evm' : 'off — start with --evm-rpc to install @mem-cash/server-evm'}`);
    lines.push(`  Oracle      ${oracleEnabled ? 'on — block.timestamp/number read the live tip' : 'off — disable with --no-block-oracle'}`);
    lines.push(`  Accounts    ${accounts.length} funded · ${coins} coins each · ${balanceBch} BCH each`);
    if (!quiet) {
      lines.push('');
      // Columns are as wide as their widest entry: a BCH address is 50 characters and a WIF 52, where the EVM table
      // this mirrors fits 42-character addresses.
      const addressWidth = Math.max('Address'.length, ...accounts.map((account) => account.address.length)) + 2;
      const wifWidth = Math.max('WIF'.length, ...accounts.map((account) => account.wif.length)) + 2;
      const balanceWidth = `${balanceBch} BCH`.length + 2;
      lines.push(`  #  ${'Address'.padEnd(addressWidth)}${noKeys ? '' : 'WIF'.padEnd(wifWidth)}${'Balance'.padEnd(balanceWidth)}Path`);
      for (const account of accounts) {
        const address = account.address.padEnd(addressWidth);
        const wif = noKeys ? '' : account.wif.padEnd(wifWidth);
        lines.push(`  ${String(account.index).padStart(2)} ${address}${wif}${`${balanceBch} BCH`.padEnd(balanceWidth)}${account.path}`);
      }
      lines.push('');
      lines.push(`  Mnemonic: ${mnemonic}`);
      lines.push('');
      lines.push('  DEVELOPMENT ONLY. Do not use with real funds.');
      lines.push('  Ready. Ctrl+C to stop.');
    }
    process.stdout.write(`${lines.join('\n')}\n`);
  }

  const shutdownTimeout = numberArg(args, 'shutdown-timeout') ?? 2000;
  await new Promise<void>((resolve) => {
    let stopping = false;
    const stop = (): void => {
      if (stopping) {
        process.exit(0);
        return;
      }
      stopping = true;
      void (async () => {
        for (const unsubscribe of unsubscribes) {
          try {
            unsubscribe();
          } catch {
            // Listener removal must not block shutdown.
          }
        }
        const heightAtStop = handle.devnet.height;
        await handle.close({ drainMs: shutdownTimeout });
        if (!json && !quiet) {
          process.stdout.write(`devnet stopped (height ${heightAtStop})\n`);
        } else if (json) {
          process.stdout.write(`${JSON.stringify({ event: 'stopped', height: heightAtStop })}\n`);
        }
        resolve();
      })();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}
