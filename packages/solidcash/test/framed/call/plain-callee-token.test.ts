import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { FrameKind, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * An ERC-20-like callee on the plain call path (spec 10, 18): `Payer.pay` calls `IERC20(token).transfer`, whose
 * body debits its caller's balance, credits a recipient the list does not hold yet, emits `Transfer` and returns.
 * The callee runs as a frame of the token's own block: the node its caller's key sits at, the node the recipient's
 * key is spliced beside and the node the insert creates are declared in its segment, its event output follows the
 * root's, and each value its body computes is learned from its own close. `Payer.held` reads the token's mapping
 * through a callee that only reads it. A `transfer` past the balance is refused by the callee's own `require`, and a
 * spend whose event output another payload replaced is refused by the callee's master.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface IERC20 { function transfer(address to, uint256 amount) external returns (bool);'
  + '   function balanceOf(address who) external view returns (uint256); }'
  + ' contract Token { mapping(address => uint256) public balanceOf;'
  + '   event Transfer(address indexed from, address indexed to, uint256 value);'
  + '   function mint(address to, uint256 amount) external { balanceOf[to] += amount; }'
  + '   function transfer(address to, uint256 amount) external returns (bool) {'
  + '     require(balanceOf[msg.sender] >= amount, "balance");'
  + '     balanceOf[msg.sender] -= amount; balanceOf[to] += amount;'
  + '     emit Transfer(msg.sender, to, amount); return true; } }'
  + ' contract Payer { IERC20 public token;'
  + '   constructor(IERC20 token_) { token = token_; }'
  + '   function pay(address to, uint256 amount) external { token.transfer(to, amount); }'
  + '   function payUpTo(address to, uint256 amount, uint256 cap) external {'
  + '     require(amount <= cap, "over the cap"); token.transfer(to, amount); }'
  + '   function held() external view returns (uint256) { return token.balanceOf(address(this)); } }';

/** A user the payer pays, whose key the token's list does not hold. */
const RECIPIENT = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x44));
const USER = encodeLockingBytecodeP2pkh(alicePkh);

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<'Token' | 'Payer', Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  /** The lock each deployment's category derives: its address. */
  readonly locks: ReadonlyMap<string, Uint8Array>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;
let coins = 0;

/** A fresh coin of the user's, which a call spends. */
async function coin(provider: MockNetworkProvider): Promise<{ txid: string; vout: number; satoshis: bigint }> {
  coins += 1;
  const utxo = { txid: `${'73'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await provider.addUtxo(binToHex(USER), utxo);
  return utxo;
}

/** The token, the payer holding it, and 1000 minted to the payer; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Token: compiled.Token!, Payer: compiled.Payer! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['Token', []], ['Payer', ['Token']]] as const).entries()) {
      const fundingUtxo = { txid: `${'74'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name], args.map((arg) => locks.get(arg)!), {
        provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      categories.set(name, deployment.categoryId);
      locks.set(name, validatorAddress(hexToBin(deployment.categoryId), validatorProgram));
    }
    const minted = await callFramedEntry({
      provider, artifact: artifacts.Token, categoryId: categories.get('Token')!, functionName: 'mint',
      args: [locks.get('Payer')!, 1000n], callerUtxo: await coin(provider), callerLockingBytecode: USER,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
    });
    expect(minted.accepted).toBe(true);
    return { provider, artifacts, categories, locks, snapshot: await provider.takeSnapshot() };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

/** Enters one of the payer's entries with a fresh coin of the user's, naming the token as its calls reach it. */
async function enter(
  chain: Deployed, functionName: string, args: readonly (bigint | Uint8Array)[] = [],
): Promise<FramedCallResult> {
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Payer, categoryId: chain.categories.get('Payer')!,
    functionName, args, callerUtxo: await coin(chain.provider), callerLockingBytecode: USER,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
    externals: { Token: { artifact: chain.artifacts.Token, categoryId: chain.categories.get('Token')! } },
  });
}

/** A key's balance, read back from the token's list on chain. */
async function balanceOf(chain: Deployed, who: Uint8Array): Promise<unknown> {
  const read = await readFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Token, categoryId: chain.categories.get('Token')!,
    functionName: 'balanceOf', args: [who], vm: compositionMachine(),
  });
  return read.value;
}

describe('an ERC-20-like callee on the plain call path', () => {
  it('serves transfer: the callee debits, inserts the recipient, emits, and every value reads back', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'pay', [RECIPIENT, 100n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => [frame.functionName, frame.kind]))
      .toStrictEqual([['Token.transfer()', FrameKind.CALL], ['Payer.pay()', FrameKind.ROOT]]);
    // The token's block spends the payer's node and creates the recipient's: one node input, two trailing outputs,
    // the event first.
    const tokenNodes = result.draft.layout.participants
      .filter((placed) => placed.contract === 'Token' && placed.kind === 'state');
    expect(tokenNodes).toHaveLength(1);
    expect(result.draft.trailingOutputs).toHaveLength(2);
    expect(await balanceOf(chain, chain.locks.get('Payer')!)).toBe(900n);
    expect(await balanceOf(chain, RECIPIENT)).toBe(100n);
    // The event is the callee's, listed by its frame, and read back from the broadcast transaction's output.
    const logs = compositionEventLogs(result.draft, [chain.artifacts.Token, chain.artifacts.Payer], {
      outputs: result.broadcast!.outputs,
    });
    expect(logs.map((log) => [log.contract, log.eventName, log.outputIndex]))
      .toStrictEqual([['Token', 'Transfer', result.draft.trailingOutputs[0]!.index]]);
    expect(logs[0]!.args).toStrictEqual({ from: chain.locks.get('Payer')!, to: RECIPIENT, value: 100n });
    expect(logs[0]!.address).toStrictEqual(chain.locks.get('Token')!);

    // The callee's master refuses the same spend once its event output carries another payload: the value field is
    // the payload's last byte, so 100 becomes 101.
    const master = result.draft.layout.participants.find((placed) => placed.id === 'callee-master-1')!;
    const [eventIndex] = result.draft.blockOf(master.id).events;
    const machine = compositionMachine();
    const evaluate = (outputs: typeof result.transaction.outputs): boolean => machine.stateSuccess(machine.evaluate({
      inputIndex: master.index, sourceOutputs: result.sourceOutputs, transaction: { ...result.transaction, outputs },
    })) === true;
    expect(evaluate(result.transaction.outputs)).toBe(true);
    const outputs = result.transaction.outputs.map((output, index) => {
      if (index !== eventIndex) return output;
      const commitment = Uint8Array.from(output.token!.nft!.commitment);
      commitment[commitment.length - 1] ^= 0x01;
      return { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } } };
    });
    expect(evaluate(outputs)).toBe(false);
  });

  it('serves a callee that only reads the mapping: it answers from the node its key sits at', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'held');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.values).toStrictEqual([1000n]);
    expect(result.completed.map((frame) => [frame.functionName, frame.kind]))
      .toStrictEqual([['Token.balanceOf()', FrameKind.STATIC], ['Payer.held()', FrameKind.ROOT]]);
    // The node is spent on its read-only path and recreated as it was.
    const node = result.draft.layout.participants.find((placed) => placed.contract === 'Token' && placed.kind === 'state')!;
    expect(binToHex(result.transaction.outputs[node.index]!.token!.nft!.commitment))
      .toBe(binToHex(result.sourceOutputs[node.index]!.token!.nft!.commitment));
  });

  it('refuses a transfer past the balance at the callee\'s own require, and broadcasts nothing', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'pay', [RECIPIENT, 5000n]);
    expect(result.accepted).toBe(false);
    expect(result.broadcast).toBeUndefined();
    // The transfer never returns, so the payer's frame decodes the plan's stand-in for its result and the machine
    // refuses it too, on no reason of its own. The transfer's `require` is the refusal the execution meets first.
    expect(result.refusal?.refusals.map((refusal) => refusal.master)).toStrictEqual(['master', 'callee-master-1']);
    expect(result.refusal?.refusals[0]?.reason.message).toBeUndefined();
    expect(result.refusal?.innermost?.master).toBe('callee-master-1');
    expect(result.verdicts.find((verdict) => verdict.id === 'callee-master-1')?.objection)
      .toMatch(/^frame "callee-master-1" of Token\.transfer\(\) at line 1: balance /);
    expect(await balanceOf(chain, chain.locks.get('Payer')!)).toBe(1000n);
    expect(await balanceOf(chain, RECIPIENT)).toBe(0n);
  });

  it('refuses at the payer\'s own cap, before the transfer it never makes, though that transfer refuses too',
    async () => {
      const chain = await deployed();
      const result = await enter(chain, 'payUpTo', [RECIPIENT, 5000n, 100n]);
      expect(result.accepted).toBe(false);
      expect(result.broadcast).toBeUndefined();
      // The derivation's stalled step at the call site leaves the transfer's reference filled, and the transfer's own
      // frame refuses the balance; the payer stops at its cap with that reference unfilled too, so it never made the
      // call and its own check is the refusal the execution meets first (spec V6).
      expect(result.refusal?.refusals.map((refusal) => refusal.master)).toStrictEqual(['master', 'callee-master-1']);
      expect(result.refusal?.innermost?.master).toBe('master');
      expect(result.refusal?.innermost?.reason.message).toBe('over the cap');
      expect(await balanceOf(chain, chain.locks.get('Payer')!)).toBe(1000n);
    });
});
