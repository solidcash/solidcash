import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider, SignatureTemplate,
  StatefulContract,
  StatefulTransactionBuilder,
  getDataNftAddress, createDataNftUnlocker,
} from '../../src/index.js';
import { Artifact, buildInitialStateCommitments, parsePushdataCommitment } from '@solidcash/utils';
import {
  alicePub, alicePriv,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';
import { ContractUnlocker, Utxo } from '../../src/interfaces.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createUnlockingBytecode, addressToLockScript } from '../../src/utils.js';

// ============================================================
// Contract Sources
// ============================================================

// Implementation contract with a `delegate` function.
// The `delegate` modifier injects a `_proxyMasterIndex` synthetic parameter
// and makes all `this.stateVar` accesses target the proxy's data NFTs
// (via PICK(_proxyMasterIndex)) instead of the implementation's own.
const DELEGATE_IMPL = `
pragma solidcash >=0.8.0;

contract DelegateImpl() {
    bigint counter;

    function increment() delegate {
        this.counter = this.counter + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Proxy contract whose fallback uses `.delegatecall()`.
// The compiler skips auto-covenant state verification for delegatecall
// functions (the delegate handles state verification), but keeps
// master self-preservation and minting NFT uniqueness.
const DELEGATECALL_PROXY = `
pragma solidcash >=0.8.0;

contract DelegatecallProxy() {
    bigint counter;

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }

    fallback(bytes input) external {
        address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}
`;

// A more complete delegate impl with multiple state writes
const DELEGATE_IMPL_MULTI = `
pragma solidcash >=0.8.0;

contract DelegateImplMulti() {
    bigint counter;
    bigint totalOps;

    function increment() delegate {
        this.counter = this.counter + 1;
        this.totalOps = this.totalOps + 1;
    }

    function decrement() delegate {
        require(this.counter > 0);
        this.counter = this.counter - 1;
        this.totalOps = this.totalOps + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Proxy with two state vars (matching multi-impl)
const DELEGATECALL_PROXY_MULTI = `
pragma solidcash >=0.8.0;

contract DelegatecallProxyMulti() {
    bigint counter;
    bigint totalOps;

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }

    fallback(bytes input) external {
        address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}
`;

// ---- Error case sources ----

const DELEGATE_PLUS_UNSAFE = `
pragma solidcash >=0.8.0;
contract Bad() {
    bigint x;
    function foo() delegate unsafe {
        this.x = 1;
    }
}
`;

const DELEGATE_PLUS_UPGRADE = `
pragma solidcash >=0.8.0;
contract Bad() {
    bigint x;
    function foo() delegate upgrade {
        this.x = 1;
    }
}
`;

const DELEGATE_NO_STATE = `
pragma solidcash >=0.8.0;
contract Bad() {
    function foo() delegate {
        require(true);
    }
}
`;

const DELEGATE_PLUS_SELFDESTRUCT = `
pragma solidcash >=0.8.0;
contract Bad() {
    bigint x;
    function foo() delegate selfdestruct {
        this.x = 1;
    }
}
`;

// ============================================================
// Helpers
// ============================================================

interface Deployed {
  contract: Contract;
  categoryId: string;
  utxos: { master: Utxo; dataNfts: Utxo[] };
}

/** Deploy a stateful contract: create Contract, build UTXOs, register with provider. */
async function deploy(
  provider: MockNetworkProvider, artifact: Artifact, args: any[],
  state: Record<string, any>, satoshis = 10000n,
): Promise<Deployed> {
  const contract = new Contract(artifact, args, { provider });
  const commitments = buildInitialStateCommitments(artifact.stateLayout!, state);
  // Real genesis at the unsalted contract addresses (matches the direct unlockers below).
  const { categoryId, utxos } = await (provider as any).addTokenUtxosDynamic((cat: string) => [
    { address: contract.tokenAddress, satoshis, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
    ...commitments.map((commitment) => ({
      address: getDataNftAddress(contract, cat), satoshis,
      token: { amount: 0n, nft: { capability: 'mutable' as const, commitment } },
    })),
  ]);
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
 * Create a custom unlocker for the delegatecall proxy's fallback.
 * Pushes the implementation's selector so the proxy dispatcher routes
 * to fallback, and msg.data matches the impl's calldata.
 */
function createDelegatecallUnlocker(contract: Contract, selector: Uint8Array): ContractUnlocker {
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

// ============================================================
// Tests
// ============================================================

describe('Delegatecall', () => {
  // ========================================================
  // Compilation and ABI metadata
  // ========================================================
  describe('Compilation and ABI metadata', () => {
    const implArtifact = compileString(DELEGATE_IMPL);
    const proxyArtifact = compileString(DELEGATECALL_PROXY);

    it('delegate function should have _proxyMasterIndex in ABI inputs', () => {
      const incrementAbi = implArtifact.abi.find((f) => f.name === 'increment')!;
      expect(incrementAbi).toBeDefined();
      expect(incrementAbi.inputs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '__internal__proxyMasterIndex', type: 'bigint' }),
        ]),
      );
    });

    it('delegate function should have delegate modifier in ABI', () => {
      const incrementAbi = implArtifact.abi.find((f) => f.name === 'increment')!;
      expect(incrementAbi.modifiers).toBeDefined();
      expect(incrementAbi.modifiers).toContain('delegate');
    });

    it('non-delegate function should not have delegate modifier', () => {
      const authorizeAbi = implArtifact.abi.find((f) => f.name === 'authorize')!;
      expect(authorizeAbi).toBeDefined();
      expect(authorizeAbi.modifiers).not.toContain('delegate');
      expect(authorizeAbi.modifiers).toContain('unsafe');
    });

    it('non-delegate function should not have _proxyMasterIndex', () => {
      const authorizeAbi = implArtifact.abi.find((f) => f.name === 'authorize')!;
      const paramNames = authorizeAbi.inputs.map((i) => i.name);
      expect(paramNames).not.toContain('__internal__proxyMasterIndex');
    });

    it('proxy fallback should have delegatecall in lowLevelCalls', () => {
      const fallbackAbi = proxyArtifact.abi.find((f) => f.name === '__fallback')!;
      expect(fallbackAbi).toBeDefined();
      expect(fallbackAbi.isFallback).toBe(true);
      expect(fallbackAbi.lowLevelCalls).toEqual([{ callMode: 'delegatecall' }]);
    });

    it('proxy fallback should have no user-visible inputs', () => {
      const fallbackAbi = proxyArtifact.abi.find((f) => f.name === '__fallback')!;
      expect(fallbackAbi.inputs).toHaveLength(0);
    });

    it('both contracts should have matching state layouts', () => {
      expect(implArtifact.stateLayout!.variables).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'counter', type: 'bigint' })]),
      );
      expect(proxyArtifact.stateLayout!.variables).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'counter', type: 'bigint' })]),
      );
    });

    it('multi-state delegate impl should compile with all delegate functions', () => {
      const multiArtifact = compileString(DELEGATE_IMPL_MULTI);
      const incrementAbi = multiArtifact.abi.find((f) => f.name === 'increment')!;
      const decrementAbi = multiArtifact.abi.find((f) => f.name === 'decrement')!;

      expect(incrementAbi.modifiers).toContain('delegate');
      expect(decrementAbi.modifiers).toContain('delegate');

      // Both should have _proxyMasterIndex
      expect(incrementAbi.inputs).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: '__internal__proxyMasterIndex' })]),
      );
      expect(decrementAbi.inputs).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: '__internal__proxyMasterIndex' })]),
      );

      // State layout should have both vars
      expect(multiArtifact.stateLayout!.variables).toHaveLength(2);
    });
  });

  // ========================================================
  // Compilation error cases
  // ========================================================
  describe('Compilation error cases', () => {
    it('should reject delegate + unsafe modifier combination', () => {
      expect(() => compileString(DELEGATE_PLUS_UNSAFE)).toThrow();
    });

    it('should reject delegate + upgrade modifier combination', () => {
      expect(() => compileString(DELEGATE_PLUS_UPGRADE)).toThrow();
    });

    it('should reject delegate + selfdestruct modifier combination', () => {
      expect(() => compileString(DELEGATE_PLUS_SELFDESTRUCT)).toThrow();
    });

    it('should reject delegate on non-stateful contract', () => {
      expect(() => compileString(DELEGATE_NO_STATE)).toThrow();
    });
  });

  // ========================================================
  // Proxy + Implementation transaction building
  // ========================================================
  describe('Proxy + Implementation transaction building', () => {
    const implArtifact = compileString(DELEGATE_IMPL);
    const proxyArtifact = compileString(DELEGATECALL_PROXY);

    it('should build proxy + impl delegatecall transaction', async () => {
      const provider = createTestProvider();
      const proxy = await deploy(provider, proxyArtifact, [], { counter: 0n });
      const impl = await deploy(provider, implArtifact, [], { counter: 0n });
      const proxyCatId = proxy.categoryId;
      const implCatId = impl.categoryId;

      // Get the impl's increment selector to send to the proxy's fallback
      const implSelector = hexToBin(implArtifact.abi.find((f) => f.name === 'increment')!.selector!);

      // Build tx: proxy (primary) + impl (external call group)
      // Input layout: [proxy master, proxy data, impl master, impl data]
      // _proxyMasterIndex = 0 (proxy master at input 0)
      // impl master at input 2 (after proxy's 1 master + 1 data NFT)
      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: createDelegatecallUnlocker(proxy.contract, implSelector),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
        externalCallUtxoGroups: [
          extGroup(implCatId, implArtifact, impl, 'increment', [0n], 2),
        ],
      })
        .setState('counter', 1n)
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should modify proxy state via delegate function', async () => {
      const provider = createTestProvider();
      const proxy = await deploy(provider, proxyArtifact, [], { counter: 5n });
      const impl = await deploy(provider, implArtifact, [], { counter: 0n });
      const proxyCatId = proxy.categoryId;
      const implCatId = impl.categoryId;

      const implSelector = hexToBin(implArtifact.abi.find((f) => f.name === 'increment')!.selector!);

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: createDelegatecallUnlocker(proxy.contract, implSelector),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
        externalCallUtxoGroups: [
          extGroup(implCatId, implArtifact, impl, 'increment', [0n], 2),
        ],
      })
        .setState('counter', 6n)
        .send();

      expect(tx.txid).toBeDefined();

      // Verify the proxy's output state reflects the new counter value
      const txOutputs = getTxOutputs(tx);
      const proxyDataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === proxyCatId,
      );
      expect(proxyDataNftOutput).toBeDefined();
      expect(proxyDataNftOutput!.token!.nft!.commitment).toBeDefined();

      const parsedState = parsePushdataCommitment(
        proxyDataNftOutput!.token!.nft!.commitment,
        proxyArtifact.stateLayout!,
        0,
      );
      expect(parsedState.counter).toBe(6n);
    });

    it('should preserve implementation NFTs in delegate transaction outputs', async () => {
      const provider = createTestProvider();
      const proxy = await deploy(provider, proxyArtifact, [], { counter: 0n });
      const impl = await deploy(provider, implArtifact, [], { counter: 0n });
      const proxyCatId = proxy.categoryId;
      const implCatId = impl.categoryId;

      const implSelector = hexToBin(implArtifact.abi.find((f) => f.name === 'increment')!.selector!);

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: createDelegatecallUnlocker(proxy.contract, implSelector),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
        externalCallUtxoGroups: [
          extGroup(implCatId, implArtifact, impl, 'increment', [0n], 2),
        ],
      })
        .setState('counter', 1n)
        .send();

      expect(tx.txid).toBeDefined();

      // Both proxy and impl minting NFTs should be in outputs
      const txOutputs = getTxOutputs(tx);
      const proxyMinting = txOutputs.find(
        (o) => o.token?.nft?.capability === 'minting' && o.token?.category === proxyCatId,
      );
      const implMinting = txOutputs.find(
        (o) => o.token?.nft?.capability === 'minting' && o.token?.category === implCatId,
      );
      expect(proxyMinting).toBeDefined();
      expect(implMinting).toBeDefined();

      // Impl data NFT should also be preserved
      const implDataNft = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === implCatId,
      );
      expect(implDataNft).toBeDefined();
    });
  });

  // ========================================================
  // Multi-state delegate transaction
  // ========================================================
  describe('Multi-state delegate transaction', () => {
    const implArtifact = compileString(DELEGATE_IMPL_MULTI);
    const proxyArtifact = compileString(DELEGATECALL_PROXY_MULTI);

    it('should build multi-state increment via delegate', async () => {
      const provider = createTestProvider();
      const proxy = await deploy(provider, proxyArtifact, [], { counter: 0n, totalOps: 0n });
      const impl = await deploy(provider, implArtifact, [], { counter: 0n, totalOps: 0n });
      const proxyCatId = proxy.categoryId;
      const implCatId = impl.categoryId;

      const implSelector = hexToBin(implArtifact.abi.find((f) => f.name === 'increment')!.selector!);

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: createDelegatecallUnlocker(proxy.contract, implSelector),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
        externalCallUtxoGroups: [
          extGroup(implCatId, implArtifact, impl, 'increment', [0n], 2),
        ],
      })
        .setState('counter', 1n)
        .setState('totalOps', 1n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const proxyDataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === proxyCatId,
      );
      expect(proxyDataNftOutput).toBeDefined();

      const parsedState = parsePushdataCommitment(
        proxyDataNftOutput!.token!.nft!.commitment,
        proxyArtifact.stateLayout!,
        0,
      );
      expect(parsedState.counter).toBe(1n);
      expect(parsedState.totalOps).toBe(1n);
    });

    it('should build multi-state decrement via delegate', async () => {
      const provider = createTestProvider();
      const proxy = await deploy(provider, proxyArtifact, [], { counter: 10n, totalOps: 5n });
      const impl = await deploy(provider, implArtifact, [], { counter: 0n, totalOps: 0n });
      const proxyCatId = proxy.categoryId;
      const implCatId = impl.categoryId;

      const implSelector = hexToBin(implArtifact.abi.find((f) => f.name === 'decrement')!.selector!);

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: createDelegatecallUnlocker(proxy.contract, implSelector),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
        externalCallUtxoGroups: [
          extGroup(implCatId, implArtifact, impl, 'decrement', [0n], 2),
        ],
      })
        .setState('counter', 9n)
        .setState('totalOps', 6n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const proxyDataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === proxyCatId,
      );
      expect(proxyDataNftOutput).toBeDefined();

      const parsedState = parsePushdataCommitment(
        proxyDataNftOutput!.token!.nft!.commitment,
        proxyArtifact.stateLayout!,
        0,
      );
      expect(parsedState.counter).toBe(9n);
      expect(parsedState.totalOps).toBe(6n);
    });
  });

  // ========================================================
  // Direct proxy operations (non-delegatecall paths)
  // ========================================================
  describe('Direct proxy operations', () => {
    const proxyArtifact = compileString(DELEGATECALL_PROXY);

    it('should build authorize (unsafe) transaction on proxy', async () => {
      const provider = createTestProvider();
      const proxy = await deploy(provider, proxyArtifact, [], { counter: 0n });
      const proxyCatId = proxy.categoryId;

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: proxy.contract.unlock.authorize(alicePub, new SignatureTemplate(alicePriv)),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
      }).send();

      expect(tx.txid).toBeDefined();
    });

    it('proxy authorize should preserve state (counter unchanged)', async () => {
      const provider = createTestProvider();
      const proxy = await deploy(provider, proxyArtifact, [], { counter: 42n });
      const proxyCatId = proxy.categoryId;

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: proxyArtifact.stateLayout!,
        categoryId: proxyCatId,
        masterUtxo: {
          ...proxy.utxos.master,
          unlocker: proxy.contract.unlock.authorize(alicePub, new SignatureTemplate(alicePriv)),
        },
        dataNftUtxos: proxy.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxyCatId),
        })),
      }).send();

      expect(tx.txid).toBeDefined();

      // State should be preserved (counter stays 42)
      const txOutputs = getTxOutputs(tx);
      const proxyDataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === proxyCatId,
      );
      expect(proxyDataNftOutput).toBeDefined();

      const parsedState = parsePushdataCommitment(
        proxyDataNftOutput!.token!.nft!.commitment,
        proxyArtifact.stateLayout!,
        0,
      );
      expect(parsedState.counter).toBe(42n);
    });
  });

  // ========================================================
  // Implementation standalone operations
  // ========================================================
  describe('Implementation standalone operations', () => {
    const implArtifact = compileString(DELEGATE_IMPL);

    it('should build authorize (unsafe) transaction on impl', async () => {
      const provider = createTestProvider();
      const impl = await deploy(provider, implArtifact, [], { counter: 0n });
      const implCatId = impl.categoryId;

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: implArtifact.stateLayout!,
        categoryId: implCatId,
        masterUtxo: {
          ...impl.utxos.master,
          unlocker: impl.contract.unlock.authorize(alicePub, new SignatureTemplate(alicePriv)),
        },
        dataNftUtxos: impl.utxos.dataNfts.map((nft) => ({
          ...nft, unlocker: createDataNftUnlocker(impl.contract, 0, implCatId),
        })),
      }).send();

      expect(tx.txid).toBeDefined();
    });
  });

  // ========================================================
  // Auto-derivation via withDelegatecall
  // ========================================================
  describe('Auto-derivation via withDelegatecall', () => {
    const implArtifact = compileString(DELEGATE_IMPL);
    const proxyArtifact = compileString(DELEGATECALL_PROXY);

    it('should auto-derive single state variable via delegatecall', async () => {
      const provider = createTestProvider();
      // Set up proxy + impl via real genesis
      const proxyContract = new Contract(proxyArtifact, [], { provider });
      const { categoryId: proxyCatId } = await setupStatefulUtxos(
        provider, proxyContract, proxyArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const implContract = new Contract(implArtifact, [], { provider });
      const { categoryId: implCatId } = await setupStatefulUtxos(
        provider, implContract, implArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );

      // Connect both as StatefulContract
      const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
      const implSc = StatefulContract.withCategory(implContract, implCatId);

      // Auto-derive: proxy.call['__fallback']().withDelegatecall(impl, 'increment', [])
      const tx = await proxySc.call.__fallback()
        .withDelegatecall(implSc, 'increment', [])
        .send();

      expect(tx.txid).toBeDefined();

      // Verify proxy state was updated (counter: 0 -> 1)
      const txOutputs = getTxOutputs(tx);
      const proxyDataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === proxyCatId,
      );
      expect(proxyDataNftOutput).toBeDefined();

      const parsedState = parsePushdataCommitment(
        proxyDataNftOutput!.token!.nft!.commitment, proxyArtifact.stateLayout!, 0,
      );
      expect(parsedState.counter).toBe(1n);
    });

    it('should auto-derive with non-zero initial state', async () => {
      const provider = createTestProvider();
      const proxyContract = new Contract(proxyArtifact, [], { provider });
      const { categoryId: proxyCatId } = await setupStatefulUtxos(
        provider, proxyContract, proxyArtifact.stateLayout!, { counter: 42n }, { saltContract: true },
      );
      const implContract = new Contract(implArtifact, [], { provider });
      const { categoryId: implCatId } = await setupStatefulUtxos(
        provider, implContract, implArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );

      const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
      const implSc = StatefulContract.withCategory(implContract, implCatId);

      const tx = await proxySc.call.__fallback()
        .withDelegatecall(implSc, 'increment', [])
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const proxyDataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === proxyCatId,
      );
      expect(proxyDataNftOutput).toBeDefined();

      const parsedState = parsePushdataCommitment(
        proxyDataNftOutput!.token!.nft!.commitment, proxyArtifact.stateLayout!, 0,
      );
      expect(parsedState.counter).toBe(43n);
    });

    it('should auto-derive multi-state via delegatecall', async () => {
      const multiImplArtifact = compileString(DELEGATE_IMPL_MULTI);
      const multiProxyArtifact = compileString(DELEGATECALL_PROXY_MULTI);

      const provider = createTestProvider();
      const proxyContract = new Contract(multiProxyArtifact, [], { provider });
      const { categoryId: proxyCatId } = await setupStatefulUtxos(
        provider, proxyContract, multiProxyArtifact.stateLayout!, { counter: 5n, totalOps: 10n }, { saltContract: true },
      );
      const implContract = new Contract(multiImplArtifact, [], { provider });
      const { categoryId: implCatId } = await setupStatefulUtxos(
        provider, implContract, multiImplArtifact.stateLayout!, { counter: 0n, totalOps: 0n }, { saltContract: true },
      );

      const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
      const implSc = StatefulContract.withCategory(implContract, implCatId);

      const tx = await proxySc.call.__fallback()
        .withDelegatecall(implSc, 'increment', [])
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const proxyDataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === proxyCatId,
      );
      expect(proxyDataNftOutput).toBeDefined();

      const parsedState = parsePushdataCommitment(
        proxyDataNftOutput!.token!.nft!.commitment, multiProxyArtifact.stateLayout!, 0,
      );
      expect(parsedState.counter).toBe(6n);
      expect(parsedState.totalOps).toBe(11n);
    });

    it('should preserve impl NFTs unchanged in delegatecall outputs', async () => {
      const provider = createTestProvider();
      const proxyContract = new Contract(proxyArtifact, [], { provider });
      const { categoryId: proxyCatId } = await setupStatefulUtxos(
        provider, proxyContract, proxyArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const implContract = new Contract(implArtifact, [], { provider });
      const { categoryId: implCatId } = await setupStatefulUtxos(
        provider, implContract, implArtifact.stateLayout!, { counter: 99n }, { saltContract: true },
      );

      const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
      const implSc = StatefulContract.withCategory(implContract, implCatId);

      const tx = await proxySc.call.__fallback()
        .withDelegatecall(implSc, 'increment', [])
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Impl data NFT should be preserved with original commitment (counter: 99)
      const implDataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === implCatId,
      );
      expect(implDataNftOutput).toBeDefined();

      const implParsedState = parsePushdataCommitment(
        implDataNftOutput!.token!.nft!.commitment, implArtifact.stateLayout!, 0,
      );
      expect(implParsedState.counter).toBe(99n);

      // Both minting NFTs should be preserved
      const proxyMinting = txOutputs.find(
        (o) => o.token?.nft?.capability === 'minting' && o.token?.category === proxyCatId,
      );
      const implMinting = txOutputs.find(
        (o) => o.token?.nft?.capability === 'minting' && o.token?.category === implCatId,
      );
      expect(proxyMinting).toBeDefined();
      expect(implMinting).toBeDefined();
    });
  });
});
