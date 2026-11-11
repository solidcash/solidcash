import { binToHex, cashAddressToLockingBytecode, encodeCashAddress, encodeTransaction, hash160, secp256k1 } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { SignatureTemplate, Signer } from '../src/index.js';
import { MockNetworkProvider } from '../src/network/mock/index.js';
import { StatefulContract } from '../src/stateful/index.js';
import type { WcTransactionObject } from '../src/walletconnect-utils.js';

// A wallet's coin funds a direct stateful call and the wallet signs it at broadcast: the SDK holds no key. Its input
// carries a placeholder through the build, which the final preflight must not evaluate.
describe('a direct stateful call funded by an external wallet', () => {
  const source = `pragma solidcash ^0.14.0;
contract Counter() {
    uint32 count;
    constructor() { this.count = 0; }
    function deposit() public payable {
        require(msg.value == 5000, "value");
        this.count = this.count + 1;
    }
}`;
  const key = new Uint8Array(32).fill(0x37);
  const publicKey = secp256k1.derivePublicKeyCompressed(key) as Uint8Array;
  const address = encodeCashAddress({ prefix: 'bchtest', type: 'p2pkh', payload: hash160(publicKey) }).address;
  const lock = (cashAddressToLockingBytecode(address) as { bytecode: Uint8Array }).bytecode;

  const setUp = async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const [deployer] = await provider.getSigners(1, { fundingUtxos: 4 });
    await provider.seedUtxo(address, { txid: 'ab'.repeat(32), vout: 0, satoshis: 1_000_000n });
    const fundingUtxo = (await deployer.getUtxos()).find((coin) => coin.vout === 0 && !coin.token)!;
    const { contract } = await StatefulContract.deploy(compileString(source, {}), [], {
      provider, fundingUtxo, funder: deployer.unlockP2PKH(), changeAddress: deployer.getAddress(), initialBalance: 1_200n,
    });
    return { provider, contract };
  };

  it('stops the send when the wallet declines', async () => {
    const { provider, contract } = await setUp();
    let asked = 0;
    const wallet = { signTransaction: async () => { asked += 1; return undefined; } };
    await expect(contract.connect(Signer.external({ wallet, address }, provider)).call.deposit().withValue(5000n).send())
      .rejects.toThrow(/did not sign/);
    expect(asked).toBe(1);
  });

  it('refuses a wallet that changes the transaction', async () => {
    const { provider, contract } = await setUp();
    const wallet = {
      signTransaction: async ({ transaction }: WcTransactionObject) => ({
        signedTransaction: binToHex(encodeTransaction({
          ...transaction,
          outputs: transaction.outputs.map((output, index) => (
            index === 0 ? { ...output, valueSatoshis: output.valueSatoshis + 1n } : output)),
        })),
      }),
    };
    await expect(contract.connect(Signer.external({ wallet, address }, provider)).call.deposit().withValue(5000n).send())
      .rejects.toThrow(/changed output/);
  });

  it('broadcasts what the wallet signed, and the node judges that signature', async () => {
    const { provider, contract } = await setUp();
    const template = new SignatureTemplate(key);
    const sign = ({ transaction, sourceOutputs }: WcTransactionObject, unlocker = template.unlockP2PKH()) => ({
      signedTransaction: binToHex(encodeTransaction({
        ...transaction,
        inputs: transaction.inputs.map((input, inputIndex) => (
          input.unlockingBytecode.length === 0 && binToHex(sourceOutputs[inputIndex].lockingBytecode) === binToHex(lock)
            ? { ...input, unlockingBytecode: unlocker.generateUnlockingBytecode({ transaction, sourceOutputs, inputIndex }) }
            : input)),
      })),
    });
    const details = await contract.connect(Signer.external({ wallet: { signTransaction: async (r: WcTransactionObject) => sign(r) }, address }, provider))
      .call.deposit().withValue(5000n).send();
    expect(details.txid).toMatch(/^[0-9a-f]{64}$/);
    expect((await contract.getState()).count).toBe(1n);

    // A wallet that signs with the wrong key is caught by the node: a preflight receipt must not stand in for it.
    const wrong = new SignatureTemplate(new Uint8Array(32).fill(0x38));
    const forged = { signTransaction: async (r: WcTransactionObject) => sign(r, { generateUnlockingBytecode: (options: any) => {
      const honest = template.unlockP2PKH().generateUnlockingBytecode(options);
      const bad = wrong.unlockP2PKH().generateUnlockingBytecode(options);
      return Uint8Array.from([...bad.slice(0, 66), ...honest.slice(66)]);
    } } as any) };
    await expect(contract.connect(Signer.external({ wallet: forged, address }, provider)).call.deposit().withValue(5000n).send())
      .rejects.toThrow();
    expect((await contract.getState()).count).toBe(1n);
  });
});
