/**
 * A send from a container holding a minting NFT mints the NFT the source asked for, and the container keeps its
 * minting NFT: an honest send used to move it out, burning the contract's minting authority. The covenant pins the
 * sent NFT's capability, so an immutable send that delivers a minting or mutable NFT is refused, and so is a container
 * that comes back without its minting NFT.
 */
import { binToHex, hexToBin, type Output, type Transaction } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePriv, alicePub, bobAddress, bobPkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const SOURCE = `
contract MintingSend() {
    int sent;

    function send(bytes32 series, bytes20 recipient, bytes commitment) {
        this.tokens[series].transferNft(new LockingBytecodeP2PKH(recipient), commitment, 0);
        this.sent = this.sent + 1;
    }

    function maybeSend(bytes32 series, bytes20 recipient, bytes commitment, bool go) {
        if (go) { this.tokens[series].transferNft(new LockingBytecodeP2PKH(recipient), commitment, 0); }
        this.sent = this.sent + 1;
    }
}
`;
const artifact = compileString(SOURCE);
const COMMITMENT = hexToBin('c0de');

/** A built call, master at input 0. */
interface Program { transaction: Transaction; sourceOutputs: Output[] }
type Nft = NonNullable<Output['token']>['nft'];

/** `program` with output `index` carrying `nft` in place of its own, its fungible amount kept. */
const withNft = (program: Program, index: number, nft: Nft): Program => {
  const outputs = program.transaction.outputs.map((output) => ({ ...output }));
  const { category, amount } = outputs[index]!.token!;
  outputs[index] = { ...outputs[index]!, token: { category, amount, ...(nft && { nft }) } };
  return { ...program, transaction: { ...program.transaction, outputs } };
};

interface Setup {
  provider: ReturnType<typeof createTestProvider>;
  contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
  series: string;
  containerAddress: string;
  build(call: { build(): Promise<TransactionBuilder> }): Promise<Program>;
  verdict(program: Program): unknown;
  /** The index of the output at `address` carrying the series. */
  at(program: Program, address: string): number;
}

async function setup(): Promise<Setup> {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const funding: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 300_000n };
  await provider.addUtxo(p2pkh.address, funding);
  const { contract } = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: funding, funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: { sent: 0n }, changeAddress: p2pkh.address,
  });
  // The series' genesis: its minting NFT, with fungible tokens, in the contract's container.
  const { categoryId: series } = await provider.addTokenUtxosDynamic((category) => [{
    address: contract.getTokenContainerAddress(category), satoshis: 1200n,
    token: { amount: 50n, nft: { capability: 'minting', commitment: '' } },
  }]);
  await provider.addUtxo(p2pkh.address, { txid: 'e2'.repeat(32), vout: 0, satoshis: 200_000n });
  const containerAddress = contract.getTokenContainerAddress(series);
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return {
    provider, contract, series, containerAddress,
    build: async (call) => {
      const builder = await call.build();
      return { transaction: builder.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(builder.inputs) };
    },
    verdict: (program) => vm.stateSuccess(vm.evaluate({ inputIndex: 0, ...program })),
    at: (program, address) => {
      const lock = binToHex(addressToLockScript(address));
      const index = program.transaction.outputs.findIndex((output) => binToHex(output.lockingBytecode) === lock
        && output.token !== undefined && binToHex(output.token.category) === series);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    },
  };
}

describe('a send from a container holding a minting NFT', () => {
  it('mints the immutable NFT the source asked for and leaves the container minting', async () => {
    const { provider, contract, series, containerAddress, build, verdict, at } = await setup();
    const honest = await build(contract.call.send(hexToBin(series), bobPkh, COMMITMENT));
    expect(verdict(honest)).toBe(true);
    expect(honest.transaction.outputs[at(honest, containerAddress)]!.token)
      .toEqual({ category: hexToBin(series), amount: 50n, nft: { capability: 'minting', commitment: Uint8Array.of() } });
    expect(honest.transaction.outputs[at(honest, bobAddress)]!.token)
      .toEqual({ category: hexToBin(series), amount: 0n, nft: { capability: 'none', commitment: COMMITMENT } });

    await contract.call.send(hexToBin(series), bobPkh, COMMITMENT).send();
    expect((await provider.getUtxos(containerAddress)).map((utxo) => utxo.token))
      .toMatchObject([{ category: series, amount: 50n, nft: { capability: 'minting', commitment: '' } }]);
    expect((await provider.getUtxos(bobAddress)).map((utxo) => utxo.token).filter((token) => token?.category === series))
      .toMatchObject([{ category: series, amount: 0n, nft: { capability: 'none', commitment: binToHex(COMMITMENT) } }]);

    // The settled container sends again, behind a condition.
    const conditional = await build(contract.call.maybeSend(hexToBin(series), bobPkh, COMMITMENT, true));
    expect(verdict(conditional)).toBe(true);
    expect(conditional.transaction.outputs[at(conditional, containerAddress)]!.token!.nft?.capability).toBe('minting');
  }, 300_000);

  it('refuses a minting or mutable NFT at the recipient, and a container that gives up its minting NFT', async () => {
    const { contract, series, containerAddress, build, verdict, at } = await setup();
    const honest = await build(contract.call.send(hexToBin(series), bobPkh, COMMITMENT));
    expect(verdict(honest)).toBe(true);
    // The send's category, capability byte included, is pinned to the immutable NFT the source asked for.
    const recipient = at(honest, bobAddress);
    for (const capability of ['minting', 'mutable'] as const) {
      expect(verdict(withNft(honest, recipient, { capability, commitment: COMMITMENT })))
        .toMatch(/^Program failed an OP_(EQUAL)?VERIFY operation\.$/);
    }
    const conditional = await build(contract.call.maybeSend(hexToBin(series), bobPkh, COMMITMENT, true));
    for (const program of [honest, conditional]) {
      const container = at(program, containerAddress);
      expect(verdict(program)).toBe(true);
      expect(verdict(withNft(program, container, undefined))).not.toBe(true);
      expect(verdict(withNft(program, container, { capability: 'mutable', commitment: Uint8Array.of() }))).not.toBe(true);
    }
  }, 300_000);
});
