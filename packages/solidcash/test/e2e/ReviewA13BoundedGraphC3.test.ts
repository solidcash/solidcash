import {
  type AuthenticationProgramStateCommon, binToHex, encodeTransaction, hexToBin, sha256,
} from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type { Utxo } from '../../src/interfaces.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Round-13 independent hostile review of C3's five ORIGINAL hostile cases (Worker C's, reshaped by Worker A).
// Worker A already found C3-R2 against `duplicate-owner` and C3-R3 against `omission`, so this file attacks
// the three that have never been attacked: `injection`, `injection-burned` and `disjoint-root`.
//
// WHY A THREE-PARTICIPANT CHAIN AND NOT C3's EIGHT. Every invariant these three cases attack lives in the two
// GENERATED covenants - `generateGraphRootController` and `generateGraphProjectionVerifier` - whose source is
// identical for any participant count between 1 and 8. Rebuilding eight participants would re-measure the
// capacity figure, not the invariant. The chain here is ROOT -> MID -> LEAF, one block slot each, so the
// physical map is masters 0/1/2, projections 3/4/5, controller 6, fee 7.
//
// THE INSTRUMENT is Worker C's, from round 11: `preflightLayer3Transaction` throws on the FIRST failing
// input, so a case that records one input index has NOT shown that that covenant refuses on its own. Every
// case below evaluates each input SEPARATELY on the same transaction.

const evaluateEachInput = (builder: TransactionBuilder): (string | null)[] => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs as never);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.map((_input, inputIndex) => {
    const state = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as AuthenticationProgramStateCommon;
    return state.error ?? null;
  });
};
/** Which inputs refused, by index, so an attribution claim is a measurement rather than an ordering argument. */
const refusingInputs = (builder: TransactionBuilder): number[] =>
  evaluateEachInput(builder).flatMap((error, index) => (error === null ? [] : [index]));

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const fixedUtxo = (slot: number, satoshis: bigint): Utxo => randomUtxo({
  satoshis, vout: 0, txid: slot.toString(16).padStart(2, '0').repeat(32),
});

const LEAF = `pragma solidcash >=0.8.0;
contract A13cLeaf(int brand) {
  function leaf(int n) public pure { require(n >= 0); }
}`;
const MID = `pragma solidcash >=0.8.0;
interface IA13cLeaf { function leaf(int n); }
contract A13cMid(int brand, address peer) {
  function mid(int n) public pure {
    IA13cLeaf(peer).leaf(n);
    require(n >= 0);
  }
}`;
const ROOT = `pragma solidcash >=0.8.0;
interface IA13cMid { function mid(int n); }
contract A13cRoot(int brand, address peer) {
  function go(int n) public pure {
    IA13cMid(peer).mid(n);
    require(n >= 0);
  }
}`;

/** Byte offsets of the invocation records, walked exactly as `finalizeCompiledGraph` encodes them. */
function invocationOffsets(bytes: Uint8Array): { parentStart: number; depthStart: number }[] {
  const u16 = (at: number): number => bytes[at] | (bytes[at + 1] << 8);
  const participantCount = bytes[9];
  let cursor = 10;
  for (let participant = 0; participant < participantCount; participant += 1) {
    cursor += 4; // participant input, block size
    cursor += 2 + u16(cursor); // locking bytecode
    cursor += 2 + u16(cursor); // batch frame
    cursor += 2 + u16(cursor); // emissions frame
    cursor += 2 + u16(cursor); // callers frame
    cursor += 2; // return output
    cursor += 2 + u16(cursor); // result vector
    cursor += 2; // projection input
  }
  const invocationCount = u16(cursor);
  cursor += 2;
  const records: { parentStart: number; depthStart: number }[] = [];
  for (let invocation = 0; invocation < invocationCount; invocation += 1) {
    records.push({ parentStart: cursor, depthStart: cursor + 4 });
    cursor += 12;
    cursor += 2 + u16(cursor); // args
    cursor += 2 + u16(cursor); // result
  }
  return records;
}

/** Length-preserving byte patches, then the RE-DERIVED root the controller is rooted with. */
function patchTranscript(
  transcript: layer3.FinalizedCompiledGraph, patches: readonly { at: number; bytes: Uint8Array }[],
): layer3.FinalizedCompiledGraph {
  const bytes = Uint8Array.from(transcript.bytes);
  for (const patch of patches) bytes.set(patch.bytes, patch.at);
  return { ...transcript, bytes, root: binToHex(sha256.hash(bytes)) } as layer3.FinalizedCompiledGraph;
}

type Injection = 'none' | 'appended' | 'appended-burned' | 'relocated';

interface GraphOverrides {
  injection?: Injection;
  patch?: (transcript: layer3.FinalizedCompiledGraph) => layer3.FinalizedCompiledGraph;
}

interface BuiltGraph {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  transcript: layer3.FinalizedCompiledGraph;
  honestTranscript: layer3.FinalizedCompiledGraph;
  controllerInput: number;
  projectionInputs: readonly number[];
}

async function buildGraph(overrides: GraphOverrides = {}): Promise<BuiltGraph> {
  const injection = overrides.injection ?? 'none';
  const provider = createLayer3SemanticTestProvider();
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

  const leafArtifact = compileString(LEAF, options);
  const baseLeaf = new Contract(leafArtifact, [9n], { provider });
  const setupLeaf = await setupStatefulUtxos(provider, baseLeaf, leafArtifact.stateLayout!, {});
  const leaf = baseLeaf.withCategory(hexToBin(setupLeaf.categoryId));

  const midArtifact = compileString(MID, options);
  const baseMid = new Contract(midArtifact, [7n, leaf.lockingBytecode], { provider });
  const setupMid = await setupStatefulUtxos(provider, baseMid, midArtifact.stateLayout!, {});
  const mid = baseMid.withCategory(hexToBin(setupMid.categoryId));

  const rootArtifact = compileString(ROOT, options);
  const baseRoot = new Contract(rootArtifact, [1n, mid.lockingBytecode], { provider });
  const setupRoot = await setupStatefulUtxos(provider, baseRoot, rootArtifact.stateLayout!, {});
  const root = baseRoot.withCategory(hexToBin(setupRoot.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: rootArtifact, lockingBytecode: root.lockingBytecode },
    { artifact: midArtifact, lockingBytecode: mid.lockingBytecode },
    { artifact: leafArtifact, lockingBytecode: leaf.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'go', args: [3n] },
    { parent: 0, callee: 1, function: 'mid', args: [3n] },
    { parent: 1, callee: 2, function: 'leaf', args: [3n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);

  // `relocated` inserts the injected pair immediately AFTER the participant region and BEFORE the proof
  // slots, and tells the transcript where everything really is. Every index the covenants read is then
  // self-consistent, and the controller's own `tx.inputs.length == activeInputIndex + 2` rule is SATISFIED.
  const shift = injection === 'relocated' ? 2 : 0;
  const projectionInputs = layout.projectionInputs.map((input) => input + shift);
  const controllerInput = layout.controllerInput + shift;

  const honestTranscript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
    plan.participants.map(() => ''), projectionInputs, '',
  );
  const transcript = overrides.patch ? overrides.patch(honestTranscript) : honestTranscript;

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const initFee = fixedUtxo(0xe1, 20_000n);
  await provider.addUtxo(p2pkh.address, initFee);
  const initialize = new TransactionBuilder({ provider });
  initialize.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  initialize.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
  initialize.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(initialize));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
  if (!rootedController) throw new Error('graph controller initialization did not create the authority');

  const projectionUtxos: Utxo[] = [];
  for (let slot = 0; slot < 3; slot += 1) {
    const utxo = fixedUtxo(0xa0 + slot, 1000n);
    await provider.addUtxo(projection.address, utxo);
    projectionUtxos.push(utxo);
  }
  const fee = fixedUtxo(0xe2, 150_000n);
  await provider.addUtxo(p2pkh.address, fee);
  const injectedUtxos: Utxo[] = [];
  if (injection !== 'none') {
    for (let slot = 0; slot < 2; slot += 1) {
      const utxo = fixedUtxo(0xb0 + slot, 5000n);
      await provider.addUtxo(p2pkh.address, utxo);
      injectedUtxos.push(utxo);
    }
  }

  const routeOf = (contract: Contract, artifact: any): any => contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const fund = (tx: TransactionBuilder, utxo: Utxo): void => {
    tx.addInput(utxo, p2pkh.unlock.spend(alicePub, signature()));
  };

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupRoot.masterUtxo, routeOf(root, rootArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, controllerInput) as any,
  ));
  tx.addInput(setupMid.masterUtxo, routeOf(mid, midArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, controllerInput) as any,
  ));
  tx.addInput(setupLeaf.masterUtxo, routeOf(leaf, leafArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 2, controllerInput) as any,
  ));
  if (injection === 'relocated') for (const utxo of injectedUtxos) fund(tx, utxo);
  for (let participant = 0; participant < 3; participant += 1) {
    tx.addInput(projectionUtxos[participant], projection.unlock.verify(
      transcript.bytes, BigInt(controllerInput), BigInt(participant),
    ));
  }
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  fund(tx, fee);
  if (injection === 'appended' || injection === 'appended-burned') {
    for (const utxo of injectedUtxos) fund(tx, utxo);
  }

  const master = (contract: Contract, setup: any): any => ({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
  });
  tx.addOutput(master(root, setupRoot));
  tx.addOutput(master(mid, setupMid));
  tx.addOutput(master(leaf, setupLeaf));
  if (injection === 'relocated') for (const utxo of injectedUtxos) tx.addOutput({ to: p2pkh.address, amount: utxo.satoshis - 500n });
  for (let slot = 0; slot < 4; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 60_000n });
  if (injection === 'appended' || injection === 'appended-burned') {
    for (const utxo of injectedUtxos) tx.addOutput({ to: p2pkh.address, amount: utxo.satoshis - 500n });
  }

  return {
    provider,
    builder: tx,
    transaction: raw(tx),
    transcript,
    honestTranscript,
    controllerInput,
    projectionInputs,
  };
}

const MAP = { root: 0, mid: 1, leaf: 2 } as const;

describe('A13 review of C3: injection', () => {
  it('A13-6a: honest control - three participants settle and every input passes on its own', async () => {
    const built = await buildGraph();
    expect(built.controllerInput).toBe(6);
    expect([...built.projectionInputs]).toEqual([3, 4, 5]);
    expect(refusingInputs(built.builder)).toEqual([]);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  it('A13-6b: an APPENDED extra input/output pair is refused, and by the controller ALONE', async () => {
    // C3's `injection` and `injection-burned` both append the extra block after the fee slot and read the
    // refusal off `preflightLayer3Transaction`, which stops at the first failing input. Isolated, exactly
    // one covenant objects: the controller's `tx.inputs.length == this.activeInputIndex + 2`.
    const built = await buildGraph({ injection: 'appended' });
    expect(built.builder.inputs).toHaveLength(10);
    expect(refusingInputs(built.builder)).toEqual([built.controllerInput]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 180_000);

  it('A13-6c: FINDING - the pair RELOCATED inside the transaction defeats that rule, and is refused by a '
    + 'DIFFERENT one', async () => {
    // The stronger attacker C3 never built. The extra pair sits between the participant region and the proof
    // slots, and the transcript names the shifted proof/controller indices, so every index a covenant reads
    // is self-consistent and the input-count rule the two committed injection cases rely on is SATISFIED:
    // controller at 8, 10 inputs, 8 + 2 == 10.
    const built = await buildGraph({ injection: 'relocated' });
    expect(built.builder.inputs).toHaveLength(10);
    expect(built.controllerInput).toBe(8);
    expect([...built.projectionInputs]).toEqual([5, 6, 7]);
    expect(built.builder.inputs.length).toBe(built.controllerInput + 2);
    // What refuses instead is the controller's region-adjacency pair, which the committed cases never
    // exercise: `previousProjectionInput + 1 - participantCount == expectedInput` (7 + 1 - 3 = 5, not 3)
    // and `this.activeInputIndex == expectedInput + participantCount` (8, not 6). This case does not
    // separate the two; it establishes that the input-count rule is NOT what refuses this placement.
    expect(refusingInputs(built.builder)).toEqual([built.controllerInput]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 180_000);

  it('A13-6d: SCOPE - no PROJECTION proof refuses either injection, on either placement', async () => {
    // C3's injection note credits "the graph table's exhaustiveness". Measured, exhaustiveness over the
    // whole transaction is enforced by the CONTROLLER only: no participant route and no projection proof
    // objects to either placement, on the same transaction the controller refuses.
    for (const injection of ['appended', 'appended-burned', 'relocated'] as const) {
      const built = await buildGraph({ injection });
      const refusing = refusingInputs(built.builder);
      expect({ injection, refusing }).toEqual({ injection, refusing: [built.controllerInput] });
    }
  }, 300_000);
});

describe('A13 review of C3: disjoint-root', () => {
  it('A13-7a: the three-byte re-rooting is refused - and by EVERY projection proof plus the controller',
    async () => {
      // C3 reproduces this with `preflightLayer3Transaction` and records "input 98, the first graph
      // projection proof". Isolated: all three proofs refuse and so does the controller, because both
      // covenants carry the same `invocation != 0 => depth >= 1` rule. The first proof is where preflight
      // stops, not where the rule lives.
      const built = await buildGraph({
        patch: (transcript) => {
          const record = invocationOffsets(transcript.bytes)[2];
          return patchTranscript(transcript, [
            { at: record.parentStart, bytes: Uint8Array.of(0xff, 0xff) },
            { at: record.depthStart, bytes: Uint8Array.of(0) },
          ]);
        },
      });
      expect(refusingInputs(built.builder)).toEqual([3, 4, 5, 6]);
      await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
    }, 180_000);

  it('A13-7b: FINDING - re-rooting by the PARENT FIELD ALONE leaves every projection proof satisfied',
    async () => {
      // The same edge re-presented as parentless, without touching its depth. One byte pair, not three.
      // The projection verifier never reads the parent field for a non-zero invocation - it derives the
      // caller from `activeCallees[depth]` - so it accepts, and the depth-dispatch mechanism C3's note
      // credits does not apply. Only the controller's `parent < invocation` refuses.
      const built = await buildGraph({
        patch: (transcript) => {
          const record = invocationOffsets(transcript.bytes)[2];
          return patchTranscript(transcript, [
            { at: record.parentStart, bytes: Uint8Array.of(0xff, 0xff) },
          ]);
        },
      });
      expect(refusingInputs(built.builder)).toEqual([built.controllerInput]);
      await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
    }, 180_000);

  it('A13-7c: and a FORWARD parent, and a self-parent, are refused the same way', async () => {
    // Two more structural forgeries the committed case does not cover. Both keep depth honest.
    for (const [name, parent] of [['forward', 2], ['self', 1]] as const) {
      const built = await buildGraph({
        patch: (transcript) => {
          const record = invocationOffsets(transcript.bytes)[1];
          return patchTranscript(transcript, [
            { at: record.parentStart, bytes: Uint8Array.of(parent & 0xff, (parent >>> 8) & 0xff) },
          ]);
        },
      });
      expect({ name, refusing: refusingInputs(built.builder) })
        .toEqual({ name, refusing: [built.controllerInput] });
    }
  }, 300_000);
});

describe('A13 review of C3: what the participant routes bind', () => {
  it('A13-8: MAP - the honest control names the physical positions this file asserts against', async () => {
    const built = await buildGraph();
    expect(Object.values(MAP)).toEqual([0, 1, 2]);
    expect(built.transcript.participantInputs).toEqual([0, 1, 2]);
    expect(built.transcript.bytes.length).toBe(built.honestTranscript.bytes.length);
  }, 180_000);
});
