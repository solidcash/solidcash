import { describe, expect, it } from 'vitest';
import { compileString } from '../../direct-compile.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { Artifact, buildInitialStateCommitments, parsePushdataCommitment } from '@solidcash/utils';
import {
  Contract, SignatureTemplate, StatefulTransactionBuilder, messageBus, getDataNftAddress, createDataNftUnlocker,
} from '../../../src/index.js';
import { ExternalCallUtxoGroup } from '../../../src/stateful/StatefulTransactionBuilder.js';
import { addressToLockScript } from '../../../src/utils.js';
import { Utxo } from '../../../src/interfaces.js';
import {
  alicePkh, alicePriv, alicePub, bobPriv, bobPub,
} from '../../fixture/vars.js';
import { getTxOutputs } from '../../test-util.js';
import { createMessageBusSemanticTestProvider } from './message-bus-semantic-profile.js';

/**
 * X51 - the SDK delegate gate reads the PUBLISHED key commitment.
 *
 * Round 16 refused honest P2PKH-shaped authority. `require(hash160(pk) == adminPkh); require(checkSig(s, pk));`
 * publishes `signatureGuard.key = {parameter, pk}`, because the caller does hand the key in, and the separate
 * require that turns it into authority was in no artifact field. X43 named that a false negative
 * (`hash160-committed-key`) and refused to reconstruct it from parameter types - a `bytes20` constructor
 * argument beside a `pubkey` parameter is exactly the type reasoning X37 exists to remove.
 *
 * X51 publishes `signatureGuard.keyCommitment` and this gate consumes it. This file carries the whole change:
 *
 *  - the VM triple, so the admission rests on settlement rather than on a metadata read: the honest holder
 *    settles, a stranger is refused at a NAMED input index, and the same proxy with the one commitment line
 *    removed lets that same stranger through, which is what makes the refusal attributable to the pin;
 *  - the refusal-to-admission FLIP, asserted rather than dropped: the exact shape round 16 refused is admitted,
 *    and the same artifact with the new key deleted - which is byte-for-byte a pre-X51 artifact - is refused
 *    again by name;
 *  - the hostile shapes that must stay refused, including X46's vacuous commitment.
 *
 * SEMANTIC evidence only, on createMessageBusSemanticTestProvider (BCH-2026 opcode, introspection and 128-byte
 * commitment behaviour, relaxed capacity).
 */

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** Implementation: two functions, so its unlocking script leads with a selector the proxy can pin. */
const IMPL = `pragma solidcash >=0.8.0;
contract X51Impl() {
    bigint counter;
    function increment() delegate { this.counter = this.counter + 1; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;

/**
 * THE HONEST SHAPE. The caller supplies the key, and may supply only the one key whose hash the proxy's own
 * p2sh32 already commits to. Every source below differs from this one by a single line, so a difference in
 * outcome is attributable to that line.
 */
const PROXY_COMMITTED = `pragma solidcash >=0.8.0;
contract X51CommittedProxy(bytes20 adminPkh) {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s) external {
        require(hash160(pk) == adminPkh);
        require(checkSig(s, pk));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/** THE GUARD NEGATIVE CONTROL: identical but for the commitment line. Round 14's A13-2 shape. */
const PROXY_UNCOMMITTED = PROXY_COMMITTED
  .replace('X51CommittedProxy(bytes20 adminPkh)', 'X51OpenProxy(bytes20 adminPkh)')
  .replace('        require(hash160(pk) == adminPkh);\n', '');

/** The commitment sits in an if-arm, so the other arm leaves `pk` free. SEC-17's conditional control. */
const PROXY_CONDITIONAL_COMMITMENT = `pragma solidcash >=0.8.0;
contract X51CondProxy(bytes20 adminPkh) {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s) external {
        if (input.length > 1) { require(hash160(pk) == adminPkh); }
        require(checkSig(s, pk));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/** The key is pinned to ANOTHER caller parameter, which pins nothing. */
const PROXY_COMMITTED_TO_PARAMETER = `pragma solidcash >=0.8.0;
contract X51DecoyProxy(bytes20 adminPkh) {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s, bytes20 otherPkh) external {
        require(hash160(pk) == otherPkh);
        require(checkSig(s, pk));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/**
 * X46's LIVE SHAPE, which turns out not to be expressible as a proxy at all. The commitment target is written
 * from a caller parameter one statement earlier, and scalar state is read after write, so the require compares
 * `pk` against bytes the caller just supplied - settled as a real theft in `X46CommitmentWriter.test.ts`. Written
 * into a delegatecall function the COMPILER refuses it outright, for an unrelated reason that happens to
 * foreclose it here: a delegatecall function skips its own state covenant, so it may not write its own state.
 * The artifact-level fact that this shape publishes no commitment is pinned at the selfdestruct site instead,
 * in `packages/solidc/test/KeyCommitmentX51.test.ts`.
 */
const PROXY_OVERWRITTEN_COMMITMENT = `pragma solidcash >=0.8.0;
contract X51OverwriteProxy() {
    bigint counter;
    bytes20 pkh;
    function up(bytes input, address impl, pubkey pk, sig s, bytes20 newPkh) external {
        this.pkh = newPkh;
        require(hash160(pk) == this.pkh);
        require(checkSig(s, pk));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type SemanticProvider = ReturnType<typeof createMessageBusSemanticTestProvider>;

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

const outcome = async (send: Promise<unknown>): Promise<string> =>
  send.then(() => 'ACCEPTED').catch((error: Error) => error.message);

/** The input index a rejected transaction failed at, so a hostile case pins WHICH covenant refused it. */
const failingInput = (message: string): number | null => {
  const match = /(?:error in evaluating input index|preflight failed at input) (\d+)/.exec(message);
  return match ? Number(match[1]) : null;
};

const implArtifact = compileString(IMPL);
const committedProxyArtifact = compileString(PROXY_COMMITTED);
const openProxyArtifact = compileString(PROXY_UNCOMMITTED);
const conditionalProxyArtifact = compileString(PROXY_CONDITIONAL_COMMITMENT);
const decoyProxyArtifact = compileString(PROXY_COMMITTED_TO_PARAMETER);

/** Run the gate for one proxy artifact against the honest implementation. */
const classify = (
  proxyArtifact: Artifact, constructorArgs: unknown[],
): (() => { id: string }) => {
  const provider = createMessageBusSemanticTestProvider();
  const implementation = new Contract(implArtifact, [], { provider });
  const proxy = new Contract(proxyArtifact, constructorArgs as never[], { provider });
  return () => messageBus.classifyDelegateParticipant({
    proxy: { artifact: proxyArtifact, functionName: 'up', bytecode: proxy.bytecode },
    implementation: {
      artifact: implArtifact,
      functionName: 'increment',
      lockingBytecode: binToHex(addressToLockScript(implementation.address)),
    },
  });
};

describe('X51: a committed caller-supplied key is admitted, read from the artifact', () => {
  // =========================================================================
  // The VM triple
  // =========================================================================
  describe('settlement', () => {
    async function build(options: {
      artifact: Artifact;
      constructorArgs: unknown[];
      signer: 'admin' | 'stranger';
    }): Promise<{ send: Promise<any>; proxyCategory: string }> {
      const provider = createMessageBusSemanticTestProvider();
      const implementation = await deploy(provider, implArtifact, [], { counter: 0n });
      const proxy = await deploy(provider, options.artifact, options.constructorArgs, { counter: 5n });
      const stranger = options.signer === 'stranger';
      const send = new StatefulTransactionBuilder({
        provider,
        stateLayout: options.artifact.stateLayout!,
        categoryId: proxy.categoryId,
        masterUtxo: {
          ...proxy.master,
          unlocker: (proxy.contract.unlock as any).up(
            selectorOf(implArtifact, 'increment'),
            addressToLockScript(implementation.contract.address),
            stranger ? bobPub : alicePub,
            new SignatureTemplate(stranger ? bobPriv : alicePriv),
            2n,
          ),
        },
        dataNftUtxos: proxy.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
        })),
        externalCallUtxoGroups: [delegateGroup(implArtifact, implementation, 'increment', [0n], 2)],
      }).setState('counter', 6n).send();
      return { send, proxyCategory: proxy.categoryId };
    }

    /** HONEST POSITIVE CONTROL. The holder of the committed key spends, and the delegate writes proxy state. */
    it('settles for the holder of the key the proxy commits to', async () => {
      const { send, proxyCategory } = await build({
        artifact: committedProxyArtifact, constructorArgs: [alicePkh], signer: 'admin',
      });
      expect(stateOf(await send, proxyCategory, committedProxyArtifact.stateLayout!).counter).toBe(6n);
    }, 120_000);

    /**
     * HOSTILE. A stranger supplies HIS OWN key and a valid signature over it, which is precisely what the
     * `signatureGuard.key` provenance alone cannot rule out. The commitment does, and the refusal is pinned to
     * the proxy master input rather than reported as "it threw".
     */
    it('refuses a stranger who supplies his own key, at the proxy master input', async () => {
      const message = await outcome((await build({
        artifact: committedProxyArtifact, constructorArgs: [alicePkh], signer: 'stranger',
      })).send);
      expect(message).toContain(
        'BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.',
      );
      expect(failingInput(message)).toBe(0);
    }, 120_000);

    /**
     * GUARD NEGATIVE CONTROL. The same proxy with the commitment line deleted - same parameters, same
     * delegatecall, same co-spend - lets that same stranger through. So the refusal above is attributable to the
     * commitment and not to the delegate machinery, the signing key, or the fixture.
     */
    it('lets the same stranger through once the commitment line is removed', async () => {
      const { send, proxyCategory } = await build({
        artifact: openProxyArtifact, constructorArgs: [alicePkh], signer: 'stranger',
      });
      expect(stateOf(await send, proxyCategory, openProxyArtifact.stateLayout!).counter).toBe(6n);
    }, 120_000);
  });

  // =========================================================================
  // The published fact
  // =========================================================================
  describe('the artifact publishes the commitment', () => {
    it('publishes the constructor argument the caller-supplied key is pinned to', () => {
      expect(committedProxyArtifact.abi.find((entry) => entry.name === 'up')!.signatureGuard).toEqual({
        key: { kind: 'parameter', name: 'pk' },
        keyCommitment: { kind: 'constructorArg', name: 'adminPkh' },
      });
    });

    it('publishes the key alone when nothing pins it', () => {
      expect(openProxyArtifact.abi.find((entry) => entry.name === 'up')!.signatureGuard)
        .toEqual({ key: { kind: 'parameter', name: 'pk' } });
    });

    it('publishes no commitment for a conditional pin or a pin to another caller parameter', () => {
      for (const artifact of [conditionalProxyArtifact, decoyProxyArtifact]) {
        expect(artifact.abi.find((entry) => entry.name === 'up')!.signatureGuard)
          .toEqual({ key: { kind: 'parameter', name: 'pk' } });
      }
    });

    /**
     * X46's vacuous-commitment shape cannot reach this gate at all: the write it needs is a self-write inside a
     * delegatecall function, which the compiler refuses for an unrelated reason. Pinned so the reason X51 does
     * not carry an X46 delegate case is a measured fact rather than an omission - the artifact-level behaviour
     * is asserted at the selfdestruct site in the compiler suite.
     */
    it('cannot even express X46\'s vacuous commitment as a proxy: the compiler refuses the self-write', () => {
      expect(() => compileString(PROXY_OVERWRITTEN_COMMITMENT))
        .toThrow(/delegatecall and also writes contract state/);
    });
  });

  // =========================================================================
  // The gate: the refusal-to-admission flip
  // =========================================================================
  describe('the gate consumes it', () => {
    /**
     * THE FLIP, asserted rather than dropped. Round 16 refused this exact shape as `self-authorized` and named
     * the false negative `hash160-committed-key`. It is now admitted, and the class it is admitted as is the
     * one whose covenant authority the VM triple above settles.
     */
    it('ADMITS the shape round 16 refused as a named false negative', () => {
      expect(classify(committedProxyArtifact, [alicePkh])().id)
        .toBe('caller-authorized/adjacent-proxy-block/scalar');
    });

    /**
     * THE OTHER HALF OF THE FLIP, and the additive-field contract. Deleting exactly the new key from this
     * artifact reproduces a pre-X51 artifact byte-for-byte, and the gate refuses it again - by a name that says
     * what is missing. An absent field is never read as "unconstrained": it falls closed through the same
     * allow-list `unknown` fails.
     */
    it('refuses the same artifact once the new key is deleted, which is a pre-X51 artifact', () => {
      const stripped = JSON.parse(JSON.stringify(committedProxyArtifact)) as Artifact;
      const fn = stripped.abi.find((entry) => entry.name === 'up')! as {
        signatureGuard: { key: unknown; keyCommitment?: unknown };
      };
      delete fn.signatureGuard.keyCommitment;
      expect(fn.signatureGuard).toEqual({ key: { kind: 'parameter', name: 'pk' } });
      expect(classify(stripped, [alicePkh]))
        .toThrow(/class 'self-authorized' is not admitted.*never the claim that the key is pinned/s);
    });

    /**
     * The recompile hint is appended to `self-authorized` rather than promoted to a class of its own, because a
     * pre-X51 artifact and a pin the compiler refused to credit are byte-for-byte identical here. Both of the
     * cases below therefore carry the same class id AND the same hint - which is the honest reading, and keeps
     * the ordinary caller-picks-both hole named after what it is.
     */
    it('still refuses a key nothing pins, under the same class id and with the same hint', () => {
      expect(classify(openProxyArtifact, [alicePkh]))
        .toThrow(/class 'self-authorized' is not admitted.*if the field is still absent, the pin is not one/s);
    });

    /**
     * THE HOSTILE SHAPES. Each carries a `hash160` require in its source and neither publishes a commitment, so
     * the gate refuses both. A rule that credited "a hash160 somewhere in the body" would admit them, which is
     * why the published fact is the compiler's own SEC-17 decision rather than a syntactic hint.
     */
    it('refuses a conditional pin and a pin to another caller parameter', () => {
      for (const artifact of [conditionalProxyArtifact, decoyProxyArtifact]) {
        expect(classify(artifact, [alicePkh])).toThrow(/is not admitted/);
      }
    });

    /**
     * OBLIGATION 2 OF THE ADDITIVE-FIELD CONTRACT, discharged for the new field: admission is an explicit
     * ALLOW-LIST, so a kind a LATER compiler adds falls closed here rather than being admitted by omission.
     * Forged rather than compiled, because the point is a value this compiler cannot emit.
     */
    it('refuses a commitment kind this gate does not know, rather than admitting by omission', () => {
      for (const kind of ['futureKind', 'unknown', 'computed']) {
        const forged = JSON.parse(JSON.stringify(committedProxyArtifact)) as Artifact;
        const fn = forged.abi.find((entry) => entry.name === 'up')! as {
          signatureGuard: { key: unknown; keyCommitment: { kind: string } };
        };
        fn.signatureGuard.keyCommitment = { kind };
        expect(classify(forged, [alicePkh])).toThrow(/class 'self-authorized' is not admitted/);
      }
    });

    /** X62: key provenance is not control flow. An optional check cannot authorize a later delegatecall. */
    it('refuses a branch-guarded signature check by both the X51 and pre-X51 routes', () => {
      const branched = (guard: string, name: string): Artifact => compileString(`pragma solidcash >=0.8.0;
contract ${name}(bytes20 adminPkh, pubkey owner) {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s, bool flag) external {
        ${guard}
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`);
      const viaX51 = branched(
        'require(hash160(pk) == adminPkh); if (flag) { require(checkSig(s, pk)); }', 'X51BranchProxy',
      );
      const preX51 = branched('if (flag) { require(checkSig(s, owner)); }', 'X51PreBranchProxy');
      expect(viaX51.abi.find((entry) => entry.name === 'up')!.signatureGuard)
        .toEqual({ key: { kind: 'parameter', name: 'pk' }, keyCommitment: {
          kind: 'constructorArg', name: 'adminPkh',
        } });
      expect(preX51.abi.find((entry) => entry.name === 'up')!.signatureGuard)
        .toEqual({ key: { kind: 'constructorArg', name: 'owner' } });
      for (const artifact of [viaX51, preX51]) {
        expect(artifact.abi.find((entry) => entry.name === 'up')!.signatureGuardDominatesDelegatecalls)
          .toBeUndefined();
        expect(classify(artifact, [alicePkh, alicePub]))
          .toThrow(/class 'non-dominating-signature-guard' is not admitted/);
      }
    });

    it('admits checks that dominate the call, including from an enclosing block and an && requirement', () => {
      const artifact = compileString(`pragma solidcash >=0.8.0;
contract X62Dominating(bytes20 adminPkh) {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s, bool flag) external {
        require(hash160(pk) == adminPkh);
        if (flag) { require(input.length > 0); }
        { require(flag && checkSig(s, pk)); impl.delegatecall(input); }
        require(input.length > 0);
    }
}`);
      expect(artifact.abi.find((entry) => entry.name === 'up')!.signatureGuardDominatesDelegatecalls).toBe(true);
      expect(classify(artifact, [alicePkh])().id).toBe('caller-authorized/adjacent-proxy-block/scalar');
    });

    it('fails closed for old artifacts and when only some delegatecalls are dominated', () => {
      const old = structuredClone(committedProxyArtifact);
      const oldFn = old.abi.find((entry) => entry.name === 'up')!;
      delete oldFn.signatureGuardDominatesDelegatecalls;
      expect(classify(old, [alicePkh]))
        .toThrow(/class 'non-dominating-signature-guard' is not admitted.*predating the dominance field/);

      const partial = compileString(`pragma solidcash >=0.8.0;
contract X62Partial(pubkey owner) {
    bigint counter;
    function up(bytes input, address impl, sig s) external {
        impl.delegatecall(input);
        require(checkSig(s, owner));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`);
      expect(partial.abi.find((entry) => entry.name === 'up')!.signatureGuardDominatesDelegatecalls)
        .toBeUndefined();
      expect(classify(partial, [alicePub]))
        .toThrow(/class 'multi-edge-proxy' is not admitted/);

      const disjunction = compileString(`pragma solidcash >=0.8.0;
contract X62Disjunction(pubkey owner) {
    bigint counter;
    function up(bytes input, address impl, sig s, bool flag) external {
        require(flag || checkSig(s, owner));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`);
      expect(disjunction.abi.find((entry) => entry.name === 'up')!.signatureGuardDominatesDelegatecalls)
        .toBeUndefined();
      expect(classify(disjunction, [alicePub]))
        .toThrow(/class 'non-dominating-signature-guard' is not admitted/);
    });

    /**
     * THE WEAKEST FOLD REACHES THE GATE. Two signature checks, one pinned and one not: the compiler publishes
     * the weakest bound, which is the unpinned key's own `parameter` provenance, and the gate refuses. Without
     * the fold the pinned check would have spoken for a body a spender can satisfy through the other one.
     */
    it('refuses a body where a SECOND signature check is against an unpinned key', () => {
      const mixed = compileString(`pragma solidcash >=0.8.0;
contract X51MixedProxy(bytes20 adminPkh) {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s, pubkey other, sig s2) external {
        require(hash160(pk) == adminPkh);
        require(checkSig(s, pk));
        require(checkSig(s2, other));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`);
      expect(mixed.abi.find((entry) => entry.name === 'up')!.signatureGuard!.keyCommitment)
        .toEqual({ kind: 'parameter', name: 'other' });
      expect(classify(mixed, [alicePkh])).toThrow(/class 'self-authorized' is not admitted/);
    });
  });

  // =========================================================================
  // The enumeration
  // =========================================================================
  describe('the enumeration records the closure', () => {
    it('drops `hash160-committed-key`, absorbed into `self-authorized`', () => {
      const ids = messageBus.UNADMITTED_DELEGATE_PARTICIPANT_CLASSES.map((entry) => entry.id);
      expect(ids).not.toContain('hash160-committed-key');
      expect(ids).toContain('self-authorized');
      // The absorption is recorded in the class's own reason, so a reader of the enumeration alone finds it.
      expect(messageBus.UNADMITTED_DELEGATE_PARTICIPANT_CLASSES.find((entry) => entry.id === 'self-authorized')!
        .reason).toContain('hash160-committed-key');
    });

    /** X51 changes nothing about the classes this gate cannot SEE; those are occurrence and the decoy target. */
    it('leaves the undetected list unchanged', () => {
      expect(messageBus.UNDETECTED_BY_THIS_GATE).toEqual([
        'conditional-delegate-edge', 'iterated-delegate-edge', 'decoy-committed-target',
      ]);
    });
  });
});
