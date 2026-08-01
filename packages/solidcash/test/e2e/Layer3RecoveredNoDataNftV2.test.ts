import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, encodeTransaction, hexToBin, utf8ToBin,
} from '@bitauth/libauth';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import { compileFileMulti, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { getEventNftAddress } from '../../src/stateful/covenant-helpers.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X177/X180 BREADTH: THE TWO RECOVERED SHAPES THAT CARRY NO DATA NFT AT ALL.
 *
 * Every recovered handler run to a settlement so far sits on a block of the form `master dataNft* returnEvent`
 * (or that plus `entry` / `trailing`). Two of the 206 do not, and neither had ever been driven to a
 * transaction of its own:
 *
 *   contract              handler   block                              why it is different
 *   Bar                   log       master + 8 EVENT                   no data NFT AND no return-event slot
 *   TestTransientStorage  val       master + returnEvent               no data NFT, no persisted state at all
 *
 * `Bar.log` is one of the ELEVEN gained writers, and one of the FOUR that publish `writesState` ABSENT rather
 * than true. Its body is `emit Log("Bar was called")` - it mutates nothing, which is exactly why the flag is
 * absent, and this file states that rather than inheriting the "writer" label. What it does carry that no
 * settled subject before it carried is an EMISSION: the route frames eight event slots and the handler fills
 * the first, so the covenant's emission check is on the critical path here and nowhere else in the recovered
 * population.
 *
 * `Bar.log` was also the callee of `Foo.callBar`, the two-participant graph that
 * `Layer3RecoveredExternalWriterX177.test.ts` could not settle. X187 then retired `callBar` at ADMISSION, so
 * that graph cannot be built at all. This file separates the two questions: whether `Bar.log` can settle as a
 * participant in its own right is answerable now, and the answer is not inherited from the caller's fate.
 *
 * WHAT EACH ROW COSTS.
 *
 *  - POSITIVE. One broadcast transaction, built by the same helper as the hostiles.
 *  - HOSTILE (emission commitment). `Bar`'s event NFT carries the covenant's own bytes with ONE BYTE MOVED.
 *    Refused at input 0.
 *  - HOSTILE (emission address). The same event NFT sent to the participant's own token address instead of
 *    the event NFT address - the output EXISTS and carries the right commitment, so this separates "an output
 *    is there" from "the emission is bound to where the route says". Refused at input 0.
 *  - HOSTILE (result). `TestTransientStorage.val`'s return event carries a believable-wrong commitment.
 *    Refused at input 0.
 *
 * WHAT IS NOT CLAIMED. `TestTransientStorage` declares NO persisted state, so there is no one-field-moved
 * state hostile to build for it and none is faked; its liveness rests on the result hostile alone, and that
 * is said here rather than papered over. Neither row is a writer proof: `writesState` is ABSENT on both, and
 * X177 already established that the absent-flag handlers do not mutate.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;
const EXTERNAL = `${SBE}/hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol`;
const TRANSIENT = `${SBE}/transient-storage/TransientStorage.sol`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  experimentalHiddenBatch: true,
};

/** A distinctive placeholder result: the probe declares it, so the trace's OTHER operand is the real one. */
const PROBE_RESULT = hexToBin('9e'.repeat(32));

/** The literal `Bar.log` emits. Taken from the pinned source, not invented. */
const LOG_MESSAGE = 'Bar was called';

/** `TestTransientStorage.val` is a getter over transient storage; the route computes its own result. */
const TRANSIENT_STATE: Record<string, unknown> = {};

type BarAttack = 'none' | 'emission-commitment' | 'emission-address';
type ValAttack = 'none' | 'result';

describe('X177/X180 breadth: the recovered shapes with no data NFT', () => {
  /** The value the route ITSELF computed, read off its own execution rather than encoded here. */
  function operandComparedAgainst(trace: unknown[], placeholder: Uint8Array, label: string): Uint8Array {
    const wanted = binToHex(placeholder);
    let found: Uint8Array | undefined;
    for (const state of trace) {
      const step = state as { stack?: Uint8Array[]; controlStack?: unknown[] };
      if (step.controlStack?.some((entry) => entry === false)) continue;
      const stack = step.stack;
      if (!stack || stack.length < 2) continue;
      const top = stack[stack.length - 1];
      const below = stack[stack.length - 2];
      if (binToHex(top) === wanted && binToHex(below) !== wanted) found = Uint8Array.from(below);
      else if (binToHex(below) === wanted && binToHex(top) !== wanted) found = Uint8Array.from(top);
    }
    if (found === undefined) throw new Error(`${label}: the probe trace never compared the declared value`);
    return found;
  }

  /** One graph-root controller, rooted at the transcript, shared by both rows' harnesses. */
  async function rootController(provider: any, transcriptRoot: string, controller: Contract, genesis: any,
    p2pkh: Contract, controllerCategory: string): Promise<Utxo> {
    const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
    const initFee = randomUtxo({ satoshis: 20_000n });
    await provider.addUtxo(p2pkh.address, initFee);
    const initialize = new TransactionBuilder({ provider });
    initialize.addInput(
      genesis.utxos[0], controller.unlock.initialize(hexToBin(transcriptRoot), alicePub, signature()),
    );
    initialize.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
    initialize.addOutput({
      to: controller.tokenAddress,
      amount: genesis.utxos[0].satoshis,
      token: {
        category: controllerCategory, amount: 0n, nft: { capability: 'mutable', commitment: transcriptRoot },
      },
    });
    initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
    await provider.sendRawTransaction(raw(initialize));
    const rooted: Utxo | undefined = (await provider.getUtxos(controller.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.commitment === transcriptRoot);
    expect(rooted, 'controller initialization did not root the authority').toBeDefined();
    return rooted!;
  }

  /** One attempt at `Bar.log` as a participant in its own right: one master input and eight event slots. */
  async function attemptBar(attack: BarAttack):
  Promise<{ sent?: string; refusal?: string; failingInput?: number; eventSlots: number; participants: number }> {
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
    const map = compileFileMulti(EXTERNAL, {
      ...BUS,
      experimentalMessageBusController: controller.lockingBytecode,
      experimentalMessageBusControllerCategory: controllerCategory,
    } as never) as any;
    const artifact = map.Bar;
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
    const bar = base.withCategory(hexToBin(setup.categoryId));

    const plan = layer3.planCompiledGraph(
      [{ artifact, lockingBytecode: bar.lockingBytecode }],
      [{ parent: null, callee: 0, function: 'log', args: [] as never[] }],
    );
    const layout = layer3.compiledGraphPhysicalLayout(plan);
    // VOID and no return-event slot at all: the transcript declares no return output and an empty vector.
    const transcript = layer3.finalizeCompiledGraph(
      plan, {}, layout.participantInputs, plan.participants.map(() => null),
      plan.participants.map(() => ''), layout.projectionInputs, '',
    );
    const rooted = await rootController(
      provider, transcript.root, controller, genesis, p2pkh, controllerCategory,
    );

    const projectionUtxo = randomUtxo({ satoshis: 1000n });
    const fee = randomUtxo({ satoshis: 600_000n });
    await provider.addUtxo(projection.address, projectionUtxo);
    await provider.addUtxo(p2pkh.address, fee);

    // The emitted argument is the source literal, encoded as the single push the emission commitment is.
    const honest = scriptToBytecode([utf8ToBin(LOG_MESSAGE)]);
    const forged = Uint8Array.from(honest);
    forged[forged.length - 1] ^= 0x01;
    const commitment = binToHex(attack === 'emission-commitment' ? forged : honest);
    const eventAddress = getEventNftAddress(bar, setup.categoryId, artifact.events![0].signature);

    const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    let eventSlots = 0;
    let eventCursor = 0;
    for (const slot of artifact.hiddenBatch!.route.blockLayout!.slots as any[]) {
      switch (slot.kind) {
        case 'master':
          tx.addInput(setup.masterUtxo, bar.createCompilerRouteUnlocker(
            artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
          )(
            ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as never[],
            ...(layout.returnOutputs[0] === null ? [] : [BigInt(layout.returnOutputs[0]!)]) as never[],
          ));
          tx.addOutput({
            to: bar.tokenAddress,
            amount: setup.masterUtxo.satoshis,
            token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
          });
          break;
        case 'event': {
          const which = eventCursor;
          eventCursor += 1;
          eventSlots += 1;
          const funding = randomUtxo({ satoshis: 1000n });
          await provider.addUtxo(p2pkh.address, funding);
          tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature()));
          // Only the FIRST slot is reached: the handler emits once and the remaining seven stay unused.
          if (which !== 0) { tx.addOutput({ to: p2pkh.address, amount: 1000n }); break; }
          tx.addOutput({
            // The address hostile keeps the commitment and moves only WHERE the emission lands.
            to: attack === 'emission-address' ? bar.tokenAddress : eventAddress,
            amount: 1000n,
            token: { category: setup.categoryId, amount: 0n, nft: { capability: 'none', commitment } },
          });
          break;
        }
        default:
          throw new Error(`this harness does not stage a '${slot.kind}' slot`);
      }
    }
    tx.addInput(projectionUtxo, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), 0n,
    ));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(rooted, controller.unlock.attest(transcript.bytes));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
    tx.addOutput({ to: p2pkh.address, amount: 500_000n });

    const shape = { eventSlots, participants: plan.participants.length };
    try {
      return { sent: await provider.sendRawTransaction(raw(tx)), ...shape };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return { refusal, failingInput: index ? Number(index[1]) : undefined, ...shape };
    }
  }

  /** One attempt at `TestTransientStorage.val`: a master and a return event, and no data NFT between them. */
  // Retained as the paired route harness for future transient-storage admission work.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function attemptVal(attack: ValAttack, declared: Uint8Array | undefined):
  Promise<{ sent?: string; refusal?: string; failingInput?: number; discovered?: Uint8Array; dataNfts: number }> {
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
    const map = compileFileMulti(TRANSIENT, {
      ...BUS,
      experimentalMessageBusController: controller.lockingBytecode,
      experimentalMessageBusControllerCategory: controllerCategory,
    } as never) as any;
    const artifact = map.TestTransientStorage;
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, TRANSIENT_STATE);
    const participant = base.withCategory(hexToBin(setup.categoryId));

    const forge = (value: Uint8Array): Uint8Array => {
      const wrong = Uint8Array.from(value);
      if (wrong.length === 0) return Uint8Array.from([0x01]);
      wrong[wrong.length - 1] ^= 0x01;
      return wrong;
    };
    const innerVector = declared === undefined ? PROBE_RESULT : (() => {
      const [instruction, ...rest] = decodeAuthenticationInstructions(declared);
      const data = (instruction as { data?: Uint8Array }).data;
      if (data === undefined || rest.length !== 0) {
        throw new Error('TestTransientStorage.val: the route commitment is not a single push');
      }
      return data;
    })();
    const publishedVector = attack === 'result' ? forge(innerVector) : innerVector;
    const publishedCommitment = declared === undefined ? PROBE_RESULT : scriptToBytecode([publishedVector]);
    if (declared !== undefined && attack !== 'result') {
      expect(binToHex(publishedCommitment), 're-wrapping the decoded vector did not reproduce the '
        + 'commitment the route computed').toBe(binToHex(declared));
    }

    const plan = layer3.planCompiledGraph(
      [{ artifact, lockingBytecode: participant.lockingBytecode }],
      [{ parent: null, callee: 0, function: 'val', args: [] as never[] }],
    );
    const layout = layer3.compiledGraphPhysicalLayout(plan);
    const transcript = layer3.finalizeCompiledGraph(
      plan, { 0: binToHex(publishedVector) }, layout.participantInputs, layout.returnOutputs,
      [binToHex(publishedVector)], layout.projectionInputs, '',
    );
    const rooted = await rootController(
      provider, transcript.root, controller, genesis, p2pkh, controllerCategory,
    );

    const returnFunding = randomUtxo({ satoshis: 1000n });
    const projectionUtxo = randomUtxo({ satoshis: 1000n });
    const fee = randomUtxo({ satoshis: 200_000n });
    await provider.addUtxo(projection.address, projectionUtxo);
    for (const utxo of [returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);

    const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    let dataNfts = 0;
    for (const slot of artifact.hiddenBatch!.route.blockLayout!.slots as any[]) {
      switch (slot.kind) {
        case 'master':
          tx.addInput(setup.masterUtxo, participant.createCompilerRouteUnlocker(
            artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
          )(
            ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as never[],
            BigInt(layout.returnOutputs![0]!),
          ));
          tx.addOutput({
            to: participant.tokenAddress,
            amount: setup.masterUtxo.satoshis,
            token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
          });
          break;
        case 'dataNft':
          dataNfts += 1;
          throw new Error('TestTransientStorage was expected to carry no data NFT slot');
        case 'returnEvent':
          tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
          tx.addOutput({
            to: hexToBin('51'),
            amount: 1000n,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'none', commitment: binToHex(publishedCommitment) },
            },
          });
          break;
        default:
          throw new Error(`this harness does not stage a '${slot.kind}' slot`);
      }
    }
    tx.addInput(projectionUtxo, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), 0n,
    ));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(rooted, controller.unlock.attest(transcript.bytes));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
    tx.addOutput({ to: p2pkh.address, amount: 150_000n });

    if (declared === undefined) {
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const trace = vm.debug({
        inputIndex: 0,
        sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
        transaction: tx.buildLibauthTransaction(),
      }) as unknown[];
      return {
        discovered: operandComparedAgainst(trace, PROBE_RESULT, 'TestTransientStorage.val'), dataNfts,
      };
    }
    try {
      return { sent: await provider.sendRawTransaction(raw(tx)), dataNfts };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return { refusal, failingInput: index ? Number(index[1]) : undefined, dataNfts };
    }
  }

  /**
   * THE ADMISSIBILITY TEST. Bar.log remains admitted. The transient-storage census row is checked separately
   * below as a deterministic v1 opaque-assembly exclusion.
   */
  it('MEASURED: Bar.log is GAINED, ADMITTED, and carries the no-data-NFT event shape', () => {
    const options = {
      ...BUS,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    } as never;
    const bar = (compileFileMulti(EXTERNAL, options) as any).Bar;
    for (const [name, artifact, slots] of [
      ['Bar.log', bar, ['master', 'event', 'event', 'event', 'event', 'event', 'event', 'event', 'event']],
    ] as const) {
      const layout = artifact.hiddenBatch!.route.blockLayout!;
      const bytes = scriptToBytecode(asmToScript(artifact.bytecode)).length;
      console.log(`[V2N] ${name.padEnd(26)} ${String(bytes).padStart(5)} B `
        + `${bytes <= 10_000 ? 'FITS' : 'OVER'}  slots=${JSON.stringify(layout.slots.map((s: any) => s.kind))} `
        + `dataNftCount=${artifact.stateLayout?.dataNftCount}`);
      expect(layout.slots.map((slot: any) => slot.kind)).toEqual(slots);
      expect(artifact.stateLayout?.dataNftCount, `${name} grew a data NFT`).toBe(0);
      expect(bytes, `${name} exceeds the 10,000-byte input-script limit`).toBeLessThanOrEqual(10_000);
    }
    expect(bar.hiddenBatch.handlers.find((h: any) => h.name === 'log').eligible).toBe(true);
    // `Bar.log` emits, and the emission is what makes it a shape no settled subject carried before.
    expect(bar.hiddenBatch.handlers.find((h: any) => h.name === 'log').emits).toHaveLength(1);
    expect(bar.events[0].signature).toBe('Log(string)');
  }, 900_000);

  it('MEASURED: `Bar.log` SETTLES as a participant in its own right, with its emission slot filled',
    async () => {
      const result = await attemptBar('none');
      console.log(`[V2N] Bar.log: ${result.sent ?? result.refusal?.split('\n')[0]} `
        + `input=${result.failingInput} eventSlots=${result.eventSlots}`);
      expect(result.refusal, '`Bar.log` did not settle').toBeUndefined();
      expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
      expect(result.eventSlots).toBe(8);
      expect(result.participants).toBe(1);
    }, 900_000);

  it('HOSTILE: `Bar.log` with the emission commitment moved one byte is refused at input 0', async () => {
    const result = await attemptBar('emission-commitment');
    console.log(`[V2N] Bar.log/commitment: ${(result.refusal ?? `ACCEPTED ${result.sent}`).split('\n')[0]} `
      + `input=${result.failingInput}`);
    expect(result.sent, 'a forged emission commitment was ACCEPTED').toBeUndefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput).toBe(0);
  }, 900_000);

  it('HOSTILE: `Bar.log` with the emission at the wrong address is refused at input 0', async () => {
    const result = await attemptBar('emission-address');
    console.log(`[V2N] Bar.log/address: ${(result.refusal ?? `ACCEPTED ${result.sent}`).split('\n')[0]} `
      + `input=${result.failingInput}`);
    expect(result.sent, 'an emission at the wrong address was ACCEPTED').toBeUndefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput).toBe(0);
  }, 900_000);

  it('SECURITY: opaque transient-storage assembly is deterministically excluded from transcripts', () => {
    const artifact = (compileFileMulti(TRANSIENT, BUS) as any).TestTransientStorage;
    expect(artifact.hiddenBatch).toBeUndefined();
    expect(artifact.abi.find((entry: any) => entry.name === 'val')).toBeDefined();
  }, 900_000);
});
