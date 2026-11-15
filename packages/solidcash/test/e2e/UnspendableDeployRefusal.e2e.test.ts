/**
 * Every deployment refuses code no input could spend, before it broadcasts anything (UnspendableContractError). The
 * limit is the one the provider enforces: the network the coins land on decides whether they can move, so each row
 * sets it on the provider, and each refusal has a control that deploys the same source where the limit admits it.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString, compileStringMulti } from '@solidcash/solidc';
import { asmToBytecode, pushPrefixLength } from '@solidcash/utils';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import {
  Contract, SignatureTemplate, Signer, UnspendableContractError,
} from '../../src/index.js';
import {
  buildDeployerPreps, ContractBundle, ContractFactory, StatefulContract,
} from '../../src/stateful/index.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import type { Utxo } from '../../src/interfaces.js';

const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);
const changeAddress = ((): string => {
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  return change.address;
})();

/** The bytes of an artifact's code: `bytecode` is an ASM listing. */
const codeBytes = (artifact: { bytecode: string }): number => asmToBytecode(artifact.bytecode).length;

/** Every raw transaction the provider is asked to broadcast. */
function broadcasts(provider: MockNetworkProvider): string[] {
  const sent: string[] = [];
  const inner = provider.sendRawTransaction.bind(provider);
  provider.sendRawTransaction = async (hex: string) => {
    sent.push(hex);
    return inner(hex);
  };
  return sent;
}

/** A 500,000-satoshi coin at the wallet's lock, at vout 0 so either genesis can spend it. */
async function seed(provider: MockNetworkProvider, byte: string): Promise<Utxo> {
  const utxo: Utxo = { txid: byte.repeat(32), vout: 0, satoshis: 500_000n };
  await provider.seedUtxo(binToHex(aliceLock), utxo);
  return utxo;
}

const deployOptions = (provider: MockNetworkProvider, fundingUtxo: Utxo, extra: object = {}): never => ({
  provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress, senderLockingBytecode: aliceLock, ...extra,
}) as never;

/** The error a deployment step rejects with, which must be the named refusal. */
async function refusal(run: () => Promise<unknown>): Promise<UnspendableContractError> {
  const error = await run().then(() => undefined, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(UnspendableContractError);
  return error as UnspendableContractError;
}

const TOKEN_PAYOUT = `contract TokenPayout {
    int sent;
    function run(bytes32 series, bytes20[] to) public {
        for (int i = 0; i < 3; i++) { this.tokens[series].transfer(new LockingBytecodeP2PKH(to[i]), 5 + i); }
        this.sent = this.sent + 1;
    }
}`;

/** A contract with a deployer (DeployerCreation.e2e.test.ts). It takes no contract arguments. */
const C = 'pragma solidcash ^0.50.0; contract C { int n; constructor() { n = 1; } function read() { require(n == 1); } }';

const FACTORY = `
  contract MultiChild() {
    bytes20 owner;
    int counter;
    bool untouched;
    constructor(bytes20 initialOwner) { this.owner = initialOwner; this.counter = 7; }
    function bump() { this.counter = this.counter + 1; require(true); }
  }
  contract MultiFactory(pubkey factoryOwner) {
    int deployCount;
    function deployChild(sig s, bytes20 childOwner) {
      require(checkSig(s, factoryOwner));
      MultiChild child = new MultiChild(childOwner);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

describe('a deployment of code no input can spend', () => {
  it('refuses the message-bus build of TokenPayout on BCH limits, and deploys its direct build there', async () => {
    const bus = compileString(TOKEN_PAYOUT, { messageBus: true, suppressWarnings: true });
    const direct = compileString(TOKEN_PAYOUT, { messageBus: false, suppressWarnings: true });
    const busBytes = codeBytes(bus);
    // Premises: the explicit bus build is over the limit and says so; the direct build fits.
    expect(bus.compiler.options?.messageBus).toBe(true);
    expect(busBytes).toBeGreaterThan(10_000);
    expect(bus.diagnostics?.map((diagnostic) => diagnostic.code)).toContain('contract-size-limit');
    expect(codeBytes(direct) + pushPrefixLength(codeBytes(direct))).toBeLessThanOrEqual(10_000);

    const provider = new MockNetworkProvider({ profile: 'production' });
    const sent = broadcasts(provider);
    const funding = await seed(provider, 'c1');
    const genesis = await refusal(() => StatefulContract.deploy(bus, [], deployOptions(provider, funding, {
      initialState: { sent: 0n },
    })));
    expect(genesis).toMatchObject({
      contractName: 'TokenPayout', codeBytes: busBytes, requiredBytes: busBytes + pushPrefixLength(busBytes),
      limit: 10_000, limitKind: 'unlocking bytecode',
    });
    expect(genesis.message).toMatch(/Nothing was broadcast/);
    await refusal(() => new ContractFactory(bus, new Signer(alicePriv, provider)).deploy());
    expect(sent).toHaveLength(0);

    const deployed = await StatefulContract.deploy(direct, [], deployOptions(provider, funding, {
      initialState: { sent: 0n },
    }));
    expect(deployed.categoryId).toBe(funding.txid);
    expect(sent.length).toBeGreaterThan(0);
  }, 600_000);

  it('refuses every path by the code alone where its push is over the limit, and deploys at BCH limits', async () => {
    const artifact = compileString(C, { deployer: true, messageBus: false, suppressWarnings: true });
    expect(artifact.deployer?.code).toBe(binToHex(asmToBytecode(artifact.bytecode)));
    const code = codeBytes(artifact);
    const limit = code + pushPrefixLength(code) - 1;
    const provider = new MockNetworkProvider({ profile: 'production', consensusLimits: { maximumInputBytes: limit } });
    const sent = broadcasts(provider);
    const funding = await seed(provider, 'c2');

    // Deploy<C>, by the deployment and by a prep built ahead of it.
    expect(await refusal(() => StatefulContract.deploy(artifact, [], deployOptions(provider, funding))))
      .toMatchObject({ contractName: 'C', codeBytes: code, limit });
    await refusal(() => buildDeployerPreps({
      children: [{ deployer: artifact.deployer!, contractName: 'C' }],
      fundingUtxos: [funding],
      authorSigner: alice.unlockP2PKH(),
      authorLockingBytecode: aliceLock,
      changeLockingBytecode: aliceLock,
      provider,
    }));
    // ContractFactory, before it would fan out a funding coin.
    await refusal(() => new ContractFactory(artifact, new Signer(alicePriv, provider)).deploy());
    expect(sent).toHaveLength(0);

    const roomy = new MockNetworkProvider({ profile: 'production' });
    const roomyFunding = await seed(roomy, 'c2');
    const deployed = await StatefulContract.deploy(artifact, [], deployOptions(roomy, roomyFunding));
    expect(deployed.prepTransactions).toHaveLength(1);
  }, 300_000);

  it('refuses a lock its category pin takes over the limit its code alone fits, before the prep is sent', async () => {
    const artifact = compileString(C, { deployer: true, messageBus: false, suppressWarnings: true });
    const code = codeBytes(artifact);
    const limit = code + pushPrefixLength(code);
    const provider = new MockNetworkProvider({ profile: 'production', consensusLimits: { maximumInputBytes: limit } });
    const sent = broadcasts(provider);
    const funding = await seed(provider, 'c3');
    const redeem = new Contract(artifact, [], { provider, category: hexToBin(funding.txid) }).bytesize;
    expect(redeem).toBeGreaterThan(code);

    // Deploy<C>: the prep is built and signed, and the creation refuses C's born lock before the prep is broadcast.
    expect(await refusal(() => StatefulContract.deploy(artifact, [], deployOptions(provider, funding))))
      .toMatchObject({ codeBytes: redeem, limit });
    // Today's genesis, which the same coin can still fund: the reservations of the refused prep were released.
    expect(await refusal(() => StatefulContract.deploy(artifact, [], deployOptions(provider, funding, {
      viaDeployer: false,
    })))).toMatchObject({ codeBytes: redeem, limit });
    // ContractFactory measures the lock before a funding coin exists: a category pin is as long for every category.
    expect(await refusal(() => new ContractFactory(artifact, new Signer(alicePriv, provider)).deploy()))
      .toMatchObject({ codeBytes: redeem, limit });
    expect(sent).toHaveLength(0);
  }, 300_000);

  it('refuses a creating call whose child no input could spend, and creates it where the limit admits it', async () => {
    const provider = new MockNetworkProvider();
    const bundle = ContractBundle.from(
      compileStringMulti(FACTORY, { __legacyDeployFold: true } as never), { provider },
    );
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const factoryFunding: Utxo = { txid: 'c4'.repeat(32), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(p2pkh.address, factoryFunding);
    const { contract: factory } = await bundle.deploy('MultiFactory', [alicePub], {
      fundingUtxo: factoryFunding,
      funder: p2pkh.unlock.spend(alicePub, alice),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });
    const childFunding: Utxo = { txid: 'c5'.repeat(32), vout: 0, satoshis: 50_000n };
    await provider.addUtxo(p2pkh.address, childFunding);
    const create = (): Promise<unknown> => StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'deployChild',
      deployFunctionArgs: [alice, alicePkh],
      fundingUtxo: childFunding,
      funder: p2pkh.unlock.spend(alicePub, alice),
      changeAddress: p2pkh.address,
    });

    const sent = broadcasts(provider);
    const limits = provider.consensusLimits;
    provider.consensusLimits = { ...limits, maximumInputBytes: 100 };
    try {
      expect(await refusal(create)).toMatchObject({ contractName: 'MultiChild', limit: 100 });
    } finally {
      provider.consensusLimits = limits;
    }
    expect(sent).toHaveLength(0);

    await create();
    expect(sent.length).toBeGreaterThan(0);
  }, 300_000);
});
