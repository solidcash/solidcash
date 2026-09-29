import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex } from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * Calling an entry on a deployed per-call contract that keeps a mapping.
 *
 * The contract holds one `mapping(address => uint)`, so its state is not a data NFT but a chain of entry NFTs: the
 * genesis mints the empty list's head and the node the constructor's write created, and a call that writes a key
 * has to declare the node it spends and, for a key the list does not hold, the node it creates. The whole shipped
 * path runs — compile, deploy, classify the category's UTXOs, plan the entry's mapping records against the live
 * inventory, derive, evaluate and broadcast — and the created node's commitment is what the entry's own body
 * computed, not something the test states.
 *
 * `deposit(who, amount)` writes `balances[who] = balances[who] + amount`, the read-then-write shape a token
 * transfer has. Called for a key the list does not hold it splices a new node in; called for the key the
 * constructor seeded it rewrites that node in place.
 */

const CATEGORY_HEX = '77'.repeat(32);
const CALLER_TXID = '88'.repeat(32);

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   constructor(address owner) { this.balances[owner] = 1; }'
  + '   function deposit(address who, uint amount) {'
  + '     this.balances[who] = this.balances[who] + amount;'
  + '     require(amount <= 1000000);'
  + '   }'
  + '   function balanceOf(address who) view returns (uint) { return this.balances[who]; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const ledger = artifacts.Ledger!;
const VALIDATOR_PROGRAM = perCallValidator.buildValidatorProgram();

const SEED_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x33));
const RECIPIENT_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x44));

/** The key bytes the body hashes for a `who` address, which is its 25-byte locking bytecode. */
function keyOf(lock: Uint8Array): Uint8Array {
  return encodeFunctionArgument(lock, 'address') as Uint8Array;
}

/** The value tail the body stores for a `uint` amount, which is the node's commitment past slot and successor. */
function valueOf(amount: bigint): Uint8Array {
  return encodeFunctionArgument(amount, 'uint256') as Uint8Array;
}

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/** Deploys the contract through the shipped deployment and funds the caller's own coin at its P2PKH lock. */
async function deploy(): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);

  const deployment = await deployStatefulContract(ledger, [SEED_LOCK], {
    provider,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, signature),
    changeAddress: funder.address,
  });

  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 200_000n };
  await provider.addUtxo(binToHex(callerLock), callerUtxo);
  return { provider, categoryId: deployment.categoryId, callerUtxo, callerLock, funder: signature.unlockP2PKH() };
}

/** Calls `deposit` through the shipped call path. */
async function deposit(deployed: Deployed, who: Uint8Array, amount: bigint): ReturnType<typeof callPerCallEntry> {
  return callPerCallEntry({
    provider: deployed.provider,
    artifact: ledger,
    categoryId: deployed.categoryId,
    functionName: 'deposit',
    args: [who, amount],
    callerUtxo: deployed.callerUtxo,
    callerLockingBytecode: deployed.callerLock,
    funder: deployed.funder,
    vm: compositionMachine(),
  });
}

/** The commitment the call ends a mapping node at, read out of the draft's output for it. */
function nodeOutput(result: Awaited<ReturnType<typeof callPerCallEntry>>, index: number): Uint8Array {
  const commitment = result.transaction.outputs[index]?.token?.nft?.commitment;
  if (commitment === undefined) throw new Error(`no node commitment at output ${index}`);
  return Uint8Array.from(commitment);
}

describe('calling an entry that writes a mapping on a deployed per-call contract', () => {
  it('declares the head sentinel and creates the node for a key the list does not hold', async () => {
    const deployed = await deploy();
    // The genesis wrote `balances[SEED]`, so the category holds the relinked head and the seeded node.
    const genesis = await readPerCallDeployment(deployed.provider, deployed.categoryId, ledger.stateLayout!);
    const seeded = genesis.nodesByCollection.get('balances') ?? [];
    expect(seeded).toHaveLength(2);
    // The constructor's own write relinked the head, so no live node carries the empty list's commitment.
    expect(seeded.map((node) => node.token?.nft?.commitment))
      .not.toContain(binToHex(headSentinelCommitment()));

    const result = await deposit(deployed, RECIPIENT_LOCK, 77n);

    // Every participant — the master, the validator, the two mapping nodes and the caller — is accepted.
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['Ledger.deposit()']);

    // The call declares a participant for the node the write splices through, and one created node.
    const nodeIds = result.draft.layout.participants
      .filter((placed) => placed.id.startsWith('mapping-node-')).map((placed) => placed.id);
    expect(nodeIds).toHaveLength(1);
    expect(result.draft.trailingOutputs).toHaveLength(1);

    // The created node's commitment is what the entry's own body computed: the recipient's slot and the amount.
    const created = nodeOutput(result, result.draft.trailingOutputs[0]!.index);
    const decoded = decodeEntryCommitment(created);
    expect(bytesToHex(decoded.slot)).toBe(bytesToHex(keyToSlotMulti([keyOf(RECIPIENT_LOCK)])));
    expect(bytesToHex(decoded.value)).toBe(bytesToHex(valueOf(77n)));

    // The splice relinks the predecessor to the created slot, so the input the call spends carries that link.
    const spent = nodeOutput(result, result.draft.layout.participants
      .find((placed) => placed.id === nodeIds[0])!.index);
    expect(bytesToHex(decodeEntryCommitment(spent).nextKey)).toBe(bytesToHex(decoded.slot));

    expect(result.broadcast).toBeDefined();
  });

  it('declares the node a held key sits at, and rewrites it in place', async () => {
    const deployed = await deploy();
    const result = await deposit(deployed, SEED_LOCK, 10n);

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    // An update declares the node alone: nothing is created.
    const nodeIds = result.draft.layout.participants
      .filter((placed) => placed.id.startsWith('mapping-node-'));
    expect(nodeIds).toHaveLength(1);
    expect(result.draft.trailingOutputs).toHaveLength(0);

    // The node the constructor wrote held 1; the entry's own body computed 1 + 10.
    const written = nodeOutput(result, nodeIds[0]!.index);
    const decoded = decodeEntryCommitment(written);
    expect(bytesToHex(decoded.slot)).toBe(bytesToHex(keyToSlotMulti([keyOf(SEED_LOCK)])));
    expect(bytesToHex(decoded.value)).toBe(bytesToHex(valueOf(11n)));
    expect(result.broadcast).toBeDefined();
  });

  it('refuses a key the entry only reads beside its write, naming the fact', async () => {
    // `move` writes `to` but reads `from` beside that write. The batch declares one group per write, so the read
    // has no ordinal of its own and the call has no node to declare it with.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   constructor(address owner) { this.balances[owner] = 1; }'
      + '   function move(address from, address to, uint amount) {'
      + '     this.balances[to] = amount;'
      + '     require(this.balances[from] >= amount);'
      + '   }'
      + ' }';
    const moving = compileStringMulti(source, { composition: 'per-call' }).Ledger!;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    const deployment = await deployStatefulContract(moving, [SEED_LOCK], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
    });
    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 200_000n };
    await provider.addUtxo(binToHex(callerLock), callerUtxo);

    await expect(callPerCallEntry({
      provider, artifact: moving, categoryId: deployment.categoryId, functionName: 'move',
      args: [SEED_LOCK, RECIPIENT_LOCK, 5n], callerUtxo, callerLockingBytecode: callerLock,
      funder: signature.unlockP2PKH(), vm: compositionMachine(),
    })).rejects.toThrow(/reads a mapping key outside the write batch/);
  });
});
