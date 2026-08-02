import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { Artifact, buildInitialStateCommitments, parsePushdataCommitment } from '@solidcash/utils';
import {
  Contract, SignatureTemplate, StatefulTransactionBuilder, layer3, getDataNftAddress, createDataNftUnlocker,
} from '../../src/index.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { addressToLockScript } from '../../src/utils.js';
import { Utxo } from '../../src/interfaces.js';
import { alicePub, bobPriv, bobPub } from '../fixture/vars.js';
import { getTxOutputs } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';

// Round-13 independent hostile review of E3 (Worker B's). I implemented none of it.
//
// ROUND 14 (Worker B): both escapes are CLOSED in `src/layer3/delegate.ts`. The two gate assertions below are
// inverted in place - A13-1a and A13-2a now demand a NAMED refusal - and every other case in this file is
// untouched, including the two VM cases that settle 5 -> 999 (they are why the refusals must exist) and the
// two honest controls that are still refused by the covenant at input 0.
//
// ROUND 15 (Worker S1, SEC-12): the compiler's `hasSignatureGuard` suppressor is fixed, so A13-2a2 is inverted
// in place too - the self-authorizing shape now warns by name. A13-2b is NOT touched: the compiler emits a
// diagnostic, not a covenant, so the stranger still settles 5 -> 999 and that is what the warning is about.
//
// ROUND 16 (X43): round 14's two fixes keyed off PARAMETER TYPES, and A13's own escapes came straight back by
// re-spelling the caller's value as a `bytes` parameter. The gate now reads X37's published provenance instead.
// The two assertions above are untouched by that - both shapes are still refused, now for the semantic reason -
// and the A13-3 block below adds the VM evidence that the round-14 admission of the `bytes`-typed target was a
// LIVE hole: the same 5 -> 999 takeover, through a proxy the round-14 gate called `bytecode-pinned`.

const IMPL_SCALAR = `pragma solidcash >=0.8.0;
contract E3Impl() {
    bigint counter;
    function increment() delegate { this.counter = this.counter + 1; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;

const IMPL_FOREIGN = IMPL_SCALAR
  .replace('E3Impl', 'E3ForeignImpl')
  .replace('this.counter = this.counter + 1;', 'this.counter = 999;');

/** E3's own admitted class, reused verbatim as the control for A13-1. */
const PROXY_BYTECODE_PINNED = `pragma solidcash >=0.8.0;
contract E3PinnedProxy(address impl) {
    bigint counter;
    function up(bytes input) external {
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/**
 * A13-1. The proxy commits an implementation locking bytecode in its own p2sh32 - the constructor argument
 * `pinned` is a real, live address that the function reads - but the DELEGATECALL TARGET is the caller's
 * `impl` parameter and nothing authorizes the caller. Under E3's own enumeration this is exactly the
 * `caller-chosen` class, which E3 measures as a complete state takeover and refuses by name.
 */
const PROXY_PINNED_BUT_CALLER_CHOSEN = `pragma solidcash >=0.8.0;
contract E3TrapProxy(address pinned) {
    bigint counter;
    function up(bytes input, address impl) external {
        require(pinned.length == 35);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/** E3's own caller-authorized class, reused verbatim as the control for A13-2. */
const PROXY_CALLER_AUTHORIZED = `pragma solidcash >=0.8.0;
contract E3AuthorizedProxy(pubkey owner) {
    bigint counter;
    function up(bytes input, address impl, sig s) external {
        require(checkSig(s, owner));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/**
 * A13-2. Identical shape to `PROXY_CALLER_AUTHORIZED` in every published field - one delegatecall edge, an
 * `address` parameter, a `sig` parameter, a `checkSig` - except the key the signature is checked against is
 * supplied by the same caller. The contract stores no authority at all: it has no constructor arguments.
 */
const PROXY_SELF_AUTHORIZED = `pragma solidcash >=0.8.0;
contract E3SelfAuthProxy() {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s) external {
        require(checkSig(s, pk));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

/**
 * A13-3 (round 16). The A13-1 takeover re-spelled: the caller's implementation arrives as `bytes` and is cast,
 * so the function publishes NO `address` parameter and round 14's type gate called this `bytecode-pinned`. The
 * constructor argument is a real, live implementation, exactly as in A13-1.
 */
const PROXY_BYTES_TARGET = `pragma solidcash >=0.8.0;
contract E3BytesTargetProxy(address impl) {
    bigint counter;
    function up(bytes input, bytes target) external {
        require(target.length == 35);
        address t = address(target);
        t.delegatecall(input);
        require(input.length > 0);
    }
}`;

/**
 * A13-3 GUARD CONTROL. Byte-identical published parameter types to `PROXY_BYTES_TARGET` - `bytes`, `bytes` -
 * and the same 35-byte require on `target`. One expression apart: the delegatecall reaches the CONSTRUCTOR
 * ARGUMENT. If this shape did not settle, or were refused by the gate, the A13-3 refusal would be credited to
 * the extra `bytes` parameter rather than to which expression the call targets.
 */
const PROXY_BYTES_UNUSED = PROXY_BYTES_TARGET
  .replace('E3BytesTargetProxy', 'E3BytesUnusedProxy')
  .replace('        address t = address(target);\n        t.delegatecall(input);', '        impl.delegatecall(input);');

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

const failingInput = (message: string): number | null => {
  const match = /(?:BCH-2026 preflight failed at input|error in evaluating input index) (\d+)/.exec(message);
  return match ? Number(match[1]) : null;
};

const expectPreflightRefusal = (message: string, input: number, reason: string): void => {
  expect([
    `layer3: BCH-2026 preflight failed at input ${input}: ${reason}`,
    `mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index ${input}: ${reason})`,
  ]).toContain(message);
  expect(failingInput(message)).toBe(input);
};

/** Every message the compiler prints while compiling one source, so a silent shape can be shown to be silent. */
let uniqueSourceCounter = 0;
const compilerWarnings = (source: string): string[] => {
  const messages: string[] = [];
  const original = console.log;
  // A trailing comment makes the source text unique, so `SOLIDC_COMPILE_CACHE` cannot replay a silent hit.
  uniqueSourceCounter += 1;
  const unique = `${source}\n// a13-warning-probe-${uniqueSourceCounter}`;
  // eslint-disable-next-line no-console
  console.log = (...args: unknown[]): void => { messages.push(args.join(' ')); };
  try { compileString(unique); } finally { console.log = original; }
  return messages;
};

const implArtifact = compileString(IMPL_SCALAR);
const foreignArtifact = compileString(IMPL_FOREIGN);
const pinnedProxyArtifact = compileString(PROXY_BYTECODE_PINNED);
const trapProxyArtifact = compileString(PROXY_PINNED_BUT_CALLER_CHOSEN);
const authorizedProxyArtifact = compileString(PROXY_CALLER_AUTHORIZED);
const selfAuthProxyArtifact = compileString(PROXY_SELF_AUTHORIZED);
const bytesTargetProxyArtifact = compileString(PROXY_BYTES_TARGET);
const bytesUnusedProxyArtifact = compileString(PROXY_BYTES_UNUSED);

describe('A13 review of E3: bytecode-pinned detection', () => {
  it('A13-1a: FIXED - the gate refuses the caller-chosen proxy by name, pin or no pin', () => {
    const provider = createLayer3SemanticTestProvider();
    const implementation = new Contract(implArtifact, [], { provider });
    const implementationLbc = binToHex(addressToLockScript(implementation.address));
    // The constructor argument is the honest implementation, so its bytes really are in the proxy's p2sh32.
    const proxy = new Contract(trapProxyArtifact, [hexToBin(implementationLbc)] as never[], { provider });
    expect(proxy.bytecode.toLowerCase()).toContain(implementationLbc.toLowerCase());
    // The substring test still says "pinned"; it is no longer allowed to answer the code-identity question,
    // because the proxy function publishes an `address` parameter the delegatecall may target instead.
    expect(() => layer3.classifyDelegateParticipant({
      proxy: { artifact: trapProxyArtifact, functionName: 'up', bytecode: proxy.bytecode },
      implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
    })).toThrow(/class 'pinned-but-caller-selected' is not admitted.*delegatecalls caller-supplied parameter 'impl'/s);

    // CONTROL, one field apart: the same proxy pair with no `address` parameter is still admitted.
    const honest = new Contract(pinnedProxyArtifact, [hexToBin(implementationLbc)] as never[], { provider });
    expect(layer3.classifyDelegateParticipant({
      proxy: { artifact: pinnedProxyArtifact, functionName: 'up', bytecode: honest.bytecode },
      implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
    }).id).toBe('bytecode-pinned/adjacent-proxy-block/scalar');
  });

  it('A13-1a2: the compiler names it caller-supplied, which the gate now agrees with', () => {
    // SEC-2's warning fires on this exact source. Round-13: the SDK gate disagreed. Round-14: it does not.
    expect(compilerWarnings(PROXY_PINNED_BUT_CALLER_CHOSEN).join('\n'))
      .toMatch(/issues delegatecall against 'impl', an unguarded caller-supplied parameter/);
  });

  it('A13-1b: and the VM settles a FOREIGN implementation rewriting that proxy state', async () => {
    const provider = createLayer3SemanticTestProvider();
    const honest = await deploy(provider, implArtifact, [], { counter: 0n });
    const foreign = await deploy(provider, foreignArtifact, [], { counter: 0n });
    // The proxy's p2sh32 commits to the HONEST implementation; the caller supplies the FOREIGN one.
    const proxy = await deploy(
      provider, trapProxyArtifact, [addressToLockScript(honest.contract.address)], { counter: 5n },
    );
    const tx = await new StatefulTransactionBuilder({
      provider,
      stateLayout: trapProxyArtifact.stateLayout!,
      categoryId: proxy.categoryId,
      masterUtxo: {
        ...proxy.master,
        unlocker: (proxy.contract.unlock as any).up(
          selectorOf(foreignArtifact, 'increment'), addressToLockScript(foreign.contract.address), 2n,
        ),
      },
      dataNftUtxos: proxy.dataNfts.map((nft) => ({
        ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
      })),
      externalCallUtxoGroups: [delegateGroup(foreignArtifact, foreign, 'increment', [0n], 2)],
    }).setState('counter', 999n).send();
    expect(stateOf(tx, proxy.categoryId, trapProxyArtifact.stateLayout!).counter).toBe(999n);
  }, 240_000);

  it('A13-1c: CONTROL - the real bytecode-pinned proxy refuses the same substitution at input 0', async () => {
    const provider = createLayer3SemanticTestProvider();
    const honest = await deploy(provider, implArtifact, [], { counter: 0n });
    const foreign = await deploy(provider, foreignArtifact, [], { counter: 0n });
    const proxy = await deploy(
      provider, pinnedProxyArtifact, [addressToLockScript(honest.contract.address)], { counter: 5n },
    );
    const message = await outcome(new StatefulTransactionBuilder({
      provider,
      stateLayout: pinnedProxyArtifact.stateLayout!,
      categoryId: proxy.categoryId,
      masterUtxo: {
        ...proxy.master,
        unlocker: (proxy.contract.unlock as any).up(selectorOf(foreignArtifact, 'increment'), 2n),
      },
      dataNftUtxos: proxy.dataNfts.map((nft) => ({
        ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
      })),
      externalCallUtxoGroups: [delegateGroup(foreignArtifact, foreign, 'increment', [0n], 2)],
    }).setState('counter', 999n).send());
    expectPreflightRefusal(message, 0, 'Program failed an OP_VERIFY operation.');
  }, 240_000);
});

describe('A13 review of E3: caller-authorized authority', () => {
  it('A13-2a: FIXED - the gate refuses the self-authorizing proxy by name', () => {
    const provider = createLayer3SemanticTestProvider();
    const implementation = new Contract(implArtifact, [], { provider });
    const implementationLbc = binToHex(addressToLockScript(implementation.address));
    const proxy = new Contract(selfAuthProxyArtifact, [] as never[], { provider });
    // A `sig` parameter is no longer enough: the gate asks whether the key it could be checked against is one
    // the CALLER supplies, and refuses when it is (or when the proxy commits no key at all).
    expect(() => layer3.classifyDelegateParticipant({
      proxy: { artifact: selfAuthProxyArtifact, functionName: 'up', bytecode: proxy.bytecode },
      implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
    })).toThrow(/class 'self-authorized' is not admitted.*checked against caller-supplied parameter 'pk'/s);

    // CONTROL, one field apart: the same shape whose key is a CONSTRUCTOR argument is still admitted.
    const honest = new Contract(authorizedProxyArtifact, [alicePub] as never[], { provider });
    expect(layer3.classifyDelegateParticipant({
      proxy: { artifact: authorizedProxyArtifact, functionName: 'up', bytecode: honest.bytecode },
      implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
    }).id).toBe('caller-authorized/adjacent-proxy-block/scalar');
  });

  it('A13-2a2: FIXED - the compiler now asks WHICH key the checkSig checks, and warns', () => {
    // ROUND 15 (SEC-12). `hasSignatureGuard` matched any checkSig/checkMultiSig/checkDataSig node in the body
    // without asking which key it was checked against, so this shape compiled with only the generic low-level
    // -call notice. It now names the parameter, exactly as the caller-chosen shape does.
    const messages = compilerWarnings(PROXY_SELF_AUTHORIZED);
    expect(messages.join('\n')).toMatch(/issues delegatecall against 'impl', an unguarded caller-supplied parameter/);
    // The control DOES warn, and differs only in where the checked key comes from.
    expect(compilerWarnings(PROXY_PINNED_BUT_CALLER_CHOSEN).join('\n'))
      .toMatch(/unguarded caller-supplied parameter/);
    // GUARD CONTROL, one token apart from PROXY_SELF_AUTHORIZED: the same shape whose key is a CONSTRUCTOR
    // argument is still silent, so the new warning is credited to the key's source and not to the `sig`
    // parameter, the `address` parameter, or the delegatecall itself - PROXY_CALLER_AUTHORIZED has all three.
    expect(compilerWarnings(PROXY_CALLER_AUTHORIZED)
      .filter((message) => !message.includes('Low-level .delegatecall() used'))).toEqual([]);
  });

  it('A13-2b: and a STRANGER selects a foreign implementation, which settles', async () => {
    const provider = createLayer3SemanticTestProvider();
    const foreign = await deploy(provider, foreignArtifact, [], { counter: 0n });
    // Owner is Alice. Bob signs with Bob's own key and supplies it as the parameter.
    const proxy = await deploy(provider, selfAuthProxyArtifact, [], { counter: 5n });
    const tx = await new StatefulTransactionBuilder({
      provider,
      stateLayout: selfAuthProxyArtifact.stateLayout!,
      categoryId: proxy.categoryId,
      masterUtxo: {
        ...proxy.master,
        unlocker: (proxy.contract.unlock as any).up(
          selectorOf(foreignArtifact, 'increment'),
          addressToLockScript(foreign.contract.address),
          bobPub,
          new SignatureTemplate(bobPriv),
          2n,
        ),
      },
      dataNftUtxos: proxy.dataNfts.map((nft) => ({
        ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
      })),
      externalCallUtxoGroups: [delegateGroup(foreignArtifact, foreign, 'increment', [0n], 2)],
    }).setState('counter', 999n).send();
    expect(stateOf(tx, proxy.categoryId, selfAuthProxyArtifact.stateLayout!).counter).toBe(999n);
  }, 240_000);

  it('A13-2c: CONTROL - the real caller-authorized proxy refuses the stranger at input 0', async () => {
    const provider = createLayer3SemanticTestProvider();
    const foreign = await deploy(provider, foreignArtifact, [], { counter: 0n });
    const proxy = await deploy(provider, authorizedProxyArtifact, [alicePub], { counter: 5n });
    const message = await outcome(new StatefulTransactionBuilder({
      provider,
      stateLayout: authorizedProxyArtifact.stateLayout!,
      categoryId: proxy.categoryId,
      masterUtxo: {
        ...proxy.master,
        unlocker: (proxy.contract.unlock as any).up(
          selectorOf(foreignArtifact, 'increment'),
          addressToLockScript(foreign.contract.address),
          new SignatureTemplate(bobPriv),
          2n,
        ),
      },
      dataNftUtxos: proxy.dataNfts.map((nft) => ({
        ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
      })),
      externalCallUtxoGroups: [delegateGroup(foreignArtifact, foreign, 'increment', [0n], 2)],
    }).setState('counter', 999n).send());
    expectPreflightRefusal(
      message,
      0,
      'Program failed a signature verification with a non-null signature (violating the "NULLFAIL" rule). '
        + 'Algorithm used: Schnorr.',
    );
  }, 240_000);
});

describe('A13-3 (round 16): the `bytes`-typed re-spelling of A13-1', () => {
  it('A13-3a: the gate refuses it, on the published target provenance rather than the parameter type', () => {
    const provider = createLayer3SemanticTestProvider();
    const implementation = new Contract(implArtifact, [], { provider });
    const implementationLbc = binToHex(addressToLockScript(implementation.address));
    const proxy = new Contract(bytesTargetProxyArtifact, [hexToBin(implementationLbc)] as never[], { provider });
    // The type gate saw nothing to refuse: no `address` parameter at all, and the pin really is in the bytecode.
    expect(bytesTargetProxyArtifact.abi.find((entry) => entry.name === 'up')!.inputs
      .filter((entry) => !entry.name.startsWith('__internal__')).map((entry) => entry.type))
      .toEqual(['bytes', 'bytes']);
    expect(proxy.bytecode.toLowerCase()).toContain(implementationLbc.toLowerCase());
    expect(() => layer3.classifyDelegateParticipant({
      proxy: { artifact: bytesTargetProxyArtifact, functionName: 'up', bytecode: proxy.bytecode },
      implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
    })).toThrow(/class 'pinned-but-caller-selected' is not admitted.*caller-supplied parameter 'target'/s);

    // GUARD CONTROL, same published types, same containment, one expression apart: still admitted.
    const honest = new Contract(bytesUnusedProxyArtifact, [hexToBin(implementationLbc)] as never[], { provider });
    expect(layer3.classifyDelegateParticipant({
      proxy: { artifact: bytesUnusedProxyArtifact, functionName: 'up', bytecode: honest.bytecode },
      implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
    }).id).toBe('bytecode-pinned/adjacent-proxy-block/scalar');
  });

  it('A13-3b: and the VM settles a FOREIGN implementation rewriting that proxy state', async () => {
    const provider = createLayer3SemanticTestProvider();
    const honest = await deploy(provider, implArtifact, [], { counter: 0n });
    const foreign = await deploy(provider, foreignArtifact, [], { counter: 0n });
    // p2sh32 committed to the HONEST implementation; the caller hands the FOREIGN one in as `bytes`.
    const proxy = await deploy(
      provider, bytesTargetProxyArtifact, [addressToLockScript(honest.contract.address)], { counter: 5n },
    );
    const tx = await new StatefulTransactionBuilder({
      provider,
      stateLayout: bytesTargetProxyArtifact.stateLayout!,
      categoryId: proxy.categoryId,
      masterUtxo: {
        ...proxy.master,
        unlocker: (proxy.contract.unlock as any).up(
          selectorOf(foreignArtifact, 'increment'), addressToLockScript(foreign.contract.address), 2n,
        ),
      },
      dataNftUtxos: proxy.dataNfts.map((nft) => ({
        ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
      })),
      externalCallUtxoGroups: [delegateGroup(foreignArtifact, foreign, 'increment', [0n], 2)],
    }).setState('counter', 999n).send();
    expect(stateOf(tx, proxy.categoryId, bytesTargetProxyArtifact.stateLayout!).counter).toBe(999n);
  }, 240_000);

  it('A13-3c: GUARD CONTROL - the same-typed honest proxy settles, and refuses the substitution at input 0',
    async () => {
      const provider = createLayer3SemanticTestProvider();
      const honestImpl = await deploy(provider, implArtifact, [], { counter: 0n });
      const honestLbc = addressToLockScript(honestImpl.contract.address);
      const proxy = await deploy(provider, bytesUnusedProxyArtifact, [honestLbc], { counter: 5n });
      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: bytesUnusedProxyArtifact.stateLayout!,
        categoryId: proxy.categoryId,
        masterUtxo: {
          ...proxy.master,
          unlocker: (proxy.contract.unlock as any).up(selectorOf(implArtifact, 'increment'), honestLbc, 2n),
        },
        dataNftUtxos: proxy.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
        })),
        externalCallUtxoGroups: [delegateGroup(implArtifact, honestImpl, 'increment', [0n], 2)],
      }).setState('counter', 6n).send();
      expect(stateOf(tx, proxy.categoryId, bytesUnusedProxyArtifact.stateLayout!).counter).toBe(6n);

      const hostileProvider = createLayer3SemanticTestProvider();
      const pinned = await deploy(hostileProvider, implArtifact, [], { counter: 0n });
      const foreign = await deploy(hostileProvider, foreignArtifact, [], { counter: 0n });
      const hostileProxy = await deploy(
        hostileProvider, bytesUnusedProxyArtifact, [addressToLockScript(pinned.contract.address)], { counter: 5n },
      );
      const message = await outcome(new StatefulTransactionBuilder({
        provider: hostileProvider,
        stateLayout: bytesUnusedProxyArtifact.stateLayout!,
        categoryId: hostileProxy.categoryId,
        masterUtxo: {
          ...hostileProxy.master,
          unlocker: (hostileProxy.contract.unlock as any).up(
            selectorOf(foreignArtifact, 'increment'), addressToLockScript(foreign.contract.address), 2n,
          ),
        },
        dataNftUtxos: hostileProxy.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(hostileProxy.contract, 0, hostileProxy.categoryId),
        })),
        externalCallUtxoGroups: [delegateGroup(foreignArtifact, foreign, 'increment', [0n], 2)],
      }).setState('counter', 999n).send());
      expectPreflightRefusal(message, 0, 'Program failed an OP_VERIFY operation.');
    }, 240_000);
});

describe('A13 review of E3: is the gate wired to anything?', () => {
  /** Every .ts file under packages/solidcash/src, so "nothing calls it" is measured rather than asserted. */
  const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory()
      ? sourceFiles(join(directory, entry.name))
      : (entry.name.endsWith('.ts') ? [join(directory, entry.name)] : [])));

  // ROUND 14: still true, now as a MEASURED decision. Instrumenting `withDelegatecall` to classify every pair
  // it receives and running the three suites that use it gave 11 calls over 6 distinct pairs, 11/11 refused -
  // so wiring it would break every settling delegatecall send in the suite. See the round-14 block in
  // Layer3DelegateClassesE3.test.ts.
  it('A13-2d: no SDK source calls the gate - it is opt-in, and `withDelegatecall` never consults it', () => {
    const root = new URL('../../src', import.meta.url).pathname;
    const callers = sourceFiles(root).filter((file) => {
      if (file.endsWith(`layer3${'/'}delegate.ts`)) return false; // the definition itself
      const text = readFileSync(file, 'utf8');
      return /classifyDelegateParticipant|assertAdmittedDelegateClass|ADMITTED_DELEGATE_PARTICIPANT_CLASSES/
        .test(text);
    }).map((file) => file.slice(root.length + 1));
    // NOTHING in the SDK names the gate. It reaches users only through the barrel's `export * from
    // './delegate.js'`, which is publication, not enforcement.
    expect(callers).toEqual([]);
    expect(readFileSync(join(root, 'layer3/index.ts'), 'utf8')).toContain("export * from './delegate.js'");

    // And the builder entry point a delegate participant actually goes through carries no class check.
    const builder = readFileSync(join(root, 'stateful/StatefulContract.ts'), 'utf8');
    expect(builder).toContain('withDelegatecall(');
    expect(builder).not.toMatch(/classifyDelegateParticipant|assertAdmittedDelegateClass/);
  });
});
