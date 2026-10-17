import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * A factory `deploy` function that both deploys a child and hashes a direct unbounded `bytes` argument whose
 * runtime length exceeds the single compute side-car's 3-block budget. The chained START/CONT/FINAL side-cars
 * ride the deploy function's trailing region, and the finalized deployFrom transaction must co-spend them.
 */
const SOURCE = `
contract Child(bytes20 owner) {
    int counter;
    function increment() { require(owner != bytes20(0)); this.counter = this.counter + 1; }
}
contract HashFactory() {
    bytes32 digest;
    int childCount;

    function createAndHash(bytes20 owner, bytes memory bigData, int fundingInputIndex) {
        new Child(owner);
        require(tx.inputs[fundingInputIndex].outpointTransactionHash != 0x0000000000000000000000000000000000000000000000000000000000000000);
        digest = keccak256(bigData);
        this.childCount = this.childCount + 1;
    }

    function check(bytes32 expected) public view {
        require(digest == expected);
    }
}`;

const bigPreimage = (): Uint8Array => {
  const out = new Uint8Array(2_000);
  for (let i = 0; i < out.length; i += 1) out[i] = (i * 13 + 7) & 0xff;
  return out;
};

describe('chained keccak256 side-cars in a factory deploy', () => {
  it('deploys a child and hashes a >407-byte runtime argument through the chained side-cars', async () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const artifacts = compileStringMulti(SOURCE, { allowUnsafeOperations: true });
    const factoryArtifact = artifacts.HashFactory;
    const childArtifact = artifacts.Child;

    // Deploy the factory.
    const factoryFunding: Utxo = { txid: 'c1cd'.repeat(16), vout: 0, satoshis: 1_000_000n };
    await provider.addUtxo(p2pkh.address, factoryFunding);
    const factoryResult = await StatefulContract.deploy(factoryArtifact, [], {
      provider,
      fundingUtxo: factoryFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n },
      changeAddress: p2pkh.address,
    });

    // Deploy the child while hashing a >407-byte runtime argument in the same deploy function.
    const childFunding: Utxo = { txid: 'c2cd'.repeat(16), vout: 0, satoshis: 1_000_000n };
    await provider.addUtxo(p2pkh.address, childFunding);
    const createAbi = factoryArtifact.abi.find((f) => f.name === 'createAndHash')!;
    const requiredNftCount = createAbi.requiredNftIndices?.length ?? factoryArtifact.stateLayout!.dataNftCount;
    const fundingInputIndex = 1 + requiredNftCount;
    const preimage = bigPreimage();

    const result = await StatefulContract.deployFrom({
      provider,
      factory: factoryResult.contract,
      deployFunctionName: 'createAndHash',
      deployFunctionArgs: [alicePkh, preimage, BigInt(fundingInputIndex)],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
      fundingUtxo: childFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    expect(result.childCategoryId).toBe(childFunding.txid);

    // The factory's post-call digest must equal the off-chain keccak_256 of the preimage.
    await expect(
      factoryResult.contract.getFunction('check')(keccak_256(preimage)).send(),
    ).resolves.toBeDefined();
  }, 300_000);
});
