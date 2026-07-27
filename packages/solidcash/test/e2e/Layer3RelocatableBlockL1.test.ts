import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin, sha256 } from '@bitauth/libauth';
import { buildInitialStateCommitments } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, balancedAssemblyFromGraphLayout,
  preflightBalancedBlockAssembly, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';

/**
 * L1 - a compiled participant block is relocatable.
 *
 * The claim under test is not "the layout looks relative". It is that ONE physical contract instance - one
 * locking bytecode, one category, one master UTXO carried forward - settles the same compiled block at three
 * DIFFERENT physical bases, because the covenant addresses every slot from its own `OP_INPUTINDEX` and the
 * base is supplied as an authenticated per-transaction witness rather than baked into the script.
 *
 * The prefix in front of the target is what moves it: no prefix (base 0), a one-slot driver (base 1), a
 * two-slot driver (base 2). Nothing about the target is recompiled between the three settlements; the test
 * asserts its locking bytecode is byte-identical each time.
 *
 * The hostile direction is the point of the exercise: a block that MOVES while one of the witnesses that must
 * move with it stays behind must be rejected. Two such witnesses are attacked separately - the data-NFT
 * co-spend's `masterInputIndex`, and the transcript-committed participant base - each against an honest
 * control that differs only in that field.
 *
 * Evidence level: SEMANTIC, on `createLayer3SemanticTestProvider()` (the stricter profile: real 128-byte NFT
 * commitments).
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

// A one-slot driver: no state of its own, so its block is exactly [master].
const DRIVER_ONE = `pragma solidcash >=0.8.0;
interface IRelocTarget { function add(int n); }
contract RelocDriverOne(address target) {
  function drive(int n) public {
    IRelocTarget(target).add(n);
    require(n >= 0);
  }
}`;

// A two-slot driver: one persisted scalar the driven function does not touch, so its block is
// [master, dataNft] and the target behind it lands one slot further along.
const DRIVER_TWO = `pragma solidcash >=0.8.0;
interface IRelocTarget { function add(int n); }
contract RelocDriverTwo(address target) {
  int calls;
  function drive(int n) public {
    IRelocTarget(target).add(n);
    require(n >= 0);
  }
  function bump() public {
    this.calls = this.calls + 1;
  }
}`;

type Provider = ReturnType<typeof createLayer3SemanticTestProvider>;
type Hostile = 'none' | 'stale-master-witness' | 'stale-committed-base' | 'padded-prefix';

interface Harness {
  provider: Provider;
  projection: Contract<any, any>;
  controller: Contract<any, any>;
  controllerCategory: string;
  controllerGenesis: any[];
  p2pkh: Contract<any, any>;
  targetArtifact: any;
  target: Contract<any, any>;
  targetCategory: string;
  driverOneArtifact: any;
  driverOne: Contract<any, any>;
  driverOneCategory: string;
  driverTwoArtifact: any;
  driverTwo: Contract<any, any>;
  driverTwoCategory: string;
  driverTwoDataNft: any;
  targetMaster: any;
  targetDataNft: any;
  driverOneMaster: any;
  driverTwoMaster: any;
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
  // One controller category, three independently rooted authority NFTs: each settlement consumes its own.
  const genesis = await (provider as any).addTokenUtxosDynamic(() => Array.from({ length: 3 }, () => ({
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

  const driverTwoArtifact = compileString(DRIVER_TWO, options);
  const driverTwoBase = new Contract(driverTwoArtifact, [target.lockingBytecode], { provider });
  const driverTwoSetup = await setupStatefulUtxos(
    provider, driverTwoBase, driverTwoArtifact.stateLayout!, { calls: 0n },
  );
  const driverTwo = driverTwoBase.withCategory(hexToBin(driverTwoSetup.categoryId));

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
    driverOneArtifact,
    driverOne,
    driverOneCategory: driverOneSetup.categoryId,
    driverTwoArtifact,
    driverTwo,
    driverTwoCategory: driverTwoSetup.categoryId,
    driverTwoDataNft: driverTwoSetup.dataNftUtxos[0],
    targetMaster: targetSetup.masterUtxo,
    targetDataNft: targetSetup.dataNftUtxos[0],
    driverOneMaster: driverOneSetup.masterUtxo,
    driverTwoMaster: driverTwoSetup.masterUtxo,
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
  if (!rooted) throw new Error('L1 harness did not root its graph controller');
  return rooted;
}

/**
 * Assemble one settlement of the target's block behind `prefix` driver slots.
 *
 * `prefix` 0 runs the target as the graph root; 1 and 2 put a one- or two-slot driver in front of it, so the
 * SAME compiled target block starts at physical index 0, 1 and 2 respectively.
 */
async function assemble(harness: Harness, prefix: 0 | 1 | 2, hostile: Hostile = 'none'): Promise<{
  transaction: string;
  builder: TransactionBuilder;
  assembly: ReturnType<typeof balancedAssemblyFromGraphLayout>;
  targetBase: number;
  targetLockingBytecode: string;
  amount: bigint;
}> {
  const amount = BigInt(prefix + 3);
  const driverArtifact = prefix === 1 ? harness.driverOneArtifact : harness.driverTwoArtifact;
  const driver = prefix === 1 ? harness.driverOne : harness.driverTwo;
  const driverMaster = prefix === 1 ? harness.driverOneMaster : harness.driverTwoMaster;
  const driverCategory = prefix === 1 ? harness.driverOneCategory : harness.driverTwoCategory;

  const participants = prefix === 0
    ? [{ artifact: harness.targetArtifact, lockingBytecode: harness.target.lockingBytecode }]
    : [
      { artifact: driverArtifact, lockingBytecode: driver.lockingBytecode },
      { artifact: harness.targetArtifact, lockingBytecode: harness.target.lockingBytecode },
    ];
  const invocations = prefix === 0
    ? [{ parent: null, callee: 0, function: 'add', args: [amount] }]
    : [
      { parent: null, callee: 0, function: 'drive', args: [amount] },
      { parent: 0, callee: 1, function: 'add', args: [amount] },
    ];
  const plan = layer3.planCompiledGraph(participants as any, invocations as any);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const targetIndex = prefix === 0 ? 0 : 1;
  // A padded prefix shifts the WHOLE participant region one slot later, keeping every block's internal shape
  // and every committed index consistent with where the blocks physically sit.
  const shift = hostile === 'padded-prefix' ? 1 : 0;
  const honestBase = layout.participantInputs[targetIndex] + shift;
  const controllerInput = layout.controllerInput + shift;

  // The single attacked field: the base the transcript COMMITS for the relocated participant. Everything
  // physical stays exactly as the honest control assembles it.
  const committedInputs = layout.participantInputs.map((input) => input + shift);
  if (hostile === 'stale-committed-base') committedInputs[targetIndex] = honestBase - 1;
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
  const tx = new TransactionBuilder({ provider: harness.provider, allowImplicitNftBurn: true });
  let padUtxo: any;
  if (shift === 1) {
    padUtxo = randomUtxo({ satoshis: 2000n });
    await harness.provider.addUtxo(harness.p2pkh.address, padUtxo);
    tx.addInput(padUtxo, harness.p2pkh.unlock.spend(alicePub, signature()));
  }

  if (prefix !== 0) {
    const driverRoute = driver.createCompilerRouteUnlocker(
      driverArtifact.hiddenBatch!.route, hexToBin(driverArtifact.hiddenBatch!.selector),
    );
    tx.addInput(driverMaster, driverRoute(
      ...layer3.compiledGraphRouteArgs(transcript, 0, controllerInput) as any,
    ));
    if (prefix === 2) {
      tx.addInput(
        harness.driverTwoDataNft,
        createDataNftUnlocker(harness.driverTwo, shift, harness.driverTwoCategory),
      );
    }
  }
  tx.addInput(harness.targetMaster, targetRoute(
    ...layer3.compiledGraphRouteArgs(transcript, targetIndex, controllerInput) as any,
  ));
  // The data-NFT co-spend names the master it is authorized by. That witness MUST move with the block.
  tx.addInput(
    harness.targetDataNft,
    createDataNftUnlocker(
      harness.target,
      hostile === 'stale-master-witness' ? honestBase - 1 : honestBase,
      harness.targetCategory,
    ),
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
  if (prefix !== 0) {
    tx.addOutput({
      to: driver.tokenAddress,
      amount: driverMaster.satoshis,
      token: { category: driverCategory, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    if (prefix === 2) {
      tx.addOutput({
        to: getDataNftAddress(harness.driverTwo, harness.driverTwoCategory),
        amount: harness.driverTwoDataNft.satoshis,
        token: {
          category: harness.driverTwoCategory,
          amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: harness.driverTwoDataNft.token!.nft!.commitment,
          },
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

  const assembly = balancedAssemblyFromGraphLayout(plan.participants, layout);
  return {
    transaction: raw(tx),
    builder: tx,
    assembly,
    targetBase: honestBase,
    targetLockingBytecode: harness.target.lockingBytecode,
    amount,
  };
}

/** Advance the harness to the state the just-settled transaction produced. */
async function adopt(harness: Harness, prefix: 0 | 1 | 2, amount: bigint): Promise<void> {
  harness.total += amount;
  const masters = await harness.provider.getUtxos(harness.target.tokenAddress);
  harness.targetMaster = masters.find((utxo: any) => utxo.token?.nft?.capability === 'minting');
  const dataNfts = await harness.provider.getUtxos(
    getDataNftAddress(harness.target, harness.targetCategory),
  );
  harness.targetDataNft = dataNfts[dataNfts.length - 1];
  if (prefix === 1) {
    harness.driverOneMaster = (await harness.provider.getUtxos(harness.driverOne.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.capability === 'minting');
  }
  if (prefix === 2) {
    harness.driverTwoMaster = (await harness.provider.getUtxos(harness.driverTwo.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.capability === 'minting');
    const driverData = await harness.provider.getUtxos(
      getDataNftAddress(harness.driverTwo, harness.driverTwoCategory),
    );
    harness.driverTwoDataNft = driverData[driverData.length - 1];
  }
}

describe('L1 relocatable balanced participant block', () => {
  it('SEMANTIC: settles ONE compiled block at three different physical bases', async () => {
    const harness = await createHarness();
    const observed: Array<{ base: number; lbc: string; slots: number }> = [];
    for (const prefix of [0, 1, 2] as const) {
      const built = await assemble(harness, prefix);
      // The block is balanced and its fee/change slots sit outside it - checked before the tx is broadcast.
      preflightBalancedBlockAssembly(built.builder, built.assembly);
      await expect(harness.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
      observed.push({
        base: built.targetBase,
        lbc: built.targetLockingBytecode,
        slots: built.assembly.totalSlots,
      });
      await adopt(harness, prefix, built.amount);
    }
    // Three distinct bases for the same block, in three transactions of three different widths.
    expect(observed.map((entry) => entry.base)).toEqual([0, 1, 2]);
    expect(new Set(observed.map((entry) => entry.slots)).size).toBe(3);
    // The relocated participant was never recompiled or re-instantiated between the settlements.
    expect(new Set(observed.map((entry) => entry.lbc)).size).toBe(1);
    // And the total accumulated on the ONE carried-forward state: 3 + 4 + 5.
    expect(harness.total).toBe(12n);
  }, 180_000);

  it('SEMANTIC: the compiled block declares only local offsets, never a physical index', async () => {
    const harness = await createHarness();
    const layout = harness.targetArtifact.hiddenBatch!.route.blockLayout!;
    expect(layout.blockSize).toBe(2);
    expect(layout.slots.map((slot: any) => `${slot.offset}:${slot.kind}`)).toEqual([
      '0:master', '1:dataNft',
    ]);
    // The driver in front of it changes size without the target's script changing one byte.
    expect(harness.driverOneArtifact.hiddenBatch!.route.blockLayout!.blockSize).toBe(1);
    expect(harness.driverTwoArtifact.hiddenBatch!.route.blockLayout!.blockSize).toBe(2);
  }, 180_000);

  it('HOSTILE: a relocated block whose data-NFT witness still names the OLD master index is rejected', async () => {
    const harness = await createHarness();
    // Guard negative control: the witness value 0 is not intrinsically bad. At base 0 it IS the master index
    // and the identical co-spend settles.
    const atBaseZero = await assemble(harness, 0, 'none');
    expect(atBaseZero.targetBase).toBe(0);
    await expect(harness.provider.sendRawTransaction(atBaseZero.transaction)).resolves.toBeTypeOf('string');
    await adopt(harness, 0, atBaseZero.amount);

    // Honest control at base 1: identical assembly, witness moved to 1 with the block.
    const control = await assemble(harness, 1, 'none');
    expect(control.targetBase).toBe(1);
    await expect(harness.provider.sendRawTransaction(control.transaction)).resolves.toBeTypeOf('string');
    await adopt(harness, 1, control.amount);

    // Attacked: block at base 1, witness left behind at 0. One field.
    const attacked = await assemble(harness, 1, 'stale-master-witness');
    // The layout is still balanced; only the co-spend witness is stale, so the preflight cannot be the reason.
    preflightBalancedBlockAssembly(attacked.builder, attacked.assembly);
    const outcome = await harness.provider.sendRawTransaction(attacked.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    // Input 2 is the relocated block's own data-NFT co-spend (0 driver master, 1 target master, 2 target data).
    expect(outcome).toContain('error in evaluating input index 2');
  }, 180_000);

  it('HOSTILE: a relocated block whose committed base did not move with it is rejected', async () => {
    const harness = await createHarness();
    // The block physically sits at base 2 (two-slot driver in front). Control: the transcript commits 2.
    const control = await assemble(harness, 2, 'none');
    expect(control.targetBase).toBe(2);
    await expect(harness.provider.sendRawTransaction(control.transaction)).resolves.toBeTypeOf('string');
    await adopt(harness, 2, control.amount);

    // Attacked: the SAME physical placement, but the transcript still commits the base the block had when a
    // one-slot driver preceded it. Only that field differs.
    const attacked = await assemble(harness, 2, 'stale-committed-base');
    preflightBalancedBlockAssembly(attacked.builder, attacked.assembly);
    const outcome = await harness.provider.sendRawTransaction(attacked.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    // Input 2 is the relocated participant's OWN route input (0 driver master, 1 driver data, 2 target master):
    // the block itself refuses a committed base that disagrees with where it physically sits.
    expect(outcome).toContain('error in evaluating input index 2');
    expect(outcome).toContain('Program failed an OP_VERIFY operation');
  }, 180_000);

  // MEASURED BOUND on the "no global absolute-index dependency" criterion. Blocks relocate RELATIVE TO EACH
  // OTHER - a block moves whenever the blocks in front of it change size - but the participant REGION itself
  // is pinned to physical input 0. `GraphProjectionVerifier` and `GraphRootController.attest` both start their
  // packing cursor at 0 and require `participantInput == expectedParticipantInput`, so a whole-region shift is
  // rejected even when every committed index is consistent with the new placement. This is pre-existing
  // behaviour, not something this task introduced; it is recorded so the criterion is not overclaimed.
  it('MEASURED: the participant region is pinned to input 0 - a padded prefix is rejected', async () => {
    const harness = await createHarness();
    // Control: unpadded, participant region starts at 0.
    const control = await assemble(harness, 1, 'none');
    await expect(harness.provider.sendRawTransaction(control.transaction)).resolves.toBeTypeOf('string');
    await adopt(harness, 1, control.amount);

    // Padded: one ordinary funding input/output pair in front, and EVERY committed index moved with it, so
    // nothing is internally inconsistent - only the region's own start index changed.
    const padded = await assemble(harness, 1, 'padded-prefix');
    expect(padded.targetBase).toBe(2);
    const shifted = {
      ...padded.assembly,
      blocks: padded.assembly.blocks.map((block) => ({ ...block, base: block.base + 1 })),
      auxiliaryInputs: padded.assembly.auxiliaryInputs.map((input) => input + 1),
      feeInput: padded.assembly.feeInput + 1,
      changeOutput: padded.assembly.changeOutput + 1,
      totalSlots: padded.assembly.totalSlots + 1,
    };
    // The SDK preflight and the on-chain packing rule agree: the region starts at 0 or not at all.
    expect(() => preflightBalancedBlockAssembly(padded.builder, shifted))
      .toThrow(/participant 0 block base 1 breaks concatenation at 0/);
    const outcome = await harness.provider.sendRawTransaction(padded.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
  }, 180_000);

  it('SEMANTIC: relocation changes the transcript root, never the participant script', async () => {
    const harness = await createHarness();
    const first = await assemble(harness, 1);
    await expect(harness.provider.sendRawTransaction(first.transaction)).resolves.toBeTypeOf('string');
    await adopt(harness, 1, first.amount);
    const second = await assemble(harness, 2);
    await expect(harness.provider.sendRawTransaction(second.transaction)).resolves.toBeTypeOf('string');
    expect(first.targetBase).not.toBe(second.targetBase);
    expect(first.targetLockingBytecode).toBe(second.targetLockingBytecode);
    // The committed transcript is what carries the physical base, so it differs between the two placements.
    expect(binToHex(sha256.hash(hexToBin(first.transaction))))
      .not.toBe(binToHex(sha256.hash(hexToBin(second.transaction))));
  }, 180_000);
});
