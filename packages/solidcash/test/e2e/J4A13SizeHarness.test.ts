import {
  type AuthenticationProgramStateCommon, binToHex, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type { Utxo } from '../../src/interfaces.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  createLayer3SemanticTestProvider, dustOutputs, formatDustOutputs,
} from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  assessEnvelope, densityKnobControl, formatEnvelope, knobControlBudgetFor,
} from './layer3-envelope-f1.js';

// J4 MEASUREMENT HARNESS, NOT A GUARD. A13's serialized size is printed by NO committed fixture on the mock
// stack: `ReviewA13BoundedGraphC3.test.ts` prints it only inside its `TESTS_USE_REGTEST` node block, so the
// 22,195-byte figure in the review guide's envelope table cannot be re-derived without a live BCHN node.
//
// The builder below is a VERBATIM copy of that file's `buildGraph` on its honest path (`injection: 'none'`, no
// transcript patch), which is file-local by design. Copying it rather than exporting it keeps the leased file
// untouched. Fidelity is not assumed: this asserts the same four invariants A13-6a asserts - controller at
// input 6, projections at [3, 4, 5], every input passing on its own, no dust output - so a transcription error
// shows up as a failing invariant rather than as a wrong byte count.

const evaluateEachInput = (builder: TransactionBuilder): (string | null)[] => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs as never);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.map((_input, inputIndex) => {
    const state = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as AuthenticationProgramStateCommon;
    return state.error ?? null;
  });
};
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

type GraphProvider = ReturnType<typeof createTestProvider>;

interface BuiltGraph {
  provider: GraphProvider;
  builder: TransactionBuilder;
  transaction: string;
  transcript: layer3.FinalizedCompiledGraph;
  controllerInput: number;
  projectionInputs: readonly number[];
  projectionRedeemBytes: number;
  controllerRedeemBytes: number;
}

async function buildGraph(
  createProvider: () => GraphProvider = createLayer3SemanticTestProvider,
): Promise<BuiltGraph> {
  const provider = createProvider();
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

  const projectionInputs = layout.projectionInputs.map((input) => input);
  const controllerInput = layout.controllerInput;

  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
    plan.participants.map(() => ''), projectionInputs, '',
  );

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
  for (let participant = 0; participant < 3; participant += 1) {
    tx.addInput(projectionUtxos[participant], projection.unlock.verify(
      transcript.bytes, BigInt(controllerInput), BigInt(participant),
    ));
  }
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  fund(tx, fee);

  const master = (contract: Contract, setup: any): any => ({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
  });
  tx.addOutput(master(root, setupRoot));
  tx.addOutput(master(mid, setupMid));
  tx.addOutput(master(leaf, setupLeaf));
  for (let slot = 0; slot < 4; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 60_000n });

  return {
    provider,
    builder: tx,
    transaction: raw(tx),
    transcript,
    controllerInput,
    projectionInputs,
    projectionRedeemBytes: projection.bytecode.length / 2,
    controllerRedeemBytes: controller.bytecode.length / 2,
  };
}

describe('J4: A13 serialized size on the mock stack', () => {
  it('MEASURED: the three-participant honest graph, with A13-6a\'s invariants as the fidelity check', async () => {
    const built = await buildGraph();

    // Fidelity, asserted before the figure is reported.
    expect(built.controllerInput).toBe(6);
    expect([...built.projectionInputs]).toEqual([3, 4, 5]);
    expect(refusingInputs(built.builder)).toEqual([]);
    expect(formatDustOutputs(dustOutputs(built.builder.buildLibauthTransaction()))).toBe('no dust outputs');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');

    const serialized = built.transaction.length / 2;
    const libauth = built.builder.buildLibauthTransaction();
    const inputBytes = (built.builder.inputs as any[]).map((_input, index) =>
      libauth.inputs[index].unlockingBytecode.length);
    // eslint-disable-next-line no-console
    console.log(`[J4] A13 serialized transaction size: ${serialized} bytes; ${libauth.inputs.length} inputs; `
      + `worst unlocking script ${Math.max(...inputBytes)} B; per-input bytes ${inputBytes.join(',')}`);
    // eslint-disable-next-line no-console
    console.log(`[J4] A13 deployed covenants: projection ${built.projectionRedeemBytes} B, `
      + `controller ${built.controllerRedeemBytes} B`);

    // THE BINDING LIMIT, MEASURED RATHER THAN INFERRED. `assessEnvelope` sorts every real BCH-2026 limit by
    // utilization, so `binding[0]` IS "what binds first" - the board's table claims `script bytes` for A13.
    const sourceOutputs = generateLibauthSourceOutputs(built.builder.inputs as never);
    const envelope = assessEnvelope('A13 graph', libauth as never, sourceOutputs as never);
    // eslint-disable-next-line no-console
    console.log(`[J4] ${formatEnvelope(envelope)}`);
    // eslint-disable-next-line no-console
    console.log(`[J4] A13 binding order: ${envelope.binding.slice(0, 5)
      .map((row) => `${row.limit}=${row.ratio.toFixed(4)}x@${row.where}`).join(' | ')}`);

    // KNOB-LIVENESS CONTROL (rule 2). The same bytes, the same source outputs, at half the density the worst
    // input was measured to need: it must be refused, or "inside capacity" proves only that nothing ran.
    const budget = knobControlBudgetFor(envelope.worstCostInput);
    const control = densityKnobControl(
      libauth as never, sourceOutputs as never, envelope.worstCostInput.input, budget,
    );
    // eslint-disable-next-line no-console
    console.log(`[J4] A13 knob-liveness control at ${budget}/byte on input `
      + `${envelope.worstCostInput.input}: ${control ?? 'ACCEPTED (control is DEAD)'}`);
    expect(control).toMatch(/operation cost|density/i);
    expect(envelope.refusedAtConsensus).toEqual([]);
    expect(envelope.refusedAtStandard).toEqual([]);
    expect(serialized).toBeGreaterThan(0);
  }, 300_000);
});
