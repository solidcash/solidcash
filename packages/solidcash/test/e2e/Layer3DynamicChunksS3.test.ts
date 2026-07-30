import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildChunkCommitment, buildInitialStateCommitments } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createDynamicChunkUnlocker, getDataNftAddress, getDynamicChunkAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * S3 - chunk-backed dynamic state across more than one handler of one authenticated graph.
 *
 * The open question was whether a chunked value can cross a handler boundary inside a route at all. It can,
 * in the WRITE direction, and the binding constraint is not the one the board expected.
 *
 * What the compiler already gives a graph participant: the SCB1 route is `__scb1`, so `needsTrailingRegion`
 * fires and the block is [master, dataNft, trailing x64] = 66 slots with `trailingBase = 2`. Every chunk the
 * handlers mint lands at `masterInput + 2 + i`, which is block-relative, so two dynamic participants each own
 * a private 64-slot region and neither can reach the other's.
 *
 * Measured here, all settling on the BCH-2026 VM:
 *
 * - one chunk-backed write inside a two-participant graph (71 slots);
 * - two chunks inside one participant's region;
 * - an overwrite that consumes the old chunk;
 * - TWO handler rows on the SAME participant, where only the last write flushes;
 * - TWO dynamic participants, each with its own region, in one 138-slot transaction;
 * - 64 chunks, exactly the declared capacity, grown inside the handler.
 *
 * The binding constraint is the 223-byte SCB1 batch blob, not the trailing region: a value that ARRIVES as a
 * handler argument is capped at 202 bytes, which is two chunks. The same handler computing its value reaches
 * all 64. So "dynamic values across handlers" is bounded by what the transcript can carry into a handler,
 * 32x tighter than the region the compiler reserves for what comes out.
 *
 * The READ direction is pinned separately at the bottom and does NOT work: a persisted read of a non-empty
 * value fails closed on this route while the identical read settles on the direct route.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const CHUNK = 120;

const WRITE_ONLY = `pragma solidcash >=0.8.0;
    contract DynNote() {
      bytes note;
      function setNote(bytes t) public {
        this.note = t;
        require(true);
      }
    }`;

const READ_WRITE = `pragma solidcash >=0.8.0;
    contract DynNote() {
      bytes note;
      function setNote(bytes t) public {
        this.note = t;
        require(true);
      }
      function checkNote(bytes expected) public {
        require(this.note == expected);
      }
    }`;

/** A handler that GROWS its value instead of receiving it, so the 223-byte blob stops binding. */
const grownSource = (repeats: number): string => `pragma solidcash >=0.8.0;
    contract DynNote() {
      bytes note;
      function setNote(bytes t) public {
        this.note = bytes.concat(${new Array(repeats).fill('t').join(', ')});
        require(true);
      }
    }`;

type Tamper = 'none' | 'forge-chunk-data' | 'forge-len' | 'stale-final' | 'permute-chunks' | 'extra-chunk'
| 'drop-old-chunk' | 'minting-capability' | 'sibling-category' | 'cross-alias';

interface Spec {
  /** One handler row per entry, in execution order. */
  rows: { fn: string; value: Uint8Array }[];
  /** Which dynamic participant each row targets. */
  targets: number[];
  dynCount: number;
  initial?: Uint8Array[];
  source?: string;
  /** Post-state per dynamic participant when the rows do not name it (grown values, read-only rows). */
  finalValue?: Uint8Array[];
}

interface Built {
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  layout: layer3.CompiledGraphPhysicalLayout;
  chunkRuns: Record<number, number>;
}

async function buildDynamicGraph(spec: Spec, tamper: Tamper = 'none'): Promise<Built> {
  const provider = createTestProvider();
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const controllerCategory = genesis.categoryId as string;
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const dynArtifact = compileString(spec.source ?? WRITE_ONLY, options);
  const initial = spec.initial ?? new Array(spec.dynCount).fill(new Uint8Array());
  const dyns: any[] = [];
  for (let d = 0; d < spec.dynCount; d++) {
    const base = new Contract(dynArtifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, dynArtifact.stateLayout!, { note: initial[d] });
    const contract = base.withCategory(hexToBin(setup.categoryId));
    const chunkAddress = getDynamicChunkAddress(contract, setup.categoryId, 'note', 'bytes');
    const oldChunks: any[] = [];
    for (let i = 0; i < Math.ceil(initial[d].length / CHUNK); i++) {
      const utxo = randomUtxo({
        satoshis: 1200n,
        token: {
          category: setup.categoryId,
          amount: 0n,
          nft: {
            capability: 'mutable' as const,
            commitment: buildChunkCommitment(i, initial[d].slice(i * CHUNK, (i + 1) * CHUNK)),
          },
        },
      });
      await provider.addUtxo(chunkAddress, utxo);
      oldChunks.push(utxo);
    }
    dyns.push({ setup, contract, chunkAddress, oldChunks });
  }

  const calls = spec.rows.map((row, index) =>
    `        IDynNote(note${spec.targets[index]}).${row.fn}(v${index});`).join('\n');
  const params = spec.rows.map((_row, index) => `bytes v${index}`).join(', ');
  const targetParams = dyns.map((_dyn, index) => `, address note${index}`).join('');
  const iface = [...new Set(spec.rows.map((row) => row.fn))]
    .map((fn) => `function ${fn}(bytes t);`).join(' ');
  const callerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface IDynNote { ${iface} }
    contract DynRouter(int brand${targetParams}) {
      function route(${params}) public {
${calls}
        require(true);
      }
    }`, options);
  const callerBase = new Contract(
    callerArtifact, [1n, ...dyns.map((dyn) => dyn.contract.lockingBytecode)], { provider },
  );
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {});
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    ...dyns.map((dyn) => ({ artifact: dynArtifact, lockingBytecode: dyn.contract.lockingBytecode })),
  ], [
    { parent: null, callee: 0, function: 'route', args: spec.rows.map((row) => row.value) },
    ...spec.rows.map((row, index) => ({
      parent: 0, callee: 1 + spec.targets[index], function: row.fn, args: [row.value],
    })),
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
    plan.participants.map(() => ''), layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const seedFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, seedFee);
  const seedTx = new TransactionBuilder({ provider });
  seedTx.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  seedTx.addInput(seedFee, p2pkh.unlock.spend(alicePub, signature()));
  seedTx.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  seedTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(seedTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const projectionUtxos = plan.participants.map(() => randomUtxo({ satoshis: 1000n }));
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  const fee = randomUtxo({ satoshis: 400_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const finals: Uint8Array[] = (spec.finalValue ?? dyns.map((_dyn, d) => {
    const written = spec.targets
      .map((target, index) => (target === d && spec.rows[index].fn === 'setNote' ? index : -1))
      .filter((index) => index >= 0).pop();
    return written === undefined ? initial[d] : spec.rows[written].value;
  })).slice();
  if (tamper === 'stale-final') finals[0] = spec.rows[0].value;

  const builder = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  builder.addInput(
    callerSetup.masterUtxo,
    callerRouteUnlocker(caller, callerArtifact)(
      ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
    ),
  );
  const chunkRuns: Record<number, number> = {};
  for (let d = 0; d < spec.dynCount; d++) {
    const dyn = dyns[d];
    const region = layout.trailingRegions.find((entry) => entry.participant === d + 1)!;
    expect(region.base).toBe(layout.participantInputs[d + 1] + 2);
    builder.addInput(dyn.setup.masterUtxo, callerRouteUnlocker(dyn.contract, dynArtifact)(
      ...layer3.compiledGraphRouteArgs(transcript, d + 1, layout.controllerInput) as FunctionArgument[] as any,
    ));
    builder.addInput(
      dyn.setup.dataNftUtxos[0],
      createDataNftUnlocker(dyn.contract, layout.participantInputs[d + 1], dyn.setup.categoryId),
    );
    const chunkInputs = tamper === 'drop-old-chunk' && d === 0 ? dyn.oldChunks.slice(1) : dyn.oldChunks;
    for (const chunk of chunkInputs) {
      builder.addInput(chunk, createDynamicChunkUnlocker(
        dyn.contract, layout.participantInputs[d + 1], dyn.setup.categoryId, 'note', 'bytes',
      ));
    }
    for (let i = chunkInputs.length; i < region.capacity; i++) {
      const funder = randomUtxo({ satoshis: 1500n });
      await provider.addUtxo(p2pkh.address, funder);
      builder.addInput(funder, p2pkh.unlock.spend(alicePub, signature()));
    }
    chunkRuns[d + 1] = Math.ceil(finals[d].length / CHUNK);
  }
  projectionUtxos.forEach((proof, participant) =>
    builder.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  builder.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  builder.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  builder.addOutput({
    to: caller.tokenAddress, amount: callerSetup.masterUtxo.satoshis,
    token: { category: callerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  for (let d = 0; d < spec.dynCount; d++) {
    const dyn = dyns[d];
    const region = layout.trailingRegions.find((entry) => entry.participant === d + 1)!;
    builder.addOutput({
      to: dyn.contract.tokenAddress, amount: dyn.setup.masterUtxo.satoshis,
      token: { category: dyn.setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    const registerValue = tamper === 'forge-len' && d === 0
      ? finals[d].slice(0, Math.max(0, finals[d].length - 1))
      : finals[d];
    builder.addOutput({
      to: getDataNftAddress(dyn.contract, dyn.setup.categoryId), amount: dyn.setup.dataNftUtxos[0].satoshis,
      token: {
        category: dyn.setup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: buildInitialStateCommitments(dynArtifact.stateLayout!, { note: registerValue })[0],
        },
      },
    });
    const pieces: Uint8Array[] = [];
    for (let i = 0; i < Math.ceil(finals[d].length / CHUNK); i++) {
      pieces.push(finals[d].slice(i * CHUNK, (i + 1) * CHUNK));
    }
    if (d === 0 && tamper === 'forge-chunk-data' && pieces.length > 0) {
      const forged = new Uint8Array(pieces[0]);
      forged[0] ^= 0xff;
      pieces[0] = forged;
    }
    if (d === 0 && tamper === 'permute-chunks' && pieces.length > 1) {
      const head = pieces[0]; pieces[0] = pieces[1]; pieces[1] = head;
    }
    // The alias case moves participant 0's whole value into participant 1's region.
    if (d === 0 && tamper === 'cross-alias') pieces.length = 0;
    for (let i = 0; i < pieces.length; i++) {
      builder.addOutput({
        to: dyn.chunkAddress, amount: 1200n,
        token: {
          category: (d === 0 && tamper === 'sibling-category')
            ? dyns[1].setup.categoryId : dyn.setup.categoryId,
          amount: 0n,
          nft: {
            capability: (d === 0 && tamper === 'minting-capability') ? 'minting' : 'mutable',
            commitment: buildChunkCommitment(i, pieces[i]),
          },
        },
      });
    }
    let used = pieces.length;
    if (d === 0 && tamper === 'extra-chunk') {
      builder.addOutput({
        to: dyn.chunkAddress, amount: 1200n,
        token: {
          category: dyn.setup.categoryId, amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: buildChunkCommitment(pieces.length, Uint8Array.of(9)),
          },
        },
      });
      used += 1;
    }
    if (d === 1 && tamper === 'cross-alias') {
      for (let i = 0; i < Math.ceil(finals[0].length / CHUNK); i++) {
        builder.addOutput({
          to: dyns[0].chunkAddress, amount: 1200n,
          token: {
            category: dyns[0].setup.categoryId, amount: 0n,
            nft: {
              capability: 'mutable',
              commitment: buildChunkCommitment(i, finals[0].slice(i * CHUNK, (i + 1) * CHUNK)),
            },
          },
        });
        used += 1;
      }
    }
    for (let i = used; i < region.capacity; i++) builder.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  for (let i = 0; i < plan.participants.length; i++) {
    builder.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  builder.addOutput({ to: p2pkh.address, amount: 1000n });
  builder.addOutput({ to: p2pkh.address, amount: 20_000n });
  return { provider, builder, transaction: raw(builder), layout, chunkRuns };
}

const callerRouteUnlocker = (contract: Contract<any, any>, artifact: any): any =>
  contract.createCompilerRouteUnlocker(artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector));

/** Report the first input whose BCH-2026 evaluation fails, so a hostile case names one exact covenant. */
function failingInput(builder: TransactionBuilder): number | null {
  try {
    layer3.preflightLayer3Transaction(builder);
    return null;
  } catch (error) {
    const match = /failed at input (\d+)/.exec((error as Error).message);
    if (!match) throw error;
    return Number(match[1]);
  }
}

const bytes = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);
const set = (value: Uint8Array): { fn: string; value: Uint8Array } => ({ fn: 'setNote', value });

// Physical slots of the two-participant shape: [router master, dynamic master, dynamic dataNft, 64 trailing].
const INPUT = { router: 0, dynamic: 1 } as const;

describe('S3 chunk-backed state across graph handlers - honest settlement', () => {
  it('settles one chunk-backed write inside a two-participant graph', async () => {
    const built = await buildDynamicGraph({ rows: [set(bytes(40, 0x41))], targets: [0], dynCount: 1 });
    expect(built.layout.totalSlots).toBe(71);
    expect(built.layout.trailingRegions).toEqual([{ participant: 1, base: 3, capacity: 64 }]);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('settles a two-chunk value inside one participant region', async () => {
    const built = await buildDynamicGraph({ rows: [set(bytes(200, 0x42))], targets: [0], dynCount: 1 });
    expect(built.chunkRuns[1]).toBe(2);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('settles an overwrite that consumes the old chunk', async () => {
    const built = await buildDynamicGraph({
      rows: [set(bytes(40, 0x43))], targets: [0], dynCount: 1, initial: [bytes(30, 0x39)],
    });
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('settles TWO handler rows on one participant, flushing only the last write', async () => {
    // The two rows write different values of different lengths, so the single flushed post-state cannot
    // coincide with the first row's; `rejects a stale post-state` below is the matching hostile.
    const built = await buildDynamicGraph({
      rows: [set(bytes(40, 0x44)), set(bytes(50, 0x45))], targets: [0, 0], dynCount: 1,
    });
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('settles TWO dynamic participants, each owning a private chunk region', async () => {
    const built = await buildDynamicGraph({
      rows: [set(bytes(40, 0x46)), set(bytes(50, 0x47))], targets: [0, 1], dynCount: 2,
    });
    expect(built.layout.totalSlots).toBe(138);
    expect(built.layout.trailingRegions).toEqual([
      { participant: 1, base: 3, capacity: 64 },
      { participant: 2, base: 69, capacity: 64 },
    ]);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('settles a 64-chunk value grown inside the handler - exactly the declared capacity', async () => {
    // Knob-liveness for the capacity claim: 64 is not a number nobody reaches, it is reached and it settles.
    const built = await buildDynamicGraph({
      rows: [set(bytes(192, 0x53))], targets: [0], dynCount: 1,
      source: grownSource(40), finalValue: [bytes(192 * 40, 0x53)],
    });
    expect(built.chunkRuns[1]).toBe(64);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);
});

describe('S3 chunk-backed state across graph handlers - hostile', () => {
  const twoRows: Spec = { rows: [set(bytes(40, 0x44)), set(bytes(50, 0x45))], targets: [0, 0], dynCount: 1 };

  const rejects = async (spec: Spec, tamper: Tamper, input: number): Promise<void> => {
    const built = await buildDynamicGraph(spec, tamper);
    expect(failingInput(built.builder)).toBe(input);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  };

  it('rejects forged chunk data', async () => {
    await rejects(twoRows, 'forge-chunk-data', INPUT.dynamic);
  }, 300_000);

  it('rejects a forged length register with honest chunk data', async () => {
    await rejects(twoRows, 'forge-len', INPUT.dynamic);
  }, 300_000);

  it('rejects a stale post-state - the FIRST row\'s value flushed instead of the last', async () => {
    await rejects(twoRows, 'stale-final', INPUT.dynamic);
  }, 300_000);

  it('rejects an extra chunk output inside the region', async () => {
    await rejects(twoRows, 'extra-chunk', INPUT.dynamic);
  }, 300_000);

  it('rejects a minting capability on a chunk output', async () => {
    await rejects(twoRows, 'minting-capability', INPUT.dynamic);
  }, 300_000);

  it('rejects permuted chunk indices within one value', async () => {
    await rejects({ rows: [set(bytes(200, 0x42))], targets: [0], dynCount: 1 },
      'permute-chunks', INPUT.dynamic);
  }, 300_000);

  it('rejects an old chunk that is not consumed', async () => {
    await rejects(
      { rows: [set(bytes(40, 0x43))], targets: [0], dynCount: 1, initial: [bytes(30, 0x39)] },
      'drop-old-chunk', INPUT.dynamic,
    );
  }, 300_000);

  it('rejects a chunk minted under the SIBLING participant category', async () => {
    await rejects(
      { rows: [set(bytes(40, 0x46)), set(bytes(50, 0x47))], targets: [0, 1], dynCount: 2 },
      'sibling-category', INPUT.dynamic,
    );
  }, 300_000);

  it('rejects one participant value written into the other participant region', async () => {
    // The alias case: the bytes and the chunk address are honest, only the REGION is the sibling's, so this
    // is refused by the block-relative index and not by any content check.
    await rejects(
      { rows: [set(bytes(40, 0x46)), set(bytes(50, 0x47))], targets: [0, 1], dynCount: 2 },
      'cross-alias', INPUT.dynamic,
    );
  }, 300_000);
});

describe('S3 bounds', () => {
  it('caps an argument-carried value at the 223-byte SCB1 blob, not at the chunk region', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const dyn = compileString(WRITE_ONLY, options);
    const router = compileString(`pragma solidcash >=0.8.0;
      interface IDynNote { function setNote(bytes t); }
      contract DynRouter(int brand, address note0) {
        function route(bytes v0) public {
          IDynNote(note0).setNote(v0);
          require(true);
        }
      }`, options);
    const plan = (length: number): unknown => layer3.planCompiledGraph([
      { artifact: router, lockingBytecode: '51' },
      { artifact: dyn, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'route', args: [bytes(length, 0x41)] },
      { parent: 0, callee: 1, function: 'setNote', args: [bytes(length, 0x41)] },
    ]);
    expect(() => plan(202)).not.toThrow();
    expect(() => plan(203)).toThrow(/SCB1 blob is 224 bytes; maximum is 223/);
    // 202 bytes is two chunks. The region reserves 64, so the envelope binds 32x earlier than the region.
    expect(Math.ceil(202 / CHUNK)).toBe(2);
  }, 300_000);

  it('refuses a chunk run past the declared capacity before anything is signed', async () => {
    const built = await buildDynamicGraph({
      rows: [set(bytes(192, 0x53))], targets: [0], dynCount: 1,
      source: grownSource(40), finalValue: [bytes(192 * 40, 0x53)],
    });
    // Knob-liveness: the honest 64-slot run passes the same check that refuses 65.
    expect(() => layer3.assertGraphTrailingCapacity(built.layout, built.chunkRuns)).not.toThrow();
    expect(() => layer3.assertGraphTrailingCapacity(built.layout, { 1: 65 }))
      .toThrow(/runtime-resource run exceeds its balanced trailing capacity \(65 > 64\)/);
    // The router declares no region at all, so any run on it is refused rather than silently placed.
    expect(() => layer3.assertGraphTrailingCapacity(built.layout, { 0: 1 }))
      .toThrow(/its block declares no trailing region/);
    expect(() => layer3.assertGraphTrailingCapacity(built.layout, { 7: 1 }))
      .toThrow(/which this graph does not have/);
    expect(() => layer3.assertGraphTrailingCapacity(built.layout, { 1: 0 })).not.toThrow();
  }, 300_000);
});

describe('S3 read direction - pinned as NOT crossing the handler boundary', () => {
  /**
   * The write direction crosses handler boundaries; the read direction does not, and this pins where.
   *
   * A persisted read of an EMPTY value settles, including as a second row after a write - so the read is
   * reached and evaluated. A persisted read of a NON-EMPTY value fails closed in every assembly measured
   * (destroy-and-recreate chunks, read-only preserved chunks, write-and-read route, read-only route), while
   * the IDENTICAL read settles on the direct route. It is fail-closed and not a forgery: expecting the wrong
   * value is refused too, so nothing accepts a value that is not the state.
   *
   * The lead is that the bus route publishes `dynamicReads: undefined` for a read-only handler while still
   * declaring the 66-slot region - measured on `hiddenBatch.route` - so a composer has no published signal
   * that chunks must be co-spent. Both the route ABI and the read-loop lowering are outside this lease.
   */
  it('settles a read of an EMPTY value as the second row after a write', async () => {
    const built = await buildDynamicGraph({
      rows: [set(bytes(40, 0x48)), { fn: 'checkNote', value: new Uint8Array() }],
      targets: [0, 0], dynCount: 1, source: READ_WRITE,
    });
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('fails closed on a read of a NON-EMPTY persisted value', async () => {
    const built = await buildDynamicGraph({
      rows: [{ fn: 'checkNote', value: bytes(40, 0x4a) }],
      targets: [0], dynCount: 1, source: READ_WRITE,
      initial: [bytes(40, 0x4a)], finalValue: [bytes(40, 0x4a)],
    });
    expect(failingInput(built.builder)).toBe(INPUT.dynamic);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);

  it('refuses the same read with a wrong expectation, so the failure above is not a forgery', async () => {
    const built = await buildDynamicGraph({
      rows: [{ fn: 'checkNote', value: bytes(40, 0x4b) }],
      targets: [0], dynCount: 1, source: READ_WRITE,
      initial: [bytes(40, 0x4a)], finalValue: [bytes(40, 0x4a)],
    });
    expect(failingInput(built.builder)).toBe(INPUT.dynamic);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);
});
