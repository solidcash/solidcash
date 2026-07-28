import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, balancedAssemblyFromGraphLayout,
  preflightBalancedBlockAssembly, layer3,
} from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';

/**
 * Round-11 independent review of L1 (`Layer3RelocatableBlockL1.test.ts`).
 *
 * L1 settles ONE compiled block at bases 0, 1 and 2, behind prefix blocks of width 1 and 2, and scopes the
 * claim honestly: the participant REGION is pinned to physical input 0.
 *
 * Two things that file leaves unmeasured are measured here.
 *
 * 1. Its `padded-prefix` row is the ONLY hostile row with no asserted input index - it asserts a bare
 *    `mandatory-script-verify-flag-failed`. So the recorded CAUSE ("`GraphProjectionVerifier` and
 *    `GraphRootController.attest` both start their packing cursor at 0") is an attribution, not a measurement:
 *    the same rejection would be reported if the pad, a route, or a data-NFT co-spend were what refused.
 *
 * 2. Both prefixes it relocates behind are narrower than or equal to the relocated block itself (1 and 2
 *    against 2). A width-3 prefix is added so relocation is measured across three DIFFERENT widths.
 *
 * Evidence level: SEMANTIC, on `createLayer3SemanticTestProvider()`.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

const TARGET = `pragma solidcash >=0.8.0;
contract RelocTarget() {
  int total;
  function add(int n) public {
    require(n >= 0);
    this.total = this.total + n;
  }
}`;

const DRIVER_ONE = `pragma solidcash >=0.8.0;
interface IRelocTarget { function add(int n); }
contract RelocDriverOne(address target) {
  function drive(int n) public {
    IRelocTarget(target).add(n);
    require(n >= 0);
  }
}`;

// A THREE-slot driver: six bytes32 words overflow one 128-byte commitment, so its block is
// [master, dataNft, dataNft] and the target behind it lands at base 3.
const DRIVER_WIDE = `pragma solidcash >=0.8.0;
interface IRelocTarget { function add(int n); }
contract RelocDriverWide(address target) {
  bytes32 w0; bytes32 w1; bytes32 w2; bytes32 w3; bytes32 w4; bytes32 w5;
  function drive(int n) public {
    IRelocTarget(target).add(n);
    require(n >= 0);
  }
  function bump(bytes32 v) public { this.w0 = v; }
}`;

const ZERO32 = `0x${'00'.repeat(32)}`;
const wideState = (): Record<string, any> => ({
  w0: hexToBin(ZERO32.slice(2)), w1: hexToBin(ZERO32.slice(2)), w2: hexToBin(ZERO32.slice(2)),
  w3: hexToBin(ZERO32.slice(2)), w4: hexToBin(ZERO32.slice(2)), w5: hexToBin(ZERO32.slice(2)),
});

type Prefix = 'one' | 'wide';
type Hostile = 'none' | 'padded-prefix' | 'stale-committed-base';

interface Harness {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  projection: Contract<any, any>;
  controller: Contract<any, any>;
  controllerCategory: string;
  controllerGenesis: any[];
  p2pkh: Contract<any, any>;
  targetArtifact: any;
  target: Contract<any, any>;
  targetCategory: string;
  targetMaster: any;
  targetDataNft: any;
  driverOneArtifact: any;
  driverOne: Contract<any, any>;
  driverOneCategory: string;
  driverOneMaster: any;
  wideArtifact: any;
  wide: Contract<any, any>;
  wideCategory: string;
  wideMaster: any;
  wideDataNfts: any[];
  total: bigint;
  nextController: number;
}

async function createHarness(): Promise<Harness> {
  const provider = createLayer3SemanticTestProvider();
  const projection = new Contract(
    compileString(layer3.generateGraphProjectionVerifier()), [], { provider },
  );
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => Array.from({ length: 4 }, () => ({
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  })));
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: genesis.categoryId as string,
  };
  const targetArtifact = compileString(TARGET, options);
  const targetBase = new Contract(targetArtifact, [], { provider });
  const targetSetup = await setupStatefulUtxos(
    provider, targetBase, targetArtifact.stateLayout!, { total: 0n },
  );
  const target = targetBase.withCategory(hexToBin(targetSetup.categoryId));

  const driverOneArtifact = compileString(DRIVER_ONE, options);
  const driverOneBase = new Contract(driverOneArtifact, [target.lockingBytecode], { provider });
  const driverOneSetup = await setupStatefulUtxos(
    provider, driverOneBase, driverOneArtifact.stateLayout!, {},
  );
  const driverOne = driverOneBase.withCategory(hexToBin(driverOneSetup.categoryId));

  const wideArtifact = compileString(DRIVER_WIDE, options);
  const wideBase = new Contract(wideArtifact, [target.lockingBytecode], { provider });
  const wideSetup = await setupStatefulUtxos(
    provider, wideBase, wideArtifact.stateLayout!, wideState(),
  );
  const wide = wideBase.withCategory(hexToBin(wideSetup.categoryId));

  return {
    provider,
    projection,
    controller,
    controllerCategory: genesis.categoryId as string,
    controllerGenesis: genesis.utxos,
    p2pkh: new Contract(p2pkhArtifact, [alicePkh], { provider }),
    targetArtifact,
    target,
    targetCategory: targetSetup.categoryId,
    targetMaster: targetSetup.masterUtxo,
    targetDataNft: targetSetup.dataNftUtxos[0],
    driverOneArtifact,
    driverOne,
    driverOneCategory: driverOneSetup.categoryId,
    driverOneMaster: driverOneSetup.masterUtxo,
    wideArtifact,
    wide,
    wideCategory: wideSetup.categoryId,
    wideMaster: wideSetup.masterUtxo,
    wideDataNfts: wideSetup.dataNftUtxos,
    total: 0n,
    nextController: 0,
  };
}

async function rootController(harness: Harness, root: string): Promise<any> {
  const genesisUtxo = harness.controllerGenesis[harness.nextController];
  harness.nextController += 1;
  const fee = randomUtxo({ satoshis: 20_000n });
  await harness.provider.addUtxo(harness.p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider: harness.provider });
  tx.addInput(genesisUtxo, harness.controller.unlock.initialize(hexToBin(root), alicePub, signature()));
  tx.addInput(fee, harness.p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: harness.controller.tokenAddress,
    amount: genesisUtxo.satoshis,
    token: {
      category: harness.controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: root },
    },
  });
  tx.addOutput({ to: harness.p2pkh.address, amount: 15_000n });
  await harness.provider.sendRawTransaction(raw(tx));
  const rooted = (await harness.provider.getUtxos(harness.controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  if (!rooted) throw new Error('review harness did not root its graph controller');
  return rooted;
}

async function assemble(harness: Harness, prefix: Prefix, hostile: Hostile = 'none'): Promise<{
  transaction: string;
  builder: TransactionBuilder;
  assembly: ReturnType<typeof balancedAssemblyFromGraphLayout>;
  targetBase: number;
  targetLockingBytecode: string;
  amount: bigint;
}> {
  const amount = prefix === 'one' ? 3n : 4n;
  const driverArtifact = prefix === 'one' ? harness.driverOneArtifact : harness.wideArtifact;
  const driver = prefix === 'one' ? harness.driverOne : harness.wide;
  const driverMaster = prefix === 'one' ? harness.driverOneMaster : harness.wideMaster;
  const driverCategory = prefix === 'one' ? harness.driverOneCategory : harness.wideCategory;

  const participants = [
    { artifact: driverArtifact, lockingBytecode: driver.lockingBytecode },
    { artifact: harness.targetArtifact, lockingBytecode: harness.target.lockingBytecode },
  ];
  const invocations = [
    { parent: null, callee: 0, function: 'drive', args: [amount] },
    { parent: 0, callee: 1, function: 'add', args: [amount] },
  ];
  const plan = layer3.planCompiledGraph(participants as any, invocations as any);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const shift = hostile === 'padded-prefix' ? 1 : 0;
  const honestBase = layout.participantInputs[1] + shift;
  const controllerInput = layout.controllerInput + shift;

  const committedInputs = layout.participantInputs.map((input) => input + shift);
  if (hostile === 'stale-committed-base') committedInputs[1] = honestBase - 1;
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, committedInputs, layout.returnOutputs,
    participants.map(() => ''), layout.projectionInputs.map((input) => input + shift),
  );
  const rooted = await rootController(harness, transcript.root);

  const proofs: any[] = [];
  for (let i = 0; i < participants.length; i += 1) {
    const proof = randomUtxo({ satoshis: 1000n });
    await harness.provider.addUtxo(harness.projection.address, proof);
    proofs.push(proof);
  }
  const fee = randomUtxo({ satoshis: 50_000n });
  await harness.provider.addUtxo(harness.p2pkh.address, fee);

  const targetRoute = harness.target.createCompilerRouteUnlocker(
    harness.targetArtifact.hiddenBatch!.route, hexToBin(harness.targetArtifact.hiddenBatch!.selector),
  );
  const driverRoute = driver.createCompilerRouteUnlocker(
    driverArtifact.hiddenBatch!.route, hexToBin(driverArtifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider: harness.provider, allowImplicitNftBurn: true });
  if (shift === 1) {
    const pad = randomUtxo({ satoshis: 2000n });
    await harness.provider.addUtxo(harness.p2pkh.address, pad);
    tx.addInput(pad, harness.p2pkh.unlock.spend(alicePub, signature()));
  }
  tx.addInput(driverMaster, driverRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 0, controllerInput) as any,
  ));
  if (prefix === 'wide') {
    for (const dataNft of harness.wideDataNfts) {
      tx.addInput(dataNft, createDataNftUnlocker(harness.wide, shift, harness.wideCategory));
    }
  }
  tx.addInput(harness.targetMaster, targetRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 1, controllerInput) as any,
  ));
  tx.addInput(
    harness.targetDataNft,
    createDataNftUnlocker(harness.target, honestBase, harness.targetCategory),
  );
  proofs.forEach((proof, participant) => tx.addInput(
    proof,
    harness.projection.unlock.verify(
      transcript.bytes, BigInt(controllerInput), BigInt(participant),
    ),
  ));
  tx.addInput(rooted, harness.controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, harness.p2pkh.unlock.spend(alicePub, signature()));

  if (shift === 1) tx.addOutput({ to: harness.p2pkh.address, amount: 1000n });
  tx.addOutput({
    to: driver.tokenAddress,
    amount: driverMaster.satoshis,
    token: { category: driverCategory, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  if (prefix === 'wide') {
    for (const dataNft of harness.wideDataNfts) {
      tx.addOutput({
        to: getDataNftAddress(harness.wide, harness.wideCategory),
        amount: dataNft.satoshis,
        token: {
          category: harness.wideCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: dataNft.token!.nft!.commitment },
        },
      });
    }
  }
  tx.addOutput({
    to: harness.target.tokenAddress,
    amount: harness.targetMaster.satoshis,
    token: { category: harness.targetCategory, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(harness.target, harness.targetCategory),
    amount: harness.targetDataNft.satoshis,
    token: {
      category: harness.targetCategory,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(
          harness.targetArtifact.stateLayout!, { total: harness.total + amount },
        )[0],
      },
    },
  });
  proofs.forEach(() => tx.addOutput({ to: harness.p2pkh.address, amount: 1000n }));
  tx.addOutput({ to: harness.p2pkh.address, amount: 1000n });
  tx.addOutput({ to: harness.p2pkh.address, amount: 10_000n });

  return {
    transaction: raw(tx),
    builder: tx,
    assembly: balancedAssemblyFromGraphLayout(plan.participants, layout),
    targetBase: honestBase,
    targetLockingBytecode: harness.target.lockingBytecode,
    amount,
  };
}

async function adopt(harness: Harness, prefix: Prefix, amount: bigint): Promise<void> {
  harness.total += amount;
  harness.targetMaster = (await harness.provider.getUtxos(harness.target.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.capability === 'minting');
  const dataNfts = await harness.provider.getUtxos(
    getDataNftAddress(harness.target, harness.targetCategory),
  );
  harness.targetDataNft = dataNfts[dataNfts.length - 1];
  if (prefix === 'one') {
    harness.driverOneMaster = (await harness.provider.getUtxos(harness.driverOne.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.capability === 'minting');
  } else {
    harness.wideMaster = (await harness.provider.getUtxos(harness.wide.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.capability === 'minting');
    const wideData = await harness.provider.getUtxos(
      getDataNftAddress(harness.wide, harness.wideCategory),
    );
    harness.wideDataNfts = wideData.slice(-harness.wideDataNfts.length);
  }
}

const outcomeOf = async (harness: Harness, transaction: string): Promise<string> =>
  harness.provider.sendRawTransaction(transaction).then(() => 'ACCEPTED').catch((e: Error) => e.message);

/** X25's relaxed ceiling: evaluate the exact bytes a second time so the walk runs to completion. */
const RELAXED_BUDGET_LIMITS = {
  maximumInputBytes: 10_000,
  maximumStackItemBytes: 10_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800_000,
  hashDigestIterationsPerByte: 3_000,
};

function measureInput(builder: TransactionBuilder, input: number): {
  bytes: number; cost: number; instructions: number; pushedBytes: number;
} {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs as never);
  const vm = createVirtualMachineBch2026ForProvider({ consensusLimits: RELAXED_BUDGET_LIMITS } as never);
  const state = vm.evaluate({ inputIndex: input, sourceOutputs, transaction }) as any;
  if (state.error !== undefined) throw new Error(`X28: evaluation failed at input ${input}: ${state.error}`);
  return {
    bytes: state.metrics.densityControlLength,
    cost: state.metrics.operationCost,
    instructions: state.metrics.evaluatedInstructionCount,
    pushedBytes: state.metrics.stackPushedBytes,
  };
}

describe('B/round-11 review of L1: relocation width and the region-pinning attribution', () => {
  /**
   * L1's `padded-prefix` row asserts only that the shape is refused. This pins WHICH input refuses it, so the
   * recorded cause - the packing cursor that starts at 0 - is attributed to the covenant that actually holds it.
   *
   * Layout with the pad: 0 pad, 1 driver master, 2 target master, 3 target data-NFT, 4/5 projections,
   * 6 controller, 7 fee. Every committed index moved with the region, so the routes and the co-spend all agree
   * with where they physically sit; only the region's own start index changed.
   */
  it('REVIEW-L1-1: the padded prefix is refused by the first PROJECTION slot, not by a route or a co-spend', async () => {
    const harness = await createHarness();
    const control = await assemble(harness, 'one', 'none');
    expect(control.targetBase).toBe(1);
    await expect(harness.provider.sendRawTransaction(control.transaction)).resolves.toBeTypeOf('string');
    await adopt(harness, 'one', control.amount);

    const padded = await assemble(harness, 'one', 'padded-prefix');
    expect(padded.targetBase).toBe(2);
    const outcome = await outcomeOf(harness, padded.transaction);
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    // Inputs 0-3 (pad, driver route, target route, target data-NFT) all pass: nothing about them changed.
    // Input 4 is projection slot 0, whose `expectedParticipantInput` starts at 0 and meets a committed 1.
    expect(outcome).toContain('error in evaluating input index 4');
  }, 240_000);

  /**
   * L1 relocates behind prefixes of width 1 and 2. This adds width 3, so the block settles at a base that no
   * earlier row reached, and re-runs the committed-base attack there.
   */
  it('REVIEW-L1-2: the same compiled block settles at base 3 behind a THREE-slot prefix', async () => {
    const harness = await createHarness();
    const narrow = await assemble(harness, 'one', 'none');
    expect(narrow.targetBase).toBe(1);
    await expect(harness.provider.sendRawTransaction(narrow.transaction)).resolves.toBeTypeOf('string');
    await adopt(harness, 'one', narrow.amount);

    const widePrefix = harness.wideArtifact.hiddenBatch!.route.blockLayout!;
    expect(widePrefix.blockSize).toBe(3);
    expect(widePrefix.slots.map((slot: any) => `${slot.offset}:${slot.kind}`))
      .toEqual(['0:master', '1:dataNft', '2:dataNft']);

    const wide = await assemble(harness, 'wide', 'none');
    expect(wide.targetBase).toBe(3);
    preflightBalancedBlockAssembly(wide.builder, wide.assembly);
    await expect(harness.provider.sendRawTransaction(wide.transaction)).resolves.toBeTypeOf('string');
    await adopt(harness, 'wide', wide.amount);

    // One physical instance, one locking bytecode, three widths of prefix, accumulated state carried forward.
    expect(narrow.targetLockingBytecode).toBe(wide.targetLockingBytecode);
    expect(harness.total).toBe(7n);
  }, 240_000);

  it('REVIEW-L1-3: at base 3 a stale committed base is still refused by the relocated block itself', async () => {
    const harness = await createHarness();
    const control = await assemble(harness, 'wide', 'none');
    expect(control.targetBase).toBe(3);
    await expect(harness.provider.sendRawTransaction(control.transaction)).resolves.toBeTypeOf('string');
    await adopt(harness, 'wide', control.amount);

    const attacked = await assemble(harness, 'wide', 'stale-committed-base');
    preflightBalancedBlockAssembly(attacked.builder, attacked.assembly);
    const outcome = await outcomeOf(harness, attacked.transaction);
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    // Input 3 is the relocated participant's own route (0 driver master, 1/2 driver data, 3 target master).
    expect(outcome).toContain('error in evaluating input index 3');
    expect(outcome).toContain('Program failed an OP_VERIFY operation');
  }, 240_000);
});

/**
 * X28 input: an independent re-measurement of the per-output term in `GraphRootController.attest`.
 *
 * X25 fit "exactly 32 instructions per transaction output" across C1/C2/C3, three builds whose participant
 * and invocation counts move together. This is a two-point fit that holds BOTH of those fixed: the shapes
 * below are the same 2 participants and 2 invocations, differing only in the width of the leading block, so
 * the only variable is the transaction's slot count (7 against 9).
 *
 * The term is what prices `BALANCED_TRAILING_CAPACITY`: every reserved-but-unused trailing slot is one more
 * output the controller has to walk.
 */
describe('B/round-11 X28 input: the controller per-output term, re-fit at fixed P and N', () => {
  it('MEASURED: attest costs a fixed number of instructions per transaction output', async () => {
    const harness = await createHarness();
    const narrow = await assemble(harness, 'one', 'none');
    const narrowSlots = narrow.builder.inputs.length;
    const narrowController = measureInput(narrow.builder, narrowSlots - 2);
    await expect(harness.provider.sendRawTransaction(narrow.transaction)).resolves.toBeTypeOf('string');
    await adopt(harness, 'one', narrow.amount);

    const wide = await assemble(harness, 'wide', 'none');
    const wideSlots = wide.builder.inputs.length;
    const wideController = measureInput(wide.builder, wideSlots - 2);
    await expect(harness.provider.sendRawTransaction(wide.transaction)).resolves.toBeTypeOf('string');

    // Same participant count, same invocation count; only the slot count moves.
    expect(narrowSlots).toBe(7);
    expect(wideSlots).toBe(9);
    // Both drivers are p2sh32, so the two transcripts are the same length and the controller input has the
    // IDENTICAL density-control length in both. Transcript size is therefore held fixed too, not just P and N.
    expect(narrowController.bytes).toBe(1844);
    expect(wideController.bytes).toBe(1844);
    expect(narrowController.instructions).toBe(4015);
    expect(wideController.instructions).toBe(4079);
    const slope = (wideController.instructions - narrowController.instructions) / (wideSlots - narrowSlots);
    expect(slope).toBe(32);
    // The cost slope carries a SECOND per-output term the instruction count does not show: `attest` pushes
    // each output's token category, so the two added outputs (both token-bearing data NFTs) also add 3,712
    // pushed bytes. A reserved-but-unused trailing slot is an ordinary tokenless output and pays only the
    // instruction term, so 32 x 100 is the conservative per-slot price of `BALANCED_TRAILING_CAPACITY`.
    expect(wideController.pushedBytes - narrowController.pushedBytes).toBe(3712);
    // 10,114 = 6,400 instruction term + 3,712 pushed bytes + a 2-unit arithmetic residue.
    expect(wideController.cost - narrowController.cost).toBe(10_114);
  }, 240_000);
});
