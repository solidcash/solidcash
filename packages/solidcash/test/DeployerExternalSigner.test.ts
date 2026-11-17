/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it } from 'vitest';
import {
  binToHex, cashAddressToLockingBytecode, encodeCashAddress, encodeTransaction, hash160, hashTransactionUiOrder,
  hexToBin, secp256k1,
} from '@bitauth/libauth';
import { MockNetworkProvider } from '../src/network/mock/index.js';
import { SignatureTemplate, Signer } from '../src/index.js';
import { ContractFactory, buildDeployerPreps } from '../src/stateful/index.js';
import { clearGenesisReservations } from '../src/stateful/genesis-reservations.js';
import type { WcTransactionObject } from '../src/walletconnect-utils.js';
import { compileStringMulti } from './direct-compile.js';
import { alicePriv } from './fixture/vars.js';

// A child created through its deployer by a wallet the SDK holds no key for: a WalletConnect session or a browser
// extension. The prep's txid is the child's category, so the wallet signs the prep first; it then signs the creation,
// before any prep is broadcast, so a wallet that declines leaves nothing on chain.
describe('a creation through a deployer, signed by an external wallet', () => {
  const source = `pragma solidcash ^0.51.0;
pragma satoshicontainer single;
contract Pool(uint8 exponent) {
    bytes32 me;
    uint32 live;
    constructor() {
        require(exponent >= 6 && exponent <= 10, "exponent");
        this.me = this.category;
    }
    function deposit(bytes32 commitment) public payable {
        this.me = commitment;
        this.live = this.live + 1;
    }
}
contract PoolDeployer {
    event PoolCreated(bytes32 indexed category, uint8 exponent);
    function create(uint8 exponent) public {
        Pool pool = new Pool{args: (exponent)}();
        emit PoolCreated(pool.category, exponent);
    }
}`;
  const artifacts = compileStringMulti(source, { allowUnsafeOperations: true });
  const key = new Uint8Array(32).fill(0x37);
  const publicKey = secp256k1.derivePublicKeyCompressed(key) as Uint8Array;
  const address = encodeCashAddress({ prefix: 'bchtest', type: 'p2pkh', payload: hash160(publicKey) }).address;
  const lock = (cashAddressToLockingBytecode(address) as { bytecode: Uint8Array }).bytecode;
  const template = new SignatureTemplate(key);

  /** A wc2 wallet: it signs the empty inputs at its own lock, or declines, in the order given. */
  const walletThat = (answers: Array<'sign' | 'decline'>) => {
    const asked: string[] = [];
    const wallet = {
      signTransaction: async ({ transaction, sourceOutputs, userPrompt }: WcTransactionObject) => {
        asked.push(userPrompt ?? '');
        if (answers[asked.length - 1] !== 'sign') return undefined;
        return {
          signedTransaction: binToHex(encodeTransaction({
            ...transaction,
            inputs: transaction.inputs.map((input, inputIndex) => (
              input.unlockingBytecode.length === 0 && binToHex(sourceOutputs[inputIndex].lockingBytecode) === binToHex(lock)
                ? {
                  ...input,
                  unlockingBytecode: template.unlockP2PKH()
                    .generateUnlockingBytecode({ transaction, sourceOutputs, inputIndex }),
                }
                : input)),
          })),
        };
      },
    };
    return { wallet, asked };
  };

  // The factory is someone else's. The wallet holds one coin, at vout 0, and the prep spends it: a creation through
  // a deployer needs no genesis coin of its own.
  const setUp = async (answers: Array<'sign' | 'decline'>) => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const owner = new Signer(alicePriv, provider);
    await provider.seedUtxo(owner.getAddress(), { txid: 'a1'.repeat(32), vout: 0, satoshis: 200_000n });
    const deployed: any = await new ContractFactory(artifacts.PoolDeployer as never, owner).deploy();
    await provider.seedUtxo(address, { txid: 'ab'.repeat(32), vout: 0, satoshis: 100_000n });
    const { wallet, asked } = walletThat(answers);
    const signer = Signer.external({ wallet, address, userPrompt: 'Create a pool' }, provider);
    const factory: any = deployed.connect(signer);
    factory.registerChild(artifacts.Pool);
    const prepCoin = (await signer.getUtxos()).find((coin) => coin.txid === 'ab'.repeat(32))!;
    const prepare = () => buildDeployerPreps({
      provider,
      children: [{ contractName: 'Pool', deployer: (artifacts.PoolDeployer as any).childDeployers.Pool }],
      fundingUtxos: [prepCoin],
      authorSigner: signer.unlockP2PKH(),
      authorLockingBytecode: lock,
      changeLockingBytecode: lock,
    });
    const untouched = async () => (await provider.getUtxos(address)).some((coin) => coin.txid === 'ab'.repeat(32));
    return { factory, signer, asked, prepare, untouched };
  };

  it('signs the prep, then the creation, and the child takes the signed prep\'s txid', async () => {
    const { factory, signer, asked, prepare } = await setUp(['sign', 'sign']);
    const { preps } = await prepare();
    expect(binToHex(hashTransactionUiOrder(hexToBin(preps[0].transactionHex)))).toBe(preps[0].category);
    const result = await factory.create(8n).deploy({
      deployerPreps: preps, funder: signer.unlockP2PKH(), changeAddress: address,
    });
    expect(result.childCategoryId).toBe(preps[0].category);
    expect(result.tx.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(asked).toEqual(['Create a pool', 'Create a pool']);
  });

  it('broadcasts nothing when the wallet declines the creation', async () => {
    const { factory, signer, asked, prepare, untouched } = await setUp(['sign', 'decline']);
    const { preps } = await prepare();
    await expect(factory.create(8n).deploy({
      deployerPreps: preps, funder: signer.unlockP2PKH(), changeAddress: address,
    })).rejects.toThrow(/did not sign/);
    expect(asked.length).toBe(2);
    expect(await untouched()).toBe(true);
  });

  it('builds no prep when the wallet declines it', async () => {
    const { asked, prepare, untouched } = await setUp(['decline']);
    await expect(prepare()).rejects.toThrow(/did not sign/);
    expect(asked.length).toBe(1);
    expect(await untouched()).toBe(true);
  });
});
