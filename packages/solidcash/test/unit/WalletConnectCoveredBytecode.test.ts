// Regression: a WalletConnect wallet must be able to sign a function of a multi-function contract.
// For an OP_INVOKE'd function the signature covers the function body, so getWcContractInfo() must pass that body as
// `contract.redeemScript`, the field BCH WalletConnect wallets sign over (covered bytecode).
import {
  binToHex, createVirtualMachineBch2026, decodeTransaction, encodeTransaction, generateSigningSerializationBch,
  hash160, hash256, hexToBin, secp256k1,
} from '@bitauth/libauth';
import { Contract, TransactionBuilder, randomUtxo } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { placeholderPublicKey, placeholderSignature } from '../../src/walletconnect-utils.js';
import { compileString } from '../direct-compile.js';

const source = `pragma solidcash >=0.8.0;
contract TwoFunctions(bytes20 owner) {
  function pay() { require(tx.outputs.length >= 1); }
  function spend(pubkey pk, sig s) { require(hash160(pk) == owner); require(checkSig(s, pk)); }
}`;

const SIGHASH_ALL_UTXOS_FORKID = 0x61;

// What a WalletConnect wallet does with a sign request: sign each contract input over `contract.redeemScript` and
// replace the signature and public key placeholders.
function walletSign(wc: any, privateKey: Uint8Array): Uint8Array {
  const publicKey = secp256k1.derivePublicKeyCompressed(privateKey) as Uint8Array;
  const transaction = { ...wc.transaction, inputs: wc.transaction.inputs.map((i: any) => ({ ...i })) };
  transaction.inputs.forEach((input: any, inputIndex: number) => {
    const sourceOutput = wc.sourceOutputs[inputIndex];
    if (!sourceOutput.contract) return;
    const preimage = generateSigningSerializationBch(
      { inputIndex, sourceOutputs: wc.sourceOutputs, transaction },
      {
        coveredBytecode: sourceOutput.contract.redeemScript,
        signingSerializationType: Uint8Array.of(SIGHASH_ALL_UTXOS_FORKID),
      },
    );
    const signature = secp256k1.signMessageHashSchnorr(privateKey, hash256(preimage)) as Uint8Array;
    input.unlockingBytecode = hexToBin(binToHex(input.unlockingBytecode)
      .replace(`41${'00'.repeat(65)}`, `41${binToHex(signature)}61`)
      .replace(`21${'00'.repeat(33)}`, `21${binToHex(publicKey)}`));
  });
  return encodeTransaction(transaction);
}

describe('WalletConnect covered bytecode for OP_INVOKE functions', () => {
  it('a wallet signature on a dispatched function verifies', () => {
    const artifact = compileString(source);
    const privateKey = Uint8Array.from({ length: 32 }, (_, i) => (i === 31 ? 7 : 0x33));
    const publicKey = secp256k1.derivePublicKeyCompressed(privateKey) as Uint8Array;
    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [hash160(publicKey)], { provider });
    const utxo = { ...randomUtxo(), satoshis: 60_000n };
    provider.addUtxo(contract.address, utxo);

    const wc: any = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.spend(placeholderPublicKey(), placeholderSignature()))
      .addOutput({ to: contract.address, amount: 59_000n })
      .generateWcTransactionObject({ broadcast: false });

    const transaction = decodeTransaction(walletSign(wc, privateKey));
    if (typeof transaction === 'string') throw new Error(transaction);
    const result = createVirtualMachineBch2026().verify({ sourceOutputs: wc.sourceOutputs, transaction });
    expect(result).toBe(true);
  });

  it('a wallet signature on the second overload of a name covers that overload\'s body', () => {
    const overloaded = `pragma solidcash >=0.8.0;
contract Overloaded(bytes20 owner) {
  function spend(pubkey pk, sig s) { require(hash160(pk) == owner); require(checkSig(s, pk)); }
  function spend(pubkey pk, sig s, int floor) {
    require(tx.outputs[0].value >= floor); require(hash160(pk) == owner); require(checkSig(s, pk));
  }
}`;
    const artifact = compileString(overloaded);
    const privateKey = Uint8Array.from({ length: 32 }, (_, i) => (i === 31 ? 9 : 0x44));
    const publicKey = secp256k1.derivePublicKeyCompressed(privateKey) as Uint8Array;
    const provider = new MockNetworkProvider();
    const contract: any = new Contract(artifact, [hash160(publicKey)], { provider });
    const utxo = { ...randomUtxo(), satoshis: 60_000n };
    provider.addUtxo(contract.address, utxo);

    const wc: any = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock['spend(pubkey,sig,int256)'](placeholderPublicKey(), placeholderSignature(), 1_000n))
      .addOutput({ to: contract.address, amount: 59_000n })
      .generateWcTransactionObject({ broadcast: false });
    expect(wc.sourceOutputs[0].contract.abiFunction.inputs).toHaveLength(3);

    const transaction = decodeTransaction(walletSign(wc, privateKey));
    if (typeof transaction === 'string') throw new Error(transaction);
    const result = createVirtualMachineBch2026().verify({ sourceOutputs: wc.sourceOutputs, transaction });
    expect(result).toBe(true);
  });
});
