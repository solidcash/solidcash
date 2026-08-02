import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  acceptedByNode, createLayer3SemanticTestProvider, dustOutputs, formatDustOutputs,
} from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createEntryNftUnlocker, createSatoshiContainerUnlocker,
  getDataNftAddress, getEntryNftAddress, getEventNftAddress, getSatoshiContainerAddress,
} from '../../src/stateful/covenant-helpers.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlot, keyToSlotMulti,
} from '../../src/stateful/SortedList.js';

/**
 * C1 - the DeFi integrated semantic capstone.
 *
 * SEMANTIC evidence, on the named `layer3-bch2026-semantic-relaxed-v1` profile: BCH-2026 opcodes,
 * introspection and the real 128-byte NFT commitment, relaxed capacity. The semantic tests are not a
 * consensus-fit or policy-fit claim; the last test measures capacity separately and C1 clears both gates it
 * checks - every input inside ordinary operation-cost density, worst 0.6182, and 63,130 serialized bytes
 * against the 100,000-byte relay ceiling. Relay dust remains untested.
 *
 * One transaction composes five independently compiled participants:
 *
 *   Router --transferFrom x2--> Token             (caller-authorized ERC-20, msg.sender == Router)
 *      |
 *      +---accrue--> Accrue --deposit--> Vault    (Bento/Kashi share accounting, returns a share result)
 *      |
 *      +---notify--> Notifier                     (the event NFT and the satoshi effect)
 *
 * The Router writes scalar state; the Vault publishes a return-event NFT; the Accrue post-state is a function
 * of that authenticated result; the Notifier emits an ordinary event NFT and moves satoshis out of its
 * container. Every one of those is settled by one 38-slot transaction.
 *
 * SEC-6 RESHAPE, AND WHAT ACTUALLY CLOSES SEC-6. The event and the satoshi effect used to sit on the ROUTER,
 * which is also the participant making the outgoing calls, and they now live on a fifth participant - a LEAF
 * the Router calls. This header used to justify that move by citing the shape SEC-6 names: a handler carrying
 * an `emit` or a `transfer` has physical effects, so its graph clone is "flattened out of OP_INVOKE into
 * `__scb1`" and its outgoing edges lose their emission binding.
 *
 * That shape is UNREACHABLE at this commit, so the reshape is not what closes SEC-6. What closes it is a
 * compiler invariant: in `InlineStoragePointerCalls`, a function with `graphEmissionHandler` and an outgoing
 * call either satisfies `keepsGraphEmissionBinding` - `!hasPhysicalEffects(fn) || hasOutgoingCall(fn)`, which
 * an effect-carrying caller satisfies through its second disjunct - and stays behind OP_INVOKE, or it fails
 * that predicate only via a token-container effect or a storage-pointer parameter, and is then thrown out by
 * name as `GraphEmissionEffectError`. Kept bound, or refused; never flattened. Measured, not inferred: the
 * PRE-reshape C1 and C3 Routers both compile at this commit with a synthesized route, an eligible handler and
 * non-zero emission binding sites (3 and 2) - `R2-C1-I` in ReviewR2CapstoneC1.test.ts.
 *
 * So the reshape is REDUNDANT with the refusal rather than load-bearing. It is kept because C1's structural
 * guard - `SEMANTIC: no calling participant carries an owner-local physical slot` - is a cheap standing check
 * that the fixture has not drifted into a shape whose binding depends on that invariant holding; it is not
 * itself the evidence that unbound edges are impossible.
 *
 * Scope of the continuation claim: the result-dependent continuation here is a result-dependent STATE
 * TRANSITION, not a result-dependent onward CALL. A handler that consumes a result may not carry a second edge
 * at all, so the onward-call form is a compiler refusal - see the boundary block at the bottom of this file.
 * A middle participant that consumes a result and returns a derived one does compile; C1 does not exercise it.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/** The share result the Vault must publish: floor(30 * 9 / 12). */
const SHARES = 22n;
const FROM_BALANCE = 100n;
const ALLOWANCE = 50n;
const FIRST_AMOUNT = 10n;
const SECOND_AMOUNT = 20n;
const TOTAL_AMOUNT = FIRST_AMOUNT + SECOND_AMOUNT;
const VAULT_ELASTIC = 12n;
const VAULT_BASE = 9n;
const ACCRUE_COLLATERAL = 5n;
const CONTAINER_SATS = 5_000n;
/**
 * The compiled satoshi effect, and why it is not 10.
 *
 * X60. This fixture used to pay 10 satoshis to a one-byte `OP_1` placeholder script. BCHN's relay dust rule is
 * `3 * (serialized output bytes + 148)` at the default 1,000 sat/kB dust relay fee, so that output was worth 10
 * against a 474-satoshi threshold and a real node refuses the whole transaction `64: dust` - measured, before
 * it looks up a single input. Every harness measurement missed it because dust is off across the whole mock
 * stack (`MockNetworkProvider` defaults `enforceDust: false`), so the transaction that was called "inside the
 * relay ceiling" was in fact unrelayable for an unrelated reason.
 *
 * The recipient is now a real P2PKH script, which RAISES the threshold to `3 * (34 + 148)` = 546, so the amount
 * has to move too: a real address alone does not fix a dust output, it makes the bar higher. 1,000 satoshis
 * clears 546 with margin and keeps the container change (`CONTAINER_SATS - TRANSFER_SATS` = 4,000) clear of the
 * 576-satoshi threshold its own p2sh32 output carries.
 */
const TRANSFER_SATS = 1_000n;

const ROUTER = `pragma solidcash >=0.8.0;
interface IC1Token { function transferFrom(bytes20 from, bytes20 to, bigint amount); }
interface IC1Accrue { function accrue(bigint amount); }
interface IC1Notifier { function notify(bigint amount); }
contract C1Router(address token, address accrue, address notifier) {
  bigint settled;
  function settle(
    bytes20 from, bytes20 first, bytes20 second, bigint firstAmount, bigint secondAmount
  ) public {
    IC1Token(token).transferFrom(from, first, firstAmount);
    IC1Token(token).transferFrom(from, second, secondAmount);
    IC1Accrue(accrue).accrue(firstAmount + secondAmount);
    IC1Notifier(notifier).notify(firstAmount + secondAmount);
    this.settled = this.settled + firstAmount + secondAmount;
    require(secondAmount > 0);
  }
}`;

const TOKEN = `pragma solidcash >=0.8.0;
contract C1Token() {
  mapping(bytes20 => bigint) balances;
  mapping(bytes20 => mapping(address => bigint)) allowance;
  function transferFrom(bytes20 from, bytes20 to, bigint amount) public {
    require(this.allowance[from][msg.sender] >= amount);
    require(this.balances[from] >= amount);
    this.allowance[from][msg.sender] = this.allowance[from][msg.sender] - amount;
    this.balances[from] = this.balances[from] - amount;
    this.balances[to] = this.balances[to] + amount;
  }
}`;

/** The Kashi side: collateral accrues in the SHARE unit the Bento vault returned, never in the amount unit. */
const ACCRUE = `pragma solidcash >=0.8.0;
interface IC1Vault { function deposit(bigint amount) returns (bigint); }
contract C1Accrue(address vault) {
  bigint collateral;
  function accrue(bigint amount) public {
    bigint shares = IC1Vault(vault).deposit(amount);
    this.collateral = this.collateral + shares;
    require(shares >= 0);
  }
}`;

/**
 * The BentoBox side: an elastic/base rebasing vault. `elastic` is the amount pool, `base` the share pool, and
 * a deposit mints floor(amount * base / elastic) shares before growing both, so the share price carried into
 * Kashi is the pre-deposit one.
 */
const VAULT = `pragma solidcash >=0.8.0;
contract C1Vault() {
  bigint elastic;
  bigint base;
  function deposit(bigint amount) public returns (bigint) {
    bigint shares = amount * this.base / this.elastic;
    this.elastic = this.elastic + amount;
    this.base = this.base + shares;
    require(amount > 0);
    return shares;
  }
}`;

/**
 * SEC-6 reshape. The event and the satoshi effect used to live on the Router, which is also the participant
 * making the outgoing calls - the shape SEC-6 named. They live here instead, on a LEAF the Router calls, which
 * makes no outgoing call and so has no emission rows at all. At this commit that move is a fixture choice
 * rather than a requirement: an effect-carrying caller keeps its clone behind OP_INVOKE and its edges bound
 * (see the header), so the pre-reshape shape compiles bound too.
 *
 * The Vault was tried first and is not a legal home. A returning handler may not carry an effect - the
 * compiler refuses it by name (`result-route-requires-effect-free-handlers`), which is the boundary this file
 * already records at the bottom. So the effects need a participant that neither calls out nor returns.
 */
const NOTIFIER = `pragma solidcash >=0.8.0;
contract C1Notifier(bytes recipient) {
  bigint total;
  event Settled(bigint amount);
  function notify(bigint amount) public {
    this.total = this.total + amount;
    emit Settled(amount);
    this.transfer(recipient, ${TRANSFER_SATS});
    require(amount > 0);
  }
}`;

/**
 * Exactly one authenticated field is substituted per hostile build. The control is a SECOND call to the same
 * builder, and the two are NOT byte-identical: every call draws fresh outpoints and mints fresh token
 * categories, so two HONEST builds of this fixture already differ in a large fraction of their bytes (Worker A
 * measured 15,158 of 101,714 hex characters on a fixture built from the same helpers - see
 * `Layer3ReviewA1.test.ts`, "two honest builds are the same LENGTH but are NOT the same bytes"). What the
 * matrix below actually asserts is equal SERIALIZED LENGTH, which is evidence about SHAPE only: no input,
 * output or witness element was added or removed. It is not evidence that only the named field differs.
 */
type Hostile =
  | 'none'
  /** The ERC-20 allowance spender witness names a participant other than the authenticated graph caller. */
  | 'caller'
  /** The allowance entry is settled without being debited. */
  | 'allowance'
  /** The Vault's return-event NFT carries a share value the transcript does not commit to. */
  | 'result'
  /** The Accrue post-state is computed from a share value other than the authenticated result. */
  | 'continuation'
  /** The router's satoshi effect pays a different amount than the compiled call. */
  | 'resource'
  /** The ordinary event NFT is sent somewhere other than its event covenant. */
  | 'event'
  /** The ordinary event NFT publishes an argument the handler did not emit. */
  | 'event-argument'
  /**
   * The transcript declares the Vault's return-event NFT at a different output of the Vault's OWN block, while
   * the NFT itself and the route witness stay where the honest build put them. C1-R4: this position was
   * previously described here as covenant-unbound.
   */
  | 'return-position';

/**
 * Ordinary BCH-2026 capacity, for the F1-style measurement below. Two deliberate deviations, both stated:
 * relay dust stays disabled (dust is standard policy, not consensus, and this fixture pays a 10-satoshi
 * compiled satoshi effect), and the hash-iteration allowance is 3 rather than the 3.5 nonstandard consensus
 * figure, because the mock feeds one integer to both the standard and nonstandard knobs. Passing under 3 is
 * therefore conservative on that axis; failing under it would be inconclusive.
 */
const createOrdinaryCapacityProvider = (): MockNetworkProvider => new MockNetworkProvider({
  consensusLimits: {
    maximumInputBytes: 10_000,
    maximumStackItemBytes: 10_000,
    maximumTransactionBytes: 1_000_000,
    maximumNftCommitmentBytes: 128,
    operationCostBudgetPerByte: 800,
    hashDigestIterationsPerByte: 3,
  },
  policy: { enforceDust: false },
});

/**
 * X59. The union `createTestProvider` returns, so `buildC1` can build this composition against a real BCHN
 * regtest node rather than only against `MockNetworkProvider`. The mock is still the default.
 */
type CapstoneProvider = ReturnType<typeof createTestProvider>;

interface BuiltC1 {
  provider: CapstoneProvider;
  transaction: string;
  builder: TransactionBuilder;
  layout: layer3.CompiledGraphPhysicalLayout;
  plan: layer3.CompiledGraphPlan;
  transcript: layer3.FinalizedCompiledGraph;
  routerInputBytes: number;
  tokenInputBytes: number;
  /** Where each settled state transition can be read back off the chain, and how to interpret it. */
  settled: {
    scalars: readonly { label: string; address: string; layout: any }[];
    balances: { address: string; slots: readonly { label: string; slot: Uint8Array }[] };
    allowance: { address: string; slot: Uint8Array };
  };
  returnCommitment: string;
  eventCommitment: string;
}

async function buildC1(
  hostile: Hostile = 'none',
  createProvider: () => CapstoneProvider = createLayer3SemanticTestProvider,
): Promise<BuiltC1> {
  const provider = createProvider();
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
  const options = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: controllerCategory,
  };

  // Compile leaf-first: every caller pins its callee's instantiated locking bytecode as a constructor argument.
  // A REAL P2PKH recipient (Bob, who is not the fee payer), not a placeholder: see TRANSFER_SATS above.
  const recipient = hexToBin(`76a914${binToHex(bobPkh)}88ac`);
  const vaultArtifact = compileString(VAULT, options);
  const vaultBase = new Contract(vaultArtifact, [], { provider });
  const vaultSetup = await setupStatefulUtxos(
    provider, vaultBase, vaultArtifact.stateLayout!, { elastic: VAULT_ELASTIC, base: VAULT_BASE },
  );
  const vault = vaultBase.withCategory(hexToBin(vaultSetup.categoryId));

  const accrueArtifact = compileString(ACCRUE, options);
  const accrueBase = new Contract(accrueArtifact, [vault.lockingBytecode], { provider });
  const accrueSetup = await setupStatefulUtxos(
    provider, accrueBase, accrueArtifact.stateLayout!, { collateral: ACCRUE_COLLATERAL },
  );
  const accrue = accrueBase.withCategory(hexToBin(accrueSetup.categoryId));

  const tokenArtifact = compileString(TOKEN, options);
  const tokenBase = new Contract(tokenArtifact, [], { provider });
  const tokenSetup = await setupStatefulUtxos(provider, tokenBase, tokenArtifact.stateLayout!, {});
  const token = tokenBase.withCategory(hexToBin(tokenSetup.categoryId));

  const notifierArtifact = compileString(NOTIFIER, options);
  const notifierBase = new Contract(notifierArtifact, [recipient], { provider });
  const notifierSetup = await setupStatefulUtxos(
    provider, notifierBase, notifierArtifact.stateLayout!, { total: 0n },
  );
  const notifier = notifierBase.withCategory(hexToBin(notifierSetup.categoryId));

  const routerArtifact = compileString(ROUTER, options);
  const routerBase = new Contract(
    routerArtifact, [token.lockingBytecode, accrue.lockingBytecode, notifier.lockingBytecode], { provider },
  );
  const routerSetup = await setupStatefulUtxos(
    provider, routerBase, routerArtifact.stateLayout!, { settled: 0n },
  );
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  const from = hexToBin('31'.repeat(20));
  const first = hexToBin('32'.repeat(20));
  const second = hexToBin('33'.repeat(20));

  const plan = layer3.planCompiledGraph([
    { artifact: routerArtifact, lockingBytecode: router.lockingBytecode },
    { artifact: tokenArtifact, lockingBytecode: token.lockingBytecode },
    { artifact: accrueArtifact, lockingBytecode: accrue.lockingBytecode },
    { artifact: vaultArtifact, lockingBytecode: vault.lockingBytecode },
    { artifact: notifierArtifact, lockingBytecode: notifier.lockingBytecode },
  ], [
    {
      parent: null,
      callee: 0,
      function: 'settle',
      args: [from, first, second, FIRST_AMOUNT, SECOND_AMOUNT],
    },
    { parent: 0, callee: 1, function: 'transferFrom', args: [from, first, FIRST_AMOUNT] },
    { parent: 0, callee: 1, function: 'transferFrom', args: [from, second, SECOND_AMOUNT] },
    { parent: 0, callee: 2, function: 'accrue', args: [TOTAL_AMOUNT] },
    { parent: 3, callee: 3, function: 'deposit', args: [TOTAL_AMOUNT] },
    { parent: 0, callee: 4, function: 'notify', args: [TOTAL_AMOUNT] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const [
    routerBaseInput, tokenBaseInput, accrueBaseInput, vaultBaseInput, notifierBaseInput,
  ] = layout.participantInputs;

  // The share the Vault publishes, packed exactly as the route emits it, and the transcript that commits to it.
  const sharesResult = scriptToBytecode([bigIntToVmNumber(SHARES)]);
  // C1-R4 attack: declare the Vault's return slot one output earlier - still inside the Vault's own block, so
  // any block-membership range check still passes. The NFT and the route witness below stay at the honest slot.
  const declaredReturnOutputs = hostile === 'return-position'
    ? layout.returnOutputs!.map((slot, participant) => (participant === 3 ? slot! - 1 : slot))
    : layout.returnOutputs;
  const transcript = layer3.finalizeCompiledGraph(
    plan, { 4: binToHex(sharesResult) }, layout.participantInputs, declaredReturnOutputs,
    ['', '', '', binToHex(sharesResult), ''], layout.projectionInputs,
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  // Root the graph controller in its own prior transaction; `attest` cannot run against a blank genesis NFT.
  const rootingFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, rootingFee);
  const rootingTx = new TransactionBuilder({ provider });
  rootingTx.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  rootingTx.addInput(rootingFee, p2pkh.unlock.spend(alicePub, signature()));
  rootingTx.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  rootingTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(rootingTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
  if (!rootedController) throw new Error('C1 harness did not root its graph controller');

  // ---- Token collection state ------------------------------------------------------------------------
  // Slots are little-endian VM numbers compared with OP_BIN2NUM/OP_LESSTHAN; sorting the raw bytes
  // lexicographically would build a linked list the sorted-list invariant rejects.
  const balanceRows = [from, first, second]
    .map((key) => ({ key, slot: keyToSlot(key), value: binToHex(key) === binToHex(from) ? FROM_BALANCE : 0n }))
    .sort((left, right) => Number(bytesToSlotValue(left.slot) - bytesToSlotValue(right.slot)));
  const balanceCommitments = new Map(balanceRows.map((row, index) => [
    binToHex(row.slot),
    encodeEntryCommitment(
      row.slot, balanceRows[index + 1]?.slot ?? new Uint8Array(32), bigIntToVmNumber(row.value),
    ),
  ]));
  // `Contract.lockingBytecode` is hex; the covenant hashes the raw script bytes, so the spender key must be
  // decoded before it reaches the slot derivation. The spender is the Router: the authenticated graph caller.
  const allowanceSlot = keyToSlotMulti([from, hexToBin(router.lockingBytecode)]);
  const allowanceCommitment = encodeEntryCommitment(
    allowanceSlot, new Uint8Array(32), bigIntToVmNumber(ALLOWANCE),
  );
  const balanceEntryByKey = new Map([from, first, second].map((key) => [binToHex(key), randomUtxo({
    satoshis: 10_000n,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable' as const,
        commitment: binToHex(balanceCommitments.get(binToHex(keyToSlot(key)))!),
      },
    },
  })]));
  const allowanceEntry = randomUtxo({
    satoshis: 10_000n,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: { capability: 'mutable' as const, commitment: binToHex(allowanceCommitment) },
    },
  });
  // Logical journal order is [from-balance, allowance, row0-recipient, row1-recipient].
  const entries = [
    balanceEntryByKey.get(binToHex(from))!, allowanceEntry,
    balanceEntryByKey.get(binToHex(first))!, balanceEntryByKey.get(binToHex(second))!,
  ];
  for (const [key, entry] of balanceEntryByKey) {
    void key;
    await provider.addUtxo(getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), entry);
  }
  await provider.addUtxo(getEntryNftAddress(token, tokenSetup.categoryId, 'allowance'), allowanceEntry);

  // ---- Funding ---------------------------------------------------------------------------------------
  // The physical effects belong to the NOTIFIER after the SEC-6 reshape, so its block owns the satoshi
  // container and the two output-only slots (transfer, event) that need paired funding inputs.
  const container = randomUtxo({ satoshis: CONTAINER_SATS });
  await provider.addUtxo(getSatoshiContainerAddress(notifier, notifierSetup.categoryId), container);
  // The notifier's SCB1 route reserves 8 transfer and 8 event slots; only the first of each is reached.
  const notifierSlotFunding = Array.from({ length: 16 }, () => randomUtxo({ satoshis: 1000n }));
  const returnFunding = randomUtxo({ satoshis: 1000n });
  const projectionUtxos = Array.from({ length: 5 }, () => randomUtxo({ satoshis: 1000n }));
  const fee = randomUtxo({ satoshis: 500_000n });
  for (const utxo of [...notifierSlotFunding, returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);

  // ---- Route witnesses -------------------------------------------------------------------------------
  const routeUnlocker = (contract: Contract, artifact: typeof routerArtifact): any => contract
    .createCompilerRouteUnlocker(artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector));
  const routerRoute = routeUnlocker(router, routerArtifact);
  const tokenRoute = routeUnlocker(token, tokenArtifact);
  const accrueRoute = routeUnlocker(accrue, accrueArtifact);
  const vaultRoute = routeUnlocker(vault, vaultArtifact);
  const notifierRoute = routeUnlocker(notifier, notifierArtifact);

  const tokenInternalRouteWitnesses: Record<string, FunctionArgument> = {};
  // C2 batch groups follow the wrapper's journal order (allowance, balances[from], then balances[to] once per
  // row). Entry inputs are addressed by an explicit block-local offset, but the write-backs are positional, so
  // the settled outputs must be emitted in this same order. Supply these compiler-owned witnesses by their ABI
  // names: compiledGraphRouteArgs deliberately refuses positional internal arguments so route ABI changes cannot
  // silently shift a user-visible witness.
  const journalOrder = [1, 0, 2, 3];
  for (const [routeSlot, entryIndex] of journalOrder.map((slot, index) => [slot, index] as const)) {
    const decoded = decodeEntryCommitment(hexToBin(entries[routeSlot].token!.nft!.commitment));
    tokenInternalRouteWitnesses[`__internal__c2BatchSlot_${entryIndex}`] = decoded.slot;
    tokenInternalRouteWitnesses[`__internal__c2BatchProof_${entryIndex}`] = BigInt(entryIndex + 1);
    tokenInternalRouteWitnesses[`__internal__c2BatchNext_${entryIndex}`] = decoded.nextKey;
    tokenInternalRouteWitnesses[`__internal__c2BatchPredOut_${entryIndex}`] = -1n;
  }
  tokenInternalRouteWitnesses.__internal__c2BatchTrailingCount = 0n;
  const tokenRouteArgs = [
    ...layer3.compiledGraphRouteArgs(
      transcript, 1, layout.controllerInput, tokenInternalRouteWitnesses,
    ),
  ] as FunctionArgument[];
  // `__scb_key_allowance_sender_1` is the spender key the route must tie to the authenticated graph caller.
  // Locate it by its compiler-published ABI name: internal graph fields can move as the transcript evolves.
  if (hostile === 'caller') {
    const callerArgument = transcript.plan.participants[1]!.routeInputs
      .filter((input) => input.name !== '__internal__returnOutputIdx')
      .findIndex((input) => input.name === '__scb_key_allowance_sender_1');
    if (callerArgument < 0) throw new Error('C1 fixture: token route has no allowance sender witness');
    tokenRouteArgs[callerArgument] = hexToBin(accrue.lockingBytecode);
  }
  // ---- Inputs ----------------------------------------------------------------------------------------
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  // Router block: [master, dataNft]. No physical slot at all - that is the SEC-6 property.
  tx.addInput(
    routerSetup.masterUtxo,
    routerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    routerSetup.dataNftUtxos[0],
    createDataNftUnlocker(router, routerBaseInput, routerSetup.categoryId),
  );
  // Token block: [master, 4 x entry]. Every entry is authorized by co-spending the token master.
  tx.addInput(tokenSetup.masterUtxo, tokenRoute(...tokenRouteArgs as any));
  journalOrder.forEach((routeSlot) => tx.addInput(entries[routeSlot], createEntryNftUnlocker(
    token, tokenBaseInput, tokenSetup.categoryId, routeSlot === 1 ? 'allowance' : 'balances',
  )));
  // Accrue block: [master, dataNft]
  tx.addInput(
    accrueSetup.masterUtxo,
    accrueRoute(...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any),
  );
  tx.addInput(
    accrueSetup.dataNftUtxos[0],
    createDataNftUnlocker(accrue, accrueBaseInput, accrueSetup.categoryId),
  );
  // Vault block: [master, dataNft, returnEvent]
  tx.addInput(vaultSetup.masterUtxo, vaultRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 3, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![3]!),
  ));
  tx.addInput(
    vaultSetup.dataNftUtxos[0],
    createDataNftUnlocker(vault, vaultBaseInput, vaultSetup.categoryId),
  );
  tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
  // Notifier block: [master, dataNft, satoshiContainer, 8 x transfer, 8 x event] - every physical effect
  // in the graph, and the only participant that carries one.
  tx.addInput(
    notifierSetup.masterUtxo,
    notifierRoute(...layer3.compiledGraphRouteArgs(transcript, 4, layout.controllerInput) as any),
  );
  tx.addInput(
    notifierSetup.dataNftUtxos[0],
    createDataNftUnlocker(notifier, notifierBaseInput, notifierSetup.categoryId),
  );
  tx.addInput(container, createSatoshiContainerUnlocker(notifier, notifierBaseInput, notifierSetup.categoryId));
  notifierSlotFunding.forEach((funding) => tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature())));
  projectionUtxos.forEach((proof, participant) => tx.addInput(proof, projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
  )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  // ---- Outputs (one per input, same index) ------------------------------------------------------------
  const eventCommitment = binToHex(scriptToBytecode([
    bigIntToVmNumber(hostile === 'event-argument' ? TOTAL_AMOUNT + 1n : TOTAL_AMOUNT),
  ]));
  const eventAddress = getEventNftAddress(
    notifier, notifierSetup.categoryId, notifierArtifact.events![0].signature,
  );
  tx.addOutput({
    to: router.tokenAddress,
    amount: routerSetup.masterUtxo.satoshis,
    token: {
      category: routerSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({
    to: getDataNftAddress(router, routerSetup.categoryId),
    amount: routerSetup.dataNftUtxos[0].satoshis,
    token: {
      category: routerSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(
          routerArtifact.stateLayout!, { settled: TOTAL_AMOUNT },
        )[0],
      },
    },
  });

  tx.addOutput({
    to: token.tokenAddress,
    amount: tokenSetup.masterUtxo.satoshis,
    token: {
      category: tokenSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  const nextBalances = new Map<string, bigint>([
    [binToHex(from), FROM_BALANCE - TOTAL_AMOUNT],
    [binToHex(first), FIRST_AMOUNT],
    [binToHex(second), SECOND_AMOUNT],
  ]);
  for (const routeSlot of journalOrder) {
    const entry = entries[routeSlot];
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    const value = routeSlot === 1
      ? bigIntToVmNumber(hostile === 'allowance' ? ALLOWANCE : ALLOWANCE - TOTAL_AMOUNT)
      : bigIntToVmNumber(nextBalances.get(
        [from, first, second].map(binToHex)
          .find((key) => binToHex(keyToSlot(hexToBin(key))) === binToHex(decoded.slot))!,
      )!);
    tx.addOutput({
      to: getEntryNftAddress(token, tokenSetup.categoryId, routeSlot === 1 ? 'allowance' : 'balances'),
      amount: entry.satoshis,
      token: {
        category: tokenSetup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(decoded.slot, decoded.nextKey, value)),
        },
      },
    });
  }

  tx.addOutput({
    to: accrue.tokenAddress,
    amount: accrueSetup.masterUtxo.satoshis,
    token: {
      category: accrueSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({
    to: getDataNftAddress(accrue, accrueSetup.categoryId),
    amount: accrueSetup.dataNftUtxos[0].satoshis,
    token: {
      category: accrueSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(accrueArtifact.stateLayout!, {
          collateral: ACCRUE_COLLATERAL + (hostile === 'continuation' ? SHARES + 1n : SHARES),
        })[0],
      },
    },
  });

  tx.addOutput({
    to: vault.tokenAddress,
    amount: vaultSetup.masterUtxo.satoshis,
    token: {
      category: vaultSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({
    to: getDataNftAddress(vault, vaultSetup.categoryId),
    amount: vaultSetup.dataNftUtxos[0].satoshis,
    token: {
      category: vaultSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(vaultArtifact.stateLayout!, {
          elastic: VAULT_ELASTIC + TOTAL_AMOUNT, base: VAULT_BASE + SHARES,
        })[0],
      },
    },
  });
  const returnCommitment = binToHex(scriptToBytecode([
    hostile === 'result' ? scriptToBytecode([bigIntToVmNumber(SHARES + 1n)]) : sharesResult,
  ]));
  tx.addOutput({
    to: hexToBin('51'),
    amount: 1000n,
    token: {
      category: vaultSetup.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: returnCommitment },
    },
  });

  // Notifier block, in published slot order: master, dataNft, satoshiContainer, 8 transfer, 8 event.
  tx.addOutput({
    to: notifier.tokenAddress,
    amount: notifierSetup.masterUtxo.satoshis,
    token: {
      category: notifierSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({
    to: getDataNftAddress(notifier, notifierSetup.categoryId),
    amount: notifierSetup.dataNftUtxos[0].satoshis,
    token: {
      category: notifierSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(
          notifierArtifact.stateLayout!, { total: TOTAL_AMOUNT },
        )[0],
      },
    },
  });
  tx.addOutput({
    to: getSatoshiContainerAddress(notifier, notifierSetup.categoryId),
    amount: CONTAINER_SATS - TRANSFER_SATS,
  });
  // Reached transfer slot; the remaining seven stay unused.
  tx.addOutput({
    to: recipient,
    amount: hostile === 'resource' ? TRANSFER_SATS + 1n : TRANSFER_SATS,
  });
  for (let slot = 0; slot < 7; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  // Reached event slot; the remaining seven stay unused.
  tx.addOutput({
    to: hostile === 'event' ? notifier.tokenAddress : eventAddress,
    amount: 1000n,
    token: {
      category: notifierSetup.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: eventCommitment },
    },
  });
  for (let slot = 0; slot < 7; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });

  projectionUtxos.forEach(() => tx.addOutput({ to: p2pkh.address, amount: 1000n }));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });

  const built = tx.buildLibauthTransaction();
  return {
    provider,
    transaction: raw(tx),
    builder: tx,
    layout,
    plan,
    transcript,
    routerInputBytes: built.inputs[routerBaseInput].unlockingBytecode.length,
    tokenInputBytes: built.inputs[tokenBaseInput].unlockingBytecode.length,
    settled: {
      scalars: [
        {
          label: 'router.settled',
          address: getDataNftAddress(router, routerSetup.categoryId),
          layout: routerArtifact.stateLayout!,
        },
        {
          label: 'accrue.collateral',
          address: getDataNftAddress(accrue, accrueSetup.categoryId),
          layout: accrueArtifact.stateLayout!,
        },
        {
          label: 'vault.elastic/base',
          address: getDataNftAddress(vault, vaultSetup.categoryId),
          layout: vaultArtifact.stateLayout!,
        },
        {
          label: 'notifier.total',
          address: getDataNftAddress(notifier, notifierSetup.categoryId),
          layout: notifierArtifact.stateLayout!,
        },
      ],
      balances: {
        address: getEntryNftAddress(token, tokenSetup.categoryId, 'balances'),
        slots: [
          { label: 'from', slot: keyToSlot(from) },
          { label: 'first', slot: keyToSlot(first) },
          { label: 'second', slot: keyToSlot(second) },
        ],
      },
      allowance: {
        address: getEntryNftAddress(token, tokenSetup.categoryId, 'allowance'),
        slot: allowanceSlot,
      },
    },
    returnCommitment,
    eventCommitment,
  };
}

/** Pin the exact input whose covenant refused a transaction, rather than only that it was refused. */
function preflightOutcome(built: BuiltC1): string {
  try {
    layer3.preflightLayer3Transaction(built.builder);
    return 'ACCEPTED';
  } catch (error) {
    return (error as Error).message;
  }
}

describe('C1 DeFi integrated semantic capstone', () => {
  it('SEMANTIC: settles the whole DeFi composition in one transaction', async () => {
    const built = await buildC1();

    // The physical layout is a gapless concatenation of the four compiled blocks anchored at input 0.
    // Router [master, dataNft] = 2; Token [master, 4 entries] = 5; Accrue [master, dataNft] = 2;
    // Vault [master, dataNft, returnEvent] = 3; Notifier [master, dataNft, container, 8 transfer,
    // 8 event] = 19, the same slot reservation the Router used to carry before the SEC-6 reshape.
    expect(built.layout.participantInputs).toEqual([0, 2, 7, 9, 12]);
    expect(built.layout.projectionInputs).toEqual([31, 32, 33, 34, 35]);
    expect(built.layout.controllerInput).toBe(36);
    expect(built.layout.totalSlots).toBe(38);
    // The Vault is the only returning participant. Which slot of the Vault's block the SDK picks is its own
    // assembly choice, but the choice is NOT covenant-unbound: the transcript commits to it, and declaring a
    // different output of the same block is refused - see the 'return-position' row of the hostile matrix.
    expect(built.layout.returnOutputs).toEqual([null, null, null, 11, null]);
    // The planner records that the Accrue invocation depends on the Vault's result.
    expect(built.plan.invocations[3].resultDependencies).toEqual([4]);
    expect(built.plan.invocations[4].resultTypes).toEqual(['bigint']);

    layer3.preflightLayer3Transaction(built.builder);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');

    // Every transition is read back off the chain, against numbers this test states independently of the
    // builder: 100 - 30 debited and split 10/20, allowance 50 - 30, Bento (12,9) -> (12+30, 9+22),
    // Kashi collateral 5 + 22 - the SHARE the vault returned, not the amount that was deposited - and the
    // notifier's own running total, the fifth participant the SEC-6 reshape added.
    const expectedScalars = [
      buildInitialStateCommitments(built.settled.scalars[0].layout, { settled: 30n })[0],
      buildInitialStateCommitments(built.settled.scalars[1].layout, { collateral: 27n })[0],
      buildInitialStateCommitments(built.settled.scalars[2].layout, { elastic: 42n, base: 31n })[0],
      buildInitialStateCommitments(built.settled.scalars[3].layout, { total: 30n })[0],
    ];
    for (const [index, scalar] of built.settled.scalars.entries()) {
      const utxos = await built.provider.getUtxos(scalar.address);
      expect(
        utxos.map((utxo: any) => utxo.token?.nft?.commitment),
        `${scalar.label} settled post-state`,
      ).toContain(expectedScalars[index]);
    }

    const entryValue = async (address: string, slot: Uint8Array): Promise<bigint | undefined> => {
      const utxos = await built.provider.getUtxos(address);
      const match = utxos
        .map((utxo: any) => decodeEntryCommitment(hexToBin(utxo.token?.nft?.commitment ?? '')))
        .find((entry) => binToHex(entry.slot) === binToHex(slot));
      return match === undefined
        ? undefined
        : vmNumberToBigInt(match.value, { requireMinimalEncoding: false }) as bigint;
    };
    const balanceOf = async (label: string): Promise<bigint | undefined> => entryValue(
      built.settled.balances.address,
      built.settled.balances.slots.find((entry) => entry.label === label)!.slot,
    );
    expect(await balanceOf('from')).toBe(70n);
    expect(await balanceOf('first')).toBe(10n);
    expect(await balanceOf('second')).toBe(20n);
    expect(await entryValue(built.settled.allowance.address, built.settled.allowance.slot)).toBe(20n);
  }, 180_000);

  // Each substitution is refused by the covenant that owns the substituted field: caller/allowance by the Token
  // master route (2), the result-dependent continuation by the Accrue master route (7), and result plus the
  // result by the Vault master route (9), and the three physical effects by the Notifier master route (12) -
  // the effects moved there with the SEC-6 reshape and their refusing covenant moved with them. The one field
  // the CONTROLLER owns is the return-event position: the Vault's block is inputs 9..11, so declaring 10 keeps
  // the slot inside the block and any block-membership range check still passes - it is refused at the
  // controller (36) because the transcript binds the declared slot to the committed result commitment.
  it.each([
    { hostile: 'caller' as const, input: 2 },
    { hostile: 'allowance' as const, input: 2 },
    { hostile: 'result' as const, input: 9 },
    { hostile: 'continuation' as const, input: 7 },
    { hostile: 'resource' as const, input: 12 },
    { hostile: 'event' as const, input: 12 },
    { hostile: 'event-argument' as const, input: 12 },
    { hostile: 'return-position' as const, input: 36 },
  ])(
    'HOSTILE: substituting the $hostile field is rejected at input $input',
    async ({ hostile, input }) => {
      // Honest control: identical assembly, only the named field differs.
      const control = await buildC1();
      expect(preflightOutcome(control)).toBe('ACCEPTED');
      await expect(control.provider.sendRawTransaction(control.transaction)).resolves.toBeTypeOf('string');

      const attacked = await buildC1(hostile);
      // Every substitution is length-preserving, so an equal serialized size is evidence that the attacked
      // transaction added or removed no input, output or witness element. It is NOT evidence that only the
      // named field differs: two honest builds of this fixture already differ in bytes (fresh outpoints and
      // categories per call), so this pins SHAPE, and the substitution itself is what pins the field.
      expect(attacked.transaction.length).toBe(control.transaction.length);
      const outcome = preflightOutcome(attacked);
      expect(outcome).toContain(`BCH-2026 preflight failed at input ${input}`);
      await expect(attacked.provider.sendRawTransaction(attacked.transaction)).rejects.toThrow(
        `mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index ${input}: Program failed an OP_VERIFY operation.)`,
      );
    },
    300_000,
  );

  /**
   * SEC-6 SHAPE GUARD - a check that this fixture stays in the shape it was measured in, NOT the thing that
   * makes unbound edges impossible. The compiler invariant does that (see the header): an effect-carrying
   * caller is kept behind OP_INVOKE by `keepsGraphEmissionBinding`, not flattened, and the only exit is a
   * named refusal for a token-container effect or a storage-pointer parameter.
   *
   * What this asserts is still worth asserting. `emit`, `transfer` and the token-container methods are the
   * three effects the compiler counts, and each makes the route wrapper reserve an owner-local `event` /
   * `transfer` / `tcTransfer` slot, so the published block layout is an SDK-visible proxy for the internal
   * predicate. Holding it over the whole graph keeps every capacity and index figure in this file attributable
   * to the composition that produced them, and would catch a silent drift back to the pre-reshape layout.
   */
  it('SEMANTIC: no calling participant carries an owner-local physical slot', async () => {
    const built = await buildC1();
    const PHYSICAL = new Set(['event', 'transfer', 'tcTransfer']);
    const callers = new Set(built.plan.invocations
      .filter((invocation) => invocation.parent !== null)
      .map((invocation) => built.plan.invocations[invocation.parent!].callee));
    // The Router calls three times and the Accrue once, so both are callers; Token and Vault are leaves.
    expect([...callers].sort((left, right) => left - right)).toEqual([0, 2]);
    for (const participant of callers) {
      const slots = built.plan.participants[participant].blockLayout!.slots
        .filter((slot) => PHYSICAL.has(slot.kind));
      expect(slots, `participant ${participant} declares physical slots ${JSON.stringify(slots)}`)
        .toHaveLength(0);
    }
    // And the effects really are still in the graph - they moved to the Notifier, they were not deleted.
    // Its route reserves 8 conditional slots of each kind; only the first of each is reached.
    const notifierSlots = built.plan.participants[4].blockLayout!.slots
      .filter((slot) => PHYSICAL.has(slot.kind));
    expect(notifierSlots.filter((slot) => slot.kind === 'event')).toHaveLength(8);
    expect(notifierSlots.filter((slot) => slot.kind === 'transfer')).toHaveLength(8);
  }, 180_000);

  it('MEASURED: reports the honest input sizes on the relaxed semantic profile', async () => {
    const built = await buildC1();
    // Router 4,843 bytes and token 7,058 before the SEC-6 reshape; both stay well under the ordinary
    // 10,000-byte input limit after it, and the Router can only have shrunk - it lost two physical effects.
    // The band is asserted rather than the exact figure so compiler work elsewhere does not falsely fail here.
    expect(built.routerInputBytes).toBeGreaterThan(1_000);
    expect(built.routerInputBytes).toBeLessThan(10_000);
    expect(built.tokenInputBytes).toBeGreaterThan(1_000);
    expect(built.tokenInputBytes).toBeLessThan(10_000);
  }, 180_000);

  it('MEASURED: the same composition fits ordinary BCH-2026 capacity', async () => {
    // An F1-style capacity measurement, NOT a CONSENSUS_FIT or POLICY_FIT claim: only the consensus capacity
    // knobs the semantic profile relaxes are restored. Relay dust is untested. Standard transaction SIZE is
    // measured at the end of this test and is a separate claim from the operation-cost one.
    //
    // X23 history. This measurement previously recorded a failure at input 29 - the first graph projection
    // proof - reported as an overrun of 626 on a 6,579,200 budget, "0.0095% over". That reading was an
    // artifact of the VM's abort semantics: the density check runs after every operation, so the cost it
    // reports is always within one operation of the budget no matter how far the honest evaluation still had
    // to go. Run to completion on a relaxed budget, the same input needed 13,588,248 - 2.07x the budget, not
    // 0.0095% over. Every Layer-3 sidecar input was over: 29/30/31/32 at 2.07x/1.85x/1.85x/1.75x and the
    // controller at input 33 at 2.28x.
    //
    // The cost was almost entirely instruction count (95.8% of it), and almost all of that was one lowering:
    // a write to a stack variable at depth N costs ~22N instructions, because the compiler moves N items to
    // the altstack and back. Rewriting both covenants to make far fewer, far shallower variable writes -
    // without removing a single check - took input 29 to 2,074,606 (0.46x) and input 33 to 1,600,153 (0.73x).
    // Those input indices are PRE-SEC-6-RESHAPE: the sidecars are now 31..35 and the controller 36, and the
    // graph has five participants rather than four. The result is re-measured below rather than carried over.
    const built = await buildC1('none', createOrdinaryCapacityProvider);
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');

    // Run every sidecar input to completion on a relaxed budget and report its ratio against the ORDINARY
    // 800-per-byte budget, so "it fits" is a measured margin and not just an absence of rejection.
    const transaction = built.builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.builder.inputs as never);
    const RELAXED_BUDGET_LIMITS = {
      maximumInputBytes: 10_000,
      maximumStackItemBytes: 10_000,
      maximumTransactionBytes: 1_000_000,
      maximumNftCommitmentBytes: 128,
      operationCostBudgetPerByte: 800_000,
      hashDigestIterationsPerByte: 3_000,
    };
    const vm = createVirtualMachineBch2026ForProvider({ consensusLimits: RELAXED_BUDGET_LIMITS } as never);
    const measured: string[] = [];
    const ratioAt = (input: number): number => {
      const state = vm.evaluate({ inputIndex: input, sourceOutputs, transaction }) as any;
      expect(state.error, `input ${input} failed on the relaxed budget`).toBeUndefined();
      const metrics = state.metrics;
      const ratio = metrics.operationCost / (metrics.densityControlLength * 800);
      measured.push(`${input}:${metrics.densityControlLength}b:${metrics.operationCost}`
        + `:${metrics.evaluatedInstructionCount}i:${ratio.toFixed(4)}`);
      return ratio;
    };
    // RE-MEASURED at this commit, run to completion, ratio against the ORDINARY 800/byte budget:
    //
    //   input             bytes   cost        instructions   ratio
    //   0   P0 Router     3,777     647,144     5,645        0.2142
    //   2   P1 Token      7,492   1,174,602     9,129        0.1960
    //   7   P2 Accrue     3,134     566,383     5,083        0.2259
    //   9   P3 Vault      3,415     755,279     6,920        0.2765
    //   12  P4 Notifier   4,857     835,595     7,505        0.2150
    //   31-35 projections 6,035 each, 2,196,060-2,245,022, 17,686 each, ratio 0.4549-0.4650
    //   36  controller    2,880   1,424,386     9,561        0.6182   <- the worst input, and it FITS
    //
    // Serialized transaction: 63,315 bytes, inside the 100,000-byte standard relay ceiling as well as the
    // 1,000,000-byte consensus one. Layout: participants [0,2,7,9,12], projections [31..35], controller 36,
    // 38 slots, 1,314-byte transcript.
    //
    // The projection and serialized rows moved after X38 wrote them, and by construction rather than by drift:
    // X5 edited `generateGraphProjectionVerifier` only, adding 37 bytes and 245 instructions to each of the
    // five projection scripts. 5,998 -> 6,035 B, 17,441 -> 17,686 instructions, and 63,130 -> 63,315 bytes of
    // transaction, which is exactly 5 x 37. Every participant row and the whole controller row reproduce to the
    // operation, which is the control: a change scoped to one covenant moved exactly one covenant's figures.
    //
    // WHAT THIS CORRECTS. The block that stood here recorded projections ~0.5231/0.5154/0.5151/0.5204/0.5127
    // and controller 0.8057, and inferred from a pre-reshape controller of 0.7268 that "the fifth participant
    // costs about 7 points on each projection and 8 on the controller". Both halves are wrong. The figures were
    // taken on a reshape branch before X24 (unroll the deep stack write) and X27 (suffix-split the transcript
    // in `attest`) were composed on one tree and were never re-run; against the same 0.7268 the measured 0.6182
    // is 10.9 points LOWER, not 8 higher. Fifteen further commits touching a `src/` directory landed between
    // the last independent re-measurement (690c868c) and this commit, so a point-in-time capacity figure is
    // never a standing claim; the run prints its own table above the assertions for exactly that reason.
    // Bands are asserted rather than exact figures so compiler work elsewhere does not falsely fail here; what
    // the reshape has to preserve is that NOTHING crosses 1.0.
    const projectionRatios = built.layout.projectionInputs.map(ratioAt);
    const controllerRatio = ratioAt(built.layout.controllerInput);
    const participantRatios = built.layout.participantInputs.map(ratioAt);
    console.log(`C1 capacity, run to completion (input:bytes:cost:instructions:ratio): ${measured.join(' ')}`);
    console.log(`C1 serialized transaction size: ${built.transaction.length / 2} bytes; `
      + `transcript ${built.transcript.bytes.length} bytes; ${built.layout.totalSlots} slots`);
    for (const ratio of participantRatios) expect(ratio).toBeLessThan(0.7);
    for (const ratio of projectionRatios) expect(ratio).toBeLessThan(0.7);
    expect(controllerRatio).toBeLessThan(1);
    expect(controllerRatio).toBeGreaterThan(Math.max(...projectionRatios));
    // The serialized size is a POLICY question and separate from the consensus-knob one above. C1 clears both;
    // C3 clears the consensus one and not the relay ceiling, so the two claims are recorded separately.
    expect(built.transaction.length / 2).toBeLessThan(100_000);

    // X60. RELAY DUST, the third policy rule, and the one that actually refused this shape on a real node.
    // Size and density were both measured here for rounds while a 10-satoshi output made the whole
    // transaction unrelayable, because dust is off across the mock stack by default and no reading could
    // reach it. This applies BCHN's rule to the built bytes, where no provider setting can mask it.
    expect(formatDustOutputs(dustOutputs(transaction))).toBe('no dust outputs');

    // KNOB LIVENESS. "It fits under ordinary capacity" is only evidence if the budget knob can refuse these
    // exact bytes. Same transaction, same source outputs, budget divided by four: the worst input must now fail
    // on density. Without this control an aborted evaluation reading the budget back would look like a pass.
    const tightened = createVirtualMachineBch2026ForProvider({
      consensusLimits: { ...RELAXED_BUDGET_LIMITS, operationCostBudgetPerByte: 200 },
    } as never);
    const tight = tightened.evaluate({
      inputIndex: built.layout.controllerInput, sourceOutputs, transaction,
    }) as any;
    expect(tight.error, 'the operation-cost knob does not bite at 200/byte').toBeDefined();
    expect(String(tight.error)).toMatch(/density|operation cost/i);
  }, 180_000);
});

/**
 * Why C1 is a tree with one returning leaf rather than one router fanning out to everything.
 *
 * These four shapes are refused today. They are pinned as the boundary the capstone was designed around, not as
 * desired behavior. Three carry a remedy in the artifact diagnostic; the fourth is a compiler error naming the
 * handler. The third was a GAP when this block was written - an internal code-generation error with no named
 * refusal - and was closed as board task X22.
 */
describe('C1 admissibility boundaries the composition was shaped around', () => {
  const boundaryOptions = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: `76a914${'11'.repeat(20)}88ac`,
    messageBusControllerCategory: 'ab'.repeat(32),
  };
  const rejectionOf = (source: string): string => {
    const artifact = compileString(source, boundaryOptions);
    expect(artifact.hiddenBatch).toBeUndefined();
    const diagnostic = (artifact.diagnostics ?? [])
      .find((entry: any) => entry.code === 'hidden-batch-route-not-synthesized');
    expect(diagnostic).toBeDefined();
    return diagnostic!.message;
  };

  it('BOUNDARY: a returning handler that also makes an outgoing call is refused by name', () => {
    const message = rejectionOf(`pragma solidcash >=0.8.0;
interface IC1Token { function transferFrom(bytes20 from, bytes20 to, bigint amount); }
contract C1VaultCalling(address token) {
  bigint elastic;
  function deposit(bytes20 from, bytes20 to, bigint amount) public returns (bigint) {
    this.elastic = this.elastic + amount;
    IC1Token(token).transferFrom(from, to, amount);
    require(amount > 0);
    return amount * 2;
  }
}`);
    expect(message).toContain('batched-handler-forward-call-not-enabled');
    // This is why the Vault is a leaf and the Token hangs off the Router instead.
    expect(message).toContain('move the call into its own handler');
  });

  it('BOUNDARY: a returning handler that also carries an effect is refused by name', () => {
    const message = rejectionOf(`pragma solidcash >=0.8.0;
contract C1VaultEmitting() {
  bigint elastic;
  event Deposited(bigint amount);
  function deposit(bigint amount) public returns (bigint) {
    this.elastic = this.elastic + amount;
    emit Deposited(amount);
    require(amount > 0);
    return amount * 2;
  }
}`);
    expect(message).toContain('result-route-requires-effect-free-handlers');
    // This is why the event NFT is emitted by the Router and not by the returning Vault.
    expect(message).toContain('split the return and the effect into two handlers');
  });

  it('admits a handler that consumes a result and carries an effect', () => {
    // Was the fourth entry in this block and the only GAP: code generation threw its own internal
    // `Unbound return call in __scb1; graph=undefined` with no named refusal and no diagnostic channel entry.
    // Closed as board task X22 - route synthesis now names the handler and the reason before code generation.
    // Pinned tests for the refusal and its controls live in solidc/test/HiddenBatchAbsenceDiagnostic.test.ts.
    const source = `pragma solidcash >=0.8.0;
interface IC1Vault { function deposit(bigint amount) returns (bigint); }
contract C1AccrueEmitting(address vault) {
  bigint collateral;
  event Accrued(bigint shares);
  function accrue(bigint amount) public {
    bigint shares = IC1Vault(vault).deposit(amount);
    this.collateral = this.collateral + shares;
    emit Accrued(shares);
    require(shares >= 0);
  }
}`;
    expect(() => compileString(source, boundaryOptions)).not.toThrow();
    const artifact = compileString(source, boundaryOptions);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'accrue')?.eligible).toBe(true);
  });

  it('admits a consumed result alongside a second edge', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
interface IC1Vault { function deposit(bigint amount) returns (bigint); }
interface IC1Accrue { function accrue(bigint amount); }
contract C1RouterDirect(address vault, address accrue) {
  bigint settled;
  function settle(bigint amount) public {
    bigint shares = IC1Vault(vault).deposit(amount);
    IC1Accrue(accrue).accrue(shares);
    this.settled = this.settled + shares;
    require(shares >= 0);
  }
}`, boundaryOptions);
    expect(artifact.hiddenBatch).toBeDefined();
    expect(artifact.abi.find((entry) => entry.name === 'settle')?.externalCalls).toHaveLength(2);
  });
});

/**
 * X59 + X60 + X74. C1 BUILT AGAINST A REAL BCHN NODE, AND WHAT IT TOOK TO GET THERE.
 *
 * ROUND 17 offered C1's mock-built bytes to BCHN and got `64: dust` - the only capstone whose verdict was a
 * real rule rather than `missing-inputs`, because BCHN checks output dust BEFORE it looks up inputs. X60 found
 * the cause (a 10-satoshi output to a one-byte placeholder script) and fixed it at the top of this file, which
 * moved C1 past every pre-lookup policy rule and got its scripts EXECUTED.
 *
 * ROUND 18 then got `mandatory-script-verify-flag-failed (OP_EQUALVERIFY)` at inputs 2-6 - the token master
 * route and its four entry NFTs - and localized it to a TEST PROVIDER defect, not a covenant or fixture one:
 * `RegtestNetworkProvider.addUtxo` ignored `utxo.token.category` and silently minted a fresh genesis per call
 * (`category: hexToBin(fundingInput.txid)`), so four entry NFTs seeded under the Token's category arrived
 * under FOUR DIFFERENT categories and the covenant that requires an entry to carry its owner's category
 * refused, correctly. The fixture could not route around it: C1's allowance entry is keyed on the ROUTER's
 * category-pinned locking bytecode and the Router pins the TOKEN's as a constructor argument, so neither
 * genesis can precede the other and the allowance entry cannot be minted in the Token's genesis transaction.
 *
 * X74 FIXED THE PROVIDER, not the fixture and not the covenants. Every genesis it creates now retains that
 * category's minting NFT at its own address, and `addUtxo` co-spends it to mint into the REQUESTED category;
 * a request it cannot satisfy throws by name instead of substituting. The four entries now arrive under the
 * Token's own category, which is what the block below asserts before it asserts anything about the node.
 *
 * NOTHING IS RELAXED HERE. `RegtestNetworkProvider` carries no `consensusLimits`, so the SDK's probe VM is
 * libauth's ordinary BCH-2026 instruction set, and the node applies real consensus plus real standard relay
 * policy - the size ceiling, the dust rule and the SigChecks limits included. The relaxed capacity profile the
 * SEMANTIC tests above use is a different provider and does not reach this block.
 *
 * Requires the docker regtest stack; see the root CLAUDE.md.
 */
describe.runIf(process.env.TESTS_USE_REGTEST)('X59: C1 on a real BCHN node', () => {
  it('CONSENSUS: BCHN executes the five-participant DeFi composition, accepts it and mines it', async () => {
    const built = await buildC1('none', createTestProvider);
    // The shape is the one this file asserts against everywhere else - built by the same builder, not a copy.
    expect(built.layout.participantInputs).toEqual([0, 2, 7, 9, 12]);

    const transaction = built.builder.buildLibauthTransaction();
    // X60 HOLDS ON A LIVE BUILD: no dust output survives, which is what moved C1 past the pre-lookup rules.
    expect(formatDustOutputs(dustOutputs(transaction))).toBe('no dust outputs');
    expect(built.transaction.length / 2).toBeLessThan(100_000);

    // X74 HOLDS ON A LIVE BUILD, read off the source outputs the node is about to spend: the Token master and
    // its four entry NFTs share ONE category. This is the direct inverse of the round-18 blocker, and the
    // categories are minted per run, so it is asserted as agreement rather than pinned to a value.
    const sourceOutputs = generateLibauthSourceOutputs(built.builder.inputs as never);
    const categoryAt = (input: number): string => binToHex(sourceOutputs[input].token!.category);
    const tokenCategory = categoryAt(2);
    expect(tokenCategory).toMatch(/^[0-9a-f]{64}$/);
    expect([3, 4, 5, 6].map(categoryAt)).toEqual([tokenCategory, tokenCategory, tokenCategory, tokenCategory]);

    // Every input evaluates locally against the same bytes the node will see. Round 18 measured [2, 3, 4, 5, 6]
    // here; a correctly seeded build refuses nothing.
    const vm = createVirtualMachineBch2026ForProvider(built.provider as never);
    const refusing = transaction.inputs
      .map((_input, index) => ({ index, state: vm.evaluate({ inputIndex: index, sourceOutputs, transaction }) }))
      .filter((row) => (row.state as any).error !== undefined)
      .map((row) => row.index);
    expect(refusing).toEqual([]);

    const accepted = await acceptedByNode(built.provider as never, transaction, built.transaction);
    console.log(`X74 C1 accepted by BCHN: ${accepted.txid} at height ${accepted.blockHeight}, `
      + `${accepted.serializedBytes} B, ${accepted.inputCount} inputs`);
    expect(accepted.inputCount).toBe(38);
    expect(accepted.outputCount).toBe(38);
    // A node that accepts and mines a transaction has executed every input script. This is the reading neither
    // `64: dust` nor `missing-inputs` could ever give: the covenants ran, under real consensus, on a real
    // chain. It is NOT a claim about the relaxed semantic profile the tests above measure.
    expect(accepted.blockHeight).toBeGreaterThan(0);
  }, 900_000);

  /**
   * THE CONTROL. Without it, "the node accepted it" is not evidence that the node was checking anything: an
   * acceptance only means something if a transaction this composition's covenants should refuse is refused BY
   * THE NODE, on the same chain, in the same run. This is the forged ERC-20 caller witness - the same hostile
   * build the SEMANTIC block above refuses at input 2 - and it is seeded through the same fixed provider, so
   * its refusal is now about the forgery rather than about mis-seeded categories.
   */
  it('CONSENSUS: BCHN refuses the forged graph caller', async () => {
    const built = await buildC1('caller', createTestProvider);
    // R3. NAME THE CAUSE. C1 has been refused by this node for `64: dust` and for mis-seeded categories in
    // earlier rounds, and a bare `rejects.toThrow()` cannot tell either of those from the forgery this test
    // is about - nor from `missing-inputs`, where the node never executed a script at all. Measured at
    // `abb3f13b`: OP_EQUALVERIFY, code 16. The opcode is not pinned; the script-verify flag is.
    const refusal = await built.provider.sendRawTransaction(built.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    console.log(`X59 C1 node refusal: ${refusal}`);
    expect(refusal).toMatch(/mandatory-script-verify-flag-failed/);
  }, 900_000);
});
