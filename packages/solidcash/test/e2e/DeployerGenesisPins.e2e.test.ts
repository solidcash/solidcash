/**
 * Deploy<C>'s genesis pins against a hostile builder: A4.3 steps 3 and 4, A4.4's rows, and A5's `this.category`.
 *
 * Each case starts from a creation the SDK built and broadcast, changes one thing, signs the wallet's P2PKH inputs
 * again (as a builder signs its own transaction), and asks stock libauth's standard BCH 2026 VM. The honest creation
 * passes, each change is refused, and a control that moves one variable the other way passes, so a refusal is the
 * rule's and not a side effect of the edit.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, decodeTransaction,
  encodeAuthenticationInstruction, encodeDataPush, encodeLockingBytecodeP2pkh, flattenBinArray, hexToBin,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import type { DeployerAbi } from '@solidcash/utils';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { ContractFactory, StatefulContract, buildDeployerPreps } from '../../src/stateful/index.js';
import { buildDeployerPrep } from '../../src/stateful/deployer.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import type { Utxo } from '../../src/interfaces.js';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv, bobPkh, bobPriv } from '../fixture/vars.js';

/** A BchPool-shaped child: contract arguments, one data record, `pragma satoshicontainer single`, and its creator. */
const POOLS = `
pragma solidcash ^0.52.0;
pragma satoshicontainer single;
contract Pool(uint8 exponent, bytes verifierLock, bytes workerLock) {
    bytes32 recentRoots;
    bytes32 me;
    uint32 live;
    constructor() {
        require(exponent >= 6 && exponent <= 10, "exponent");
        this.recentRoots = sha256(verifierLock);
        this.me = this.category;
    }
    function deposit(bytes32 commitment) public payable {
        require(tx.inputs[1].lockingBytecode == workerLock);
        this.recentRoots = commitment;
        this.live = this.live + 1;
    }
}
contract PoolDeployer {
    event PoolCreated(bytes32 indexed category, uint8 exponent);
    function create(uint8 exponent, bytes verifierLock, bytes workerLock) public {
        Pool pool = new Pool{args: (exponent, verifierLock, workerLock)}();
        emit PoolCreated(pool.category, exponent);
    }
}
`;

/**
 * A TokenPool-shaped child: both single-container pragmas, a token container named by a contract argument, and a
 * payable `deposit` that uses the satoshi container, as TokenPool's does (so C keeps it single under A8's stricter
 * reading too).
 */
const TOKEN_POOL = `
pragma solidcash ^0.52.0;
pragma satoshicontainer single;
pragma tokencontainer single;
contract TokenPool(uint8 exponent, bytes32 asset, bytes workerLock) {
    bytes32 me;
    uint32 live;
    constructor() {
        require(asset != this.category, "asset-is-master");
        require(exponent >= 6 && exponent <= 10, "exponent");
        this.me = this.category;
    }
    function deposit() public payable {
        require(tx.inputs[1].lockingBytecode == workerLock);
        this.live = this.live + 1;
    }
    function withdraw(address recipient) public {
        require(tx.inputs[1].lockingBytecode == workerLock);
        this.tokens[asset].transfer(recipient, 1);
        this.live = this.live - 1;
    }
}
`;

/** A constructor that compares this.category with an argument: only the byte order decides whether it passes. */
const SELF = `
pragma solidcash ^0.52.0;
contract Self {
    int n;
    constructor(bytes32 c) {
        require(this.category == c, "category");
        this.n = 1;
    }
}
`;

/** The TokenPool-shaped child's creator, shaped like bch-next's TokenPoolDeployer (A14 item 11 through a creator). */
const TOKEN_POOLS = `${TOKEN_POOL}
contract TokenPoolDeployer {
    event PoolCreated(bytes32 indexed category, bytes32 indexed asset, uint8 exponent);
    function create(uint8 exponent, bytes32 asset, bytes workerLock) public {
        TokenPool pool = new TokenPool{args: (exponent, asset, workerLock)}();
        emit PoolCreated(pool.category, asset, exponent);
    }
}
`;

/** A payable constructor: its satoshi container row is optional and holds the deploy value. */
const PAYABLE = `
pragma solidcash ^0.52.0;
contract Pay {
    int n;
    constructor() payable { this.n = msg.value; }
    function pay(address payable to) public { to.transfer(1000); }
}
`;

/** A C whose master can retire: its container locks carry the destroy arm, an option the deployer must take from C. */
const RETIRING = `
pragma solidcash ^0.52.0;
contract Vault {
    int x;
    constructor() payable { this.x = 1; }
    function bye() selfdestruct { }
}
`;

const ASSET = 'a1b2c3d4e5f60718293a4b5c6d7e8f900123456789abcdef0011223344556677';
const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const bobLock = encodeLockingBytecodeP2pkh(bobPkh);
const signers = new Map([
  [binToHex(aliceLock), new SignatureTemplate(alicePriv)], [binToHex(bobLock), new SignatureTemplate(bobPriv)],
]);
const lockFor = (fill: number): Uint8Array => Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(fill), 0x87]);

type Spend = { transaction: any; sourceOutputs: any[] };

/** Records every broadcast with the coins it spends, read from the ledger while they are still live. */
function captureBroadcasts(provider: MockNetworkProvider): Spend[] {
  const captured: Spend[] = [];
  const inner = provider.sendRawTransaction.bind(provider);
  provider.sendRawTransaction = async (hex: string) => {
    const transaction = decodeTransaction(hexToBin(hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('a spent coin is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    const txid = await inner(hex);
    captured.push({ transaction, sourceOutputs });
    return txid;
  };
  return captured;
}

const copy = (spend: Spend): Spend => structuredClone(spend);

/** Signs every input the test's two wallets hold again, and asks the standard VM. */
function verify(spend: Spend): true | string {
  spend.transaction.inputs.forEach((_input: unknown, inputIndex: number) => {
    const signer = signers.get(binToHex(spend.sourceOutputs[inputIndex].lockingBytecode));
    if (signer === undefined) return;
    spend.transaction.inputs[inputIndex].unlockingBytecode = signer.unlockP2PKH().generateUnlockingBytecode({
      transaction: spend.transaction, sourceOutputs: spend.sourceOutputs, inputIndex,
    });
  });
  return vm.verify(spend as never) as true | string;
}

/**
 * The same `create` unlocking with one argument replaced: pushes are the selector, the arguments last first, then the
 * redeem.
 */
function withCreateArgument(unlocking: Uint8Array, deployer: DeployerAbi, name: string, value: Uint8Array): Uint8Array {
  const inputs = deployer.abi.find((entry) => entry.name === 'create')!.inputs;
  const position = 1 + (inputs.length - 1 - inputs.findIndex((input) => input.name === name));
  return flattenBinArray(decodeAuthenticationInstructions(unlocking).map((instruction, index) => (
    index === position ? encodeDataPush(value) : encodeAuthenticationInstruction(instruction as never))));
}

/** Where a creation's pieces sit: the deployer input, the author input, and the rows of the genesis range. */
function layoutOf(
  spend: Spend, deployer: DeployerAbi,
): { deployerInput: number; authorInput: number; x: Uint8Array; outbase: number } {
  const deployerInput = spend.sourceOutputs.findIndex(
    (output) => binToHex(output.lockingBytecode) === deployer.lockingBytecode,
  );
  const x = spend.transaction.inputs[deployerInput].outpointTransactionHash as Uint8Array;
  const outbase = spend.transaction.outputs.findIndex((output: any) => output.token?.nft?.capability === 'minting'
    && binToHex(output.token.category) === binToHex(x));
  const authorInput = spend.transaction.inputs.findIndex((input: any) => input.outpointIndex === 1
    && binToHex(input.outpointTransactionHash) === binToHex(x));
  return { deployerInput, authorInput, x, outbase };
}

const coin = (txid: string, vout: number): {
  outpointTransactionHash: Uint8Array; outpointIndex: number; sequenceNumber: number; unlockingBytecode: Uint8Array;
} => ({
  outpointTransactionHash: hexToBin(txid), outpointIndex: vout, sequenceNumber: 0xffffffff,
  unlockingBytecode: new Uint8Array(),
});

describe('Deploy<C> genesis pins, through a creator (stock libauth, standard)', () => {
  let honest: Spend;
  let deployer: DeployerAbi;
  let layout: ReturnType<typeof layoutOf>;
  let prepChange: Utxo;

  beforeAll(async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const captured = captureBroadcasts(provider);
    const artifacts = compileStringMulti(POOLS, { allowUnsafeOperations: true });
    deployer = (artifacts.PoolDeployer as any).childDeployers.Pool;
    const alice = new Signer(alicePriv, provider);
    await provider.seedUtxo(alice.getAddress(), { txid: 'a1'.repeat(32), vout: 0, satoshis: 200_000n });
    await provider.seedUtxo(alice.getAddress(), { txid: 'b2'.repeat(32), vout: 0, satoshis: 100_000n });
    const factory: any = await new ContractFactory(artifacts.PoolDeployer as never, alice).deploy();
    factory.registerChild(artifacts.Pool);
    const naming = (await alice.getUtxos()).find((utxo: Utxo) => utxo.txid === 'b2'.repeat(32));
    const { preps } = await buildDeployerPreps({
      provider,
      children: [{ contractName: 'Pool', deployer, authorValue: 20_000n }],
      fundingUtxos: [naming!],
      authorSigner: alice.unlockP2PKH(),
      authorLockingBytecode: aliceLock,
      changeLockingBytecode: aliceLock,
    });
    prepChange = preps[0].changeCoin!;
    const result = await factory.create(8n, lockFor(0x5a), lockFor(0x6b)).deploy({
      deployerPreps: preps, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
    });
    expect(result.childCategoryId).toBe(preps[0].category);
    honest = captured.at(-1)!;
    layout = layoutOf(honest, deployer);
    // The creator's master, the deployer coin (X, 0) and the author coin (X, 1); the range starts after the event.
    expect([layout.deployerInput, layout.authorInput, layout.outbase]).toEqual([1, 2, 2]);
  }, 600_000);

  const record = (): number => layout.outbase + 1;
  const satoshiRow = (): number => layout.outbase + 2;
  const xHex = (): string => binToHex(layout.x);

  it('accepts the honest creation, signed again', () => {
    expect(verify(copy(honest))).toBe(true);
  });

  describe('A4.3 step 4: the input at __internal__authorIndex spends (X, 1)', () => {
    it('refuses a coin of the builder in the author coin\'s place', () => {
      const spend = copy(honest);
      spend.transaction.inputs[layout.authorInput] = coin('cd'.repeat(32), 1);
      spend.sourceOutputs[layout.authorInput] = {
        lockingBytecode: bobLock, valueSatoshis: spend.sourceOutputs[layout.authorInput].valueSatoshis,
      };
      expect(verify(spend)).not.toBe(true);
    });

    it('refuses the prep\'s change coin (X, 2) in the author coin\'s place', () => {
      const spend = copy(honest);
      spend.transaction.inputs[layout.authorInput] = coin(xHex(), 2);
      spend.sourceOutputs[layout.authorInput] = { lockingBytecode: aliceLock, valueSatoshis: prepChange.satoshis };
      expect(prepChange.vout).toBe(2);
      expect(verify(spend)).not.toBe(true);
    });

    it('follows __internal__authorIndex: the author coin moved behind another coin passes only where the index names it', () => {
      const moved = (authorIndex: number): Spend => {
        const spend = copy(honest);
        const author = spend.transaction.inputs[layout.authorInput];
        const authorSource = spend.sourceOutputs[layout.authorInput];
        spend.transaction.inputs.splice(layout.authorInput, 1, coin('ee'.repeat(32), 0), author);
        spend.sourceOutputs.splice(
          layout.authorInput, 1, { lockingBytecode: aliceLock, valueSatoshis: 5_000n }, authorSource,
        );
        const deployerInput = spend.transaction.inputs[layout.deployerInput];
        deployerInput.unlockingBytecode = withCreateArgument(
          deployerInput.unlockingBytecode, deployer, '__internal__authorIndex', Uint8Array.of(authorIndex),
        );
        return spend;
      };
      expect(verify(moved(layout.authorInput + 1))).toBe(true);
      expect(verify(moved(layout.authorInput))).not.toBe(true);
    });

    it('refuses an author index that names the creator\'s master', () => {
      const spend = copy(honest);
      const deployerInput = spend.transaction.inputs[layout.deployerInput];
      deployerInput.unlockingBytecode = withCreateArgument(
        deployerInput.unlockingBytecode, deployer, '__internal__authorIndex', new Uint8Array(),
      );
      expect(verify(spend)).not.toBe(true);
    });
  });

  describe('A4.3 step 3: the deployer coin\'s own outpoint index is 0', () => {
    it('refuses a deployer coin at (X, 1) with the author coin at (X, 0), which steps 3 and 4 both refuse', () => {
      const spend = copy(honest);
      spend.transaction.inputs[layout.deployerInput].outpointIndex = 1;
      spend.transaction.inputs[layout.authorInput].outpointIndex = 0;
      expect(verify(spend)).not.toBe(true);
    });

    it('refuses a deployer coin at (X, 2), even with the author coin at (X, 1) and a plain coin at (X, 0)', () => {
      // The coin at (X, 0) lets the transaction mint X, so only step 3 stands between this and a birth.
      const spend = (deployerVout: number, plainVout: number): Spend => {
        const edited = copy(honest);
        edited.transaction.inputs[layout.deployerInput].outpointIndex = deployerVout;
        edited.transaction.inputs.push(coin(xHex(), plainVout));
        edited.sourceOutputs.push({ lockingBytecode: aliceLock, valueSatoshis: 5_000n });
        return edited;
      };
      expect(verify(spend(2, 0))).not.toBe(true);
      expect(verify(spend(0, 2))).toBe(true);
    });
  });

  describe('A4.4: the data record at OUTBASE + 1', () => {
    it('refuses the record at another lock', () => {
      const spend = copy(honest);
      spend.transaction.outputs[record()].lockingBytecode = bobLock;
      expect(verify(spend)).not.toBe(true);
    });

    it('refuses a decoy of another category at the record\'s place while X\'s record carries forged state', () => {
      // Critical 1 of the review: the decoy carries the honest commitment, at the honest lock and value; C's own X‖01
      // record, with the builder's state, sits at C's data lock further on. The census still counts one X‖01.
      const decoyed = (category: Uint8Array): Spend => {
        const spend = copy(honest);
        const genuine = spend.transaction.outputs[record()];
        spend.transaction.inputs.push(coin('ab'.repeat(32), 0));
        spend.sourceOutputs.push({ lockingBytecode: bobLock, valueSatoshis: 5_000n });
        const forged = Uint8Array.from(genuine.token.nft.commitment);
        forged[forged.length - 1] ^= 0x01;
        spend.transaction.outputs[record()] = {
          ...genuine, token: { category, amount: 0n, nft: { capability: 'mutable', commitment: genuine.token.nft.commitment } },
        };
        spend.transaction.outputs.push({
          ...genuine, token: { ...genuine.token, nft: { capability: 'mutable', commitment: forged } },
        });
        return spend;
      };
      expect(verify(decoyed(hexToBin('ab'.repeat(32))))).not.toBe(true);
      // Control: the same extra coin and outputs, with the builder's NFT (still at C's data lock) the extra one.
      const control = copy(honest);
      control.transaction.inputs.push(coin('ab'.repeat(32), 0));
      control.sourceOutputs.push({ lockingBytecode: bobLock, valueSatoshis: 5_000n });
      control.transaction.outputs.push({
        ...control.transaction.outputs[record()],
        token: { category: hexToBin('ab'.repeat(32)), amount: 0n, nft: { capability: 'mutable', commitment: Uint8Array.of(1) } },
      });
      expect(verify(control)).toBe(true);
    });

    it('refuses a record that is not RESERVE', () => {
      const spend = copy(honest);
      spend.transaction.outputs[record()].valueSatoshis = 1201n;
      expect(verify(spend)).not.toBe(true);
    });
  });

  describe('A4.4: the single satoshi container row', () => {
    it('refuses the coin at another lock', () => {
      const spend = copy(honest);
      spend.transaction.outputs[satoshiRow()].lockingBytecode = bobLock;
      expect(verify(spend)).not.toBe(true);
    });

    it('refuses the coin at another lock while a coin of the container lock sits elsewhere', () => {
      // The count of coins at the lock is then 1, so only the row's own lock pin stands in the way.
      const spend = copy(honest);
      const lock = spend.transaction.outputs[satoshiRow()].lockingBytecode;
      spend.transaction.outputs[satoshiRow()].lockingBytecode = bobLock;
      spend.transaction.outputs.push({ lockingBytecode: lock, valueSatoshis: 1200n });
      expect(verify(spend)).not.toBe(true);
    });

    it('holds at least the journal\'s final balance: 600 and 1,199 are refused, 1,201 passes', () => {
      for (const [value, accepted] of [[600n, false], [1199n, false], [1200n, true], [1201n, true]] as const) {
        const spend = copy(honest);
        spend.transaction.outputs[satoshiRow()].valueSatoshis = value;
        expect(verify(spend) === true, `${value} sat`).toBe(accepted);
      }
    });

    it('refuses a second output at the container lock, and accepts the same output elsewhere', () => {
      const second = (lockingBytecode: Uint8Array): Spend => {
        const spend = copy(honest);
        spend.transaction.outputs.push({ lockingBytecode, valueSatoshis: 1200n });
        return spend;
      };
      expect(verify(second(honest.transaction.outputs[satoshiRow()].lockingBytecode))).not.toBe(true);
      expect(verify(second(bobLock))).toBe(true);
    });
  });

  it('stores this.category at birth as X in display order (A5): the record create accepted holds X as the SDK reads it', () => {
    // `me` is the constructor's this.category; create's commitment check accepted it, and it equals the category in
    // display order. The byte order itself is isolated at top level ("A5: this.category at birth").
    const commitment = honest.transaction.outputs[record()].token.nft.commitment as Uint8Array;
    expect(binToHex(commitment)).toContain(xHex());
    expect(binToHex(commitment)).not.toContain(binToHex(Uint8Array.from(layout.x).reverse()));
  });

  it('refuses the hijack of a deployer coin: no author coin, record and satoshi coin to the builder', () => {
    const spend = copy(honest);
    spend.transaction.inputs[layout.authorInput] = coin('cd'.repeat(32), 1);
    spend.sourceOutputs[layout.authorInput] = {
      lockingBytecode: bobLock, valueSatoshis: spend.sourceOutputs[layout.authorInput].valueSatoshis,
    };
    spend.transaction.outputs[record()].lockingBytecode = bobLock;
    spend.transaction.outputs[satoshiRow()].lockingBytecode = bobLock;
    expect(verify(spend)).not.toBe(true);
  });
});

describe('Deploy<C> genesis pins at top level (stock libauth, standard)', () => {
  const changeAddress = (): string => {
    const address = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
    if (typeof address === 'string') throw new Error(address);
    return address.address;
  };

  async function deployCaptured(
    source: string, args: unknown[], txid: string, extra: Record<string, unknown> = {},
    seed?: (provider: MockNetworkProvider) => Promise<Record<string, unknown>>,
  ): Promise<{
      artifact: ReturnType<typeof compileString>; result: Awaited<ReturnType<typeof StatefulContract.deploy>>;
      creation: Spend; provider: MockNetworkProvider; layout: ReturnType<typeof layoutOf>;
    }> {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const captured = captureBroadcasts(provider);
    const artifact = compileString(source, { deployer: true, messageBus: false });
    const fundingUtxo: Utxo = { txid, vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(binToHex(aliceLock), fundingUtxo);
    const seeded = seed === undefined ? {} : await seed(provider);
    const result: any = await StatefulContract.deploy(artifact as never, args as never, {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: changeAddress(),
      senderLockingBytecode: aliceLock, viaDeployer: true, ...seeded, ...extra,
    } as never);
    const creation = captured.at(-1)!;
    return { artifact, result, creation, provider, layout: layoutOf(creation, artifact.deployer!) };
  }

  describe('A4.4: a single token container row', () => {
    let honest: Spend;
    let outbase: number;
    let tokenRow: number;

    beforeAll(async () => {
      // The SDK's default creation fee does not cover a pool-sized unlocking; the fee is not what this tests.
      const deployed = await deployCaptured(TOKEN_POOL, [8n, hexToBin(ASSET), lockFor(0x6b)], '51'.repeat(32), { fee: 20_000n },
        async (provider) => {
          const seed: Utxo = { txid: 'f6'.repeat(32), vout: 0, satoshis: 1_200n, token: { category: ASSET, amount: 1n } };
          await provider.seedUtxo(binToHex(aliceLock), seed);
          return { tokenContainers: [{ utxo: seed, unlocker: new SignatureTemplate(alicePriv).unlockP2PKH() }] };
        });
      expect(deployed.artifact.deployer!.tokenRows).toEqual([1]);
      expect(deployed.artifact.deployer!.genesisOutputs).toBe(4);
      honest = deployed.creation;
      outbase = deployed.layout.outbase;
      tokenRow = outbase + 3;
      // The pool's state names its category, read through this.category at birth (A5).
      expect(((await deployed.result.contract.getState()) as { me?: Uint8Array }).me)
        .toEqual(hexToBin(deployed.result.categoryId));
      expect(binToHex(honest.transaction.outputs[tokenRow].token.category)).toBe(ASSET);
    }, 600_000);

    it('accepts the honest creation, signed again', () => {
      expect(verify(copy(honest))).toBe(true);
    });

    it('refuses the token coin at another lock', () => {
      const spend = copy(honest);
      spend.transaction.outputs[tokenRow].lockingBytecode = bobLock;
      expect(verify(spend)).not.toBe(true);
    });

    it('refuses the token coin at another lock while a coin of the container lock sits elsewhere', () => {
      // The count of coins at the lock is then 1, so only the row's own lock pin stands in the way.
      const spend = copy(honest);
      const lock = spend.transaction.outputs[tokenRow].lockingBytecode;
      spend.transaction.outputs[tokenRow].lockingBytecode = bobLock;
      spend.transaction.outputs.push({ lockingBytecode: lock, valueSatoshis: 1200n });
      expect(verify(spend)).not.toBe(true);
    });

    it('refuses a coin of the category with its bytes reversed (the parameter is in display order)', () => {
      const spend = copy(honest);
      const reversed = Uint8Array.from(hexToBin(ASSET)).reverse();
      const seedInput = spend.sourceOutputs.findIndex((output) => output.token !== undefined
        && binToHex(output.token.category) === ASSET);
      spend.sourceOutputs[seedInput].token.category = reversed;
      spend.transaction.outputs[tokenRow].token.category = reversed;
      expect(verify(spend)).not.toBe(true);
    });

    it('needs at least one unit and RESERVE: no token and 1,199 sat are refused; two units and 1,201 sat pass', () => {
      const tokenless = copy(honest);
      delete tokenless.transaction.outputs[tokenRow].token;
      expect(verify(tokenless)).not.toBe(true);
      const twoUnits = copy(honest);
      const seedInput = twoUnits.sourceOutputs.findIndex((output) => output.token !== undefined
        && binToHex(output.token.category) === ASSET);
      twoUnits.sourceOutputs[seedInput].token.amount = 2n;
      twoUnits.transaction.outputs[tokenRow].token.amount = 2n;
      expect(verify(twoUnits)).toBe(true);
      for (const [value, accepted] of [[1199n, false], [1201n, true]] as const) {
        const spend = copy(honest);
        spend.transaction.outputs[tokenRow].valueSatoshis = value;
        expect(verify(spend) === true, `${value} sat`).toBe(accepted);
      }
    });

    it('refuses a mutable NFT on the token coin', () => {
      const spend = copy(honest);
      const seedInput = spend.sourceOutputs.findIndex((output) => output.token !== undefined
        && binToHex(output.token.category) === ASSET);
      spend.sourceOutputs[seedInput].token.nft = { capability: 'mutable', commitment: new Uint8Array() };
      spend.transaction.outputs[tokenRow].token.nft = { capability: 'mutable', commitment: new Uint8Array() };
      expect(verify(spend)).not.toBe(true);
    });

    it('refuses a second output at the token container lock, and accepts the same output elsewhere', () => {
      const second = (lockingBytecode: Uint8Array): Spend => {
        const spend = copy(honest);
        spend.transaction.outputs.push({ lockingBytecode, valueSatoshis: 1200n });
        return spend;
      };
      expect(verify(second(honest.transaction.outputs[tokenRow].lockingBytecode))).not.toBe(true);
      expect(verify(second(bobLock))).toBe(true);
    });
  });

  it('pins the satoshi coin at the lock C spends when C\'s master can retire (A4.4, "C\'s own options")', async () => {
    // The SDK sizes the author coin without initialBalance (an SDK item outside this change), so the value is small.
    const deployed = await deployCaptured(RETIRING, [], '53'.repeat(32), { initialBalance: 2000n });
    const row = deployed.layout.outbase + 2;
    expect(deployed.creation.transaction.outputs[row].valueSatoshis).toBe(2000n);
    expect(verify(copy(deployed.creation))).toBe(true);
    // The destroy spends the coin create pinned, so its lock is the one C's own code checks.
    const signer = await deployed.provider.getSigner(0);
    await deployed.provider.seedUtxo(signer.getAddress(), { txid: '54'.repeat(32), vout: 0, satoshis: 100_000n });
    const vault = new StatefulContract(deployed.result.categoryId, deployed.artifact as never, signer);
    const destroyed = await StatefulContract.destroy({
      provider: deployed.provider, contract: vault, destroyFunctionName: 'bye', destroyFunctionArgs: [],
      recipient: changeAddress(), fee: 2000n,
    } as never);
    expect(destroyed.totalReclaimed).toBeGreaterThanOrEqual(2000n);
  }, 600_000);

  describe('A5: this.category at birth', () => {
    let honest: Spend;
    let deployer: DeployerAbi;
    let category: Uint8Array;

    beforeAll(async () => {
      clearGenesisReservations();
      const provider = new MockNetworkProvider({ profile: 'production' });
      const captured = captureBroadcasts(provider);
      const artifact = compileString(SELF, { deployer: true, messageBus: false });
      deployer = artifact.deployer!;
      const fundingUtxo: Utxo = { txid: '55'.repeat(32), vout: 0, satoshis: 500_000n };
      await provider.seedUtxo(binToHex(aliceLock), fundingUtxo);
      const signer = new SignatureTemplate(alicePriv).unlockP2PKH();
      const { prep } = await buildDeployerPrep({
        children: [{ deployer, contractName: artifact.contractName }], fundingUtxos: [fundingUtxo],
        authorSigner: signer, authorLockingBytecode: aliceLock, changeLockingBytecode: aliceLock, provider,
      });
      // The argument is the category in display order, as this.category reads it everywhere else.
      category = hexToBin(prep.category);
      await StatefulContract.deploy(artifact as never, [] as never, {
        provider, fundingUtxo, funder: signer, changeAddress: changeAddress(), senderLockingBytecode: aliceLock,
        initArgs: [category], deployerPrep: prep, viaDeployer: true,
      } as never);
      honest = captured.at(-1)!;
    }, 600_000);

    const withArgument = (value: Uint8Array): Spend => {
      const spend = copy(honest);
      const input = spend.sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === deployer.lockingBytecode);
      spend.transaction.inputs[input].unlockingBytecode = withCreateArgument(
        spend.transaction.inputs[input].unlockingBytecode, deployer, 'c', value,
      );
      return spend;
    };

    it('equals X in display order, not in the VM\'s byte order', () => {
      // `c` is a constructor argument: it is not part of M and not stored, so only the comparison reads it.
      expect(verify(withArgument(category))).toBe(true);
      expect(verify(withArgument(Uint8Array.from(category).reverse()))).not.toBe(true);
    });

    it('is the deployer coin\'s outpoint, whatever token the coin carries', () => {
      const spend = copy(honest);
      const input = spend.sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === deployer.lockingBytecode);
      spend.sourceOutputs[input] = { ...spend.sourceOutputs[input], token: { category: hexToBin(ASSET), amount: 1n } };
      expect(verify(spend)).toBe(true);
    });
  });

  describe('A4.4: an optional satoshi container row', () => {
    let honest: Spend;
    let row: number;

    beforeAll(async () => {
      const deployed = await deployCaptured(PAYABLE, [], '52'.repeat(32), { initialBalance: 2000n });
      expect(deployed.artifact.deployer!.satoshiContainer).toBe('optional');
      honest = deployed.creation;
      row = deployed.layout.outbase + 2;
      expect(honest.transaction.outputs[row].valueSatoshis).toBe(2000n);
    }, 600_000);

    it('accepts the honest creation, signed again', () => {
      expect(verify(copy(honest))).toBe(true);
    });

    it('refuses the coin at another lock while the balance is not 0', () => {
      const spend = copy(honest);
      spend.transaction.outputs[row].lockingBytecode = bobLock;
      expect(verify(spend)).not.toBe(true);
    });

    it('holds at least the balance: 1,999 is refused and 2,001 passes', () => {
      for (const [value, accepted] of [[1999n, false], [2001n, true]] as const) {
        const spend = copy(honest);
        spend.transaction.outputs[row].valueSatoshis = value;
        expect(verify(spend) === true, `${value} sat`).toBe(accepted);
      }
    });
  });
});

describe('Deploy<C> token rows through a creator (A14 item 11)', () => {
  /** A TokenPool-shaped child created through its creator, the paying wallet holding `units` of ASSET in one coin. */
  async function createTokenPool(
    units: bigint, funding: (seed: Utxo, alice: Signer) => Record<string, unknown>,
  ): Promise<{ honest: Spend; outbase: number; tokenRow: number; satoshiRow: number }> {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const captured = captureBroadcasts(provider);
    const artifacts = compileStringMulti(TOKEN_POOLS, { allowUnsafeOperations: true });
    const deployer: DeployerAbi = (artifacts.TokenPoolDeployer as any).childDeployers.TokenPool;
    expect(deployer.tokenRows).toEqual([1]);
    const alice = new Signer(alicePriv, provider);
    await provider.seedUtxo(alice.getAddress(), { txid: 'd4'.repeat(32), vout: 0, satoshis: 200_000n });
    await provider.seedUtxo(alice.getAddress(), { txid: 'e5'.repeat(32), vout: 0, satoshis: 100_000n });
    const seed: Utxo = { txid: 'f6'.repeat(32), vout: 0, satoshis: 1_200n, token: { category: ASSET, amount: units } };
    await provider.seedUtxo(alice.getAddress(), seed);
    const factory: any = await new ContractFactory(artifacts.TokenPoolDeployer as never, alice).deploy();
    factory.registerChild(artifacts.TokenPool);
    const naming = (await alice.getUtxos()).find((utxo: Utxo) => utxo.txid === 'e5'.repeat(32));
    const { preps } = await buildDeployerPreps({
      provider,
      children: [{ contractName: 'TokenPool', deployer, authorValue: 20_000n }],
      fundingUtxos: [naming!],
      authorSigner: alice.unlockP2PKH(),
      authorLockingBytecode: aliceLock,
      changeLockingBytecode: aliceLock,
    });
    const result = await factory.create(8n, hexToBin(ASSET), lockFor(0x6b)).deploy({
      deployerPreps: preps, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), ...funding(seed, alice),
    });
    expect(result.childCategoryId).toBe(preps[0].category);
    const honest = captured.at(-1)!;
    const layout = layoutOf(honest, deployer);
    return { honest, outbase: layout.outbase, tokenRow: layout.outbase + 3, satoshiRow: layout.outbase + 2 };
  }

  it('opens the token row from a coin passed whole (childTokenContainers), which create pins', async () => {
    const { honest, tokenRow } = await createTokenPool(1n, (seed, alice) => ({
      childTokenContainers: [{ utxo: seed, unlocker: alice.unlockP2PKH() }],
    }));
    expect(binToHex(honest.transaction.outputs[tokenRow].token.category)).toBe(ASSET);
    expect(honest.transaction.outputs[tokenRow].token.amount).toBe(1n);
    expect(verify(copy(honest))).toBe(true);
    const moved = copy(honest);
    moved.transaction.outputs[tokenRow].lockingBytecode = bobLock;
    expect(verify(moved)).not.toBe(true);
  }, 600_000);

  it('opens the rows from childContainers: the SDK takes the units from the wallet and returns the rest', async () => {
    const { honest, tokenRow, satoshiRow } = await createTokenPool(5n, () => ({
      childContainers: [{ deployment: 0, satoshis: 1_500n, tokens: [{ categoryId: ASSET, amount: 3n }] }],
    }));
    // The row holds the three units asked for, the satoshi coin what was asked, and the other two units go back.
    expect(binToHex(honest.transaction.outputs[tokenRow].token.category)).toBe(ASSET);
    expect(honest.transaction.outputs[tokenRow].token.amount).toBe(3n);
    expect(honest.transaction.outputs[satoshiRow].valueSatoshis).toBe(1_500n);
    const returned = honest.transaction.outputs.filter((output: any) => output.token !== undefined
      && binToHex(output.token.category) === ASSET && binToHex(output.lockingBytecode) === binToHex(aliceLock));
    expect(returned.map((output: any) => output.token.amount)).toEqual([2n]);
    expect(verify(copy(honest))).toBe(true);
    const moved = copy(honest);
    moved.transaction.outputs[tokenRow].lockingBytecode = bobLock;
    expect(verify(moved)).not.toBe(true);
  }, 600_000);

  it('refuses childContainers that ask more units than the wallet holds, or another deployment', async () => {
    await expect(createTokenPool(2n, () => ({
      childContainers: [{ deployment: 0, tokens: [{ categoryId: ASSET, amount: 3n }] }],
    }))).rejects.toThrow(/asks 3 units/);
    await expect(createTokenPool(2n, () => ({
      childContainers: [{ deployment: 1, tokens: [{ categoryId: ASSET, amount: 1n }] }],
    }))).rejects.toThrow(/names deployment 1/);
    await expect(createTokenPool(2n, () => ({
      childContainers: [{ deployment: 0, satoshis: 1_000n, tokens: [{ categoryId: ASSET, amount: 1n }] }],
    }))).rejects.toThrow(/must hold at least 1200/);
  }, 600_000);
});
