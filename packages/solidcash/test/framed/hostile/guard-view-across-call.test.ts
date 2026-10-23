import { beforeAll, describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  FrameKind, buildPushdataCommitment, bytesToHex, concatBytes, decodeWitnessBlock, encodeWitnessBlock,
  parsePushdataCommitment, sha256, splitFirstPush, validatorAddress, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import {
  createComposedDerivationHost, deriveDepthFirst, participant, reportCompositionRefusal,
  type CompositionDraftPlan, type CompositionRefusal,
} from '../../../src/framed/composer/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, compileAndDeploy, entryName, fundShippedFacets, hexOf, layoutWithFacets, master,
  masterInput, rootOf, seededAddress, selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';

/**
 * A reentrancy guard shown clear while the call it guards runs.
 *
 * A guard is a field of its contract's record set before the call and cleared after it, so a frame that re-enters
 * the contract below that call reads it set and is refused by the guard's own check. A builder who wants the
 * re-entered frame to pass has to declare the record with the guard clear at the call. The outer frame closes the
 * record against that declaration at the call, so it refuses: on the hop's own transaction for a root behind its
 * proxy, whose delegate frame declares the record in both segments its call splits it into, and on a composed
 * transaction whose callee calls back into a guarded entry, where the re-entered frame, declared honestly, meets the
 * guard's own reason.
 */

const HOP_SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IPing { function ping() external; }',
  'contract Ping { uint256 public seen; function ping() external { seen += 1; } }',
  'contract Guarded {',
  '  address public implementation;',
  '  uint256 private status;',
  '  IPing public target;',
  '  modifier nonReentrant() { require(status != 2, "reentrant"); status = 2; _; status = 1; }',
  '  function initialize(IPing target_) public { target = target_; status = 1; }',
  '  function poke() external nonReentrant { target.ping(); }',
  '}',
].join('\n');

const hopArtifacts = compileStringMulti(HOP_SOURCE, { evmCompat: true, composition: 'framed' } as never);
const guardedProxy = buildProxyArtifact(hopArtifacts.Guarded!);
const CALLER = encodeLockingBytecodeP2pkh(alicePkh);
const IMPLEMENTATION = 'implementation-master';

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

function coin(label: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid: bytesToHex(sha256(utf8ToBin(`guard view across call ${label}`))), vout: 0, satoshis: 5_000_000n };
}

let poked: FramedProxyCallResult | undefined;

beforeAll(async () => {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const changeAddress = wallet.address;
  await fundShippedFacets(network);
  const [pingCoin, implementationCoin, proxyCoin] = ['ping', 'implementation', 'proxy'].map(coin);
  for (const utxo of [pingCoin!, implementationCoin!, proxyCoin!]) await network.addUtxo(wallet.address, utxo);
  const [initCoin, callCoin] = ['initialize', 'poke'].map(coin);
  for (const utxo of [initCoin!, callCoin!]) await network.addUtxo(binToHex(CALLER), utxo);
  const ping = await deployStatefulContract(hopArtifacts.Ping!, [], {
    provider: network, fundingUtxo: pingCoin!, changeAddress, funder,
  });
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: hopArtifacts.Guarded!,
    proxyArtifact: guardedProxy,
    implementationDeploy: { fundingUtxo: implementationCoin!, funder, changeAddress },
    proxyDeploy: { fundingUtxo: proxyCoin!, funder, changeAddress },
    initialize: {
      functionName: 'initialize', args: [validatorAddress(hexToBin(ping.categoryId), VALIDATOR_PROGRAM)],
    },
    callerLockingBytecode: CALLER,
    callerFunding: { utxo: initCoin!, funder: callerFunder, changeAddress },
    vm: compositionMachine(),
  });
  poked = await callFramedProxyEntry({
    provider: network,
    implementationArtifact: hopArtifacts.Guarded!,
    proxyArtifact: guardedProxy,
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    functionName: 'poke',
    externals: { IPing: { artifact: hopArtifacts.Ping!, categoryId: ping.categoryId } },
    callerUtxo: callCoin!,
    callerLockingBytecode: CALLER,
    funder: callerFunder,
    changeAddress,
    vm: compositionMachine(),
  });
});

function settled(): FramedProxyCallResult {
  if (poked === undefined) throw new Error('the guarded call was not settled');
  return poked;
}

/** The participants that refuse a spend, by id; the validator's facet answers for the validator. */
function refusing(transaction: VmTransaction): readonly string[] {
  const vm = compositionMachine();
  const { verdicts, sourceOutputs } = settled();
  return [...new Set(verdicts.filter((verdict) => vm.stateSuccess(vm.evaluate({
    inputIndex: verdict.index, sourceOutputs: [...sourceOutputs], transaction,
  })) !== true).map((verdict) => verdict.id.replace(/\/\d+$/, '')))].sort();
}

/** A fresh copy of the accepted spend with a master's witness block edited in place. */
function withBlock(id: string, edit: (block: WitnessBlock) => void): VmTransaction {
  const transaction = structuredClone(settled().transaction) as VmTransaction;
  const index = settled().verdicts.find((verdict) => verdict.id === id)!.index;
  const { payload, rest } = splitFirstPush(transaction.inputs[index]!.unlockingBytecode);
  const block = decodeWitnessBlock(payload);
  edit(block);
  transaction.inputs[index] = {
    ...transaction.inputs[index]!, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
  return transaction;
}

/** The guard's record entry in each segment of a frame's block. */
function guardEntries(block: WitnessBlock): RecordEntry[] {
  const field = guardedProxy.stateLayout!.variables.find((variable) => variable.name === 'status')!;
  const index = participant(settled().draft.layout, `proxy-record-${field.nftIndex}`).index;
  return block.segments.map((segment) => segment.find((entry) => entry.in === index)!);
}

/** The guard's value in a declared view. */
function guardOf(view: Uint8Array): unknown {
  const layout = guardedProxy.stateLayout!;
  const field = layout.variables.find((variable) => variable.name === 'status')!;
  return parsePushdataCommitment(binToHex(view), layout, field.nftIndex).status;
}

describe('the guard of a root behind its proxy, shown clear while its call runs', () => {
  it('is accepted at every input as settled, the guard set across the call', () => {
    const result = settled();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(refusing(structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
    const declared = guardEntries(result.draft.blockOf(IMPLEMENTATION));
    expect(declared.map((entry) => [guardOf(entry.viewIn), guardOf(entry.viewOut)])).toStrictEqual([[1n, 2n], [2n, 1n]]);
  });

  it('is refused by the delegate frame when its record is declared with the guard clear at the call', () => {
    // The chain still links from the record the proxy spent to the one it recreates, so only the frame whose body
    // set the guard can tell: its close at the call computes the guard set.
    const forged = withBlock(IMPLEMENTATION, (block) => {
      const [before, after] = guardEntries(block);
      before!.viewOut = before!.viewIn;
      after!.viewIn = before!.viewIn;
    });
    expect(refusing(forged)).toStrictEqual([IMPLEMENTATION]);
  });
});

const GUARDED_LABEL = 'guard view guarded';
const HOOK_LABEL = 'guard view hook';
const GUARDED = hexOf(seededAddress(GUARDED_LABEL));
const HOOK = hexOf(seededAddress(HOOK_LABEL));

/** A callee that calls back into a guarded entry of the contract that called it. */
const REENTRY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IHook { function hook(); }'
  + ' interface IGuarded { function bump(); }'
  + ` contract Hook { function hook() { IGuarded(0x${GUARDED}).bump(); require(true); } }`
  + ' contract Guarded {'
  + '   int status;'
  + '   int count;'
  + '   function enter() {'
  + '     require(this.status != 2, "reentrant");'
  + '     this.status = 2;'
  + `     IHook(0x${HOOK}).hook();`
  + '     this.status = 1;'
  + '     require(true);'
  + '   }'
  + '   function bump() {'
  + '     require(this.status != 2, "reentrant");'
  + '     this.status = 2;'
  + '     this.count = this.count + 1;'
  + '     this.status = 1;'
  + '     require(true);'
  + '   }'
  + ' }';

const { artifacts, contracts } = compileAndDeploy(REENTRY_SOURCE, { Guarded: GUARDED_LABEL, Hook: HOOK_LABEL });
const commitment = (status: bigint, count: bigint): Uint8Array => new Uint8Array(Buffer.from(
  buildPushdataCommitment(artifacts.Guarded!.stateLayout!, { status, count }, 0), 'hex'));
const CLEAR = commitment(1n, 0n);
const HELD = commitment(2n, 0n);
const BUMPED = commitment(1n, 1n);

type View = readonly [Uint8Array, Uint8Array];

/** `enter` on the guarded contract, its callee calling back into `bump`; each frame declares the record `views`. */
function reentryPlan(views: { readonly enter: readonly [View, View]; readonly bump: View }): CompositionDraftPlan {
  const guarded = contracts.Guarded!;
  const hook = contracts.Hook!;
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Guarded', masters: ['enter-1', 'bump-1'], validator: { id: 'validator', settles: [] }, state: ['record'] },
    { contract: 'Hook', masters: ['hook-1'], state: [] },
  ];
  const layout = layoutWithFacets(blocks);
  const record = participant(layout, 'record').index;
  const declared = ([viewIn, viewOut]: View): RecordEntry => ({ in: record, out: record, viewIn, viewOut });
  const enterPushes = [selectorOf(artifacts, 'Guarded', 'enter')];
  const hookPushes = [selectorOf(artifacts, 'Hook', 'hook')];
  const bumpPushes = [selectorOf(artifacts, 'Guarded', 'bump')];
  const lock = stateRecordLockingBytecode(bytesToHex(guarded.category));
  const validator = validatorFor(guarded.category);
  return {
    blocks,
    userInputs: userInputs(['user'], layout.funderInputBase),
    masters: [
      master({
        master: 'enter-1', contract: 'Guarded', entry: 'enter', program: guarded.program,
        facts: {
          contract: 'Guarded', functionName: entryName('Guarded', 'enter'), kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 2,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: guarded.address, value: 0n },
        enteredBy: 'user', origin: 'user',
        calls: [{ kind: FrameKind.CALL, callee: 'hook-1', target: hook.address, value: 0n, argumentPushes: hookPushes }],
        segments: views.enter.map((view) => [declared(view)]),
        argumentPushes: enterPushes, dispatches: true,
      }),
      master({
        master: 'hook-1', contract: 'Hook', entry: 'hook', program: hook.program,
        facts: {
          contract: 'Hook', functionName: entryName('Hook', 'hook'), kind: FrameKind.CALL,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.CALL, sender: guarded.address, self: hook.address, value: 0n },
        enteredBy: 'enter-1', origin: 'user',
        calls: [{ kind: FrameKind.CALL, callee: 'bump-1', target: guarded.address, value: 0n, argumentPushes: bumpPushes }],
        argumentPushes: hookPushes,
      }),
      master({
        master: 'bump-1', contract: 'Guarded', entry: 'bump', program: guarded.program,
        facts: {
          contract: 'Guarded', functionName: entryName('Guarded', 'bump'), kind: FrameKind.CALL,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
        },
        frame: { kind: FrameKind.CALL, sender: hook.address, self: guarded.address, value: 0n },
        enteredBy: 'hook-1', origin: 'user',
        segments: [[declared(views.bump)]],
        argumentPushes: bumpPushes,
      }),
    ],
    inputs: {
      'enter-1': { source: masterInput(guarded) },
      'bump-1': { source: masterInput(guarded) },
      'hook-1': { source: masterInput(hook) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(guarded.category, 'mutable') },
      },
      record: {
        source: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(guarded.category, 'mutable', CLEAR) },
        output: {
          lockingBytecode: lock, valueSatoshis: 20_000n, token: token(guarded.category, 'mutable', views.enter[1][1]),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(guarded.category),
          participant(layout, 'enter-1').index, 1),
      },
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: ['Hook'],
      settles: [{ category: guarded.category, stateInputs: ['record'] }],
      redeemScript: validator.redeem,
    },
  };
}

/** Derives the composition from `enter` and reports the frame the execution is refused at. */
function reenter(views: Parameters<typeof reentryPlan>[0]): { readonly code?: string; readonly report: CompositionRefusal } {
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Guarded!, artifacts.Hook!], plan: reentryPlan(views),
  });
  let code: string | undefined;
  try {
    deriveDepthFirst(rootOf('Guarded', 'enter', 'enter-1'), host);
  } catch (caught) {
    code = (caught as { code?: string }).code;
  }
  const report = reportCompositionRefusal({
    draft, artifacts: [artifacts.Guarded!, artifacts.Hook!], vm: compositionMachine(),
  });
  return { ...(code === undefined ? {} : { code }), report };
}

describe('a callee calling back into a guarded entry of the contract that called it', () => {
  it('is refused by the guard\'s own reason in the re-entered frame, the record declared as the code leaves it', () => {
    const { code, report } = reenter({ enter: [[CLEAR, HELD], [HELD, CLEAR]], bump: [HELD, HELD] });
    expect(code).toBe('FRAMED_DERIVATION_STALLED');
    expect(report.accepted).toBe(false);
    expect(report.innermost!.master).toBe('bump-1');
    expect(report.innermost!.reason.message).toBe('reentrant');
  });

  it('is refused by the outer frame when the record is declared with the guard clear at its call', () => {
    // The re-entered frame would pass the guard and bump the count, but the frame that set the guard closes the
    // record against the clear view at its call and refuses before any callee is reached.
    const { code, report } = reenter({ enter: [[CLEAR, CLEAR], [BUMPED, BUMPED]], bump: [CLEAR, BUMPED] });
    expect(code).toBe('FRAMED_DERIVATION_STALLED');
    expect(report.innermost!.master).toBe('enter-1');
    expect(report.refusals.map((refusal) => refusal.master)).not.toContain('bump-1');
  });
});
