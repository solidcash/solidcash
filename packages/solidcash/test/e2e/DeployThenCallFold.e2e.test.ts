import { compileString } from 'solidc';
import { ResolvedImport, parsePushdataCommitment } from '@solidcash/utils';
import {
  Contract, SignatureTemplate, StatefulContract,
} from '../../src/index.js';
import {
  alicePriv, alicePub, alicePkh, bobPkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// A same-tx `child.configure(args)` on a freshly-deployed local is folded into the deploy genesis: the
// child is born already-configured in ONE transaction, with no co-spend. The covenant computes the
// post-configure genesis on-chain; the SDK reads it from the deploy probe trace (no childInitialState).
// See docs/deploy-then-call-fold.md.

const childSource = `
  contract FoldChild(bytes20 owner) {
    int counter;
    bytes20 admin;

    function configure(int c, bytes20 a) {
      this.counter = c;
      this.admin = a;
      require(true);
    }
  }
`;

const factorySource = `
  import "./fold_child.scash";
  contract FoldFactory(pubkey factoryOwner) {
    int deployCount;

    function deployConfigured(sig s, bytes20 childOwner, int c0, bytes20 a0) deploy {
      require(checkSig(s, factoryOwner));
      FoldChild child = new FoldChild(childOwner);
      child.configure(c0, a0);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

function createMapResolver(files: Record<string, string>) {
  return (importPath: string, currentFile: string): ResolvedImport | undefined => {
    const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
    let resolved = dir + importPath.replace('./', '');
    if (!resolved.endsWith('.scash')) resolved += '.scash';
    const source = files[resolved];
    if (source === undefined) return undefined;
    return { source, id: resolved };
  };
}

describe('deploy-then-call fold (deployFrom e2e)', () => {
  const childArtifact = compileString(childSource);
  const factoryArtifact = compileString(factorySource, {
    importResolver: createMapResolver({ '/fold_child.scash': childSource }),
    rootFileId: '/main.scash',
  });

  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

  it('the configure call is folded into the deploy genesis (no co-spend external call)', () => {
    const make = factoryArtifact.abi.find((f) => f.name === 'deployConfigured')!;
    expect(make.deployTargets).toEqual([{ contractName: 'FoldChild', dataNftCount: 1 }]);
    expect((make as { externalCalls?: unknown[] }).externalCalls).toBeUndefined();
  });

  it('deploys the factory', async () => {
    const fundingUtxo: Utxo = { txid: 'fa1d'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);

    const result = await StatefulContract.deploy(factoryArtifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });
    factory = result.contract;
    expect(factory.categoryId).toBeDefined();
  });

  it('deploys the child already-configured in one tx (counter=c0, admin=a0)', async () => {
    const fundingUtxo: Utxo = { txid: 'fb2d'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);

    const c0 = 42n;
    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'deployConfigured',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh, c0, bobPkh],
      childArtifact,
      childConstructorArgs: [alicePkh],
      // NOTE: no childInitialState - the post-configure genesis is computed by the covenant and
      // read back from the deploy probe trace.
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    // send() ran the deploy covenant: a successful tx means the covenant accepted the SDK-supplied
    // post-configure child genesis. (A wrong genesis - e.g. default counter=0 - would fail the covenant.)
    expect(result.tx.txid).toBeDefined();
    expect(result.childCategoryId).toBe(fundingUtxo.txid);

    const txOutputs = getTxOutputs(result.tx);

    // Factory state advanced.
    const factoryState = parsePushdataCommitment(
      txOutputs[1].token!.nft!.commitment, factoryArtifact.stateLayout!, 0,
    );
    expect(factoryState.deployCount).toBe(1n);

    // Child data NFT carries the POST-configure state, not the default.
    const childDataOutput = txOutputs.find(
      (o) => o.token?.category === fundingUtxo.txid && o.token?.nft?.capability === 'mutable',
    );
    expect(childDataOutput).toBeDefined();
    const childState = parsePushdataCommitment(
      childDataOutput!.token!.nft!.commitment, childArtifact.stateLayout!, 0,
    );
    expect(childState.counter).toBe(c0);
  });
});
