import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin,
  type AuthenticationProgramStateCommon,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type { Utxo } from '../../src/interfaces.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X3 - where result fan-in actually stops.
 *
 * One caller, two producers, both of which RETURN. The transcript that describes it is an honest fan-in
 * transcript: the caller owns two emission rows and each carries a framed producer result. Building it needs no
 * relaxation at all, because a row's result field comes from the PRODUCER's handler outputs, not from how many
 * of the consumer's callsites are annotated as consuming.
 *
 * The point of the fixture is which covenants accept that transcript and which cannot:
 *
 *   accept   every producer's compiled SCB1 route, all three projection proofs, and the one-shot controller -
 *            i.e. the entire transcript machinery, which walks a caller's emission rows with a cursor and has
 *            no notion of "at most one result".
 *   reject   the CALLER's own compiled route, at input 0. Its two call slots are void, so it rebuilds two rows
 *            with empty result frames and compares them against the two result-bearing rows the transcript
 *            commits.
 *
 * That is the whole wall: the caller-side lowering. `Layer3ResultBinding` measures the three compiler sites,
 * and `graph.ts` refuses the shape by name at plan time so it cannot reach a transaction unnoticed.
 */

const FAN_CALLER = `pragma solidcash >=0.8.0;
interface IFanUp { function up(int n) returns (int); }
interface IFanDown { function down(int n) returns (int); }
contract X3FanCaller(int brand) {
  function fan(address a, address b, int n) public pure {
    int first = IFanUp(a).up(n);
    int second = IFanDown(b).down(first);
    require(first == n + 20 && second == n + 50);
  }
}`;
const UP = `pragma solidcash >=0.8.0;
contract X3Up(int brand) {
  function up(int n) public pure returns (int) { require(n >= 0); return n + 20; }
}`;
const DOWN = `pragma solidcash >=0.8.0;
contract X3Down(int brand) {
  function down(int n) public pure returns (int) { require(n >= 0); return n + 30; }
}`;
const MIXED_CALLER = `pragma solidcash >=0.8.0;
interface IFanUp { function up(int n) returns (int); }
interface IFanDown { function down(int n); }
contract X3MixedCaller(int brand) {
  function fan(address a, address b, int n) public pure {
    int first = IFanUp(a).up(n);
    IFanDown(b).down(n);
    require(first == n + 20);
  }
}`;
const MIXED_CALLER_VOID_FIRST = `pragma solidcash >=0.8.0;
interface IFanUp { function up(int n) returns (int); }
interface IFanDown { function down(int n); }
contract X3MixedCallerVoidFirst(int brand) {
  function fan(address a, address b, int n) public pure {
    IFanDown(b).down(n);
    int first = IFanUp(a).up(n);
    require(first == n + 20);
  }
}`;
const DOWN_VOID = `pragma solidcash >=0.8.0;
contract X3DownVoid(int brand) {
  function down(int n) public pure { require(n >= 0); }
}`;

const SEED = 2n;
const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packedScalar = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
const packedBytes = (value: Uint8Array): Uint8Array => scriptToBytecode([value]);
const fixedUtxo = (slot: number, satoshis: bigint): Utxo => randomUtxo({
  satoshis, vout: 0, txid: slot.toString(16).padStart(2, '0').repeat(32),
});

async function createGraphAuthority(provider: ReturnType<typeof createTestProvider>): Promise<{
  projection: Contract; controller: Contract; categoryId: string; genesisUtxo: Utxo;
}> {
  const projection = new Contract(
    compileString(layer3.generateGraphProjectionVerifier()), [], { provider },
  );
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  return {
    projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0],
  };
}

async function initializeGraphAuthority(
  provider: ReturnType<typeof createTestProvider>, controller: Contract, genesisUtxo: any,
  categoryId: string, root: string, p2pkh: Contract,
): Promise<Utxo> {
  const fee = fixedUtxo(0xe1, 20_000n);
  await provider.addUtxo(p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(root), alicePub, signature()));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(tx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  if (!rooted) throw new Error('graph controller initialization did not create the rooted authority');
  return rooted;
}

interface FanInFixture {
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  plan: ReturnType<typeof layer3.planCompiledGraph>;
  transcript: ReturnType<typeof layer3.finalizeCompiledGraph>;
  layout: ReturnType<typeof layer3.compiledGraphPhysicalLayout>;
}

type ResultMutation = 'tamper-first' | 'tamper-second' | 'reorder' | 'omit-second';

async function buildFanInGraph(
  mutation?: ResultMutation, mixed: false | 'return-first' | 'void-first' = false,
): Promise<FanInFixture> {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };

  const artifactUp = compileString(UP, options);
  const baseUp = new Contract(artifactUp, [1n], { provider });
  const setupUp = await setupStatefulUtxos(provider, baseUp, artifactUp.stateLayout!, {});
  const up = baseUp.withCategory(hexToBin(setupUp.categoryId));

  const artifactDown = compileString(mixed ? DOWN_VOID : DOWN, options);
  const baseDown = new Contract(artifactDown, [2n], { provider });
  const setupDown = await setupStatefulUtxos(provider, baseDown, artifactDown.stateLayout!, {});
  const down = baseDown.withCategory(hexToBin(setupDown.categoryId));

  const artifactCaller = compileString(
    mixed === 'void-first' ? MIXED_CALLER_VOID_FIRST : mixed ? MIXED_CALLER : FAN_CALLER, options,
  );
  const baseCaller = new Contract(artifactCaller, [0n], { provider });
  const setupCaller = await setupStatefulUtxos(provider, baseCaller, artifactCaller.stateLayout!, {});
  const caller = baseCaller.withCategory(hexToBin(setupCaller.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: artifactCaller, lockingBytecode: caller.lockingBytecode },
    { artifact: artifactUp, lockingBytecode: up.lockingBytecode },
    { artifact: artifactDown, lockingBytecode: down.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'fan', args: [up.lockingBytecode, down.lockingBytecode, SEED] },
    ...(mixed === 'void-first' ? [
      { parent: 0, callee: 2, function: 'down', args: [SEED] },
      { parent: 0, callee: 1, function: 'up', args: [SEED] },
    ] : [
      { parent: 0, callee: 1, function: 'up', args: [SEED] },
      { parent: 0, callee: 2, function: 'down', args: [mixed ? SEED : SEED + 20n] },
    ]),
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const resultUp = packedScalar(SEED + 20n);
  const resultDown = packedScalar(SEED + 50n);
  const declaredResults: Record<number, string> = mixed === 'void-first'
    ? { 2: binToHex(mutation === 'tamper-first' ? packedScalar(SEED + 21n) : resultUp) }
    : mutation === 'reorder'
    ? { 1: binToHex(resultDown), 2: binToHex(resultUp) }
    : {
      1: binToHex(mutation === 'tamper-first' ? packedScalar(SEED + 21n) : resultUp),
      ...(!mixed && mutation !== 'omit-second' && {
        2: binToHex(mutation === 'tamper-second' ? packedScalar(SEED + 51n) : resultDown),
      }),
    };
  const transcript = layer3.finalizeCompiledGraph(
    plan, declaredResults,
    layout.participantInputs, layout.returnOutputs,
    mixed === 'void-first'
      ? ['', declaredResults[2] ?? '', '']
      : ['', declaredResults[1] ?? '', declaredResults[2] ?? ''], layout.projectionInputs,
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const funding = [fixedUtxo(0xf0, 1000n), fixedUtxo(0xf1, 1000n)];
  for (const utxo of funding) await provider.addUtxo(p2pkh.address, utxo);
  const projectionUtxos = [fixedUtxo(0xa0, 1000n), fixedUtxo(0xa1, 1000n), fixedUtxo(0xa2, 1000n)];
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  const fee = fixedUtxo(0xe2, 150_000n);
  await provider.addUtxo(p2pkh.address, fee);

  const route = (contract: Contract, artifact: typeof artifactUp): ReturnType<Contract['createCompilerRouteUnlocker']> =>
    contract.createCompilerRouteUnlocker(
      artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
    );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupCaller.masterUtxo, route(caller, artifactCaller)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  tx.addInput(setupUp.masterUtxo, route(up, artifactUp)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![1]!),
  ));
  tx.addInput(funding[0], p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupDown.masterUtxo, route(down, artifactDown)(
    ...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any,
    ...(mixed ? [] : [BigInt(layout.returnOutputs![2]!)]),
  ));
  if (!mixed) tx.addInput(funding[1], p2pkh.unlock.spend(alicePub, signature()));
  projectionUtxos.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const master = (contract: Contract, setup: any): any => ({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
  });
  const returnEvent = (setup: any, value: Uint8Array): any => ({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setup.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(packedBytes(value)) },
    },
  });
  tx.addOutput(master(caller, setupCaller));
  tx.addOutput(master(up, setupUp));
  tx.addOutput(returnEvent(setupUp, resultUp));
  tx.addOutput(master(down, setupDown));
  if (!mixed) tx.addOutput(returnEvent(setupDown, resultDown));
  for (let slot = 0; slot < 3; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 100_000n });

  return {
    provider, builder: tx, plan, transcript, layout,
  };
}

/** Report the first input whose BCH-2026 evaluation fails, so a case names one exact covenant. */
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

/** Evaluate ONE input in isolation, so an input after the first failure can still be measured. */
function inputError(builder: TransactionBuilder, inputIndex: number): string | undefined {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs as never);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  const state = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as AuthenticationProgramStateCommon;
  return state.error;
}

const INPUT = {
  masterCaller: 0, masterUp: 1, masterDown: 3,
  projectionCaller: 5, projectionUp: 6, projectionDown: 7, controller: 8,
} as const;

describe('Layer-3 ordered result fan-in (X3)', () => {
  it('settles two producer results under one caller', async () => {
    const built = await buildFanInGraph();
    // The transcript IS a fan-in transcript: one caller, two emission rows, each with a framed result.
    expect(built.plan.invocations.map((invocation) => invocation.caller)).toEqual([null, 0, 0]);
    expect(built.plan.invocations.map((invocation) => invocation.resultTypes))
      .toEqual([[], ['int256'], ['int256']]);
    expect(built.transcript.resultsHex).toEqual(['', '0116', '0134']);

    expect(inputError(built.builder, INPUT.masterCaller)).toBeUndefined();

    // Everything the transcript machinery owns accepts the same transaction: both producers' routes, all
    // three projection proofs and the one-shot controller. Measured per input, because `failingInput` stops
    // at the first failure and that failure is input 0.
    for (const input of [
      INPUT.masterUp, INPUT.masterDown,
      INPUT.projectionCaller, INPUT.projectionUp, INPUT.projectionDown, INPUT.controller,
    ]) {
      expect(inputError(built.builder, input)).toBeUndefined();
    }

    expect(built.plan.invocations.map((invocation) => invocation.resultDependencies))
      .toEqual([[1, 2], [], []]);
    expect(built.plan.invocations.map((invocation) => invocation.consumerCallsiteId))
      .toEqual([undefined, 0, 1]);
  }, 180_000);

  it('settles a returning call followed by a void call', async () => {
    const built = await buildFanInGraph(undefined, 'return-first');
    expect(built.plan.invocations.map((invocation) => invocation.resultDependencies))
      .toEqual([[1], [], []]);
    expect(failingInput(built.builder)).toBeNull();
  }, 180_000);

  it('settles a void call followed by a returning call', async () => {
    const built = await buildFanInGraph(undefined, 'void-first');
    expect(built.plan.invocations.map((invocation) => invocation.resultDependencies))
      .toEqual([[2], [], []]);
    expect(failingInput(built.builder)).toBeNull();
  }, 180_000);

  for (const order of ['return-first', 'void-first'] as const) {
    it(`rejects a tampered result in the ${order} mixed stream`, async () => {
      const built = await buildFanInGraph('tamper-first', order);
      expect(inputError(built.builder, INPUT.masterCaller)).toBeDefined();
    }, 180_000);
  }

  for (const mutation of ['tamper-first', 'tamper-second', 'reorder', 'omit-second'] as const) {
    it(`rejects ${mutation} in the authenticated ordered result stream`, async () => {
      if (mutation === 'omit-second') {
        await expect(buildFanInGraph(mutation)).rejects.toThrow(
          /returning participant 2 lacks a return output\/result vector/,
        );
        return;
      }
      const built = await buildFanInGraph(mutation);
      expect(inputError(built.builder, INPUT.masterCaller)).toBeDefined();
    }, 180_000);
  }
});
