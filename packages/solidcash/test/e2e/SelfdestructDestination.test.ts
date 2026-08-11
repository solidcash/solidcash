import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract, SignatureTemplate, StatefulContract, TransactionBuilder, createDestroyDataNftUnlocker,
  createSatoshiContainerUnlocker, getSatoshiContainerAddress,
} from '../../src/index.js';
import { createTestProvider, getTxOutputs, verifyTransaction } from '../test-util.js';
import { alicePub, alicePriv, alicePkh, bobPkh, bobAddress } from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// `selfdestruct(addr)` implies the selfdestruct modifier: it collapses every state UTXO (no master
// recreation - the contract's end of life) and frees the native balance to addr. The covenant pins
// `tx.outputs[0].lockingBytecode == addr`, so whoever triggers it, the freed value can only land at addr.
const SD = `pragma solidcash >=0.8.0;
contract C(pubkey admin) {
  int counter;
  function kill(sig s, bytes20 to) { require(checkSig(s, admin)); selfdestruct(new LockingBytecodeP2PKH(to)); }
}`;

const artifact = compileString(SD);

describe('selfdestruct(addr) destination (runtime)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('frees the balance to addr at output 0 and collapses the contract', async () => {
    const fundingUtxo: Utxo = { txid: 'b2cd'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);

    const { contract: deployed } = await StatefulContract.deploy(artifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { counter: 0n },
      changeAddress: p2pkh.address,
      initialBalance: 50000n,
    });

    expect(await deployed.satoshiContainer.getBalance()).toBe(50000n);

    // selfdestructTo collapses all state UTXOs; the output[0] covenant forces the freed value to bob.
    const result = await StatefulContract.selfdestructTo({
      provider,
      contract: deployed,
      destroyFunctionName: 'kill',
      destroyFunctionArgs: [new SignatureTemplate(alicePriv), bobPkh],
      recipient: bobAddress,
    });
    expect(result.txs.length).toBe(1);

    // The value pin forces exactly one output: the whole freed balance (>= the 50000 container) at bob, with
    // nothing siphoned to a second output.
    const outputs = getTxOutputs(result.txs[0]);
    expect(outputs.length).toBe(1);
    expect(outputs[0].to).toBe(bobAddress);
    expect(outputs[0].token).toBeUndefined();
    expect(outputs[0].amount).toBeGreaterThanOrEqual(50000n);
    expect(result.totalReclaimed).toBe(outputs[0].amount);

    // The contract is destroyed: no master minting NFT recreated anywhere in the tx.
    expect(outputs.some((o) => o.token?.nft?.capability === 'minting')).toBe(false);
  });

  // A permissionless (no signature check) selfdestruct: anyone may trigger it. The value pins must stop a
  // triggerer from diverting the freed balance away from addr, even hand-building the transaction.
  const PERMISSIONLESS = `pragma solidcash >=0.8.0;
contract C() {
  int counter;
  function kill(bytes20 to) { require(true); selfdestruct(new LockingBytecodeP2PKH(to)); }
}`;
  // These adversarial rows intentionally exercise caller-directed destruction and then prove the generated
  // value covenant prevents siphoning. Keep the compiler's unsafe escape hatch explicit in the fixture.
  const permissionlessArtifact = compileString(PERMISSIONLESS, { allowUnsafeOperations: true });

  async function deployPermissionless(initialBalance?: bigint): Promise<any> {
    const fundingUtxo: Utxo = { txid: 'a1b2'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const { contract: deployed } = await StatefulContract.deploy(permissionlessArtifact, [], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { counter: 0n },
      changeAddress: p2pkh.address,
      ...(initialBalance != null ? { initialBalance } : {}),
    });
    const tokenUtxos = await provider.getUtxos(deployed.tokenAddress);
    const master = tokenUtxos.find(
      (u: Utxo) => u.token?.nft?.capability === 'minting' && u.token?.category === deployed.categoryId,
    );
    const dataNft = (await deployed.getFullState()).dataNftUtxos[0];
    return { deployed, master, dataNft };
  }

  it('value pin rejects siphoning the freed balance to a second output (exactly-one-output)', async () => {
    const { deployed, master, dataNft } = await deployPermissionless();
    const totalIn = master.satoshis + dataNft.satoshis;

    // Positive control: the same hand-built collapse with a single correct output verifies. This proves the
    // negative below fails on the value pin, not on a malformed transaction.
    const ok = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    ok.addInput(master, deployed.inner.unlock.kill(bobPkh));
    ok.addInput(dataNft, createDestroyDataNftUnlocker(deployed.inner, 0, deployed.categoryId));
    ok.addOutput({ to: bobAddress, amount: totalIn - 300n });
    expect(() => verifyTransaction(ok)).not.toThrow();

    // Negative: output 0 is bob (satisfies the address pin), but a second output siphons the rest. Rejected.
    const builder = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    builder.addInput(master, deployed.inner.unlock.kill(bobPkh));
    builder.addInput(dataNft, createDestroyDataNftUnlocker(deployed.inner, 0, deployed.categoryId));
    builder.addOutput({ to: bobAddress, amount: 800n });
    builder.addOutput({ to: p2pkh.address, amount: totalIn - 800n - 300n });
    expect(() => verifyTransaction(builder)).toThrow();
  });

  it('value floor rejects burning the freed balance to an excessive fee (fee < 2000)', async () => {
    const { deployed, master, dataNft } = await deployPermissionless(50000n);
    const satContainer = (await provider.getUtxos(
      getSatoshiContainerAddress(deployed.inner, deployed.categoryId),
    ))[0];
    const totalIn = master.satoshis + dataNft.satoshis + satContainer.satoshis;
    const inputs = (b: TransactionBuilder): TransactionBuilder => {
      b.addInput(master, deployed.inner.unlock.kill(bobPkh));
      b.addInput(dataNft, createDestroyDataNftUnlocker(deployed.inner, 0, deployed.categoryId));
      b.addInput(satContainer, createSatoshiContainerUnlocker(deployed.inner, 0, deployed.categoryId));
      return b;
    };

    // Positive control: a single output that leaves a small (< 2000) fee verifies.
    const ok = inputs(new TransactionBuilder({ provider, allowImplicitNftBurn: true }));
    ok.addOutput({ to: bobAddress, amount: totalIn - 300n });
    expect(() => verifyTransaction(ok)).not.toThrow();

    // Negative: single output to bob (passes the address + count pins) but underpaid by 5000, so the fee is
    // 5000 - rejected by the value floor (fee must be < 2000).
    const builder = inputs(new TransactionBuilder({ provider, allowImplicitNftBurn: true }));
    builder.addOutput({ to: bobAddress, amount: totalIn - 5000n });
    expect(() => verifyTransaction(builder)).toThrow();
  });
});
