import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hexToBin } from '@bitauth/libauth';
import {
  buildPushdataCommitment, bytesToHex, hash256, INDEX_NONE, validatorAddress, type Artifact, type StateLayout,
} from '@solidcash/utils';
import { framedValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A run-time loop upsert beside a call, driven through the shipped proxy path.
 *
 * The entry makes one external call and the loop that follows it upserts the entry's own record, so the write lands
 * in the segment the call opened and the loop's own code runs there with it. The artifact publishes that segment,
 * the hop plans the records it names, and the machine's verdict on every participant is the assertion: the
 * well-formed spend is accepted, and the same spend with one byte of the record the entry wrote changed is refused.
 *
 * The mapping node of the same shape was the wall beside it. Its per-turn writes are carried by the sorted-batch
 * machinery rather than by one fixed record, and while the hop minted the head of a collection the initialize never
 * wrote in the call itself, the frame was refused with `Program failed an OP_VERIFY operation.` inside the upsert
 * body (PW3's reproducer, the ladder's `updateJobWhitelist` family). A head is minted only at genesis now, and the
 * loop-then-call body below settles through the head the transaction spends.
 */

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const FACET_SATOSHIS = 10_000n;
const AMOUNT = 42n;
const TURNS = 2n;

/** A 32-byte category whose bytes are not all the same, so a byte-order bug cannot hide in it. */
function category(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed * 31 + index * 7) & 0xff;
  return binToHex(bytes);
}

const IMPL_CATEGORY = category(0x11);
const PROXY_CATEGORY = category(0x21);
const CALLEE_CATEGORY = category(0x31);
const KEY = binToHex(new Uint8Array(20).fill(0x44));
const hexOf = (bytes: Uint8Array): string => binToHex(bytes);
const calleeAddress = (): Uint8Array => validatorAddress(hexToBin(CALLEE_CATEGORY), VALIDATOR_PROGRAM);

const HEAD = (): string => ' interface IOther { function ping(); }'
  + ' contract Other { int public touched; function ping() { require(this.touched == 0); } }'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   uint public total;'
  + '   function initialize(address expected) { require(msg.sender == expected); this.initialized = 1; }';

const CALL = `     IOther(0x${hexOf(calleeAddress())}).ping.call();\n`;
const OPEN = '   function move(uint amount, int turns) {\n';
const LOOP = '     for (int i = 0; i < turns; i = i + 1) { this.total = amount + uint(i); }\n';

/** The body under test: the call first, so the loop and the write it settles share the segment the call opened. */
const CALL_THEN_LOOP_SOURCE = `pragma solidcash ^0.14.0;${HEAD()}`
  + OPEN + CALL + LOOP + '     require(turns > 0);\n   }\n }';

/** The same body with the loop before the call, whose write lands in the segment the frame opens with. */
const LOOP_THEN_CALL_SOURCE = `pragma solidcash ^0.14.0;${HEAD()}`
  + OPEN + LOOP + CALL + '     require(true);\n   }\n }';

/** A mapping on the entry's state, entered with an `address` key, so the same loop writes a chain node per turn. */
const MAPPING_HEAD = (): string => HEAD() + '   mapping(address => uint) balances;\n';

/**
 * The mapping body: the write inside the loop names the collection the artifact publishes a verified batch for,
 * which is the shape `updateJobWhitelist` has. The key is the frame's own, so this is the *served* variant of the
 * loop upsert except for the call the body also makes.
 */
const MAPPING_WALL_SOURCE = `pragma solidcash ^0.14.0;${MAPPING_HEAD()}`
  + '   function move(address to, uint amount, int turns) {\n'
  + '     for (int i = 0; i < turns; i = i + 1) { balances[to] = amount; }\n'
  + `     IOther(0x${hexOf(calleeAddress())}).ping.call();\n`
  + '     require(true);\n   }\n }';

/**
 * A loop whose own body reaches the call, so the write the loop carries lands where the loop's own calls put it.
 *
 * A loop that reaches a call makes it once per turn, and each call closes the segment the turn's write ran in. The
 * artifact publishes where each turn writes (`turns`), and the hop declares each record from the segment that mints
 * it on, which is what the machine's verdict below measures.
 */
const LOOP_CALLS_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IOther { function ping(address who); }'
  + ' contract Other { int public touched; function ping(address who) { require(this.touched == 0); } }'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   uint[] public items;'
  + '   mapping(address => uint) balances;'
  + '   function initialize(address expected) { require(msg.sender == expected); this.initialized = 1; }'
  + '   function move(address[] who, uint amount) {\n'
  + '     this.items.push();\n'
  + '     for (uint i = 0; i < who.length; i = i + 1) {\n'
  + '       balances[who[i]] = amount;\n'
  + `       IOther(0x${hexOf(calleeAddress())}).ping.call(who[i]);\n`
  + '     }\n'
  + '     require(true);\n   }\n }';

/** The published write facts of one entry, as a builder reads them. */
function publishedWrites(artifact: Artifact, entryName: string): { writeSegment?: unknown; writeSegments?: unknown } {
  const entry = artifact.composition?.stopSites?.entries
    .find((candidate) => candidate.functionName.includes(`.${entryName}()`));
  return { writeSegment: entry?.writeSegment, writeSegments: entry?.writeSegments };
}

/** The commitment the shipped encoder materializes from one state of a layout. */
function commitment(layout: StateLayout, state: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, state, 0), 'hex'));
}

/** The commitment of an output's token, or undefined for one that carries no NFT. */
const commitmentOf = (output: { readonly token?: { readonly nft?: { readonly commitment?: Uint8Array } } }):
Uint8Array | undefined => output.token?.nft?.commitment;

interface Deployed {
  readonly network: MockNetworkProvider;
  readonly impl: Artifact;
  readonly callee: Artifact;
  readonly deployment: Awaited<ReturnType<typeof deployFramedProxy>>;
  readonly funded: {
    readonly proxyCategoryId: string;
    readonly implementationCategoryId: string;
    readonly deployerLock: Uint8Array;
    readonly changeAddress: string;
    readonly callCoin: { txid: string; vout: number; satoshis: bigint };
    readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  };
}

/**
 * Deploys the callee the entry calls, then the implementation and the proxy in front of it, and runs one entry of
 * the implementation through the proxy: `initialize` by default, any entry when the caller names one, and as a
 * separate hop when the caller asks for that, which an entry that calls another contract needs.
 */
async function deployed(source: string, options: {
  readonly entry?: string;
  readonly args?: readonly unknown[];
  readonly initializeAs?: 'hop';
} = {}): Promise<Deployed> {
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  const impl = artifacts.Impl!;
  const callee = artifacts.Other!;
  const signature = new SignatureTemplate(alicePriv);
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funderContract = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = funderContract.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  const calleeFunding = { txid: CALLEE_CATEGORY, vout: 0, satoshis: 500_000n };
  await network.addUtxo(funderContract.address, calleeFunding);
  await deployStatefulContract(callee, [], {
    fundingUtxo: calleeFunding, funder, changeAddress: funderContract.address, provider: network,
  });

  for (const [index, code] of framedValidator.buildValidatorFacets().entries()) {
    await network.addUtxo(hexOf(encodeLockingBytecodeP2sh32(hash256(code))), {
      txid: (0x70 + index).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: FACET_SATOSHIS,
    });
  }

  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: category(0x41), vout: 0, satoshis: 300_000n };
  const callCoin = { txid: category(0x51), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(funderContract.address, coin);
  for (const coin of [hopCoin, callCoin]) await network.addUtxo(hexOf(deployerLock), coin);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: impl,
    proxyArtifact: buildProxyArtifact(impl),
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: funderContract.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: funderContract.address },
    initialize: {
      functionName: options.entry ?? 'initialize',
      args: (options.args ?? [deployerLock]) as never,
    },
    externals: { IOther: { artifact: callee, categoryId: CALLEE_CATEGORY } },
    callerLockingBytecode: deployerLock,
    ...(options.initializeAs === undefined ? {} : { initializeAs: options.initializeAs }),
    callerFunding: { utxo: hopCoin, funder: callerFunder, changeAddress: funderContract.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    network, impl, callee, deployment,
    funded: {
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      deployerLock, changeAddress: funderContract.address, callCoin, funder: callerFunder,
    },
  };
}

/** The call the entry's own source makes, made through the shipped hop with the callee it names. */
async function callMove(
  run: Deployed, functionName: string, args: readonly unknown[],
): Promise<Awaited<ReturnType<typeof callFramedProxyEntry>>> {
  return callFramedProxyEntry({
    provider: run.network,
    implementationArtifact: run.impl,
    proxyArtifact: buildProxyArtifact(run.impl),
    proxyCategoryId: run.funded.proxyCategoryId,
    implementationCategoryId: run.funded.implementationCategoryId,
    functionName,
    args: args as never,
    externals: { IOther: { artifact: run.callee, categoryId: CALLEE_CATEGORY } },
    callerUtxo: run.funded.callCoin,
    callerLockingBytecode: run.funded.deployerLock,
    funder: run.funded.funder,
    changeAddress: run.funded.changeAddress,
    vm: compositionMachine(),
  });
}

let acceptedRun: Promise<Deployed> | undefined;

/** The one deployment the accept and the mutation cases share: both spend the coin it funded. */
async function sharedRun(): Promise<Deployed> {
  acceptedRun ??= deployed(CALL_THEN_LOOP_SOURCE);
  return acceptedRun;
}

/** The same deployment with one more coin at the caller's lock, so a second spend does not reuse the first coin. */
async function withFreshCoin(run: Deployed, seed: number): Promise<Deployed> {
  const callCoin = { txid: category(seed), vout: 0, satoshis: 300_000n };
  await run.network.addUtxo(hexOf(run.funded.deployerLock), callCoin);
  return { ...run, funded: { ...run.funded, callCoin } };
}

describe('a run-time loop upsert beside a call, through the shipped proxy path', () => {
  it('publishes the segment the write lands in, which is the one the call opened', () => {
    // The call precedes the loop, so the write lands in the segment the call opened and every turn of the loop
    // runs there with it: the artifact says so rather than leaving the segment to a builder's guess.
    expect(publishedWrites(compileStringMulti(CALL_THEN_LOOP_SOURCE, { composition: 'framed' }).Impl!, 'move'))
      .toStrictEqual({
        writeSegment: 1, writeSegments: [{ record: 0, segment: 1, writtenVariables: ['total'] }],
      });
    // A write the loop carries lands in the segment the code before the loop runs in, so the same body with the
    // loop first names the segment the frame opens with. That body is published here; the machine pair below is
    // taken on the call-then-loop body, which is the one the hop is driven for.
    expect(publishedWrites(compileStringMulti(LOOP_THEN_CALL_SOURCE, { composition: 'framed' }).Impl!, 'move'))
      .toStrictEqual({
        writeSegment: 0, writeSegments: [{ record: 0, segment: 0, writtenVariables: ['total'] }],
      });
  });

  it('the machine accepts the well-formed spend, and the record holds the value its last turn computed', async () => {
    const run = await sharedRun();
    const answered = await callMove(run, 'move', [AMOUNT, TURNS]);
    expect(answered.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(answered.accepted).toBe(true);
    // The callee runs before the entry that called it, which runs before the fallback that entered it.
    expect(answered.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Other.ping()', 'Impl.move()', 'ImplProxy.__fallback()']);
    // The record the entry wrote carries the value the loop's last turn computed: `amount + (turns - 1)`.
    const written = commitment(run.impl.stateLayout!, {
      implementation: validatorAddress(hexToBin(run.funded.implementationCategoryId), VALIDATOR_PROGRAM),
      initialized: 1n,
      total: AMOUNT + (TURNS - 1n),
    });
    expect(bytesToHex(answered.writtenCommitments[0]!)).toBe(bytesToHex(written));
    // And the transaction the hop carries holds it on the output the plan wrote it to.
    const index = answered.transaction.outputs
      .findIndex((output) => bytesToHex(commitmentOf(output) ?? new Uint8Array()) === bytesToHex(written));
    expect(index).toBeGreaterThanOrEqual(0);
  });

  it('the machine refuses the same spend with one byte of the record it wrote changed', async () => {
    // A second call of the same entry, on a coin of its own: the first case already spent the coin it was funded.
    const run = await withFreshCoin(await sharedRun(), 0x61);
    const answered = await callMove(run, 'move', [AMOUNT, TURNS]);
    const written = answered.writtenCommitments[0]!;
    const index = answered.transaction.outputs
      .findIndex((output) => bytesToHex(commitmentOf(output) ?? new Uint8Array()) === bytesToHex(written));
    expect(index).toBeGreaterThanOrEqual(0);

    // The mutated spend: the same transaction with one byte of that record changed, so the record no longer
    // carries the value the entry's own code computed.
    const changed = new Uint8Array(written);
    changed[changed.length - 1] = (changed[changed.length - 1]! ^ 0x01) & 0xff;
    const mutated = {
      ...answered.transaction,
      outputs: answered.transaction.outputs.map((output, at) => (at === index
        ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: changed } } }
        : output)),
    };
    const implementation = answered.verdicts.find((verdict) => verdict.id.includes('implementation'));
    expect(implementation?.accepted).toBe(true);
    // Every participant whose own verdict was accepted is asked again about the mutated spend. This second call writes
    // the value the record already holds, and the entry lands a write of it, so the record is spent on the write path
    // whatever its end view: the validator, which ties every declared record's end to the output it creates, is the
    // participant that has to refuse.
    const vm = compositionMachine();
    const refused = answered.verdicts
      .filter((verdict) => verdict.accepted)
      .map((verdict) => ({
        id: verdict.id,
        error: String(vm.evaluate({
          inputIndex: verdict.index, sourceOutputs: answered.sourceOutputs, transaction: mutated,
        }).error ?? ''),
      }))
      .filter((verdict) => verdict.error !== '');
    expect(refused.map((verdict) => verdict.id)).toContain('validator');
  });
});

describe('the mapping node of the same shape, through the same path', () => {
  it('publishes the segment its batch lands in, and settles the turns through the head the genesis minted', async () => {
    const run = await deployed(MAPPING_WALL_SOURCE);
    // The compiler states the fact a builder needs: the loop runs before the call, so the mapped node's write lands
    // in the segment the frame opens with, where a callee of the call already sees it.
    expect(publishedWrites(run.impl, 'move')).toStrictEqual({
      writeSegment: 0, writeSegments: [{ collection: 'balances', segment: 0 }],
    });
    expect(run.impl.composition?.refusedEntries).toBeUndefined();
    // `balances` is one the initialize never writes. While the hop minted such a head in the call, the frame was
    // refused inside the upsert body (PW3's reproducer, `OP_VERIFY`); a head is minted only at genesis now, so the
    // turns splice through the head the transaction spends, and every participant accepts.
    const answered = await callMove(run, 'move', [KEY, AMOUNT, TURNS]);
    expect(answered.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(answered.accepted).toBe(true);
    expect(answered.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The genesis head is recreated relinked to the key, and the one node the turns wrote carries the amount.
    const head = answered.draft.layout.participants.find((placed) => placed.id === 'mapping-head-balances')!;
    const relinked = commitmentOf(answered.transaction.outputs[head.index]!)!;
    const created = answered.draft.trailingOutputs.map((output) => commitmentOf(output.output)!);
    expect(created).toHaveLength(1);
    expect(bytesToHex(relinked.slice(0, 32))).toBe(bytesToHex(new Uint8Array(32)));
    expect(bytesToHex(relinked.slice(32, 64))).toBe(bytesToHex(created[0]!.slice(0, 32)));
    expect(bytesToHex(created[0]!.slice(64))).toBe(bytesToHex(new Uint8Array([Number(AMOUNT)])));
  }, 600_000);
});

describe('a mapping loop whose own body reaches a call, through the same path', () => {
  it('declares the loop\'s write in the segments its turns publish, and the frame accepts them', async () => {
    // The entry calls another contract, which the proxy's genesis cannot carry, so it runs as a separate hop. The
    // assertion is the machine's verdict on every frame of that hop.
    const run = await deployed(LOOP_CALLS_SOURCE, {
      entry: 'move', args: [[hexToBin(KEY)], AMOUNT], initializeAs: 'hop',
    });
    // The artifact states where each turn writes: the segment the loop's site's call closes, and no entry-wide one.
    expect((publishedWrites(run.impl, 'move').writeSegments ?? []) as readonly unknown[])
      .toContainEqual({ segment: 0, turns: { collection: 'balances', slot: 0, site: 0, stride: 1 } });
    // The turn relinks the head where it writes and defers the node it inserts to the loop's teardown, past the
    // call: the node is created in the last segment, not in the first.
    const draft = run.deployment.initialize.draft;
    const frame = draft.runs.find((execution) => execution.functionName.includes('Impl.move()'))!;
    const segments = draft.blockOf(frame.master).segments;
    expect(segments.map((segment) => segment.some((entry) => entry.in === INDEX_NONE))).toStrictEqual([false, true]);
    // Every participant the hop derived accepts, the validator facet included: the loop's write is declared where
    // the turns can land it, and the records the write reaches are declared once each and kept at what it left.
    expect(run.deployment.initialize.verdicts.filter((verdict) => !verdict.accepted).map((verdict) => verdict.id))
      .toStrictEqual([]);
  }, 600_000);
});
