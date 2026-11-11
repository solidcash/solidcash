import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransaction, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { bytesToHex, parsePushdataCommitment } from '@solidcash/utils';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { HDSigner } from '../../../src/HDSigner.js';
import { SignatureTemplate, Signer, TransactionBuilder } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import type { FramedFunctionCall } from '../../../src/framed/call/index.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import {
  ExternalSigningError, externalSignaturePlaceholder, type ExternalTransactionSigner,
} from '../../../src/external-signing.js';
import type { WcTransactionObject } from '../../../src/walletconnect-utils.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A signer whose key a wallet holds (`Signer.external`): the SDK composes with a placeholder of the signature's size
 * and sighash byte in the wallet's inputs, hands the wallet the transaction with those inputs empty, as
 * `bch_signTransaction` asks, and broadcasts what it signs. A framed root frame's caller is the wallet's account, and
 * a wallet that returns anything but its own signatures is refused before anything is broadcast.
 */

const PHRASE = 'test test test test test test test test test test test junk';

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Pin { address public holder;'
  + '   function hold() external { holder = msg.sender; } }';

const pin = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never).Pin!;

/** A wallet over `key`: it signs each input it owns that the request leaves empty, as a wc2 wallet does. */
function walletOver(key: HDSigner, tamper?: (signed: ReturnType<typeof decodeTransaction>) => void): {
  readonly wallet: ExternalTransactionSigner;
  readonly requests: WcTransactionObject[];
} {
  const requests: WcTransactionObject[] = [];
  const own = binToHex(key.getLockingBytecode());
  const template = new SignatureTemplate(key.privateKey);
  return {
    requests,
    wallet: {
      async signTransaction(request) {
        requests.push(request);
        const transaction = { ...request.transaction, inputs: request.transaction.inputs.map((input) => ({ ...input })) };
        request.sourceOutputs.forEach((source, inputIndex) => {
          if (source.unlockingBytecode.length !== 0 || binToHex(source.lockingBytecode) !== own) return;
          transaction.inputs[inputIndex]!.unlockingBytecode = template.unlockP2PKH().generateUnlockingBytecode({
            transaction: request.transaction, sourceOutputs: request.sourceOutputs, inputIndex,
          });
        });
        const signed = decodeTransaction(encodeTransaction(transaction));
        if (typeof signed === 'string') throw new Error(signed);
        tamper?.(signed);
        return { signedTransaction: binToHex(encodeTransaction(signed)) };
      },
    },
  };
}

async function deployedPin(): Promise<{
  readonly provider: MockNetworkProvider; readonly deployer: HDSigner; readonly key: HDSigner;
  readonly handle: StatefulContract;
}> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const deployer = HDSigner.fromPhrase(PHRASE, provider);
  const key = HDSigner.fromPhrase(PHRASE, provider, "m/44'/145'/0'/0/1");
  const fundingUtxo = { txid: '5d'.repeat(32), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(deployer.getAddress(), fundingUtxo);
  await provider.addUtxo(deployer.getAddress(), { txid: '6d'.repeat(32), vout: 0, satoshis: 400_000n });
  await provider.addUtxo(key.getAddress(), { txid: '7d'.repeat(32), vout: 0, satoshis: 900_000n });
  await fundShippedFacets(provider);
  const deployment = await deployStatefulContract(pin, [], {
    provider, fundingUtxo, funder: deployer.unlockP2PKH(), changeAddress: deployer.getAddress(),
  });
  return { provider, deployer, key, handle: deployment.contract as StatefulContract };
}

describe('a signer whose key a wallet holds', () => {
  it('is the root caller of a framed call the wallet signs over bch_signTransaction', async () => {
    const { provider, key, handle } = await deployedPin();
    const { wallet, requests } = walletOver(key);
    const external = Signer.external({ wallet, address: key.getAddress() }, provider);
    expect(external.isExternal).toBe(true);
    expect(external.getAddress()).toBe(key.getAddress());
    expect(binToHex(external.getLockingBytecode())).toBe(binToHex(key.getLockingBytecode()));
    expect(() => external.privateKey).toThrow(/held by its wallet/);

    const calls = handle.connect(external).call as unknown as { readonly hold: () => FramedFunctionCall };
    const sent = await calls.hold() as unknown as { readonly txid: string };

    // The wallet saw one request with every input empty: its own coin for it to sign, and the framed inputs because no
    // signature covers another input's unlocking bytecode, which is most of the transaction.
    expect(requests).toHaveLength(1);
    const [request] = requests;
    const ownInputs = request!.sourceOutputs.flatMap((source, index) =>
      (binToHex(source.lockingBytecode) === binToHex(key.getLockingBytecode()) ? [index] : []));
    expect(ownInputs.length).toBeGreaterThan(0);
    expect(ownInputs.length).toBeLessThan(request!.transaction.inputs.length);
    for (const input of request!.transaction.inputs) expect(input.unlockingBytecode).toHaveLength(0);
    for (const source of request!.sourceOutputs) expect(source.unlockingBytecode).toHaveLength(0);
    expect(request!.broadcast).toBe(false);

    // The record names the wallet's account as msg.sender, and the broadcast is the signed transaction.
    const commitment = (await readFramedDeployment(provider, handle.categoryId, pin.stateLayout!))
      .records[0]!.token!.nft!.commitment;
    const holder = parsePushdataCommitment(commitment, pin.stateLayout!, 0).holder as Uint8Array;
    expect(bytesToHex(holder)).toBe(bytesToHex(key.getLockingBytecode()));
    const raw = await provider.getRawTransaction(sent.txid);
    const broadcast = decodeTransaction(hexToBin(raw));
    if (typeof broadcast === 'string') throw new Error(broadcast);
    for (const index of ownInputs) {
      const unlocking = broadcast.inputs[index]!.unlockingBytecode;
      expect(unlocking).toHaveLength(100);
      expect(binToHex(unlocking)).not.toBe(binToHex(externalSignaturePlaceholder()));
    }
    // The framed inputs, which the wallet never saw, are broadcast with their unlocking bytecode, and the request
    // was a fraction of the transaction.
    broadcast.inputs.forEach((input, index) => {
      if (!ownInputs.includes(index)) expect(input.unlockingBytecode.length).toBeGreaterThan(0);
    });
    expect(encodeTransaction(request!.transaction).length * 4).toBeLessThan(hexToBin(raw).length);
  });

  it('refuses a wallet that fills an input that is not its own, and broadcasts nothing', async () => {
    const { provider, key, handle } = await deployedPin();
    const own = binToHex(key.getLockingBytecode());
    let foreign = -1;
    const { wallet, requests } = walletOver(key, (signed) => {
      foreign = signed.inputs.findIndex((input, index) => input.unlockingBytecode.length === 0
        && binToHex(requests[0]!.sourceOutputs[index]!.lockingBytecode) !== own);
      signed.inputs[foreign]!.unlockingBytecode = Uint8Array.of(0x51);
    });
    const external = Signer.external({ wallet, address: key.getAddress() }, provider);
    const calls = handle.connect(external).call as unknown as { readonly hold: () => FramedFunctionCall };
    await expect(calls.hold()).rejects.toThrow(/which is not the wallet's/);
    expect(foreign).toBeGreaterThanOrEqual(0);
    const commitment = (await readFramedDeployment(provider, handle.categoryId, pin.stateLayout!))
      .records[0]!.token!.nft!.commitment;
    expect(bytesToHex(parsePushdataCommitment(commitment, pin.stateLayout!, 0).holder as Uint8Array))
      .not.toBe(bytesToHex(key.getLockingBytecode()));
  });

  it('signs a plain payment built with the transaction builder', async () => {
    const { provider, deployer, key } = await deployedPin();
    const { wallet, requests } = walletOver(key);
    const external = Signer.external({ wallet, address: key.getAddress() }, provider);
    const [coin] = (await external.getUtxos()).filter((utxo) => utxo.token === undefined);
    const builder = new TransactionBuilder({ provider });
    builder.addInput(coin!, external.unlockP2PKH());
    builder.addOutput({ to: deployer.getAddress(), amount: 100_000n });
    builder.addOutput({ to: external.getAddress(), amount: coin!.satoshis - 100_000n - 1_000n });
    const sent = await builder.send();
    expect(requests).toHaveLength(1);
    expect((await provider.getUtxos(deployer.getAddress())).some((utxo) => utxo.txid === sent.txid)).toBe(true);
  });

  it('refuses a wallet that changes the transaction, and broadcasts nothing', async () => {
    const { provider, deployer, key } = await deployedPin();
    const { wallet } = walletOver(key, (signed) => { signed.outputs[0]!.valueSatoshis += 1n; });
    const external = Signer.external({ wallet, address: key.getAddress() }, provider);
    const [coin] = (await external.getUtxos()).filter((utxo) => utxo.token === undefined);
    const builder = new TransactionBuilder({ provider });
    builder.addInput(coin!, external.unlockP2PKH());
    builder.addOutput({ to: deployer.getAddress(), amount: 100_000n });
    builder.addOutput({ to: external.getAddress(), amount: coin!.satoshis - 100_000n - 1_000n });
    await expect(builder.send()).rejects.toThrow(ExternalSigningError);
    expect((await external.getUtxos()).some((utxo) => utxo.txid === coin!.txid)).toBe(true);
  });

  it('refuses a wallet that declines to sign', async () => {
    const { provider, deployer, key, handle } = await deployedPin();
    const declining: ExternalTransactionSigner = { signTransaction: async () => undefined };
    const external = Signer.external({ wallet: declining, address: key.getAddress() }, provider);
    const calls = handle.connect(external).call as unknown as { readonly hold: () => FramedFunctionCall };
    await expect(calls.hold()).rejects.toThrow(/did not sign/);
    expect(deployer.getAddress()).not.toBe(key.getAddress());
  });
});
