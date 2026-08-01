import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments, keccakComputeLockingBytecode, scriptToBytecode } from '@solidcash/utils';
import { compileFile, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createEntryNftUnlocker, getDataNftAddress, getEntryNftAddress,
} from '../../src/stateful/covenant-helpers.js';
import { buildKeccakComputeSidecar, extractKeccakPreimageFromTrace } from '../../src/keccak/keccakComputeSidecar.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X136. THE L2-F2 REPAIR RECOVERED ~90 HANDLERS AND NOT ONE OF THEM HAD BEEN RUN.
 *
 * L2-F2 (`a2885464`) let the widest admission rung succeed where a code-generation crash had been silently
 * demoting contracts to a narrower one. The commit message says plainly that it did not VM-prove the shape it
 * recovered, and its own justification - "a route excluded from the map while a callee is in it always aborts,
 * so the only subjects are ones that did not compile" - is an argument about COMPILING, not about settling.
 *
 * `solidity-by-example/Airdrop` is the case that argument does not cover, and it was named as such: on
 * `EnglishAuction` and `Vault` the recovered route's `blockLayout` and `entryAccesses` are byte-identical to
 * before, and on `Airdrop` they are NOT. Its `getLeafHash` - `public pure`, `keccak256(abi.encode(to, amount))`
 * - became admissible, and admitting it put a `keccakSideCar` slot into the ROUTE's block:
 *
 *   before  blockSize 3  [master, dataNft, returnEvent]
 *   after   blockSize 5  [master, dataNft, keccakSideCar, entry, returnEvent]
 *
 * So "the recovery adds no covenant" is true on the scalar-vs-collection axis that X94 measured and NOT true
 * of the recovery in general. This file runs the after-shape to completion on mocknet.
 *
 * WHAT IS PROVED HERE, and it is one route out of the recovered population, not the population:
 *
 *  1. POSITIVE. The 5-slot recovered route settles: the graph controller attests, the projection verifies, the
 *     route co-spends and recreates the branded keccak side-car, and the return-event NFT carries the leaf
 *     hash the SDK never computed - it is extracted from the VM's own trace and then re-asserted by the VM.
 *  2. HOSTILE. A side-car recreated with a believable-wrong result - the leaf hash of a DIFFERENT amount, same
 *     length, same encoding, same everything else - is refused, at a named input index.
 *  3. HOSTILE. A return-event commitment carrying that same wrong hash is refused, at a named input index.
 *  4. GUARD NEGATIVE CONTROL. Each hostile differs from the positive in exactly one field, and the positive is
 *     rebuilt from the same helper in the same test, so an acceptance cannot be an evaluation that never ran.
 *
 * WHAT IS NOT PROVED. Airdrop's `claim` is REFUSED from the route
 * (`collection-route-requires-one-parameter-keyed-entry-per-collection`) and is not exercised. Every handler
 * this route admits is `writesState: false`, so this settles a read surface; it is not evidence about a
 * recovered handler that mutates. And one route is not ninety.
 */

const AIRDROP = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src/app/airdrop/Airdrop.sol`;

/** The side-car NFT's own category, distinct from the participant's - it is a pure-script compute library. */
const KECCAK_SIDECAR_CATEGORY = 'ee'.repeat(32);

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

/** The recovered route, compiled against a LIVE controller so the transcript it attests is the real one. */
function compileParticipant(controllerLbc: unknown, controllerCategory: string): any {
  return compileFile(AIRDROP, {
    solidityImportCompat: true,
    ecrecover: 'p2pkh',
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controllerLbc,
    experimentalMessageBusControllerCategory: controllerCategory,
  } as never);
}

/** What one built attempt needs to differ in. Exactly one field moves per hostile. */
type Attack = 'none' | 'sidecar-result' | 'return-commitment';

describe('X136: the route L2-F2 recovered on Airdrop, run to completion', () => {
  /**
   * THE COVENANT DELTA, MEASURED RATHER THAN QUOTED. This is the partition test: it states which side of the
   * "byte-identical" line Airdrop falls on, from this run's compile, so the rest of the file is known to be
   * exercising the moved shape and not a shape that never changed.
   */
  it('MEASURED: admitting getLeafHash put a keccakSideCar slot in the route block', () => {
    const artifact = compileParticipant(`aa20${'11'.repeat(32)}87`, '22'.repeat(32));
    const handlers = artifact.hiddenBatch!.handlers as any[];
    const eligible = handlers.filter((handler) => handler.eligible).map((handler) => handler.name);
    const refused = handlers.filter((handler) => !handler.eligible)
      .map((handler) => `${handler.name}:${handler.rejectionReason ?? 'unnamed'}`);
    console.log(`[X136] eligible ${JSON.stringify(eligible)}`);
    console.log(`[X136] refused  ${JSON.stringify(refused)}`);
    expect(eligible).toContain('getLeafHash');
    const layout = artifact.hiddenBatch!.route.blockLayout!;
    console.log(`[X136] route blockSize=${layout.blockSize} slots=`
      + `${JSON.stringify(layout.slots.map((slot: any) => slot.kind))}`);
    expect(layout.blockSize).toBe(5);
    expect(layout.slots.map((slot: any) => slot.kind))
      .toEqual(['master', 'dataNft', 'keccakSideCar', 'entry', 'returnEvent']);
    // The whole admitted surface is read-only, which is what this file's evidence is and is not about.
    for (const name of eligible) {
      const entry = artifact.abi.find((abi: any) => abi.name === name);
      expect(entry?.writesState, `${name} is not read-only`).toBe(false);
    }
    // `claim` is the one handler that writes, and the route does not take it. Named, not assumed.
    expect(refused).toContain('claim:collection-route-requires-one-parameter-keyed-entry-per-collection');
  }, 300_000);

  /**
   * Build one attempt at the recovered route and either send it or report the VM's refusal.
   *
   * The leaf-hash preimage is NEVER computed by this harness. It is read off the VM's own debug trace of the
   * first attempt (`extractKeccakPreimageFromTrace`, the same extractor the direct route's derivation uses),
   * so the value the covenant checks is the value the covenant produced - and a harness that guessed the ABI
   * encoding wrong could not accidentally agree with it.
   */
  async function attempt(attack: Attack, preimage: Uint8Array | undefined): Promise<{
    sent?: string; refusal?: string; discovered?: Uint8Array; leafHash: Uint8Array; wrongHash: Uint8Array;
  }> {
    const provider = createLayer3SemanticTestProvider();
    const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

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

    const artifact = compileParticipant(controller.lockingBytecode, controllerCategory);
    const base = new Contract(artifact, [], { provider });
    // `token` and `root` are Solidity immutables, which land in the data NFT rather than the redeem script.
    const merkleRoot = hexToBin('44'.repeat(32));
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {
      token: hexToBin(`aa20${'55'.repeat(32)}87`), root: merkleRoot,
    });
    const participant = base.withCategory(hexToBin(setup.categoryId));
    const entryAccess = artifact.hiddenBatch!.route.entryAccesses?.[0];
    if (entryAccess?.collection === undefined) throw new Error('Airdrop route published no entry collection');
    const entryAddress = getEntryNftAddress(participant, setup.categoryId, entryAccess.collection);
    const entryUtxo = (await provider.getUtxos(entryAddress))[0];
    if (entryUtxo === undefined) throw new Error('Airdrop claimed sentinel entry NFT was not staged');

    // The branded compute side-car, at the address salted with the participant's own category. The SAME salt
    // must build the redeem, or the input's P2SH hash does not match and nothing about keccak is reached.
    const sidecarSalt = hexToBin(setup.categoryId).slice().reverse();
    const sidecarLock = binToHex(keccakComputeLockingBytecode(sidecarSalt, true));
    const sidecarUtxo: Utxo = await (provider as any).addUtxo(sidecarLock, {
      ...randomUtxo({ satoshis: 100_000n }),
      token: { category: KECCAK_SIDECAR_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });

    const claimant = hexToBin(`aa20${'66'.repeat(32)}87`);
    const amount = 1_000n;

    // The transcript is fixed by the declared result alone, and the controller has to be rooted at it BEFORE
    // any transaction that attests it exists - so planning and building are separate steps.
    const planFor = (resultHash: Uint8Array): {
      plan: any; layout: any; transcript: any; resultVector: Uint8Array;
    } => {
      const plan = layer3.planCompiledGraph(
        [{
          artifact,
          lockingBytecode: participant.lockingBytecode,
          // The route declares `claimed`'s shared entry key because its public getter is also admitted.
          // `getLeafHash` binds no mapping key, so the caller supplies the sentinel filling the shared
          // route's published entry slot: the documented `unboundRouteWitnesses` case.
          unboundRouteWitnesses: { __scb_key_claimed_0: new Uint8Array(32) },
        }],
        [{ parent: null, callee: 0, function: 'getLeafHash', args: [claimant, amount] as never[] }],
      );
      const layout = layer3.compiledGraphPhysicalLayout(plan);
      const resultVector = scriptToBytecode([resultHash]);
      const transcript = layer3.finalizeCompiledGraph(
        plan, { 0: binToHex(resultVector) }, layout.participantInputs, layout.returnOutputs,
        [binToHex(resultVector)], layout.projectionInputs, '',
      );
      return { plan, layout, transcript, resultVector };
    };

    const buildOnce = (sidecarPreimage: Uint8Array, resultHash: Uint8Array, sidecarResult: Uint8Array): {
      tx: TransactionBuilder; transcriptRoot: string;
    } => {
      const { layout, transcript, resultVector } = planFor(resultHash);
      const sidecar = buildKeccakComputeSidecar(sidecarPreimage, sidecarSalt, sidecarUtxo, true);
      const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
      // Participant block, in published slot order: master, data NFT, side-car, mapping sentinel, return.
      tx.addInput(setup.masterUtxo, participant.createCompilerRouteUnlocker(
        artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
      )(
        ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as never[],
        BigInt(layout.returnOutputs![0]!),
      ));
      tx.addInput(setup.dataNftUtxos[0], createDataNftUnlocker(participant, 0, setup.categoryId));
      tx.addInput(sidecarUtxo, sidecar.unlocker);
      tx.addInput(entryUtxo, createEntryNftUnlocker(
        participant, 0, setup.categoryId, entryAccess.collection,
      ));
      tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
      tx.addInput(projectionUtxo, projection.unlock.verify(
        transcript.bytes, BigInt(layout.controllerInput), 0n,
      ));
      tx.addInput(rootedController!, controller.unlock.attest(transcript.bytes));
      tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

      tx.addOutput({
        to: participant.tokenAddress,
        amount: setup.masterUtxo.satoshis,
        token: {
          category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' },
        },
      });
      tx.addOutput({
        to: getDataNftAddress(participant, setup.categoryId),
        amount: setup.dataNftUtxos[0].satoshis,
        token: {
          category: setup.categoryId,
          amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: buildInitialStateCommitments(artifact.stateLayout!, {
              token: hexToBin(`aa20${'55'.repeat(32)}87`), root: merkleRoot,
            })[0],
          },
        },
      });
      // THE SIDE-CAR RECREATION carries the computed result. `sidecarResult` is the only thing the
      // `sidecar-result` hostile changes.
      tx.addOutput({
        to: hexToBin(sidecarLock),
        amount: sidecarUtxo.satoshis,
        token: {
          category: KECCAK_SIDECAR_CATEGORY,
          amount: 0n,
          nft: { capability: 'mutable', commitment: binToHex(sidecarResult) },
        },
      });
      tx.addOutput({
        to: entryAddress,
        amount: entryUtxo.satoshis,
        token: {
          category: setup.categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: entryUtxo.token!.nft!.commitment },
        },
      });
      // THE RETURN-EVENT NFT. `resultVector` is the only thing the `return-commitment` hostile changes.
      tx.addOutput({
        to: hexToBin('51'),
        amount: 1000n,
        token: {
          category: setup.categoryId,
          amount: 0n,
          nft: { capability: 'none', commitment: binToHex(scriptToBytecode([resultVector])) },
        },
      });
      tx.addOutput({ to: p2pkh.address, amount: 1000n });
      tx.addOutput({ to: p2pkh.address, amount: 1000n });
      tx.addOutput({ to: p2pkh.address, amount: 100_000n });
      return { tx, transcriptRoot: transcript.root };
    };

    const projectionUtxo = randomUtxo({ satoshis: 1000n });
    await provider.addUtxo(projection.address, projectionUtxo);
    const returnFunding = randomUtxo({ satoshis: 1000n });
    const fee = randomUtxo({ satoshis: 150_000n });
    for (const utxo of [returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);
    let rootedController: Utxo | undefined;

    // The result the transcript commits to, and therefore the root the controller must be initialized at.
    // A PROBE run declares a zero result and a zero side-car and is never broadcast - its only job is to make
    // the route reach its keccak side-car read under the VM debugger. Every run roots its own controller,
    // because the genesis NFT mints once and the root depends on the result being declared.
    const zero = new Uint8Array(32);
    const knownLeaf = preimage === undefined ? zero : keccak_256(preimage);
    const wrongPreimage = preimage === undefined ? undefined : Uint8Array.from(preimage);
    // A BELIEVABLE WRONG: the same encoder, the same length, one bit of the amount different. Not a random
    // 32 bytes - a hash the honest builder would have produced for a neighbouring claim.
    if (wrongPreimage) wrongPreimage[wrongPreimage.length - 1] ^= 0x01;
    const wrongHash = wrongPreimage === undefined ? zero : keccak_256(wrongPreimage);
    const declaredResult = attack === 'return-commitment' ? wrongHash : knownLeaf;
    const sidecarResult = attack === 'sidecar-result' ? wrongHash : knownLeaf;
    const plannedRoot = planFor(declaredResult).transcript.root as string;

    const initFee = randomUtxo({ satoshis: 20_000n });
    await provider.addUtxo(p2pkh.address, initFee);
    const initialize = new TransactionBuilder({ provider });
    initialize.addInput(
      genesis.utxos[0],
      controller.unlock.initialize(hexToBin(plannedRoot), alicePub, signature()),
    );
    initialize.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
    initialize.addOutput({
      to: controller.tokenAddress,
      amount: genesis.utxos[0].satoshis,
      token: {
        category: controllerCategory,
        amount: 0n,
        nft: { capability: 'mutable', commitment: plannedRoot },
      },
    });
    initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
    await provider.sendRawTransaction(raw(initialize));
    rootedController = (await provider.getUtxos(controller.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.commitment === plannedRoot);
    expect(rootedController, 'controller initialization did not root the authority').toBeDefined();

    const built = buildOnce(preimage ?? new Uint8Array(0), declaredResult, sidecarResult);
    if (preimage === undefined) {
      // PROBE. Read the preimage off the route's own execution rather than re-deriving the ABI encoding here.
      // Read the offset from the artifact: shared entry slots may move the side-car as admission evolves.
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const trace = vm.debug({
        inputIndex: 0,
        sourceOutputs: generateLibauthSourceOutputs(built.tx.inputs as never),
        transaction: built.tx.buildLibauthTransaction(),
      }) as unknown[];
      const sidecarIndex = (artifact.hiddenBatch!.route.blockLayout!.slots as any[])
        .findIndex((slot) => slot.kind === 'keccakSideCar');
      if (sidecarIndex < 0) throw new Error('Airdrop route published no keccak side-car slot');
      const extracted = extractKeccakPreimageFromTrace(trace, sidecarIndex, 1);
      return { discovered: extracted.preimage, leafHash: zero, wrongHash: zero };
    }
    try {
      const sent = await provider.sendRawTransaction(raw(built.tx));
      return { sent, leafHash: knownLeaf, wrongHash };
    } catch (error) {
      return { refusal: (error as Error).message, leafHash: knownLeaf, wrongHash };
    }
  }

  /**
   * The preimage the route hashes, read once off the VM and reused. It is `abi.encode(to, amount)` as the
   * COMPILER lays it out; nothing here re-implements that encoding, so a harness that guessed it wrong could
   * not accidentally agree with the covenant.
   */
  let cachedPreimage: Uint8Array | undefined;
  async function leafPreimage(): Promise<Uint8Array> {
    if (!cachedPreimage) {
      const probe = await attempt('none', undefined);
      cachedPreimage = probe.discovered!;
      console.log(`[X136] preimage ${cachedPreimage.length} B off the route's own trace: `
        + `${binToHex(cachedPreimage)}`);
    }
    return cachedPreimage;
  }

  /**
   * THE POSITIVE, and the guard negative control for both hostiles below: the same builder, the same
   * side-car, the same block - only the attacked field differs in the other two.
   */
  it('MEASURED: the recovered 5-slot route SETTLES with the keccak side-car co-spent', async () => {
    const result = await attempt('none', await leafPreimage());
    if (result.refusal) console.log(`[X136] positive refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, 'the recovered route did not settle').toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X136] settled ${result.sent}`);
  }, 600_000);

  it('HOSTILE: a side-car recreated with the leaf hash of a different preimage is refused', async () => {
    const result = await attempt('sidecar-result', await leafPreimage());
    console.log(`[X136] sidecar-result refusal: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    expect(result.sent, 'a forged side-car result was ACCEPTED').toBeUndefined();
    expect(result.refusal).toBeDefined();
    // The refusal must name the input the covenant failed at, and it must be the side-car's own slot or the
    // route that reads it - not "some input somewhere".
    expect(result.refusal).toMatch(/index (0|2)\b|input 0|input 2/i);
  }, 600_000);

  it('HOSTILE: a return-event NFT carrying a different leaf hash is refused', async () => {
    const result = await attempt('return-commitment', await leafPreimage());
    console.log(`[X136] return-commitment refusal: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    expect(result.sent, 'a forged return commitment was ACCEPTED').toBeUndefined();
    expect(result.refusal).toBeDefined();
    expect(result.refusal).toMatch(/index (0|4|5)\b|input 0|input 4|input 5/i);
  }, 600_000);
});
