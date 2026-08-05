import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Artifact, buildEventNftCovenantScript, buildInitialStateCommitments, computeEventNameHash,
  parsePushdataCommitment,
} from '@solidcash/utils';
import {
  Contract, MockNetworkProvider, SignatureTemplate, Signer, StatefulContract, StatefulTransactionBuilder,
  TransactionBuilder, createDataNftUnlocker, getContractFactory, getDataNftAddress, getEventNftAddress,
  readEventsFromChain, upgrades,
} from '../../src/index.js';
import { ContractUnlocker, Utxo } from '../../src/interfaces.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { addressToLockScript, createUnlockingBytecode, scriptToAddress } from '../../src/utils.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * SEC-13. `emitOwnCategoryImmutableNftOutputPin` closed the SEC-10/SEC-11 class on the ordinary path, but its
 * gate excludes three: `delegatecall` proxies (`functionHasDelegatecall`), `delegate` functions
 * (`currentFunctionIsDelegate`) and `selfdestruct`. Same forgery, measured on each.
 */

const FORGED_COMMITMENT = binToHex(new Uint8Array([0x03, 0x3f, 0x42, 0x0f])); // decodes to 999999

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

interface Row { outcome: string; events: bigint[]; state?: bigint; eventSlot?: string }

function expectRejectedAt(outcome: string, inputIndex: number): void {
  expect(outcome).toContain('mandatory-script-verify-flag-failed');
  if (outcome.includes('error in evaluating input index')) {
    expect(outcome).toContain(`error in evaluating input index ${inputIndex}`);
  }
}

// ---------------------------------------------------------------------------
// A. selfdestruct
// ---------------------------------------------------------------------------

const SELFDESTRUCT_SRC = `pragma solidcash >=0.8.0;
contract SdEvents(pubkey admin) {
  bigint counter;
  event Fired(bigint value);
  function bump(bigint x) {
    this.counter = this.counter + x;
    require(x > 0);
  }
  function destroy(sig s) selfdestruct {
    require(checkSig(s, admin));
  }
}`;

const runSelfdestruct = async (append?: 'own' | 'foreign' | 'ownWithFt'): Promise<Row> => {
  const artifact = compileString(SELFDESTRUCT_SRC);
  const provider = createTestProvider();
  const contract = new Contract(artifact, [alicePub], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const salted = contract.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(contract, categoryId);
  const builder = await (sc as any).destroy(new SignatureTemplate(alicePriv)).build();
  const eventAddress = getEventNftAddress(salted, categoryId, artifact.events![0].signature);

  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);
  if (append === 'own' || append === 'ownWithFt') {
    builder.addOutput({
      to: eventAddress,
      amount: 1000n,
      token: {
        category: categoryId,
        amount: append === 'ownWithFt' ? 1n : 0n,
        nft: { capability: 'none', commitment: FORGED_COMMITMENT },
      },
    });
  } else if (append === 'foreign') {
    builder.addOutput({ to: eventAddress, amount: 1000n });
  }

  let outcome = 'ACCEPTED';
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    outcome = `REJECTED: ${(error as Error).message}`;
  }
  const events = outcome === 'ACCEPTED'
    ? (await readEventsFromChain(provider as any, eventAddress, categoryId, artifact.events![0]))
      .map((event: any) => event.values.value)
    : [];
  return { outcome, events };
};

// ---------------------------------------------------------------------------
// A2. a ZERO-parameter conditional event: both branches encode to an EMPTY commitment.
// ---------------------------------------------------------------------------

const PING_SRC = `pragma solidcash >=0.8.0;
contract PingEvents() {
  bigint counter;
  event Ping();
  function bump(bigint x) {
    if (x > 100) { emit Ping(); }
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

const runZeroParamEvent = async (x: bigint): Promise<Row> => {
  const artifact = compileString(PING_SRC);
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const salted = contract.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(contract, categoryId);
  const builder = await (sc as any).bump(x).build();
  const eventAddress = getEventNftAddress(salted, categoryId, artifact.events![0].signature);
  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);

  let outcome = 'ACCEPTED';
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    outcome = `REJECTED: ${(error as Error).message}`;
  }
  const eventLbc = binToHex(addressToLockScript(eventAddress));
  const out = builder.buildLibauthTransaction().outputs
    .find((o: any) => binToHex(o.lockingBytecode) === eventLbc);
  const eventSlot = out
    ? `EVENTADDR/${out.token?.nft?.capability ?? 'none'}/${binToHex(out.token?.nft?.commitment ?? new Uint8Array())}`
    : 'ABSENT';
  return { outcome, events: [], eventSlot };
};

// ---------------------------------------------------------------------------
// B / C. delegatecall proxy + delegate implementation (one transaction, two scripts)
// ---------------------------------------------------------------------------

const DELEGATE_IMPL = `pragma solidcash >=0.8.0;
contract DelegateImpl() {
  bigint counter;
  function increment() delegate {
    this.counter = this.counter + 1;
  }
}`;

const PROXY = `pragma solidcash >=0.8.0;
contract DelegatecallProxy() {
  bigint counter;
  event Fired(bigint value);
  fallback(bytes input) external {
    address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;

interface Deployed {
  contract: Contract;
  categoryId: string;
  utxos: { master: Utxo; dataNfts: Utxo[] };
}

async function deploy(
  provider: MockNetworkProvider, artifact: Artifact, state: Record<string, any>,
): Promise<Deployed> {
  const contract = new Contract(artifact, [], { provider });
  const commitments = buildInitialStateCommitments(artifact.stateLayout!, state);
  const { categoryId, utxos } = await (provider as any).addTokenUtxosDynamic((cat: string) => [
    {
      address: contract.tokenAddress,
      satoshis: 10000n,
      token: { amount: 0n, nft: { capability: 'minting', commitment: '' } },
    },
    ...commitments.map((commitment) => ({
      address: getDataNftAddress(contract, cat),
      satoshis: 10000n,
      token: { amount: 0n, nft: { capability: 'mutable' as const, commitment } },
    })),
  ]);
  return { contract, categoryId, utxos: { master: utxos[0], dataNfts: utxos.slice(1) } };
}

function extGroup(
  catId: string, artifact: Artifact, d: Deployed, fnName: string, fnArgs: any[], masterInputIdx: number,
): ExternalCallUtxoGroup {
  return {
    categoryId: catId,
    stateLayout: artifact.stateLayout!,
    masterUtxo: { ...d.utxos.master, unlocker: (d.contract.unlock as any)[fnName](...fnArgs) },
    dataNftUtxos: d.utxos.dataNfts.map((nft) => ({
      ...nft, unlocker: createDataNftUnlocker(d.contract, masterInputIdx, catId),
    })),
    requiredDataNftIndices: d.utxos.dataNfts.map((_, i) => i),
    functionName: fnName,
    functionArgs: fnArgs,
    externalContract: null,
  };
}

function delegatecallUnlocker(contract: Contract, selector: Uint8Array): ContractUnlocker {
  const fallbackAbi = contract.artifact.abi.find((f) => f.isFallback)!;
  return {
    generateUnlockingBytecode: () => createUnlockingBytecode(
      contract.addressType, hexToBin(contract.bytecode), [], selector,
    ),
    generateLockingBytecode: () => addressToLockScript(contract.address),
    contract,
    params: [],
    abiFunction: fallbackAbi,
  };
}

const runDelegatecall = async (
  implSource: string, append?: 'own' | 'foreign', omitImpl = false, counter = 1n,
): Promise<Row> => {
  const implArtifact = compileString(implSource);
  const proxyArtifact = compileString(PROXY);
  const provider = createTestProvider();
  const proxy = await deploy(provider, proxyArtifact, { counter: 0n });
  const impl = await deploy(provider, implArtifact, { counter: 0n });
  const selector = hexToBin(implArtifact.abi.find((f) => f.name === 'increment')!.selector!);

  const stb = new StatefulTransactionBuilder({
    provider,
    stateLayout: proxyArtifact.stateLayout!,
    categoryId: proxy.categoryId,
    masterUtxo: { ...proxy.utxos.master, unlocker: delegatecallUnlocker(proxy.contract, selector) },
    dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
      ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
    })),
    externalCallUtxoGroups: omitImpl
      ? [] : [extGroup(impl.categoryId, implArtifact, impl, 'increment', [0n], 2)],
  }).setState('counter', counter);

  const builder = stb.build();
  const eventAddress = getEventNftAddress(proxy.contract, proxy.categoryId, proxyArtifact.events![0].signature);

  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);
  if (append === 'own') {
    builder.addOutput({
      to: eventAddress,
      amount: 1000n,
      token: {
        category: proxy.categoryId, amount: 0n, nft: { capability: 'none', commitment: FORGED_COMMITMENT },
      },
    });
  } else if (append === 'foreign') {
    builder.addOutput({ to: eventAddress, amount: 1000n });
  }

  let outcome = 'ACCEPTED';
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    outcome = `REJECTED: ${(error as Error).message}`;
  }
  const events = outcome === 'ACCEPTED'
    ? (await readEventsFromChain(provider as any, eventAddress, proxy.categoryId, proxyArtifact.events![0]))
      .map((event: any) => event.values.value)
    : [];
  let state: bigint | undefined;
  if (outcome === 'ACCEPTED') {
    // Output 1 is the proxy's own data NFT (block: master@0, dataNft@1).
    const out = builder.buildLibauthTransaction().outputs[1];
    state = parsePushdataCommitment(
      binToHex(out.token!.nft!.commitment), proxyArtifact.stateLayout!, 0,
    ).counter as bigint;
  }
  return { outcome, events, state };
};

// ---------------------------------------------------------------------------
// C. an EMITTING delegate implementation, driven through the SDK's proxy route (the only shape that grafts the
// impl's event slots into the proxy block, so the honest row settles).
// ---------------------------------------------------------------------------

const EVENT_IMPL = `pragma solidcash >=0.8.0;
contract EventImpl() {
  event Changed(bigint v);
  bigint version;
  function initialize(bigint v) delegate { this.version = v; }
  function setVersion(bigint v) delegate { emit Changed(v); this.version = v; }
}`;

const runEmittingDelegate = async (append?: 'own' | 'foreign'): Promise<Row> => {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const byte of ['a1', 'b2', 'c3', 'd4']) {
    await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  const implArtifact = compileString(EVENT_IMPL);
  const proxy = await upgrades.deployProxy(getContractFactory(implArtifact, signer), [1n]);
  const categoryId = proxy.proxy.categoryId!;
  // The proxy artifact does not declare the impl's events, so build the covenant address directly: the same
  // script `getEventNftAddress` produces, keyed on the PROXY category the impl covenant verifies against.
  const eventAddress = scriptToAddress(buildEventNftCovenantScript(
    hexToBin(categoryId), computeEventNameHash(implArtifact.events![0].signature),
  ), provider.network, 'p2sh32', true);

  const builder = await (proxy as any).setVersion(25n).build();
  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);
  if (append === 'own') {
    builder.addOutput({
      to: eventAddress,
      amount: 1000n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment: FORGED_COMMITMENT } },
    });
  } else if (append === 'foreign') {
    builder.addOutput({ to: eventAddress, amount: 1000n });
  }

  let outcome = 'ACCEPTED';
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    outcome = `REJECTED: ${(error as Error).message}`;
  }
  const events = outcome === 'ACCEPTED'
    ? (await readEventsFromChain(provider as any, eventAddress, categoryId, implArtifact.events![0]))
      .map((event: any) => event.values.v)
    : [];
  return { outcome, events };
};

describe('SEC-13 forged event NFTs on paths the SEC-10/SEC-11 pin did not reach', () => {
  // --- A. selfdestruct. Spending the master minting NFT lets the destroyer mint own-category immutable NFTs,
  // and after destruction no honest emit can ever contradict them.
  it('settles the honest selfdestruct row', async () => {
    expect((await runSelfdestruct()).outcome).toBe('ACCEPTED');
  }, 300_000);

  it('refuses an appended own-category event NFT on a selfdestruct', async () => {
    const row = await runSelfdestruct('own');
    expectRejectedAt(row.outcome, 0);
    expect(row.events).toEqual([]);
  }, 300_000);

  it('still admits a token-free output appended to a selfdestruct', async () => {
    expect((await runSelfdestruct('foreign')).outcome).toBe('ACCEPTED');
  }, 300_000);

  // --- B. A co-spent `delegate` implementation that declares NO event of its own. The forged log is readable
  // against the PROXY's declaration, which the implementation cannot see - so the pin cannot be gated on the
  // implementation's own `declaresEvents` here.
  it('settles the honest delegatecall row', async () => {
    expect((await runDelegatecall(DELEGATE_IMPL)).outcome).toBe('ACCEPTED');
  }, 300_000);

  it('refuses an appended own-category event NFT beside a non-emitting delegate', async () => {
    const row = await runDelegatecall(DELEGATE_IMPL, 'own');
    // Input index 2 is the implementation: its delegate covenant carries the pin, not the proxy's.
    expectRejectedAt(row.outcome, 2);
    expect(row.events).toEqual([]);
  }, 300_000);

  it('still admits a token-free output appended to a delegatecall', async () => {
    expect((await runDelegatecall(DELEGATE_IMPL, 'foreign')).outcome).toBe('ACCEPTED');
  }, 300_000);

  // --- C. A `delegate` function that genuinely emits. The honest log must survive; the forged one must not.
  it('settles an emitting delegate implementation and logs it', async () => {
    const row = await runEmittingDelegate();
    expect(row.outcome).toBe('ACCEPTED');
    expect(row.events).toEqual([25n]);
  }, 300_000);

  it('refuses an appended own-category event NFT beside a genuine delegate emit', async () => {
    const row = await runEmittingDelegate('own');
    expectRejectedAt(row.outcome, 2);
    expect(row.events).toEqual([]);
  }, 300_000);

  it('still admits a token-free output beside a genuine delegate emit', async () => {
    const row = await runEmittingDelegate('foreign');
    expect(row.outcome).toBe('ACCEPTED');
    expect(row.events).toEqual([25n]);
  }, 300_000);

  /**
   * OPEN RESIDUAL, measured not reasoned. A `delegatecall` proxy is not pinned: its honest own-category
   * immutable outputs are the co-spent implementation's event NFTs, at an offset only that implementation's
   * layout names (measured above: output 4 = implInput 2 + implEventOffset 2, while the proxy block is [0,1]).
   * The implementation's own pin covers them - so the residual is exactly a proxy that does not force the
   * implementation co-spend. This proxy hardcodes a NON-covenant p2pkh implementation address, so nothing runs.
   *
   * That is already SECURITY-AUDIT C1, not a new class: the same shape rewrites the proxy's ENTIRE state with
   * no implementation at all, which the row below asserts. A forged log adds nothing to a proxy that has
   * already ceded its state.
   */
  it('leaves a proxy that does not force its implementation co-spend open (C1, not a new class)', async () => {
    const control = await runDelegatecall(DELEGATE_IMPL, undefined, true, 987654321n);
    expect(control.outcome).toBe('ACCEPTED');
    expect(control.state).toBe(987654321n); // arbitrary state written with NO implementation co-spent
    const forged = await runDelegatecall(DELEGATE_IMPL, 'own', true);
    expect(forged.outcome).toBe('ACCEPTED');
    expect(forged.events).toEqual([999999n]);
  }, 300_000);

  /**
   * RESIDUAL 1, measured. The pin excludes own-category immutable NFTs carrying a NON-ZERO fungible amount:
   * introspection cannot tell one from a pure-FT output. For a contract with no own-category FTs in circulation
   * the variant is unreachable anyway - CashTokens only creates fungible tokens in the genesis transaction, so
   * consensus itself refuses it. It becomes reachable only for a contract holding own-category FTs, and then the
   * forger must divert existing FTs into the forged output.
   */
  it('has the FT-carrying variant refused by CashTokens itself, not by the pin', async () => {
    const row = await runSelfdestruct('ownWithFt');
    expect(row.outcome).toMatch(/sum of fungible tokens in the transaction outputs exceed|bad-txns-token-in-belowout/);
  }, 300_000);

  /**
   * RESIDUAL 2, now CLOSED as SEC-14 - and it was worse than "indistinguishable". A zero-parameter event used
   * to encode to an EMPTY commitment, which is also the reserved dummy for an emit that was not reached, so
   * `emitEventCovenantVerification`'s `OP_IF <blob non-empty>` gate was FALSE on the TAKEN path and the event's
   * whole verification never ran there. One non-empty ACTIVE marker byte fixes the gate and separates the rows;
   * see Sec14ZeroParamEventMarker.test.ts for the diversion that used to be accepted.
   */
  it('separates a taken from a not-taken ZERO-parameter conditional emit', async () => {
    const taken = await runZeroParamEvent(200n);
    const notTaken = await runZeroParamEvent(4n);
    expect(taken.outcome).toBe('ACCEPTED');
    expect(notTaken.outcome).toBe('ACCEPTED');
    expect(taken.eventSlot).toBe('EVENTADDR/none/01');
    expect(notTaken.eventSlot).toBe('EVENTADDR/none/');
  }, 300_000);
});
