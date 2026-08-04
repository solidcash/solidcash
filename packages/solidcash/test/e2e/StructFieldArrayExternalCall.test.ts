import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// Struct-array-element FIELD external call: `for (i < pools.length) IFoo(pools[i].target).m()` (MasterChef
// `poolInfo[i].lpToken.balanceOf(..)`). The covenant reads the self-pinned struct array, DECODES the interface
// field from each packed element, and loop-verifies each co-spent callee's master LBC == pools[i].target. This
// exercises the emitArrayExternalCallLoop field-extraction path; a wrong decode fails the on-chain identity check.

// target is the FIRST struct field (MasterChef lpToken layout: field index 0, no preceding fields to skip).
const PUB_FIELD0 = `pragma solidcash >=0.8.0;
interface IEventSubscriber { public bigint received; function handleTransferEvent(uint256 value); }
contract Publisher() {
  struct Pool { address target; bigint last; }
  Pool[] pools;
  function setPools(address a, address b, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.pools = [Pool(a, 0), Pool(b, 0)];
  }
  function notify(uint256 value, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (uint256 i = 0; i < pools.length; i = i + 1) {
      IEventSubscriber(pools[i].target).handleTransferEvent(value);
    }
  }
}`;

// target is NOT the first field: a preceding `bigint counter` must be skipped before decoding the field.
const PUB_FIELD1 = `pragma solidcash >=0.8.0;
interface IEventSubscriber { public bigint received; function handleTransferEvent(uint256 value); }
contract Publisher() {
  struct Pool { bigint counter; address target; bigint last; }
  Pool[] pools;
  function setPools(address a, address b, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.pools = [Pool(0, a, 0), Pool(0, b, 0)];
  }
  function notify(uint256 value, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (uint256 i = 0; i < pools.length; i = i + 1) {
      IEventSubscriber(pools[i].target).handleTransferEvent(value);
    }
  }
}`;

const SUBSCRIBER = `pragma solidcash >=0.8.0;
contract Subscriber() {
  bigint received;
  function handleTransferEvent(uint256 value) {
    this.received = this.received + int(value);
    require(int(value) >= 0);
  }
}`;

describe('struct-array-element FIELD external call (IFoo(arr[i].field).m() loop)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  const runCoSpend = async (pubSource: string): Promise<void> => {
    const pubArt = compileString(pubSource);
    const subArt = compileString(SUBSCRIBER);

    const sub1 = new Contract(subArt, [], { provider });
    const { categoryId: c1 } = await setupStatefulUtxos(
      provider, sub1, subArt.stateLayout!, { received: 0n }, { saltContract: true },
    );
    const sub1Lbc = sub1.withCategory(hexToBin(c1)).lockingBytecode;
    const sub2 = new Contract(subArt, [], { provider });
    const { categoryId: c2 } = await setupStatefulUtxos(
      provider, sub2, subArt.stateLayout!, { received: 0n }, { saltContract: true },
    );
    const sub2Lbc = sub2.withCategory(hexToBin(c2)).lockingBytecode;

    const pub = new Contract(pubArt, [], { provider });
    const { categoryId: pc } = await setupStatefulUtxos(
      provider, pub, pubArt.stateLayout!, { pools: [] }, { saltContract: true },
    );
    const pubSc = StatefulContract.withCategory(pub, pc);
    const sub1Sc = StatefulContract.withCategory(sub1, c1);
    const sub2Sc = StatefulContract.withCategory(sub2, c2);

    // Write the two pools (each carrying a subscriber LBC in its `target` field) into the struct array on-chain.
    await pubSc.setPools(hexToBin(sub1Lbc), hexToBin(sub2Lbc), alicePub, sig()).send();

    pubSc.registerExternalArray('IEventSubscriber', [sub1Sc, sub2Sc]);

    const tx = await pubSc.notify(10n, alicePub, sig()).send();
    expect(tx.txid).toBeDefined();
    // Each subscriber's state advanced => the covenant decoded pools[i].target correctly and co-spent the real callee.
    expect((await sub1Sc.getState()).received).toBe(10n);
    expect((await sub2Sc.getState()).received).toBe(10n);
  };

  it('decodes the FIRST field as the co-spend target (MasterChef lpToken layout)', async () => {
    await runCoSpend(PUB_FIELD0);
  });

  it('skips a preceding field, then decodes the target field', async () => {
    await runCoSpend(PUB_FIELD1);
  });
});
