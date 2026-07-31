import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import type { Utxo } from '../../src/interfaces.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// E4 - VM semantics of the admitted context values.
//
// `Layer3ContextMatrixE4.test.ts` pins WHICH context values a route admits and the single diagnostic used to
// refuse the rest. This file pins WHAT the admitted ones evaluate to, by executing the same handler source
// twice: once at its own entry point (the direct route, the semantic reference) and once inside a graph
// route, with the same predicate over the context value in both.
//
// Measured outcome per row:
//
//   this.activeInputIndex  EQUIVALENT. Both read the real index of the input running the handler. Proven by
//                          passing 0 directly and 1 in the graph, where the child participant's master input
//                          really is index 1 - the same predicate accepts both because the value follows the
//                          transaction, not the mode.
//   msg.sig                EQUIVALENT. Direct mode emits `currentFunction.functionSelector` as a compile-time
//                          constant; graph mode parses `rowSelector` out of the authenticated batch blob.
//                          Proven by requiring the SAME 4-byte value in both.
//   msg.sender             LOGICAL, and deliberately so. Direct mode resolves tx.origin: the first spendable
//                          non-token P2PKH input. Graph mode resolves the transcript-authenticated logical
//                          caller, which for a nested invocation is the PARENT PARTICIPANT's locking
//                          bytecode - a nested handler must see the participant that called it, not the human
//                          who funded the transaction. Two hostile cases below pin that: telling the child to
//                          expect itself, and telling it to expect the direct-mode answer, both reject.
//                          For the ROOT invocation the projection verifier admits an EMPTY caller frame or a
//                          non-empty one equal to tx.origin, and a third hostile case shows a forged
//                          non-empty root caller rejecting. NOT proven here: that a root handler READING
//                          msg.sender receives tx.origin. These fixtures fund from the repository's P2PKH
//                          artifact, which is a P2SH contract rather than a bare P2PKH script, so no input
//                          satisfies the tx.origin scan and the positive root-equality case could not be
//                          constructed. That row is open.
//   msg.data               LOGICAL. Direct mode reconstructs the unlocking bytecode minus the redeem-script
//                          push: push-framed arguments, not an ABI encoding. Graph mode constructs
//                          `rowSelector ++ rowArgs` from the authenticated batch row, which is the ABI form.
//                          The graph side of the pair is the committed controller fixture
//                          (`Layer3CompiledGraphController.test.ts`, `inspectData`, which requires
//                          `msg.data == abi.encodeWithSelector(msg.sig, n)` and settles). The direct side is
//                          measured at the bottom of this file: the identical predicate is rejected.
const CHILD = `pragma solidcash >=0.8.0;
contract CtxChild(int brand) {
  function observe(int n, int expectedIndex, bytes4 expectedSig, address expectedSender) public pure {
    require(this.activeInputIndex == expectedIndex);
    require(msg.sig == expectedSig);
    require(msg.sender == expectedSender);
    require(n >= 0);
  }
}`;

// Byte-identical signature to CHILD, so it publishes the SAME selector, with the one divergent predicate
// replaced by a tautology. `msg.sender` cannot be part of the direct arm: it is the LOGICAL row, and the
// direct definition (tx.origin) has no counterpart to compare against inside a graph.
const CHILD_EQUIVALENCE_ONLY = `pragma solidcash >=0.8.0;
contract CtxChild(int brand) {
  function observe(int n, int expectedIndex, bytes4 expectedSig, address expectedSender) public pure {
    require(this.activeInputIndex == expectedIndex);
    require(msg.sig == expectedSig);
    require(expectedSender.length >= 0);
    require(n >= 0);
  }
}`;

const ROOT = `pragma solidcash >=0.8.0;
interface ICtxChild {
  function observe(int n, int expectedIndex, bytes4 expectedSig, address expectedSender);
}
contract CtxRoot(int brand, address peer) {
  function go(int n, int expectedIndex, bytes4 expectedSig, address expectedSender) public pure {
    ICtxChild(peer).observe(n, expectedIndex, expectedSig, expectedSender);
    require(n >= 0);
  }
}`;

const DATA_PROBE = `pragma solidcash >=0.8.0;
contract CtxData(int brand) {
  function inspect(int n) public pure {
    require(msg.data == abi.encodeWithSelector(msg.sig, n));
    require(n >= 0);
  }
}`;

const N = 3n;
const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const fixedUtxo = (slot: number, satoshis: bigint): Utxo => randomUtxo({
  satoshis, vout: 0, txid: slot.toString(16).padStart(2, '0').repeat(32),
});
/** Alice's P2PKH locking bytecode: what direct-mode `msg.sender` and graph `tx.origin` both resolve to. */
const aliceLockingBytecode = (provider: any): string =>
  new Contract(p2pkhArtifact, [alicePkh], { provider }).lockingBytecode;

interface ContextOverrides {
  /** Locking bytecode the transcript claims called the root. Honest value is Alice's P2PKH. */
  rootCaller?: string;
  /** Locking bytecode the child handler is told to expect as its `msg.sender`. */
  childExpectedSender?: 'parent' | 'self' | 'origin';
}

async function buildContextGraph(overrides: ContextOverrides = {}): Promise<{
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
}> {
  const provider = createLayer3SemanticTestProvider();
  const projection = new Contract(
    compileString(layer3.generateGraphProjectionVerifier()), [], { provider },
  );
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

  const artifactChild = compileString(CHILD, options);
  const baseChild = new Contract(artifactChild, [7n], { provider });
  const setupChild = await setupStatefulUtxos(provider, baseChild, artifactChild.stateLayout!, {});
  const child = baseChild.withCategory(hexToBin(setupChild.categoryId));

  const artifactRoot = compileString(ROOT, options);
  const baseRoot = new Contract(artifactRoot, [1n, child.lockingBytecode], { provider });
  const setupRoot = await setupStatefulUtxos(provider, baseRoot, artifactRoot.stateLayout!, {});
  const root = baseRoot.withCategory(hexToBin(setupRoot.categoryId));

  const origin = aliceLockingBytecode(provider);
  // The honest root caller frame is EMPTY: the projection verifier accepts a zero-length root caller, or a
  // non-empty one only when it equals the transaction origin.
  const rootCaller = overrides.rootCaller ?? '';
  const childSender = overrides.childExpectedSender === 'self'
    ? child.lockingBytecode
    : overrides.childExpectedSender === 'origin' ? origin : root.lockingBytecode;
  // Both blocks are one slot wide: neither handler writes state, returns a value, or emits.
  const CHILD_MASTER_INPUT = 1n;
  const childSelector = hexToBin(
    artifactChild.hiddenBatch!.handlers.find((handler) => handler.name === 'observe')!.selector,
  );
  const childArgs = [N, CHILD_MASTER_INPUT, childSelector, childSender];

  const plan = layer3.planCompiledGraph([
    { artifact: artifactRoot, lockingBytecode: root.lockingBytecode },
    { artifact: artifactChild, lockingBytecode: child.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'go', args: childArgs },
    { parent: 0, callee: 1, function: 'observe', args: childArgs },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
    plan.participants.map(() => ''), layout.projectionInputs, rootCaller,
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

  const fee = fixedUtxo(0xe2, 120_000n);
  await provider.addUtxo(p2pkh.address, fee);
  const projectionUtxos: Utxo[] = [];
  for (let slot = 0; slot < 2; slot += 1) {
    const utxo = fixedUtxo(0xa0 + slot, 1000n);
    await provider.addUtxo(projection.address, utxo);
    projectionUtxos.push(utxo);
  }

  const routeOf = (
    contract: Contract, artifact: typeof artifactRoot,
  ): ReturnType<Contract['createCompilerRouteUnlocker']> => contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupRoot.masterUtxo, routeOf(root, artifactRoot)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  tx.addInput(setupChild.masterUtxo, routeOf(child, artifactChild)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  for (let participant = 0; participant < 2; participant += 1) {
    tx.addInput(projectionUtxos[participant], projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ));
  }
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const master = (contract: Contract, setup: any): any => ({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
  });
  tx.addOutput(master(root, setupRoot));
  tx.addOutput(master(child, setupChild));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 40_000n });

  return { provider, builder: tx, transaction: raw(tx) };
}

// Physical input map of the two-participant context graph.
const INPUT = {
  masterRoot: 0, masterChild: 1, projectionRoot: 2, projectionChild: 3, controller: 4,
} as const;
const CHILD_REFUSAL =
  /mandatory-script-verify-flag-failed[\s\S]*evaluating input index 1: Program failed an OP_VERIFY operation/;
const ROOT_PROJECTION_REFUSAL =
  /mandatory-script-verify-flag-failed[\s\S]*evaluating input index 2: Program failed an OP_VERIFY operation/;

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

/** Run one source's handler at its own entry point, which is the semantic reference for every row. */
async function runDirect(
  source: string, unlock: (contract: Contract, origin: string) => any,
): Promise<{ provider: ReturnType<typeof createLayer3SemanticTestProvider>; transaction: string }> {
  const provider = createLayer3SemanticTestProvider();
  const contract = new Contract(compileString(source), [7n], { provider });
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const held = fixedUtxo(0xd1, 10_000n);
  const fee = fixedUtxo(0xd2, 20_000n);
  await provider.addUtxo(contract.address, held);
  await provider.addUtxo(p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(held, unlock(contract, aliceLockingBytecode(provider)));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({ to: p2pkh.address, amount: 25_000n });
  return { provider, transaction: raw(tx) };
}

describe('E4: admitted context values on the BCH-2026 VM', () => {
  it('honest control: a graph handler sees its own input index, its selector, and its caller', async () => {
    const built = await buildContextGraph();
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 120_000);

  it('the same source at its own entry point agrees on activeInputIndex and msg.sig', async () => {
    // EQUIVALENCE for `this.activeInputIndex` and `msg.sig`. The predicate and the expected selector are
    // identical to the graph arm; only the expected index changes, from 1 to 0, because the direct
    // transaction really does run the handler at input 0. The selector value is read out of the GRAPH
    // artifact, so a direct/graph selector disagreement would fail here.
    const graphSelector = compileString(CHILD, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    }).hiddenBatch!.handlers.find((handler) => handler.name === 'observe')!.selector;
    const built = await runDirect(CHILD_EQUIVALENCE_ONLY, (contract, origin) =>
      contract.unlock.observe(N, 0n, hexToBin(graphSelector), origin));
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 120_000);

  it('rejects a graph handler told to expect a caller other than its authenticated parent', async () => {
    // Attacks: the per-invocation logical caller in the transcript's caller frame for the child. Honest
    // control above differs only in this field.
    const built = await buildContextGraph({ childExpectedSender: 'self' });
    expect(failingInput(built.builder)).toBe(INPUT.masterChild);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(CHILD_REFUSAL);
  }, 120_000);

  it('rejects a graph handler told its caller is tx.origin rather than its parent participant', async () => {
    // Attacks: the same field with the value a direct-mode reader would expect. This is the row that makes
    // msg.sender LOGICAL rather than EQUIVALENT: a nested handler cannot see the funder.
    const built = await buildContextGraph({ childExpectedSender: 'origin' });
    expect(failingInput(built.builder)).toBe(INPUT.masterChild);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(CHILD_REFUSAL);
  }, 120_000);

  it('rejects a root logical caller which is not the transaction origin', async () => {
    // Attacks: the ROOT invocation's caller frame. The root's caller is the one place the graph and direct
    // definitions must agree, and the projection verifier pins it: `logicalCallerLength == 0 ||
    // logicalCaller == tx.origin`. The honest control leaves that frame empty and takes the first branch;
    // this case supplies a well-formed P2PKH script that is not the origin. The root handler does not read
    // msg.sender in this fixture, so nothing in the root's own route can be credited with the rejection.
    const built = await buildContextGraph({ rootCaller: `76a914${'ab'.repeat(20)}88ac` });
    expect(failingInput(built.builder)).toBe(INPUT.projectionRoot);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(ROOT_PROJECTION_REFUSAL);
  }, 120_000);

  it('measures msg.data: the ABI form holds in a graph route and not at the entry point', async () => {
    // The `msg.data == abi.encodeWithSelector(msg.sig, n)` identity is already proven for a graph route by
    // the committed controller fixture. At its own entry point the same predicate fails, because direct
    // msg.data is the unlocking bytecode minus the redeem-script push - push-framed arguments, not an ABI
    // encoding. So msg.data is LOGICAL, not EQUIVALENT, and this is the measurement that says so.
    const built = await runDirect(DATA_PROBE, (contract) => contract.unlock.inspect(N));
    // A covenant rejection at the contract input, not a builder or assembly error.
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow('error in evaluating input index 0');
  }, 120_000);
});
