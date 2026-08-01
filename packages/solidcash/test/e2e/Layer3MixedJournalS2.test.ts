import { bigIntToVmNumber, binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createEntryNftUnlocker, getDataNftAddress, getEntryNftAddress,
} from '../../src/stateful/covenant-helpers.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlot,
} from '../../src/stateful/SortedList.js';

/**
 * S2 - one read-your-writes journal shared by scalar and collection writes, across the admitted control-flow
 * exits.
 *
 * The committed evidence for a cloned handler that writes both scalar state and a collection is a single
 * straight-line body. That leaves the acceptance item "early return, loop exit and revert either flush
 * correctly or fail at compile time" untested at the VM: a loop and a revert branch each change WHERE the
 * scalar journal's final value is produced relative to the collection journal's exit, which is exactly the
 * interference the integrated fix at `6f84531d` addresses.
 *
 * Each variant below is the same two-row balanced graph, differing only in the handler body:
 *
 * - `loop`   - the scalar counter is advanced inside a bounded `for` with a `break`, so its final value is
 *              produced from a loop frame rather than from straight-line code;
 * - `revert` - the handler carries an unreached `revert` branch, so the collection journal's exit is no
 *              longer the only terminator in the body.
 *
 * Hostile cases forge the scalar post-state and the entry post-state independently, and drive the `revert`
 * branch so the batch cannot settle at all.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

// `moves` advances by 2 per row in the loop variant (i = 0, then break at i = 1) and by 1 in the revert
// variant, so a forged post-state cannot coincide with the other variant's honest value.
const LOOP_HANDLER = `
      function move(address from, address to, bigint amount) public {
        for (int i = 0; i < 4; i = i + 1) {
          this.moves = this.moves + 1;
          if (i == 1) { break; }
        }
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        require(amount >= 0);
      }`;
const REVERT_HANDLER = `
      function move(address from, address to, bigint amount) public {
        this.moves = this.moves + 1;
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        if (amount > 1000) { revert("amount too large"); }
        require(amount >= 0);
      }`;

const tokenSource = (handler: string): string => `pragma solidcash >=0.8.0;
    contract MixedJournalToken() {
      bigint moves;
      mapping(address => bigint) balances;${handler}
    }`;

const ROUTER = `pragma solidcash >=0.8.0;
    interface IMixedJournalToken { function move(address from, address to, bigint amount); }
    contract MixedJournalRouter(int brand, address token) {
      function route(address shared, address first, address second, bigint a, bigint b) public {
        IMixedJournalToken(token).move(shared, first, a);
        IMixedJournalToken(token).move(shared, second, b);
        require(true);
      }
    }`;

type Variant = 'loop' | 'revert';
type Tamper = 'none' | 'forge-scalar' | 'forge-entry' | 'reach-revert';

async function createGraphAuthority(provider: ReturnType<typeof createTestProvider>): Promise<{
  projection: Contract; controller: Contract; categoryId: string; genesisUtxo: any;
}> {
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  return {
    projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0],
  };
}

async function initializeGraphAuthority(
  provider: ReturnType<typeof createTestProvider>,
  controller: Contract, genesisUtxo: any, categoryId: string, root: string, p2pkh: Contract,
): Promise<any> {
  const fee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(root), alicePub, signature()));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(tx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  if (!rooted) throw new Error('graph controller initialization did not create the rooted authority');
  return rooted;
}

async function buildMixedJournalGraph(variant: Variant, tamper: Tamper = 'none'): Promise<{
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  movesAfter: bigint;
}> {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const tokenArtifact = compileString(
    tokenSource(variant === 'loop' ? LOOP_HANDLER : REVERT_HANDLER), options,
  );
  const tokenBase = new Contract(tokenArtifact, [], { provider });
  const tokenSetup = await setupStatefulUtxos(provider, tokenBase, tokenArtifact.stateLayout!, { moves: 0n });
  const token = tokenBase.withCategory(hexToBin(tokenSetup.categoryId));
  const callerArtifact = compileString(ROUTER, options);
  const callerBase = new Contract(callerArtifact, [1n, token.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {});
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  const shared = hexToBin(`aa20${'91'.repeat(32)}87`);
  const first = hexToBin(`aa20${'92'.repeat(32)}87`);
  const second = hexToBin(`aa20${'93'.repeat(32)}87`);
  // The revert branch triggers above 1,000, so the hostile case moves an amount the handler refuses.
  const amountA = tamper === 'reach-revert' ? 1500n : 10n;
  const amountB = 5n;
  const rows = [
    { key: shared, value: 2000n }, { key: first, value: 0n }, { key: second, value: 0n },
  ].map((row) => ({ ...row, slot: keyToSlot(row.key) }))
    .sort((left, right) => Number(bytesToSlotValue(left.slot) - bytesToSlotValue(right.slot)));
  const commitments = new Map(rows.map((row, index) => [
    binToHex(row.slot),
    encodeEntryCommitment(row.slot, rows[index + 1]?.slot ?? new Uint8Array(32), bigIntToVmNumber(row.value)),
  ]));
  const entryKeys = [shared, first, second];
  const entries = entryKeys.map((key) => randomUtxo({
    satoshis: 10000n,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable' as const,
        commitment: binToHex(commitments.get(binToHex(keyToSlot(key)))!),
      },
    },
  }));
  for (const entry of entries) {
    await provider.addUtxo(getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), entry);
  }
  const plan = layer3.planCompiledGraph([
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: tokenArtifact, lockingBytecode: token.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'route', args: [shared, first, second, amountA, amountB] },
    { parent: 0, callee: 1, function: 'move', args: [shared, first, amountA] },
    { parent: 0, callee: 1, function: 'move', args: [shared, second, amountB] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxos = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50000n });
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const tokenRoute = token.createCompilerRouteUnlocker(
    tokenArtifact.hiddenBatch!.route, hexToBin(tokenArtifact.hiddenBatch!.selector),
  );
  const tokenInternalRouteWitnesses: Record<string, FunctionArgument> = {};
  entries.forEach((entry, slotIndex) => {
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    tokenInternalRouteWitnesses[`__internal__c2BatchSlot_${slotIndex}`] = decoded.slot;
    tokenInternalRouteWitnesses[`__internal__c2BatchProof_${slotIndex}`] = BigInt(slotIndex + 2);
    tokenInternalRouteWitnesses[`__internal__c2BatchNext_${slotIndex}`] = decoded.nextKey;
    tokenInternalRouteWitnesses[`__internal__c2BatchPredOut_${slotIndex}`] = -1n;
  });
  tokenInternalRouteWitnesses.__internal__c2BatchTrailingCount = 0n;
  const tokenRouteArgs = [
    ...layer3.compiledGraphRouteArgs(
      transcript, 1, layout.controllerInput, tokenInternalRouteWitnesses,
    ),
  ] as FunctionArgument[];
  // Two rows: the loop body advances `moves` twice per row, the revert body once per row.
  const movesPerRow = variant === 'loop' ? 2n : 1n;
  const movesAfter = movesPerRow * 2n;
  const settled = new Map([
    [binToHex(keyToSlot(shared)), 2000n - amountA - amountB],
    [binToHex(keyToSlot(first)), amountA],
    [binToHex(keyToSlot(second)), amountB],
  ]);
  if (tamper === 'forge-entry') {
    settled.set(binToHex(keyToSlot(first)), amountA + 1n);
    settled.set(binToHex(keyToSlot(shared)), 2000n - amountA - amountB - 1n);
  }
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    callerSetup.masterUtxo,
    callerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(tokenSetup.masterUtxo, tokenRoute(...tokenRouteArgs as any));
  tx.addInput(
    tokenSetup.dataNftUtxos[0],
    createDataNftUnlocker(token, layout.participantInputs[1], tokenSetup.categoryId),
  );
  entries.forEach((entry) =>
    tx.addInput(entry, createEntryNftUnlocker(token, 1, tokenSetup.categoryId, 'balances')));
  projectionUtxos.forEach((proof, participant) =>
    tx.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: caller.tokenAddress,
    amount: callerSetup.masterUtxo.satoshis,
    token: { category: callerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: token.tokenAddress,
    amount: tokenSetup.masterUtxo.satoshis,
    token: { category: tokenSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(token, tokenSetup.categoryId),
    amount: tokenSetup.dataNftUtxos[0].satoshis,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(
          tokenArtifact.stateLayout!,
          { moves: tamper === 'forge-scalar' ? movesAfter - 1n : movesAfter },
        )[0],
      },
    },
  });
  for (const entry of entries) {
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    tx.addOutput({
      to: getEntryNftAddress(token, tokenSetup.categoryId, 'balances'),
      amount: entry.satoshis,
      token: {
        category: tokenSetup.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(
            decoded.slot, decoded.nextKey, bigIntToVmNumber(settled.get(binToHex(decoded.slot))!),
          )),
        },
      },
    });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, builder: tx, transaction: raw(tx), movesAfter };
}

/** Report the first input whose BCH-2026 evaluation fails, so a hostile case names one exact covenant. */
function failingInput(builder: TransactionBuilder): number | null {
  try {
    layer3.preflightLayer3Transaction(builder);
    return null;
  } catch (error) {
    const match = /failed at input (\d+)/.exec((error as Error).message);
    if (!match) throw error;
    return Number(match[1]);
  }
}

// Physical slots of this two-participant balanced graph.
const INPUT = { masterRouter: 0, masterToken: 1 } as const;

describe('S2 mixed scalar/collection journal across control-flow exits', () => {
  it('settles a cloned handler whose scalar write happens inside a bounded loop', async () => {
    const built = await buildMixedJournalGraph('loop');
    expect(built.movesAfter).toBe(4n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  });

  it('settles a cloned handler that carries an unreached revert branch', async () => {
    const built = await buildMixedJournalGraph('revert');
    expect(built.movesAfter).toBe(2n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a forged scalar post-state from the loop variant', async () => {
    // Attacks the scalar journal's final value: 3 instead of the 4 the loop produces, with every entry
    // commitment honest, so the rejection can only come from the scalar side of the shared journal.
    const built = await buildMixedJournalGraph('loop', 'forge-scalar');
    expect(failingInput(built.builder)).toBe(INPUT.masterToken);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });

  it('rejects a forged entry post-state from the loop variant', async () => {
    // Attacks the collection journal's entry value while keeping the scalar post-state honest and the
    // conservation of the two entries intact, so only the entry write is wrong.
    const built = await buildMixedJournalGraph('loop', 'forge-entry');
    expect(failingInput(built.builder)).toBe(INPUT.masterToken);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });

  it('rejects a forged scalar post-state from the revert variant', async () => {
    const built = await buildMixedJournalGraph('revert', 'forge-scalar');
    expect(failingInput(built.builder)).toBe(INPUT.masterToken);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });

  it('rejects a batch whose first row reaches the handler revert', async () => {
    // Identical transaction shape; the only difference is an amount above the handler's own revert bound.
    // Neither journal may settle, so this is the control that the revert branch is really reachable and
    // really terminal rather than an unreachable branch the honest case only happened to skip.
    const built = await buildMixedJournalGraph('revert', 'reach-revert');
    expect(failingInput(built.builder)).toBe(INPUT.masterToken);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });
});
