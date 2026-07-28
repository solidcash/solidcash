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
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
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
 * SEMANTIC evidence only, on the named `layer3-bch2026-semantic-relaxed-v1` profile: BCH-2026 opcodes,
 * introspection and the real 128-byte NFT commitment, relaxed capacity. Not consensus-fit, not policy-fit.
 *
 * One transaction composes four independently compiled participants:
 *
 *   Router --transferFrom x2--> Token          (caller-authorized ERC-20, msg.sender == Router)
 *      |
 *      +---accrue--> Accrue --deposit--> Vault (Bento/Kashi share accounting, returns a share result)
 *
 * The Router additionally writes scalar state, emits an ordinary event NFT and moves satoshis out of its
 * container; the Vault publishes a return-event NFT; the Accrue post-state is a function of that authenticated
 * result. Every one of those is settled by one 35-slot transaction.
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

const ROUTER = `pragma solidcash >=0.8.0;
interface IC1Token { function transferFrom(bytes20 from, bytes20 to, bigint amount); }
interface IC1Accrue { function accrue(bigint amount); }
contract C1Router(address token, address accrue) {
  bigint settled;
  event Settled(bigint amount);
  function settle(
    bytes20 from, bytes20 first, bytes20 second, bigint firstAmount, bigint secondAmount, bytes recipient
  ) public {
    IC1Token(token).transferFrom(from, first, firstAmount);
    IC1Token(token).transferFrom(from, second, secondAmount);
    IC1Accrue(accrue).accrue(firstAmount + secondAmount);
    this.settled = this.settled + firstAmount + secondAmount;
    emit Settled(firstAmount + secondAmount);
    this.transfer(recipient, firstAmount);
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
 * Exactly one authenticated field is substituted per hostile build; every other byte of the transaction is
 * identical to the `none` control produced by the same function.
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
  | 'event-argument';

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

interface BuiltC1 {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
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
  createProvider: () => MockNetworkProvider = createLayer3SemanticTestProvider,
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
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };

  // Compile leaf-first: every caller pins its callee's instantiated locking bytecode as a constructor argument.
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

  const routerArtifact = compileString(ROUTER, options);
  const routerBase = new Contract(
    routerArtifact, [token.lockingBytecode, accrue.lockingBytecode], { provider },
  );
  const routerSetup = await setupStatefulUtxos(
    provider, routerBase, routerArtifact.stateLayout!, { settled: 0n },
  );
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  const from = hexToBin('31'.repeat(20));
  const first = hexToBin('32'.repeat(20));
  const second = hexToBin('33'.repeat(20));
  const recipient = Uint8Array.of(0x51);

  const plan = layer3.planCompiledGraph([
    { artifact: routerArtifact, lockingBytecode: router.lockingBytecode },
    { artifact: tokenArtifact, lockingBytecode: token.lockingBytecode },
    { artifact: accrueArtifact, lockingBytecode: accrue.lockingBytecode },
    { artifact: vaultArtifact, lockingBytecode: vault.lockingBytecode },
  ], [
    {
      parent: null,
      callee: 0,
      function: 'settle',
      args: [from, first, second, FIRST_AMOUNT, SECOND_AMOUNT, recipient],
    },
    { parent: 0, callee: 1, function: 'transferFrom', args: [from, first, FIRST_AMOUNT] },
    { parent: 0, callee: 1, function: 'transferFrom', args: [from, second, SECOND_AMOUNT] },
    { parent: 0, callee: 2, function: 'accrue', args: [TOTAL_AMOUNT] },
    { parent: 3, callee: 3, function: 'deposit', args: [TOTAL_AMOUNT] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const [routerBaseInput, tokenBaseInput, accrueBaseInput, vaultBaseInput] = layout.participantInputs;

  // The share the Vault publishes, packed exactly as the route emits it, and the transcript that commits to it.
  const sharesResult = scriptToBytecode([bigIntToVmNumber(SHARES)]);
  const transcript = layer3.finalizeCompiledGraph(
    plan, { 4: binToHex(sharesResult) }, layout.participantInputs, layout.returnOutputs,
    ['', '', '', binToHex(sharesResult)], layout.projectionInputs,
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
  const container = randomUtxo({ satoshis: CONTAINER_SATS });
  await provider.addUtxo(getSatoshiContainerAddress(router, routerSetup.categoryId), container);
  // The router block reserves 8 transfer slots and 8 event slots; only the first of each is reached.
  const routerSlotFunding = Array.from({ length: 16 }, () => randomUtxo({ satoshis: 1000n }));
  const returnFunding = randomUtxo({ satoshis: 1000n });
  const projectionUtxos = Array.from({ length: 4 }, () => randomUtxo({ satoshis: 1000n }));
  const fee = randomUtxo({ satoshis: 500_000n });
  for (const utxo of [...routerSlotFunding, returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);

  // ---- Route witnesses -------------------------------------------------------------------------------
  const routeUnlocker = (contract: Contract, artifact: typeof routerArtifact): any => contract
    .createCompilerRouteUnlocker(artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector));
  const routerRoute = routeUnlocker(router, routerArtifact);
  const tokenRoute = routeUnlocker(token, tokenArtifact);
  const accrueRoute = routeUnlocker(accrue, accrueArtifact);
  const vaultRoute = routeUnlocker(vault, vaultArtifact);

  const tokenRouteArgs = [
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput),
  ] as FunctionArgument[];
  // Route input 7 is `__scb_key_allowance_sender_1`: the spender key the route must tie to the authenticated
  // graph caller. Substituting it is the caller forgery.
  if (hostile === 'caller') tokenRouteArgs[7] = hexToBin(accrue.lockingBytecode);
  // C2 batch groups follow the wrapper's journal order (allowance, balances[from], then balances[to] once per
  // row). Entry inputs are addressed by an explicit block-local offset, but the write-backs are positional, so
  // the settled outputs must be emitted in this same order.
  const journalOrder = [1, 0, 2, 3];
  for (const routeSlot of journalOrder) {
    const decoded = decodeEntryCommitment(hexToBin(entries[routeSlot].token!.nft!.commitment));
    tokenRouteArgs.push(
      decoded.slot, BigInt(journalOrder.indexOf(routeSlot) + 1), decoded.nextKey, -1n,
    );
  }
  tokenRouteArgs.push(0n);

  // ---- Inputs ----------------------------------------------------------------------------------------
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  // Router block: [master, dataNft, satoshiContainer, 8 x transfer, 8 x event]
  tx.addInput(
    routerSetup.masterUtxo,
    routerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    routerSetup.dataNftUtxos[0],
    createDataNftUnlocker(router, routerBaseInput, routerSetup.categoryId),
  );
  tx.addInput(container, createSatoshiContainerUnlocker(router, routerBaseInput, routerSetup.categoryId));
  routerSlotFunding.forEach((funding) => tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature())));
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
    router, routerSetup.categoryId, routerArtifact.events![0].signature,
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
    to: getSatoshiContainerAddress(router, routerSetup.categoryId),
    amount: CONTAINER_SATS - FIRST_AMOUNT,
  });
  // Reached transfer slot; the remaining seven stay unused.
  tx.addOutput({
    to: recipient,
    amount: hostile === 'resource' ? FIRST_AMOUNT + 1n : FIRST_AMOUNT,
  });
  for (let slot = 4; slot <= 10; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  // Reached event slot; the remaining seven stay unused.
  tx.addOutput({
    to: hostile === 'event' ? router.tokenAddress : eventAddress,
    amount: 1000n,
    token: {
      category: routerSetup.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: eventCommitment },
    },
  });
  for (let slot = 12; slot <= 18; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });

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
    expect(built.layout.participantInputs).toEqual([0, 19, 24, 26]);
    expect(built.layout.projectionInputs).toEqual([29, 30, 31, 32]);
    expect(built.layout.controllerInput).toBe(33);
    expect(built.layout.totalSlots).toBe(35);
    // The Vault is the only returning participant. This is the SDK's assembly choice - the return-event
    // position is covenant-unbound, so this asserts where the SDK put it, not where a covenant requires it.
    expect(built.layout.returnOutputs).toEqual([null, null, null, 28]);
    // The planner records that the Accrue invocation depends on the Vault's result.
    expect(built.plan.invocations[3].resultDependencies).toEqual([4]);
    expect(built.plan.invocations[4].resultTypes).toEqual(['bigint']);

    layer3.preflightLayer3Transaction(built.builder);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');

    // Every transition is read back off the chain, against numbers this test states independently of the
    // builder: 100 - 30 debited and split 10/20, allowance 50 - 30, Bento (12,9) -> (12+30, 9+22),
    // Kashi collateral 5 + 22 - the SHARE the vault returned, not the amount that was deposited.
    const expectedScalars = [
      buildInitialStateCommitments(built.settled.scalars[0].layout, { settled: 30n })[0],
      buildInitialStateCommitments(built.settled.scalars[1].layout, { collateral: 27n })[0],
      buildInitialStateCommitments(built.settled.scalars[2].layout, { elastic: 42n, base: 31n })[0],
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

  // Each substitution is refused by the covenant that owns the substituted field, not by the controller:
  // caller/allowance by the Token master route (19), result by the Vault master route (26), the
  // result-dependent continuation by the Accrue master route (24), resource/event by the Router route (0).
  it.each([
    { hostile: 'caller' as const, input: 19 },
    { hostile: 'allowance' as const, input: 19 },
    { hostile: 'result' as const, input: 26 },
    { hostile: 'continuation' as const, input: 24 },
    { hostile: 'resource' as const, input: 0 },
    { hostile: 'event' as const, input: 0 },
    { hostile: 'event-argument' as const, input: 0 },
  ])(
    'HOSTILE: substituting the $hostile field is rejected at input $input',
    async ({ hostile, input }) => {
      // Honest control: identical assembly, only the named field differs.
      const control = await buildC1();
      expect(preflightOutcome(control)).toBe('ACCEPTED');
      await expect(control.provider.sendRawTransaction(control.transaction)).resolves.toBeTypeOf('string');

      const attacked = await buildC1(hostile);
      // Every substitution is length-preserving, so an equal serialized size is evidence that the attacked
      // transaction added or removed no input, output or witness element: only the named field differs.
      expect(attacked.transaction.length).toBe(control.transaction.length);
      const outcome = preflightOutcome(attacked);
      expect(outcome).toContain(`layer3: BCH-2026 preflight failed at input ${input}`);
      await expect(attacked.provider.sendRawTransaction(attacked.transaction)).rejects.toThrow();
    },
    300_000,
  );

  it('MEASURED: reports the honest input sizes on the relaxed semantic profile', async () => {
    const built = await buildC1();
    // Measured at this commit: router 4,843 bytes, token 7,058. Both sit under the ordinary 10,000-byte input
    // limit, so participant script size is NOT what keeps C1 off ordinary capacity - the next test names what is.
    // The band is asserted rather than the exact figure so compiler work elsewhere does not falsely fail here.
    expect(built.routerInputBytes).toBeGreaterThan(1_000);
    expect(built.routerInputBytes).toBeLessThan(10_000);
    expect(built.tokenInputBytes).toBeGreaterThan(1_000);
    expect(built.tokenInputBytes).toBeLessThan(10_000);
  }, 180_000);

  it('MEASURED: the same composition fits ordinary BCH-2026 capacity', async () => {
    // An F1-style capacity measurement, NOT a CONSENSUS_FIT or POLICY_FIT claim: only the consensus capacity
    // knobs the semantic profile relaxes are restored. Relay dust and standard transaction size are untested.
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
    const built = await buildC1('none', createOrdinaryCapacityProvider);
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);
});

/**
 * Why C1 is a tree with one returning leaf rather than one router fanning out to everything.
 *
 * These four shapes are refused today. They are pinned as the boundary the capstone was designed around, not as
 * desired behavior. Three are named refusals - two carry a remedy in the artifact diagnostic, one is a compiler
 * error naming the handler. The fourth is a GAP: an internal code-generation error with no named refusal.
 */
describe('C1 admissibility boundaries the composition was shaped around', () => {
  const boundaryOptions = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: `76a914${'11'.repeat(20)}88ac`,
    experimentalMessageBusControllerCategory: 'ab'.repeat(32),
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

  it('GAP: a handler that CONSUMES a result and carries an effect fails with an internal error', () => {
    // Unlike the two boundaries above, this shape produces no named refusal and no diagnostic channel entry:
    // code generation throws its own internal message. Reported, not endorsed.
    expect(() => compileString(`pragma solidcash >=0.8.0;
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
}`, boundaryOptions)).toThrow(/Unbound return call in __scb1/);
  });

  it('BOUNDARY: a handler may not consume a result alongside any second edge', () => {
    // Broader than result fan-in (board task X3): a returning edge may not share a handler with ANY other edge,
    // which is why the Router reaches the Vault through Accrue rather than calling it directly.
    expect(() => compileString(`pragma solidcash >=0.8.0;
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
}`, boundaryOptions)).toThrow(/requires call\/staticcall edges and at most one returning call/);
  });
});
