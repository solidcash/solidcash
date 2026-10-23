import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import {
  bytesToSlotValue, decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti,
} from '../../../src/stateful/SortedList.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { aliceAddress, alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Calling an entry on a deployed framed contract that keeps a mapping.
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

const CATEGORY_HEX = '77'.repeat(31) + '88';
const CALLER_TXID = '88'.repeat(32);
const SECOND_CALLER_TXID = '88'.repeat(31) + 'c2';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   constructor(address owner) { this.balances[owner] = 1; }'
  + '   function deposit(address who, uint amount) returns (uint) {'
  + '     this.balances[who] = this.balances[who] + amount;'
  + '     require(amount <= 1000000);'
  + '     return this.balances[who];'
  + '   }'
  + '   function balanceOf(address who) view returns (uint) { return this.balances[who]; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const ledger = artifacts.Ledger!;

const SEED_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x33));
const RECIPIENT_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x44));
/** The caller's own coin lock, which `msg.sender` resolves to: alice's P2PKH, the lock the harness signs. */
const CALLER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
/**
 * A `to` lock whose slot sorts above the caller's.
 *
 * Slot order is little-endian, so this is not a byte-order comparison of the hashes. The insert's predecessor is
 * the greatest slot below the target's, so this is what makes the caller's own node that predecessor.
 */
const RELINKED_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x02));

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
async function deploy(artifact: Artifact = ledger, seed: Uint8Array = SEED_LOCK): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);

  const deployment = await deployStatefulContract(artifact, [seed], {
    provider,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, signature),
    changeAddress: funder.address,
  });

  const callerLock = CALLER_LOCK;
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 200_000n };
  await provider.addUtxo(binToHex(callerLock), callerUtxo);
  // The calls broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(provider);
  return { provider, categoryId: deployment.categoryId, callerUtxo, callerLock, funder: signature.unlockP2PKH() };
}

/** The deployment with a fresh coin of the caller's own, for a call after another spent the first. */
async function withCallerCoin(deployed: Deployed, txid: string): Promise<Deployed> {
  const callerUtxo = { txid, vout: 0, satoshis: 200_000n };
  await deployed.provider.addUtxo(binToHex(deployed.callerLock), callerUtxo);
  return { ...deployed, callerUtxo };
}

let ledgerRun: Promise<Deployed> | undefined;

/** The ledger the first two cases share: the key each writes is one the other does not read. */
function ledgerDeployment(): Promise<Deployed> {
  ledgerRun ??= deploy();
  return ledgerRun;
}

/** Calls `deposit` through the shipped call path. */
async function deposit(deployed: Deployed, who: Uint8Array, amount: bigint): ReturnType<typeof callFramedEntry> {
  return callFramedEntry({
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
function nodeOutput(result: Awaited<ReturnType<typeof callFramedEntry>>, index: number): Uint8Array {
  const commitment = result.transaction.outputs[index]?.token?.nft?.commitment;
  if (commitment === undefined) throw new Error(`no node commitment at output ${index}`);
  return Uint8Array.from(commitment);
}

describe('calling an entry that writes a mapping on a deployed framed contract', () => {
  it('declares the head sentinel and creates the node for a key the list does not hold', async () => {
    const deployed = await ledgerDeployment();
    // The genesis wrote `balances[SEED]`, so the category holds the relinked head and the seeded node.
    const genesis = await readFramedDeployment(deployed.provider, deployed.categoryId, ledger.stateLayout!);
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

    // The entry also returned the value it wrote: the frame's `retval` carries it, read back through the shipped
    // decoder beside the node the same frame settled.
    expect(result.values).toStrictEqual([77n]);
    expect(result.broadcast).toBeDefined();
  });

  it('declares the node a held key sits at, and rewrites it in place', async () => {
    const deployed = await withCallerCoin(await ledgerDeployment(), SECOND_CALLER_TXID);
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
    // The entry returned the balance it wrote, so the same frame settles its mapping node and its `retval`.
    expect(result.values).toStrictEqual([11n]);
    expect(result.broadcast).toBeDefined();
  });

  it('settles an entry that calls another entry by name, which writes the caller\'s own node', async () => {
    // `viaSet` calls the entry `set`, and `viaSetAndReturn` the returning `setAndReturn`, each writing the node the
    // constructor seeded for the caller. The called entry is inlined into its caller, whose own batch then covers
    // the write; the call used not to compile at all.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   constructor(address owner) { this.balances[owner] = 1; }'
      + '   function set(uint amount) { this.balances[msg.sender] = amount; }'
      + '   function setAndReturn(uint amount) returns (uint) { this.balances[msg.sender] = amount; return amount; }'
      + '   function viaSet(uint amount) { set(amount); }'
      + '   function viaSetAndReturn(uint amount) returns (uint) { return setAndReturn(amount) + 1; }'
      + ' }';
    const token = compileStringMulti(source, { composition: 'framed' }).Ledger!;
    // One deployment serves both entries, each setting the caller's node outright; the second enters with a fresh coin.
    const shared = await deploy(token, CALLER_LOCK);
    for (const [entry, amount] of [['viaSet', 7n], ['viaSetAndReturn', 9n]] as const) {
      const deployed = entry === 'viaSet' ? shared : await withCallerCoin(shared, SECOND_CALLER_TXID);
      const result = await callFramedEntry({
        provider: deployed.provider, artifact: token, categoryId: deployed.categoryId, functionName: entry,
        args: [amount], callerUtxo: deployed.callerUtxo, callerLockingBytecode: deployed.callerLock,
        funder: deployed.funder, vm: compositionMachine(),
      });
      expect(result.verdicts.filter((verdict) => !verdict.accepted), entry).toStrictEqual([]);
      const node = result.draft.layout.participants.find((placed) => placed.id.startsWith('mapping-node-'))!;
      const decoded = decodeEntryCommitment(nodeOutput(result, node.index));
      expect(bytesToHex(decoded.slot)).toBe(bytesToHex(keyToSlotMulti([keyOf(CALLER_LOCK)])));
      expect(bytesToHex(decoded.value)).toBe(bytesToHex(valueOf(amount)));
      if (entry === 'viaSetAndReturn') expect(result.values).toStrictEqual([amount + 1n]);
    }
  });

  it('settles an entry that calls, by name or through this, one reading msg.sender to write a scalar', async () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   int total;'
      + '   constructor(address owner) { this.balances[owner] = 1; }'
      + '   function bump() { require(msg.sender != 0x); this.total = this.total + 1; }'
      + '   function viaBump() returns (int) { bump(); return this.total; }'
      + '   function viaThisBump() returns (int) { this.bump(); return this.total; }'
      + ' }';
    const token = compileStringMulti(source, { composition: 'framed' }).Ledger!;
    // One deployment serves both entries, the chain rewound to it before each, so each bumps `total` from zero.
    const deployed = await deploy(token, CALLER_LOCK);
    const fresh = await deployed.provider.takeSnapshot();
    for (const entry of ['viaBump', 'viaThisBump']) {
      await fresh.restore();
      const result = await callFramedEntry({
        provider: deployed.provider, artifact: token, categoryId: deployed.categoryId, functionName: entry,
        args: [], callerUtxo: deployed.callerUtxo, callerLockingBytecode: deployed.callerLock,
        funder: deployed.funder, vm: compositionMachine(),
      });
      expect(result.verdicts.filter((verdict) => !verdict.accepted), entry).toStrictEqual([]);
      expect(result.values, entry).toStrictEqual([1n]);
    }
  });

  it('refuses a key the entry only reads beside its write when the write relinks its node, naming the fact', async () => {
    // `move` writes `to` but reads `from` beside that write. The read's node is declared kept ahead of the batch's
    // groups, but `to` sorts right above `from` and is spliced in beside it, so the insert relinks the node the read
    // spends: one UTXO, two records.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   constructor(address owner) { this.balances[owner] = 1; }'
      + '   function move(address from, address to, uint amount) {'
      + '     this.balances[to] = amount;'
      + '     require(this.balances[from] >= amount);'
      + '   }'
      + ' }';
    const moving = compileStringMulti(source, { composition: 'framed' }).Ledger!;
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
    // The calls broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
    await fundShippedFacets(provider);

    await expect(callFramedEntry({
      provider, artifact: moving, categoryId: deployment.categoryId, functionName: 'move',
      args: [SEED_LOCK, RECIPIENT_LOCK, 5n], callerUtxo, callerLockingBytecode: callerLock,
      funder: signature.unlockP2PKH(), vm: compositionMachine(),
    })).rejects.toThrow(/reads a key at a mapping node it also spends for another key/);
  });

  it('resolves a caller-keyed write the artifact publishes as an expression label', async () => {
    // The Solidity front end publishes a caller's own key as an expression label for some shapes — an
    // internal-call chain that substitutes the caller for a parameter, which the token contract in the harness
    // does. The front end that produces the form is not reproducible from a short source here, so the case takes
    // the published form itself: the same compiled artifact, with the key source rewritten to the label the
    // harness artifact carries, driven through the whole shipped call path.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   constructor(address owner) { this.balances[owner] = 1; }'
      + '   function deposit(uint amount) returns (uint) {'
      + '     this.balances[msg.sender] = this.balances[msg.sender] + amount;'
      + '     return this.balances[msg.sender];'
      + '   }'
      + ' }';
    const artifact = compileStringMulti(source, { composition: 'framed' }).Ledger!;
    const depositAbi = artifact.abi.find((candidate) => candidate.name === 'deposit')!;
    expect(depositAbi.entryAccesses?.[0]?.keySources?.[0]).toStrictEqual({ kind: 'msgSender', senderOp: 'msg.sender' });
    depositAbi.entryAccesses![0]!.keySources = [{ kind: 'expression', expressionLabel: 'nullop:msg.sender' }];

    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    const deployment = await deployStatefulContract(artifact, [SEED_LOCK], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
    });
    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 200_000n };
    await provider.addUtxo(binToHex(callerLock), callerUtxo);
    // The calls broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
    await fundShippedFacets(provider);

    const result = await callFramedEntry({
      provider, artifact, categoryId: deployment.categoryId, functionName: 'deposit',
      args: [5n], callerUtxo, callerLockingBytecode: callerLock,
      funder: signature.unlockP2PKH(), vm: compositionMachine(),
    });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    // The node the write creates carries the caller's own key, which is the label the resolver had to read.
    const created = nodeOutput(result, result.draft.trailingOutputs[0]!.index);
    expect(bytesToHex(decodeEntryCommitment(created).slot)).toBe(bytesToHex(keyToSlotMulti([keyOf(callerLock)])));
    // The caller held nothing, so the entry's own body computed the amount it deposited.
    expect(result.values).toStrictEqual([5n]);
  });

  it('settles a two-target batch beside an event, seeded to the caller by the constructor', async () => {
    // A token's own shape: the constructor seeds `balances[msg.sender]`, and `transfer` debits the caller while
    // crediting an argument key in one batch, then emits. The genesis binds the constructor's frame caller to the
    // deployer's coin, so the seeded node is the caller's and the call reads and rewrites it; the entry's event
    // is declared as a trailing output and its payload is learned from the body's own comparison.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Ledger {'
      + '   uint total;'
      + '   mapping(address => uint) balances;'
      + '   mapping(address => mapping(address => uint)) allowances;'
      + '   event Moved(address indexed who, uint amount);'
      + '   constructor() { this.balances[msg.sender] = 1000; this.total = 1000; }'
      + '   function transfer(address to, uint amount) returns (uint) {'
      + '     this.balances[msg.sender] = this.balances[msg.sender] - amount;'
      + '     this.balances[to] = this.balances[to] + amount;'
      + '     emit Moved(to, amount);'
      + '     return this.balances[to];'
      + '   }'
      + ' }';
    const token = compileStringMulti(source, { composition: 'framed' }).Ledger!;

    // The deployer's own coin funds the genesis and is the frame's caller, exactly as a signer's coin does a call.
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
    await provider.addUtxo(aliceAddress, fundingUtxo);
    const deployment = await deployStatefulContract(token, [], {
      provider, fundingUtxo, funder: signature.unlockP2PKH(), changeAddress: aliceAddress,
    });
    const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 200_000n };
    await provider.addUtxo(binToHex(CALLER_LOCK), callerUtxo);
    // The calls broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
    await fundShippedFacets(provider);

    // The constructor seeded the caller's key, so the caller's write rewrites a held node. The recipient's key is
    // one the list does not hold and the caller's node is the greatest slot below it, so the insert relinks that
    // same node: it is both an updated target and the insert's predecessor, declared once per group that names it.
    const genesis = await readFramedDeployment(provider, deployment.categoryId, token.stateLayout!);
    expect(genesis.nodesByCollection.get('balances') ?? []).toHaveLength(2);
    // The constructor never writes `allowances`, so the genesis mints its empty head: a first insert into that
    // collection later splices beside it.
    expect(genesis.nodesByCollection.get('allowances') ?? []).toHaveLength(1);
    const callerSlot = keyToSlotMulti([keyOf(CALLER_LOCK)]);
    const recipientSlot = keyToSlotMulti([keyOf(RELINKED_LOCK)]);
    expect(bytesToSlotValue(callerSlot) < bytesToSlotValue(recipientSlot)).toBe(true);

    const result = await callFramedEntry({
      provider, artifact: token, categoryId: deployment.categoryId, functionName: 'transfer',
      args: [RELINKED_LOCK, 5n], callerUtxo, callerLockingBytecode: CALLER_LOCK,
      funder: signature.unlockP2PKH(), vm: compositionMachine(),
    });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    // The batch declares the caller's held node alone; the trailing region holds the entry's event first, then the
    // created recipient node.
    const nodeIds = result.draft.layout.participants.filter((placed) => placed.id.startsWith('mapping-node-'));
    expect(nodeIds).toHaveLength(1);
    expect(result.draft.trailingOutputs).toHaveLength(2);

    // The held node is rewritten where it sits: its own slot, the successor the insert relinked it to, and the
    // balance the body debited.
    const held = decodeEntryCommitment(nodeOutput(result, nodeIds[0]!.index));
    expect(bytesToHex(held.slot)).toBe(bytesToHex(callerSlot));
    expect(bytesToHex(held.nextKey)).toBe(bytesToHex(recipientSlot));
    expect(bytesToHex(held.value)).toBe(bytesToHex(valueOf(995n)));

    // The created node carries the recipient's slot and the balance the body credited, and takes the successor the
    // rewritten node used to point at.
    const created = decodeEntryCommitment(nodeOutput(result, result.draft.trailingOutputs[1]!.index));
    expect(bytesToHex(created.slot)).toBe(bytesToHex(recipientSlot));
    expect(bytesToHex(created.nextKey)).toBe('00'.repeat(32));
    expect(bytesToHex(created.value)).toBe(bytesToHex(valueOf(5n)));

    // `total` is the contract's one data record, which the entry never writes: its segment close requires it kept,
    // so the run learns it kept and the transaction writes back what it spent, the plain encoded 1000.
    const total = result.sourceOutputs.findIndex((output) => output.token?.nft !== undefined
      && binToHex(output.token.nft.commitment) === '02e803');
    expect(total).toBeGreaterThanOrEqual(0);
    expect(binToHex(result.transaction.outputs[total]!.token!.nft!.commitment)).toBe('02e803');

    // The entry returned the balance it credited.
    expect(result.values).toStrictEqual([5n]);
    expect(result.broadcast).toBeDefined();
  });
});
