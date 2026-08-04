import { describe, it, expect } from 'vitest';
import { vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, Signer, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, alicePub, alicePkh, aliceAddress, bobAddress, carolAddress } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// The OZ v5 ERC20 `_update` SHAPE of the full multiTransfer, as EACCToken produces after inlining: the per-key value
// is bound to a single-assign LOCAL (`int v = amounts[i]`, OZ's `value` param), and the msg.sender DEBIT is a
// READ-INTO-LOCAL RMW (`int fromBal = bal[msg.sender]; bal[msg.sender] = fromBal - v`) rather than a compound `-=`.
// The C2 upsert-loop setup sees through the value local (findSingleAssignLocalInit) to record valueArrayParam=amounts,
// so this compiles + behaves IDENTICALLY to the direct `bal[recipients[i]] += amounts[i]` form (FullMultiTransfer).
const SRC = `contract Token() {
  mapping(address => int) bal;
  function setBal(address a, int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.bal[a] = v; }
  function multiTransfer(address[] recipients, int[] amounts, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (int i = 0; i < recipients.length; i++) {
      int v = amounts[i];
      int fromBal = this.bal[msg.sender];
      this.bal[msg.sender] = fromBal - v;
      this.bal[recipients[i]] += v;
    }
  }
}`;

describe('OZ v5 _update shape multiTransfer (value-local + read-into-local debit) - EACCToken', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const alice = new Signer(alicePriv, provider);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xe700;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  const deploy = async (): Promise<{
    valOf: (a: string) => Promise<bigint | undefined>;
    setBal: (a: string, v: bigint) => Promise<{ txid: string }>;
    fundContract: () => Promise<void>; fundSigner: () => Promise<void>; sc: unknown;
  }> => {
    const art = compileString(SRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract, categoryId } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const ea = getEntryNftAddress(contract.inner, categoryId, 'bal');
    const valOf = async (addr: string): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(addressToLockScript(addr)));
      return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    };
    const setBal = (a: string, v: bigint): Promise<{ txid: string }> =>
      (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<{ txid: string }> }>)
        .setBal(a, v, alicePub, sig).send();
    const fundContract = async (): Promise<void> => {
      await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    };
    const fundSigner = async (): Promise<void> => {
      await provider.addUtxo(alice.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    };
    return { valOf, setBal, fundContract, fundSigner, sc: contract.connect(alice) };
  };
  const mt = (sc: unknown, rs: string[], as: bigint[]): Promise<{ txid: string }> =>
    (sc as Record<string, (...x: unknown[]) => { send: () => Promise<{ txid: string }> }>)
      .multiTransfer(rs, as, alicePub, sig).send();

  it('debits msg.sender by the total and credits each EXISTING recipient (identical to the direct form)', async () => {
    const { valOf, setBal, fundContract, fundSigner, sc } = await deploy();
    await fundContract(); await setBal(aliceAddress, 1000n);
    await fundContract(); await setBal(bobAddress, 100n);
    await fundContract(); await setBal(carolAddress, 200n);
    await fundSigner();
    await mt(sc, [bobAddress, carolAddress], [10n, 20n]); // alice 970, bob 110, carol 220
    expect(await valOf(aliceAddress)).toBe(970n);
    expect(await valOf(bobAddress)).toBe(110n);
    expect(await valOf(carolAddress)).toBe(220n);
  });

  it('credits a NEW recipient (insert) alongside the read-into-local debit', async () => {
    const { valOf, setBal, fundContract, fundSigner, sc } = await deploy();
    await fundContract(); await setBal(aliceAddress, 1000n); // sender (debited)
    await fundContract(); await setBal(bobAddress, 100n);    // carol's predecessor, NOT a recipient
    await fundSigner();
    await mt(sc, [carolAddress], [20n]); // debit alice 1000->980; INSERT carol=20
    expect(await valOf(aliceAddress)).toBe(980n);
    expect(await valOf(carolAddress)).toBe(20n);
    expect(await valOf(bobAddress)).toBe(100n);
  });
});
