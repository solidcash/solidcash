/**
 * A call through a target its function writes before the call, in a message-bus build. The route verifies a handler's
 * call rows from the frame it hands the handler, before the handler's body runs, and the call-site registers of the
 * direct convention (collectCallSiteTargets) skip graph handlers. A call made after a write of its target must still
 * go to the written value, as on the EVM, or the build must refuse it by name.
 *
 * Each case compiles with `messageBus: true` and spends through the builder, whose preflight runs the BCH 2026 VM.
 */
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { SignatureTemplate, Signer } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { StatefulContract, getContractFactory } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import { createTestProvider, getSigners } from '../test-util.js';

const BUS = { messageBus: true, forceStateful: true } as const;

/** A typed call through a stored target the function writes first (StateTargetCallSite's Reader). */
const READER = `pragma solidcash >=0.8.0;
  interface IOracle { function price() external returns (int); }
  contract Oracle { int reads; function price() external returns (int) { reads = reads + 1; return 7; } }
  contract Hostile { int reads; function price() external returns (int) { reads = reads + 1; return 1000000; } }
  contract Reader {
    address oracle;
    int last;
    function setOracle(address o) external { oracle = o; }
    function retargetThenRead(address o) external { oracle = o; last = IOracle(oracle).price(); }
  }`;

/** SafeERC20's raw call through a stored token (`__extaddr_ll_token`) the function writes first. */
const STORED_PAYER = `pragma solidcash >=0.8.0;
  contract Token {
    bigint moved;
    function transfer(address, uint amount) external returns (bool) { this.moved = amount; return true; }
  }
  contract StoredPayer {
    address token;
    bigint paid;
    function setToken(address t) external { this.token = t; }
    function retargetThenPayOut(address t, uint amount) external {
      this.token = t;
      (bool success, bytes data) = token.call(abi.encodeWithSelector(0xa9059cbb, address(this), amount));
      require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
      this.paid = amount;
    }
  }`;

/** A value call through a stored payee the function writes first. */
const PAYER = `pragma solidcash >=0.8.0;
  contract Payer {
    address payee;
    int sends;
    function setPayee(address p) external { payee = p; }
    function repointThenPay(address p, int amount) external {
      payee = p;
      (bool ok, bytes data) = payee.call{value: amount}("");
      require(ok && data.length == 0);
      sends = sends + 1;
    }
  }`;

let serial = 0xb05b0;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

interface Setup {
  provider: MockNetworkProvider;
  deploy(source: string, name: string, options?: object): Promise<{ contract: any; artifact: Artifact }>;
  wallet(): Promise<Signer>;
}

function setup(): Setup {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  return {
    provider,
    deploy: async (source, name, options = BUS) => {
      const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
      await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
      const artifact = compileString(source, { ...options, primaryContractName: name } as never);
      const { contract } = await StatefulContract.deploy(artifact, [] as never, {
        provider, fundingUtxo, funder, changeAddress: change.address,
      } as never);
      return { contract, artifact };
    },
    wallet: async () => {
      const signer = new Signer(alicePriv, provider);
      for (let index = 0; index < 6; index += 1) {
        await provider.seedUtxo(signer.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
      }
      return signer;
    },
  };
}

const lockOf = (contract: any): Uint8Array => addressToLockScript(contract.address);
const stateOf = async (contract: any, field: string): Promise<unknown> => (
  (await contract.getState()) as Record<string, unknown>)[field];

describe('a call through a target its function writes first, in a message-bus build', () => {
  it('compiles each caller as a message-bus build', () => {
    for (const [source, name] of [[READER, 'Reader'], [STORED_PAYER, 'StoredPayer'], [PAYER, 'Payer']] as const) {
      const artifact = compileString(source, { ...BUS, primaryContractName: name } as never);
      expect(artifact.messageBus?.version).toBe(1);
    }
  });

  it('binds a typed call to the written target', async () => {
    const s = setup();
    const oracle = (await s.deploy(READER, 'Oracle')).contract;
    const hostile = (await s.deploy(READER, 'Hostile')).contract;
    const reader = (await s.deploy(READER, 'Reader')).contract;
    const wallet = await s.wallet();
    await reader.connect(wallet).call.setOracle(lockOf(oracle)).send();

    // The write took effect before the call: the call runs on the Hostile contract, as on the EVM.
    await reader.connect(wallet).call.retargetThenRead(lockOf(hostile)).withExternalCall(hostile).send();
    expect(await stateOf(reader, 'last')).toBe(1_000_000n);
    expect(await stateOf(hostile, 'reads')).toBe(1n);
  }, 300_000);

  it('refuses a typed call bound to the target from before the write', async () => {
    const s = setup();
    const oracle = (await s.deploy(READER, 'Oracle')).contract;
    const hostile = (await s.deploy(READER, 'Hostile')).contract;
    const reader = (await s.deploy(READER, 'Reader')).contract;
    const wallet = await s.wallet();
    await reader.connect(wallet).call.setOracle(lockOf(oracle)).send();

    await expect(reader.connect(wallet).call.retargetThenRead(lockOf(hostile)).withExternalCall(oracle).send())
      .rejects.toThrow();
    expect(await stateOf(oracle, 'reads')).toBe(0n);
  }, 300_000);

  it('binds a raw call to the written token (evmCompat)', async () => {
    const s = setup();
    const options = { ...BUS, evmCompat: true };
    const first = (await s.deploy(STORED_PAYER, 'Token', options)).contract;
    const second = (await s.deploy(STORED_PAYER, 'Token', options)).contract;
    const payer = (await s.deploy(STORED_PAYER, 'StoredPayer', options)).contract;
    const wallet = await s.wallet();
    await payer.connect(wallet).call.setToken(lockOf(first)).send();

    await payer.connect(wallet).call.retargetThenPayOut(lockOf(second), 5n)
      .withExternalCall(second, 'transfer', [lockOf(payer), 5n]).send();
    expect(await stateOf(second, 'moved')).toBe(5n);
    expect(await stateOf(first, 'moved')).toBe(0n);
  }, 300_000);

  it('refuses a raw call bound to the token from before the write (evmCompat)', async () => {
    const s = setup();
    const options = { ...BUS, evmCompat: true };
    const first = (await s.deploy(STORED_PAYER, 'Token', options)).contract;
    const second = (await s.deploy(STORED_PAYER, 'Token', options)).contract;
    const payer = (await s.deploy(STORED_PAYER, 'StoredPayer', options)).contract;
    const wallet = await s.wallet();
    await payer.connect(wallet).call.setToken(lockOf(first)).send();

    await expect(payer.connect(wallet).call.retargetThenPayOut(lockOf(second), 5n)
      .withExternalCall(first, 'transfer', [lockOf(payer), 5n]).send()).rejects.toThrow();
    expect(await stateOf(first, 'moved')).toBe(0n);
  }, 300_000);

  it('pays the written payee from a value call', async () => {
    const provider = createTestProvider();
    const [owner] = await getSigners(1, { provider, fundingUtxos: 8 });
    const artifact = compileString(PAYER, { ...BUS, primaryContractName: 'Payer' } as never);
    const payer: any = await getContractFactory(artifact, owner).deploy({ initialBalance: 30_000n });
    const first = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x11));
    const second = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
    await payer.setPayee(first).send();

    const tx = await payer.repointThenPay(second, 5_000n).send();
    const outputs = decodeTransactionUnsafe(hexToBin(tx.hex)).outputs;
    expect(outputs.some((output) => output.valueSatoshis === 5_000n
      && binToHex(output.lockingBytecode) === binToHex(second))).toBe(true);
    expect(outputs.some((output) => output.valueSatoshis === 5_000n
      && binToHex(output.lockingBytecode) === binToHex(first))).toBe(false);
  }, 300_000);
});
