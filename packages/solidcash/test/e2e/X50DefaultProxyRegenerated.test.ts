import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import type { Artifact } from '@solidcash/utils';
import {
  Contract,
  Signer,
} from '../../src/index.js';
import {
  ContractFactory,
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { DEFAULT_PROXY_SOURCE, defaultProxyArtifact } from '../../src/stateful/defaultProxyArtifact.js';
import { ProxyContract } from '../../src/stateful/upgrades.js';
import { classifyDelegateParticipant } from '../../src/message-bus/delegate.js';
import { addressToLockScript } from '../../src/utils.js';
import { getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import { alicePriv } from '../fixture/vars.js';
import {
  createFeeFunder, createTestProvider, expectScriptRejection, getTxOutputs,
} from '../test-util.js';

/**
 * X50 - the SDK's shipped `defaultProxyArtifact.ts` was stale in two independent ways, and this file is the
 * evidence that regenerating it fixes both without being credited to the wrong mechanism.
 *
 * DEFECT 1, metadata. Its delegatecall row was `{callMode:'delegatecall'}` with no `target`. Since X43 the
 * delegate class gate reads published provenance and falls closed on an absent field, so the SDK's own built-in
 * proxy was refused as 'unpublished-target-provenance'.
 *
 * DEFECT 2, bytecode. The checked-in `bytecode` had been hand-edited: the own-category mutable NFT conservation
 * was relaxed from strict `in == out` (OP_0 OP_NUMEQUALVERIFY) to `out >= in` (OP_0 OP_LESSTHANOREQUAL
 * OP_VERIFY) so a delegate could mint entry nodes. The edit reached `bytecode` only - `debug.bytecode` and
 * `fingerprint` still described the unedited compile - so the file's own three fields disagreed.
 *
 * The relaxation is DROPPED, not reapplied. `out >= in` admits net creation of own-category MUTABLE NFTs
 * generally, not just collection nodes. Compiler-produced delegates now independently pin the exact proxy state
 * output population, so the hostile row below also proves that relaxing only the proxy cannot bypass the newer
 * implementation-side defense.
 */

const DELEGATE_IMPL = `pragma solidcash >=0.8.0;
  contract X50Impl() {
    bigint counter;
    function increment() delegate { this.counter = this.counter + 1; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  }`;

// The own-category conservation still ends with a compare against remaining == 0. Production outlining no
// longer folds that OP_0 into a shared helper (window 12/10 leaves the output loop inline), so the A/B pair
// is exactly one opcode apart at the tail: `== 0` against `<= 0`.
const STRICT_TAIL = 'OP_0 OP_NUMEQUALVERIFY OP_2DROP OP_DROP OP_1';
const RELAXED_TAIL = 'OP_0 OP_LESSTHANOREQUAL OP_VERIFY OP_2DROP OP_DROP OP_1';
/** A VALID pushdata state commitment (OP_16 -> counter 16), same one byte as the genuine one after an
 *  increment (OP_6 -> 6). Only position tells the two apart. */
const FORGED_COMMITMENT = '60';

const raw = (builder: any): string => binToHex(encodeTransaction(builder.buildLibauthTransaction()));

/** Byte length of an ASM script: one byte per opcode, pushdata prefix + payload for a data token. */
function asmByteLength(asm: string): number {
  return asm.split(' ').reduce((total, token) => {
    if (token.startsWith('OP_')) return total + 1;
    const length = token.length / 2;
    if (length <= 75) return total + 1 + length;
    return total + (length <= 255 ? 2 : 3) + length;
  }, 0);
}

/**
 * What `upgrades.deployProxy` does internally for the built-in proxy: graft the implementation's state layout
 * onto the layout-independent forwarder. Reproduced here so the A/B pair below can be deployed from two
 * artifacts that differ in exactly one opcode.
 */
function graft(proxyArtifact: Artifact, impl: Artifact): Artifact {
  const dataNftCount = impl.stateLayout?.dataNftCount ?? 0;
  const requiredNftIndices = Array.from({ length: dataNftCount }, (_, index) => index);
  return {
    ...proxyArtifact,
    abi: proxyArtifact.abi.map((entry) => (entry.name !== '__forward' ? entry : {
      ...entry,
      requiredNftIndices,
      blockLayout: {
        blockSize: 1 + dataNftCount,
        slots: [
          { kind: 'master' as const, offset: 0 },
          ...requiredNftIndices.map((nftIndex) => ({ kind: 'dataNft' as const, offset: nftIndex + 1, nftIndex })),
        ],
      },
    })),
    stateLayout: { ...impl.stateLayout, constructorInputs: proxyArtifact.stateLayout?.constructorInputs },
  } as Artifact;
}

/** The shipped forwarder with its conservation put back to the relaxed form the stale artifact carried. */
function relaxedCopy(): Artifact {
  expect(defaultProxyArtifact.bytecode.endsWith(STRICT_TAIL)).toBe(true);
  return {
    ...defaultProxyArtifact,
    bytecode: defaultProxyArtifact.bytecode.slice(0, -STRICT_TAIL.length) + RELAXED_TAIL,
  } as Artifact;
}

async function fundedSigner(): Promise<{ signer: Signer; provider: any }> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const byte of ['a1', 'b2', 'c3', 'd4']) {
    await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return { signer, provider };
}

/**
 * Deploy an implementation plus a proxy built from `proxyArtifact`, by hand, on the same path `deployProxy`
 * takes for the built-in proxy (graft the layout, bake the implementation locking bytecode).
 */
async function deployPair(
  proxyArtifact: Artifact, signer: Signer,
): Promise<{ handle: any; categoryId: string; dataNftAddress: string }> {
  const implArtifact = compileString(DELEGATE_IMPL);
  const implementation = await getContractFactory(implArtifact, signer).deploy({ logicalNonce: false });
  const implLbc = addressToLockScript(implementation.address);
  const graftedProxy = graft(proxyArtifact, implArtifact);
  // The forward pins its delegate to `activeInputIndex + __proxyBlockSize`, so the constructor argument is the
  // grafted block the SDK lays the implementation after.
  const proxyBlockSize = BigInt(
    graftedProxy.abi.find((entry) => entry.name === '__forward')?.blockLayout?.blockSize ?? 1,
  );
  const proxy = await new ContractFactory(graftedProxy, signer)
    .deploy(implLbc, proxyBlockSize, { initialState: { counter: 5n }, logicalNonce: false });
  return {
    handle: new ProxyContract(
      proxy, implementation as any, { name: '__forward', mode: 'baked' }, () => [], signer,
    ),
    categoryId: (proxy as any).categoryId!,
    dataNftAddress: getDataNftAddress((proxy as any).inner, (proxy as any).categoryId!),
  };
}

describe('X50: the shipped default proxy is a compile of its own source', () => {
  /**
   * THE REGENERATION INVARIANT, and the one assertion that would have caught both defects at once. Every field
   * the SDK loads must be what `DEFAULT_PROXY_SOURCE` compiles to today, including the two the hand edit did
   * not reach.
   */
  it('matches a fresh compile field for field, including debug.bytecode and fingerprint', () => {
    // Same options as scripts/regenerate-default-proxy.ts: no state fields, but still a stateful covenant.
    const fresh = compileString(DEFAULT_PROXY_SOURCE, { forceStateful: true, suppressWarnings: true });
    delete (fresh as any).updatedAt;
    expect(defaultProxyArtifact.bytecode).toBe(fresh.bytecode);
    expect(defaultProxyArtifact.debug!.bytecode).toBe(fresh.debug!.bytecode);
    expect(defaultProxyArtifact.fingerprint).toBe(fresh.fingerprint);
    expect(JSON.parse(JSON.stringify(defaultProxyArtifact))).toEqual(JSON.parse(JSON.stringify(fresh)));

    // The two fields the hand edit desynchronised agree. The forwarder is 362 bytes: 350 before the
    // delegate-position pin, plus the ten-byte pin and the compiler's own stack adaptation to the extra
    // constructor input. bytecode, debug.bytecode, and fingerprint still come from one compile.
    expect(asmByteLength(defaultProxyArtifact.bytecode)).toBe(362);
    expect(defaultProxyArtifact.debug!.bytecode.length / 2).toBe(362);
    expect(defaultProxyArtifact.bytecode.endsWith(STRICT_TAIL)).toBe(true);
  });

  // DEFECT 1, the published field itself.
  it('publishes the delegatecall target provenance X37 added', () => {
    const forward = defaultProxyArtifact.abi.find((entry) => entry.name === '__forward')!;
    expect(forward.lowLevelCalls).toEqual([
      {
        callMode: 'delegatecall', dataParamIndex: 0, occurrence: 'once',
        target: { kind: 'constructorArg', name: 'implementation' },
      },
    ]);
  });

  /**
   * DEFECT 1 AT THE GATE, which is where it was measured. The shipped proxy, instantiated with the real
   * implementation locking bytecode exactly as `deployProxy` bakes it, is now classified instead of refused.
   *
   * GUARD NEGATIVE CONTROL: the same call with `target` stripped back off still refuses as
   * 'unpublished-target-provenance'. So the admission is credited to the published field and not to the
   * bytecode change that landed in the same commit.
   */
  it('is no longer refused as unpublished-target-provenance', async () => {
    const { provider } = await fundedSigner();
    const implArtifact = compileString(DELEGATE_IMPL);
    const implementationLbc = binToHex(addressToLockScript(new Contract(implArtifact, [], { provider }).address));
    const grafted = graft(defaultProxyArtifact, implArtifact);
    const blockSize = BigInt(
      grafted.abi.find((entry) => entry.name === '__forward')?.blockLayout?.blockSize ?? 1,
    );
    const proxy = new Contract(grafted, [hexToBin(implementationLbc), blockSize] as never[], { provider });

    const classified = classifyDelegateParticipant({
      proxy: { artifact: grafted, functionName: '__forward', bytecode: proxy.bytecode },
      implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
    });
    expect(classified.id).toBe('bytecode-pinned/adjacent-proxy-block/scalar');

    const preX37 = {
      ...grafted,
      abi: grafted.abi.map((entry) => (entry.name !== '__forward' ? entry : {
        ...entry,
        lowLevelCalls: entry.lowLevelCalls?.map((call) => {
          const withoutTarget = { ...call };
          delete withoutTarget.target;
          return withoutTarget;
        }),
      })),
    } as Artifact;
    expect(() => classifyDelegateParticipant({
      proxy: { artifact: preX37, functionName: '__forward', bytecode: proxy.bytecode },
      implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
    })).toThrow(/class 'unpublished-target-provenance' is not admitted/);
  });

  // HONEST POSITIVE CONTROL. The regenerated proxy still forwards a delegated state write on the VM.
  it('still settles a delegated state write through the shipped path', async () => {
    const { signer } = await fundedSigner();
    const implArtifact = compileString(DELEGATE_IMPL);
    const proxy: any = await upgrades.deployProxy(getContractFactory(implArtifact, signer), { counter: 5n });
    const tx = await proxy.increment().send();
    const state = getTxOutputs(tx).find(
      (output: any) => output.token?.nft?.capability === 'mutable'
        && output.token?.category === proxy.proxy.categoryId,
    );
    expect(state).toBeDefined();
    expect((await (proxy.proxy as any).getState()).counter).toBe(6n);
  }, 300_000);

  /**
   * HOSTILE, pinned to an input index. Append one own-category MUTABLE NFT beside an honest delegated
   * `increment()`. It is not a collection node and sits at no slot the delegate pins, so nothing in the
   * implementation covenant looks at it - the proxy's own conservation is the only thing that can refuse it,
   * and it does, at input 0.
   *
   * Use the test-local `graft()`/`deployPair` rather than `upgrades.deployProxy`. Certified delegates publish
   * `delegateProxyStateOutputCountPinned`, and `graftDefaultProxy` then drops the shipped `OP_NUMEQUALVERIFY`
   * so mapping-growing delegates can insert. That derived variant is supposed to fail at the implementation
   * (input 2); this row is the conservation of the SHIPPED bytecode, which is still strict.
   */
  it('refuses an appended own-category mutable NFT at the proxy input', async () => {
    const { signer, provider } = await fundedSigner();
    const { handle, categoryId, dataNftAddress } = await deployPair(defaultProxyArtifact, signer);

    const builder: any = await handle.forward('increment', []).build();
    const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
    builder.addInput(utxo, unlocker);
    // At the proxy's own DATA NFT covenant address: a second state NFT of the proxy category, in the place a
    // reader addressing state by position looks.
    builder.addOutput({
      to: dataNftAddress,
      amount: 1200n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: FORGED_COMMITMENT } },
    });
    const outcome = await provider.sendRawTransaction(raw(builder))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(outcome, 0);
  }, 300_000);

  /**
   * A/B GUARD NEGATIVE CONTROL, and the reason the refusal above is credited to the conservation rather than to
   * the +15 bytes of data-NFT value preservation that landed in the same regenerate. The identical transaction
   * against a proxy identical in every byte EXCEPT the comparison tail reaches the certified implementation,
   * whose exact proxy-state-output pin must still reject the appended NFT.
   */
  it('still refuses the append in the implementation when only the proxy conservation is relaxed', async () => {
    const { signer, provider } = await fundedSigner();
    const relaxed = relaxedCopy();
    // Identical up to the tail, and one byte longer, so nothing else can explain a difference in outcome.
    expect(relaxed.bytecode.slice(0, -RELAXED_TAIL.length))
      .toBe(defaultProxyArtifact.bytecode.slice(0, -STRICT_TAIL.length));
    expect(asmByteLength(relaxed.bytecode)).toBe(asmByteLength(defaultProxyArtifact.bytecode) + 1);

    const { handle, categoryId, dataNftAddress } = await deployPair(relaxed, signer);
    const builder: any = await handle.forward('increment', []).build();
    const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
    builder.addInput(utxo, unlocker);
    builder.addOutput({
      to: dataNftAddress,
      amount: 1200n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: FORGED_COMMITMENT } },
    });
    const outcome = await provider.sendRawTransaction(raw(builder))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(outcome, 2);
  }, 300_000);
});
