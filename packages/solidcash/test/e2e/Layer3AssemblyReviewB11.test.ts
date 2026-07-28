import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, balancedAssemblyFromGraphLayout,
  preflightBalancedBlockAssembly, layer3,
} from '../../src/index.js';
import type { BalancedAssembly } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * Round-11 independent review of L2's derived block-assembly gate (`Layer3BalancedAssemblyL2.test.ts`).
 *
 * L2 wires `preflightBalancedBlockAssembly` into the layer-3 send path by DERIVING the assembly from the
 * builder's own inputs, and records the wiring as a gate the caller cannot decline:
 *
 *   "Every participant block starts at its master input, and that input's contract unlocker carries the ABI
 *    function whose `blockLayout` the compiler published. So the block set can be read off an unsigned builder
 *    with no cooperation from the caller - which is what makes the preflight a GATE rather than a capability
 *    the caller may decline to use."      (`stateful/balancedBlocks.ts`)
 *
 * These two cases attack that derivation. The fixture is L2's own two-participant returning graph, unchanged
 * except for one field per case, and each hostile row is paired with the honest control it differs from.
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
contract L2ReturningB(int brand) {
  function twice(int n) public pure returns (int, int) {
    require(n >= 0);
    return (n * 2, n + 10);
  }
}`;
const RETURNING_A = `pragma solidcash >=0.8.0;
interface IL2ReturningB { function twice(int n) returns (int, int); }
contract L2ReturningA(int brand, address target) {
  function plusOne(int n) public pure returns (int) {
    int child, int witness = IL2ReturningB(target).twice(n);
    require(child >= 0 && witness == n + 10);
    return child + 1;
  }
}`;

type Shape =
  | 'none'
  // L2's own preflight-only shape: the in-block event is honest and a copy of it lands in the tail.
  | 'event-cloned-to-tail'
  // One field: the first projection slot's paired output value. The sidecar covenant pins it at 1,000.
  | 'aux-value-999';

interface Built {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  assembly: BalancedAssembly;
  layout: ReturnType<typeof layer3.compiledGraphPhysicalLayout>;
  signatureRequests: { count: number };
}

async function build(shape: Shape = 'none'): Promise<Built> {
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
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: genesis.categoryId as string,
  };
  const artifactB = compileString(RETURNING_B, options);
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(RETURNING_A, options);
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
  const feeFunder = randomUtxo({ satoshis: 50_000n });
  for (const utxo of [slotFunderA, slotFunderB, feeFunder]) await provider.addUtxo(p2pkh.address, utxo);
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
  tx.addOutput({ to: p2pkh.address, amount: shape === 'aux-value-999' ? 999n : 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  if (shape === 'event-cloned-to-tail') tx.addOutput({ ...returnEventA, amount: 10_000n });
  else tx.addOutput({ to: p2pkh.address, amount: 10_000n });

  return {
    provider,
    builder: tx,
    transaction: raw(tx),
    assembly: balancedAssemblyFromGraphLayout(plan.participants, layout),
    layout,
    signatureRequests,
  };
}

/** Strip `abiFunction` from one input's unlocker, leaving an unlocker that still produces identical bytecode. */
const dropAbiFunction = (builder: TransactionBuilder, index: number): void => {
  const original = (builder.inputs as any)[index].unlocker;
  (builder.inputs as any)[index].unlocker = {
    generateUnlockingBytecode: (...args: unknown[]) => original.generateUnlockingBytecode(...args),
    generateLockingBytecode: (...args: unknown[]) => original.generateLockingBytecode(...args),
  };
};

describe('B/round-11 review of L2: the derived block-assembly gate', () => {
  /**
   * FINDING. The derivation keys on `input.unlocker.abiFunction`, an object field the CALLER owns. An unlocker
   * that produces byte-identical unlocking bytecode but does not re-expose `abiFunction` makes
   * `deriveBalancedAssemblyFromInputs` return `undefined`, so the wired gate skips the transaction entirely.
   *
   * The shape used is L2's own `event-cloned-to-tail`, which L2 records as preflight-only: the BCH-2026 VM
   * ACCEPTS it. So silencing the derivation is not merely a missed warning - it is the whole protection.
   */
  it('REVIEW-L2-1: dropping `abiFunction` on input 0 silences the wired gate on a shape the VM accepts', async () => {
    // Honest control: the unlocker is untouched, the gate fires and names the escaped NFT.
    const control = await build('event-cloned-to-tail');
    expect(() => layer3.preflightLayer3BlockAssembly(control.builder))
      .toThrow(/output 7 carries a token outside every participant block \(region ends at 4\)/);

    // Hostile: the SAME transaction, differing in exactly one field - input 0's unlocker no longer carries
    // `abiFunction`. Nothing about the transaction bytes changes.
    const attacked = await build('event-cloned-to-tail');
    const before = raw(attacked.builder);
    dropAbiFunction(attacked.builder, 0);
    expect(raw(attacked.builder)).toBe(before);

    // The gate is now silent, and the production send path broadcasts the shape the control refuses.
    expect(layer3.preflightLayer3BlockAssembly(attacked.builder)).toBeUndefined();
    await expect(layer3.sendPreflightedLayer3Transaction(attacked.builder))
      .resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 180_000);

  /**
   * FINDING. `deriveBalancedAssemblyFromInputs` returns `auxiliaryInputs: []`, so on the wired path the two
   * checks `preflightBalancedBlockAssembly` performs against auxiliary slots never run - including the one the
   * module documents as covenant-required ("both generated sidecar covenants carry
   * `require(tx.outputs[this.activeInputIndex].value == 1000)`").
   *
   * The declared-layout call and the derived call disagree on the same builder: one rejects at slot 4, the
   * other reports clean.
   */
  it('REVIEW-L2-2: the derived assembly drops every auxiliary slot, so the sidecar value check is dead', async () => {
    const attacked = await build('aux-value-999');
    expect(attacked.builder.outputs[4].amount).toBe(999n);

    // The capability, called with the layout the SDK declares, rejects the slot by index.
    expect(() => preflightBalancedBlockAssembly(attacked.builder, attacked.assembly))
      .toThrow(/auxiliary slot 4 output is 999 satoshis, the sidecar covenant requires 1000/);
    expect(attacked.assembly.auxiliaryInputs).toEqual([4, 5, 6]);

    // The wired gate, on the same builder, sees no auxiliary slots at all and reports clean.
    const derived = layer3.preflightLayer3BlockAssembly(attacked.builder);
    expect(derived).toBeDefined();
    expect(derived!.auxiliaryInputs).toEqual([]);

    // The VM does enforce it - but only after `build()` has taken every signature.
    attacked.signatureRequests.count = 0;
    await expect(layer3.sendPreflightedLayer3Transaction(attacked.builder))
      .rejects.toThrow(/preflight failed at input 4/);
    expect(attacked.signatureRequests.count).toBeGreaterThan(0);

    // Honest control: the same build differing only in that slot's value settles and preflights clean both ways.
    const control = await build();
    expect(control.builder.outputs[4].amount).toBe(1000n);
    preflightBalancedBlockAssembly(control.builder, control.assembly);
    expect(layer3.preflightLayer3BlockAssembly(control.builder)).toBeDefined();
    await expect(control.provider.sendRawTransaction(control.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);
});
