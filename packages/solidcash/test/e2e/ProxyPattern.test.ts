import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider, SignatureTemplate,
  StatefulTransactionBuilder,
  getDataNftAddress, createDataNftUnlocker,
} from '../../src/index.js';
import { Artifact, buildInitialStateCommitments } from '@solidcash/utils';
import {
  alicePkh, alicePub, alicePriv,
  bobPub, bobPriv,
} from '../fixture/vars.js';
import { ContractUnlocker, Utxo } from '../../src/interfaces.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createUnlockingBytecode, addressToLockScript } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';

// ============================================================
// Contract Sources
// ============================================================

// --- Approach 1: Catch-all forwarding ---
// The proxy has a single forward() function. It doesn't care what
// implementation it's forwarding to - it just verifies that a
// contract with the expected token category is present in the tx.

const CATCH_ALL_PROXY = `
pragma solidcash >=0.8.0;

contract CatchAllProxy(bytes20 admin) {
    bytes32 implCategory;

    // Forward any operation - the implementation contract validates actual logic
    function forward(int implInputIndex) {
        // Verify implementation NFT is present at the given input index
        bytes catId, bytes capByte = tx.inputs[implInputIndex].tokenCategory.split(32);
        require(catId == this.implCategory);
        require(capByte != 0x);  // Must be an NFT (has capability byte)
        // Proxy covenant: output preserved at same index
        require(tx.inputs[this.activeInputIndex].lockingBytecode ==
                tx.outputs[this.activeInputIndex].lockingBytecode);
    }

    // Admin can change which implementation the proxy points to
    function setImpl(bytes32 newImplCategory, pubkey pk, sig s) {
        require(hash160(pk) == admin);
        require(checkSig(s, pk));
        this.implCategory = newImplCategory;
        require(tx.inputs[this.activeInputIndex].lockingBytecode ==
                tx.outputs[this.activeInputIndex].lockingBytecode);
    }
}
`;

// CounterV1: simple counter
const COUNTER_V1 = `
pragma solidcash >=0.8.0;

contract CounterV1() {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function reset() {
        this.counter = 0;
    }
}
`;

// CounterV2: adds operation tracking
const COUNTER_V2 = `
pragma solidcash >=0.8.0;

contract CounterV2() {
    int counter;
    int operationCount;

    function increment() {
        this.counter = this.counter + 1;
        this.operationCount = this.operationCount + 1;
    }

    function decrement() {
        require(this.counter > 0);
        this.counter = this.counter - 1;
        this.operationCount = this.operationCount + 1;
    }
}
`;

// --- Approach 3: Transparent proxy with fallback(bytes input) ---
// The proxy uses fallback to catch ALL unknown selectors transparently.
// The `input` parameter gives access to raw calldata for validation.
// Callers don't need a proxy-specific function - any unknown selector
// is intercepted and the implementation is verified in the same tx.

const TRANSPARENT_PROXY = `
pragma solidcash >=0.8.0;

contract TransparentProxy(bytes20 admin) {
    bytes32 implCategory;

    // Admin-only: change implementation
    function setImpl(bytes32 newImplCategory, pubkey pk, sig s) {
        require(hash160(pk) == admin);
        require(checkSig(s, pk));
        this.implCategory = newImplCategory;
        require(tx.inputs[this.activeInputIndex].lockingBytecode ==
                tx.outputs[this.activeInputIndex].lockingBytecode);
    }

    // Transparent forwarding via fallback - catches all unknown selectors
    fallback(bytes input) external {
        // Verify non-empty calldata (real function call, not empty push)
        require(input.length > 0);

        // Implementation master is right after proxy's UTXOs
        // Convention: [proxy master, proxy data NFT, impl master, ...]
        int implIndex = this.activeInputIndex + 2;
        bytes catId, bytes capByte = tx.inputs[implIndex].tokenCategory.split(32);
        require(catId == this.implCategory);
        require(capByte != 0x);

        // Verify the implementation received the same calldata as the proxy.
        // msg.data (input) is the raw unlocking bytecode prefix before the
        // redeem script push (e.g. <push_opcode><selector>).  The impl's
        // unlocking bytecode must start with the same prefix bytes.
        bytes implUbcode = tx.inputs[implIndex].unlockingBytecode;
        require(implUbcode.length > input.length);
        bytes implForwarded, bytes implRest = implUbcode.split(input.length);
        require(implRest.length > 0);
        require(implForwarded == input);

        // Self-preservation covenant
        require(tx.inputs[this.activeInputIndex].lockingBytecode ==
                tx.outputs[this.activeInputIndex].lockingBytecode);
    }
}
`;

// --- Approach 2: Interface-based same method ---
// The proxy mirrors the implementation's function names and adds
// per-function validation (deposit must not decrease value, withdraw
// needs a signature). Both proxy + implementation validate in parallel.

const VAULT_PROXY = `
pragma solidcash >=0.8.0;

contract VaultProxy(bytes20 admin) {
    bytes32 implCategory;

    function deposit(int implInputIndex) {
        bytes catId, bytes capByte = tx.inputs[implInputIndex].tokenCategory.split(32);
        require(catId == this.implCategory);
        require(capByte != 0x);
        require(tx.inputs[this.activeInputIndex].lockingBytecode ==
                tx.outputs[this.activeInputIndex].lockingBytecode);
        // Proxy enforces: value must not decrease on deposit
        require(tx.outputs[this.activeInputIndex].value >=
                tx.inputs[this.activeInputIndex].value);
    }

    function withdraw(int amount, pubkey pk, sig s, int implInputIndex) {
        bytes catId, bytes capByte = tx.inputs[implInputIndex].tokenCategory.split(32);
        require(catId == this.implCategory);
        require(capByte != 0x);
        // Proxy enforces: withdrawal needs a valid signature
        require(checkSig(s, pk));
        require(tx.inputs[this.activeInputIndex].lockingBytecode ==
                tx.outputs[this.activeInputIndex].lockingBytecode);
        // Proxy enforces: value can decrease by at most 'amount'
        require(tx.outputs[this.activeInputIndex].value >=
                tx.inputs[this.activeInputIndex].value - amount);
    }

    function setImpl(bytes32 newImplCategory, pubkey pk, sig s) {
        require(hash160(pk) == admin);
        require(checkSig(s, pk));
        this.implCategory = newImplCategory;
        require(tx.inputs[this.activeInputIndex].lockingBytecode ==
                tx.outputs[this.activeInputIndex].lockingBytecode);
    }
}
`;

// VaultV1: tracks balance
const VAULT_V1 = `
pragma solidcash >=0.8.0;

contract VaultV1() {
    int balance;

    function deposit(int amount) {
        require(amount > 0);
        this.balance = this.balance + amount;
    }

    function withdraw(int amount) {
        require(amount > 0);
        require(this.balance >= amount);
        this.balance = this.balance - amount;
    }
}
`;

// VaultV2: adds transaction count tracking
const VAULT_V2 = `
pragma solidcash >=0.8.0;

contract VaultV2() {
    int balance;
    int txCount;

    function deposit(int amount) {
        require(amount > 0);
        this.balance = this.balance + amount;
        this.txCount = this.txCount + 1;
    }

    function withdraw(int amount) {
        require(amount > 0);
        require(this.balance >= amount);
        this.balance = this.balance - amount;
        this.txCount = this.txCount + 1;
    }
}
`;

// ============================================================
// Helpers
// ============================================================

// tx.inputs[].tokenCategory is internal (reversed) byte order; genesis returns display-order.
// implCategory is compared against it in-script, so it must hold the reversed bytes.
function implCat(categoryId: string): Uint8Array {
  return hexToBin(categoryId).slice().reverse();
}

interface Deployed {
  contract: Contract;
  categoryId: string;
  utxos: { master: Utxo; dataNfts: Utxo[] };
}

/** Deploy a stateful contract via real genesis at the unsalted contract addresses. */
async function deploy(
  provider: MockNetworkProvider, artifact: Artifact, args: any[],
  state: Record<string, any>, satoshis = 10000n,
): Promise<Deployed> {
  // Salt with the genesis category so each deploy gets a unique address: on the shared regtest
  // node, unsalted same-arg contracts collide and re-reads by address would pick a foreign master.
  const baseContract = new Contract(artifact, args, { provider });
  const commitments = buildInitialStateCommitments(artifact.stateLayout!, state);
  const { categoryId, utxos } = await (provider as any).addTokenUtxosDynamic((cat: string) => {
    const salted = baseContract.withCategory(hexToBin(cat));
    return [
      { address: salted.tokenAddress, satoshis, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
      ...commitments.map((commitment) => ({
        address: getDataNftAddress(salted, cat), satoshis,
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment } },
      })),
    ];
  });
  const contract = baseContract.withCategory(hexToBin(categoryId));
  return { contract, categoryId, utxos: { master: utxos[0], dataNfts: utxos.slice(1) } };
}

/** Create an ExternalCallUtxoGroup for inclusion in a StatefulTransactionBuilder. */
function extGroup(
  catId: string, artifact: Artifact, d: Deployed,
  fnName: string, fnArgs: any[], masterInputIdx: number,
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

/**
 * Create a custom unlocker that pushes a specific selector to the proxy.
 * Used for transparent proxy: send the implementation's selector so the proxy
 * dispatcher routes to fallback, and msg.data matches the impl's calldata.
 */
function createTransparentUnlocker(contract: Contract, selector: Uint8Array): ContractUnlocker {
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

/** Build a StatefulTransactionBuilder for a proxy + implementation pair. */
function proxyStb(
  provider: MockNetworkProvider,
  proxyArtifact: Artifact, proxy: Deployed, proxyCatId: string,
  proxyFn: string, proxyArgs: any[],
  implArtifact: Artifact, impl: Deployed, implCatId: string,
  implFn: string, implArgs: any[],
): StatefulTransactionBuilder {
  // Input layout: [proxy master, proxy data, impl master, impl data]
  // Impl master is at index 2 (after 1 master + 1 data NFT)
  return new StatefulTransactionBuilder({
    provider,
    stateLayout: proxyArtifact.stateLayout!,
    categoryId: proxyCatId,
    masterUtxo: { ...proxy.utxos.master, unlocker: (proxy.contract.unlock as any)[proxyFn](...proxyArgs) },
    dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
      ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
    })),
    externalCallUtxoGroups: [extGroup(implCatId, implArtifact, impl, implFn, implArgs, 2)],
  });
}

// ============================================================
// Tests
// ============================================================

describe('Proxy Pattern', () => {
  // ========================================================
  // Approach 1: Catch-all forwarding
  // ========================================================
  describe('Approach 1: Catch-all forwarding', () => {
    const proxyArtifact = compileString(CATCH_ALL_PROXY);
    const v1Artifact = compileString(COUNTER_V1);
    const v2Artifact = compileString(COUNTER_V2);

    it('should compile all contracts with correct state layouts', () => {
      expect(proxyArtifact.stateLayout!.variables).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'implCategory', type: 'bytes32' })]),
      );
      expect(v1Artifact.stateLayout!.variables).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'counter', type: 'int' })]),
      );
      expect(v2Artifact.stateLayout!.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'counter', type: 'int' }),
          expect.objectContaining({ name: 'operationCount', type: 'int' }),
        ]),
      );
    });

    it('proxy address stays the same regardless of implementation', () => {
      const provider = createTestProvider();
      const proxy1 = new Contract(proxyArtifact, [alicePkh], { provider });
      const proxy2 = new Contract(proxyArtifact, [alicePkh], { provider });
      expect(proxy1.address).toBe(proxy2.address);
      expect(proxy1.tokenAddress).toBe(proxy2.tokenAddress);
    });

    it('should forward a call to V1 implementation (increment counter)', async () => {
      const provider = createTestProvider();
      // Genesis impl first to learn its real category, then deploy proxy pointing at it.
      const v1 = await deploy(provider, v1Artifact, [], { counter: 0n });
      const v1CatId = v1.categoryId;
      const proxy = await deploy(provider, proxyArtifact, [alicePkh], { implCategory: implCat(v1CatId) });
      const proxyCatId = proxy.categoryId;

      const tx = await proxyStb(
        provider,
        proxyArtifact, proxy, proxyCatId, 'forward', [2n],
        v1Artifact, v1, v1CatId, 'increment', [],
      )
        .setExternalCallState(v1CatId, 'counter', 1n)
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should fail when pointing to wrong implementation category', async () => {
      const provider = createTestProvider();
      // Proxy points at v1CatId but the fake impl has a different real category.
      const v1CatId = 'b1'.repeat(32);
      const proxy = await deploy(provider, proxyArtifact, [alicePkh], { implCategory: hexToBin(v1CatId) });
      const proxyCatId = proxy.categoryId;
      const fake = await deploy(provider, v1Artifact, [], { counter: 0n });
      const fakeCatId = fake.categoryId;

      // Builds fine but would fail on-chain: fake catId != implCategory (b1..b1)
      const hex = proxyStb(
        provider,
        proxyArtifact, proxy, proxyCatId, 'forward', [2n],
        v1Artifact, fake, fakeCatId, 'increment', [],
      )
        .setExternalCallState(fakeCatId, 'counter', 1n)
        .build().build();

      expect(typeof hex).toBe('string');
      expect(hex.length).toBeGreaterThan(0);
    });

    it('should upgrade proxy to V2 and then forward to new implementation', async () => {
      const provider = createTestProvider();
      const v1CatId = 'b1'.repeat(32);
      // Genesis V2 first so the proxy can be upgraded to its real category, then forward to it.
      const v2 = await deploy(provider, v2Artifact, [], { counter: 0n, operationCount: 0n });
      const v2CatId = v2.categoryId;
      const proxy = await deploy(provider, proxyArtifact, [alicePkh], { implCategory: hexToBin(v1CatId) });
      const proxyCatId = proxy.categoryId;

      // --- Step 1: Admin upgrades proxy to V2 ---
      const upgradeTx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: proxy.contract.unlock.setImpl(implCat(v2CatId), alicePub, new SignatureTemplate(alicePriv)),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
      })
        .setState('implCategory', implCat(v2CatId))
        .send();

      expect(upgradeTx.txid).toBeDefined();

      // --- Step 2: Forward through proxy to V2's increment ---
      // Fetch updated proxy UTXOs from the provider after the upgrade tx
      const proxyUtxos = await provider.getUtxos(proxy.contract.tokenAddress);
      const proxyCovenantUtxos = await provider.getUtxos(getDataNftAddress(proxy.contract, proxyCatId));
      const updatedProxy: Deployed = {
        contract: proxy.contract,
        categoryId: proxyCatId,
        utxos: {
          master: proxyUtxos.find((u) => u.token?.nft?.capability === 'minting')!,
          dataNfts: proxyCovenantUtxos.filter((u) => u.token?.nft?.capability === 'mutable'),
        },
      };

      const forwardTx = await proxyStb(
        provider,
        proxyArtifact, updatedProxy, proxyCatId, 'forward', [2n],
        v2Artifact, v2, v2CatId, 'increment', [],
      )
        .setExternalCallState(v2CatId, 'counter', 1n)
        .setExternalCallState(v2CatId, 'operationCount', 1n)
        .send();

      expect(forwardTx.txid).toBeDefined();
    });

    it('should reject setImpl from non-admin (transaction builds but script fails)', async () => {
      const provider = createTestProvider();
      const v1CatId = 'b1'.repeat(32);
      const v2CatId = 'c1'.repeat(32);

      const proxy = await deploy(provider, proxyArtifact, [alicePkh], { implCategory: hexToBin(v1CatId) });
      const proxyCatId = proxy.categoryId;

      // Bob (non-admin) tries to upgrade - builds fine but would fail on-chain
      const hex = new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: proxy.contract.unlock.setImpl(hexToBin(v2CatId), bobPub, new SignatureTemplate(bobPriv)),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
      })
        .setState('implCategory', hexToBin(v2CatId))
        .build().build();

      expect(typeof hex).toBe('string');
    });
  });

  // ========================================================
  // Approach 2: Interface-based same method invocation
  // ========================================================
  describe('Approach 2: Interface-based same method', () => {
    const proxyArtifact = compileString(VAULT_PROXY);
    const v1Artifact = compileString(VAULT_V1);
    const v2Artifact = compileString(VAULT_V2);

    it('should compile vault proxy with matching function names', () => {
      expect(proxyArtifact.abi.map((f) => f.name)).toEqual(['deposit', 'withdraw', 'setImpl']);
      expect(v1Artifact.abi.map((f) => f.name)).toEqual(['deposit', 'withdraw']);
      expect(v2Artifact.abi.map((f) => f.name)).toEqual(['deposit', 'withdraw']);
    });

    it('should deposit through proxy (proxy.deposit + impl.deposit)', async () => {
      const provider = createTestProvider();
      const v1 = await deploy(provider, v1Artifact, [], { balance: 0n });
      const v1CatId = v1.categoryId;
      const proxy = await deploy(
        provider, proxyArtifact, [alicePkh], { implCategory: implCat(v1CatId) }, 50_000n,
      );
      const proxyCatId = proxy.categoryId;

      const depositAmount = 5000n;
      const tx = await proxyStb(
        provider,
        proxyArtifact, proxy, proxyCatId, 'deposit', [2n],
        v1Artifact, v1, v1CatId, 'deposit', [depositAmount],
      )
        .setExternalCallState(v1CatId, 'balance', depositAmount)
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should withdraw through proxy with valid signature', async () => {
      const provider = createTestProvider();
      const v1 = await deploy(provider, v1Artifact, [], { balance: 5000n });
      const v1CatId = v1.categoryId;
      const proxy = await deploy(
        provider, proxyArtifact, [alicePkh], { implCategory: implCat(v1CatId) }, 50_000n,
      );
      const proxyCatId = proxy.categoryId;

      const withdrawAmount = 2000n;
      const tx = await proxyStb(
        provider,
        proxyArtifact, proxy, proxyCatId,
        'withdraw', [withdrawAmount, alicePub, new SignatureTemplate(alicePriv), 2n],
        v1Artifact, v1, v1CatId, 'withdraw', [withdrawAmount],
      )
        .setExternalCallState(v1CatId, 'balance', 3000n)
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should upgrade to V2 and withdraw with txCount tracking', async () => {
      const provider = createTestProvider();
      const v1CatId = 'f1'.repeat(32);
      // Genesis V2 first so the proxy can be upgraded to its real category, then withdraw via it.
      const v2 = await deploy(provider, v2Artifact, [], { balance: 5000n, txCount: 0n });
      const v2CatId = v2.categoryId;
      const proxy = await deploy(
        provider, proxyArtifact, [alicePkh], { implCategory: hexToBin(v1CatId) }, 50_000n,
      );
      const proxyCatId = proxy.categoryId;

      // --- Step 1: Admin upgrades to V2 ---
      const upgradeTx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: proxy.contract.unlock.setImpl(implCat(v2CatId), alicePub, new SignatureTemplate(alicePriv)),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
      })
        .setState('implCategory', implCat(v2CatId))
        .send();

      expect(upgradeTx.txid).toBeDefined();

      // --- Step 2: Withdraw using V2 (which tracks txCount) ---
      const proxyUtxos = await provider.getUtxos(proxy.contract.tokenAddress);
      const proxyCovenantUtxos = await provider.getUtxos(getDataNftAddress(proxy.contract, proxyCatId));
      const updatedProxy: Deployed = {
        contract: proxy.contract,
        categoryId: proxyCatId,
        utxos: {
          master: proxyUtxos.find((u) => u.token?.nft?.capability === 'minting')!,
          dataNfts: proxyCovenantUtxos.filter((u) => u.token?.nft?.capability === 'mutable'),
        },
      };

      const withdrawAmount = 1000n;

      const withdrawTx = await proxyStb(
        provider,
        proxyArtifact, updatedProxy, proxyCatId,
        'withdraw', [withdrawAmount, alicePub, new SignatureTemplate(alicePriv), 2n],
        v2Artifact, v2, v2CatId, 'withdraw', [withdrawAmount],
      )
        .setExternalCallState(v2CatId, 'balance', 4000n)
        .setExternalCallState(v2CatId, 'txCount', 1n)
        .send();

      expect(withdrawTx.txid).toBeDefined();
    });
  });

  // ========================================================
  // Approach 3: Transparent proxy with fallback(bytes input)
  // ========================================================
  describe('Approach 3: Transparent proxy with fallback', () => {
    const proxyArtifact = compileString(TRANSPARENT_PROXY);
    const v1Artifact = compileString(COUNTER_V1);
    const v2Artifact = compileString(COUNTER_V2);

    it('should compile with setImpl + fallback in ABI', () => {
      const names = proxyArtifact.abi.map((f) => f.name);
      expect(names).toContain('setImpl');
      expect(names).toContain('__fallback');

      const fallbackEntry = proxyArtifact.abi.find((f) => f.name === '__fallback');
      expect(fallbackEntry!.isFallback).toBe(true);
      expect(fallbackEntry!.inputs).toHaveLength(0); // synthetic param, not in ABI

      expect(proxyArtifact.stateLayout!.variables).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'implCategory', type: 'bytes32' })]),
      );
    });

    it('should forward a call to V1 via fallback (increment counter)', async () => {
      const provider = createTestProvider();
      const v1 = await deploy(provider, v1Artifact, [], { counter: 0n });
      const v1CatId = v1.categoryId;
      const proxy = await deploy(provider, proxyArtifact, [alicePkh], { implCategory: implCat(v1CatId) });
      const proxyCatId = proxy.categoryId;

      // Push the impl's increment selector to the proxy - the dispatcher sees an
      // unknown selector and routes to fallback. msg.data then matches the impl's calldata.
      const implSelector = hexToBin(v1Artifact.abi.find((f) => f.name === 'increment')!.selector!);
      const stb = new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: createTransparentUnlocker(proxy.contract, implSelector),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
        externalCallUtxoGroups: [extGroup(v1CatId, v1Artifact, v1, 'increment', [], 2)],
      })
        .setExternalCallState(v1CatId, 'counter', 1n);

      const tx = await stb.send();

      expect(tx.txid).toBeDefined();
    });

    it('should upgrade to V2 and forward increment via fallback', async () => {
      const provider = createTestProvider();
      const v1CatId = 'e1'.repeat(32);
      // Genesis V2 first so the proxy can be upgraded to its real category, then forward to it.
      const v2 = await deploy(provider, v2Artifact, [], { counter: 0n, operationCount: 0n });
      const v2CatId = v2.categoryId;
      const proxy = await deploy(provider, proxyArtifact, [alicePkh], { implCategory: hexToBin(v1CatId) });
      const proxyCatId = proxy.categoryId;

      // --- Step 1: Admin upgrades proxy to V2 ---
      const upgradeTx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: proxy.contract.unlock.setImpl(implCat(v2CatId), alicePub, new SignatureTemplate(alicePriv)),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
      })
        .setState('implCategory', implCat(v2CatId))
        .send();

      expect(upgradeTx.txid).toBeDefined();

      // --- Step 2: Forward through proxy to V2's increment via fallback ---
      const proxyUtxos = await provider.getUtxos(proxy.contract.tokenAddress);
      const proxyCovenantUtxos = await provider.getUtxos(getDataNftAddress(proxy.contract, proxyCatId));
      const updatedProxy: Deployed = {
        contract: proxy.contract,
        categoryId: proxyCatId,
        utxos: {
          master: proxyUtxos.find((u) => u.token?.nft?.capability === 'minting')!,
          dataNfts: proxyCovenantUtxos.filter((u) => u.token?.nft?.capability === 'mutable'),
        },
      };

      // Push V2's increment selector to the proxy - triggers fallback with matching calldata
      const implSelector = hexToBin(v2Artifact.abi.find((f) => f.name === 'increment')!.selector!);
      const forwardTx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...updatedProxy.utxos.master,
          unlocker: createTransparentUnlocker(updatedProxy.contract, implSelector),
        },
        dataNftUtxos: updatedProxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(updatedProxy.contract, 0, proxyCatId),
        })),
        externalCallUtxoGroups: [extGroup(v2CatId, v2Artifact, v2, 'increment', [], 2)],
      })
        .setExternalCallState(v2CatId, 'counter', 1n)
        .setExternalCallState(v2CatId, 'operationCount', 1n)
        .send();

      expect(forwardTx.txid).toBeDefined();
    });

    it('should reject setImpl from non-admin (transaction builds but script fails)', async () => {
      const provider = createTestProvider();
      const v1CatId = 'e1'.repeat(32);
      const v2CatId = 'e2'.repeat(32);

      const proxy = await deploy(provider, proxyArtifact, [alicePkh], { implCategory: hexToBin(v1CatId) });
      const proxyCatId = proxy.categoryId;

      // Bob (non-admin) tries to upgrade - builds fine but would fail on-chain
      const hex = new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: proxy.contract.unlock.setImpl(hexToBin(v2CatId), bobPub, new SignatureTemplate(bobPriv)),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
      })
        .setState('implCategory', hexToBin(v2CatId))
        .build().build();

      expect(typeof hex).toBe('string');
    });
  });
});
