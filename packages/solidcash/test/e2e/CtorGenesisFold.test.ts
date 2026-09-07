import { compileString, compileStringMulti } from '../direct-compile.js';
import {
  Contract, SignatureTemplate, StatefulContract,
} from '../../src/index.js';
import { buildEntryCommitment, parsePushdataCommitment } from '@solidcash/utils';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Solidity-style deploy-then-call with a ctor that initializes fields from its args: the ctor's writes
// fold into the deploy genesis (the covenant previously verified TYPE DEFAULTS), a same-tx mutation call
// folds on top, and a same-tx getter read resolves to the folded genesis expression in the parent.
// The SDK derives the child genesis from the deploy probe trace, so covenant and SDK must agree.
const CHILD = `
contract Child {
    uint public total;
    uint public rate;
    constructor(uint supply) {
        total = supply * 2;
        rate = 5;
    }
    function bump(uint d) public {
        total = total + d;
    }
}
`;

const FACTORY = `${CHILD}
contract Factory {
    uint deployCount;
    function make(uint s) public {
        Child c = new Child(s);
        c.bump(3);
        uint r = c.total();
        require(r == s * 2 + 3);
        require(c.rate() == 5);
        deployCount = deployCount + 1;
    }
}
`;

describe('constructor-genesis fold (Solidity-style deploy-then-call, e2e)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const factoryArtifact = compileString(FACTORY, { solidityImportCompat: true });
  const childArtifact = compileString(CHILD, { solidityImportCompat: true });

  let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

  it('marks make() as a deploy function targeting Child', () => {
    const make = factoryArtifact.abi.find((f) => f.name === 'make');
    expect(make).toBeDefined();
    expect(make!.modifiers).toContain('deploy');
    expect(make!.deployTargets?.[0].contractName).toBe('Child');
  });

  it('deploys the factory', async () => {
    const fundingUtxo: Utxo = { txid: 'fc1d'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const result = await StatefulContract.deploy(factoryArtifact, [], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });
    factory = result.contract;
    expect(factory.categoryId).toBeDefined();
  });

  it('deploys the child with ctor+bump-folded genesis (total = s*2+3, rate = 5)', async () => {
    const childFundingUtxo: Utxo = { txid: 'fc2d'.repeat(16), vout: 0, satoshis: 100000n };
    await provider.addUtxo(p2pkh.address, childFundingUtxo);

    const s = 10n;
    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'make',
      deployFunctionArgs: [s],
      childArtifact,
      childConstructorArgs: [],
      
      fundingUtxo: childFundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    expect(result.childCategoryId).toBe(childFundingUtxo.txid);
    const txOutputs = getTxOutputs(result.tx);
    const childData = txOutputs.find((o, i) => i >= 2 && o.token?.nft?.capability === 'mutable'
      && o.token?.category === result.childCategoryId);
    expect(childData).toBeDefined();
    const childState = parsePushdataCommitment(
      childData!.token!.nft!.commitment, childArtifact.stateLayout!, 0,
    );
    expect(childState.total).toBe(s * 2n + 3n);
    expect(childState.rate).toBe(5n);
  });

  it('deployFrom materializes an authenticated fixed-array constructor entry', async () => {
    const artifacts = compileStringMulti(`contract EntryChild(int32 seed) {
        int32[1] values;
        constructor() { this.values[0] = seed; }
        function check(int32 expected) public { require(this.values[0] == expected); }
      }
      contract EntryFactory() {
        function make(int32 seed) public { EntryChild child = new EntryChild(seed); require(true); }
      }`);
    const make = artifacts.EntryFactory.abi.find((candidate) => candidate.name === 'make')!;
    expect(make.deployTargets?.[0]).toMatchObject({
      entryNftCount: 1,
      genesisEntries: [{ collection: 'values' }],
    });

    const factoryFunding: Utxo = { txid: 'fc3d'.repeat(16), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(p2pkh.address, factoryFunding);
    const deployedFactory = await StatefulContract.deploy(artifacts.EntryFactory, [], {
      provider,
      fundingUtxo: factoryFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: {},
      changeAddress: p2pkh.address,
    });
    const childFunding: Utxo = { txid: 'fc4d'.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(p2pkh.address, childFunding);
    const result = await StatefulContract.deployFrom({
      provider,
      factory: deployedFactory.contract,
      deployFunctionName: 'make',
      deployFunctionArgs: [37n],
      childArtifact: artifacts.EntryChild,
      childConstructorArgs: [37n],
      fundingUtxo: childFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
    const entries = getTxOutputs(result.tx).filter((output) => output.token?.category === result.childCategoryId
      && output.token.nft?.capability === 'mutable');
    expect(entries).toHaveLength(1);
    expect(entries[0].token?.nft?.commitment).toBe(buildEntryCommitment(0n, 'bigint', 37n, 'int32'));
  });
});
