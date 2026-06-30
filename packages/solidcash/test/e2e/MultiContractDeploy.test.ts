import { compileStringMulti } from 'solidc';
import { parsePushdataCommitment } from '@solidcash/utils';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Phase 2: with the whole ArtifactMap registered (factory.registerArtifacts(map)), deployFrom resolves the
// child artifact from the deploy target's name - no per-child registerChild and no childArtifact in the call.
// See docs/multi-contract-artifacts.md.
const SOURCE = `
  contract MultiChild(bytes20 owner) {
    int counter;
    function bump() { this.counter = this.counter + 1; require(true); }
  }
  contract MultiFactory(pubkey factoryOwner) {
    int deployCount;
    function deployChild(sig s, bytes20 childOwner) deploy {
      require(checkSig(s, factoryOwner));
      MultiChild child = new MultiChild(childOwner);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

describe('multi-contract deploy (ArtifactMap resolution)', () => {
  const map = compileStringMulti(SOURCE);
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

  it('compiles a factory + child map', () => {
    expect(Object.keys(map).sort()).toEqual(['MultiChild', 'MultiFactory']);
    expect(map.MultiFactory.abi.find((f) => f.name === 'deployChild')!.deployTargets![0].contractName)
      .toBe('MultiChild');
  });

  it('deploys the factory from map.MultiFactory', async () => {
    const fundingUtxo: Utxo = { txid: 'ba1d'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const result = await StatefulContract.deploy(map.MultiFactory, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });
    factory = result.contract;
  });

  it('deploys the child resolved from the registered ArtifactMap (no childArtifact, no registerChild)', async () => {
    const fundingUtxo: Utxo = { txid: 'bb2d'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);

    // Register the whole map once; childArtifact + childConstructorArgs are resolved from it + the deploy args.
    factory.registerArtifacts(map);
    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'deployChild',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh],
      // NOTE: no childArtifact - resolved from map[deployTargets[0].contractName] = map.MultiChild.
      childConstructorArgs: [alicePkh],
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    expect(result.tx.txid).toBeDefined();
    expect(result.childCategoryId).toBe(fundingUtxo.txid);

    const childData = getTxOutputs(result.tx).find(
      (o) => o.token?.category === fundingUtxo.txid && o.token?.nft?.capability === 'mutable',
    );
    const state = parsePushdataCommitment(childData!.token!.nft!.commitment, map.MultiChild.stateLayout!, 0);
    expect(state.counter).toBe(0n);
  });
});
