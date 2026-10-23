import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import {
  FrameKind,
  buildPushdataCommitment,
  bytesEqual,
  bytesToHex,
  validatorAddress,
  type Artifact,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { registerDeployment } from '../../../src/stateful/deployment-registry.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * The read path reaching a contract the caller never named in `externals`.
 *
 * A call is resolved the way the hop resolves it: what the caller named first, then the provider's own
 * registrations, keyed by the address the call site carries and then by the interface it names. A callee behind
 * its own proxy is the pair of frames the hop places for one — the proxy's fallback, which the caller records, and
 * the implementation's delegate frame, which runs the called entry on the proxy's records.
 */

const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const A = seededCategory('read through external A');
const B = seededCategory('read through external B');
const A_HEX = bytesToHex(A);
const B_HEX = bytesToHex(B);
const ADDRESS_B = validatorAddress(B, VALIDATOR_PROGRAM);

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const empty = new Uint8Array(0);

interface UtxoShape {
  readonly txid: string;
  readonly vout: number;
  readonly satoshis: bigint;
  readonly token: {
    readonly category: string;
    readonly amount: bigint;
    readonly nft: { readonly capability: 'minting' | 'mutable'; readonly commitment: string };
  };
}

/** One live UTXO as the provider holds it: a token at `lock`, with the commitment it carries. */
function utxo(
  txid: string, satoshis: bigint, category: string, capability: 'minting' | 'mutable', commitment: Uint8Array,
): UtxoShape {
  return {
    txid, vout: 0, satoshis,
    token: { category, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } },
  };
}

/** The provider's own transaction count, chain and mempool together. */
function transactionCount(provider: MockNetworkProvider): number {
  const snapshot = provider.indexer.storage.snapshot() as unknown as { txIndex: Map<string, unknown> };
  return snapshot.txIndex.size;
}

/** Funds one contract's deployment: its master pool, its records, and — for the group root — a validator. */
async function fund(
  provider: MockNetworkProvider,
  options: {
    readonly artifact: Artifact;
    readonly category: Uint8Array;
    readonly categoryHex: string;
    readonly seed: string;
    readonly records?: readonly Uint8Array[];
    readonly withValidator?: boolean;
  },
): Promise<void> {
  const deployed = deployMaster(options.artifact, options.category, VALIDATOR_PROGRAM);
  const txid = (suffix: string, pad: string): string => `${options.seed}${suffix}`.padEnd(64, pad).slice(0, 64);
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
    utxo(txid('11', 'a'), 20_000n, options.categoryHex, 'minting', empty));
  if (options.withValidator === true) {
    await provider.addUtxo(bytesToHex(deployed.address),
      utxo(txid('22', 'b'), 20_000n, options.categoryHex, 'mutable', empty));
  }
  for (const [index, commitment] of (options.records ?? []).entries()) {
    await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(options.categoryHex)),
      utxo(txid(`${33 + index}`, 'c'), 20_000n, options.categoryHex, 'mutable', commitment));
  }
}

describe('a read whose callee only the provider\'s registrations name', () => {
  it('serves a view root that calls a bare contract, with nothing broadcast', async () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface IB { function value() view returns (int); }'
      + ' contract B { int public v; function value() view returns (int) { return this.v; } }'
      + ' contract A {'
      + `   function peek() view returns (int) { return IB(0x${hex(ADDRESS_B)}).value(); }`
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    const bArtifact = artifacts.B!;
    const commitment = new Uint8Array(
      Buffer.from(buildPushdataCommitment(bArtifact.stateLayout!, { v: 7n }, 0), 'hex'),
    );

    const provider = new MockNetworkProvider();
    await fund(provider, { artifact: artifacts.A!, category: A, categoryHex: A_HEX, seed: 'a', withValidator: true });
    await fund(provider, { artifact: bArtifact, category: B, categoryHex: B_HEX, seed: 'b', records: [commitment] });
    // The callee is recorded under the address its code was compiled to reach, which is what the caller's own call
    // site carries, and under the interface it names.
    registerDeployment(provider, {
      contractName: 'B',
      address: bytesToHex(ADDRESS_B),
      lockingBytecode: bytesToHex(ADDRESS_B),
      contract: { inner: { artifact: bArtifact }, categoryId: B_HEX },
    });

    const before = transactionCount(provider);
    const result = await readFramedEntry({
      provider,
      artifact: artifacts.A!,
      categoryId: A_HEX,
      functionName: 'peek',
      vm: compositionMachine(),
    });

    expect(result.accepted).toBe(true);
    expect(result.value).toBe(7n);
    expect(transactionCount(provider)).toBe(before);
  });
});

/** Deploys an implementation behind its generated proxy, running `initialize` so the proxy's records hold state. */
async function deployProxied(network: MockNetworkProvider): Promise<{ readonly proxyAddress: Uint8Array }> {
  const source = 'pragma solidcash ^0.14.0;'
    + ' contract Impl {'
    + '   uint public initialized;'
    + '   int public total;'
    + '   int external separate;'
    + '   function initialize(address expected) {'
    + '     require(msg.sender == expected);'
    + '     this.initialized = 1;'
    + '     this.total = 5;'
    + '   }'
    + '   function peek() view returns (int) { return this.total; }'
    + ' }';
  const impl = compileStringMulti(source, { composition: 'framed' }).Impl!;

  const signature = new SignatureTemplate(alicePriv);
  const funderSource = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = funderSource.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const implFunding = { txid: '44'.repeat(32), vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: '55'.repeat(32), vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: '66'.repeat(32), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(funderSource.address, coin);
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  await network.addUtxo(binToHex(deployerLock), hopCoin);
  await fundShippedFacets(network);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: impl,
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: funderSource.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: funderSource.address },
    initialize: { functionName: 'initialize', args: [deployerLock] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: hopCoin, funder: callerFunder, changeAddress: funderSource.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return { proxyAddress: deployment.proxy.address };
}

describe('a read whose callee sits behind its own proxy', () => {
  it('plans the proxy pair and returns the implementation entry\'s value, with nothing broadcast', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { proxyAddress } = await deployProxied(network);

    const source = 'pragma solidcash ^0.14.0;'
      + ' interface IJob { function peek() view returns (int); }'
      + ' contract A {'
      + `   function job() view returns (int) { return IJob(0x${hex(proxyAddress)}).peek(); }`
      + ' }';
    const root = compileStringMulti(source, { composition: 'framed' }).A!;
    await fund(network, { artifact: root, category: A, categoryHex: A_HEX, seed: 'a', withValidator: true });

    const before = transactionCount(network);
    const result = await readFramedEntry({
      provider: network,
      artifact: root,
      categoryId: A_HEX,
      functionName: 'job',
      vm: compositionMachine(),
    });

    expect(result.accepted).toBe(true);
    expect(result.value).toBe(5n);
    // The read runs the implementation as the proxy's delegate frame: the proxy frame is the one the caller's call
    // names, and the implementation frame runs as the proxy, over the proxy's records.
    const proxyRun = result.draft.runs.find((run) => run.functionName.endsWith('.__fallback()'));
    expect(proxyRun).toBeDefined();
    const implementationRun = result.draft.runs.find((run) => run.functionName.endsWith('.peek()'));
    expect(implementationRun).toBeDefined();
    const implementationBlock = result.draft.blockOf(implementationRun!.master);
    expect(implementationBlock.kind).toBe(FrameKind.DELEGATE);
    expect(bytesEqual(implementationBlock.self, proxyAddress)).toBe(true);
    // The record the entry reads is the proxy's, so it is placed in the proxy's block and not the implementation's.
    const placed = result.draft.layout.participants.map((participant) => participant.id);
    expect(placed.some((id) => id.endsWith('-record-0'))).toBe(true);
    const implementationBlockState = result.draft.layout.blocks.find((block) => block.contract === 'Impl')!.state;
    expect(implementationBlockState).toStrictEqual([]);
    expect(transactionCount(network)).toBe(before);
  });
});

/**
 * A read that states the callee's arguments from the caller's own facts.
 *
 * The caller's published routing says where each argument comes from, and the read resolves those sources with the
 * same resolver the hop uses: the read's own arguments, the frame's addresses, and a literal the caller's code
 * pinned. A source only the caller's live records state — its own stored field — is refused by the kind that names
 * it, so a read never invents a value it cannot see. The root's argument forwarded to a callee behind its own proxy
 * is `reads/proxied-delegate-reads.test.ts`.
 */
describe('a read that states a callee\'s arguments', () => {
  const ECHO_SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface IEcho { function echo(int x) view returns (int); }'
    + ' contract Echo { function echo(int x) view returns (int) { return x; } }'
    + ' contract Root {'
    + '   int public seed;'
    + `   function forward(int x) view returns (int) { return IEcho(0x${hex(ADDRESS_B)}).echo(x); }`
    + `   function literal() view returns (int) { return IEcho(0x${hex(ADDRESS_B)}).echo(11); }`
    + `   function fromState() view returns (int) { return IEcho(0x${hex(ADDRESS_B)}).echo(this.seed); }`
    + ' }';

  const artifacts = compileStringMulti(ECHO_SOURCE, { composition: 'framed' });
  const root = artifacts.Root!;
  const echo = artifacts.Echo!;
  const SEED_COMMITMENT = new Uint8Array(
    Buffer.from(buildPushdataCommitment(root.stateLayout!, { seed: 4n }, 0), 'hex'),
  );

  /** Reads one entry of the root against a fresh chain: the root at `A`, the echo contract at `B`. */
  async function readRoot(
    functionName: string, args?: readonly bigint[],
  ): Promise<Awaited<ReturnType<typeof readFramedEntry>>> {
    const provider = new MockNetworkProvider();
    await fund(provider, {
      artifact: root, category: A, categoryHex: A_HEX, seed: 'a',
      records: [SEED_COMMITMENT], withValidator: true,
    });
    await fund(provider, { artifact: echo, category: B, categoryHex: B_HEX, seed: 'b' });
    return readFramedEntry({
      provider,
      artifact: root,
      categoryId: A_HEX,
      functionName,
      ...(args === undefined ? {} : { args }),
      externals: { IEcho: { artifact: echo, categoryId: B_HEX } },
      vm: compositionMachine(),
    });
  }

  it('forwards the root\'s own argument, so the callee answers with that argument', async () => {
    const five = await readRoot('forward', [5n]);
    expect(five.accepted).toBe(true);
    expect(five.value).toBe(5n);
    // The same entry with another argument answers differently, which is what shows the argument, not a constant.
    const nine = await readRoot('forward', [9n]);
    expect(nine.value).toBe(9n);
  });

  it('states a literal argument the caller pinned in its own code', async () => {
    const result = await readRoot('literal');
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(11n);
  });

  it('refuses an argument the caller\'s own live state records hold', async () => {
    // The read holds no live record of the caller's own state, so it names the source rather than reading a value.
    await expect(readRoot('fromState')).rejects.toThrow(
      'whose argument 0 comes from a "expression" of kind "state"',
    );
  });
});
