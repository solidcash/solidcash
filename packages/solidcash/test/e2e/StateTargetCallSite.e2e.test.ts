/**
 * A high-level call through a target the function changes after the call: a stored target it writes, a local or a
 * branch local it reassigns, a parameter it reassigns. The caller checks its co-spent callee after the body, and it
 * used to read the target there, where it holds the value the body left in it: in
 * `last = IOracle(oracle).price(); oracle = o;` the call was bound to `o`, a parameter, so the spender chose the
 * contract whose answer the caller had already used. On the EVM the call goes to the value the target held when it
 * ran, which is the written value only when the write comes first. The caller now binds the same value.
 *
 * Each case runs on the production profile, in the native form and under evmCompat. The Hostile contract answers the
 * Oracle's method with a value of its own. The honest spends pass the VM; each refusal comes from the caller's own
 * input, and nothing is sent.
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
    function read() external { last = IOracle(oracle).price(); }
    function readThenRetarget(address o) external { last = IOracle(oracle).price(); oracle = o; }
    function retargetThenRead(address o) external { oracle = o; last = IOracle(oracle).price(); }
    function readLocal(address other) external {
      IOracle feed = IOracle(oracle); last = feed.price(); feed = IOracle(other);
    }
    function readBranch(bool go, address other) external {
      if (go) { IOracle feed = IOracle(oracle); last = feed.price(); feed = IOracle(other); }
    }
    function readParam(address target, address other) external { last = IOracle(target).price(); target = other; }
    function readArg(address target) external { last = IOracle(target).price(); }
  }`;

// Calls through function pointers: one whose method a state discriminant selects, one whose receiver a ternary of
// parameters selects. The function changes the discriminant, or the chosen parameter, after the call.
const POINTERS = `pragma solidcash ^0.50.0;
  interface IHandler { function inc() external; function dec() external; }
  contract Handler {
    int counter;
    function inc() external { counter = counter + 1; }
    function dec() external { counter = counter - 1; }
  }
  contract Switch {
    address handler;
    bool useInc;
    int runs;
    function configure(address h, bool u) external { handler = h; useInc = u; }
    function runThenFlip() external {
      function() external f = useInc ? IHandler(handler).inc : IHandler(handler).dec;
      f();
      useInc = !useInc;
      runs = runs + 1;
    }
    function runEither(bool useA, address a, address b, address other) external {
      function() external f = useA ? IHandler(a).inc : IHandler(b).inc;
      f();
      a = other;
      runs = runs + 1;
    }
  }`;

// A call through an interface field of a stored struct, which the function writes before the call.
const CHAINS = `pragma solidcash ^0.50.0;
  interface IOracle { function price() external returns (int); }
  contract Oracle { int reads; function price() external returns (int) { reads = reads + 1; return 7; } }
  contract Hostile { int reads; function price() external returns (int) { reads = reads + 1; return 1000000; } }
  contract Feeder {
    struct Feed { IOracle source; int weight; }
    Feed feed;
    int last;
    function setFeed(address s) external { feed = Feed(IOracle(s), 1); }
    function read() external { last = feed.source.price(); }
    function retargetThenRead(address s) external { feed = Feed(IOracle(s), 2); last = feed.source.price(); }
  }`;

let serial = 0xc5b1d0;
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

function setup(options: object, source = SOURCE): Setup {
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
    const artifact = compileString(source, { ...options, primaryContractName: name } as never);
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

/**
 * The caller's own input, input 0, fails a VERIFY: the VM refuses the spend before it is sent. The VM reports a
 * failed OP_EQUALVERIFY, the identity check's, as a failed OP_VERIFY.
 */
function expectRefusedByCaller(message: string): void {
  expect(message).toMatch(/preflight failed at input 0\b/);
  expect(message).toMatch(/Program failed an OP_VERIFY operation/);
}

for (const form of [{ name: 'native', options: {} }, { name: 'evmCompat', options: { evmCompat: true } }]) {
  describe(`a call through a stored target its function also writes (${form.name})`, () => {
    it('binds a call made before the write to the value the target held when the call ran', async () => {
      const s = setup(form.options);
      const oracle = await s.deploy('Oracle');
      const hostile = await s.deploy('Hostile');
      const reader = await s.deploy('Reader');
      const wallet = await s.wallet();
      await callOf(reader, wallet).setOracle(lockOf(oracle)).send();

      // The spender names the Hostile contract as the new target and as the callee: the call ran on the Oracle.
      expectRefusedByCaller(await refusal(s, () => callOf(reader, wallet).readThenRetarget(lockOf(hostile))
        .withExternalCall(hostile).send()));
      expect(await stateOf(hostile, 'reads')).toBe(0n);

      await callOf(reader, wallet).readThenRetarget(lockOf(hostile)).withExternalCall(oracle).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(7n);
      expect(await stateOf(oracle, 'reads')).toBe(1n);

      // The write took effect: the next read is a call on the Hostile contract.
      await callOf(reader, wallet).read().withExternalCall(hostile).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(1_000_000n);
      expect(await stateOf(hostile, 'reads')).toBe(1n);
    }, 300_000);

    it('binds a call made after the write to the written value', async () => {
      const s = setup(form.options);
      const oracle = await s.deploy('Oracle');
      const hostile = await s.deploy('Hostile');
      const reader = await s.deploy('Reader');
      const wallet = await s.wallet();
      await callOf(reader, wallet).setOracle(lockOf(oracle)).send();

      expectRefusedByCaller(await refusal(s, () => callOf(reader, wallet).retargetThenRead(lockOf(hostile))
        .withExternalCall(oracle).send()));
      expect(await stateOf(oracle, 'reads')).toBe(0n);

      await callOf(reader, wallet).retargetThenRead(lockOf(hostile)).withExternalCall(hostile).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(1_000_000n);
      expect(await stateOf(hostile, 'reads')).toBe(1n);
    }, 300_000);

    it('binds a call in a function that does not write the target to the stored value', async () => {
      const s = setup(form.options);
      const oracle = await s.deploy('Oracle');
      const hostile = await s.deploy('Hostile');
      const reader = await s.deploy('Reader');
      const wallet = await s.wallet();
      await callOf(reader, wallet).setOracle(lockOf(oracle)).send();

      expectRefusedByCaller(await refusal(s, () => callOf(reader, wallet).read().withExternalCall(hostile).send()));

      await callOf(reader, wallet).read().withExternalCall(oracle).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(7n);
      expect(await stateOf(oracle, 'reads')).toBe(1n);
    }, 300_000);
  });

  describe(`a call through a local or parameter target its function reassigns (${form.name})`, () => {
    it('binds a call through a local to the value the local held when the call ran', async () => {
      const s = setup(form.options);
      const oracle = await s.deploy('Oracle');
      const hostile = await s.deploy('Hostile');
      const reader = await s.deploy('Reader');
      const wallet = await s.wallet();
      await callOf(reader, wallet).setOracle(lockOf(oracle)).send();

      // The local named the Oracle when the call ran; the spender names the Hostile contract for its later value.
      expectRefusedByCaller(await refusal(s, () => callOf(reader, wallet).readLocal(lockOf(hostile))
        .withExternalCall(hostile).send()));
      expect(await stateOf(hostile, 'reads')).toBe(0n);

      await callOf(reader, wallet).readLocal(lockOf(hostile)).withExternalCall(oracle).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(7n);
      expect(await stateOf(oracle, 'reads')).toBe(1n);
    }, 300_000);

    it('binds a call through a branch local to the value it held when the call ran', async () => {
      const s = setup(form.options);
      const oracle = await s.deploy('Oracle');
      const hostile = await s.deploy('Hostile');
      const reader = await s.deploy('Reader');
      const wallet = await s.wallet();
      await callOf(reader, wallet).setOracle(lockOf(oracle)).send();

      expectRefusedByCaller(await refusal(s, () => callOf(reader, wallet).readBranch(true, lockOf(hostile))
        .withExternalCall(hostile).send()));
      expect(await stateOf(hostile, 'reads')).toBe(0n);

      await callOf(reader, wallet).readBranch(true, lockOf(hostile)).withExternalCall(oracle).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(7n);
      expect(await stateOf(oracle, 'reads')).toBe(1n);
    }, 300_000);

    it('binds a call through a parameter to the value the parameter held when the call ran', async () => {
      const s = setup(form.options);
      const oracle = await s.deploy('Oracle');
      const hostile = await s.deploy('Hostile');
      const reader = await s.deploy('Reader');
      const wallet = await s.wallet();

      expectRefusedByCaller(await refusal(s, () => callOf(reader, wallet).readParam(lockOf(oracle), lockOf(hostile))
        .withExternalCall(hostile).send()));
      expect(await stateOf(hostile, 'reads')).toBe(0n);

      await callOf(reader, wallet).readParam(lockOf(oracle), lockOf(hostile)).withExternalCall(oracle).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(7n);
      expect(await stateOf(oracle, 'reads')).toBe(1n);
    }, 300_000);

    it('binds a call through a parameter the function does not reassign to its value', async () => {
      const s = setup(form.options);
      const oracle = await s.deploy('Oracle');
      const hostile = await s.deploy('Hostile');
      const reader = await s.deploy('Reader');
      const wallet = await s.wallet();

      expectRefusedByCaller(await refusal(s, () => callOf(reader, wallet).readArg(lockOf(oracle))
        .withExternalCall(hostile).send()));

      await callOf(reader, wallet).readArg(lockOf(oracle)).withExternalCall(oracle).send();
      expect(lastSentVerifies(s)).toBe(true);
      expect(await stateOf(reader, 'last')).toBe(7n);
      expect(await stateOf(oracle, 'reads')).toBe(1n);
    }, 300_000);
  });
}

describe('a pointer call whose selector or ternary target its function changes after the call (native)', () => {
  it('binds the method the selector named when the call ran', async () => {
    const s = setup({}, POINTERS);
    const handler = await s.deploy('Handler');
    const toggle = await s.deploy('Switch');
    const wallet = await s.wallet();
    await callOf(toggle, wallet).configure(lockOf(handler), true).send();

    // The discriminant named inc when the call ran; the body then flips it to name dec.
    expectRefusedByCaller(await refusal(s, () => callOf(toggle, wallet).runThenFlip()
      .withExternalCall(handler, 'dec', []).send()));
    expect(await stateOf(handler, 'counter')).toBe(0n);

    await callOf(toggle, wallet).runThenFlip().withExternalCall(handler, 'inc', []).send();
    expect(lastSentVerifies(s)).toBe(true);
    expect(await stateOf(handler, 'counter')).toBe(1n);
    expect(await stateOf(toggle, 'useInc')).toBe(false);
  }, 300_000);

  it('binds the receiver the ternary named when the call ran', async () => {
    const s = setup({}, POINTERS);
    const first = await s.deploy('Handler');
    const second = await s.deploy('Handler');
    const toggle = await s.deploy('Switch');
    const wallet = await s.wallet();

    // useA picks `a`, the first handler, when the call runs; the body then points `a` at the second.
    expectRefusedByCaller(await refusal(s, () => callOf(toggle, wallet)
      .runEither(true, lockOf(first), lockOf(second), lockOf(second)).withExternalCall(second, 'inc', []).send()));
    expect(await stateOf(second, 'counter')).toBe(0n);

    await callOf(toggle, wallet).runEither(true, lockOf(first), lockOf(second), lockOf(second))
      .withExternalCall(first, 'inc', []).send();
    expect(lastSentVerifies(s)).toBe(true);
    expect(await stateOf(first, 'counter')).toBe(1n);
    expect(await stateOf(second, 'counter')).toBe(0n);
  }, 300_000);
});

describe('a call through a stored chain its function writes before the call (native)', () => {
  it('binds the value the chain holds when the call runs', async () => {
    const s = setup({}, CHAINS);
    const oracle = await s.deploy('Oracle');
    const hostile = await s.deploy('Hostile');
    const feeder = await s.deploy('Feeder');
    const wallet = await s.wallet();
    await callOf(feeder, wallet).setFeed(lockOf(oracle)).send();

    // The body points the feed at the Hostile contract and then calls through it: the Oracle it held is refused.
    expectRefusedByCaller(await refusal(s, () => callOf(feeder, wallet).retargetThenRead(lockOf(hostile))
      .withExternalCall(oracle).send()));
    expect(await stateOf(oracle, 'reads')).toBe(0n);

    await callOf(feeder, wallet).retargetThenRead(lockOf(hostile)).withExternalCall(hostile).send();
    expect(lastSentVerifies(s)).toBe(true);
    expect(await stateOf(feeder, 'last')).toBe(1_000_000n);
    expect(await stateOf(hostile, 'reads')).toBe(1n);
  }, 300_000);

  it('binds a call through a chain the function does not write to the stored value', async () => {
    const s = setup({}, CHAINS);
    const oracle = await s.deploy('Oracle');
    const hostile = await s.deploy('Hostile');
    const feeder = await s.deploy('Feeder');
    const wallet = await s.wallet();
    await callOf(feeder, wallet).setFeed(lockOf(oracle)).send();

    expectRefusedByCaller(await refusal(s, () => callOf(feeder, wallet).read().withExternalCall(hostile).send()));

    await callOf(feeder, wallet).read().withExternalCall(oracle).send();
    expect(lastSentVerifies(s)).toBe(true);
    expect(await stateOf(feeder, 'last')).toBe(7n);
    expect(await stateOf(oracle, 'reads')).toBe(1n);
  }, 300_000);
});
