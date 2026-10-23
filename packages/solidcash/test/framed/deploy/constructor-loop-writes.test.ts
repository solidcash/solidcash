import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { encodeFunctionArgument, type ConstructorArgument, type FunctionArgument } from '../../../src/Argument.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment, readFramedState } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { orderLoopKeyArgs } from '../../../src/framed/call/entry-records.js';
import { deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import { bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { aliceAddress, alicePkh, alicePriv, alicePub, bobPkh, bobPriv } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A constructor that writes a mapping in a loop, deployed through the shipped framed deployment.
 *
 * Every key and value such a constructor writes is a function of its arguments, so the genesis derives the entries
 * by running the constructor frame: a run-time loop's turns are planned from the arguments as a call's are, each
 * created node's value is learned from the body's own close, and a key the body writes only on a path the
 * deployment does not take holds the value it had before any write. The run of inserts walks its keys in slot
 * order, and a constructor's own array is not reordered for it, so an array out of that order is refused by name
 * and the deployer orders it with the shipped helper. A key two turns repeat is written in place, so the body
 * decides what the repeat does: the value it stores or the sum it adds, or a `require` that refuses it. Each replica
 * here is deployed, its minted nodes are read back from the chain, and an entry that reads them is called through
 * the shipped call path beside a control the body's own `require` refuses. The replicas: a committee's member set,
 * an allowlist a flag array selects, opening balances from two arrays, counts keys accumulate over a loop, a token
 * that mints to its deployer and records it as an admin, which writes two collections, and a multisig wallet whose
 * owner loop requires each owner not yet an owner. A member set and the wallet are then deployed behind a generated
 * proxy, whose implementation's own genesis runs the constructor's loop.
 */

const CALLER = encodeLockingBytecodeP2pkh(alicePkh);
const OTHER = encodeLockingBytecodeP2pkh(bobPkh);
/** A holder whose hash bytes differ from every fixture key's. */
const lockOf = (seed: number): Uint8Array => encodeLockingBytecodeP2pkh(
  Uint8Array.from({ length: 20 }, (_unused, at) => (seed * 17 + at * 3) & 0xff),
);
const PRAGMA = 'pragma solidcash ^0.14.0;';
/** The refusal a body's own failed `require` meets. */
const REQUIRE_FAILED = /Program failed an OP_VERIFY operation/;

const COMMITTEE = compileStringMulti(`${PRAGMA}`
  + ' contract Committee {'
  + '   uint public threshold;'
  + '   mapping(address => bool) members;'
  + '   constructor(address[] memory owners, uint required) {'
  + '     for (uint i = 0; i < owners.length; i++) { this.members[owners[i]] = true; }'
  + '     this.threshold = required;'
  + '   }'
  + '   function confirm(address who) { require(this.members[who]); }'
  + '   function ping() { require(true); }'
  + ' }', { composition: 'framed' }).Committee!;

const ALLOWLIST = compileStringMulti(`${PRAGMA}`
  + ' contract Allowlist {'
  + '   mapping(address => bool) allowed;'
  + '   constructor(address[] memory accounts, uint[] memory flags) {'
  + '     for (uint i = 0; i < accounts.length; i++) { if (flags[i] == 1) { this.allowed[accounts[i]] = true; } }'
  + '   }'
  + '   function enter(address who) { require(this.allowed[who]); }'
  + '   function ping() { require(true); }'
  + ' }', { composition: 'framed' }).Allowlist!;

const LEDGER = compileStringMulti(`${PRAGMA}`
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   constructor(address[] memory holders, uint[] memory amounts) {'
  + '     require(holders.length == amounts.length);'
  + '     for (uint i = 0; i < holders.length; i++) { this.balances[holders[i]] = amounts[i]; }'
  + '   }'
  + '   function transfer(address to, uint amount) {'
  + '     this.balances[msg.sender] -= amount; this.balances[to] += amount;'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }', { composition: 'framed' }).Ledger!;

const TALLY = compileStringMulti(`${PRAGMA}`
  + ' contract Tally {'
  + '   mapping(uint => uint) counts;'
  + '   constructor(uint k, uint n) { for (uint i = 0; i < n; i++) { this.counts[k] += 1; } }'
  + '   function check(uint k, uint expected) { require(this.counts[k] == expected); }'
  + '   function ping() { require(true); }'
  + ' }', { composition: 'framed' }).Tally!;

const TALLIES = compileStringMulti(`${PRAGMA}`
  + ' contract Tallies {'
  + '   mapping(uint => uint) counts;'
  + '   constructor(uint[] memory keys) { for (uint i = 0; i < keys.length; i++) { this.counts[keys[i]] += 1; } }'
  + '   function check(uint k, uint expected) { require(this.counts[k] == expected); }'
  + '   function ping() { require(true); }'
  + ' }', { composition: 'framed' }).Tallies!;

/** The multisig owner loop: each turn requires its owner set and not yet an owner, then makes it one. */
const OWNER_LOOP = ''
  + '     for (uint i = 0; i < owners.length; i++) {'
  + '       address o = owners[i];'
  + '       require(o != address(0) && !this.isOwner[o], "owner not unique");'
  + '       this.isOwner[o] = true;'
  + '     }'
  + '     require(quorum > 0 && quorum <= owners.length, "bad quorum");'
  + '     this.required = quorum;';
const WALLET_ENTRIES = ''
  + '   function confirm() { require(this.isOwner[msg.sender], "not an owner"); this.confirmations += 1; }';

const WALLET = compileStringMulti(`${PRAGMA}`
  + ' contract Wallet {'
  + '   uint public required;'
  + '   uint public confirmations;'
  + '   mapping(address => bool) isOwner;'
  + `   constructor(address[] memory owners, uint quorum) { ${OWNER_LOOP} }`
  + WALLET_ENTRIES
  + '   function ping() { require(true); }'
  + ' }', { composition: 'framed' }).Wallet!;

const TOKEN = compileStringMulti(`${PRAGMA}`
  + ' contract Token {'
  + '   uint public supply;'
  + '   mapping(address => uint) balances;'
  + '   mapping(address => bool) admins;'
  + '   constructor(uint initial) {'
  + '     this.supply = initial; this.balances[msg.sender] = initial; this.admins[msg.sender] = true;'
  + '   }'
  + '   function mint(address to, uint amount) {'
  + '     require(this.admins[msg.sender]); this.supply = this.supply + amount; this.balances[to] += amount;'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }', { composition: 'framed' }).Token!;

/** A 32-byte txid whose bytes are distinct, taken from a counter. */
let coins = 0;
function nextTxid(): string {
  coins += 1;
  return binToHex(Uint8Array.from({ length: 32 }, (_unused, at) => (coins * 29 + at * 11 + 3) & 0xff));
}

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly snapshot: SnapshotRestorer;
}

/** Deploys `artifact` from the caller's own coin, so the constructor's `msg.sender` is the caller, and returns it. */
async function deploy(
  provider: MockNetworkProvider, artifact: Artifact, args: readonly ConstructorArgument[],
): Promise<string> {
  const fundingUtxo = { txid: nextTxid(), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(binToHex(CALLER), fundingUtxo);
  const deployed = await deployStatefulContract(artifact, [...args], {
    provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
  });
  return deployed.categoryId;
}

/** Deploys a contract once through the shipped deployment; each case rewinds the chain to it. */
function deployment(artifact: Artifact, args: readonly ConstructorArgument[]): () => Promise<Deployed> {
  let run: Promise<Deployed> | undefined;
  return async (): Promise<Deployed> => {
    run ??= (async (): Promise<Deployed> => {
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const categoryId = await deploy(provider, artifact, args);
      await fundShippedFacets(provider);
      return { provider, artifact, categoryId, snapshot: await provider.takeSnapshot() };
    })();
    const deployed = await run;
    await deployed.snapshot.restore();
    return deployed;
  };
}

/** Calls an entry through the shipped call path from a fresh coin of `caller`, and reports the machine's verdict. */
async function settles(
  deployed: Deployed, functionName: string, args: readonly FunctionArgument[], caller = CALLER, key = alicePriv,
): Promise<true | string> {
  const callerUtxo = { txid: nextTxid(), vout: 0, satoshis: 200_000n };
  await deployed.provider.addUtxo(binToHex(caller), callerUtxo);
  const result = await callFramedEntry({
    provider: deployed.provider, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    args: [...args], callerUtxo, callerLockingBytecode: caller,
    funder: new SignatureTemplate(key).unlockP2PKH(), vm: compositionMachine(),
  });
  if (result.accepted && result.broadcast !== undefined) return true;
  return result.verdicts.filter((verdict) => !verdict.accepted).map((verdict) => String(verdict.objection)).join('; ');
}

/** The value each node of a collection holds on chain, keyed by its slot, the head left out. */
async function nodeValues(
  provider: MockNetworkProvider, artifact: Artifact, categoryId: string, collection: string,
): Promise<Map<string, string>> {
  const live = await readFramedDeployment(provider, categoryId, artifact.stateLayout!);
  return new Map((live.nodesByCollection.get(collection) ?? []).map((utxo) => {
    const decoded = decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment));
    return [bytesToHex(decoded.slot), bytesToHex(decoded.value)] as const;
  }).filter(([slot]) => !/^0+$/.test(slot)));
}

const slotOf = (key: Uint8Array | bigint, type: 'address' | 'uint256'): string =>
  bytesToHex(keyToSlotMulti([encodeFunctionArgument(key, type) as Uint8Array]));
const uintValue = (amount: bigint): string => bytesToHex(encodeFunctionArgument(amount, 'uint256') as Uint8Array);
const TRUE = '01';
/** The keys in the slot order a run-time loop's chain of inserts walks. */
const ascending = (keys: readonly Uint8Array[]): Uint8Array[] => [...keys].sort((left, right) => {
  const order = (key: Uint8Array): bigint => bytesToSlotValue(hexToBin(slotOf(key, 'address')));
  return order(left) < order(right) ? -1 : 1;
});

const MEMBERS = [lockOf(1), CALLER, lockOf(2)];
/** The members in the slot order the run of inserts walks, which the deployer asks the shipped helper for. */
const ORDERED = orderLoopKeyArgs({
  artifact: COMMITTEE, functionName: '__construct', args: [MEMBERS, 2n], callerLockingBytecode: CALLER,
}) as ConstructorArgument[];
const committee = deployment(COMMITTEE, ORDERED);

describe('a constructor that writes a member set in a loop', () => {
  it('refuses by name members out of slot order, naming the order the deployer can pass instead', async () => {
    expect(MEMBERS).not.toStrictEqual(ascending(MEMBERS));
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await expect(deploy(provider, COMMITTEE, [MEMBERS, 2n])).rejects.toThrow(new RegExp(
      'writes mapping "members" at element [0-9]+ of "owners" under a key below the one before it, .* pass "owners" '
      + 'as its elements \\[[0-9, ]+\\], the order `orderLoopKeyArgs` gives',
    ));
  });

  it('mints one node per member of the ordered array, and the state beside them', async () => {
    expect(ORDERED[0]).toStrictEqual(ascending(MEMBERS));
    const deployed = await committee();
    const nodes = await nodeValues(deployed.provider, COMMITTEE, deployed.categoryId, 'members');
    expect(nodes).toStrictEqual(new Map(MEMBERS.map((member) => [slotOf(member, 'address'), TRUE])));
    const state = await readFramedState(deployed.provider, deployed.categoryId, COMMITTEE.stateLayout!);
    expect(state.byNft[0]).toMatchObject({ threshold: 2n });
  });

  it('serves an entry that reads a member, and refuses one that is not', async () => {
    const deployed = await committee();
    expect(await settles(deployed, 'confirm', [lockOf(2)])).toBe(true);
    expect(await settles(deployed, 'confirm', [OTHER])).toMatch(REQUIRE_FAILED);
  });

  it("mints one node for a member given twice, as the EVM's loop leaves it", async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const categoryId = await deploy(provider, COMMITTEE, [[lockOf(1), lockOf(1)], 1n]);
    expect(await nodeValues(provider, COMMITTEE, categoryId, 'members'))
      .toStrictEqual(new Map([[slotOf(lockOf(1), 'address'), TRUE]]));
  });
});

const SKIPPED = lockOf(4);
/** The selected accounts in slot order, the one the flags skip between them, where its key does not matter. */
const ACCOUNTS = ((selected: Uint8Array[]): Uint8Array[] => [selected[0]!, SKIPPED, selected[1]!])(
  ascending([lockOf(3), CALLER]),
);
const allowlist = deployment(ALLOWLIST, [ACCOUNTS, ACCOUNTS.map((account) => (account === SKIPPED ? 0n : 1n))]);

describe('a constructor whose loop writes only where a flag array selects', () => {
  it('mints the selected accounts alone', async () => {
    const deployed = await allowlist();
    expect(await nodeValues(deployed.provider, ALLOWLIST, deployed.categoryId, 'allowed'))
      .toStrictEqual(new Map([[slotOf(lockOf(3), 'address'), TRUE], [slotOf(CALLER, 'address'), TRUE]]));
  });

  it('serves an entry that reads a selected account, and refuses the account its flag skipped', async () => {
    const deployed = await allowlist();
    expect(await settles(deployed, 'enter', [CALLER])).toBe(true);
    expect(await settles(deployed, 'enter', [SKIPPED])).toMatch(REQUIRE_FAILED);
  });
});

const HOLDERS = ascending([CALLER, OTHER, lockOf(5)]);
const AMOUNTS = HOLDERS.map((holder) => (holder === CALLER ? 100n : holder === OTHER ? 7n : 30n));
const ledger = deployment(LEDGER, [HOLDERS, AMOUNTS]);

describe('a constructor that opens balances from two arrays', () => {
  it('mints each holder with the amount at its own index', async () => {
    const deployed = await ledger();
    expect(await nodeValues(deployed.provider, LEDGER, deployed.categoryId, 'balances')).toStrictEqual(new Map(
      HOLDERS.map((holder, at) => [slotOf(holder, 'address'), uintValue(AMOUNTS[at]!)]),
    ));
  });

  it('serves a transfer that reads the minted balances and settles the ones the EVM leaves', async () => {
    const deployed = await ledger();
    expect(await settles(deployed, 'transfer', [OTHER, 40n])).toBe(true);
    const nodes = await nodeValues(deployed.provider, LEDGER, deployed.categoryId, 'balances');
    expect(nodes.get(slotOf(CALLER, 'address'))).toBe(uintValue(60n));
    expect(nodes.get(slotOf(OTHER, 'address'))).toBe(uintValue(47n));
    expect(nodes.get(slotOf(lockOf(5), 'address'))).toBe(uintValue(30n));
  });

  it('refuses by name holders the chain cannot walk in the order given, the amounts being theirs', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await expect(deploy(provider, LEDGER, [[...HOLDERS].reverse(), [...AMOUNTS].reverse()])).rejects.toThrow(
      'under a key that does not sit above the turn before it, and a loop whose value comes per key keeps the '
      + 'caller\'s order',
    );
  });
});

const tally = deployment(TALLY, [7n, 3n]);
/** Two keys in the slot order the run of inserts walks, the first given three times. */
const uintOrder = (key: bigint): bigint => bytesToSlotValue(hexToBin(slotOf(key, 'uint256')));
const [LOW_KEY, HIGH_KEY] = [3n, 5n].sort((left, right) => (uintOrder(left) < uintOrder(right) ? -1 : 1)) as
  [bigint, bigint];
const tallies = deployment(TALLIES, [[LOW_KEY, LOW_KEY, LOW_KEY, HIGH_KEY]]);

describe('a constructor that accumulates one key over a loop', () => {
  it('mints the count every turn added, which no one-turn recipe states', async () => {
    const deployed = await tally();
    expect(await nodeValues(deployed.provider, TALLY, deployed.categoryId, 'counts'))
      .toStrictEqual(new Map([[slotOf(7n, 'uint256'), uintValue(3n)]]));
    expect(await settles(deployed, 'check', [7n, 3n])).toBe(true);
    expect(await settles(deployed, 'check', [7n, 1n])).toMatch(REQUIRE_FAILED);
  });

  it('mints the unwritten count when the loop runs no turn', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const categoryId = await deploy(provider, TALLY, [7n, 0n]);
    expect(await nodeValues(provider, TALLY, categoryId, 'counts'))
      .toStrictEqual(new Map([[slotOf(7n, 'uint256'), uintValue(0n)]]));
  });

  it('mints the sum each key of an array accumulated, a repeated key adding to its one node', async () => {
    const deployed = await tallies();
    expect(await nodeValues(deployed.provider, TALLIES, deployed.categoryId, 'counts')).toStrictEqual(new Map([
      [slotOf(LOW_KEY, 'uint256'), uintValue(3n)], [slotOf(HIGH_KEY, 'uint256'), uintValue(1n)],
    ]));
    expect(await settles(deployed, 'check', [LOW_KEY, 3n])).toBe(true);
    expect(await settles(deployed, 'check', [LOW_KEY, 1n])).toMatch(REQUIRE_FAILED);
  });
});

const token = deployment(TOKEN, [1_000n]);

describe('a constructor that mints to its deployer and records it as an admin, writing two collections', () => {
  it('mints one batch per collection, each head relinked to its own node', async () => {
    const deployed = await token();
    expect(await nodeValues(deployed.provider, TOKEN, deployed.categoryId, 'balances'))
      .toStrictEqual(new Map([[slotOf(CALLER, 'address'), uintValue(1_000n)]]));
    expect(await nodeValues(deployed.provider, TOKEN, deployed.categoryId, 'admins'))
      .toStrictEqual(new Map([[slotOf(CALLER, 'address'), TRUE]]));
  });

  it('serves a mint by the recorded admin, and refuses one by another caller', async () => {
    const deployed = await token();
    expect(await settles(deployed, 'mint', [OTHER, 5n])).toBe(true);
    const balances = await nodeValues(deployed.provider, TOKEN, deployed.categoryId, 'balances');
    expect(balances.get(slotOf(OTHER, 'address'))).toBe(uintValue(5n));
    expect(await settles(deployed, 'mint', [OTHER, 5n], OTHER, bobPriv)).toMatch(REQUIRE_FAILED);
  });
});

const OWNER_SET = ascending([lockOf(10), CALLER, lockOf(11)]);
const wallet = deployment(WALLET, [OWNER_SET, 2n]);
/** The refusal a constructor's own `require` names, read from the artifact. */
const NOT_UNIQUE = /the constructor of "Wallet" reverts at line [0-9]+: owner not unique/;

describe('a multisig wallet whose owner loop requires each owner not yet an owner', () => {
  it('mints one node per owner, and the quorum beside them', async () => {
    const deployed = await wallet();
    expect(await nodeValues(deployed.provider, WALLET, deployed.categoryId, 'isOwner'))
      .toStrictEqual(new Map(OWNER_SET.map((owner) => [slotOf(owner, 'address'), TRUE])));
    const state = await readFramedState(deployed.provider, deployed.categoryId, WALLET.stateLayout!);
    expect(state.byNft[0]).toMatchObject({ required: 2n, confirmations: 0n });
  });

  it('serves the entry an owner calls, and refuses a caller that is not one', async () => {
    const deployed = await wallet();
    expect(await settles(deployed, 'confirm', [])).toBe(true);
    expect(await settles(deployed, 'confirm', [], OTHER, bobPriv)).toMatch(REQUIRE_FAILED);
  });

  it('refuses an owner given twice by the constructor\'s own reason, as the EVM reverts', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const [first, second] = ascending([lockOf(10), lockOf(11)]);
    await expect(deploy(provider, WALLET, [[first!, first!, second!], 2n])).rejects.toThrow(NOT_UNIQUE);
    await expect(deploy(provider, WALLET, [[first!, second!, second!], 2n])).rejects.toThrow(NOT_UNIQUE);
  });
});

/**
 * A member set behind a generated proxy. The implementation's own genesis runs its constructor's loop, as a plain
 * deployment's does, over the implementation's own records; the proxy's records are the ones its initializer writes
 * through the hop, as the EVM's proxy shape has it, and a call through the proxy reads those.
 */
const PROXIED = compileStringMulti(`${PRAGMA}`
  + ' contract Impl {'
  + '   address public implementation;'
  + '   mapping(address => bool) members;'
  + '   constructor(address[] memory owners) {'
  + '     for (uint i = 0; i < owners.length; i++) { this.members[owners[i]] = true; }'
  + '   }'
  + '   function initialize(address[] owners) {'
  + '     for (uint i = 0; i < owners.length; i++) { this.members[owners[i]] = true; }'
  + '   }'
  + '   function confirm(address who) { require(this.members[who]); }'
  + ' }', { composition: 'framed' }).Impl!;

describe('a member set behind a generated proxy', () => {
  it('runs the constructor loop at the implementation genesis and the initializer loop through the proxy', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const implFunding = { txid: nextTxid(), vout: 0, satoshis: 500_000n };
    const proxyFunding = { txid: nextTxid(), vout: 0, satoshis: 500_000n };
    const hopUtxo = { txid: nextTxid(), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(funder.address, implFunding);
    await provider.addUtxo(funder.address, proxyFunding);
    await provider.addUtxo(binToHex(CALLER), hopUtxo);
    await fundShippedFacets(provider);
    const half = { funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address };
    const genesisMembers = ascending([lockOf(6), lockOf(7)]);
    const proxyMembers = [lockOf(8), CALLER, lockOf(9)];
    const deployed = await deployFramedProxy({
      provider,
      implementationArtifact: PROXIED,
      implementationArgs: [genesisMembers],
      implementationDeploy: { fundingUtxo: implFunding, ...half },
      proxyDeploy: { fundingUtxo: proxyFunding, ...half },
      initialize: { functionName: 'initialize', args: [proxyMembers] },
      callerLockingBytecode: CALLER,
      callerFunding: { utxo: hopUtxo, funder: signature.unlockP2PKH() },
      vm: compositionMachine(),
    });
    expect(deployed.initialize.accepted).toBe(true);
    expect(await nodeValues(provider, PROXIED, deployed.implementation.categoryId, 'members'))
      .toStrictEqual(new Map(genesisMembers.map((member) => [slotOf(member, 'address'), TRUE])));
    expect(await nodeValues(provider, PROXIED, deployed.proxy.categoryId, 'members'))
      .toStrictEqual(new Map(proxyMembers.map((member) => [slotOf(member, 'address'), TRUE])));

    const confirm = async (who: Uint8Array): Promise<true | string> => {
      const callerUtxo = { txid: nextTxid(), vout: 0, satoshis: 200_000n };
      await provider.addUtxo(binToHex(CALLER), callerUtxo);
      try {
        const result = await callFramedProxyEntry({
          provider, implementationArtifact: PROXIED, proxyCategoryId: deployed.proxy.categoryId,
          implementationCategoryId: deployed.implementation.categoryId, functionName: 'confirm', args: [who],
          callerUtxo, callerLockingBytecode: CALLER, funder: signature.unlockP2PKH(), vm: compositionMachine(),
        });
        return result.accepted || 'not accepted';
      } catch (error) {
        return String(error);
      }
    };
    expect(await confirm(lockOf(9))).toBe(true);
    // A member of the implementation's own genesis is not one of the proxy's.
    expect(await confirm(lockOf(6))).toMatch(REQUIRE_FAILED);
  }, 600_000);
});

/**
 * The wallet behind a generated proxy: its constructor's owner loop runs at the implementation's genesis, and its
 * initializer's through the proxy. The initializer records each owner without reading the entry first: a call's turn
 * that reads the entry it then writes is not served on the call path yet.
 */
const PROXIED_WALLET = compileStringMulti(`${PRAGMA}`
  + ' contract Wallet {'
  + '   address public implementation;'
  + '   uint public required;'
  + '   uint public confirmations;'
  + '   mapping(address => bool) isOwner;'
  + `   constructor(address[] memory owners, uint quorum) { ${OWNER_LOOP} }`
  + '   function initialize(address[] owners, uint quorum) {'
  + '     for (uint i = 0; i < owners.length; i++) { require(owners[i] != address(0)); this.isOwner[owners[i]] = true; }'
  + '     this.required = quorum;'
  + '   }'
  + WALLET_ENTRIES
  + ' }', { composition: 'framed' }).Wallet!;

/** Deploys the proxied wallet with its genesis owners and the owners its initializer records. */
async function proxiedWallet(
  genesisOwners: readonly Uint8Array[], proxyOwners: readonly Uint8Array[],
): Promise<{ provider: MockNetworkProvider; deployed: Awaited<ReturnType<typeof deployFramedProxy>> }> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const implFunding = { txid: nextTxid(), vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: nextTxid(), vout: 0, satoshis: 500_000n };
  const hopUtxo = { txid: nextTxid(), vout: 0, satoshis: 200_000n };
  await provider.addUtxo(funder.address, implFunding);
  await provider.addUtxo(funder.address, proxyFunding);
  await provider.addUtxo(binToHex(CALLER), hopUtxo);
  await fundShippedFacets(provider);
  const half = { funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address };
  const deployed = await deployFramedProxy({
    provider,
    implementationArtifact: PROXIED_WALLET,
    implementationArgs: [[...genesisOwners], 1n],
    implementationDeploy: { fundingUtxo: implFunding, ...half },
    proxyDeploy: { fundingUtxo: proxyFunding, ...half },
    initialize: { functionName: 'initialize', args: [[...proxyOwners], 2n] },
    callerLockingBytecode: CALLER,
    callerFunding: { utxo: hopUtxo, funder: signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  return { provider, deployed };
}

describe('a multisig wallet behind a generated proxy', () => {
  it('runs the owner loop at the implementation genesis and the initializer\'s through the proxy', async () => {
    const genesisOwners = ascending([lockOf(12), lockOf(13)]);
    const proxyOwners = [lockOf(14), CALLER, lockOf(15)];
    const { provider, deployed } = await proxiedWallet(genesisOwners, proxyOwners);
    expect(deployed.initialize.accepted).toBe(true);
    expect(await nodeValues(provider, PROXIED_WALLET, deployed.implementation.categoryId, 'isOwner'))
      .toStrictEqual(new Map(genesisOwners.map((owner) => [slotOf(owner, 'address'), TRUE])));
    expect(await nodeValues(provider, PROXIED_WALLET, deployed.proxy.categoryId, 'isOwner'))
      .toStrictEqual(new Map(proxyOwners.map((owner) => [slotOf(owner, 'address'), TRUE])));

    const confirm = async (caller: Uint8Array, key: Uint8Array): Promise<true | string> => {
      const callerUtxo = { txid: nextTxid(), vout: 0, satoshis: 200_000n };
      await provider.addUtxo(binToHex(caller), callerUtxo);
      try {
        const result = await callFramedProxyEntry({
          provider, implementationArtifact: PROXIED_WALLET, proxyCategoryId: deployed.proxy.categoryId,
          implementationCategoryId: deployed.implementation.categoryId, functionName: 'confirm', args: [],
          callerUtxo, callerLockingBytecode: caller, funder: new SignatureTemplate(key).unlockP2PKH(),
          vm: compositionMachine(),
        });
        return result.accepted || 'not accepted';
      } catch (error) {
        return String(error);
      }
    };
    expect(await confirm(CALLER, alicePriv)).toBe(true);
    expect(await confirm(OTHER, bobPriv)).toMatch(REQUIRE_FAILED);
  }, 600_000);

  it('refuses an owner the implementation genesis is given twice by the constructor\'s own reason', async () => {
    const [first, second] = ascending([lockOf(12), lockOf(13)]);
    await expect(proxiedWallet([first!, first!, second!], [CALLER])).rejects.toThrow(NOT_UNIQUE);
  }, 600_000);
});
