/**
 * NAMED-MINT-1 (docs/security/security-audit-2026-10-16.md): a direct call that names a container holding a minting
 * NFT spends it, and a spent minting NFT lets the transaction mint its category freely. The call now bounds those
 * mints: every output outside the container's lock carrying the category is an NFT the call sent from the slot. A call
 * that reads the container, keeping the minting NFT in place, settles at the master; the same transaction with an NFT
 * of the category minted to another output is refused there.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider, genesisNftContainer } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const SOURCE = `
contract Minter() {
    int minted;

    function peek(bytes32 series) {
        require(this.tokens[series].tokenAmount >= 0);
        this.minted = this.minted + 1;
    }
}
`;

describe('NAMED-MINT-1: a named minting container bounds what its transaction mints', () => {
  it('settles a read that keeps the minting container and refuses an NFT minted beside it', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const alice = new SignatureTemplate(alicePriv);
    const funding: Utxo = { txid: 'd1'.repeat(32), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(p2pkh.address, funding);
    const { contract, categoryId } = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: funding, funder: p2pkh.unlock.spend(alicePub, alice),
      initialState: { minted: 0n }, changeAddress: p2pkh.address,
    });
    const { category } = await genesisNftContainer(provider, contract.inner, categoryId, [''], 'minting');
    await provider.addUtxo(p2pkh.address, { txid: 'd2'.repeat(32), vout: 0, satoshis: 200_000n });
    const builder = await contract.call.peek(hexToBin(category)).build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const masterAccepts = (tx: typeof transaction): unknown =>
      vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction: tx }));
    expect(masterAccepts(transaction)).toBe(true);
    expect(transaction.outputs.some((output) => output.token !== undefined
      && binToHex(output.token.category) === category && output.token.nft?.capability === 'minting')).toBe(true);

    const change = transaction.outputs.length - 1;
    const minted = {
      ...transaction,
      outputs: [
        ...transaction.outputs.slice(0, change),
        {
          lockingBytecode: addressToLockScript(p2pkh.address), valueSatoshis: 1_000n,
          token: { category: hexToBin(category), amount: 0n, nft: { capability: 'none' as const, commitment: hexToBin('ee') } },
        },
        transaction.outputs[change]!,
      ],
    };
    expect(masterAccepts(minted)).not.toBe(true);
  }, 300_000);
});
