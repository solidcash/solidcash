import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { scriptToBytecode, asmToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X198 - THE SUBMIT-PHASE ABSORPTION WINDOW: a covenant objection PRODUCED and never READ.
 *
 * X186 closed the send-path window by teaching `covenantObjectionOf` to ask `vm.stateSuccess` instead of
 * `state.error`, because libauth sets `error` only when an operation RAISES and a script that runs to
 * completion leaving a FALSY item on top raises nothing. Sixty lines further down the SAME FILE,
 * `evaluateEveryInput` still reads `state.error`, and unlike the annotator it THROWS - it is the covenant
 * decider on both Layer-3 entry points, `preflightLayer3Transaction` and `sendPreflightedLayer3Transaction`.
 *
 * SO THE FAIL-CLOSED BOUNDARY WAS OPEN FOR A WHOLE FAILURE CLASS. For any input whose script completes with a
 * falsy top item, the VM produced a full objection - naming the input index and the top stack item - and the
 * decider consulted a field that is `undefined` for it, admitted, and handed the bytes to the byte rules and
 * then to the network. Rows 1 and 2 measure that on the VM; row 3 measures it end to end on a real
 * two-participant Layer-3 composition. `evaluateEveryInput` now asks `stateSuccess`, and row 3 is what fails
 * if that is ever put back.
 *
 * MEASURED BEFORE THE REPAIR: with `state.error` in place, row 3b's composition was ADMITTED by
 * `preflightLayer3Transaction` and row 3c's bytes were handed to the provider, while `covenantObjectionOf` on
 * those identical bytes returned `input 7: Unsuccessful evaluation: ...`. Both rows are red against the old
 * body and green against the new one, so the repair is necessary and not merely sufficient.
 *
 * WHY THE CLASS IS REACHABLE AND NOT A CURIOSITY. `GenerateTargetTraversal` deletes the final `require`'s
 * OP_VERIFY when the stack is shallow enough ("If the final op is OP_VERIFY and the stack size is less than 4
 * we remove it from the script"), so a plain SolidCash contract's LAST check leaves its boolean on the stack
 * rather than verifying it. Row 0 measures that on compiled artifacts: a plain `require(v == brand)` ends in
 * OP_NUMEQUAL. Every such contract's final-check failure is in this class.
 *
 * THE CONTROL IS A ONE-FIELD PAIR. Rows 3a and 3b build the same composition and differ ONLY in the integer
 * argument handed to the fee-slot covenant - matching brand, or not. Nothing else moves: same inputs, same
 * outputs, same counts, same scripts. And the match is on what THIS FILE's readers write (`covenantObjectionOf`
 * returning a string vs `preflightLayer3Transaction` throwing), never on a decider's vocabulary.
 *
 * NOT A SECURITY BOUNDARY. The SDK is an untrusted witness constructor; a node re-evaluates everything and
 * refuses these bytes on its own. What is lost is the diagnostic and the fail-closed promise the entry point's
 * own docstring makes ("the first establishes that the exact final transaction satisfies every covenant").
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
contract X198ReturningB(int brand) {
  function twice(int n) public pure returns (int, int) {
    require(n >= 0);
    return (n * 2, n + 10);
  }
}`;
const RETURNING_A = `pragma solidcash >=0.8.0;
interface IX198ReturningB { function twice(int n) returns (int, int); }
contract X198ReturningA(int brand, address target) {
  function plusOne(int n) public pure returns (int) {
    int child, int witness = IX198ReturningB(target).twice(n);
    require(child >= 0 && witness == n + 10);
    return child + 1;
  }
}`;

/**
 * The fee-slot covenant, and the ONLY thing rows 3a/3b vary is the argument it is handed.
 *
 * Its final statement is a `require` of an equality, so `GenerateTargetTraversal` elides the OP_VERIFY and the
 * script ends in OP_NUMEQUAL - row 0 asserts exactly that off the compiled artifact rather than assuming it.
 * A mismatching argument therefore COMPLETES with a falsy top item instead of raising, which is the class
 * under test. It sits in the fee slot, the last input, outside every participant block and outside the
 * auxiliary region, so swapping it in changes no count and no other covenant's view of the transaction.
 */
const FEE_GUARD = `pragma solidcash >=0.8.0;
contract X198FeeGuard(int brand) {
  function release(int v) public pure { require(v == brand); }
}`;

const FEE_GUARD_BRAND = 77n;

/* ------------------------------------------------------------------------------------------------------ */
/* Row 0 + rows 1-2: the class exists, and the two fields disagree about it                                 */
/* ------------------------------------------------------------------------------------------------------ */

describe('X198 row 0: the falsy-completion class is what the compiler emits', () => {
  it('a plain contract whose last statement is `require(a == b)` ends in OP_NUMEQUAL, not OP_VERIFY', () => {
    const artifact = compileString(FEE_GUARD);
    // `artifact.bytecode` is an ASM LISTING; `.length / 2` would be meaningless here.
    const bytecode = asmToBytecode(artifact.bytecode);
    const finalOpcode = bytecode[bytecode.length - 1];
    expect(artifact.bytecode.split(' ').at(-1)).toBe('OP_NUMEQUAL');
    expect(finalOpcode).toBe(0x9c);
    // Neither OP_VERIFY (0x69) nor a constant OP_1 (0x51): the script's verdict is LEFT ON THE STACK.
    expect(finalOpcode).not.toBe(0x69);
    expect(finalOpcode).not.toBe(0x51);
  });
});

describe('X198 rows 1-2: `state.error` and `stateSuccess` disagree on the same VM state', () => {
  /**
   * Both readings come from ONE evaluation of ONE state, through the SAME provider-derived factory
   * `evaluateEveryInput` and `covenantObjectionOf` both call. Nothing here is a re-implementation: the fields
   * are read off the object the production code reads them off.
   */
  const measure = (locking: Uint8Array): { error: string | undefined; success: string | true } => {
    const provider = createLayer3SemanticTestProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider as never);
    const transaction = {
      version: 2,
      inputs: [{
        outpointIndex: 0,
        outpointTransactionHash: hexToBin('11'.repeat(32)),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array(),
      }],
      outputs: [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000n }],
      locktime: 0,
    };
    const sourceOutputs = [{ lockingBytecode: locking, valueSatoshis: 2_000n }];
    const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction } as never) as { error?: string };
    return { error: state.error, success: vm.stateSuccess(state as never) as string | true };
  };

  it('1. RAISED: an OP_VERIFY failure sets `error`, so both readers see it', () => {
    const raised = measure(Uint8Array.of(0x00, 0x69));
    expect(raised.error).toBe('Program failed an OP_VERIFY operation.');
    expect(raised.success).toBe(raised.error);
  });

  it('2. THE WINDOW: a falsy completion leaves `error` UNDEFINED while `stateSuccess` objects in full', () => {
    const falsy = measure(Uint8Array.of(0x00));
    // The field `evaluateEveryInput` consults. It has nothing to say about a broken script.
    expect(falsy.error).toBeUndefined();
    // The authority. A complete objection, including the offending top stack item.
    expect(falsy.success).toBe(
      'Unsuccessful evaluation: completed with a non-truthy value on top of the stack. Top stack item: "".',
    );
    // Stated as the verdict each production reader would reach on this exact state.
    expect(falsy.error !== undefined).toBe(false); // evaluateEveryInput: ADMITS
    expect(falsy.success !== true).toBe(true); // covenantObjectionOf: REFUSES
  });

  it('2b. THE SECOND BRANCH IS NOT DEMONSTRATED, and this row is what says so', () => {
    // libauth's `success` has TWO non-error branches - `top === undefined` and `!truthy(top)` - and only the
    // second is demonstrated above. The obvious way to reach the first, a locking script that consumes its
    // own stack, does NOT get there: BCH's clean-stack rule RAISES first, so `error` is set and both readers
    // see it. Recorded as a measurement rather than left as an implied second class, because "an empty stack
    // is also invisible" would be an overclaim this file cannot support.
    const empty = measure(Uint8Array.of(0x61));
    expect(empty.error).toBe(
      'Non-P2SH locking bytecode completed evaluation with an unexpected number of items on the stack '
      + '(must be exactly 1). Remaining stack depth: 0.',
    );
    expect(empty.success).toBe(empty.error);
  });

  it('2c. NEGATIVE CONTROL: a genuinely satisfied script is admitted by both', () => {
    const ok = measure(Uint8Array.of(0x51));
    expect(ok.error).toBeUndefined();
    expect(ok.success).toBe(true);
  });

  it('2d. WHY `stateSuccess` IS THE AUTHORITY AND `error` IS NOT, read off libauth itself', () => {
    // Not asserted from the docstring: the BCH instruction set's own `success` returns `state.error`
    // VERBATIM when there is one and only then checks the stack, and `createVirtualMachine` passes that same
    // function to `vm.verify`. So `stateSuccess` is the VM's own verification predicate, `state.error` is a
    // strict subset of it, and moving the decider onto it cannot lose a message it used to report.
    const libauth = (relative: string): string => {
      // Hoisted to the workspace root in this tree; resolved by walking up so a package-local install works too.
      for (const prefix of ['../../node_modules', '../../../../node_modules']) {
        const candidate = fileURLToPath(new URL(`${prefix}/@bitauth/libauth/build/lib/vm/${relative}`,
          import.meta.url));
        try { return readFileSync(candidate, 'utf8'); } catch { /* try the next root */ }
      }
      throw new Error(`could not locate @bitauth/libauth build file ${relative}`);
    };
    const instructionSet = libauth('instruction-sets/bch/2023/bch-2023-instruction-set.js');
    const predicate = instructionSet.slice(instructionSet.indexOf('success: (state) => {'));
    expect(predicate.slice(0, 400)).toMatch(/if \(state\.error !== undefined\) \{\s*return state\.error;/);
    expect(predicate.slice(0, 400)).toMatch(/top === undefined \|\| !stackItemIsTruthy\(top\)/);
    const machine = libauth('virtual-machine.js');
    expect(machine).toMatch(/instructionSet\.verify\(resolvedTransaction, \{\s*evaluate,\s*initialize,\s*success,/);
    expect(machine).toMatch(/stateSuccess: success,/);
  });
});

/* ------------------------------------------------------------------------------------------------------ */
/* Row 3: end to end on a real two-participant Layer-3 composition                                          */
/* ------------------------------------------------------------------------------------------------------ */

interface Built {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
}

/**
 * The honest composition, with the fee slot spent through `X198FeeGuard` instead of the usual P2PKH.
 *
 * `feeGuardArgument` is the ONLY thing that varies between the admitted and the hostile run. Everything else -
 * input count, output count, every script, every value - is byte-identical, so a difference in verdict can
 * only be that argument.
 */
async function build(feeGuardArgument: bigint): Promise<Built> {
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
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: genesis.categoryId as string,
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
  const feeGuard = new Contract(compileString(FEE_GUARD), [FEE_GUARD_BRAND], { provider });
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
  for (const utxo of [slotFunderA, slotFunderB]) await provider.addUtxo(p2pkh.address, utxo);
  for (const utxo of [projectionA, projectionB]) await provider.addUtxo(projection.address, utxo);
  // The fee slot is a CONTRACT spend, so its script is the one that decides this input.
  await provider.addUtxo(feeGuard.address, feeFunder);

  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupA.masterUtxo, routeA(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
    BigInt(layout.returnOutputs[0]!),
  ));
  tx.addInput(slotFunderA, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupB.masterUtxo, routeB(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    BigInt(layout.returnOutputs[1]!),
  ));
  tx.addInput(slotFunderB, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(projectionA, projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), 0n,
  ));
  tx.addInput(projectionB, projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), 1n,
  ));
  tx.addInput(rooted, controller.unlock.attest(transcript.bytes));
  tx.addInput(feeFunder, feeGuard.unlock.release(feeGuardArgument));

  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupA.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(aggregate(5n)) },
    },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(aggregate(4n, 12n)) },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });

  return { provider, builder: tx, transaction: raw(tx) };
}

describe('X198 row 3: the submit-path decider admits a covenant that objects', () => {
  it('3a. CONTROL: the matching argument settles through the Layer-3 send path', async () => {
    const built = await build(FEE_GUARD_BRAND);
    expect(layer3.covenantObjectionOf(built.builder, built.builder.buildLibauthTransaction()))
      .toBeUndefined();
    expect(() => layer3.preflightLayer3Transaction(built.builder)).not.toThrow();
    await expect(layer3.sendPreflightedLayer3Transaction(built.builder))
      .resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);

  it('3b. THE WINDOW, CLOSED: one wrong integer, and both readers in preflight.ts agree', async () => {
    const built = await build(FEE_GUARD_BRAND + 1n);
    const transaction = built.builder.buildLibauthTransaction();

    // THE OBJECTION IS PRODUCED, with its input index and the offending top stack item. Input 7 is the fee
    // slot - the last input - so nothing ahead of it can be the cause.
    const objection = layer3.covenantObjectionOf(built.builder, transaction);
    expect(objection).toBeDefined();
    expect(objection).toMatch(/^input 7: Unsuccessful evaluation: completed with a non-truthy value on top/);
    expect(built.builder.inputs).toHaveLength(8);

    // AND NOW IT IS READ. Same builder, same bytes, same VM factory - and the decider that THROWS refuses,
    // naming the class AND the input index. Both halves are asserted: a refusal without the index would have
    // lost the only field that says WHICH covenant objected.
    const failure = (() => {
      try { layer3.preflightLayer3Transaction(built.builder); return undefined; } catch (error) {
        return error as Error;
      }
    })();
    expect(failure, 'preflightLayer3Transaction admitted a covenant that objects').toBeInstanceOf(Error);
    expect(failure!.message).toMatch(
      /^layer3: BCH-2026 preflight failed at input 7: Unsuccessful evaluation: completed with a non-truthy /,
    );
    expect(failure!.message).toContain('Top stack item: ""');

    // NOT A BYTE-RULE REFUSAL. These bytes are otherwise fine, so nothing but the covenant can be objecting.
    expect(failure!.message).not.toMatch(/refused by \d+ byte rule/);
    expect(layer3.assessFinalizedTransactionBytes(transaction).admitted).toBe(true);

    // AND THE REFUSAL AGREES WITH THE NETWORK RATHER THAN OVER-REFUSING: the provider rejects these same
    // bytes on its own, so the gate only moved the verdict earlier.
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow('mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 7: Unsuccessful evaluation: completed with a non-truthy value on top of the stack. Top stack item: "".)');
  }, 300_000);

  it('3c. THE SAME REFUSAL ON THE BROADCASTING ENTRY POINT, before the network is asked', async () => {
    // `sendPreflightedLayer3Transaction` runs the identical `evaluateEveryInput` and then broadcasts. The
    // decisive assertion is not that it threw - it is that the provider was NEVER ASKED, which is the
    // difference between a gate and a relayed complaint.
    const built = await build(FEE_GUARD_BRAND + 1n);
    let reachedProvider = false;
    const original = built.provider.sendRawTransaction.bind(built.provider);
    (built.provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      reachedProvider = true;
      return original(hex);
    };
    const failure = await layer3.sendPreflightedLayer3Transaction(built.builder)
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(
      /^layer3: BCH-2026 preflight failed at input 7: Unsuccessful evaluation: completed with a non-truthy /,
    );
    expect(reachedProvider, 'the broken covenant was handed to the network anyway').toBe(false);
  }, 300_000);
});

/* ------------------------------------------------------------------------------------------------------ */
/* Row 4: the structural claim X186 left behind                                                             */
/* ------------------------------------------------------------------------------------------------------ */

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../../src/${relative}`, import.meta.url)), 'utf8');

describe('X198 row 4: the two readers in preflight.ts, side by side', () => {
  it('4a. both VM readers ask the authority, and the decider still names the input index', () => {
    const source = read('layer3/preflight.ts');
    // The annotator, fixed by X186.
    expect(source).toMatch(/vm\.stateSuccess\(vm\.evaluate\(\{ inputIndex, sourceOutputs, transaction \}\)\)/);
    // The decider, fixed by X198. Two readers, one field, and it is the authority in both.
    const decider = source.slice(source.indexOf('const evaluateEveryInput'));
    expect(decider).toMatch(/vm\.stateSuccess\(vm\.evaluate\(\{ inputIndex, sourceOutputs, transaction \}\)\)/);
    expect(decider).not.toMatch(/state\.error/);
    expect(decider).toMatch(/throw mapLayer3VmFailure\(builder, transaction, inputIndex, String\(objection\)\)/);
    expect(source).toMatch(/return new Error\(`layer3: BCH-2026 preflight failed at input \$\{inputIndex\}/);
  });

  it('4b. the census population is exactly two call sites, both inside preflight.ts', () => {
    // The caller attribution behind the X198 throw census, pinned structurally instead of read off a stack:
    // `evaluateEveryInput` is module-private, so its callers are enumerable and are the two Layer-3 entry
    // points. A third call site added later fails here rather than silently widening the census population.
    const source = read('layer3/preflight.ts');
    const callSites = source.split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter((row) => row.line.includes('evaluateEveryInput(builder, transaction)'));
    expect(callSites).toHaveLength(2);
    const bodies = ['preflightLayer3Transaction', 'sendPreflightedLayer3Transaction']
      .map((entry) => source.indexOf(`export const ${entry}`) >= 0
        ? source.indexOf(`export const ${entry}`)
        : source.indexOf(`export async function ${entry}`));
    expect(bodies.every((offset) => offset > 0)).toBe(true);
    // Every call site follows one of the two entry points' declarations.
    for (const site of callSites) {
      const offset = source.split('\n').slice(0, site.number).join('\n').length;
      expect(bodies.some((start) => offset > start)).toBe(true);
    }
  });
});
