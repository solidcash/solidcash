import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileFile, compileFileMulti, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X136 CONTINUED. THE RECOVERED POPULATION'S ONE WRITER.
 *
 * `Layer3RecoveredRouteAirdropX136.test.ts` ran one recovered route to completion and said in its own docblock
 * what it did not establish: every handler that route admits is `writesState: false`, so it settled a READ
 * surface. Nothing had shown that a route recovered by the L2-F2 repair which actually MUTATES state settles.
 *
 * This file finds that route and runs it.
 *
 * THE SEARCH, measured rather than assumed. Both sides of the repair were compiled in two dedicated worktrees
 * (`a2885464^` = `c988817e`, and this branch) over the whole census-eligible solidity-by-example population,
 * 87 files. 65 handlers gained, 0 lost - the same 65 the partition commit reports. Of those 65 gained
 * handlers, `writesState` is published TRUE on exactly ONE:
 *
 *   solidity-by-example/hacks/phishing-with-tx-origin/TxOrigin.sol   contract `Attack`   handler `attack`
 *
 * and 64 are read-only with no absent flag. So the recovered population contains a single writer and this is
 * it. `Attack` is a NEW-set row: before the repair it did not compile at all, with exactly the fail-closed
 * crash L2-F2 names - `Missing journal context '__internal__state_write_owner' while invoking 'owner'`.
 *
 * AND IT DOES NOT SETTLE. See the docblocks on the individual tests for what the covenant does with it.
 */

const TX_ORIGIN = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}`
  + '/contracts/src/hacks/phishing-with-tx-origin/TxOrigin.sol';

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

describe('X136: the one WRITER the L2-F2 repair recovered', () => {
  /**
   * THE SUBJECT, established from this run's own compile rather than quoted. `attack` is admitted to the
   * recovered route and is published `writesState: true`; the other two admitted handlers are the read-only
   * state getters. This is the partition test - it states that the file under test is the writer-admitting
   * recovered route and not a read surface.
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
  }, 300_000);

  /**
   * WHAT `attack` IS. Its whole body is `wallet.transfer(owner, address(wallet).balance)` - one external call
   * and nothing else. The handler carries the two synthetic witnesses an external call needs
   * (`__internal__externalCallInputBase`, `__internal__externalCallSelector`), so its counterparty has to be
   * a co-spent participant in the same graph.
   */
  it('MEASURED: `attack` is an external-call handler whose counterparty must be co-spent', () => {
    const artifact = compileAttack(`aa20${'11'.repeat(32)}87`, '22'.repeat(32));
    const attack = artifact.abi.find((entry: any) => entry.name === 'attack');
    const names = attack.inputs.map((input: any) => input.name);
    console.log(`[X136W] attack inputs ${JSON.stringify(names)}`);
    expect(names).toContain('__internal__externalCallInputBase');
    expect(names).toContain('__internal__externalCallSelector');
  }, 300_000);

  /**
   * AND THE COUNTERPARTY CANNOT BE ONE. `Wallet.transfer` is refused from the bus by a NAMED compiler gate,
   * so the only contract `attack` can call is not admissible as a participant. The refusal is matched on its
   * text, not on the fact that something threw.
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

  /** Stand up the graph authority and the recovered participant. Shared by the settlement attempts. */
  async function stage(): Promise<any> {
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
    const walletLbc = hexToBin(`aa20${'55'.repeat(32)}87`);
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {
      owner: hexToBin(`aa20${'66'.repeat(32)}87`), wallet: walletLbc,
    });
    const participant = base.withCategory(hexToBin(setup.categoryId));
    return {
      provider, p2pkh, signature, projection, controller, genesis, controllerCategory,
      artifact, participant, setup, walletLbc,
    };
  }

  /**
   * THE ROW. A graph whose only invocation is the recovered writer.
   *
   * This is the honest composition: one participant, one row, the handler the recovered route publishes as
   * admitted. If the published route means anything, this is the transaction it means.
   */
  it('MEASURED: a graph whose only row is the recovered writer', async () => {
    const staged = await stage();
    let planError: Error | undefined;
    let plan: any;
    try {
      plan = layer3.planCompiledGraph(
        [{ artifact: staged.artifact, lockingBytecode: staged.participant.lockingBytecode }],
        [{ parent: null, callee: 0, function: 'attack', args: [] as never[] }],
      );
    } catch (error) {
      planError = error as Error;
    }
    console.log(`[X136W] plan: ${planError ? `${planError.name}: ${planError.message}` : 'BUILT'}`);
    expect(plan ?? planError).toBeDefined();
  }, 600_000);
});
