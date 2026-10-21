/**
 * A category a contract creates (docs/bcmr/DESIGN.md, section 7; DECISIONS D47): a direct `deployFrom` leads with a
 * token-free coin at input 0 and the child's authhead at output 0, owned by the factory's identity owner unless the
 * call names another, and the factory's covenant refuses any other output 0 and a second identity NFT of the child.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from 'solidc';
import { describe, expect, it, vi } from 'vitest';
import { authheadLockingBytecode, resolveIdentity } from '../../src/bcmr/index.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import Signer from '../../src/Signer.js';
import { ContractBundle, StatefulContract } from '../../src/stateful/index.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { alicePkh, alicePriv, alicePub, bobPriv } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const SOURCE = `
  contract Leaf() {
    bytes20 owner;
    int counter;
    constructor(bytes20 initialOwner) { this.owner = initialOwner; this.counter = 1; }
    function bump() { this.counter = this.counter + 1; require(true); }
  }
  contract Maker(pubkey makerOwner) {
    int made;
    function make(sig s, bytes20 leafOwner) {
      require(checkSig(s, makerOwner));
      Leaf leaf = new Leaf(leafOwner);
      this.made = this.made + 1;
    }
  }
`;

describe('the identity of a category a contract creates', () => {
  it('leads the creating transaction with the child\'s authhead, which the factory\'s covenant enforces', async () => {
    const provider = createTestProvider();
    const bundle = ContractBundle.from(compileStringMulti(SOURCE), { provider });
    expect(bundle.get('Maker').abi.find((entry) => entry.name === 'make')!.deployTargets![0]!.leadsIdentity)
      .toBe(true);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const funder = p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
    const factoryFunding: Utxo = { txid: 'a1d0'.repeat(16), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(p2pkh.address, factoryFunding);
    const { contract: factory } = await bundle.deploy('Maker', [alicePub], {
      fundingUtxo: factoryFunding, funder, initialState: { made: 0n }, changeAddress: p2pkh.address,
    });
    // The factory's identity owner is the change address, its funder lock being no P2PKH.
    const factoryOwner = addressToLockScript(p2pkh.address);

    const sent: TransactionBuilder[] = [];
    const send = TransactionBuilder.prototype.send;
    const spy = vi.spyOn(TransactionBuilder.prototype, 'send').mockImplementation(function capture(this: TransactionBuilder) {
      sent.push(this);
      return send.call(this);
    });
    const childFunding: Utxo = { txid: 'a2d0'.repeat(16), vout: 0, satoshis: 50_000n };
    await provider.addUtxo(p2pkh.address, childFunding);
    const result = await StatefulContract.deployFrom({
      provider, factory, deployFunctionName: 'make',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh],
      fundingUtxo: childFunding, funder, changeAddress: p2pkh.address,
    });
    spy.mockRestore();

    const child = result.childCategoryId;
    const [authhead, master] = result.tx.outputs;
    expect(binToHex(authhead!.lockingBytecode)).toBe(binToHex(authheadLockingBytecode(child)));
    expect(binToHex(authhead!.token!.category)).toBe(child);
    expect(authhead!.token!.nft?.capability).toBe('mutable');
    expect(binToHex(authhead!.token!.nft!.commitment)).toBe(binToHex(factoryOwner));
    expect(binToHex(master!.token!.category)).toBe(factory.categoryId);
    expect(master!.token!.nft?.capability).toBe('minting');
    expect(result.identity).toMatchObject({ txid: result.tx.txid, category: child, status: 'active' });
    expect((await resolveIdentity(provider, child))?.txid).toBe(result.tx.txid);

    // The factory's master, at input 1, judges the transaction alone.
    const builder = sent[sent.length - 1]!;
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    expect(sourceOutputs[0]!.token).toBeUndefined();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const masterAccepts = (tx: typeof transaction): unknown =>
      vm.stateSuccess(vm.evaluate({ inputIndex: 1, sourceOutputs, transaction: tx }));
    expect(masterAccepts(transaction)).toBe(true);
    // Output 0 at another lock, the NFT kept.
    const moved = {
      ...transaction,
      outputs: [{ ...transaction.outputs[0]!, lockingBytecode: factoryOwner }, ...transaction.outputs.slice(1)],
    };
    expect(masterAccepts(moved)).not.toBe(true);
    // A second identity NFT of the child, beside the authhead.
    const change = transaction.outputs.length - 1;
    const doubled = {
      ...transaction,
      outputs: [
        ...transaction.outputs.slice(0, change),
        { ...transaction.outputs[0]!, valueSatoshis: 1_000n },
        transaction.outputs[change]!,
      ],
    };
    expect(masterAccepts(doubled)).not.toBe(true);

    // A call that names the child's owner.
    const bob = new Signer(bobPriv, provider).getLockingBytecode();
    const named: Utxo = { txid: 'a3d0'.repeat(16), vout: 0, satoshis: 50_000n };
    await provider.addUtxo(p2pkh.address, named);
    const second = await StatefulContract.deployFrom({
      provider, factory: result.factory, deployFunctionName: 'make',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh],
      fundingUtxo: named, funder, changeAddress: p2pkh.address, childIdentity: { owner: bob },
    });
    expect(binToHex(second.tx.outputs[0]!.token!.nft!.commitment)).toBe(binToHex(bob));
    expect(hexToBin(second.childCategoryId)).toHaveLength(32);
  }, 300_000);
});
