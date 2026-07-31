import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileFile, compileFileMulti, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X136 CONTINUED. THE RECOVERED POPULATION'S ONE WRITER, AND IT DOES NOT SETTLE.
 *
 * `Layer3RecoveredRouteAirdropX136.test.ts` ran one recovered route to completion and said in its own docblock
 * what it did not establish: every handler that route admits is `writesState: false`, so it settled a READ
 * surface. Nothing had shown that a route the L2-F2 repair recovered which actually MUTATES state settles.
 *
 * THE SEARCH, measured rather than assumed. Both sides of the repair were compiled in two dedicated worktrees
 * (`a2885464^` = `c988817e`, and this branch) over the whole census-eligible solidity-by-example population,
 * 87 files. 65 handlers gained, 0 lost - the same 65 the partition commit reports. Of those 65 gained
 * handlers `writesState` is published TRUE on exactly ONE, and 64 are read-only with no absent flag:
 *
 *   solidity-by-example/hacks/phishing-with-tx-origin/TxOrigin.sol   contract `Attack`   handler `attack`
 *
 * `Attack` is a NEW-set row: before the repair it did not compile at all, and the crash was exactly the one
 * L2-F2 names - `Missing journal context '__internal__state_write_owner' while invoking 'owner'`.
 *
 * WHAT THIS FILE ESTABLISHES.
 *
 *  1. The recovered route admits `attack`, published `writesState: true`, alongside two read-only getters.
 *  2. `attack`'s whole body is one external call, `wallet.transfer(...)`, so its counterparty has to be a
 *     co-spent participant - and the counterparty `Wallet` is REFUSED from the bus by a named compiler gate.
 *  3. The SDK PLANS the graph anyway, and builds a complete balanced transaction for it.
 *  4. The VM REFUSES it, at the participant's own input index 0. Fail-closed.
 *  5. AND THE HARNESS IS NOT THE REASON. The same helper, the same staging, the same block, settles the
 *     route's READ rows on the same contract - so the refusal discriminates the writer from the readers
 *     rather than reporting a builder that never worked.
 *
 * SINCE RE-TAKEN, AND THE POPULATION IS BIGGER. The 65 below is what this file measured over
 * solidity-by-example at the commit it was written at, and it is left as that record.
 * `Layer3RecoveredPartitionX160.test.ts` re-takes the whole partition at HEAD against the same `c988817e`:
 * 206 gained, 0 lost, with ELEVEN gained writers rather than one. `Attack.attack` is still one of them and
 * everything below still holds; what changed is that the row's positive case now HAS a subject, run to
 * completion in `Layer3RecoveredWriterSettlesX160.test.ts`.
 *
 * SO THE ANSWER TO THE ROW IS NEGATIVE, AND IT IS THE SAFE NEGATIVE. A recovered handler that mutates state
 * WAS recorded as not settling - a published-but-dead admission, the X115 hazard shape. X177 falsified that:
 * the refusal was this file's own return-event staging, not a covenant property, and with the slot corrected
 * `attack` SETTLES. What survives is narrower and stranger: the bus accepts a transaction asserting it ran -
 * no witness path opened, nothing accepted that should not have been. What is NOT established is that a
 * recovered writer WOULD settle if one existed whose counterparty were admissible: the recovered population
 * contains exactly one writer, and its counterparty is inadmissible, so the positive case has no subject in
 * this corpus at all.
 */

const TX_ORIGIN = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}`
  + '/contracts/src/hacks/phishing-with-tx-origin/TxOrigin.sol';

const OWNER = `aa20${'66'.repeat(32)}87`;
const WALLET = `aa20${'55'.repeat(32)}87`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  experimentalHiddenBatch: true,
};

function compileAttack(controllerLbc: unknown, controllerCategory: string): any {
  return compileFile(TX_ORIGIN, {
    ...BUS,
    experimentalMessageBusController: controllerLbc,
    experimentalMessageBusControllerCategory: controllerCategory,
  } as never);
}

/** Exactly one field moves per hostile. */
type Tamper = 'none' | 'result' | 'state';

describe('X136: the one WRITER the L2-F2 repair recovered', () => {
  /**
   * THE SUBJECT, established from this run's own compile rather than quoted. This is the partition test: it
   * states that the file under test is the writer-admitting recovered route and not another read surface.
   */
  it('MEASURED: the recovered route admits `attack`, and `attack` is published writesState TRUE', () => {
    const artifact = compileAttack(`aa20${'11'.repeat(32)}87`, '22'.repeat(32));
    expect(artifact.contractName).toBe('Attack');
    const handlers = artifact.hiddenBatch!.handlers as any[];
    const eligible = handlers.filter((handler) => handler.eligible).map((handler) => handler.name);
    console.log(`[X136W] eligible ${JSON.stringify(eligible)}`);
    expect(eligible).toEqual(['attack', 'owner', 'wallet']);
    const abiOf = (name: string): any => artifact.abi.find((entry: any) => entry.name === name);
    expect(abiOf('attack').writesState).toBe(true);
    expect(abiOf('owner').writesState).toBe(false);
    expect(abiOf('wallet').writesState).toBe(false);
    const layout = artifact.hiddenBatch!.route.blockLayout!;
    console.log(`[X136W] route blockSize=${layout.blockSize} slots=`
      + `${JSON.stringify(layout.slots.map((slot: any) => slot.kind))}`);
    expect(layout.blockSize).toBe(3);
    expect(layout.slots.map((slot: any) => slot.kind)).toEqual(['master', 'dataNft', 'returnEvent']);
    // `attack`'s whole body is `wallet.transfer(owner, address(wallet).balance)` - one external call and
    // nothing else - so it carries the two synthetic witnesses an external call needs and its counterparty
    // has to be a co-spent participant.
    const names = abiOf('attack').inputs.map((input: any) => input.name);
    console.log(`[X136W] attack inputs ${JSON.stringify(names)}`);
    expect(names).toContain('__internal__externalCallInputBase');
    expect(names).toContain('__internal__externalCallSelector');
  }, 300_000);

  /**
   * AND THE COUNTERPARTY CANNOT BE A PARTICIPANT. `Wallet.transfer` is refused from the bus by a NAMED gate,
   * so the only contract `attack` can call is not admissible. Matched on the refusal's text, not on the fact
   * that something threw.
   */
  it('MEASURED: the counterparty `Wallet` is refused from the bus by a named gate', () => {
    let refusal: Error | undefined;
    try {
      compileFileMulti(TX_ORIGIN, {
        ...BUS,
        experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
        experimentalMessageBusControllerCategory: '22'.repeat(32),
      } as never);
    } catch (error) {
      refusal = error as Error;
    }
    expect(refusal, 'Wallet compiled in bus mode').toBeDefined();
    console.log(`[X136W] Wallet refusal: ${refusal!.name}: ${refusal!.message.split(' at Line')[0]}`);
    expect(refusal!.name).toBe('LowLevelCallShapeError');
    expect(refusal!.message).toContain("function 'transfer' issues a low-level 'call'");
    expect(refusal!.message).toContain("call option(s) 'value'");
  }, 300_000);

  /**
   * ONE ATTEMPT AT THE RECOVERED ROUTE. `handler` selects the row; `tamper` moves exactly one field.
   *
   * Every run stages its own authority and roots its own controller, because the transcript root depends on
   * the declared result and the controller genesis NFT mints once.
   */
  async function attempt(handler: 'attack' | 'owner' | 'wallet', tamper: Tamper): Promise<{
    sent?: string; refusal?: string; failingInput?: number;
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
    const artifact = compileAttack(controller.lockingBytecode, controllerCategory);
    const base = new Contract(artifact, [], { provider });
    const state = { owner: hexToBin(OWNER), wallet: hexToBin(WALLET) };
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, state);
    const participant = base.withCategory(hexToBin(setup.categoryId));

    // X179 added a plan-time floor refusing a callsite planned with 0 occurrences, which is CORRECT and is
    // exactly what `attack` does - its published external call is dropped. This file is measuring the
    // return-event slot, not the dropped edge, so it strips the callsite to reach the covenant. That strip is
    // a no-op for the `owner`/`wallet` rows, which publish no callsite at all. The dropped edge has its own
    // coverage in `Layer3DroppedEdgeX179.test.ts`, including a covenant refusal at input 0.
    const planned = {
      ...artifact,
      abi: artifact.abi.map((entry: any) => (entry.name === handler
        ? { ...entry, externalCalls: undefined } : entry)),
    };
    const plan = layer3.planCompiledGraph(
      [{ artifact: planned, lockingBytecode: participant.lockingBytecode }],
      [{ parent: null, callee: 0, function: handler, args: [] as never[] }],
    );
    const layout = layer3.compiledGraphPhysicalLayout(plan);

    // A returning row publishes its result in the block's return-event NFT; `attack` returns nothing, so its
    // return-event slot carries a plain output and the transcript declares no result at all.
    const returns = handler !== 'attack';
    const declared = handler === 'owner' ? OWNER : WALLET;
    // A BELIEVABLE WRONG: the same 34-byte p2sh32 shape with one byte of the hash different, not random bytes.
    const forged = `${declared.slice(0, 6)}${declared[6] === '7' ? '6' : '7'}${declared.slice(7)}`;
    const published = tamper === 'result' ? forged : declared;
    const resultVector = returns ? scriptToBytecode([hexToBin(published)]) : new Uint8Array(0);
    const transcript = layer3.finalizeCompiledGraph(
      plan,
      returns ? { 0: binToHex(resultVector) } : {},
      layout.participantInputs,
      returns ? layout.returnOutputs! : [null],
      returns ? [binToHex(resultVector)] : [''],
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

    const returnFunding = randomUtxo({ satoshis: 1000n });
    const projectionUtxo = randomUtxo({ satoshis: 1000n });
    const fee = randomUtxo({ satoshis: 150_000n });
    await provider.addUtxo(projection.address, projectionUtxo);
    for (const utxo of [returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);

    // Block slots 0..2 = master, dataNft, returnEvent; then projection (3), controller (4), fee (5).
    const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    tx.addInput(setup.masterUtxo, participant.createCompilerRouteUnlocker(
      artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
    )(
      ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as never[],
      BigInt(layout.returnOutputs![0]!),
    ));
    tx.addInput(setup.dataNftUtxos[0], createDataNftUnlocker(participant, 0, setup.categoryId));
    tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
    tx.addInput(projectionUtxo, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), 0n,
    ));
    tx.addInput(rootedController!, controller.unlock.attest(transcript.bytes));
    tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

    tx.addOutput({
      to: participant.tokenAddress,
      amount: setup.masterUtxo.satoshis,
      token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    // No admitted handler on this contract assigns a state variable, so the post-state the covenant must
    // accept is the pre-state. `state` tamper mutates the persisted `owner` and nothing else.
    tx.addOutput({
      to: getDataNftAddress(participant, setup.categoryId),
      amount: setup.dataNftUtxos[0].satoshis,
      token: {
        category: setup.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: buildInitialStateCommitments(artifact.stateLayout!, tamper === 'state'
            ? { ...state, owner: hexToBin(forged) } : state)[0],
        },
      },
    });
    // X177. This branch WAS `returns ? <NFT> : <plain output>`, and the plain output is what produced this
    // file's recorded negative - not the inadmissible counterparty it was attributed to. A void handler's
    // result vector is EMPTY, so the return-event slot must still carry an NFT committing to the empty
    // vector's single push; a plain output is refused at input 0 by the slot check. The control that settles
    // it: `Lib.doSomething` - void, no external call, no counterparty, no msg.sender - is refused IDENTICALLY
    // under the same substitution, so nothing about the counterparty was doing the work.
    tx.addOutput({
      to: hexToBin('51'),
      amount: 1000n,
      token: {
        category: setup.categoryId,
        amount: 0n,
        nft: {
          capability: 'none',
          commitment: binToHex(returns
            ? scriptToBytecode([resultVector])
            : scriptToBytecode([new Uint8Array(0)])),
        },
      },
    });
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addOutput({ to: p2pkh.address, amount: 100_000n });
    try {
      return { sent: await provider.sendRawTransaction(raw(tx)) };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return { refusal, failingInput: index ? Number(index[1]) : undefined };
    }
  }

  /**
   * THE CONTROL, AND IT IS WHAT MAKES THE NEGATIVE BELOW MEAN ANYTHING. The route's read rows settle through
   * the identical helper, the identical staging and the identical 6-slot block. So a refusal of `attack` is a
   * refusal of `attack` and not a builder that never worked.
   */
  it('MEASURED: the recovered route SETTLES its read rows - `owner` and `wallet`', async () => {
    for (const handler of ['owner', 'wallet'] as const) {
      const result = await attempt(handler, 'none');
      if (result.refusal) console.log(`[X136W] ${handler} refused: ${result.refusal.split('\n')[0]}`);
      expect(result.refusal, `the recovered route's ${handler} row did not settle`).toBeUndefined();
      expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
      console.log(`[X136W] ${handler} settled ${result.sent}`);
    }
  }, 900_000);

  /**
   * THE ROW. The one recovered handler that mutates state, composed honestly: one participant, one row, the
   * handler the recovered route publishes as admitted. If the published admission means anything, this is the
   * transaction it means - and the VM refuses it at the participant's own input.
   */
  /**
   * X177 INVERTED THIS, AND THE OLD VERDICT WAS THIS FILE'S OWN STAGING. It asserted the recovered writer was
   * REFUSED and attributed that to the bus-inadmissible counterparty. The refusal was the return-event slot:
   * this file used to give a non-returning handler a PLAIN OUTPUT there, and a void handler's result vector is
   * empty rather than absent, so the slot must still carry an NFT committing to the empty vector's push.
   *
   * The control that settles it: `Lib.doSomething` - void, NO external call, NO counterparty, NO msg.sender -
   * is refused IDENTICALLY under the same substitution. Nothing about the counterparty was doing the work.
   * Both guard rows this file relies on (`owner`, `wallet`) RETURN, so they took the other branch and
   * controlled for nothing.
   *
   * What it means, stated no wider than it was measured: the bus ACCEPTS a transaction asserting `attack()`
   * executed while its only statement - a call into a contract the bus refuses - cannot have. The plan is 1
   * participant, 1 invocation, emissions ['']. This is NOT a demonstrated theft primitive; nothing here shows
   * value or authority moving. See `Layer3RecoveredVoidWriterX177.test.ts` for the full pair.
   */
  it('X177: the recovered writer SETTLES once its return-event slot is staged correctly', async () => {
    const result = await attempt('attack', 'none');
    console.log(`[X136W] attack: ${result.sent ?? result.refusal?.split('\n')[0]}`);
    expect(result.refusal, 'attack is refused again - the return-event staging may have regressed')
      .toBeUndefined();
    expect(result.sent, 'attack did not settle').toBeDefined();
  }, 600_000);

  /**
   * HOSTILE, ON THE ROWS THAT DO SETTLE. Two guarded negatives against the read surface the writer's refusal
   * is measured against: a return-event NFT carrying a believable-wrong address, and a post-state data NFT
   * carrying a mutated `owner` on a row that writes nothing. Each differs from the settling positive above in
   * exactly one field, and that positive is rebuilt by this same helper in this same file.
   */
  it('HOSTILE: a forged result and a forged post-state are both refused at a named input', async () => {
    for (const tamper of ['result', 'state'] as const) {
      const result = await attempt('owner', tamper);
      console.log(`[X136W] owner/${tamper}: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
      expect(result.sent, `a forged ${tamper} was ACCEPTED`).toBeUndefined();
      expect(result.refusal).toBeDefined();
      expect(result.failingInput, `the ${tamper} refusal did not name an input`).toBe(0);
    }
  }, 900_000);
});
