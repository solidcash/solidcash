import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  Artifact, buildInitialStateCommitments, buildPushdataCommitment, parsePushdataCommitment,
} from '@solidcash/utils';
import {
  Contract, SignatureTemplate, StatefulTransactionBuilder, TransactionBuilder, layer3,
  getDataNftAddress, createDataNftUnlocker,
} from '../../src/index.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { DEFAULT_PROXY_SOURCE, defaultProxyArtifact } from '../../src/stateful/defaultProxyArtifact.js';
import { addressToLockScript } from '../../src/utils.js';
import { Utxo } from '../../src/interfaces.js';
import { alicePkh, alicePriv, alicePub, bobPriv } from '../fixture/vars.js';
import { createFeeFunder, getTxOutputs } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
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

/**
 * ROUND-14 A13-1. The proxy pins one implementation in its CONSTRUCTOR and delegatecalls a caller-supplied
 * `address` parameter. Bytecode containment is true and means nothing.
 */
const PROXY_PINNED_BUT_CALLER_SELECTED = `pragma solidcash >=0.8.0;
contract E3TrapProxy(address pinned) {
    bigint counter;
    function up(bytes input, address impl) external {
        require(pinned.length == 35);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/** ROUND-14 A13-2. A `sig` parameter checked against a key the SAME caller supplies. No stored authority. */
const PROXY_SELF_AUTHORIZED = `pragma solidcash >=0.8.0;
contract E3SelfAuthProxy() {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s) external {
        require(checkSig(s, pk));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/** ROUND-14. A `sig` parameter and a stored key, but the key is a STATE variable rather than a ctor argument. */
const PROXY_STATE_KEY_AUTHORIZED = `pragma solidcash >=0.8.0;
contract E3StateKeyProxy(pubkey initial) {
    bigint counter;
    pubkey owner;
    function up(bytes input, address impl, sig s) external {
        require(checkSig(s, this.owner));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/**
 * ROUND-14 COST. Honest bytecode-pinned proxy - the delegatecall targets the constructor argument - that also
 * takes an UNRELATED `address` parameter. The gate refuses it, because published metadata does not say which
 * expression the target is. The VM case below measures that this shape really does settle.
 */
const PROXY_PINNED_WITH_UNRELATED_ADDRESS = `pragma solidcash >=0.8.0;
contract E3PayoutProxy(address impl) {
    bigint counter;
    function up(bytes input, address recipient) external {
        require(recipient.length == 35);
        impl.delegatecall(input);
        require(input.length > 0);
    }
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

/**
 * UNADMITTED class ITERATED_DELEGATE_EDGE: the source delegates twice. The compiler now REFUSES this shape - one
 * pinned input and one block slot serve every iteration, so it used to settle 5 -> 6 where the source says
 * 5 -> 7. Kept as a source string because the refusal itself is the assertion.
 */
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
const trapProxyArtifact = compileString(PROXY_PINNED_BUT_CALLER_SELECTED);
const selfAuthProxyArtifact = compileString(PROXY_SELF_AUTHORIZED);
const stateKeyProxyArtifact = compileString(PROXY_STATE_KEY_AUTHORIZED);
const payoutProxyArtifact = compileString(PROXY_PINNED_WITH_UNRELATED_ADDRESS);

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
     * A conditional and a singular delegate edge STILL compile to byte-identical published metadata, so no SDK
     * gate can separate them - which is exactly why both cases below are settled in the COMPILER instead. The
     * iterated edge no longer reaches an artifact at all.
     */
    it('publishes identical metadata for singular and conditional delegate edges', () => {
      const published = (artifact: Artifact): string => {
        const fn = artifact.abi.find((entry) => entry.name === 'up')!;
        return JSON.stringify({
          lowLevelCalls: fn.lowLevelCalls,
          externalCalls: fn.externalCalls,
          slots: (fn.blockLayout?.slots ?? []).map((slot) => slot.kind),
        });
      };
      expect(published(conditionalProxyArtifact)).toBe(published(pinnedProxyArtifact));
      // ROUND 16 (X43): the two `bytes`-typed entries are GONE from this list, because the gate now detects
      // them. Occurrence, plus the decoy residual measured below, is what is left.
      expect(layer3.UNDETECTED_BY_THIS_GATE).toEqual([
        'conditional-delegate-edge', 'iterated-delegate-edge', 'decoy-committed-target',
      ]);
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
     * CLOSED (was an OPEN live forgery). `if (flag) { impl.delegatecall(input); }` skips the proxy's own state
     * covenant for the WHOLE function - the codegen gate is the per-function `!functionHasDelegatecall` - but
     * forces the delegate co-spend only on the taken branch. Spending with `flag = false` and no implementation
     * used to reproduce SECURITY-AUDIT C1 exactly: the proxy data NFT's flag=1 path self-authorizes on
     * minting-NFT presence, so any spender wrote an arbitrary commitment (measured: 5 -> 999 ACCEPTED).
     *
     * The compiler now carries a runtime "delegate edge reached" flag and requires the proxy's own data NFTs to
     * be preserved (category ++ commitment, input -> output) on every path that did NOT reach the edge. The
     * forgery is refused at input 0 - the proxy's own covenant, not an incidental mismatch elsewhere.
     */
    it('refuses a forged proxy state from a conditional delegate edge whose branch was not taken', async () => {
      const forged = await spendProxy(conditionalProxyArtifact, [false], 999n, {
        coSpendImplementation: false,
      });
      expect(forged.result).toContain('mandatory-script-verify-flag-failed');
      expect(failingInput(forged.result)).toBe(0);

      // Same shape, same absent implementation, only the branch condition differs: also refused at input 0.
      const control = await spendProxy(conditionalProxyArtifact, [true], 999n, {
        coSpendImplementation: false,
      });
      expect(control.result).toContain('mandatory-script-verify-flag-failed');
      expect(failingInput(control.result)).toBe(0);
    }, 240_000);

    /**
     * Positive control for the same fix: the honest conditional spend - branch TAKEN, implementation co-spent -
     * still settles on the BCH-2026 VM, so the refusal above is the not-taken path and not the whole class.
     */
    it('still settles the honest conditional spend with the branch taken', async () => {
      const honest = await spendProxy(conditionalProxyArtifact, [true], 6n, { coSpendImplementation: true });
      expect(honest.result).toBe('ACCEPTED counter=6');
    }, 240_000);

    /**
     * The not-taken path is FROZEN, not forbidden: a spend that leaves the proxy state exactly as it was is what
     * `if (flag)` means when flag is false, and it still settles. Its sibling - not taken, but a co-spent
     * implementation writing 5 -> 6 - is now refused, because the source said not to delegate on that path.
     */
    it('settles a not-taken spend that preserves state, and refuses one that writes', async () => {
      const noop = await spendProxy(conditionalProxyArtifact, [false], 5n, { coSpendImplementation: false });
      expect(noop.result).toBe('ACCEPTED counter=5');

      const wrote = await spendProxy(conditionalProxyArtifact, [false], 6n, { coSpendImplementation: true });
      expect(wrote.result).toContain('mandatory-script-verify-flag-failed');
      expect(failingInput(wrote.result)).toBe(0);
    }, 240_000);

    /**
     * CLOSED (was an OPEN silent miscompile). The source delegates TWICE, so the only correct settlement is
     * 5 -> 7. What used to settle was 5 -> 6 with a single co-spent implementation: the loop published one edge
     * and one block slot, so the compiled covenant was satisfied by delegating once, with no diagnostic. There
     * is no honest covenant to emit for the shape, so the compiler now refuses it by name.
     */
    it('refuses an iterated delegate edge at compile time rather than collapsing it', () => {
      expect(() => compileString(PROXY_ITERATED))
        .toThrow(/issues delegatecall inside a loop.*settle as one/s);
    });

    /**
     * The not-taken-path covenant may NOT be written as a check at the block layout's data-NFT offsets. A data
     * NFT's own sub-covenant never pins its position - its flag=1 path only requires a minting NFT of its
     * category at the witnessed master index - and nothing else on the delegatecall path pins it either. So an
     * attacker parks a token-free UTXO at the checked offset and co-spends the real data NFT one input later.
     *
     * Raw layout, built with the low-level builder exactly as a raw-tx attacker would:
     *   in0 proxy master (flag=false)  in1 DECOY funder  in2 proxy data NFT flag=1  in3 fee
     *   out0 proxy master  out1 decoy change  out2 data NFT with an attacker-chosen commitment
     *
     * MEASURED: with the covenant emitted as a per-input PROPERTY loop this is refused at input 0. With only
     * that one emitter disabled it settles 5 -> 999, so the refusal is attributable to it and not to value
     * preservation or the C3 conservation loop.
     */
    it('refuses the repositioned form of the not-taken forgery', async () => {
      const provider = createLayer3SemanticTestProvider();
      const implementation = await deploy(provider, implArtifact, [], { counter: 0n });
      const proxy = await deploy(
        provider, conditionalProxyArtifact,
        [addressToLockScript(implementation.contract.address)], { counter: 5n },
      );
      const dataNftAddress = getDataNftAddress(proxy.contract, proxy.categoryId);
      const forged = buildPushdataCommitment(conditionalProxyArtifact.stateLayout!, { counter: 999n }, 0);
      const decoy = await createFeeFunder(provider);
      const decoyAddress = new Contract(p2pkhArtifact, [alicePkh] as never[], { provider }).address;
      const fee = await createFeeFunder(provider);

      const send = new TransactionBuilder({ provider, allowImplicitNftBurn: true })
        .addInput(proxy.master, (proxy.contract.unlock as any).up(
          selectorOf(implArtifact, 'increment'), false, 3n,
        ))
        .addInput(decoy.utxo, decoy.unlocker)
        .addInput(proxy.dataNfts[0], createDataNftUnlocker(proxy.contract, 0, proxy.categoryId))
        .addInput(fee.utxo, fee.unlocker)
        .addOutput({ to: proxy.contract.tokenAddress, amount: proxy.master.satoshis, token: proxy.master.token })
        .addOutput({ to: decoyAddress, amount: decoy.utxo.satoshis })
        .addOutput({
          to: dataNftAddress,
          amount: proxy.dataNfts[0].satoshis,
          token: {
            category: proxy.categoryId,
            amount: 0n,
            nft: { capability: 'mutable' as const, commitment: forged },
          },
        })
        .send();

      const message = await outcome(send);
      expect(message).toContain('mandatory-script-verify-flag-failed');
      expect(failingInput(message)).toBe(0);
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
  // ROUND-14: code identity is fail-closed on what the metadata cannot say
  // =========================================================================
  /**
   * Round-13 review A13 (`ReviewA13DelegateE3.test.ts`) found BOTH admitted classes reachable by shapes this
   * enumeration refuses by name, both settling a foreign implementation rewriting proxy state 5 -> 999 on the
   * VM. The two escapes shared one root cause: the gate answered a question the published metadata cannot
   * answer. `pinnedInProxyBytecode` is a SUBSTRING test, and "some `sig` parameter exists" is not authority.
   *
   * The fix asks a narrower question in both places, and refuses when it cannot tell. The cost is measured
   * below, not asserted away.
   */
  describe('round-14: the two A13 escapes fail closed', () => {
    const provider = createLayer3SemanticTestProvider();
    const implementationLbc = binToHex(
      addressToLockScript(new Contract(implArtifact, [], { provider }).address),
    );

    const classify = (artifact: Artifact, constructorArgs: unknown[]): (() => unknown) => (): unknown => {
      const proxy = new Contract(artifact, constructorArgs as never[], { provider });
      return layer3.classifyDelegateParticipant({
        proxy: { artifact, functionName: 'up', bytecode: proxy.bytecode },
        implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
      });
    };

    /**
     * A13-1. The constructor argument really is the honest implementation, so the substring test really does
     * pass - and it is no longer allowed to answer the question, because an `address` parameter means the
     * target may be the caller's value instead. Differs from the admitted control by that one parameter.
     */
    it("refuses 'pinned-but-caller-selected': containment is not identity when the target is a parameter", () => {
      const proxy = new Contract(trapProxyArtifact, [hexToBin(implementationLbc)] as never[], { provider });
      expect(proxy.bytecode.toLowerCase()).toContain(implementationLbc.toLowerCase());
      expect(classify(trapProxyArtifact, [hexToBin(implementationLbc)]))
        .toThrow(/class 'pinned-but-caller-selected' is not admitted.*delegatecalls caller-supplied parameter 'impl'/s);

      // CONTROL: same pin, same implementation, no `address` parameter - still admitted.
      expect((classify(pinnedProxyArtifact, [hexToBin(implementationLbc)])() as { id: string }).id)
        .toBe('bytecode-pinned/adjacent-proxy-block/scalar');
    });

    /**
     * A13-2. `checkSig(s, pk)` against a caller-supplied `pubkey` authorizes nobody. Differs from the admitted
     * control by exactly where the checked key comes from.
     */
    it("refuses 'self-authorized' when the proxy takes the key as a parameter", () => {
      expect(classify(selfAuthProxyArtifact, []))
        .toThrow(/class 'self-authorized' is not admitted.*checked against caller-supplied parameter 'pk'/s);

      // CONTROL: same shape, key is a constructor argument - still admitted.
      expect((classify(authorizedProxyArtifact, [alicePub])() as { id: string }).id)
        .toBe('caller-authorized/adjacent-proxy-block/scalar');
    });

    /**
     * The same class covers a proxy that CHECKS no key at all, which is the other half of A13-2. Round 14 asked
     * whether the proxy stored a `pubkey` anywhere; X43 asks what the guard was checked against, and a body
     * with no signature check publishes no `signatureGuard` - read back as `unknown`, refused by the allow-list.
     */
    it("refuses 'self-authorized' when the proxy checks no key anywhere", () => {
      const artifact = compileString(`pragma solidcash >=0.8.0;
contract E3KeylessProxy() {
    bigint counter;
    function up(bytes input, address impl, sig s) external {
        require(input.length > 0);
        impl.delegatecall(input);
    }
}`);
      expect(artifact.abi.find((entry) => entry.name === 'up')!.signatureGuard).toBeUndefined();
      expect(classify(artifact, []))
        .toThrow(/class 'self-authorized' is not admitted.*checked against a source this artifact does not name/s);
    });

    /**
     * The rule is "a key the PROXY commits to", not "a constructor argument": a `pubkey` STATE variable lives in
     * the proxy's own data NFT and is just as committed, so this shape stays admitted.
     */
    it('admits caller-authorized when the committed key is a state variable', () => {
      expect((classify(stateKeyProxyArtifact, [alicePub])() as { id: string }).id)
        .toBe('caller-authorized/adjacent-proxy-block/scalar');
    });

    /**
     * ROUND 14's COST, REPAIRED IN ROUND 16, with the VM leg untouched. An honest bytecode-pinned proxy whose
     * function takes an unrelated `address` parameter settles on the VM, and round 14 refused it anyway because
     * nothing published said `recipient` was not the delegatecall target. X37 publishes exactly that: the
     * target resolves to constructor argument `impl`, so the `recipient` parameter is no longer evidence of
     * anything and this shape is admitted.
     *
     * This is the HONEST POSITIVE CONTROL for X43: the widening is credited to the target's provenance, because
     * `E3TrapProxy` above has the same `address` parameter and the same containment and is still refused - the
     * ONLY difference between them is which expression the delegatecall reaches.
     */
    it('ADMITS an honest pinned proxy that also takes an unrelated address parameter, and it settles',
      async () => {
        expect((classify(payoutProxyArtifact, [hexToBin(implementationLbc)])() as { id: string }).id)
          .toBe('bytecode-pinned/adjacent-proxy-block/scalar');
        expect(payoutProxyArtifact.abi.find((entry) => entry.name === 'up')!.lowLevelCalls![0].target)
          .toEqual({ kind: 'constructorArg', name: 'impl' });

        const vmProvider = createLayer3SemanticTestProvider();
        const pinned = await deploy(vmProvider, implArtifact, [], { counter: 0n });
        const pinnedLbc = addressToLockScript(pinned.contract.address);
        const proxy = await deploy(vmProvider, payoutProxyArtifact, [pinnedLbc], { counter: 5n });
        const tx = await new StatefulTransactionBuilder({
          provider: vmProvider,
          stateLayout: payoutProxyArtifact.stateLayout!,
          categoryId: proxy.categoryId,
          masterUtxo: {
            ...proxy.master,
            unlocker: (proxy.contract.unlock as any).up(selectorOf(implArtifact, 'increment'), pinnedLbc, 2n),
          },
          dataNftUtxos: proxy.dataNfts.map((nft) => ({
            ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
          })),
          externalCallUtxoGroups: [delegateGroup(implArtifact, pinned, 'increment', [0n], 2)],
        }).setState('counter', 6n).send();
        expect(stateOf(tx, proxy.categoryId, payoutProxyArtifact.stateLayout!).counter).toBe(6n);
      }, 240_000);

    /**
     * ROUND 16 (X43). The hole round 14 measured and left open is CLOSED, and the two cases below are the same
     * two sources inverted in place. Round 14's fixes keyed off a PARAMETER TYPE, so both were defeated by
     * routing the caller's value through a `bytes` parameter and casting it. X37 publishes where the target and
     * the checked key came from, both re-spellings resolve to `parameter`, and the gate reads that instead.
     *
     * Each case carries its own GUARD CONTROL: a proxy with the SAME published parameter types whose target (or
     * key) resolves to the constructor argument. If the guard control were refused too, the refusal would be
     * credited to "a second `bytes` parameter exists" rather than to the provenance, and the fix would be the
     * round-14 mistake again in a new spelling.
     */
    it('refuses the `bytes`-typed delegatecall target, and admits the same shape targeting the ctor arg', () => {
      const escape = compileString(`pragma solidcash >=0.8.0;
contract E3BytesTargetProxy(address impl) {
    bigint counter;
    function up(bytes input, bytes target) external {
        address t = address(target);
        t.delegatecall(input);
        require(input.length > 0);
    }
}`);
      expect(escape.abi.find((entry) => entry.name === 'up')!.lowLevelCalls![0].target)
        .toEqual({ kind: 'parameter', name: 'target' });
      expect(classify(escape, [hexToBin(implementationLbc)]))
        .toThrow(/class 'pinned-but-caller-selected' is not admitted.*delegatecalls caller-supplied parameter 'target'/s);

      // GUARD CONTROL, byte-identical published parameter TYPES (`bytes`, `bytes`), one expression apart: the
      // delegatecall reaches the constructor argument and `target` is only read. Still admitted.
      const honest = compileString(`pragma solidcash >=0.8.0;
contract E3BytesUnusedProxy(address impl) {
    bigint counter;
    function up(bytes input, bytes target) external {
        require(target.length == 35);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`);
      const types = (artifact: Artifact): string[] => artifact.abi.find((entry) => entry.name === 'up')!.inputs
        .filter((entry) => !entry.name.startsWith('__internal__')).map((entry) => entry.type);
      expect(types(honest)).toEqual(types(escape));
      expect((classify(honest, [hexToBin(implementationLbc)])() as { id: string }).id)
        .toBe('bytecode-pinned/adjacent-proxy-block/scalar');
    });

    it('refuses the `bytes`-typed key material, and admits the same shape checking the ctor key', () => {
      const escape = compileString(`pragma solidcash >=0.8.0;
contract E3BytesKeyProxy(pubkey owner) {
    bigint counter;
    function up(bytes input, address impl, bytes k, sig s) external {
        require(checkSig(s, pubkey(k)));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`);
      expect(escape.abi.find((entry) => entry.name === 'up')!.signatureGuard)
        .toEqual({ key: { kind: 'parameter', name: 'k' } });
      expect(classify(escape, [alicePub]))
        .toThrow(/class 'self-authorized' is not admitted.*checked against caller-supplied parameter 'k'/s);

      // GUARD CONTROL, same parameter types, same `bytes k`, one expression apart: the signature is checked
      // against the constructor argument. Still admitted, so the refusal is credited to the KEY's provenance.
      const honest = compileString(`pragma solidcash >=0.8.0;
contract E3BytesKeyHonestProxy(pubkey owner) {
    bigint counter;
    function up(bytes input, address impl, bytes k, sig s) external {
        require(k.length == 33);
        require(checkSig(s, owner));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`);
      expect((classify(honest, [alicePub])() as { id: string }).id)
        .toBe('caller-authorized/adjacent-proxy-block/scalar');
    });

    /**
     * ANOTHER SHAPE the round-14 gate admitted, found by measuring rather than by reasoning. It publishes no
     * `address` parameter, so the type-driven gate called it `bytecode-pinned` on the strength of a constructor
     * argument that is not the target. An upgrade pointer read from state is only as strong as whatever wrote
     * it, which is a question no published field answers and no case here settles.
     */
    it('refuses a state-variable target the type gate called bytecode-pinned', () => {
      const stateTarget = compileString(`pragma solidcash >=0.8.0;
contract E3StateTargetProxy(address impl) {
    bytes stored;
    bigint counter;
    function up(bytes input) external {
        address(this.stored).delegatecall(input);
        require(input.length > 0);
    }
}`);
      expect(stateTarget.abi.find((entry) => entry.name === 'up')!.lowLevelCalls![0].target)
        .toEqual({ kind: 'stateVar', name: 'stored' });
      expect(classify(stateTarget, [hexToBin(implementationLbc)]))
        .toThrow(/class 'dynamically-resolved-implementation' is not admitted.*state variable 'stored'/s);
    });

    /**
     * Every form the compiler answers `computed` for, refused as one class. `computed` is the compiler saying it
     * could not follow the value, which is the one answer that must never be read as "then it is fixed" - and
     * the type gate read all of these as `bytecode-pinned`, because none publishes an `address` parameter.
     */
    it('refuses every `computed` target form the compiler publishes', () => {
      const bodies: Record<string, string> = {
        ternary: 'address t = flag ? impl : alt; t.delegatecall(input);',
        'array element': 'address t = address(pool[0]); t.delegatecall(input);',
        'msg.sender': 'address t = address(msg.sender); t.delegatecall(input);',
        'tx.origin': 'address t = address(tx.origin); t.delegatecall(input);',
        slice: 'address t = address(blob.split(35)[0]); t.delegatecall(input);',
        concatenated: 'address t = address(bytes(impl) + blob); t.delegatecall(input);',
        'struct field': 'Route memory r = Route(blob); address t = address(r.to); t.delegatecall(input);',
        'tuple destructured': '(bytes l, bytes r2) = pair(blob); address t = address(l); '
          + 'require(r2.length >= 0); t.delegatecall(input);',
        'alias cycle': 'address a = impl; address b = a; a = b; a.delegatecall(input);',
      };
      for (const [name, body] of Object.entries(bodies)) {
        const artifact = compileString(`pragma solidcash >=0.8.0;
contract E3ComputedProxy(address impl, address alt) {
    bigint counter;
    struct Route { bytes to; }
    function pair(bytes a) internal pure returns (bytes, bytes) { return (a, a); }
    function up(bytes input, bool flag, bytes[] pool, bytes blob) external {
        ${body}
        require(input.length > 0);
    }
}`);
        expect(artifact.abi.find((entry) => entry.name === 'up')!.lowLevelCalls![0].target,
          `${name} must publish computed`).toEqual({ kind: 'computed' });
        expect(classify(artifact, [hexToBin(implementationLbc), hexToBin(implementationLbc)]), name)
          .toThrow(/class 'computed-delegate-target' is not admitted/);
      }
    });

    /**
     * THE COMPATIBILITY CONTRACT, EXERCISED. `target` is additive and optional, so an artifact compiled before
     * X37 carries none - and an absent field must never read as "unconstrained". The proxy here is the admitted
     * `bytecode-pinned` control with the field stripped from the delegatecall row: everything else about it is
     * byte-identical, and it is refused.
     */
    it('refuses an artifact that publishes no target provenance, rather than falling through to admitted', () => {
      const stripped = JSON.parse(JSON.stringify(pinnedProxyArtifact)) as Artifact;
      const fn = stripped.abi.find((entry) => entry.name === 'up')! as { lowLevelCalls: { callMode: string }[] };
      fn.lowLevelCalls = fn.lowLevelCalls.map((call) => ({ callMode: call.callMode }));
      expect(classify(stripped, [hexToBin(implementationLbc)]))
        .toThrow(/class 'unpublished-target-provenance' is not admitted.*recompile the proxy/s);
      // The unstripped original is the same artifact and IS admitted, so the refusal is the missing field.
      expect((classify(pinnedProxyArtifact, [hexToBin(implementationLbc)])() as { id: string }).id)
        .toBe('bytecode-pinned/adjacent-proxy-block/scalar');
    });

    /**
     * THE RESIDUAL X43 LEAVES, MEASURED. Containment is a substring test over the whole script and the
     * provenance names ONE of several committed values, so a proxy with two `address` constructor arguments -
     * delegatecalling one while the other holds this implementation's locking bytecode - is classified against
     * an implementation it does not target. It is NOT an authority hole: both values are committed, so no
     * spender can vary either and the mismatch is refused by the covenant at spend time. It is not closed by
     * matching `target.name`, because `name` is walk-order-dependent on a strength tie and the gate is handed
     * the proxy's bytecode rather than its argument values. Named in UNDETECTED_BY_THIS_GATE.
     */
    it('ADMITS a decoy proxy whose committed target is a different ctor arg - the named residual', () => {
      const decoy = compileString(`pragma solidcash >=0.8.0;
contract E3DecoyProxy(address shown, address used) {
    bigint counter;
    function up(bytes input) external {
        require(shown.length == 35);
        used.delegatecall(input);
        require(input.length > 0);
    }
}`);
      expect(decoy.abi.find((entry) => entry.name === 'up')!.lowLevelCalls![0].target)
        .toEqual({ kind: 'constructorArg', name: 'used' });
      // `shown` is this implementation; `used` is a script the gate never sees. Still admitted.
      expect((classify(decoy, [hexToBin(implementationLbc), hexToBin(`aa20${'cd'.repeat(32)}87`)])() as {
        id: string;
      }).id).toBe('bytecode-pinned/adjacent-proxy-block/scalar');
      expect(layer3.UNDETECTED_BY_THIS_GATE).toContain('decoy-committed-target');
    });

    /**
     * X51 CLOSED THE FALSE NEGATIVE X43 KEPT. `signatureGuard` published the KEY's provenance but not the whole
     * authority story, so P2PKH-shaped authority - a `pubkey` parameter pinned by a separate unconditional
     * `require(hash160(pk) == pkh)` - was refused as `self-authorized`. X43 declined to reconstruct that from
     * types, correctly: type reconstruction is the reasoning X43 exists to remove. X51 publishes the commitment
     * itself as `keyCommitment`, computed by the SAME rule that drives the SEC-17 diagnostic, so the gate now
     * reads the fact instead of guessing it. The pre-X51 artifact is still refused, asserted below.
     */
    it('admits honest P2PKH-shaped authority once the commitment is published', () => {
      const p2pkhShaped = compileString(`pragma solidcash >=0.8.0;
contract E3Hash160Proxy(bytes20 pkh) {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s) external {
        require(hash160(pk) == pkh);
        require(checkSig(s, pk));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`);
      expect(p2pkhShaped.abi.find((entry) => entry.name === 'up')!.signatureGuard).toEqual({
        key: { kind: 'parameter', name: 'pk' },
        keyCommitment: { kind: 'constructorArg', name: 'pkh' },
      });
      expect((classify(p2pkhShaped, [alicePkh])() as { id: string }).id)
        .toBe('caller-authorized/adjacent-proxy-block/scalar');
      expect(layer3.UNADMITTED_DELEGATE_PARTICIPANT_CLASSES.map((entry) => entry.id))
        .not.toContain('hash160-committed-key');

      // GUARD: the identical artifact with only the new field deleted is byte-for-byte a pre-X51 artifact, and
      // is refused again. So the admission is credited to the published commitment, not to anything else that
      // moved in the same commit.
      const preX51 = JSON.parse(JSON.stringify(p2pkhShaped));
      delete preX51.abi.find((entry: { name: string }) => entry.name === 'up').signatureGuard.keyCommitment;
      expect(classify(preX51, [alicePkh])).toThrow(/class 'self-authorized' is not admitted/);
    });

    /**
     * WHY THE GATE IS STILL NOT WIRED, measured rather than asserted. Round 14 instrumented `withDelegatecall`
     * to classify every pair it receives, ran the three SDK suites that use it, and got 11 calls over 6 pairs,
     * refused 11 of 11.
     *
     * ROUND 16 RE-MEASURED over a wider set (Delegatecall, LibraryDelegate, UpgradesDeployProxy,
     * FallbackReceive): 27 calls over 21 distinct pairs, refused 27 of 27 (100%). The conclusion is unchanged -
     * nothing that settles today would survive wiring - but the breakdown moved, and one entry is a finding
     * rather than a shape: 13 of the 27 were 'unpublished-target-provenance', because the SDK's built-in
     * `defaultProxyArtifact.ts` was a CHECKED-IN pre-X37 artifact whose delegatecall row was
     * `{callMode:'delegatecall'}` with no `target`. The rest: 4 'dynamically-resolved-implementation', 4
     * not-selector-dispatched, 3 'emitting-delegate', 2 'self-authorized', 1 'collection-writing-delegate'.
     *
     * X50 CLOSED THAT ONE. The file is regenerated from its own `DEFAULT_PROXY_SOURCE` and now publishes
     * `{kind:'constructorArg', name:'implementation'}`, so those 13 no longer refuse for an absent field. The
     * conclusion above is unchanged - the gate is still not wired, and the shipped proxy still needs its real
     * constructor argument to classify, which `X50DefaultProxyRegenerated.test.ts` supplies and measures.
     *
     * The 'self-authorized' one is not a synthetic trap: the canonical `PinnedProxy` fixture in the SDK's own
     * `Delegatecall.test.ts` is the A13-2 shape verbatim, which is what this case pins.
     */
    it('is not wired: the SDK\'s own canonical delegatecall fixture is itself an A13-2 shape', () => {
      const sibling = readFileSync(new URL('./Delegatecall.test.ts', import.meta.url).pathname, 'utf8');
      const match = /contract PinnedProxy\(\)[\s\S]*?\n {6}}/.exec(sibling);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('function up(bytes input, address impl, pubkey pk, sig s) external');
      expect(match![0]).toContain('require(checkSig(s, pk));');

      const fixtureArtifact = compileString(`pragma solidcash >=0.8.0;\n${match![0]}`);
      expect(classify(fixtureArtifact, [])).toThrow(/class 'self-authorized' is not admitted/);

      // X50. The built-in proxy the SDK ships was the pre-X37 artifact behind 13 of the 27 refusals above. It
      // is regenerated: the shipped row and a fresh compile of its own source now agree, which is what stops
      // those 13 refusing for an absent field. Kept as an assertion so the fix cannot silently regress.
      const shipped = defaultProxyArtifact.abi.find((entry) => entry.name === '__forward')!;
      const published = [{ callMode: 'delegatecall', target: { kind: 'constructorArg', name: 'implementation' } }];
      expect(shipped.lowLevelCalls).toEqual(published);
      expect(compileString(DEFAULT_PROXY_SOURCE, { forceStateful: true })
        .abi.find((entry) => entry.name === '__forward')!.lowLevelCalls)
        .toEqual(published);
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
        'pinned-but-caller-selected',
        'self-authorized',
        'unpinned-p2pkh',
        'dynamically-resolved-implementation',
        'emitting-delegate',
        'collection-writing-delegate',
        'multi-edge-proxy',
        'conditional-delegate-edge',
        'iterated-delegate-edge',
        'computed-delegate-target',
        'unpublished-target-provenance',
        'decoy-committed-target',
        // 'hash160-committed-key' was removed by X51: the commitment is now published as
        // signatureGuard.keyCommitment and read by the gate, so the shape is admitted rather than named.
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
