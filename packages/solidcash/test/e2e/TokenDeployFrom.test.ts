import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { createTestProvider, genesisFtContainer, getTxOutputs } from '../test-util.js';
import { addressToLockScript } from '../../src/utils.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { hexToBin } from '@bitauth/libauth';

// A factory whose deploy function mints a child AND transfers CashTokens from its own token container to that new
// child - "tokens transferred to a new contract created during deploy". The recipient LBC is passed as an arg (the
// caller precomputes the child's deterministic self-pinned address). The covenant co-spends + self-preserves the
// token container and pins the transfer; deployFrom wires the container input, recreated remainder, and tcTransfer.
const CHILD = 'contract Child(bytes20 owner){int counter;function increment(){'
  + 'require(tx.outputs[0].lockingBytecode==new LockingBytecodeP2PKH(owner));this.counter=this.counter+1;}}';
const FACTORY = `${CHILD}
contract TokenDeployFactory(){
  int childCount;
  function make(bytes32 cat, bytes20 childOwner, bytes childLbc, int amt){
    Child ch = new Child(childOwner);
    this.tokens[cat].transfer(childLbc, amt);
    this.childCount = this.childCount + 1;
  }
}`;
const factoryArtifact = compileString(FACTORY);
const childArtifact = compileString(CHILD);

describe('token transfer to a new child on deploy (deployFrom)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const bare = new Contract(factoryArtifact, [], { provider });

  async function deployFactory(txid: string): Promise<{
    factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract']; ftCategory: string;
  }> {
    const fu: Utxo = { txid, vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, fu);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider, fundingUtxo: fu,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n }, changeAddress: p2pkh.address,
    });
    const ft = await genesisFtContainer(provider, bare, deployed.categoryId, [1000n]);
    return { factory: deployed.contract, ftCategory: ft.category };
  }

  it('mints the child AND sends 300 FT to it; the container is recreated at 700 FT', async () => {
    const { factory, ftCategory } = await deployFactory('1101'.repeat(16));
    const g0: Utxo = { txid: '1a02'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, g0);
    // The child self-pins to its genesis category (= g0.txid); precompute its address to target the transfer.
    const childContract = new Contract(childArtifact, [alicePkh], { provider, category: hexToBin(g0.txid) });
    const childLbc = addressToLockScript(childContract.address);

    const result = await StatefulContract.deployFrom({
      provider, factory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxo: g0, changeAddress: p2pkh.address,
      deployFunctionName: 'make',
      deployFunctionArgs: [ftCategory, alicePkh, childLbc, 300n],
      childArtifact, childConstructorArgs: [alicePkh], childInitialState: { counter: 0n },
      tokenContainerCategoryIds: [ftCategory],
      childTokenTransfers: [{ categoryId: ftCategory, to: childLbc, amount: 300n }],
    });

    const outs = getTxOutputs(result.tx);
    // The child genesis (minting NFT of the g0 category).
    const childMaster = outs.find((o) => o.token?.category === g0.txid && o.token?.nft?.capability === 'minting');
    expect(childMaster).toBeDefined();
    // The token container recreated with the remainder (1000 - 300 = 700 FT of the container's category).
    expect(outs.some((o) => o.token?.category === ftCategory && o.token?.amount === 700n && !o.token?.nft)).toBe(true);
    // The 300 FT transfer landed at the NEW CHILD's address (same address the child master NFT occupies).
    const transfer = outs.find((o) => o.token?.category === ftCategory && o.token?.amount === 300n && !o.token?.nft);
    expect(transfer).toBeDefined();
    expect(transfer!.to).toBe(childMaster!.to);
  });

  it('requires childTokenTransfers when the deploy function co-spends a token container', async () => {
    const { factory, ftCategory } = await deployFactory('1201'.repeat(16));
    const g0: Utxo = { txid: '2a02'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, g0);
    const childContract = new Contract(childArtifact, [alicePkh], { provider, category: hexToBin(g0.txid) });
    const childLbc = addressToLockScript(childContract.address);
    await expect(StatefulContract.deployFrom({
      provider, factory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxo: g0, changeAddress: p2pkh.address,
      deployFunctionName: 'make',
      deployFunctionArgs: [ftCategory, alicePkh, childLbc, 300n],
      childArtifact, childConstructorArgs: [alicePkh], childInitialState: { counter: 0n },
      tokenContainerCategoryIds: [ftCategory],
      // childTokenTransfers omitted
    })).rejects.toThrow(/childTokenTransfers/);
  });
});

// Two token container categories co-spent + transferred to the child in one deploy: the layout has two
// tokenContainer slots then two tcTransfer slots. deployFrom recreates each container's remainder (in access
// order) and appends the transfers (in the deploy fn's statement order = the childTokenTransfers order).
const MULTI_CHILD = 'contract Child(bytes20 o){int c;function f(){'
  + 'require(tx.outputs[0].lockingBytecode==new LockingBytecodeP2PKH(o));this.c=this.c+1;}}';
const MULTI_FACTORY = `${MULTI_CHILD}
contract MultiTokenFactory(){
  int cc;
  function make(bytes32 catA, bytes32 catB, bytes20 o, bytes to, int amtA, int amtB){
    Child ch = new Child(o);
    this.tokens[catA].transfer(to, amtA);
    this.tokens[catB].transfer(to, amtB);
    this.cc = this.cc + 1;
  }
}`;
const multiArtifact = compileString(MULTI_FACTORY);
const multiChildArtifact = compileString(MULTI_CHILD);

describe('multi-category token transfer on deploy (deployFrom)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const bare = new Contract(multiArtifact, [], { provider });

  it('co-spends TWO token containers, recreates both remainders, transfers both to the child', async () => {
    const fu: Utxo = { txid: 'da01'.repeat(16), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, fu);
    const deployed = await StatefulContract.deploy(multiArtifact, [], {
      provider, fundingUtxo: fu,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { cc: 0n }, changeAddress: p2pkh.address,
    });
    const ftA = await genesisFtContainer(provider, bare, deployed.categoryId, [1000n]);
    const ftB = await genesisFtContainer(provider, bare, deployed.categoryId, [2000n]);

    const g0: Utxo = { txid: 'da02'.repeat(16), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, g0);
    const child = new Contract(multiChildArtifact, [alicePkh], { provider, category: hexToBin(g0.txid) });
    const childLbc = addressToLockScript(child.address);

    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxo: g0, changeAddress: p2pkh.address,
      deployFunctionName: 'make',
      deployFunctionArgs: [ftA.category, ftB.category, alicePkh, childLbc, 300n, 500n],
      childArtifact: multiChildArtifact, childConstructorArgs: [alicePkh], childInitialState: { c: 0n },
      tokenContainerCategoryIds: [ftA.category, ftB.category],
      childTokenTransfers: [
        { categoryId: ftA.category, to: childLbc, amount: 300n },
        { categoryId: ftB.category, to: childLbc, amount: 500n },
      ],
    });

    const outs = getTxOutputs(result.tx);
    const childMaster = outs.find((o) => o.token?.category === g0.txid && o.token?.nft?.capability === 'minting');
    expect(childMaster).toBeDefined();
    // Both containers recreated at their remainders.
    expect(outs.some((o) => o.token?.category === ftA.category && o.token?.amount === 700n && !o.token?.nft)).toBe(true);
    expect(outs.some((o) => o.token?.category === ftB.category && o.token?.amount === 1500n && !o.token?.nft)).toBe(true);
    // Both transfers landed at the new child.
    const tA = outs.find((o) => o.token?.category === ftA.category && o.token?.amount === 300n && !o.token?.nft);
    const tB = outs.find((o) => o.token?.category === ftB.category && o.token?.amount === 500n && !o.token?.nft);
    expect(tA?.to).toBe(childMaster!.to);
    expect(tB?.to).toBe(childMaster!.to);
  });
});
