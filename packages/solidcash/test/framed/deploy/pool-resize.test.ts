import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hash256, type Transaction,
} from '@bitauth/libauth';
import { FrameKind, encodeWitnessBlock, sha256, type WitnessBlock } from '@solidcash/utils';
import { framedLifecycle, framedValidator } from 'solidc';
import { compileString } from '../../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import {
  Contract,
  HashType,
  SignatureTemplate,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { createSighashPreimage } from '../../../src/utils.js';
import { deployMaster, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import {
  USER_LOCK as DRAFT_USER_LOCK, compileAndDeploy, composeAndDerive, fundShippedFacets, hexOf, master as draftMaster,
  masterInput, rootOf, seededAddress, selectorOf, token as draftToken, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPriv } from '../../fixture/vars.js';

/**
 * The master pool changes only through the admin's `split(n)` and `merge(n)` (spec R2b, 12.2, 21.5).
 *
 * Every case is a transaction the BCH-2026 machine judges input by input: a split, a merge or an entry, beside the
 * minimal change to it that the masters must refuse.
 */

const ADMIN = new SignatureTemplate(sha256(new TextEncoder().encode('pool resize admin')));
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Pool {'
  + `   pubkey constant ADMIN = pubkey(0x${binToHex(ADMIN.getPublicKey())});`
  + '   int public total;'
  + '   function bump() { this.total = this.total + 1; }'
  + '   function check() { require(this.total >= 0); }'
  + '   function grow(int n, sig s) split(n) { require(checkSig(s, ADMIN)); require(n >= 1 && n <= 3); }'
  + '   function shrink(int n, sig s) merge(n) { require(checkSig(s, ADMIN)); }'
  + ' }';
const artifact = compileString(SOURCE, { composition: 'framed' });
const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const CATEGORY = sha256(new TextEncoder().encode('pool resize'));
const MASTER = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const { SPLIT, MERGE, RETIRE } = framedLifecycle.LIFECYCLE_MODE;

type Capability = 'minting' | 'mutable' | 'none';
interface Token { category: Uint8Array; amount: bigint; nft?: { capability: Capability; commitment: Uint8Array } }
interface Output { lockingBytecode: Uint8Array; valueSatoshis: bigint; token?: Token }
interface Input {
  readonly source: Output;
  readonly unlock: (transaction: Transaction, sources: Output[], index: number) => Uint8Array;
}

const token = (capability: Capability = 'minting', commitment = new Uint8Array()): Token =>
  ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });
const master = (value = 1200n, lock = MASTER.lockingBytecode, nft = token()): Output =>
  ({ lockingBytecode: lock, valueSatoshis: value, token: nft });
const change: Output = { lockingBytecode: USER_LOCK, valueSatoshis: 10_000n };
const push = (bytes: Uint8Array): number[] => [...encodeDataPush(bytes)];

/** A master unlocked for the arm: `<mode> <n> <sig>`, the admin signing over this transaction by default. */
function resizing(mode: number, count: bigint, signer: SignatureTemplate = ADMIN): Input {
  return {
    source: master(),
    unlock: (transaction, sources, index) => {
      const preimage = createSighashPreimage(transaction, sources, index, MASTER.script, signer.getHashType());
      return Uint8Array.from([
        ...push(Uint8Array.of(mode)), ...push(bigIntToVmNumber(count)),
        ...push(signer.generateSignature(hash256(preimage))), ...push(MASTER.script),
      ]);
    },
  };
}

const retiring: Input = {
  source: master(),
  unlock: () => Uint8Array.from([...push(Uint8Array.of(RETIRE)), ...push(MASTER.script)]),
};
const funding: Input = {
  source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  unlock: () => callerUnlockingBytecode(),
};

/** The machine's verdict on every master input: `true`, or the error that refused it. */
function judge(inputs: readonly Input[], outputs: readonly Output[]): (true | string)[] {
  const sources = inputs.map((input) => input.source);
  const transaction: Transaction = {
    version: 2,
    locktime: 0,
    inputs: inputs.map((_input, index) => ({
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(index + 1),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array(),
    })),
    outputs: [...outputs],
  };
  transaction.inputs.forEach((input, index) => {
    input.unlockingBytecode = inputs[index]!.unlock(transaction, sources, index);
  });
  const vm = compositionMachine();
  return inputs.flatMap((input, index) => {
    if (input.source.token?.nft?.capability !== 'minting') return [];
    const state = vm.evaluate({ inputIndex: index, sourceOutputs: sources, transaction });
    return [vm.stateSuccess(state) === true ? true : String(state.error)];
  });
}

const accepted = (verdicts: readonly (true | string)[]): boolean => verdicts.every((verdict) => verdict === true);

describe('split(n): the admin mints exactly n masters', () => {
  it('accepts n new masters at the master lock beside the splitting master, and refuses one more or one fewer', () => {
    expect(judge([resizing(SPLIT, 2n), funding], [master(), master(), master(), change])).toStrictEqual([true]);
    expect(accepted(judge([resizing(SPLIT, 2n), funding], [master(), master(), master(), master(), change])))
      .toBe(false);
    expect(accepted(judge([resizing(SPLIT, 3n), funding], [master(), master(), master(), master(), change])))
      .toBe(true);
    expect(accepted(judge([resizing(SPLIT, 2n), funding], [master(), master(), change]))).toBe(false);
  });

  it('refuses a count past the bound its source requires', () => {
    const minted = (count: number): Output[] => [master(), ...Array.from({ length: count }, () => master()), change];
    expect(accepted(judge([resizing(SPLIT, 3n), funding], minted(3)))).toBe(true);
    expect(accepted(judge([resizing(SPLIT, 4n), funding], minted(4)))).toBe(false);
  });

  it('refuses a new master that is not byte-identical to the others', () => {
    const elsewhere = master(1200n, USER_LOCK);
    const committed = master(1200n, MASTER.lockingBytecode, token('minting', Uint8Array.of(1)));
    const fungible = master(1200n, MASTER.lockingBytecode, { ...token(), amount: 5n });
    for (const odd of [elsewhere, committed, fungible]) {
      expect(accepted(judge([resizing(SPLIT, 1n), funding], [master(), odd, change]))).toBe(false);
    }
    expect(accepted(judge([resizing(SPLIT, 1n), funding], [master(), master(), change]))).toBe(true);
  });

  it('refuses a non-owner, and a signature of the owner that does not sign all outputs', () => {
    const outputs = [master(), master(), change];
    expect(accepted(judge([resizing(SPLIT, 1n, new SignatureTemplate(bobPriv)), funding], outputs))).toBe(false);
    for (const hashType of [HashType.SIGHASH_NONE, HashType.SIGHASH_SINGLE]) {
      const partial = new SignatureTemplate(sha256(new TextEncoder().encode('pool resize admin')), hashType);
      expect(accepted(judge([resizing(SPLIT, 1n, partial), funding], outputs))).toBe(false);
    }
    expect(accepted(judge([resizing(SPLIT, 1n, ADMIN), funding], outputs))).toBe(true);
  });

  it('touches no record: a state UTXO of the category spent or minted beside the split is refused', () => {
    const record: Output = { lockingBytecode: USER_LOCK, valueSatoshis: 1200n, token: token('mutable', Uint8Array.of(7)) };
    const spent: Input = { source: record, unlock: () => callerUnlockingBytecode() };
    expect(accepted(judge([resizing(SPLIT, 1n), spent, funding], [master(), master(), record, change]))).toBe(false);
    expect(accepted(judge([resizing(SPLIT, 1n), funding], [master(), master(), record, change]))).toBe(false);
  });
});

describe('merge(n): the admin retires exactly n masters, and a master survives', () => {
  it('accepts n retired masters beside a survivor recreated in place', () => {
    expect(judge([resizing(MERGE, 2n), retiring, retiring, funding], [master(), change])).toStrictEqual([true, true, true]);
    expect(accepted(judge([resizing(MERGE, 1n), retiring, retiring, funding], [master(), change]))).toBe(false);
  });

  it('refuses a merge below the minimum: no master survives the transaction', () => {
    expect(accepted(judge([retiring, retiring, funding], [change]))).toBe(false);
    expect(accepted(judge([resizing(MERGE, 1n), retiring, funding], [change]))).toBe(false);
    expect(accepted(judge([resizing(MERGE, 1n), retiring, funding], [master(), change]))).toBe(true);
  });

  it('refuses a retirement the admin did not sign a merge for', () => {
    expect(accepted(judge([resizing(SPLIT, 1n), retiring, funding], [master(), change, master()]))).toBe(false);
    expect(accepted(judge([resizing(MERGE, 1n, new SignatureTemplate(bobPriv)), retiring, funding], [master(), change])))
      .toBe(false);
    for (const hashType of [HashType.SIGHASH_NONE, HashType.SIGHASH_SINGLE]) {
      const partial = new SignatureTemplate(sha256(new TextEncoder().encode('pool resize admin')), hashType);
      expect(accepted(judge([resizing(MERGE, 1n, partial), retiring, funding], [master(), change]))).toBe(false);
    }
  });
});

describe('an entry neither mints nor retires a master', () => {
  const SAMPLE = 'pragma solidcash ^0.14.0; contract Sample { function ping() { require(true); } }';
  const sample = deployMaster(compileString(SAMPLE, { composition: 'framed' }), CATEGORY, VALIDATOR_PROGRAM);
  const block: WitnessBlock = {
    kind: 0, callerRef: 1, originRef: 1, validatorRef: 0xffff, sender: USER_LOCK, self: sample.address, value: 0n,
    retval: new Uint8Array(), calls: [], segments: [[]], events: [], sends: [],
  };
  const entry: Input = {
    source: master(1200n, sample.lockingBytecode),
    unlock: () => Uint8Array.from([...push(encodeWitnessBlock(block)), ...push(sample.script)]),
  };
  const caller: Input = { source: funding.source, unlock: funding.unlock };
  const own = master(1200n, sample.lockingBytecode);

  it('refuses a master minted beside the entry, at the master lock or anywhere else', () => {
    expect(judge([entry, caller], [own, change])).toStrictEqual([true]);
    expect(accepted(judge([entry, caller], [own, change, own]))).toBe(false);
    expect(accepted(judge([entry, caller], [own, change, master(1200n, USER_LOCK)]))).toBe(false);
  });

  it('refuses a master minted or retired beside a composition, which no validator settles', () => {
    // The callee can merge, so a master of it can be spent to retire; only a merge may recreate one beside that.
    const calleeAddress = seededAddress('pool resize callee');
    const { artifacts, contracts } = compileAndDeploy('pragma solidcash ^0.14.0;'
      + ' interface ICallee { function ping(); }'
      + ' contract Callee {'
      + `   pubkey constant ADMIN = pubkey(0x${binToHex(ADMIN.getPublicKey())});`
      + '   int total;'
      + '   function ping() { require(true); }'
      + '   function shrink(int n, sig s) merge(n) { require(checkSig(s, ADMIN)); }'
      + ' }'
      + ' contract Caller {'
      + `   function callIt() { ICallee(0x${hexOf(calleeAddress)}).ping.call(); require(true); }`
      + ' }', { Caller: 'pool resize caller', Callee: 'pool resize callee' });
    const callerContract = contracts.Caller!;
    const callee = contracts.Callee!;
    const validator = validatorFor(callerContract.category);
    const ping = selectorOf(artifacts, 'Callee', 'ping');
    const outcome = composeAndDerive({
      blocks: [
        { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
        { contract: 'Callee', masters: ['callee-1'], state: [] },
      ],
      userInputs: userInputs(['user'], 4),
      masters: [
        draftMaster({
          master: 'caller-1', contract: 'Caller', entry: 'callIt', program: callerContract.program,
          facts: { contract: 'Caller', functionName: 'callIt', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1 },
          frame: { kind: FrameKind.ROOT, sender: DRAFT_USER_LOCK, self: callerContract.address, value: 0n },
          enteredBy: 'user', origin: 'user',
          calls: [{ kind: FrameKind.CALL, callee: 'callee-1', target: callee.address, value: 0n, argumentPushes: [ping] }],
        }),
        draftMaster({
          master: 'callee-1', contract: 'Callee', entry: 'ping', program: callee.program,
          facts: { contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1 },
          frame: { kind: FrameKind.CALL, sender: callerContract.address, self: callee.address, value: 0n },
          enteredBy: 'caller-1', origin: 'user', argumentPushes: [ping],
        }),
      ],
      inputs: {
        'caller-1': { source: masterInput(callerContract) },
        'callee-1': { source: masterInput(callee) },
        validator: {
          source: {
            lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: draftToken(callerContract.category, 'mutable'),
          },
        },
        user: userInput(),
      },
      validator: { id: 'validator', covers: ['Callee'], settles: [], redeemScript: validator.redeem },
    }, [artifacts.Caller!, artifacts.Callee!], [rootOf('Caller', 'callIt', 'caller-1')]);
    expect(outcome.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    const program = outcome.draft.programFor('caller-1');
    const vm = compositionMachine();
    const calleeVerdict = (transaction: typeof program.transaction, sources = program.sourceOutputs): boolean => {
      const index = outcome.contractInputs.find((input) => input.id === 'callee-1')!.index;
      return vm.stateSuccess(vm.evaluate({ inputIndex: index, sourceOutputs: sources, transaction })) === true;
    };
    const minted = { lockingBytecode: USER_LOCK, valueSatoshis: 1000n, token: draftToken(callee.category, 'minting') };
    expect(calleeVerdict({ ...program.transaction, outputs: [...program.transaction.outputs, minted] })).toBe(false);
    const retiree = {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(0x7a), sequenceNumber: 0xffffffff,
      unlockingBytecode: Uint8Array.from([...push(Uint8Array.of(RETIRE)), ...push(callee.program)]),
    };
    const retired = { ...program.transaction, inputs: [...program.transaction.inputs, retiree] };
    const sources = [...program.sourceOutputs, masterInput(callee)];
    const retireeVerdict = vm.evaluate({
      inputIndex: retired.inputs.length - 1, sourceOutputs: sources, transaction: retired,
    });
    expect(vm.stateSuccess(retireeVerdict)).toBe(true);
    expect(calleeVerdict(retired, sources)).toBe(false);
  });
});

describe('the owner resizes a deployed pool', () => {
  it('splits 12 -> 14, runs a composition on a new master, and merges back to 12', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const alice = new SignatureTemplate(alicePriv);
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const coin = (byte: string, satoshis: bigint): { txid: string; vout: number; satoshis: bigint } =>
      ({ txid: byte.repeat(32), vout: 0, satoshis });
    const genesis = coin('5a', 500_000n);
    await provider.addUtxo(wallet.address, genesis);
    const { contract, categoryId } = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: genesis, funder: wallet.unlock.spend(alicePub, alice), changeAddress: wallet.address,
    });
    const masters = async (): Promise<readonly { txid: string; vout: number }[]> =>
      (await readFramedDeployment(provider, categoryId, artifact.stateLayout!)).masters;
    expect((await masters()).length).toBe(12);

    const splitFunding = coin('5b', 50_000n);
    await provider.addUtxo(wallet.address, splitFunding);
    const splitBy = (signer: SignatureTemplate): ReturnType<typeof StatefulContract.split> => StatefulContract.split({
      provider, contract, splitFunctionName: 'grow', splitFunctionArgs: [2n, signer],
      funder: wallet.unlock.spend(alicePub, alice), fundingUtxos: [splitFunding], changeAddress: wallet.address,
    });
    await expect(splitBy(new SignatureTemplate(bobPriv))).rejects.toThrow(/input index 0: Program failed a signature/);
    expect((await masters()).length).toBe(12);
    const split = await splitBy(ADMIN);
    expect((await masters()).length).toBe(14);

    // The call sees only the two masters the split minted, so the composition has to run on one of them.
    const onlyNew = new Proxy(provider, {
      get(target, key): unknown {
        if (key === 'getUtxosByTokenCategory') {
          return async (category: string) => (await target.getUtxosByTokenCategory(category)).filter((utxo) =>
            utxo.token?.nft?.capability !== 'minting' || (utxo.txid === split.tx.txid && utxo.vout > 0));
        }
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const callerUtxo = coin('5c', 200_000n);
    await provider.addUtxo(binToHex(callerLock), callerUtxo);
    await fundShippedFacets(provider);
    const call = await callFramedEntry({
      provider: onlyNew, artifact, categoryId, functionName: 'bump', args: [], callerUtxo,
      callerLockingBytecode: callerLock, funder: alice.unlockP2PKH(), vm: compositionMachine(),
    });
    expect(call.accepted).toBe(true);
    const spentNew = call.broadcast!.inputs.some((input) => binToHex(input.outpointTransactionHash) === split.tx.txid);
    expect(spentNew).toBe(true);
    expect((await masters()).length).toBe(14);

    const mergeFunding = coin('5d', 50_000n);
    await provider.addUtxo(wallet.address, mergeFunding);
    const pool = await masters();
    await StatefulContract.merge({
      provider, contract, mergeFunctionName: 'shrink', mergeFunctionArgs: [2n, ADMIN],
      funder: wallet.unlock.spend(alicePub, alice), consumedMasterUtxos: pool.slice(-2) as never,
      fundingUtxos: [mergeFunding], changeAddress: wallet.address,
    });
    expect((await masters()).length).toBe(12);
  });
});
