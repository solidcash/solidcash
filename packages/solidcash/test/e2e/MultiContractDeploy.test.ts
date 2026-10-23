import { compileStringMulti } from '@solidcash/solidc';
import { parsePushdataCommitment } from '@solidcash/utils';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import {
  StatefulContract,
  ContractBundle,
} from '../../src/stateful/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// A ContractBundle wraps an ArtifactMap (compileStringMulti) + provider as implicit context, so deploy /
// attach auto-register the whole map - no explicit registerArtifacts, no childArtifact in deployFrom.
// attach(address) resolves the category from the indexer (getUtxos). See docs/multi-contract-artifacts.md.
const SOURCE = `
  contract MultiChild() {
    bytes20 owner;
    int counter;
    bool untouched;
    constructor(bytes20 initialOwner) { this.owner = initialOwner; this.counter = 7; }
    function bump() { this.counter = this.counter + 1; require(true); }
  }
  contract MultiFactory(pubkey factoryOwner) {
    int deployCount;
    function deployChild(sig s, bytes20 childOwner) {
      require(checkSig(s, factoryOwner));
      MultiChild child = new MultiChild(childOwner);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

describe('ContractBundle (implicit ArtifactMap context)', () => {
  const provider = createTestProvider();
  const bundle = ContractBundle.from(compileStringMulti(SOURCE), { provider });
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
  let factoryCategoryId: string;
  let factoryAddress: string;

  it('exposes the compiled artifacts by name', () => {
    expect(Object.keys(bundle.artifacts).sort()).toEqual(['MultiChild', 'MultiFactory']);
    expect(() => bundle.get('Nope')).toThrow(/not in this bundle/);
  });

  it('deploys a named contract via the bundle (artifacts auto-registered)', async () => {
    const fundingUtxo: Utxo = { txid: 'ba1d'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const result = await bundle.deploy('MultiFactory', [alicePub], {
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });
    factory = result.contract;
    factoryCategoryId = result.categoryId;
    factoryAddress = factory.address;
    expect(factory.categoryId).toBe(factoryCategoryId);
  });

  it('deploys the child with NO registerArtifacts and NO childArtifact (resolved from the bundle)', async () => {
    const fundingUtxo: Utxo = { txid: 'bb2d'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);

    const result = await StatefulContract.deployFrom({
      provider,
      factory, // already carries the bundle's artifacts (bundle.deploy registered them)
      deployFunctionName: 'deployChild',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh],
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    expect(result.tx.txid).toBeDefined();
    const childData = getTxOutputs(result.tx).find(
      (o) => o.token?.category === fundingUtxo.txid && o.token?.nft?.capability === 'mutable',
    );
    const state = parsePushdataCommitment(
      childData!.token!.nft!.commitment, bundle.get('MultiChild').stateLayout!, 0,
    );
    expect(state.counter).toBe(7n);
    expect(state.owner).toEqual(alicePkh);
    expect(state.untouched).toBe(false);
  });

  it('refuses childInitialState overrides of authenticated constructor fields', async () => {
    const fundingUtxo: Utxo = { txid: 'bc3d'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    await expect(StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'deployChild',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh],
      childInitialState: { owner: new Uint8Array(20) },
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    })).rejects.toThrow(/cannot override authenticated constructor-genesis field 'owner'/);
  });

  it('attaches by address - the category is resolved from the indexer (getUtxos), not a registry', async () => {
    const attached = await bundle.attach('MultiFactory', factoryAddress, [alicePub]);
    // getUtxos(address) -> token category == the deployed factory's category.
    expect(attached.categoryId).toBe(factoryCategoryId);
    // It is the same self-pinned address.
    expect(attached.address).toBe(factoryAddress);
  });
});
