import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// A deploy-then-call whose callee does real work must still fold it, while the statements the replay discards
// by design - an inert expression (`this.balance;`) and a transfer to the callee's OWN address - must not stop
// the fold or corrupt the genesis. The compiler-side pin is packages/solidc/test/DeployFoldOwnMemberCall.test.ts;
// this runs the emitted covenant on the mock VM and reads the child genesis it verified.
const CHILD = `
contract Child {
    uint public touched;
    uint public seen;
    constructor(uint seed) payable {
        seen = seed;
    }
    function touch() public {
        touched = touched + 1;
    }
    function probe() public {
        this.balance;
    }
    function paySelf() public {
        payable(this).transfer(1);
    }
}
`;

const FACTORY = `${CHILD}
contract Factory {
    uint deployCount;
    function make(uint seed) public {
        Child c = new Child(seed);
        c.touch();
        c.probe();
        c.paySelf();
        deployCount = deployCount + 1;
    }
}
`;

describe('folded deploy-then-call whose replay discards work (e2e)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const factoryArtifact = compileString(FACTORY, {
    evmCompat: true, enforceFinalRequire: false, allowUnsafeOperations: true,
  });
  const childArtifact = compileString(CHILD, { evmCompat: true, enforceFinalRequire: false });

  it('folds the real write and drops the inert statements, with the child genesis verified on chain', async () => {
    const factoryFunding: Utxo = { txid: 'd901'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, factoryFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider,
      fundingUtxo: factoryFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });

    const childFunding: Utxo = { txid: 'd902'.repeat(16), vout: 0, satoshis: 100000n };
    await provider.addUtxo(p2pkh.address, childFunding);
    const seed = 7n;
    const result = await StatefulContract.deployFrom({
      provider,
      factory: deployed.contract,
      deployFunctionName: 'make',
      deployFunctionArgs: [seed],
      childArtifact,
      childConstructorArgs: [],
      fundingUtxo: childFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    const outputs = getTxOutputs(result.tx);
    const childData = outputs.find((o, i) => i >= 2 && o.token?.nft?.capability === 'mutable'
      && o.token?.category === result.childCategoryId);
    expect(childData).toBeDefined();
    const childState = parsePushdataCommitment(
      childData!.token!.nft!.commitment, childArtifact.stateLayout!, 0,
    );
    // The folded `c.touch()` ran: the covenant's genesis contains the incremented field.
    expect(childState.touched).toBe(1n);
    expect(childState.seen).toBe(seed);
  });
});
