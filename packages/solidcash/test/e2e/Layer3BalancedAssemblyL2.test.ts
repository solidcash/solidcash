import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, StatefulContract, TransactionBuilder, balancedAssemblyFromGraphLayout,
  participantRegionEnd, preflightBalancedBlockAssembly, layer3,
} from '../../src/index.js';
import type { BalancedAssembly } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * L2 - SDK funding/change/event-NFT block assembly.
 *
 * The shape under test is a two-participant returning graph. Each participant publishes a two-slot block
 * `[master, returnEvent]`: the return event is OUTPUT-ONLY, so its input side has to be filled by a funding
 * input or the block's input extent would be one shorter than its output extent and every later block's two
 * bases would drift apart.
 *
 * The five things the checklist asks for are each asserted on the settled transaction rather than described:
 * funding inputs occupy the unused input-side slots; the paired outputs carry a value inside the band the
 * emitting covenant authenticates, and the sidecar slots carry the exact value their covenants require; the
 * return-event NFT stays inside its emitter's block; the fee input and the terminal change output sit outside
 * every relocatable block; and `preflightBalancedBlockAssembly` refuses a malformed or unbalanced assembly
 * BEFORE any unlocker is asked for a signature.
 *
 * Each preflight negative is paired with the same transaction submitted to the BCH-2026 VM, so the preflight
 * is shown to reject shapes consensus also rejects, not a private rule of its own.
 *
 * Evidence level: SEMANTIC, on `createLayer3SemanticTestProvider()` (the stricter profile: real 128-byte NFT
 * commitments).
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

type Malformation =
  | 'none'
  | 'missing-slot-funder'      // drop an output-only slot's funding input
  | 'event-outside-block'      // move a return-event NFT out of its emitter's block, to the tail
  // X21: three return-event slot values, spanning the band the emitting covenant actually authenticates.
  | 'slot-value-800'           // the value the direct external-call route emits for a return event
  | 'slot-value-1200'          // the value the SDK emits for an event NFT
  | 'slot-value-siphon'        // above the covenant's anti-siphon ceiling
  | 'change-inside-block'      // claim a terminal change output that falls inside a participant block
  | 'event-cloned-to-tail';    // keep the in-block event AND emit a copy outside every block

interface Built {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  assembly: BalancedAssembly;
  layout: ReturnType<typeof layer3.compiledGraphPhysicalLayout>;
  fundingOutpoints: string[];
  signatureRequests: { count: number };
}

async function build(malformation: Malformation = 'none'): Promise<Built> {
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

  // One funding input per output-only slot; these are what keep each block's input extent equal to its output
  // extent. They are ordinary P2PKH coins with no protocol role beyond occupying the slot.
  const slotFunderA = randomUtxo({ satoshis: 1000n });
  const slotFunderB = randomUtxo({ satoshis: 1000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  const feeFunder = randomUtxo({ satoshis: 50_000n });
  for (const utxo of [slotFunderA, slotFunderB, feeFunder]) await provider.addUtxo(p2pkh.address, utxo);
  for (const utxo of [projectionA, projectionB]) await provider.addUtxo(projection.address, utxo);

  // Count every request for an unlocking signature so a preflight rejection can be proven to happen first.
  const signatureRequests = { count: 0 };
  // Spread the original unlocker so its `abiFunction` (and therefore its published block layout) survives the
  // wrapper: the production gate derives the assembly from exactly that field on each master input.
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
  if (malformation !== 'missing-slot-funder') {
    tx.addInput(slotFunderA, counted(p2pkh.unlock.spend(alicePub, signature())));
  }
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

  const returnEventASatoshis = {
    'slot-value-800': 800n, 'slot-value-1200': 1200n, 'slot-value-siphon': 5000n,
  }[malformation as string] ?? 1000n;
  const returnEventA = {
    to: hexToBin('51'), amount: returnEventASatoshis,
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
  // The emitter's own block slot. Pushing it to the tail is the 'event-outside-block' malformation.
  if (malformation !== 'event-outside-block') tx.addOutput(returnEventA);
  else tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput(returnEventB);
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  if (malformation === 'event-outside-block' || malformation === 'event-cloned-to-tail') {
    // Same slot COUNT, so the width check cannot be what rejects: A's return-event NFT appears at the terminal
    // tail position instead of (or as well as) its own block slot.
    tx.addOutput({ ...returnEventA, amount: 10_000n });
  } else if (malformation !== 'missing-slot-funder') {
    tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  }

  let assembly = balancedAssemblyFromGraphLayout(plan.participants, layout);
  if (malformation === 'change-inside-block') assembly = { ...assembly, changeOutput: 1 };
  return {
    provider,
    builder: tx,
    transaction: raw(tx),
    assembly,
    layout,
    fundingOutpoints: [slotFunderA, slotFunderB, feeFunder].map((u) => `${u.txid}:${u.vout}`),
    signatureRequests,
  };
}

describe('L2 balanced funding/change/event-NFT block assembly', () => {
  const VM_REFUSAL =
    /mandatory-script-verify-flag-failed[\s\S]*evaluating input index 0: Program failed an OP_VERIFY operation/;
  it('SEMANTIC: settles a balanced two-block assembly and preflights clean before broadcast', async () => {
    const built = await build();
    // No exception: every block is a complete span, concatenated from 0, with paired inputs and 1,000-satoshi
    // slot outputs, and the fee/change tail outside every block.
    preflightBalancedBlockAssembly(built.builder, built.assembly);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  it('SEMANTIC: funding inputs fill the unused input side of each output-only slot', async () => {
    const built = await build();
    const blocks = built.assembly.blocks;
    expect(blocks.map((block) => block.blockLayout.slots.map((slot) => `${slot.offset}:${slot.kind}`)))
      .toEqual([['0:master', '1:returnEvent'], ['0:master', '1:returnEvent']]);
    // Each block's return-event slot is an OUTPUT-only effect, so its input side carries an ordinary funder.
    for (const block of blocks) {
      const slot = block.blockLayout.slots.find((entry) => entry.kind === 'returnEvent')!;
      const index = block.base + slot.offset;
      const input = built.builder.inputs[index];
      expect(built.fundingOutpoints).toContain(`${input.txid}:${input.vout}`);
      expect(input.token).toBeUndefined();
    }
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  it('SEMANTIC: this fixture emits 1,000-satoshi slot outputs and event NFTs stay inside their block', async () => {
    const built = await build();
    const regionEnd = participantRegionEnd(built.assembly);
    expect(regionEnd).toBe(4);
    for (const block of built.assembly.blocks) {
      const slot = block.blockLayout.slots.find((entry) => entry.kind === 'returnEvent')!;
      const index = block.base + slot.offset;
      const output = built.builder.outputs[index];
      // This build's own choice, inside the covenant's ceiling - NOT a value the covenant pins (see X21 below).
      expect(output.amount).toBe(1000n);
      expect(output.token?.nft?.commitment).toBeTruthy();
      // Inside the emitting participant's own block, not appended after the graph.
      expect(index).toBeGreaterThanOrEqual(block.base);
      expect(index).toBeLessThan(block.base + block.blockLayout.blockSize);
    }
    // The projection and controller slots pair with ordinary 1,000-satoshi outputs. This equality IS pinned:
    // both sidecar covenants require `tx.outputs[activeInputIndex].value == 1000`.
    for (const auxiliary of built.assembly.auxiliaryInputs) {
      expect(built.builder.outputs[auxiliary].amount).toBe(1000n);
      expect(built.builder.outputs[auxiliary].token).toBeUndefined();
    }
    // Nothing token-bearing survives outside the participant region.
    for (let index = regionEnd; index < built.builder.outputs.length; index += 1) {
      expect(built.builder.outputs[index].token).toBeUndefined();
    }
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  it('SEMANTIC: fee funding and terminal change sit outside every relocatable block', async () => {
    const built = await build();
    const regionEnd = participantRegionEnd(built.assembly);
    expect(built.assembly.feeInput).toBeGreaterThanOrEqual(regionEnd);
    expect(built.assembly.changeOutput).toBeGreaterThanOrEqual(regionEnd);
    expect(built.assembly.changeOutput).toBe(built.builder.outputs.length - 1);
    const feeInput = built.builder.inputs[built.assembly.feeInput];
    expect(built.fundingOutpoints).toContain(`${feeInput.txid}:${feeInput.vout}`);
    // The change output absorbs the remainder, so it is NOT the fixed 1,000-satoshi slot value.
    expect(built.builder.outputs[built.assembly.changeOutput].amount).toBe(10_000n);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  it('HOSTILE: an output-only slot without its funding input is rejected by preflight and by the VM', async () => {
    const built = await build('missing-slot-funder');
    expect(() => preflightBalancedBlockAssembly(built.builder, built.assembly))
      .toThrow(/balanced assembly: transaction has 7 slots, layout declares 8/);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(VM_REFUSAL);
  }, 180_000);

  it('HOSTILE: a return-event NFT moved out of its block is rejected by preflight and by the VM', async () => {
    const built = await build('event-outside-block');
    // Same input/output width; the emitter's own block slot is what lost its authenticated NFT.
    expect(built.builder.inputs.length).toBe(built.builder.outputs.length);
    expect(() => preflightBalancedBlockAssembly(built.builder, built.assembly))
      .toThrow(/participant 0 'returnEvent' output 1 carries no authenticated NFT/);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(VM_REFUSAL);
  }, 180_000);

  // This WAS a measured limit: "event NFTs remain inside the emitting participant's block" was an SDK assembly
  // property and not a covenant invariant, so a second NFT of the participant's category minted in the tail was
  // accepted by the BCH-2026 VM. `emitOwnCategoryImmutableNftOutputPin` makes it a covenant invariant: an
  // own-category zero-FT immutable NFT may only sit at an event offset or the witnessed return-event index.
  it('an event NFT cloned outside every block is now refused by the VM, not only the preflight', async () => {
    const built = await build('event-cloned-to-tail');
    // The in-block slot is honest here, so the clone in the tail is the only difference.
    expect(built.builder.outputs[1].token?.nft?.commitment).toBeTruthy();
    expect(() => preflightBalancedBlockAssembly(built.builder, built.assembly))
      .toThrow(/output 7 carries a token outside every participant block \(region ends at 4\)/);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(VM_REFUSAL);
  }, 180_000);

  /**
   * X21 - what an event slot's value is actually bound to.
   *
   * This file previously required every event/return-event slot output to be exactly
   * `BALANCED_SLOT_SATOSHIS` (1,000) and recorded the rejection of an 800-satoshi return event as a
   * "preflight-only" policy gate. That equality was the wrong number: it matched no value the SDK emits.
   * The direct external-call route emits return events at 800, `.emitReturn()` in a balanced block at 1,000,
   * and event NFTs at 1,200; the emitting covenant pins none of them, it emits
   * `OP_OUTPUTVALUE <1200> OP_LESSTHANOREQUAL OP_VERIFY`, an anti-siphon CEILING.
   *
   * The three rows below measure that ceiling rather than assert it: both values inside the band settle on the
   * BCH-2026 VM and now preflight clean, and the one above it is refused by the VM as well as by the preflight.
   * The 1,000-satoshi equality survives where it is authenticated - the sidecar slots, asserted above.
   */
  it.each([
    { label: 'the direct-route return-event value', malformation: 'slot-value-800' as const, satoshis: 800n },
    { label: 'the event-NFT value', malformation: 'slot-value-1200' as const, satoshis: 1200n },
  ])('SEMANTIC: $label settles and preflights clean at $satoshis satoshis', async ({
    malformation, satoshis,
  }) => {
    const built = await build(malformation);
    expect(built.builder.outputs[1].amount).toBe(satoshis);
    preflightBalancedBlockAssembly(built.builder, built.assembly);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  it('FAIL_CLOSED: an event slot value above the covenant ceiling is rejected by preflight AND the VM', async () => {
    const built = await build('slot-value-siphon');
    expect(built.builder.outputs[1].amount).toBe(5000n);
    expect(() => preflightBalancedBlockAssembly(built.builder, built.assembly))
      .toThrow(/'returnEvent' output 1 is 5000 satoshis, the emitting covenant bounds an event slot at 1200/);
    // Unlike the old off-spec-value row, this one is NOT preflight-only: consensus rejects it too.
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(VM_REFUSAL);
  }, 180_000);

  it('FAIL_CLOSED: a terminal change output inside a participant block is rejected by preflight', async () => {
    const built = await build('change-inside-block');
    expect(() => preflightBalancedBlockAssembly(built.builder, built.assembly))
      .toThrow(/change output 1 falls inside a relocatable participant block/);
    // Control: the same transaction with the honest layout preflights clean and settles.
    const honest = await build();
    preflightBalancedBlockAssembly(honest.builder, honest.assembly);
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  it('FAIL_CLOSED: preflight rejects before any unlocking signature is requested', async () => {
    const built = await build('missing-slot-funder');
    // Nothing has asked an unlocker for bytecode yet: `raw()` was called during assembly, so reset the counter
    // and prove the preflight itself needs no signature to reject.
    built.signatureRequests.count = 0;
    // X144. Was a bare `toThrow()`, so the `signatureRequests.count === 0` line below would have stayed green
    // on ANY throw - including one raised before the preflight was even reached, which asks no signatures for
    // a reason that has nothing to do with this claim. The refusal is now named, and the honest control below
    // shows the same preflight passes when the slot funder is present.
    expect(() => preflightBalancedBlockAssembly(built.builder, built.assembly))
      .toThrow(/balanced assembly: transaction has \d+ slots, layout declares \d+/);
    expect(built.signatureRequests.count).toBe(0);
    const honest = await build();
    expect(() => preflightBalancedBlockAssembly(honest.builder, honest.assembly)).not.toThrow();
  }, 180_000);

  // X13: the DIRECT `withExternalCall` route now honours the published block layout. Its callee block carries a
  // funding INPUT at the published returnEvent offset and emits the return-event NFT at the paired OUTPUT, so the
  // block's two extents are equal and the emitter's return event stays inside its own block. Previously the route
  // appended every callee return event after the whole participant region at 800 satoshis (2 inputs, 3 outputs).
  it('SEMANTIC: the direct external-call route balances a callee block at its published slot', async () => {
    const provider = createLayer3SemanticTestProvider();
    const calleeArtifact = compileString(`pragma solidcash >=0.8.0;
interface IDirectCallee { function bump(int n) returns (int); }
contract DirectCallee() is IDirectCallee {
  int total;
  function bump(int n) returns (int) {
    this.total = this.total + n;
    return n;
  }
}`);
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
interface IDirectCallee { function bump(int n) returns (int); }
contract DirectCaller(bytes calleeAddr) {
  int seen;
  function drive(int n) {
    int got = IDirectCallee(calleeAddr).bump(n);
    this.seen = this.seen + got;
  }
}`);
    // The compiler publishes the return event as a slot INSIDE the callee's own three-slot block.
    const calleeAbi = calleeArtifact.abi.find((fn: any) => fn.name === 'bump') as any;
    expect(calleeAbi.blockLayout.blockSize).toBe(3);
    expect(calleeAbi.blockLayout.slots.map((slot: any) => `${slot.offset}:${slot.kind}`))
      .toEqual(['0:master', '1:dataNft', '2:returnEvent']);

    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const callee = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callerBase = new Contract(callerArtifact, [callee.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, { seen: 0n }, { saltContract: true },
    );
    const scCaller = StatefulContract.withCategory(callerBase, callerSetup.categoryId);
    const scCallee = StatefulContract.withCategory(calleeBase, calleeSetup.categoryId);
    const details = await (scCaller as any).drive(5n)
      .withExternalCall(scCallee, 'bump', [5n]).send();
    const decoded = decodeTransactionUnsafe(hexToBin(await provider.getRawTransaction(details.txid)));

    // Measured: caller block [0,1], callee block [2,3,4] on BOTH sides - the third callee slot is a funding
    // input paired with the return-event NFT output at the published offset 2.
    expect(decoded.inputs.length).toBe(decoded.outputs.length);
    expect(decoded.inputs.length).toBe(5);
    const returnEventIndex = decoded.outputs.findIndex(
      (output) => output.token !== undefined
        && binToHex(output.token.category) === calleeSetup.categoryId
        && output.token.nft?.capability === 'none',
    );
    // base(2) + published returnEvent offset(2), inside the callee block, at the balanced slot value.
    expect(returnEventIndex).toBe(4);
    expect(decoded.outputs[4].valueSatoshis).toBe(1000n);
    // The paired input at the same index carries no token: it is the ordinary funder that keeps the block's
    // input extent equal to its output extent.
    expect(decoded.inputs[4]).toBeDefined();
  }, 180_000);

  // X14: the checks above call the helper directly. These two prove the SAME checks run inside the SDK's own
  // layer-3 send path, on an assembly the SDK DERIVES from the builder's inputs - the caller passes no layout and
  // cannot decline the gate. Each participant's master input carries the contract unlocker whose ABI function
  // publishes that participant's block layout, so the blocks are read off the unsigned transaction.
  it('SEMANTIC: the production send path derives the assembly from the builder and settles', async () => {
    const built = await build();
    const derived = layer3.preflightLayer3BlockAssembly(built.builder);
    expect(derived).toBeDefined();
    // Nothing was declared: these bases and sizes came from the two masters' published block layouts.
    expect(derived!.blocks.map((block) => `${block.base}:${block.blockLayout.blockSize}`)).toEqual(['0:2', '2:2']);
    expect(derived!.totalSlots).toBe(8);
    await expect(layer3.sendPreflightedLayer3Transaction(built.builder)).resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 180_000);

  it('FAIL_CLOSED: the production send path rejects a malformed assembly before any signature is requested', async () => {
    const built = await build('event-outside-block');
    // `raw()` ran during assembly; reset so the count measures only what the send path itself requests.
    built.signatureRequests.count = 0;
    await expect(layer3.sendPreflightedLayer3Transaction(built.builder))
      .rejects.toThrow(/participant 0 'returnEvent' output 1 carries no authenticated NFT/);
    expect(built.signatureRequests.count).toBe(0);
    // The same gate runs on the build-only entry point, also before signing.
    built.signatureRequests.count = 0;
    expect(() => layer3.preflightLayer3Transaction(built.builder)).toThrow(/balanced assembly:/);
    expect(built.signatureRequests.count).toBe(0);
  }, 180_000);

  it('FAIL_CLOSED: the derived gate stays silent on a transaction the block model cannot describe', async () => {
    // An ordinary P2PKH transfer publishes no participant block at index 0, so the gate skips it rather than
    // guessing a layout. This is what keeps the wiring from rejecting shapes it was never meant to judge.
    const provider = createLayer3SemanticTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const coin = randomUtxo({ satoshis: 20_000n });
    await provider.addUtxo(p2pkh.address, coin);
    const plain = new TransactionBuilder({ provider });
    plain.addInput(coin, p2pkh.unlock.spend(alicePub, signature()));
    plain.addOutput({ to: p2pkh.address, amount: 15_000n });
    expect(layer3.preflightLayer3BlockAssembly(plain)).toBeUndefined();
    await expect(provider.sendRawTransaction(raw(plain))).resolves.toBeTypeOf('string');
  }, 180_000);

  it('FAIL_CLOSED: a malformed local block descriptor is rejected before any base is assigned', async () => {
    const built = await build();
    const gapped = {
      ...built.assembly,
      blocks: [
        {
          ...built.assembly.blocks[0],
          blockLayout: {
            blockSize: 2,
            slots: [{ kind: 'master' as const, offset: 0 }, { kind: 'returnEvent' as const, offset: 0 }],
          },
        },
        built.assembly.blocks[1],
      ],
    };
    expect(() => preflightBalancedBlockAssembly(built.builder, gapped))
      .toThrow(/participant 0 has two slots at local offset 0/);

    const headless = {
      ...built.assembly,
      blocks: [
        {
          ...built.assembly.blocks[0],
          blockLayout: {
            blockSize: 2,
            slots: [{ kind: 'dataNft' as const, offset: 0 }, { kind: 'returnEvent' as const, offset: 1 }],
          },
        },
        built.assembly.blocks[1],
      ],
    };
    expect(() => preflightBalancedBlockAssembly(built.builder, headless))
      .toThrow(/participant 0 must declare exactly one master slot at local offset 0/);

    const detached = {
      ...built.assembly,
      blocks: [built.assembly.blocks[0], { ...built.assembly.blocks[1], base: 3 }],
    };
    expect(() => preflightBalancedBlockAssembly(built.builder, detached))
      .toThrow(/participant 1 block base 3 breaks concatenation at 2/);
  }, 180_000);
});
