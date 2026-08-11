import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  hexToBin, binToHex, bigIntToVmNumber, vmNumberToBigInt, encodeTransaction,
} from '@bitauth/libauth';
import {
  Contract, StatefulContract, getEntryNftAddress, encodeEntryCommitment, slotValueToBytes,
  keyToSlot, SortedList,
} from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X11 - a `delegate` function performing a vmap sorted-linked-list mapping write.
 *
 * The class was recorded as having no settling instance. That is stale: a delegated vmap write settles. What had
 * no settling instance is this shape - a delegated write against a proxy that owns NO data NFTs of its own -
 * and the split between UPDATE and INSERT below is the finding.
 *
 *  - UPDATE settles here now. The compiler side was already correct: the delegate resolves the entry
 *    input/output through `OP_INPUTINDEX + offset` (implementation-relative) while the entry ADDRESS and
 *    category come from the proxy master, so the write lands in the proxy's collection. What blocked it was in
 *    the SDK: `hasNothingToDerive` read `abiFunction.entryAccesses`, and a delegatecall forwarder publishes none
 *    of its own, so a proxy with no data NFTs / emits / transfers looked like it had nothing to derive at all.
 *    Derivation was skipped outright, the entry output kept its INPUT commitment, and the implementation
 *    covenant rejected its own transaction. It now reads the ROUTED accesses. (The default-proxy case dodged
 *    this only because that proxy has a data NFT, which made `requiredNftIndices` non-empty.)
 *
 *  - INSERT is refused here, and by the PROXY, not by the delegate. An insert mints one new entry node, so the
 *    transaction's own-category mutable (0x01) NFT count rises by one, and a proxy carrying
 *    `emitOwnCategoryMutableNftConservation` (C1 full-state authority) rejects at input 0 while the
 *    implementation covenant accepts the same transaction. The boundary is the PROXY's bytecode, which is why
 *    nothing is refused ahead of time here.
 *
 *    That boundary used to be drawn only here, because the shipped `defaultProxyArtifact` ended
 *    `... OP_0 OP_LESSTHANOREQUAL OP_VERIFY` - the RELAXED conservation (outputs >= inputs) - where a fresh
 *    compile of its own source ends `... OP_0 OP_NUMEQUALVERIFY` (159 bytes checked in against 173 fresh). X50
 *    regenerated that file, so the shipped proxy conserves too and the delegated INSERT is refused there as
 *    well (UpgradesDeployProxy.test.ts, 'refuses a delegated vmap mapping INSERT at the proxy').
 */
const LIB = `pragma solidcash >=0.8.0;
library MapLib {
  mapping(bigint => bigint) bal;
  function setBal(bigint k, bigint v) public { this.bal[k] = v; }
}`;

const PROXY = `pragma solidcash >=0.8.0;
contract MapProxy() {
  mapping(bigint => bigint) bal;
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  fallback(bytes input) external {
    address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;

const ZERO = slotValueToBytes(0n);
const SLOT_30 = keyToSlot(bigIntToVmNumber(30n));

interface Fixture {
  provider: any;
  proxySc: StatefulContract;
  libSc: StatefulContract;
  entryAddress: string;
  categoryId: string;
}

/** Genesis the proxy. `seedKey30` pre-creates key 30 = 5, so a write to it is an UPDATE rather than an INSERT. */
async function setup(seedKey30: boolean): Promise<Fixture> {
  const provider = createTestProvider();
  const libArt = compileString(LIB);
  const proxyArt = compileString(PROXY, { allowUnsafeOperations: true });
  const proxyContract = new Contract(proxyArt, [], { provider });

  const genesis = await provider.addTokenUtxosDynamic((cat: string) => {
    const pinned = proxyContract.category ? proxyContract : proxyContract.withCategory(hexToBin(cat));
    const entryAddr = getEntryNftAddress(pinned, cat, 'bal');
    const head = seedKey30 ? encodeEntryCommitment(ZERO, SLOT_30) : encodeEntryCommitment(ZERO, ZERO);
    return [
      {
        address: pinned.tokenAddress,
        satoshis: 100000n,
        token: { amount: 0n, nft: { capability: 'minting', commitment: '' } },
      },
      {
        address: entryAddr,
        satoshis: 1500n,
        token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(head) } },
      },
      ...(seedKey30 ? [{
        address: entryAddr,
        satoshis: 1500n,
        token: {
          amount: 0n,
          nft: {
            capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(SLOT_30, ZERO, new Uint8Array([0x05]))),
          },
        },
      }] : []),
    ];
  });

  const pinned = proxyContract.withCategory(hexToBin(genesis.categoryId));
  const libContract = new Contract(libArt, [], { provider });
  const { categoryId: libCatId } = await setupStatefulUtxos(
    provider, libContract, libArt.stateLayout!, {}, { saltContract: true },
  );
  return {
    provider,
    proxySc: StatefulContract.withCategory(proxyContract, genesis.categoryId),
    libSc: StatefulContract.withCategory(libContract, libCatId),
    entryAddress: getEntryNftAddress(pinned, genesis.categoryId, 'bal'),
    categoryId: genesis.categoryId,
  };
}

const valueOfKey30 = async (fixture: Fixture): Promise<bigint | undefined> => {
  const entry = SortedList.fromUtxos(await fixture.provider.getUtxos(fixture.entryAddress)).find(SLOT_30);
  if (!entry) return undefined;
  const decoded = vmNumberToBigInt(entry.value, { requireMinimalEncoding: false });
  return typeof decoded === 'bigint' ? decoded : 0n;
};

const raw = (builder: any): string => binToHex(encodeTransaction(builder.buildLibauthTransaction()));

function expectRejectedAt(outcome: string, inputIndex: number): void {
  expect(outcome).toContain('mandatory-script-verify-flag-failed');
  if (outcome.includes('error in evaluating input index')) {
    expect(outcome).toContain(`error in evaluating input index ${inputIndex}`);
  }
}

describe('X11: delegate vmap sorted mapping write', () => {
  /**
   * GUARD NEGATIVE CONTROL. The forwarder really does publish no entry accesses and the implementation really
   * does, so a green result below can only come from routing the impl's - not from the proxy having had them
   * all along, and not from some unrelated derivation path.
   */
  it('the forwarder publishes no entryAccesses; the delegated implementation does', () => {
    const proxyAbi = compileString(PROXY, { allowUnsafeOperations: true }).abi as any[];
    const libAbi = compileString(LIB).abi as any[];
    expect(proxyAbi.find((f) => f.name === '__fallback')?.entryAccesses ?? []).toEqual([]);
    expect(libAbi.find((f) => f.name === 'setBal')?.entryAccesses).toEqual([
      { collection: 'bal', keyParams: ['k'], operations: ['write'] },
    ]);
  });

  // HONEST POSITIVE CONTROL: the write actually lands, on the VM, through the delegate.
  it('settles an UPDATE of an existing key through the delegate', async () => {
    const fixture = await setup(true);
    expect(await valueOfKey30(fixture)).toBe(5n);
    const tx = await fixture.proxySc.call.__fallback()
      .withDelegatecall(fixture.libSc, 'setBal', [30n, 100n]).send();
    expect(tx.txid).toBeDefined();
    expect(await valueOfKey30(fixture)).toBe(100n);
    // The node count is unchanged: an update rewrites the value tail, it does not mint.
    const list = SortedList.fromUtxos(await fixture.provider.getUtxos(fixture.entryAddress));
    expect(list.all.length).toBe(2);
  }, 300_000);

  /**
   * HOSTILE, pinned to an index. Tamper ONLY the entry output's value tail. The implementation covenant owns
   * that commitment (the delegate resolves the entry output implementation-relative), so it must reject at
   * input 1 - the delegate's own input, not the proxy's.
   */
  it('rejects a tampered entry value at the implementation input', async () => {
    const fixture = await setup(true);
    const builder: any = await fixture.proxySc.call.__fallback()
      .withDelegatecall(fixture.libSc, 'setBal', [30n, 100n]).build();
    builder.outputs[2].token.nft.commitment = binToHex(
      encodeEntryCommitment(SLOT_30, ZERO, new Uint8Array([0x7f])),
    );
    const outcome = await fixture.provider.sendRawTransaction(raw(builder))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectRejectedAt(outcome, 1);
  }, 300_000);

  /**
   * HOSTILE, pinned to an index, and the mechanism that also explains the INSERT refusal below. Append one
   * extra own-category mutable NFT at the collection's entry address - a fabricated node a later read would
   * authenticate. The PROXY refuses it at input 0: its own-category mutable NFT count no longer balances.
   */
  it('rejects an appended fabricated entry node at the proxy input', async () => {
    const fixture = await setup(true);
    const builder: any = await fixture.proxySc.call.__fallback()
      .withDelegatecall(fixture.libSc, 'setBal', [30n, 100n]).build();
    builder.outputs.push({
      to: fixture.entryAddress,
      amount: 1200n,
      token: {
        category: fixture.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(SLOT_30, ZERO, new Uint8Array([0x63]))),
        },
      },
    });
    const outcome = await fixture.provider.sendRawTransaction(raw(builder))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectRejectedAt(outcome, 0);
  }, 300_000);

  /**
   * The INSERT sub-shape, and the boundary is the PROXY's bytecode, not the delegate's. An insert mints one new
   * entry node, which is the same +1 own-category mutable NFT the case above refuses - a proxy that conserves
   * that count cannot admit one without admitting the other, and rejects at input 0. Since X50 the shipped
   * default upgrades proxy conserves as well, so it refuses the same shape. The implementation covenant accepts
   * this transaction either way - verified by the tampered-value case above, which reaches input 1 only because
   * input 0 is satisfied.
   */
  it('refuses an INSERT at the conserving proxy, not at the delegate', async () => {
    const fixture = await setup(false);
    const outcome = await fixture.proxySc.call.__fallback()
      .withDelegatecall(fixture.libSc, 'setBal', [30n, 100n]).send()
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).toBe('messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
    expect(await valueOfKey30(fixture)).toBeUndefined();
  }, 300_000);
});
