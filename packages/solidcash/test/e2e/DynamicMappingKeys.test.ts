import { compileString } from '../direct-compile.js';
import {
  Contract, StatefulContract,
} from '../../src/index.js';
import {
  alicePkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

// ===== Contract Sources =====

// Standard mapping with parameter key (backward compat)
const PARAM_KEY_CONTRACT = `
pragma solidcash >=0.8.0;

contract ParamKeyMapping() {
    bigint counter;
    mapping(bytes20 => bigint) balances;

    function setBalance(bytes20 key, bigint amount) {
        this.balances[key] = amount;
        this.counter = this.counter + 1;
    }

    function getBalance(bytes20 key) {
        bigint bal = this.balances[key];
        require(bal > 0);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Mapping with state variable key
const STATE_KEY_CONTRACT = `
pragma solidcash >=0.8.0;

contract StateKeyMapping() {
    bytes20 admin;
    mapping(bytes20 => bigint) balances;

    function deposit(bytes20 user, bigint amount) {
        this.balances[user] = this.balances[user] + amount;
    }

    function transferFromAdmin(bytes20 to, bigint amount) {
        bigint adminBal = this.balances[this.admin];
        require(adminBal >= amount);
        this.balances[this.admin] = adminBal - amount;
        this.balances[to] = this.balances[to] + amount;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Mapping with computed expression key (local variable)
const EXPRESSION_KEY_CONTRACT = `
pragma solidcash >=0.8.0;

contract ExpressionKeyMapping() {
    bigint counter;
    mapping(bigint => bigint) data;

    function setDerived(bigint base, bigint value) {
        bigint derived = base + 1;
        this.data[derived] = value;
        this.counter = this.counter + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// ---------- Tests ----------

describe('Dynamic Mapping Keys', () => {
  // ---------- Param Key Artifact Tests (backward compat) ----------

  describe('param key mapping (backward compat)', () => {
    const artifact = compileString(PARAM_KEY_CONTRACT);

    it('artifact should have entryAccesses with param keySources', () => {
      const abiFunction = artifact.abi.find((f) => f.name === 'setBalance');
      expect(abiFunction).toBeDefined();
      expect(abiFunction!.entryAccesses).toBeDefined();
      expect(abiFunction!.entryAccesses).toHaveLength(1);
      expect(abiFunction!.entryAccesses![0].collection).toBe('balances');
      expect(abiFunction!.entryAccesses![0].keyParams).toEqual(['key']);
      // keySources should not be present for pure param keys (backward compat)
      expect(abiFunction!.entryAccesses![0].keySources).toBeUndefined();
    });

    it('getBalance should also have param key entryAccesses', () => {
      const abiFunction = artifact.abi.find((f) => f.name === 'getBalance');
      expect(abiFunction).toBeDefined();
      expect(abiFunction!.entryAccesses).toBeDefined();
      expect(abiFunction!.entryAccesses).toHaveLength(1);
      expect(abiFunction!.entryAccesses![0].keyParams).toEqual(['key']);
      expect(abiFunction!.entryAccesses![0].operations).toContain('read');
    });

    it('should write entry via StatefulContract API', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      const stateLayout = artifact.stateLayout!;
      const { categoryId } = await setupStatefulUtxos(
        provider, contract, stateLayout, { counter: 0n }, { saltContract: true },
      );

      const sc = StatefulContract.withCategory(contract, categoryId);
      const key = alicePkh;
      const amount = 100n;

      const tx = await sc.setBalance(key, amount)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      const entries = await sc.getEntries('balances');
      expect(entries).toHaveLength(1);
      expect(entries[0].value).toBe(amount);
    });
  });

  // ---------- State Key Artifact Tests ----------

  describe('state key mapping', () => {
    const artifact = compileString(STATE_KEY_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    it('artifact should have keySources with state kind for transferFromAdmin', () => {
      const transferFn = artifact.abi.find((f) => f.name === 'transferFromAdmin');
      expect(transferFn).toBeDefined();
      expect(transferFn!.entryAccesses).toBeDefined();

      // Should have two entry accesses: balances[this.admin] and balances[to]
      expect(transferFn!.entryAccesses!.length).toBeGreaterThanOrEqual(2);

      // Find the state-key access (this.admin)
      const stateKeyAccess = transferFn!.entryAccesses!.find(
        (ea) => ea.keySources && ea.keySources.some((ks) => ks.kind === 'state'),
      );
      expect(stateKeyAccess).toBeDefined();
      expect(stateKeyAccess!.keySources).toBeDefined();
      expect(stateKeyAccess!.keySources![0].kind).toBe('state');
      expect(stateKeyAccess!.keySources![0].stateVarName).toBe('admin');

      // Find the param-key access (to)
      const paramKeyAccess = transferFn!.entryAccesses!.find(
        (ea) => ea.keyParams.includes('to'),
      );
      expect(paramKeyAccess).toBeDefined();
    });

    it('should compile with state-key read and write', () => {
      expect(artifact.bytecode).toBeDefined();
      expect(artifact.bytecode.length).toBeGreaterThan(0);
    });

    it('deposit function should still use param keys', () => {
      const depositFn = artifact.abi.find((f) => f.name === 'deposit');
      expect(depositFn).toBeDefined();
      expect(depositFn!.entryAccesses).toBeDefined();
      expect(depositFn!.entryAccesses).toHaveLength(1);
      expect(depositFn!.entryAccesses![0].keyParams).toEqual(['user']);
    });

    it('should auto-resolve state key from on-chain state', async () => {
      const scProvider = createTestProvider();
      const scContract = new Contract(artifact, [], { provider: scProvider });
      // Setup: admin = alicePkh
      const { categoryId } = await setupStatefulUtxos(
        scProvider, scContract, stateLayout, { admin: alicePkh }, { saltContract: true },
      );

      const sc = StatefulContract.withCategory(scContract, categoryId);

      // Verify admin state is readable and correct
      const state = await sc.getState();
      expect(state.admin).toEqual(alicePkh);
      const fullState = await sc.getFullState();
      expect(fullState.masterUtxo).toBeDefined();
      expect(fullState.dataNftUtxos).toHaveLength(1);
    });
  });

  // ---------- Expression Key Tests ----------

  describe('expression key mapping', () => {
    const artifact = compileString(EXPRESSION_KEY_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    it('artifact should have keySources with expression kind', () => {
      const setDerivedFn = artifact.abi.find((f) => f.name === 'setDerived');
      expect(setDerivedFn).toBeDefined();
      expect(setDerivedFn!.entryAccesses).toBeDefined();
      expect(setDerivedFn!.entryAccesses).toHaveLength(1);

      const access = setDerivedFn!.entryAccesses![0];
      expect(access.collection).toBe('data');
      expect(access.keySources).toBeDefined();
      expect(access.keySources![0].kind).toBe('expression');
      expect(access.keySources![0].expressionLabel).toBeDefined();
    });

    it('should compile successfully with expression keys', () => {
      expect(artifact.bytecode).toBeDefined();
      expect(artifact.bytecode.length).toBeGreaterThan(0);
    });

    it('should auto-resolve expression key without withEntryKey() for new entries', async () => {
      const scProvider = createTestProvider();
      const scContract = new Contract(artifact, [], { provider: scProvider });
      const { categoryId } = await setupStatefulUtxos(
        scProvider, scContract, stateLayout, { counter: 0n }, { saltContract: true },
      );

      const sc = StatefulContract.withCategory(scContract, categoryId);

      // Without withEntryKey(), auto-derivation should handle new entry creation
      // base=5, derived=5+1=6, value=42
      const tx = await sc.setDerived(5n, 42n).send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Master output preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);
    });

    it('should succeed with withEntryKey()', async () => {
      const scProvider = createTestProvider();
      const scContract = new Contract(artifact, [], { provider: scProvider });
      const { categoryId } = await setupStatefulUtxos(
        scProvider, scContract, stateLayout, { counter: 0n }, { saltContract: true },
      );

      const sc = StatefulContract.withCategory(scContract, categoryId);

      // base=5, derived=5+1=6, value=42
      const derivedKey = 6n;
      const tx = await sc.setDerived(5n, 42n)
        .withEntryKey(0, derivedKey)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Output 0: master UTXO preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);
    });
  });

  // ---------- withEntryKey API Tests ----------

  describe('withEntryKey API', () => {
    it('should be chainable and send successfully', async () => {
      const provider = createTestProvider();
      const artifact = compileString(EXPRESSION_KEY_CONTRACT);
      const contract = new Contract(artifact, [], { provider });
      const stateLayout = artifact.stateLayout!;
      const { categoryId } = await setupStatefulUtxos(
        provider, contract, stateLayout, { counter: 0n }, { saltContract: true },
      );

      const sc = StatefulContract.withCategory(contract, categoryId);
      // withEntryKey provides the expression key; state and entry are auto-derived
      const tx = await sc.setDerived(5n, 42n)
        .withEntryKey(0, 6n)
        .send();

      expect(tx.txid).toBeDefined();
    });
  });

  // ---------- Compilation Tests ----------

  describe('mixed key types in single contract', () => {
    it('should compile a contract with both param and state keys', () => {
      const source = `
        pragma solidcash >=0.8.0;

        contract MixedKeys() {
            bytes20 owner;
            mapping(bytes20 => bigint) balances;

            function deposit(bytes20 user, bigint amount) {
                this.balances[user] = this.balances[user] + amount;
            }

            function withdrawToOwner(bytes20 from, bigint amount) {
                bigint bal = this.balances[from];
                require(bal >= amount);
                this.balances[from] = bal - amount;
                this.balances[this.owner] = this.balances[this.owner] + amount;
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
      expect(artifact.bytecode.length).toBeGreaterThan(0);

      const withdrawFn = artifact.abi.find((f) => f.name === 'withdrawToOwner');
      expect(withdrawFn).toBeDefined();
      expect(withdrawFn!.entryAccesses).toBeDefined();
      // Should have entries for both param key (from) and state key (this.owner)
      expect(withdrawFn!.entryAccesses!.length).toBeGreaterThanOrEqual(2);
    });

    it('should compile a contract with literal key', () => {
      const source = `
        pragma solidcash >=0.8.0;

        contract LiteralKey() {
            mapping(bigint => bigint) config;

            function getConfig() {
                bigint val = this.config[42];
                require(val > 0);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
      expect(artifact.bytecode.length).toBeGreaterThan(0);

      const getConfigFn = artifact.abi.find((f) => f.name === 'getConfig');
      expect(getConfigFn).toBeDefined();
      expect(getConfigFn!.entryAccesses).toBeDefined();
      expect(getConfigFn!.entryAccesses).toHaveLength(1);

      const access = getConfigFn!.entryAccesses![0];
      expect(access.keySources).toBeDefined();
      // A literal key is a CONSTANT key source: the SDK matches the entry directly (the 'expression'
      // placeholder route cannot locate an existing entry on a pure read).
      expect(access.keySources![0].kind).toBe('constant');
    });

    it('should compile a contract with hash160 computed key', () => {
      const source = `
        pragma solidcash >=0.8.0;

        contract ComputedKey() {
            mapping(bytes20 => bigint) balances;

            function deposit(pubkey pk) {
                bytes20 pkh = hash160(pk);
                this.balances[pkh] = this.balances[pkh] + 1;
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
      expect(artifact.bytecode.length).toBeGreaterThan(0);

      const depositFn = artifact.abi.find((f) => f.name === 'deposit');
      expect(depositFn).toBeDefined();
      expect(depositFn!.entryAccesses).toBeDefined();
      expect(depositFn!.entryAccesses).toHaveLength(1);

      const access = depositFn!.entryAccesses![0];
      expect(access.keySources).toBeDefined();
      expect(access.keySources![0].kind).toBe('expression');
    });
  });
});
