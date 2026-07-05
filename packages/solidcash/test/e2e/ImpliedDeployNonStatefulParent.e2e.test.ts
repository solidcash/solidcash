import { compileString } from 'solidc';
import { ResolvedImport } from '@solidcash/utils';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// A contract with NO state of its own that instantiates a stateful child is made stateful (zero-state) to host
// the implied deploy: `new Child()` in a plain function infers the `deploy` modifier. This reuses the inline
// `new Child()` deploy machinery (see DeployThenCallFold) with a zero-state parent (the forceStateful path).
const CHILD_SRC = `
  contract ImpliedChild(bytes20 owner) {
    int counter;
    function bump() { this.counter = this.counter + 1; require(true); }
  }
`;
const PARENT_SRC = `
  import "./implied_child.scash";
  contract ImpliedParent() {
    function makeChild(bytes20 owner) { ImpliedChild c = new ImpliedChild(owner); }
  }
`;

describe('implied deploy from a non-stateful parent (forced stateful)', () => {
  const childArtifact = compileString(CHILD_SRC);
  const parentArtifact = compileString(PARENT_SRC, {
    importResolver: (importPath: string, currentFile: string): ResolvedImport | undefined => {
      const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
      let resolved = dir + importPath.replace('./', '');
      if (!resolved.endsWith('.scash')) resolved += '.scash';
      return resolved === '/implied_child.scash' ? { source: CHILD_SRC, id: resolved } : undefined;
    },
    rootFileId: '/main.scash',
  });

  it('the parent is a zero-state stateful contract with makeChild as an (implied) deploy function', () => {
    expect(parentArtifact.stateLayout).toBeDefined();
    expect(parentArtifact.stateLayout!.variables.length).toBe(0);
    const makeChild = parentArtifact.abi.find((f) => f.name === 'makeChild');
    expect(makeChild!.modifiers).toContain('deploy');
  });

  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let parent: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

  it('deploys the zero-state parent', async () => {
    const fundingUtxo: Utxo = { txid: 'ef01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const result = await StatefulContract.deploy(parentArtifact, [], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: {},
      changeAddress: p2pkh.address,
    });
    parent = result.contract;
    expect(parent.categoryId).toBe(fundingUtxo.txid);
  });

  it('deploys the stateful child through the parent in one tx', async () => {
    const fundingUtxo: Utxo = { txid: 'ef02'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const result = await StatefulContract.deployFrom({
      provider,
      factory: parent,
      deployFunctionName: 'makeChild',
      deployFunctionArgs: [alicePkh],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
    expect(result.childCategoryId).toBe(fundingUtxo.txid);
    expect(result.child.categoryId).toBe(result.childCategoryId);
    expect(result.tx.txid).toBeDefined();
    // the child's genesis data NFT rides the tx
    expect(getTxOutputs(result.tx).some((o) => o.token?.category === result.childCategoryId)).toBe(true);
  });
});
