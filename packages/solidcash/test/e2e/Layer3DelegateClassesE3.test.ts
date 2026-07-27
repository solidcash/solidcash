import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  Artifact, buildInitialStateCommitments, parsePushdataCommitment,
} from '@solidcash/utils';
import {
  Contract, SignatureTemplate, StatefulTransactionBuilder, layer3,
  getDataNftAddress, createDataNftUnlocker,
} from '../../src/index.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { addressToLockScript } from '../../src/utils.js';
import { Utxo } from '../../src/interfaces.js';
import { alicePriv, alicePub, bobPriv } from '../fixture/vars.js';
import { getTxOutputs } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';

/**
 * E3 - explicit delegate-participant classes.
 *
 * "delegate" is not one class. A proxy/implementation pair answers three separate authority questions, and each
 * is answered by a DIFFERENT mechanism depending on how the proxy resolves `impl` and on what the
 * implementation's `delegate` function touches. This file enumerates those classes, settles each admitted one on
 * the BCH-2026 VM, and attacks code identity, state owner and output authority as three SEPARATE fields - they
 * fail on different covenants and at different input indices, which is the point of separating them.
 *
 * SEMANTIC evidence only, on createLayer3SemanticTestProvider (layer3-bch2026-semantic-relaxed-v1: BCH-2026
 * opcode, introspection and 128-byte commitment behaviour, relaxed capacity).
 */

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** Implementation: two functions, so its unlocking script leads with a selector and the proxy can pin it. */
const IMPL_SCALAR = `pragma solidcash >=0.8.0;
contract E3Impl() {
    bigint counter;
    function increment() delegate { this.counter = this.counter + 1; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;

/**
 * A SEPARATELY deployed implementation with the same state layout and the same `increment()` SIGNATURE, so its
 * selector is byte-identical. Only its body and therefore its locking bytecode differ. That makes "which script
 * was co-spent" the single varying field in the code-identity attack below.
 */
const IMPL_FOREIGN = IMPL_SCALAR
  .replace('E3Impl', 'E3ForeignImpl')
  .replace('this.counter = this.counter + 1;', 'this.counter = 999;');

/** Class BYTECODE_PINNED: `impl` is a constructor argument, so the proxy's own p2sh32 commits to it. */
const PROXY_BYTECODE_PINNED = `pragma solidcash >=0.8.0;
contract E3PinnedProxy(address impl) {
    bigint counter;
    function up(bytes input) external {
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/** Class CALLER_AUTHORIZED: `impl` is a parameter, but only an authorized signer may choose it. */
const PROXY_CALLER_AUTHORIZED = `pragma solidcash >=0.8.0;
contract E3AuthorizedProxy(pubkey owner) {
    bigint counter;
    function up(bytes input, address impl, sig s) external {
        require(checkSig(s, owner));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/** UNADMITTED class CALLER_CHOSEN: `impl` is a parameter and nothing authorizes the caller. */
const PROXY_CALLER_CHOSEN = `pragma solidcash >=0.8.0;
contract E3OpenProxy() {
    bigint counter;
    function up(bytes input, address impl) external {
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/** Implementation whose `delegate` function returns: adds a returnEvent funder slot to the proxy block. */
const IMPL_RETURNING = `pragma solidcash >=0.8.0;
contract E3ReturningImpl() {
    bigint counter;
    function bump() delegate returns (bigint) {
        this.counter = this.counter + 1;
        return this.counter;
    }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;

/** UNADMITTED class EMITTING_DELEGATE (board task X12). */
const IMPL_EMITTING = `pragma solidcash >=0.8.0;
contract E3EmittingImpl() {
    bigint counter;
    event Bumped(bigint value);
    function increment() delegate { this.counter = this.counter + 1; emit Bumped(this.counter); }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;

/** UNADMITTED class COLLECTION_WRITING_DELEGATE (board task X11). */
const IMPL_COLLECTION = `pragma solidcash >=0.8.0;
contract E3CollectionImpl() {
    mapping(bigint => bigint) balances;
    function setBalance(bigint key, bigint value) delegate { this.balances[key] = value; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;

/** Single-entry-point implementation: no selector to lead with, so the forwarded-selector pin cannot apply. */
const IMPL_SINGLE_FUNCTION = `pragma solidcash >=0.8.0;
contract E3SoloImpl() {
    bigint counter;
    function increment() delegate { this.counter = this.counter + 1; }
}`;

/** UNADMITTED class CONDITIONAL_DELEGATE_EDGE: the delegatecall sits inside a branch. */
const PROXY_CONDITIONAL = `pragma solidcash >=0.8.0;
contract E3CondProxy(address impl) {
    bigint counter;
    function up(bytes input, bool flag) external {
        if (flag) { impl.delegatecall(input); }
        require(input.length > 0);
    }
}`;

/** UNADMITTED class ITERATED_DELEGATE_EDGE: the source delegates twice. */
const PROXY_ITERATED = `pragma solidcash >=0.8.0;
contract E3LoopProxy(address impl) {
    bigint counter;
    function up(bytes input) external {
        for (int i = 0; i < 2; i = i + 1) { impl.delegatecall(input); }
        require(input.length > 0);
    }
}`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type SemanticProvider = ReturnType<typeof createLayer3SemanticTestProvider>;

interface Deployed {
  contract: Contract;
  categoryId: string;
  master: Utxo;
  dataNfts: Utxo[];
}

async function deploy(
  provider: SemanticProvider, artifact: Artifact, args: unknown[], state: Record<string, unknown>,
): Promise<Deployed> {
  const contract = new Contract(artifact, args as never[], { provider });
  const commitments = buildInitialStateCommitments(artifact.stateLayout!, state);
  const { categoryId, utxos } = await (provider as any).addTokenUtxosDynamic((category: string) => [
    {
      address: contract.tokenAddress, satoshis: 10_000n,
      token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
    },
    ...commitments.map((commitment) => ({
      address: getDataNftAddress(contract, category), satoshis: 10_000n,
      token: { amount: 0n, nft: { capability: 'mutable' as const, commitment } },
    })),
  ]);
  return { contract, categoryId, master: utxos[0], dataNfts: utxos.slice(1) };
}

/** The implementation's co-spent group, unlocked through its own `delegate` function. */
function delegateGroup(
  artifact: Artifact, deployed: Deployed, fn: string, args: unknown[], masterInputIndex: number,
): ExternalCallUtxoGroup {
  return {
    categoryId: deployed.categoryId,
    stateLayout: artifact.stateLayout!,
    masterUtxo: { ...deployed.master, unlocker: (deployed.contract.unlock as any)[fn](...args) },
    dataNftUtxos: deployed.dataNfts.map((nft) => ({
      ...nft, unlocker: createDataNftUnlocker(deployed.contract, masterInputIndex, deployed.categoryId),
    })),
    requiredDataNftIndices: deployed.dataNfts.map((_nft, index) => index),
    functionName: fn,
    functionArgs: args,
    externalContract: null,
  } as unknown as ExternalCallUtxoGroup;
}

const selectorOf = (artifact: Artifact, name: string): Uint8Array =>
  hexToBin(artifact.abi.find((entry) => entry.name === name)!.selector!);

const stateOf = (tx: any, category: string, layout: any): Record<string, bigint> => {
  const output = getTxOutputs(tx).find(
    (candidate: any) => candidate.token?.category === category && candidate.token?.nft?.capability === 'mutable',
  );
  return parsePushdataCommitment(output!.token!.nft!.commitment, layout, 0) as Record<string, bigint>;
};

/** Report the exact outcome, so a hostile case names one covenant and one input rather than "it threw". */
const outcome = async (send: Promise<unknown>): Promise<string> =>
  send.then(() => 'ACCEPTED').catch((error: Error) => error.message);

/** The input index a rejected transaction failed at, so a hostile case pins WHICH covenant refused it. */
const failingInput = (message: string): number | null => {
  const match = /error in evaluating input index (\d+)/.exec(message);
  return match ? Number(match[1]) : null;
};

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

const implArtifact = compileString(IMPL_SCALAR);
const foreignArtifact = compileString(IMPL_FOREIGN);
const pinnedProxyArtifact = compileString(PROXY_BYTECODE_PINNED);
const authorizedProxyArtifact = compileString(PROXY_CALLER_AUTHORIZED);
const openProxyArtifact = compileString(PROXY_CALLER_CHOSEN);
const returningImplArtifact = compileString(IMPL_RETURNING);
const emittingImplArtifact = compileString(IMPL_EMITTING);
const collectionImplArtifact = compileString(IMPL_COLLECTION);
const soloImplArtifact = compileString(IMPL_SINGLE_FUNCTION);
const conditionalProxyArtifact = compileString(PROXY_CONDITIONAL);
const iteratedProxyArtifact = compileString(PROXY_ITERATED);

describe('Layer-3 delegate participant classes (E3, SEMANTIC)', () => {
  // =========================================================================
  // class bytecode-pinned/adjacent-proxy-block/scalar
  // =========================================================================
  describe('class bytecode-pinned/adjacent-proxy-block/scalar', () => {
    /**
     * Inputs: [proxy master, proxy data NFT, implementation master, implementation data NFT].
     * `_proxyMasterIndex` is 0 and the implementation sits at input 2, which is exactly the covenant's
     * `OP_INPUTINDEX - (1 + dataNftCount)` relation seen from the implementation's side.
     */
    async function build(options: {
      coSpentImplementation?: 'pinned' | 'foreign';
      proxyMasterIndexWitness?: bigint;
      settledCounter?: bigint;
    } = {}): Promise<{ send: Promise<any>; proxyCategory: string }> {
      const provider = createLayer3SemanticTestProvider();
      const pinned = await deploy(provider, implArtifact, [], { counter: 0n });
      const foreign = await deploy(provider, foreignArtifact, [], { counter: 0n });
      const proxy = await deploy(
        provider, pinnedProxyArtifact, [addressToLockScript(pinned.contract.address)], { counter: 5n },
      );
      const useForeign = options.coSpentImplementation === 'foreign';
      const co = useForeign ? foreign : pinned;
      const coArtifact = useForeign ? foreignArtifact : implArtifact;
      const send = new StatefulTransactionBuilder({
        provider,
        stateLayout: pinnedProxyArtifact.stateLayout!,
        categoryId: proxy.categoryId,
        masterUtxo: {
          ...proxy.master,
          unlocker: (proxy.contract.unlock as any).up(selectorOf(implArtifact, 'increment'), 2n),
        },
        dataNftUtxos: proxy.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
        })),
        externalCallUtxoGroups: [
          delegateGroup(coArtifact, co, 'increment', [options.proxyMasterIndexWitness ?? 0n], 2),
        ],
      }).setState('counter', options.settledCounter ?? (useForeign ? 999n : 6n)).send();
      return { send, proxyCategory: proxy.categoryId };
    }

    it('settles: the proxy bytecode pins the implementation and the delegate writes the proxy state', async () => {
      const { send, proxyCategory } = await build();
      expect(stateOf(await send, proxyCategory, pinnedProxyArtifact.stateLayout!).counter).toBe(6n);
    }, 120_000);

    /**
     * Attacks CODE IDENTITY, and nothing else. The forwarded calldata is byte-identical (the two
     * implementations share the `increment()` signature, therefore the selector), the witness index is
     * identical, and the block shape is identical. The only difference from the honest control is which
     * implementation script is co-spent at input 2.
     */
    it('rejects a co-spent implementation other than the one the proxy bytecode pins', async () => {
      const message = await outcome((await build({ coSpentImplementation: 'foreign' })).send);
      expect(message).toContain('mandatory-script-verify-flag-failed');
      // The PROXY refuses, at its own input: `OP_UTXOBYTECODE[delegateIndex] == impl`.
      expect(failingInput(message)).toBe(0);
    }, 120_000);

    /**
     * Attacks STATE OWNER, and nothing else: the witness names an input that is not the delegate block's
     * adjacent master. The implementation, calldata and settled state are the honest ones.
     *
     * The implementation's covenant enforces this as a CONJUNCTION - minting capability, self-preservation,
     * not-the-delegate-itself, and `_proxyMasterIndex == OP_INPUTINDEX - (1 + dataNftCount)`. With four inputs
     * a witness cannot isolate the last conjunct, so all three wrong values are driven and each is refused by
     * the implementation, not by the proxy.
     */
    it.each([1n, 2n, 3n])(
      'rejects proxy-master witness %s, which is not the delegate block\'s adjacent master',
      async (witness) => {
        const message = await outcome((await build({ proxyMasterIndexWitness: witness })).send);
        expect(message).toContain('mandatory-script-verify-flag-failed');
        expect(failingInput(message)).toBe(2);
      }, 120_000,
    );

    /**
     * Attacks OUTPUT AUTHORITY, and nothing else: a proxy post-state the delegate covenant did not compute.
     */
    it('rejects a forged proxy post-state the delegate covenant did not compute', async () => {
      const message = await outcome((await build({ settledCounter: 99n })).send);
      expect(message).toContain('mandatory-script-verify-flag-failed');
      expect(failingInput(message)).toBe(2);
    }, 120_000);

    it('is the class the SDK gate names for this pair', () => {
      const provider = createLayer3SemanticTestProvider();
      const implementation = new Contract(implArtifact, [], { provider });
      const implementationLbc = binToHex(addressToLockScript(implementation.address));
      const proxy = new Contract(pinnedProxyArtifact, [hexToBin(implementationLbc)] as never[], { provider });
      expect(layer3.classifyDelegateParticipant({
        proxy: { artifact: pinnedProxyArtifact, functionName: 'up', bytecode: proxy.bytecode },
        implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
      })).toEqual({
        id: 'bytecode-pinned/adjacent-proxy-block/scalar',
        codeIdentity: 'bytecode-pinned',
        stateOwner: 'adjacent-proxy-block',
        outputAuthority: 'delegate-covenant-scalar',
      });
    });
  });

  // =========================================================================
  // class caller-authorized/adjacent-proxy-block/scalar
  // =========================================================================
  describe('class caller-authorized/adjacent-proxy-block/scalar', () => {
    async function build(options: {
      coSpentImplementation?: 'expected' | 'foreign';
      signer?: 'owner' | 'stranger';
    } = {}): Promise<{ send: Promise<any>; proxyCategory: string }> {
      const provider = createLayer3SemanticTestProvider();
      const expected = await deploy(provider, implArtifact, [], { counter: 0n });
      const foreign = await deploy(provider, foreignArtifact, [], { counter: 0n });
      const proxy = await deploy(provider, authorizedProxyArtifact, [alicePub], { counter: 5n });
      const useForeign = options.coSpentImplementation === 'foreign';
      const co = useForeign ? foreign : expected;
      const coArtifact = useForeign ? foreignArtifact : implArtifact;
      const signature = options.signer === 'stranger'
        ? new SignatureTemplate(bobPriv)
        : new SignatureTemplate(alicePriv);
      const send = new StatefulTransactionBuilder({
        provider,
        stateLayout: authorizedProxyArtifact.stateLayout!,
        categoryId: proxy.categoryId,
        masterUtxo: {
          ...proxy.master,
          unlocker: (proxy.contract.unlock as any).up(
            selectorOf(implArtifact, 'increment'),
            addressToLockScript(co.contract.address),
            signature,
            2n,
          ),
        },
        dataNftUtxos: proxy.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
        })),
        externalCallUtxoGroups: [delegateGroup(coArtifact, co, 'increment', [0n], 2)],
      }).setState('counter', useForeign ? 999n : 6n).send();
      return { send, proxyCategory: proxy.categoryId };
    }

    /**
     * This class's code identity is genuinely weaker than the pinned one: the OWNER may point the proxy at any
     * implementation, including the "foreign" one, and that settles. That is the class's stated authority, not
     * a defect - which is exactly why it is enumerated separately rather than folded into `bytecode-pinned`.
     */
    it('settles: an authorized signer selects the implementation and the delegate writes the proxy state',
      async () => {
        const { send, proxyCategory } = await build();
        expect(stateOf(await send, proxyCategory, authorizedProxyArtifact.stateLayout!).counter).toBe(6n);
      }, 120_000);

    it('settles the owner selecting a different implementation, which is this class\'s stated authority',
      async () => {
        const { send, proxyCategory } = await build({ coSpentImplementation: 'foreign' });
        expect(stateOf(await send, proxyCategory, authorizedProxyArtifact.stateLayout!).counter).toBe(999n);
      }, 120_000);

    /**
     * Attacks CODE IDENTITY for this class: the authority is the SIGNATURE, so a stranger selecting the very
     * same honest implementation must still be refused. Honest control differs only in the signing key.
     */
    it('rejects an unauthorized signer selecting the same honest implementation', async () => {
      const message = await outcome((await build({ signer: 'stranger' })).send);
      expect(message).toContain('mandatory-script-verify-flag-failed');
      expect(failingInput(message)).toBe(0);
    }, 120_000);

    it('is the class the SDK gate names for this pair', () => {
      const provider = createLayer3SemanticTestProvider();
      const implementation = new Contract(implArtifact, [], { provider });
      const proxy = new Contract(authorizedProxyArtifact, [alicePub] as never[], { provider });
      expect(layer3.classifyDelegateParticipant({
        proxy: { artifact: authorizedProxyArtifact, functionName: 'up', bytecode: proxy.bytecode },
        implementation: {
          artifact: implArtifact,
          functionName: 'increment',
          lockingBytecode: binToHex(addressToLockScript(implementation.address)),
        },
      }).id).toBe('caller-authorized/adjacent-proxy-block/scalar');
    });
  });

  // =========================================================================
  // UNADMITTED class caller-chosen
  // =========================================================================
  describe("unadmitted class 'caller-chosen'", () => {
    /**
     * MEASURED, not reasoned. A proxy that takes the implementation address as a plain parameter with no
     * signature is a complete state takeover: an unrelated spender co-spends an implementation THEY wrote and
     * it settles. The covenant is doing exactly what it promises - it pins the co-spent script to the address
     * the caller supplied - but that address is caller-supplied, so the pin proves nothing about identity.
     *
     * The compiler emits no diagnostic for this shape: its C1 warning fires only when `impl` is a P2PKH
     * literal, and `pinsDelegateCoSpend` is true here, which suppresses it. So the class is silently
     * compiled today. The SDK gate below refuses it; the compiler-side diagnostic is reported as open.
     */
    it('SETTLES a foreign implementation rewriting the proxy state, so the class must fail closed', async () => {
      const provider = createLayer3SemanticTestProvider();
      const foreign = await deploy(provider, foreignArtifact, [], { counter: 0n });
      const proxy = await deploy(provider, openProxyArtifact, [], { counter: 5n });
      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: openProxyArtifact.stateLayout!,
        categoryId: proxy.categoryId,
        masterUtxo: {
          ...proxy.master,
          unlocker: (proxy.contract.unlock as any).up(
            selectorOf(foreignArtifact, 'increment'),
            addressToLockScript(foreign.contract.address),
            2n,
          ),
        },
        dataNftUtxos: proxy.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
        })),
        externalCallUtxoGroups: [delegateGroup(foreignArtifact, foreign, 'increment', [0n], 2)],
      }).setState('counter', 999n).send();
      // 5 -> 999: a value the proxy's own pinned code could never produce.
      expect(stateOf(tx, proxy.categoryId, openProxyArtifact.stateLayout!).counter).toBe(999n);
    }, 120_000);

    it('is refused by the SDK class gate with a named diagnostic', () => {
      const provider = createLayer3SemanticTestProvider();
      const implementation = new Contract(implArtifact, [], { provider });
      const proxy = new Contract(openProxyArtifact, [] as never[], { provider });
      expect(() => layer3.classifyDelegateParticipant({
        proxy: { artifact: openProxyArtifact, functionName: 'up', bytecode: proxy.bytecode },
        implementation: {
          artifact: implArtifact,
          functionName: 'increment',
          lockingBytecode: binToHex(addressToLockScript(implementation.address)),
        },
      })).toThrow(/class 'caller-chosen' is not admitted/);
    });
  });

  // =========================================================================
  // Occurrence: the classes this gate cannot see
  // =========================================================================
  describe('occurrence classes the published metadata cannot distinguish', () => {
    /**
     * A conditional, an iterated and a singular delegate edge compile to BYTE-IDENTICAL published metadata, so
     * no SDK gate can separate them. That is the reason the two cases below are measurements rather than
     * rejections.
     */
    it('publishes identical metadata for singular, conditional and iterated delegate edges', () => {
      const published = (artifact: Artifact): string => {
        const fn = artifact.abi.find((entry) => entry.name === 'up')!;
        return JSON.stringify({
          lowLevelCalls: fn.lowLevelCalls,
          externalCalls: fn.externalCalls,
          slots: (fn.blockLayout?.slots ?? []).map((slot) => slot.kind),
        });
      };
      expect(published(conditionalProxyArtifact)).toBe(published(pinnedProxyArtifact));
      expect(published(iteratedProxyArtifact)).toBe(published(pinnedProxyArtifact));
      expect(layer3.UNDETECTED_BY_THIS_GATE)
        .toEqual(['conditional-delegate-edge', 'iterated-delegate-edge']);
    });

    async function spendProxy(
      artifact: Artifact, extraArguments: unknown[], settledCounter: bigint,
      options: { coSpendImplementation: boolean },
    ): Promise<{ result: string; proxyCategory: string; layout: any }> {
      const provider = createLayer3SemanticTestProvider();
      const implementation = await deploy(provider, implArtifact, [], { counter: 0n });
      const proxy = await deploy(
        provider, artifact, [addressToLockScript(implementation.contract.address)], { counter: 5n },
      );
      const send = new StatefulTransactionBuilder({
        provider,
        stateLayout: artifact.stateLayout!,
        categoryId: proxy.categoryId,
        masterUtxo: {
          ...proxy.master,
          unlocker: (proxy.contract.unlock as any).up(
            selectorOf(implArtifact, 'increment'), ...extraArguments, 2n,
          ),
        },
        dataNftUtxos: proxy.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
        })),
        ...(options.coSpendImplementation
          ? { externalCallUtxoGroups: [delegateGroup(implArtifact, implementation, 'increment', [0n], 2)] }
          : {}),
      }).setState('counter', settledCounter).send();
      const result = await send
        .then((tx: any) => `ACCEPTED counter=${
          stateOf(tx, proxy.categoryId, artifact.stateLayout!).counter}`)
        .catch((error: Error) => error.message);
      return { result, proxyCategory: proxy.categoryId, layout: artifact.stateLayout! };
    }

    /**
     * OPEN ESCAPE, measured not reasoned. `if (flag) { impl.delegatecall(input); }` skips the proxy's own state
     * covenant for the WHOLE function (the codegen gate is `!functionHasDelegatecall`, which is a per-function
     * property) but forces the delegate co-spend only on the taken branch. Spending with `flag = false` and no
     * implementation therefore reproduces SECURITY-AUDIT finding C1 exactly: the proxy data NFT's flag=1 path
     * self-authorizes on minting-NFT presence, so any spender writes an arbitrary commitment.
     *
     * The honest control is the same transaction with `flag = true`, which the proxy refuses at its own input.
     * A fix belongs in the compiler - either force the co-spend unconditionally or reject a branched
     * delegatecall - and this assertion is written to FAIL once that lands, so the class cannot stay open
     * silently.
     */
    it('OPEN: a conditional delegate edge lets an untaken branch forge the proxy state', async () => {
      const forged = await spendProxy(conditionalProxyArtifact, [false], 999n, {
        coSpendImplementation: false,
      });
      expect(forged.result).toBe('ACCEPTED counter=999');

      // Control: the only difference is the branch condition. The proxy refuses at input 0.
      const control = await spendProxy(conditionalProxyArtifact, [true], 999n, {
        coSpendImplementation: false,
      });
      expect(control.result).toContain('mandatory-script-verify-flag-failed');
      expect(failingInput(control.result)).toBe(0);
    }, 240_000);

    /**
     * OPEN, measured not reasoned. The source delegates TWICE, so the only correct settlement is 5 -> 7. What
     * actually settles is 5 -> 6 with a single co-spent implementation: the loop published one edge and one
     * block slot, so the compiled covenant is satisfied by delegating once. Compiles clean, no diagnostic.
     */
    it('OPEN: an iterated delegate edge collapses two source delegations into one', async () => {
      const single = await spendProxy(iteratedProxyArtifact, [], 6n, { coSpendImplementation: true });
      expect(single.result).toBe('ACCEPTED counter=6');

      const asWritten = await spendProxy(iteratedProxyArtifact, [], 7n, { coSpendImplementation: true });
      expect(asWritten.result).toContain('mandatory-script-verify-flag-failed');
    }, 240_000);
  });

  // =========================================================================
  // Remaining named classes: refused by the gate with their own diagnostic
  // =========================================================================
  describe('every other named class fails closed with its own diagnostic', () => {
    const provider = createLayer3SemanticTestProvider();

    /**
     * Every case here uses a proxy pinned to the implementation under test, so the only thing that can be
     * refused is the property the case is about - never an incidental code-identity mismatch.
     */
    const gate = (implementation: {
      artifact: Artifact; functionName: string; lockingBytecode?: string;
    }): (() => unknown) => (): unknown => {
      const lockingBytecode = implementation.lockingBytecode
        ?? binToHex(addressToLockScript(new Contract(implementation.artifact, [], { provider }).address));
      const proxy = new Contract(pinnedProxyArtifact, [hexToBin(lockingBytecode)] as never[], { provider });
      return layer3.classifyDelegateParticipant({
        proxy: { artifact: pinnedProxyArtifact, functionName: 'up', bytecode: proxy.bytecode },
        implementation: {
          artifact: implementation.artifact, functionName: implementation.functionName, lockingBytecode,
        },
      });
    };

    it("refuses 'unpinned-p2pkh'", () => {
      expect(gate({
        artifact: implArtifact,
        functionName: 'increment',
        lockingBytecode: `76a914${'ab'.repeat(20)}88ac`,
      })).toThrow(/class 'unpinned-p2pkh' is not admitted/);
    });

    it("refuses 'emitting-delegate' and names board task X12", () => {
      expect(gate({ artifact: emittingImplArtifact, functionName: 'increment' }))
        .toThrow(/class 'emitting-delegate' is not admitted.*X12/s);
    });

    it("refuses 'collection-writing-delegate' and names board task X11", () => {
      expect(gate({ artifact: collectionImplArtifact, functionName: 'setBalance' }))
        .toThrow(/class 'collection-writing-delegate' is not admitted.*X11/s);
    });

    it('refuses a single-entry-point implementation, which has no selector to pin', () => {
      expect(gate({ artifact: soloImplArtifact, functionName: 'increment' }))
        .toThrow(/is not selector-dispatched \(1 entry point\(s\)\)/);
    });

    it('refuses an implementation function that is not declared delegate', () => {
      expect(gate({ artifact: implArtifact, functionName: 'authorize' }))
        .toThrow(/is not declared 'delegate'/);
    });

    /**
     * The returning implementation is a REAL, separate class (its block carries a returnEvent funder slot), and
     * it is deliberately not on the admitted list here: X1 settled it for a split-bundle facet, but this task
     * did not settle it for a two-contract pair. The gate must therefore name it, not silently accept it.
     */
    it('refuses the return-channel class it has not settled, naming the exact class id', () => {
      expect(gate({ artifact: returningImplArtifact, functionName: 'bump' }))
        .toThrow(/class 'bytecode-pinned\/adjacent-proxy-block\/scalar-return' is not admitted/);
    });
  });

  // =========================================================================
  // The enumeration itself
  // =========================================================================
  describe('the enumeration is explicit', () => {
    it('publishes every admitted class with all three authority answers', () => {
      expect(layer3.ADMITTED_DELEGATE_PARTICIPANT_CLASSES.map((entry) => entry.id)).toEqual([
        'bytecode-pinned/adjacent-proxy-block/scalar',
        'caller-authorized/adjacent-proxy-block/scalar',
      ]);
      for (const entry of layer3.ADMITTED_DELEGATE_PARTICIPANT_CLASSES) {
        expect(entry.codeIdentity).toBeTypeOf('string');
        expect(entry.stateOwner).toBeTypeOf('string');
        expect(entry.outputAuthority).toBeTypeOf('string');
      }
    });

    it('publishes every named unadmitted class with a reason', () => {
      expect(layer3.UNADMITTED_DELEGATE_PARTICIPANT_CLASSES.map((entry) => entry.id)).toEqual([
        'caller-chosen',
        'unpinned-p2pkh',
        'dynamically-resolved-implementation',
        'emitting-delegate',
        'collection-writing-delegate',
        'multi-edge-proxy',
        'conditional-delegate-edge',
        'iterated-delegate-edge',
      ]);
      for (const entry of layer3.UNADMITTED_DELEGATE_PARTICIPANT_CLASSES) {
        expect(entry.reason.length).toBeGreaterThan(20);
      }
    });

    /**
     * The nested class needs no SDK gate: the compiler already refuses it with a stable, named error, so it can
     * never reach a planner. Pinned here so the enumeration stays complete when someone reads only this file.
     */
    it('leaves the nested-delegate class to the compiler, which already refuses it by name', () => {
      expect(() => compileString(`pragma solidcash >=0.8.0;
contract E3Nested() {
    bigint counter;
    function increment() delegate {
        address inner = address(0xaa20${'ab'.repeat(32)}87);
        inner.delegatecall(hex"00");
    }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`)).toThrow(/'delegate' functions cannot contain delegatecall calls/);
    });
  });
});
