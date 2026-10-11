import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// `test/libsolidity/semanticTests/saltedCreate/salted_create_with_value.sol`: a deploy-then-call whose callee
// reads its OWN balance (`address(this).balance * 1000 + x`). The deploying transaction funds the child
// (`new Child{value: v}`), so the folded genesis must carry exactly that amount - the balance twin of the
// `msg.value` fold. The compiler-side pin is packages/solidc/test/DeployFoldGenesisBalance.test.ts; this runs
// the emitted covenant on the mock VM and reads the child genesis it verified.
const CHILD = `
contract Child {
    uint public x;
    uint public seen;
    constructor(uint _x) payable {
        x = _x;
    }
    function see() public view returns (uint) {
        return address(this).balance * 1000 + x;
    }
    function record() public {
        seen = address(this).balance * 1000 + x;
    }
}
`;

// The factory's deploy entry is deliberately unguarded, like the other deploy-mechanic fixtures here, so it
// compiles with the explicit permissionless opt-in. `expectation` is the value `see()` is required to equal:
// `v * 1000 + 7` holds for the fold this change enables, while a mismatching literal must reject the spend.
const factory = (expectation: string): string => `${CHILD}
contract Factory {
    uint deployCount;
    function make(uint v) public payable {
        Child c = new Child{value: v}(7);
        uint r = c.see();
        require(r == ${expectation});
        c.record();
        deployCount = deployCount + 1;
    }
}
`;

describe('folded callee that reads the child own balance (e2e)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const deployChild = async (expectation: string, v: bigint, tag: string):
  Promise<{ seen: bigint, x: bigint }> => {
    const factoryArtifact = compileString(factory(expectation), {
      evmCompat: true, allowUnsafeOperations: true,
    });
    const childArtifact = compileString(CHILD, { evmCompat: true });
    const factoryFunding: Utxo = { txid: tag.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, factoryFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider,
      fundingUtxo: factoryFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      // The factory's own satoshi container is the value source for `new Child{value: v}`.
      initialBalance: 20000n,
      changeAddress: p2pkh.address,
    });
    const childFunding: Utxo = { txid: (tag.slice(0, 3) + 'e').repeat(16), vout: 0, satoshis: 100000n };
    await provider.addUtxo(p2pkh.address, childFunding);
    const result = await StatefulContract.deployFrom({
      provider,
      factory: deployed.contract,
      deployFunctionName: 'make',
      deployFunctionArgs: [v],
      childArtifact,
      childConstructorArgs: [],
      // The deploy function funds the child with `new Child{value: v}`, so the SDK must move those sats.
      childValue: v,
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
    return { seen: childState.seen as bigint, x: childState.x as bigint };
  };

  it('verifies a genesis whose state is the funded child balance, not a default', async () => {
    const state = await deployChild('v * 1000 + 7', 1000n, 'a1c9');
    expect(state.x).toBe(7n);
    expect(state.seen).toBe(1000007n);
  });

  it('tracks the deploy value expression: a different amount folds a different balance', async () => {
    const state = await deployChild('v * 1000 + 7', 2000n, 'b2d8');
    expect(state.seen).toBe(2000007n);
  });

  it('rejects a spend whose expectation does not match the folded balance', async () => {
    // The guard is the same shape as the runs above; here the source asks for 5, which the folded balance
    // (1000007) cannot satisfy. A fold that read the caller's balance or a type default would not reject.
    await expect(deployChild('5', 1000n, 'c3e7'))
      .rejects.toThrow(/OP_VERIFY|Require statement failed|Error in transaction/);
  });
});
