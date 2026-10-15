/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '../direct-compile.js';
import {
  Contract,
  HashType,
  SignatureTemplate,
  Signer,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getDataNftAddress, getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { Utxo } from '../../src/interfaces.js';
import { createTestProvider } from '../test-util.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { addressToLockScript } from '../../src/utils.js';

// A fresh UniswapV2Factory.createPair shape: a typed stateful UniswapV2Pair child plus a dual-direction
// sorted nested mapping `getPair[tokenA][tokenB] = pair`. The child's address (`UniswapV2Pair p = new
// UniswapV2Pair(...)`) is the mapping value, matching Uniswap's `getPair(token0, token1) -> pair`.
const SOURCE = `
contract UniswapV2Pair(bytes20 owner) {
    int counter;
    function increment() { require(owner != bytes20(0)); this.counter = this.counter + 1; }
}
contract UniswapV2Factory() {
    mapping(bytes32 => mapping(bytes32 => address)) getPair;
    function createPair(bytes32 tokenA, bytes32 tokenB) {
        UniswapV2Pair p = new UniswapV2Pair(bytes20(0));
        require(this.getPair[tokenA][tokenB] == address(0));
        this.getPair[tokenA][tokenB] = p;
        this.getPair[tokenB][tokenA] = p;
    }
    function pair(bytes32 a, bytes32 b) view returns (address) { return this.getPair[a][b]; }
}`;
// The deploy entry is permissionless on purpose: this suite pins the covenant's output topology, not its
// authorization. The emitted covenant is unchanged, so every tampered transaction below still fails verify.
const PERMISSIONLESS = { allowUnsafeOperations: true } as const;

describe('UniswapV2Factory.createPair deployDataNft + dual getPair', () => {
  const artifacts = compileStringMulti(SOURCE, PERMISSIONLESS);
  const factoryArtifact = artifacts.UniswapV2Factory;
  const childArtifact = artifacts.UniswapV2Pair;

  it('layout reserves deployDataNft and dual-direction entry accesses', () => {
    const createPair = factoryArtifact.abi.find((f) => f.name === 'createPair')!;
    expect(createPair.modifiers).toContain('deploy');
    expect(createPair.deployTargets?.[0]?.dataNftCount).toBe(childArtifact.stateLayout!.dataNftCount);
    expect(createPair.blockLayout?.slots.filter((s) => s.kind === 'deployDataNft'))
      .toHaveLength(childArtifact.stateLayout!.dataNftCount);
    // Both write directions land as fixed entry slots before the child genesis.
    expect(createPair.entryAccesses).toHaveLength(2);
    expect(createPair.blockLayout?.slots.map((s) => s.kind))
      .toEqual(['master', 'entry', 'entry', 'deploy', 'deployDataNft']);
  });

  it('deploys the pair child and both getPair directions read back', async () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    const factoryFunding: Utxo = { txid: 'c1'.repeat(32), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(p2pkh.address, factoryFunding);
    const { contract: factory } = await StatefulContract.deploy(factoryArtifact, [], {
      provider,
      fundingUtxo: factoryFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: {},
      changeAddress: p2pkh.address,
    });

    const childFunding: Utxo = { txid: 'c2'.repeat(32), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(p2pkh.address, childFunding);

    const tokenA = 'aa'.repeat(32);
    const tokenB = 'bb'.repeat(32);
    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'createPair',
      deployFunctionArgs: [tokenA, tokenB],
      childArtifact,
      childConstructorArgs: [new Uint8Array(20)],
      childInitialState: { counter: 0n },
      fundingUtxo: childFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    expect(result.childCategoryId).toBe(childFunding.txid);
    expect(result.tx.txid).toBeDefined();

    // Both getPair directions read back the deployed pair's locking bytecode.
    const expectedLock = addressToLockScript(result.child.address);
    const pairAB = await (factory as any).getPair(hexToBin(tokenA), hexToBin(tokenB));
    const pairBA = await (factory as any).getPair(hexToBin(tokenB), hexToBin(tokenA));
    expect(pairAB).toBeInstanceOf(Uint8Array);
    expect(pairBA).toBeInstanceOf(Uint8Array);
    expect(binToHex(pairAB as Uint8Array)).toBe(binToHex(expectedLock));
    expect(binToHex(pairBA as Uint8Array)).toBe(binToHex(expectedLock));
  });

  // Mock-only: rewinds with provider.takeSnapshot(), which RegtestNetworkProvider does not implement.
  it.skipIf(process.env.TESTS_USE_REGTEST)(
    'rejects a createPair transaction whose child data-NFT output is permuted against an entry output', async () => {
      const provider = createTestProvider();
      // The dual-direction insert co-spends one HEAD predecessor, so the second entry slot needs a placeholder
      // input. Connect Alice's signer (whose plain P2PKH UTXOs the deployFrom funder pool reuses) so that
      // placeholder is a PRE-EXISTING coin rather than one minted mid-build - a minted coin would be reverted
      // by the snapshot restore below and leave the tampered re-send with a missing input. The funder and
      // change address share Alice's P2PKH so the placeholder unlocker and its UTXO agree.
      const aliceSigner = new Signer(alicePriv, provider);
      const aliceAddr = aliceSigner.getAddress();

      const factoryFunding: Utxo = { txid: 'c3'.repeat(32), vout: 0, satoshis: 300_000n };
      await provider.addUtxo(aliceAddr, factoryFunding);
      const { contract: factory } = await StatefulContract.deploy(factoryArtifact, [], {
        provider,
        fundingUtxo: factoryFunding,
        funder: aliceSigner.unlockP2PKH(),
        initialState: {},
        changeAddress: aliceAddr,
      });
      const connectedFactory = factory.connect(aliceSigner);

      const childFunding: Utxo = { txid: 'c4'.repeat(32), vout: 0, satoshis: 200_000n };
      await provider.addUtxo(aliceAddr, childFunding);
      // Placeholder pool coin, pre-existing so it survives the snapshot restore.
      const placeholderCoin: Utxo = { txid: 'c5'.repeat(32), vout: 0, satoshis: 50_000n };
      await provider.addUtxo(aliceAddr, placeholderCoin);

      // Capture AND apply the deployFrom transaction, then rewind. SIGHASH_NONE keeps the funder signature off
      // the outputs, so the output permute is refused by the covenant rather than by a signature mismatch.
      const beforeDeploy = await provider.takeSnapshot();
      let captured = '';
      const send = provider.sendRawTransaction.bind(provider);
      (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
        captured = hex;
        return send(hex);
      };
      let result: Awaited<ReturnType<typeof StatefulContract.deployFrom>>;
      try {
        result = await StatefulContract.deployFrom({
          provider,
          factory: connectedFactory,
          deployFunctionName: 'createPair',
          deployFunctionArgs: ['aa'.repeat(32), 'bb'.repeat(32)],
          childArtifact,
          childConstructorArgs: [new Uint8Array(20)],
          childInitialState: { counter: 0n },
          fundingUtxo: childFunding,
          funder: new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE).unlockP2PKH(),
          changeAddress: aliceAddr,
        });
      } finally {
        (provider as any).sendRawTransaction = send;
      }
      expect(captured).not.toBe('');
      expect(result.childCategoryId).toBe(childFunding.txid);
      await beforeDeploy.restore();

      // Identify the child data-NFT output and a factory entry output by their (off-chain recomputed) locking
      // bytecodes, not hard-coded indices.
      const childDataLock = addressToLockScript(
        getDataNftAddress(result.child.inner, result.childCategoryId),
      );
      const entryLock = addressToLockScript(
        getEntryNftAddress(factory.inner, factory.categoryId, 'getPair'),
      );
      const rejectMutation = async (
        mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>, childDataIdx: number, entryIdx: number) => void,
      ): Promise<void> => {
        await beforeDeploy.restore();
        const tx = decodeTransactionUnsafe(hexToBin(captured));
        const childDataIdx = tx.outputs.findIndex(
          (output) => binToHex(output.lockingBytecode) === binToHex(childDataLock),
        );
        const entryIdx = tx.outputs.findIndex(
          (output) => binToHex(output.lockingBytecode) === binToHex(entryLock),
        );
        expect(childDataIdx).toBeGreaterThanOrEqual(0);
        expect(entryIdx).toBeGreaterThanOrEqual(0);
        mutate(tx, childDataIdx, entryIdx);
        await send(binToHex(encodeTransaction(tx)));
      };
      const covenantFailure = /mandatory-script-verify-flag-failed/;

      await expect(rejectMutation((tx, childDataIdx, entryIdx) => {
        [tx.outputs[childDataIdx], tx.outputs[entryIdx]] = [
          tx.outputs[entryIdx], tx.outputs[childDataIdx],
        ];
      })).rejects.toThrow(covenantFailure);

      // The untouched transaction is the one the covenant accepts.
      await beforeDeploy.restore();
      await expect(send(captured)).resolves.toBeTypeOf('string');
    }, 180_000,
  );
});
