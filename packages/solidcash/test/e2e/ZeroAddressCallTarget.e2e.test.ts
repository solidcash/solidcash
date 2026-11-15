/**
 * A high-level call through a stored target that holds the zero address. `address(0)` is the empty value, and the
 * caller's check of its co-spent callee used to take an empty expected address as "already authenticated": it compared
 * the callee's lock with itself, so a target never set, or zeroed to disable it, accepted whatever contract the spender
 * co-spent, and the caller used that contract's answer. On the EVM such a call reverts, the target having no code; the
 * caller now refuses it the same way.
 *
 * Each case runs on the production profile, in the native form and under evmCompat. The control names the right callee
 * and passes the VM; the hostile contract, which answers the same method with a value of its own, is shown to be a
 * callee the caller accepts when its target names it, so the refusals below come from the caller's own input.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const SOURCE = `pragma solidcash ^0.50.0;
  interface IOracle { function price() external returns (int); }
  contract Oracle { int reads; function price() external returns (int) { reads = reads + 1; return 7; } }
  contract Hostile { int reads; function price() external returns (int) { reads = reads + 1; return 1000000; } }
  contract Reader {
    address oracle;
    int last;
    function setOracle(address o) external { oracle = o; }
    function disable() external { oracle = address(0); }
    function read() external { last = IOracle(oracle).price(); }
  }`;

let serial = 0xa0de0;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

interface Setup {
  provider: MockNetworkProvider;
  deploy(name: string): Promise<any>;
  /** A signer holding six plain coins of 200,000 satoshis. */
  wallet(): Promise<Signer>;
  /** Every transaction sent so far, with the outputs its inputs spend. */
  sent: Sent[];
}

function setup(options: object): Setup {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const sent: Sent[] = [];
  const original = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    sent.push({ transaction, sourceOutputs });
    return original(hex);
  };
  const deploy = async (name: string): Promise<any> => {
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    const artifact = compileString(SOURCE, { ...options, primaryContractName: name } as never);
    const { contract } = await StatefulContract.deploy(artifact, [] as never, {
      provider, fundingUtxo, funder, changeAddress: change.address,
    } as never);
    return contract;
  };
  const wallet = async (): Promise<Signer> => {
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 6; index += 1) {
      await provider.seedUtxo(signer.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
    }
    return signer;
  };
  return { provider, deploy, wallet, sent };
}

const lockOf = (contract: any): Uint8Array => addressToLockScript(contract.address);
const callOf = (contract: any, signer: Signer): any => contract.connect(signer).call;
const stateOf = async (contract: any, field: string): Promise<unknown> => (
  (await contract.getState()) as Record<string, unknown>)[field];

/** The last transaction sent passes the VM on every input. */
function lastSentVerifies(s: Setup): boolean {
  return createVirtualMachineBch2026ForProvider(s.provider).verify(s.sent[s.sent.length - 1]! as never) === true;
}

/** The message a spend is refused with. Nothing is sent. */
async function refusal(s: Setup, send: () => Promise<unknown>): Promise<string> {
  const before = s.sent.length;
  let message: string | undefined;
  try {
    await send();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  expect(s.sent.length).toBe(before);
  if (message === undefined) throw new Error('the spend was accepted');
  return message;
}

/** The caller's own input, input 0, fails an OP_VERIFY: the VM refuses the spend before it is sent. */
function expectRefusedByCaller(message: string): void {
  expect(message).toMatch(/preflight failed at input 0\b/);
  expect(message).toMatch(/Program failed an OP_VERIFY operation/);
}

for (const form of [{ name: 'native', options: {} }, { name: 'evmCompat', options: { evmCompat: true } }]) {
  describe(`a call through a stored target holding address(0) (${form.name})`, () => {
    it('reads the callee its target names, and the hostile contract only when the target names it', async () => {
      const s = setup(form.options);
      const oracle = await s.deploy('Oracle');
      const hostile = await s.deploy('Hostile');
      const reader = await s.deploy('Reader');
      const wallet = await s.wallet();

      await callOf(reader, wallet).setOracle(lockOf(oracle)).send();
      await callOf(reader, wallet).read().withExternalCall(oracle).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(7n);
      expect(await stateOf(oracle, 'reads')).toBe(1n);

      await callOf(reader, wallet).setOracle(lockOf(hostile)).send();
      await callOf(reader, wallet).read().withExternalCall(hostile).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(1_000_000n);
      expect(await stateOf(hostile, 'reads')).toBe(1n);
    }, 300_000);

    it('refuses a hostile callee while the target was never set', async () => {
      const s = setup(form.options);
      const hostile = await s.deploy('Hostile');
      const reader = await s.deploy('Reader');
      const wallet = await s.wallet();
      expectRefusedByCaller(await refusal(s, () => callOf(reader, wallet).read().withExternalCall(hostile).send()));
    }, 300_000);

    it('refuses a hostile callee, and the callee it used to name, once the target is zeroed', async () => {
      const s = setup(form.options);
      const oracle = await s.deploy('Oracle');
      const hostile = await s.deploy('Hostile');
      const reader = await s.deploy('Reader');
      const wallet = await s.wallet();
      await callOf(reader, wallet).setOracle(lockOf(oracle)).send();
      await callOf(reader, wallet).read().withExternalCall(oracle).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(7n);

      await callOf(reader, wallet).disable().send();
      expect(lastSentVerifies(s)).toBe(true);
      expectRefusedByCaller(await refusal(s, () => callOf(reader, wallet).read().withExternalCall(hostile).send()));
      expectRefusedByCaller(await refusal(s, () => callOf(reader, wallet).read().withExternalCall(oracle).send()));
      expect(await stateOf(reader, 'last')).toBe(7n);
      expect(await stateOf(oracle, 'reads')).toBe(1n);
    }, 300_000);
  });
}
