import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, deriveBalancedAssemblyFromInputs, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X20 - the derived assembly's auxiliary region was keyed off the tail's WIDTH, not the region's POSITION.
 *
 * `deriveBalancedAssemblyFromInputs` claimed the projection/controller slots only when
 * `cursor + participants + 1 === totalSlots - 1`, and otherwise reported `auxiliaryInputs: []`. Both auxiliary
 * checks in `preflightBalancedBlockAssembly` iterate that list, so an empty one runs neither - including the
 * 1,000-satoshi rule the two sidecar covenants enforce, which is the exact protection round-11's L2 FINDING 2
 * closed (`Layer3AssemblyReviewB11.test.ts`).
 *
 * The position of that region is not a function of the tail's width. The projection covenant accumulates
 * `expectedParticipantInput` across the whole table and the root controller requires
 * `previousProjectionInput + 1 - participantCount == expectedInput`, so the proofs begin exactly where the
 * participant region ends and the controller follows them - wherever the transaction happens to end. So
 * appending ONE ordinary padding slot after the controller re-opened the fail-open while every index the model
 * would have claimed stayed exactly where it was.
 *
 * The fixture is `Layer3AssemblyReviewB11`'s two-participant returning graph, with one added shape that appends
 * that padding slot. Rows below, each against the honest control it differs from:
 *
 *  - CONTROL      canonical tail, honest slot values -> claimed [4,5,6], preflights clean, settles.
 *  - HOSTILE      padded tail + a 999-satoshi sidecar slot -> the check the padding used to disable now fires,
 *                 before `build()` takes a single signature.
 *  - BOUNDARY     padded tail with honest slot values -> ACCEPTED by the gate, so the change did not simply
 *                 start refusing every widened tail; the padding slot itself stays UNCLAIMED, and the shape is
 *                 refused on chain by the controller's own `tx.inputs.length == activeInputIndex + 2` rule,
 *                 which is the refusal this model deliberately does not duplicate.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packed = (...values: bigint[]): Uint8Array =>
  scriptToBytecode(values.map((value) => {
    const bytes: number[] = [];
    let magnitude = value < 0n ? -value : value;
    while (magnitude > 0n) { bytes.push(Number(magnitude & 0xffn)); magnitude >>= 8n; }
    if (bytes.length === 0) return new Uint8Array();
    if (bytes[bytes.length - 1] & 0x80) bytes.push(value < 0n ? 0x80 : 0x00);
    else if (value < 0n) bytes[bytes.length - 1] |= 0x80;
    return Uint8Array.from(bytes);
  }));
const aggregate = (...values: bigint[]): Uint8Array => scriptToBytecode([packed(...values)]);

const RETURNING_B = `pragma solidcash >=0.8.0;
contract X20ReturningB(int brand) {
  function twice(int n) public pure returns (int, int) {
    require(n >= 0);
    return (n * 2, n + 10);
  }
}`;
const RETURNING_A = `pragma solidcash >=0.8.0;
interface IX20ReturningB { function twice(int n) returns (int, int); }
contract X20ReturningA(int brand, address target) {
  function plusOne(int n) public pure returns (int) {
    int child, int witness = IX20ReturningB(target).twice(n);
    require(child >= 0 && witness == n + 10);
    return child + 1;
  }
}`;

interface Options {
  /** Append one ordinary input/output pair after the controller, before the fee/change slot. */
  padTail?: boolean;
  /** Pay the first projection slot's output 999 satoshis instead of the covenant-required 1,000. */
  auxValue999?: boolean;
}

interface Built {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  signatureRequests: { count: number };
}

async function build(options: Options = {}): Promise<Built> {
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
  const compilerOptions = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: genesis.categoryId as string,
  };
  const artifactB = compileString(RETURNING_B, compilerOptions);
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(RETURNING_A, compilerOptions);
  const baseA = new Contract(artifactA, [1n, b.lockingBytecode], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'plusOne', args: [2n] },
    { parent: 0, callee: 1, function: 'twice', args: [2n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const resultA = packed(5n);
  const resultB = packed(4n, 12n);
  const transcript = layer3.finalizeCompiledGraph(
    plan,
    { 0: binToHex(resultA), 1: binToHex(resultB) },
    layout.participantInputs, layout.returnOutputs,
    [binToHex(resultA), binToHex(resultB)], layout.projectionInputs,
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, rootFee);
  const rootTx = new TransactionBuilder({ provider });
  rootTx.addInput(genesis.utxos[0], controller.unlock.initialize(
    hexToBin(transcript.root), alicePub, signature(),
  ));
  rootTx.addInput(rootFee, p2pkh.unlock.spend(alicePub, signature()));
  rootTx.addOutput({
    to: controller.tokenAddress, amount: genesis.utxos[0].satoshis,
    token: {
      category: genesis.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  rootTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(rootTx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const slotFunderA = randomUtxo({ satoshis: 1000n });
  const slotFunderB = randomUtxo({ satoshis: 1000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  const padFunder = randomUtxo({ satoshis: 1000n });
  const feeFunder = randomUtxo({ satoshis: 50_000n });
  for (const utxo of [slotFunderA, slotFunderB, padFunder, feeFunder]) {
    await provider.addUtxo(p2pkh.address, utxo);
  }
  for (const utxo of [projectionA, projectionB]) await provider.addUtxo(projection.address, utxo);

  const signatureRequests = { count: 0 };
  const counted = (unlocker: any): any => ({
    ...unlocker,
    generateLockingBytecode: (...args: unknown[]) => unlocker.generateLockingBytecode(...args),
    generateUnlockingBytecode: (...args: unknown[]) => {
      signatureRequests.count += 1;
      return unlocker.generateUnlockingBytecode(...args);
    },
  });

  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupA.masterUtxo, counted(routeA(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
    BigInt(layout.returnOutputs[0]!),
  )));
  tx.addInput(slotFunderA, counted(p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(setupB.masterUtxo, counted(routeB(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    BigInt(layout.returnOutputs[1]!),
  )));
  tx.addInput(slotFunderB, counted(p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(projectionA, counted(projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), 0n,
  )));
  tx.addInput(projectionB, counted(projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), 1n,
  )));
  tx.addInput(rooted, counted(controller.unlock.attest(transcript.bytes)));
  // The ONLY structural difference: one ordinary funding slot between the controller and the fee slot.
  if (options.padTail) tx.addInput(padFunder, counted(p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(feeFunder, counted(p2pkh.unlock.spend(alicePub, signature())));

  const returnEventA = {
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupA.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(aggregate(5n)) },
    },
  };
  const returnEventB = {
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(aggregate(4n, 12n)) },
    },
  };
  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput(returnEventA);
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput(returnEventB);
  // Output 4 pairs with projection slot input 4; the projection covenant requires exactly 1,000 satoshis.
  tx.addOutput({ to: p2pkh.address, amount: options.auxValue999 ? 999n : 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  if (options.padTail) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });

  return { provider, builder: tx, transaction: raw(tx), signatureRequests };
}

const derived = (built: Built): ReturnType<typeof deriveBalancedAssemblyFromInputs> =>
  deriveBalancedAssemblyFromInputs(built.builder.inputs as never, built.builder.inputs.length);

describe('X20: the derived auxiliary region is placed, not width-matched', () => {
  it('CONTROL: the canonical tail claims the three sidecar slots, preflights clean and settles', async () => {
    const control = await build();
    expect(control.builder.inputs).toHaveLength(8);
    expect(derived(control)!.auxiliaryInputs).toEqual([4, 5, 6]);
    expect(layer3.preflightLayer3BlockAssembly(control.builder)!.auxiliaryInputs).toEqual([4, 5, 6]);
    await expect(control.provider.sendRawTransaction(control.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('CONTROL: an unpadded 999-satoshi sidecar slot is refused before any signature is taken', async () => {
    const attacked = await build({ auxValue999: true });
    expect(attacked.builder.outputs[4].amount).toBe(999n);
    expect(() => layer3.preflightLayer3BlockAssembly(attacked.builder))
      .toThrow(/auxiliary slot 4 output is 999 satoshis, the sidecar covenant requires 1000/);
    attacked.signatureRequests.count = 0;
    await expect(layer3.sendPreflightedLayer3Transaction(attacked.builder))
      .rejects.toThrow(/auxiliary slot 4 output is 999 satoshis/);
    expect(attacked.signatureRequests.count).toBe(0);
  }, 300_000);

  it('HOSTILE: one padding slot no longer disables the sidecar value check', async () => {
    const attacked = await build({ padTail: true, auxValue999: true });
    // The padding is the only structural difference: nine slots instead of eight, the participant region and
    // all three sidecar slots at exactly the indices the canonical control puts them at.
    expect(attacked.builder.inputs).toHaveLength(9);
    expect(attacked.builder.outputs).toHaveLength(9);
    expect(attacked.builder.outputs[4].amount).toBe(999n);

    // The region is claimed at its POSITION. Before this change the width mismatch reported `[]` here, and the
    // check below did not run at all - the gate returned an assembly and passed.
    const assembly = derived(attacked)!;
    expect(assembly.auxiliaryInputs).toEqual([4, 5, 6]);

    expect(() => layer3.preflightLayer3BlockAssembly(attacked.builder))
      .toThrow(/auxiliary slot 4 output is 999 satoshis, the sidecar covenant requires 1000/);
    attacked.signatureRequests.count = 0;
    await expect(layer3.sendPreflightedLayer3Transaction(attacked.builder))
      .rejects.toThrow(/auxiliary slot 4 output is 999 satoshis/);
    expect(attacked.signatureRequests.count).toBe(0);
  }, 300_000);

  it('BOUNDARY: a padded tail with honest slot values is ACCEPTED here and refused by the controller', async () => {
    const padded = await build({ padTail: true });
    expect(padded.builder.inputs).toHaveLength(9);

    // Not a blanket refusal of widened tails: the model claims the three sidecar slots, finds them honest, and
    // passes. The padding slot at index 7 stays UNCLAIMED - an injected extra participant block lands there too,
    // so the model does not label it.
    const assembly = derived(padded)!;
    expect(assembly.auxiliaryInputs).toEqual([4, 5, 6]);
    expect(assembly.auxiliaryInputs).not.toContain(7);
    expect(layer3.preflightLayer3BlockAssembly(padded.builder)!.auxiliaryInputs).toEqual([4, 5, 6]);

    // And the shape is refused on chain by the rule that owns it: the graph-root controller at input 6 requires
    // `tx.inputs.length == this.activeInputIndex + 2`, which nine slots break.
    const outcome = await padded.provider.sendRawTransaction(padded.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    expect(outcome).toContain('error in evaluating input index 6');
  }, 300_000);
});
