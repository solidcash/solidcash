import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import {
  Contract, Signer, StatefulContract, SortedList, encodeEntryCommitment, getContractFactory,
  getEntryNftAddress, slotValueToBytes, upgrades,
} from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { SignatureTemplate } from '../../src/index.js';

/**
 * X11 follow-on, and a LIVE forgery when it was found.
 *
 * `emitSortedValueUpsert` pins the exact number of outputs sitting at the collection's entry address
 * (`pinsCollectionOutputCount` -> `emitVerifySortedOutputCountRaw`). Without it only the pinned INDICES are
 * checked, so the same transaction can also mint a node for a key that was never written - which later reads
 * authenticate as genuine. `delegate` functions were excluded from that pin, recorded as guarding an
 * unreachable shape.
 *
 * The shape is reachable: a delegated C2 write settles. With the pin off, the only thing bounding the
 * collection's output cardinality on that route was the PROXY's own-category mutable NFT conservation - and the
 * shipped `defaultProxyArtifact` carries the RELAXED form of it (`OP_0 OP_LESSTHANOREQUAL OP_VERIFY`, outputs
 * >= inputs) rather than the strict `OP_0 OP_NUMEQUALVERIFY` the current compiler emits. So on the default
 * upgrades proxy nothing refused an appended node at all.
 *
 * MEASURED LIVE before the fix: appending one extra own-category mutable NFT at the collection's entry address
 * beside a genuine delegated `users[msg.sender] = 5` was ACCEPTED, and the contract's own paginated reader then
 * returned `[5n, 99n]` - the fabricated value read back beside the genuine one. The pin is index-free (it counts
 * outputs AT the entry address, it does not name positions), so it holds identically inside a delegate.
 */
const MAP_IMPL = `pragma solidcash >=0.8.0;
contract MapImpl() {
  int count;
  mapping(address => int) users;
  function initialize() delegate { this.count = 0; }
  function register(int v) delegate { users[msg.sender] = v; this.count = this.count + 1; }
}`;

/** GUARD: the same write on an ORDINARY contract. Its pin already existed and must be unchanged. */
const PLAIN_MAP = `pragma solidcash >=0.8.0;
contract PlainMap() {
  mapping(bigint => bigint) users;
  function register(bigint k, bigint v, pubkey pk, sig s) { require(checkSig(s, pk)); users[k] = v; }
}`;

const FORGED_SLOT = new Uint8Array(32).fill(0x77);
const FORGED_VALUE = new Uint8Array([0x63]); // 99
const raw = (builder: any): string => binToHex(encodeTransaction(builder.buildLibauthTransaction()));

async function fundedSigner(): Promise<{ signer: Signer; provider: any }> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const byte of ['a1', 'b2', 'c3', 'd4', 'f6', '07']) {
    await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return { signer, provider };
}

describe('X11 follow-on: collection output-count pin inside a delegate', () => {
  // HONEST POSITIVE CONTROL. The pin must not refuse the two outputs an honest insert produces (the re-pointed
  // predecessor and the new node), on the very route that carries it.
  it('still settles the delegated insert it now bounds', async () => {
    const { signer, provider } = await fundedSigner();
    const implArtifact = compileString(MAP_IMPL);
    const proxy: any = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    await proxy.register(5n).send();
    expect(await proxy.getUsers(0, 0)).toEqual([5n]);
    expect(await proxy.users(signer.getAddress())).toBe(5n);
    const proxyContract = new Contract(proxy.proxy.inner.artifact, proxy.proxy.inner.constructorArgs ?? [], { provider });
    const salted = proxyContract.category ? proxyContract : proxyContract.withCategory(hexToBin(proxy.proxy.categoryId!));
    const address = getEntryNftAddress(salted, proxy.proxy.categoryId!, 'users');
    // HEAD plus exactly one node: nothing extra was minted by the honest path either.
    expect(SortedList.fromUtxos(await provider.getUtxos(address)).all.length).toBe(2);
  }, 300_000);

  /**
   * HOSTILE, pinned to an index. Append one fabricated node for a key nobody wrote. It is refused at input 2 -
   * the delegate IMPLEMENTATION's own covenant, which is where the pin lives, not the proxy's.
   */
  it('refuses a fabricated node appended beside a genuine delegated write', async () => {
    const { signer, provider } = await fundedSigner();
    const implArtifact = compileString(MAP_IMPL);
    const proxy: any = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    const categoryId = proxy.proxy.categoryId!;
    const proxyContract = new Contract(proxy.proxy.inner.artifact, proxy.proxy.inner.constructorArgs ?? [], { provider });
    const salted = proxyContract.category ? proxyContract : proxyContract.withCategory(hexToBin(categoryId));
    const address = getEntryNftAddress(salted, categoryId, 'users');

    const builder: any = await proxy.register(5n).build();
    const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
    builder.addInput(utxo, unlocker);
    builder.addOutput({
      to: address,
      amount: 1200n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(FORGED_SLOT, slotValueToBytes(0n), FORGED_VALUE)),
        },
      },
    });
    const outcome = await provider.sendRawTransaction(raw(builder))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).toContain('error in evaluating input index 2');
    // Nothing landed, so the reader cannot see the fabricated value either.
    expect(SortedList.fromUtxos(await provider.getUtxos(address)).find(FORGED_SLOT)).toBeUndefined();
  }, 300_000);

  /**
   * GUARD NEGATIVE CONTROL. The identical append against an ORDINARY (non-delegate) C2 write was ALREADY
   * refused - that pin has been there. If this change had done nothing and some unrelated check were doing the
   * work above, this row would be indistinguishable from it; it is here so the delegate row is credited to the
   * delegate pin and not to the pre-existing one.
   */
  it('was already refusing the same append on an ordinary contract', async () => {
    const provider = createTestProvider();
    const artifact = compileString(PLAIN_MAP);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    const salted = contract.withCategory(hexToBin(categoryId));
    const address = getEntryNftAddress(salted, categoryId, 'users');
    const sc = StatefulContract.withCategory(contract, categoryId);
    const builder: any = await (sc as any)
      .register(30n, 100n, alicePub, new SignatureTemplate(alicePriv)).build();
    const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
    builder.addInput(utxo, unlocker);
    builder.addOutput({
      to: address,
      amount: 1200n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(FORGED_SLOT, slotValueToBytes(0n), FORGED_VALUE)),
        },
      },
    });
    const outcome = await provider.sendRawTransaction(raw(builder))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).toContain('error in evaluating input index 0');
  }, 300_000);
});
