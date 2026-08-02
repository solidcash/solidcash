import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileFileMulti, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X177. THE RECOVERED EXTERNAL-CALL WRITER WHOSE COUNTERPARTY IS ADMISSIBLE.
 *
 * The eleven recovered writers contain exactly TWO whose body is an external call and nothing else:
 * `Attack.attack`, whose counterparty `Wallet` the compiler REFUSES from the bus, and `Foo.callBar`, whose
 * counterparty `Bar` it ADMITS. Every conclusion the board carries about external-call writers comes from
 * the first one, and the first one is the case where no correct co-spend is constructible at all.
 *
 * `Foo.callBar` is the other case, and it is the one that can be built honestly:
 *
 *   contract  handler   block                                              body
 *   Foo       callBar   3   master dataNft returnEvent                     `bar.log();`
 *   Bar       log       9   master + 8 event                               `emit Log("Bar was called");`
 *
 * WHAT THIS FILE ESTABLISHES, AND IT IS LESS THAN THE ROW WANTED.
 *
 *  1. THE GRAPH IS REAL. The SDK plans TWO participants and TWO invocations from the call itself - the caller
 *     `Foo` and the co-spent callee `Bar`, whose block contributes 8 event slots. That is the property
 *     `Attack.attack` turned out to LACK: its settling transaction planned one participant and dropped the
 *     call (`Layer3RecoveredVoidWriterX177.test.ts`). So the two external-call writers are not the same case.
 *  2. THE REFUSAL IS RECORDED WITH ITS INPUT INDEX, which says which block the covenant objected to.
 *
 * AND WHAT IT DOES NOT ESTABLISH, WHICH IS THE VERDICT.
 *
 * THE GUARD DOES NOT SETTLE. `Foo.bar` - the read-only sibling, one participant, no external call - is
 * refused at input 0 in this staging, and the route's own trace does not hand back a usable return-event
 * commitment for it either: the sentinel probe's adjacency search returns a value that is plainly not a
 * commitment. With no settling positive anywhere in this file, `Foo.callBar`'s refusal DISCRIMINATES NOTHING
 * and is not evidence that the covenant refuses the handler. It is recorded as a harness result.
 *
 * X204 SHARPENED THAT, AND IT IS THIS HARNESS. `Foo.bar` DOES settle - `Layer3RecoveredBreadthV2.test.ts`
 * broadcasts it on a ONE-participant plan. So the handler is not unsettleable and the failure below is this
 * file's two-participant staging, exactly as the paragraph above suspected but could not show. The assertion
 * is left scoped to this staging and still holds; do not read it as a property of `Foo.bar`.
 *
 * So `Foo.callBar` remains UNPROVEN in both directions, and the reason is this harness rather than the
 * covenant. It is the ONLY recovered writer whose external call could carry a sound co-spend, so it is the
 * row most worth finishing, and it is named here as open rather than counted anywhere.
 *
 * X187 THEN RETIRED THE SUBJECT, and moved the blocker from the harness to a capability. `bar.log()` on a
 * contract-typed STATE VARIABLE parses as a namespaced FunctionCallNode and only becomes an
 * ExternalFunctionCallNode in a semantic pass that runs AFTER route synthesis freezes its verdict, so
 * synthesis never saw the edge - which is why `callBar` was admitted at all. `compiler.ts` now counts the
 * spelling, and a body that is one call with no trailing require is not tail-call eligible in EITHER
 * spelling, so `callBar` is refused before a transaction exists. The transaction-level rows are retired with
 * it; what is left is the compile-time verdict, matched by name.
 *
 * THE ROW IS STILL OPEN AND IS NOW A CAPABILITY QUESTION: admitting a bare-body forwarding call would widen
 * what the bus accepts for both spellings, which is a decision, not a repair.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;
const EXTERNAL = `${SBE}/hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  hiddenBatch: true,
};

const PROBE_RESULT = '9e'.repeat(32);

/** The value the ROUTE ITSELF computed, read off its own execution next to the sentinel it was handed. */
function operandComparedAgainst(trace: unknown[], placeholder: Uint8Array): Uint8Array | undefined {
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
  return found;
}

type Attack = 'none' | 'state';

describe('X177: `Foo.callBar`, the recovered external-call writer with an admissible counterparty', () => {
  /**
   * One attempt at the two-participant graph. `eventCommitments` fills `Bar`'s event slots; `undefined`
   * leaves every one of them a plain output, and `probe` traces the run instead of broadcasting it.
   */
  async function attempt(handler: 'callBar' | 'bar', attack: Attack, options: {
    probe?: boolean; declaredResult?: Uint8Array; eventCommitments?: readonly (string | undefined)[];
  }): Promise<{
      sent?: string; refusal?: string; failingInput?: number; trace?: unknown[];
      participants: number; invocations: number; eventSlots: number;
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
    const map = compileFileMulti(EXTERNAL, {
      ...BUS,
      messageBusController: controller.lockingBytecode,
      messageBusControllerCategory: controllerCategory,
    } as never) as any;

    const barBase = new Contract(map.Bar, [], { provider });
    const barSetup = await setupStatefulUtxos(provider, barBase, map.Bar.stateLayout!, {});
    const bar = barBase.withCategory(hexToBin(barSetup.categoryId));

    const fooBase = new Contract(map.Foo, [], { provider });
    // `Foo.bar` holds the counterparty's ADDRESS, so the graph's callee and the caller's stored pointer are
    // the same value by construction; a wrong one would be a different test.
    const fooState = { bar: bar.lockingBytecode as never };
    const fooSetup = await setupStatefulUtxos(provider, fooBase, map.Foo.stateLayout!, fooState);
    const foo = fooBase.withCategory(hexToBin(fooSetup.categoryId));

    const participants = [
      { artifact: map.Foo, lockingBytecode: foo.lockingBytecode },
      { artifact: map.Bar, lockingBytecode: bar.lockingBytecode },
    ];
    const invocations = handler === 'callBar'
      ? [
        { parent: null, callee: 0, function: 'callBar', args: [] as never[] },
        { parent: 0, callee: 1, function: 'log', args: [] as never[] },
      ]
      : [{ parent: null, callee: 0, function: 'bar', args: [] as never[] }];
    const plan = layer3.planCompiledGraph(
      handler === 'callBar' ? participants : [participants[0]], invocations as never,
    );
    const layout = layer3.compiledGraphPhysicalLayout(plan);
    // `callBar` and `log` are both VOID; `bar` is a getter and returns its stored address.
    const returns = handler === 'bar';
    // The getter's result is NEVER encoded here: a probe declares a sentinel the covenant cannot compute and
    // the settle run declares whatever the route's own trace handed back beside it.
    const resultVector = returns
      ? (options.declaredResult ?? hexToBin(PROBE_RESULT)) : new Uint8Array(0);
    const transcript = layer3.finalizeCompiledGraph(
      plan,
      returns ? { 0: binToHex(resultVector) } : {},
      layout.participantInputs,
      returns ? layout.returnOutputs : plan.participants.map(() => null),
      returns ? [binToHex(resultVector)] : plan.participants.map(() => ''),
      layout.projectionInputs,
      '',
    );

    const initFee = randomUtxo({ satoshis: 20_000n });
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
        category: controllerCategory, amount: 0n, nft: { capability: 'mutable', commitment: transcript.root },
      },
    });
    initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
    await provider.sendRawTransaction(raw(initialize));
    const rootedController: Utxo | undefined = (await provider.getUtxos(controller.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
    expect(rootedController, 'controller initialization did not root the authority').toBeDefined();

    const projectionUtxos = [];
    for (let index = 0; index < plan.participants.length; index += 1) {
      const utxo = randomUtxo({ satoshis: 1000n });
      await provider.addUtxo(projection.address, utxo);
      projectionUtxos.push(utxo);
    }
    const fee = randomUtxo({ satoshis: 600_000n });
    await provider.addUtxo(p2pkh.address, fee);

    const tamperedBar = hexToBin(`aa20${'cd'.repeat(32)}87`);
    const fooCommitments = buildInitialStateCommitments(
      map.Foo.stateLayout!, attack === 'state' ? { bar: tamperedBar } : fooState,
    );

    const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    let eventSlots = 0;
    let eventCursor = 0;
    for (let index = 0; index < plan.participants.length; index += 1) {
      const artifact = index === 0 ? map.Foo : map.Bar;
      const contract = index === 0 ? foo : bar;
      const setup = index === 0 ? fooSetup : barSetup;
      let dataNftCursor = 0;
      for (const slot of artifact.hiddenBatch!.route.blockLayout!.slots as any[]) {
        switch (slot.kind) {
          case 'master':
            tx.addInput(setup.masterUtxo, contract.createCompilerRouteUnlocker(
              artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
            )(
              ...layer3.compiledGraphRouteArgs(transcript, index, layout.controllerInput) as never[],
              ...(layout.returnOutputs[index] === null
                ? [] : [BigInt(layout.returnOutputs[index]!)]) as never[],
            ));
            tx.addOutput({
              to: contract.tokenAddress,
              amount: setup.masterUtxo.satoshis,
              token: {
                category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' },
              },
            });
            break;
          case 'dataNft': {
            const slotIndex = dataNftCursor;
            dataNftCursor += 1;
            tx.addInput(
              setup.dataNftUtxos[slotIndex], createDataNftUnlocker(contract, slotIndex, setup.categoryId),
            );
            tx.addOutput({
              to: getDataNftAddress(contract, setup.categoryId),
              amount: setup.dataNftUtxos[slotIndex].satoshis,
              token: {
                category: setup.categoryId,
                amount: 0n,
                nft: { capability: 'mutable', commitment: fooCommitments[slotIndex] },
              },
            });
            break;
          }
          case 'returnEvent': {
            const funding = randomUtxo({ satoshis: 1000n });
            await provider.addUtxo(p2pkh.address, funding);
            tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature()));
            tx.addOutput({
              to: hexToBin('51'),
              amount: 1000n,
              token: {
                category: setup.categoryId,
                amount: 0n,
                nft: {
                  capability: 'none',
                  // The PROBE publishes the sentinel RAW, so the route's comparison lands beside a value it
                  // cannot have computed; a settle run publishes the covenant's own bytes as it wants them.
                  commitment: returns && options.declaredResult === undefined
                    ? PROBE_RESULT
                    : binToHex(returns ? resultVector : scriptToBytecode([new Uint8Array(0)])),
                },
              },
            });
            break;
          }
          case 'event': {
            const which = eventCursor;
            eventCursor += 1;
            eventSlots += 1;
            const funding = randomUtxo({ satoshis: 1000n });
            await provider.addUtxo(p2pkh.address, funding);
            tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature()));
            const commitment = options.eventCommitments?.[which];
            tx.addOutput(commitment === undefined ? { to: p2pkh.address, amount: 1000n } : {
              to: hexToBin('51'),
              amount: 1000n,
              token: {
                category: setup.categoryId,
                amount: 0n,
                nft: { capability: 'none', commitment },
              },
            });
            break;
          }
          default:
            throw new Error(`this harness does not stage a '${slot.kind}' slot`);
        }
      }
    }
    for (const utxo of projectionUtxos) {
      tx.addInput(utxo, projection.unlock.verify(
        transcript.bytes, BigInt(layout.controllerInput), BigInt(projectionUtxos.indexOf(utxo)),
      ));
      tx.addOutput({ to: p2pkh.address, amount: 1000n });
    }
    tx.addInput(rootedController!, controller.unlock.attest(transcript.bytes));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
    tx.addOutput({ to: p2pkh.address, amount: 500_000n });

    const shape = {
      participants: plan.participants.length, invocations: plan.invocations.length, eventSlots,
    };
    if (options.probe === true) {
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const trace = vm.debug({
        inputIndex: 0,
        sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
        transaction: tx.buildLibauthTransaction(),
      }) as unknown[];
      return { trace, ...shape };
    }
    try {
      return { sent: await provider.sendRawTransaction(raw(tx)), ...shape };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return { refusal, failingInput: index ? Number(index[1]) : undefined, ...shape };
    }
  }

  /**
   * THE GRAPH IS REAL, and this is the property `Attack.attack` turned out to lack: the SDK plans the callee
   * as a co-spent participant of its own, so the call is a thing the transaction has to carry rather than a
   * statement it can drop.
   */
  it('X201: `Foo.callBar` is admitted again, with its edge bound rather than unseen', () => {
    const map = compileFileMulti(EXTERNAL, {
      ...BUS,
      messageBusController: `aa20${'11'.repeat(32)}87`,
      messageBusControllerCategory: '22'.repeat(32),
    } as never) as any;
    const artifact = map.Foo;
    const handlers = artifact.hiddenBatch!.handlers as any[];
    const eligible = handlers.filter((handler) => handler.eligible).map((handler) => handler.name);
    console.log(`[X177E] Foo eligible ${JSON.stringify(eligible)}`);
    expect(eligible).toContain('callBar');
    expect(handlers.find((handler) => handler.name === 'callBar').rejectionReason).toBeUndefined();
    // THE ADMISSION IS THE SAME AS THE ORIGINAL AND MEANS THE OPPOSITE. `bar.log()` on a contract-typed state
    // variable is a namespaced FunctionCallNode until a semantic pass that runs AFTER route synthesis, so
    // synthesis originally missed the edge and admitted the handler with nothing framing it. X187 made
    // synthesis see it, which refused the bare-body spelling outright; X201 re-admitted it with the edge
    // BOUND. The ABI published this edge throughout - what changed is whether the covenant frames it.
    expect((artifact.abi.find((entry: any) => entry.name === 'callBar') as any).externalCalls)
      .toBeDefined();
  }, 900_000);

  /**
   * THE GUARD THAT DOES NOT HOLD, recorded as the reason this file claims nothing. `Foo.bar` is a read-only
   * getter on a ONE-participant graph with no external call at all, and it is refused at input 0. Without a
   * settling positive there is no discriminator, so the row below is a record and not a verdict.
   */
  it('RECORDED: the read-only sibling `Foo.bar` does NOT settle in this staging, so nothing discriminates',
    async () => {
      const probe = await attempt('bar', 'none', { probe: true });
      const declaredResult = operandComparedAgainst(probe.trace!, hexToBin(PROBE_RESULT));
      console.log(`[X177E] Foo.bar sentinel neighbour: ${declaredResult === undefined
        ? 'NEVER COMPARED' : binToHex(declaredResult)}`);
      const result = await attempt('bar', 'none', { declaredResult });
      console.log(`[X177E] Foo.bar: ${result.sent ?? result.refusal?.split('\n')[0]} `
        + `input=${result.failingInput}`);
      // Stated as the measurement it is. If this ever settles, the row below becomes a verdict and this
      // expectation is what will say so by turning red.
      expect(result.sent, 'Foo.bar now settles - the callBar row below can now be read as a verdict')
        .toBeUndefined();
      expect(result.failingInput).toBe(0);
    }, 900_000);

  /**
   * THE ROW, AND WHY IT IS NOW BLOCKED ON A CAPABILITY RATHER THAN ON THIS HARNESS. `Foo.callBar` used to be
   * plannable as a two-participant graph and was the ONE recovered writer whose external call could carry a
   * sound co-spend. It cannot be built at all now, so the transaction-level rows above it are retired with
   * their subject. What blocks it is NOT the unbindable edge - it is that a body which is one call with no
   * trailing require is not tail-call eligible in either spelling. Making it eligible WIDENS what the bus
   * admits, for both spellings, and is an open row rather than a repair.
   */
  it('X201: `Foo.callBar` plans TWO participants and TWO invocations again', async () => {
    let refusal: string | undefined;
    let shape: Awaited<ReturnType<typeof attempt>> | undefined;
    try {
      shape = await attempt('callBar', 'none', { probe: true });
    } catch (error) {
      refusal = (error as Error).message;
    }
    console.log(`[X177E] callBar graph: ${refusal ?? `participants=${shape!.participants} `
      + `invocations=${shape!.invocations} eventSlots=${shape!.eventSlots}`}`);
    // This is the property `Attack.attack` lacks and the reason this row was worth keeping: the callee is
    // planned as a co-spent participant of its own, so the call is something the transaction must carry
    // rather than a statement it can drop. X187 refused the shape; X201 restored it with the edge bound.
    expect(refusal, 'callBar no longer plans').toBeUndefined();
    expect(shape!.participants).toBe(2);
    expect(shape!.invocations).toBe(2);
    expect(shape!.eventSlots).toBe(8);
  }, 900_000);
});
