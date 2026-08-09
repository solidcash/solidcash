import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract, Signer } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos, plainNumerics } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

// =============================================================================
// Two writes in one C2 batch that land on ONE key at runtime.
//
// `bal[msg.sender]` and `bal[this.owner]` are distinct key SOURCES, so the
// compiler emits two entry slots. Whenever the owner is the sender they are the
// same key - which, for the ERC-20 fee shape this models, is every transfer out
// of freshly issued supply. The batch planner is then handed the same slot twice
// and refuses: one entry NFT cannot be co-spent twice.
//
// It fails CLOSED, and that is the point of this test. The obvious fix is to
// dedupe in SortedList.planBatchUpsert and let the existing same-proof-UTXO merge
// downstream take care of the rest. That was tried and MEASURED: the transaction
// builds, settles, and silently drops the second write. With fee = 7 on a
// transfer of 40, the owner ends at 60 instead of 67 - the debit applied, the fee
// credit vanished, and nothing raised. Deduping is only sound when the two writes
// are redundant; here they must COMPOSE.
//
// Composing them needs the covenant to apply both writes to one entry. The
// nearest existing mechanism, `runtimeAliasPriorSlots`, is the wrong shape: it
// makes the duplicate slot INACTIVE, which drops its contribution exactly as the
// dedupe did. So this is a genuine gap, not an oversight, and the refusal is the
// correct behaviour until a compose-on-alias path exists.
// =============================================================================
const SRC = `pragma solidcash >=0.8.0;
contract T(address initialOwner) {
  public address owner;
  mapping(address => int) public bal;
  public int fee;
  constructor() { this.owner = initialOwner; this.fee = 0; }
  function seed(address k, int v) { this.bal[k] = v; }
  function setFee(int f) { this.fee = f; }
  function move(address to, int v) {
    address sender = msg.sender;
    require(this.bal[sender] >= v);
    this.bal[sender] = this.bal[sender] - v;
    this.bal[to] = this.bal[to] + (v - this.fee);
    this.bal[this.owner] = this.bal[this.owner] + this.fee;
  }
}`;

const RECIPIENT = hexToBin('aa'.repeat(20));
const THIRD_PARTY = hexToBin('bb'.repeat(20));

interface Fixture {
  sc: StatefulContract;
  signer: Signer;
  read: (k: Uint8Array) => Promise<bigint>;
}

async function setup(owner: Uint8Array): Promise<Fixture> {
  const provider = createTestProvider();
  const art = compileString(SRC);
  const contract = new Contract(art, [owner], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!,
    { owner, fee: 0n }, { saltContract: true });
  const sc = StatefulContract.withCategory(contract, categoryId);
  const signer = new Signer(alicePriv, provider);
  for (const txid of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8']) {
    await provider.addUtxo(signer.getAddress(), { txid: txid.repeat(32), vout: 0, satoshis: 500000n });
  }
  const read = async (k: Uint8Array): Promise<bigint> =>
    plainNumerics((await (sc.state as Record<string, (x: Uint8Array) => Promise<unknown>>).bal(k)) ?? 0n) as bigint;
  return { sc, signer, read };
}

describe('C2 batch: two slots resolving to one key at runtime', () => {
  it('settles when the three keys are distinct (control)', async () => {
    const { sc, signer, read } = await setup(THIRD_PARTY);
    const sender = addressToLockScript(signer.getAddress());
    await sc.connect(signer).call.seed(sender, 100n).send();
    await sc.connect(signer).call.seed(RECIPIENT, 0n).send();
    await sc.connect(signer).call.seed(THIRD_PARTY, 0n).send();
    await sc.connect(signer).call.setFee(7n).send();
    await sc.connect(signer).call.move(RECIPIENT, 40n).send();
    expect(await read(sender)).toBe(60n);
    expect(await read(RECIPIENT)).toBe(33n);
    expect(await read(THIRD_PARTY), 'the owner was credited the fee').toBe(7n);
  });

  // The same call, with the owner as sender, so slots 1 and 2 are one key.
  it('refuses when the sender IS the owner, rather than dropping a write', async () => {
    const sender = addressToLockScript(new Signer(alicePriv, createTestProvider()).getAddress());
    const { sc, signer, read } = await setup(sender);
    await sc.connect(signer).call.seed(sender, 100n).send();
    await sc.connect(signer).call.seed(RECIPIENT, 0n).send();
    await sc.connect(signer).call.setFee(7n).send();

    await expect(sc.connect(signer).call.move(RECIPIENT, 40n).send())
      .rejects.toThrow(/duplicate slot/i);

    // Nothing moved. The alternative - the deduping "fix" - settles here and leaves
    // 60, having applied the debit and lost the 7 fee credit.
    expect(await read(sender)).toBe(100n);
    expect(await read(RECIPIENT)).toBe(0n);
  });
});
