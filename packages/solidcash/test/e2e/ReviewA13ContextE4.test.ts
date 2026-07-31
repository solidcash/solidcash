import {
  type AuthenticationProgramStateCommon, binToHex, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type { Utxo } from '../../src/interfaces.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { aliceAddress, alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const invalidSenderSplitAt = (input: number, length: number): RegExp => new RegExp(
  '^mandatory-script-verify-flag-failed '
  + `\\(Unable to verify transaction: error in evaluating input index ${input}: `
  + 'Program called an OP_SPLIT operation with an invalid index\\. '
  + `stack item length: ${length}; requested split index: 83\\.\\)$`,
);

// Round-13 independent hostile review of E4 (Worker B's). I implemented none of it.
//
// THE FIXTURE. One THREE-participant chain ROOT -> MID -> LEAF, so all three positions a graph handler can
// occupy exist in ONE transaction and differ only in position:
//
//   ROOT  invocation 0, no parent, makes one outgoing call
//   MID   invocation 1, has an authenticated parent AND makes one outgoing call  (an EMISSION handler)
//   LEAF  invocation 2, has an authenticated parent, makes no outgoing call
//
// E4's own committed fixture has only the ROOT and LEAF positions. Worker C's round-11 review corrected E4's
// recorded reason for its one open row and stated it had NOT determined whether a non-root emission handler
// has the same failure. That is what MID is here for.
//
// Every handler is one block slot wide: none writes state, returns a value, or emits an event.

const evaluateEachInput = (builder: TransactionBuilder): (string | null)[] => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs as never);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.map((_input, inputIndex) => {
    const state = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as AuthenticationProgramStateCommon;
    return state.error ?? null;
  });
};

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const fixedUtxo = (slot: number, satoshis: bigint): Utxo => randomUtxo({
  satoshis, vout: 0, txid: slot.toString(16).padStart(2, '0').repeat(32),
});
/** The 25-byte P2PKH script `tx.origin` scans for. */
const bareP2pkhLbc = (pkh: Uint8Array): string => `76a914${binToHex(pkh)}88ac`;

// --- sources. Every arm is its control with ONE token replaced. ---------------------------------------------

const PREDICATE = 'require(expectedSender.length >= 0);';

const LEAF_PLAIN = `pragma solidcash >=0.8.0;
contract A13Leaf(int brand) {
  function leaf(int n, address expectedSender) public pure {
    ${PREDICATE}
    require(n >= 0);
  }
}`;

const MID_PLAIN = `pragma solidcash >=0.8.0;
interface IA13Leaf { function leaf(int n, address expectedSender); }
contract A13Mid(int brand, address peer) {
  function mid(int n, address expectedSender) public pure {
    ${PREDICATE}
    IA13Leaf(peer).leaf(n, expectedSender);
    require(n >= 0);
  }
}`;

const ROOT_PLAIN = `pragma solidcash >=0.8.0;
interface IA13Mid { function mid(int n, address expectedSender); }
contract A13Root(int brand, address peer) {
  function go(int n, address expectedSender) public pure {
    ${PREDICATE}
    IA13Mid(peer).mid(n, expectedSender);
    require(n >= 0);
  }
}`;

/** A tautology over msg.sender: no VALUE of msg.sender can be the reason such an arm is refused. */
const readsSender = (source: string): string =>
  source.replace(PREDICATE, 'require(msg.sender.length >= 0);');
/** The real semantics: the handler compares its logical caller to what the row told it to expect. */
const checksSender = (source: string): string =>
  source.replace(PREDICATE, 'require(msg.sender == expectedSender);');
/** Any other context value, consumed in a require so no pass can eliminate it. */
const reads = (source: string, predicate: string): string => source.replace(PREDICATE, predicate);

interface ChainOverrides {
  /** `bare` funds the fee slot from a real 25-byte P2PKH; `p2sh` funds it from the repo's P2SH artifact. */
  origin?: 'bare' | 'p2sh';
  rootCaller?: string;
  /** The `expectedSender` argument every row carries. */
  expected?: 'root' | 'mid' | 'leaf' | 'origin';
}

interface BuiltChain {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  lbc: Readonly<Record<'root' | 'mid' | 'leaf' | 'origin', string>>;
}

async function buildChain(
  rootSource: string, midSource: string, leafSource: string, overrides: ChainOverrides = {},
): Promise<BuiltChain> {
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

  const leafArtifact = compileString(leafSource, options);
  const baseLeaf = new Contract(leafArtifact, [9n], { provider });
  const setupLeaf = await setupStatefulUtxos(provider, baseLeaf, leafArtifact.stateLayout!, {});
  const leaf = baseLeaf.withCategory(hexToBin(setupLeaf.categoryId));

  const midArtifact = compileString(midSource, options);
  const baseMid = new Contract(midArtifact, [7n, leaf.lockingBytecode], { provider });
  const setupMid = await setupStatefulUtxos(provider, baseMid, midArtifact.stateLayout!, {});
  const mid = baseMid.withCategory(hexToBin(setupMid.categoryId));

  const rootArtifact = compileString(rootSource, options);
  const baseRoot = new Contract(rootArtifact, [1n, mid.lockingBytecode], { provider });
  const setupRoot = await setupStatefulUtxos(provider, baseRoot, rootArtifact.stateLayout!, {});
  const root = baseRoot.withCategory(hexToBin(setupRoot.categoryId));

  const lbc = {
    root: root.lockingBytecode as string,
    mid: mid.lockingBytecode as string,
    leaf: leaf.lockingBytecode as string,
    origin: bareP2pkhLbc(alicePkh),
  };
  const expected = hexToBin(lbc[overrides.expected ?? 'root']);

  const plan = layer3.planCompiledGraph([
    { artifact: rootArtifact, lockingBytecode: root.lockingBytecode },
    { artifact: midArtifact, lockingBytecode: mid.lockingBytecode },
    { artifact: leafArtifact, lockingBytecode: leaf.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'go', args: [3n, expected] },
    { parent: 0, callee: 1, function: 'mid', args: [3n, expected] },
    { parent: 1, callee: 2, function: 'leaf', args: [3n, expected] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
    plan.participants.map(() => ''), layout.projectionInputs, overrides.rootCaller ?? '',
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
  const bareOrigin = (overrides.origin ?? 'bare') === 'bare';
  await provider.addUtxo(bareOrigin ? aliceAddress : p2pkh.address, fee);

  const routeOf = (contract: Contract, artifact: any): any => contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupRoot.masterUtxo, routeOf(root, rootArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  tx.addInput(setupMid.masterUtxo, routeOf(mid, midArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  tx.addInput(setupLeaf.masterUtxo, routeOf(leaf, leafArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any,
  ));
  for (let participant = 0; participant < 3; participant += 1) {
    tx.addInput(projectionUtxos[participant], projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ));
  }
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, bareOrigin ? signature().unlockP2PKH() : p2pkh.unlock.spend(alicePub, signature()));

  const master = (contract: Contract, setup: any): any => ({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
  });
  tx.addOutput(master(root, setupRoot));
  tx.addOutput(master(mid, setupMid));
  tx.addOutput(master(leaf, setupLeaf));
  for (let slot = 0; slot < 4; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 60_000n });

  return { provider, builder: tx, transaction: raw(tx), lbc: Object.freeze(lbc) };
}

const CHAIN = { root: 0, mid: 1, leaf: 2, projectionRoot: 3, controller: 6, fee: 7 } as const;
const HONEST_ROOT_CALLER = bareP2pkhLbc(alicePkh);

describe('A13 review of E4: the open row, reproduced independently', () => {
  it('A13-3a: honest control - the chain settles and EVERY input passes on its own', async () => {
    const built = await buildChain(ROOT_PLAIN, MID_PLAIN, LEAF_PLAIN, { rootCaller: HONEST_ROOT_CALLER });
    expect(evaluateEachInput(built.builder)).toEqual(new Array(8).fill(null));
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 120_000);

  it("A13-3b: C's correction reproduced - a ROOT handler READING msg.sender cannot execute", async () => {
    // One token differs from the control, and a real 25-byte origin is present in both the caller frame and
    // the fee slot, so "no origin exists" cannot be the reason.
    const built = await buildChain(readsSender(ROOT_PLAIN), MID_PLAIN, LEAF_PLAIN, {
      rootCaller: HONEST_ROOT_CALLER,
    });
    const results = evaluateEachInput(built.builder);
    expect(results[CHAIN.root]).toMatch(/OP_SPLIT operation with an invalid index/);
    expect(results[CHAIN.root]).toMatch(/stack item length: 25/);
    // Only the root's own route refuses. Nothing else on the transaction objects to the caller frame.
    expect(results.filter((_result, index) => index !== CHAIN.root)).toEqual(new Array(7).fill(null));
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(invalidSenderSplitAt(CHAIN.root, 25));
  }, 120_000);
});

describe('A13 review of E4: the row C did not determine - a NON-ROOT EMISSION handler', () => {
  it('A13-4a: the LEAF position is fine - a non-root handler with no outgoing call reads its parent',
    async () => {
      // This is E4's own committed shape, re-established inside this fixture as the positive control: a
      // non-root handler CAN read msg.sender, and the value is its authenticated parent (the MID).
      const built = await buildChain(ROOT_PLAIN, MID_PLAIN, checksSender(LEAF_PLAIN), {
        rootCaller: HONEST_ROOT_CALLER, expected: 'mid',
      });
      expect(evaluateEachInput(built.builder)).toEqual(new Array(8).fill(null));
      await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
    }, 120_000);

  it('A13-4b: FINDING - the MID position is NOT. An emission handler reading msg.sender cannot execute',
    async () => {
      // Same tautology, same transaction shape, same fixture, one position up the chain: the only difference
      // from A13-4a is that this handler also makes an outgoing call.
      const built = await buildChain(ROOT_PLAIN, readsSender(MID_PLAIN), LEAF_PLAIN, {
        rootCaller: HONEST_ROOT_CALLER,
      });
      const results = evaluateEachInput(built.builder);
      expect(results[CHAIN.mid]).toMatch(/OP_SPLIT operation with an invalid index/);
      // The split operand is 35 bytes - exactly one participant locking bytecode - and the requested index
      // is past its end. Same defect class as the root's "stack item length: 25".
      expect(results[CHAIN.mid]).toMatch(/stack item length: 35/);
      expect(results.filter((_result, index) => index !== CHAIN.mid)).toEqual(new Array(7).fill(null));
      await expect(built.provider.sendRawTransaction(built.transaction))
        .rejects.toThrow(invalidSenderSplitAt(CHAIN.mid, 35));
    }, 120_000);

  it('A13-4c: and the comparison spelling does not resolve to ANY participant either', async () => {
    // `msg.sender == x` does not crash - it compares - so it could in principle have silently resolved to
    // the wrong principal, which would be a live authorization escape rather than a fail-closed defect.
    // Driving every locking bytecode in the transaction through `expectedSender` shows it resolves to none
    // of them: the emission handler's msg.sender is fail-closed, not silently wrong.
    for (const expected of ['root', 'mid', 'leaf', 'origin'] as const) {
      const built = await buildChain(ROOT_PLAIN, checksSender(MID_PLAIN), LEAF_PLAIN, {
        rootCaller: HONEST_ROOT_CALLER, expected,
      });
      expect(evaluateEachInput(built.builder)[CHAIN.mid]).toMatch(/OP_VERIFY/);
    }
  }, 300_000);
});

describe('A13 review of E4: EQUIVALENT rows at the emission-handler position', () => {
  // The committed matrix test reads `handler.eligible` only: it proves which context values COMPILE into a
  // route, not what they evaluate to. Of the rows it calls EQUIVALENT, exactly two - activeInputIndex and
  // msg.sig - have a VM measurement, and both were taken where the handler makes no outgoing call. These
  // drive the same rows at the MID, which is the position the published matrix never measures.
  //
  // Each row runs the SAME predicate TWICE inside the same three-participant chain: once at the LEAF (no
  // outgoing call - the position E4 measures) and once at the MID (one outgoing call - the position it does
  // not). The two arms differ in nothing but which contract carries the predicate, so a row that passes at
  // the leaf and fails at the mid is a divergence caused by the emission position and nothing else.
  //
  // `verdict` is the MEASURED outcome, pinned so a later change to either position shows up here:
  //   'both-execute'   the row behaves the same at both positions - no divergence
  //   'mid-diverges'   the leaf executes and the emission handler does not: a FINDING
  //   'not-reachable'  this fixture cannot build the row at EITHER position, so it says nothing about
  //                    the emission position; recorded rather than dropped
  const ROWS: readonly {
    row: string; predicate: string; verdict: string; mid?: RegExp;
  }[] = [
    {
      row: 'this.activeInputIndex',
      predicate: 'require(this.activeInputIndex >= 0 && n >= 0);',
      verdict: 'both-execute',
    },
    { row: 'msg.sig', predicate: 'require(msg.sig.length == 4 && n >= 0);', verdict: 'mid-diverges', mid: /OP_VERIFY/ },
    {
      row: 'msg.data',
      predicate: 'require(msg.data.length >= 4 && n >= 0);',
      verdict: 'mid-diverges',
      mid: /OP_SPLIT operation with an invalid index/,
    },
    { row: 'msg.value', predicate: 'require(msg.value >= 0 && n >= 0);', verdict: 'not-reachable' },
    {
      row: 'this.categoryId',
      predicate: 'require(this.categoryId.length >= 0 && n >= 0);',
      verdict: 'both-execute',
    },
    { row: 'tx.inputs.length', predicate: 'require(tx.inputs.length == 8 && n >= 0);', verdict: 'both-execute' },
    { row: 'tx.outputs.length', predicate: 'require(tx.outputs.length == 8 && n >= 0);', verdict: 'both-execute' },
    { row: 'tx.version', predicate: 'require(tx.version >= 0 && n >= 0);', verdict: 'both-execute' },
    { row: 'tx.locktime', predicate: 'require(tx.locktime >= 0 && n >= 0);', verdict: 'both-execute' },
    { row: 'block.number', predicate: 'require(block.number >= 0 && n >= 0);', verdict: 'not-reachable' },
  ];

  /** Evaluate one predicate at one position, reporting a build-time refusal as its own outcome. */
  const at = async (position: 'leaf' | 'mid', predicate: string): Promise<string | null> => {
    try {
      const built = await buildChain(
        ROOT_PLAIN,
        position === 'mid' ? reads(MID_PLAIN, predicate) : MID_PLAIN,
        position === 'leaf' ? reads(LEAF_PLAIN, predicate) : LEAF_PLAIN,
        { rootCaller: HONEST_ROOT_CALLER },
      );
      return evaluateEachInput(built.builder)[CHAIN[position]];
    } catch (error) {
      return `BUILD: ${(error as Error).message}`;
    }
  };

  it.each(ROWS)(
    'A13-5 [$verdict]: $row - leaf position versus mid-chain emission position',
    async ({ row, predicate, verdict, mid: midPattern }) => {
      const leaf = await at('leaf', predicate);
      const mid = await at('mid', predicate);
      if (verdict === 'both-execute') {
        expect({ row, leaf, mid }).toEqual({ row, leaf: null, mid: null });
      } else if (verdict === 'mid-diverges') {
        // The leaf arm is the control: same predicate, same transaction, one contract further down the chain.
        expect({ row, leaf }).toEqual({ row, leaf: null });
        expect(mid).toMatch(midPattern!);
      } else {
        // Refused identically at both positions, so this fixture attributes nothing to the emission position.
        // The handler name is the only thing that legitimately differs between the two messages.
        const normalize = (message: string | null): string | null =>
          message && message.replace(/'(leaf|mid)'/g, "'<handler>'");
        expect(leaf).not.toBe(null);
        expect(normalize(mid)).toBe(normalize(leaf));
      }
    },
    300_000,
  );
});
