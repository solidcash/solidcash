import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import { ResolvedImport } from '@solidcash/utils';
import {
  Contract, StatefulTransactionBuilder,
  StateReader, SignatureTemplate,
  getDataNftAddress, createDataNftUnlocker,
} from '../../src/index.js';
import { Utxo } from '../../src/interfaces.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  alicePriv, alicePub,
} from '../fixture/vars.js';

// --- Helpers -------------------------------------------------------------

function normalizePath(p: string): string {
  const parts = p.split('/');
  const result: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..' && result.length > 0 && result[result.length - 1] !== '..') {
      result.pop();
    } else {
      result.push(part);
    }
  }
  return result.join('/');
}

function createMapResolver(files: Record<string, string>) {
  return (importPath: string, currentFile: string): ResolvedImport | undefined => {
    const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
    let resolved = normalizePath(dir + importPath);
    if (!resolved.endsWith('.scash')) resolved += '.scash';
    const source = files[resolved];
    if (source === undefined) return undefined;
    return { source, id: resolved };
  };
}

// --- Contract Definitions ------------------------------------------------

const MARKETPLACE_CONTRACT = `
contract MarketplaceV1() {
    function spend(pubkey pk, sig s) {
        require(checkSig(s, pk));
    }
}
`;

const ESCROW_CONTRACT = `
contract Escrow() {
    function release(pubkey pk, sig s) {
        require(checkSig(s, pk));
    }
}
`;

// Contract with a contract-typed state variable (Solidity order: type visibility name)
const TYPED_STATE_VAR_CONTRACT = `
import "./marketplace.scash";

contract Registry() {
    MarketplaceV1 public marketplace;

    constructor() {
        this.marketplace = MarketplaceV1(0x0000000000000000000000000000000000000000000000000000);
    }

    function setMarketplace(pubkey pk, sig s, bytes lbc) {
        require(checkSig(s, pk));
        this.marketplace = MarketplaceV1(lbc);
    }
}
`;

// Contract with multiple contract-typed state variables
const MULTI_TYPED_CONTRACT = `
import "./marketplace.scash";
import "./escrow.scash";

contract MultiRegistry() {
    MarketplaceV1 public marketplace;
    Escrow public escrow;
    int public counter;

    constructor() {
        this.marketplace = MarketplaceV1(0x0000000000000000000000000000000000000000000000000000);
        this.escrow = Escrow(0x0000000000000000000000000000000000000000000000000000);
        this.counter = 0;
    }

    function setMarketplace(pubkey pk, sig s, bytes lbc) {
        require(checkSig(s, pk));
        this.marketplace = MarketplaceV1(lbc);
        this.counter = this.counter + 1;
    }

    function setEscrow(pubkey pk, sig s, bytes lbc) {
        require(checkSig(s, pk));
        this.escrow = Escrow(lbc);
        this.counter = this.counter + 1;
    }
}
`;

// Contract using interface as type
const INTERFACE_TYPED_CONTRACT = `
interface IToken {
    function transfer(pubkey to, sig s, int amount);
}

contract TokenHolder() {
    IToken public token;

    constructor() {
        this.token = IToken(0x0000000000000000000000000000000000000000000000000000);
    }

    function setToken(pubkey pk, sig s, bytes lbc) {
        require(checkSig(s, pk));
        this.token = IToken(lbc);
    }
}
`;

// Contract with visibility-first order (traditional SolidCash)
const VISIBILITY_FIRST_CONTRACT = `
import "./marketplace.scash";

contract VisibilityFirst() {
    public MarketplaceV1 marketplace;

    constructor() {
        this.marketplace = MarketplaceV1(0x0000000000000000000000000000000000000000000000000000);
    }

    function update(pubkey pk, sig s, bytes lbc) {
        require(checkSig(s, pk));
        this.marketplace = MarketplaceV1(lbc);
    }
}
`;

// Contract with immutable contract-typed state variable
const IMMUTABLE_TYPED_CONTRACT = `
import "./marketplace.scash";

contract ImmutableRegistry() {
    MarketplaceV1 immutable marketplace;

    constructor() {
        this.marketplace = MarketplaceV1(0x0000000000000000000000000000000000000000000000000000);
    }

    function check(pubkey pk, sig s) {
        require(checkSig(s, pk));
    }
}
`;

// Contract with contract-typed state assigned from address parameter
const ADDRESS_ASSIGN_CONTRACT = `
import "./marketplace.scash";


contract AddressAssign() {
    MarketplaceV1 public marketplace;

    constructor() {
        this.marketplace = MarketplaceV1(0x0000000000000000000000000000000000000000000000000000);
    }

    function setFromAddress(pubkey pk, sig s, address addr) {
        require(checkSig(s, pk));
        this.marketplace = MarketplaceV1(addr);
    }
}
`;

const FILES: Record<string, string> = {
  '/marketplace.scash': MARKETPLACE_CONTRACT,
  '/escrow.scash': ESCROW_CONTRACT,
};

function compileWithImports(source: string, extraFiles: Record<string, string> = {}): ReturnType<typeof compileString> {
  return compileString(source, {
    importResolver: createMapResolver({ ...FILES, ...extraFiles }),
    rootFileId: '/main.scash',
  });
}

// --- Tests ---------------------------------------------------------------

describe('Contract-Typed State Variables', () => {
  // -- Compilation and artifact inspection ------------------------------

  describe('compilation', () => {
    it('should compile contract with contract-typed state variable', () => {
      const artifact = compileWithImports(TYPED_STATE_VAR_CONTRACT);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Registry');
      expect(artifact.bytecode).toBeDefined();
    });

    it('should have stateLayout with contractType field', () => {
      const artifact = compileWithImports(TYPED_STATE_VAR_CONTRACT);
      expect(artifact.stateLayout).toBeDefined();
      const sv = artifact.stateLayout!.variables[0];
      expect(sv.name).toBe('marketplace');
      expect(sv.type).toBe('address');
      expect(sv.contractType).toBe('MarketplaceV1');
      expect(sv.nftIndex).toBe(0);
      expect(sv.fieldIndex).toBe(0);
    });

    it('should have constructor inputs in stateLayout', () => {
      const artifact = compileWithImports(TYPED_STATE_VAR_CONTRACT);
      expect(artifact.stateLayout!.constructorInputs).toBeDefined();
    });

    it('should compile with multiple contract-typed state variables', () => {
      const artifact = compileWithImports(MULTI_TYPED_CONTRACT);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('MultiRegistry');
      const vars = artifact.stateLayout!.variables;
      expect(vars).toHaveLength(3);
      expect(vars[0].name).toBe('marketplace');
      expect(vars[0].type).toBe('address');
      expect(vars[0].contractType).toBe('MarketplaceV1');
      expect(vars[1].name).toBe('escrow');
      expect(vars[1].type).toBe('address');
      expect(vars[1].contractType).toBe('Escrow');
      expect(vars[2].name).toBe('counter');
      expect(vars[2].type).toBe('int256');
      expect(vars[2].contractType).toBeUndefined();
    });

    it('should compile with interface-typed state variable', () => {
      const artifact = compileString(INTERFACE_TYPED_CONTRACT);
      expect(artifact).toBeDefined();
      const sv = artifact.stateLayout!.variables[0];
      expect(sv.name).toBe('token');
      expect(sv.type).toBe('address');
      expect(sv.contractType).toBe('IToken');
    });

    it('should compile with visibility-first order (public before type)', () => {
      const artifact = compileWithImports(VISIBILITY_FIRST_CONTRACT);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('VisibilityFirst');
      const sv = artifact.stateLayout!.variables[0];
      expect(sv.name).toBe('marketplace');
      expect(sv.type).toBe('address');
      expect(sv.contractType).toBe('MarketplaceV1');
    });

    it('should compile with immutable contract-typed state variable', () => {
      const artifact = compileWithImports(IMMUTABLE_TYPED_CONTRACT);
      expect(artifact).toBeDefined();
      const sv = artifact.stateLayout!.variables[0];
      expect(sv.name).toBe('marketplace');
      expect(sv.type).toBe('address');
      expect(sv.contractType).toBe('MarketplaceV1');
      expect(sv.immutable).toBe(true);
    });

    it('should compile with address parameter assigned to contract-typed variable', () => {
      const artifact = compileWithImports(ADDRESS_ASSIGN_CONTRACT);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('AddressAssign');
    });

    it('should have dataNftCount of 1 for single contract-typed variable', () => {
      const artifact = compileWithImports(TYPED_STATE_VAR_CONTRACT);
      expect(artifact.stateLayout!.dataNftCount).toBe(1);
    });

    it('should have dataNftCount of 1 for mixed contract-typed and int variables', () => {
      const artifact = compileWithImports(MULTI_TYPED_CONTRACT);
      // All three variables (2 address + 1 int) fit on one data NFT
      expect(artifact.stateLayout!.dataNftCount).toBe(1);
    });
  });

  // -- State read/write with single contract-typed variable -------------

  describe('state read/write (single variable)', () => {
    const artifact = compileWithImports(TYPED_STATE_VAR_CONTRACT);
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;

    // Zero address (25 zero bytes for locking bytecode)
    const zeroAddr = new Uint8Array(25);

    let categoryId: string;
    let saltedContract: Contract;
    let dataNftAddress: string;
    let masterUtxo: Utxo;
    let dataNftUtxo: Utxo;

    beforeAll(async () => {
      const setup = await setupStatefulUtxos(
        provider, contract, stateLayout, { marketplace: zeroAddr }, { saltContract: true },
      );
      categoryId = setup.categoryId;
      saltedContract = contract.withCategory(hexToBin(categoryId));
      dataNftAddress = getDataNftAddress(saltedContract, categoryId);
      masterUtxo = setup.masterUtxo;
      dataNftUtxo = setup.dataNftUtxos[0];
    });

    it('should be marked as stateful', () => {
      expect(contract.isStateful).toBe(true);
    });

    it('should read initial state with zero address', () => {
      const reader = new StateReader(stateLayout);
      const state = reader.readState([dataNftUtxo]);
      expect(state.marketplace).toEqual(zeroAddr);
    });

    it('should update marketplace address via transaction', async () => {
      // New marketplace locking bytecode: P2SH-like 23 bytes
      const newLbc = hexToBin('a914' + 'ab'.repeat(20) + '87');

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout,
        categoryId,
        masterUtxo: {
          ...masterUtxo,
          unlocker: saltedContract.unlock.setMarketplace(alicePub, new SignatureTemplate(alicePriv), newLbc),
        },
        dataNftUtxos: [{ ...dataNftUtxo, unlocker: createDataNftUnlocker(saltedContract, 0, categoryId) }],
      })
        .setState('marketplace', newLbc)
        .send();

      expect(tx.txid).toBeDefined();

      // Verify the updated state
      const covenantUtxos = await provider.getUtxos(dataNftAddress);
      const updatedDataNft = covenantUtxos.find(
        (u) => u.token?.nft?.capability === 'mutable' && u.txid === tx.txid,
      )!;

      const reader = new StateReader(stateLayout);
      const newState = reader.readState([updatedDataNft]);
      expect(newState.marketplace).toEqual(newLbc);
    });
  });

  // -- State read/write with multiple variables -------------------------

  describe('state read/write (multiple variables)', () => {
    const artifact = compileWithImports(MULTI_TYPED_CONTRACT);
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;

    const zeroAddr = new Uint8Array(25);

    let categoryId: string;
    let saltedContract: Contract;
    let dataNftAddress: string;
    let masterUtxo: Utxo;
    let dataNftUtxo: Utxo;

    beforeAll(async () => {
      const setup = await setupStatefulUtxos(
        provider, contract, stateLayout,
        { marketplace: zeroAddr, escrow: zeroAddr, counter: 0n },
        { saltContract: true },
      );
      categoryId = setup.categoryId;
      saltedContract = contract.withCategory(hexToBin(categoryId));
      dataNftAddress = getDataNftAddress(saltedContract, categoryId);
      masterUtxo = setup.masterUtxo;
      dataNftUtxo = setup.dataNftUtxos[0];
    });

    it('should read initial state with all zero values', () => {
      const reader = new StateReader(stateLayout);
      const state = reader.readState([dataNftUtxo]);
      expect(state.marketplace).toEqual(zeroAddr);
      expect(state.escrow).toEqual(zeroAddr);
      expect(state.counter).toBe(0n);
    });

    it('should update marketplace and increment counter', async () => {
      const newMarketplaceLbc = hexToBin('a914' + 'ff'.repeat(20) + '87');

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout,
        categoryId,
        masterUtxo: {
          ...masterUtxo,
          unlocker: saltedContract.unlock.setMarketplace(alicePub, new SignatureTemplate(alicePriv), newMarketplaceLbc),
        },
        dataNftUtxos: [{ ...dataNftUtxo, unlocker: createDataNftUnlocker(saltedContract, 0, categoryId) }],
      })
        .setState('marketplace', newMarketplaceLbc)
        .setState('escrow', zeroAddr)
        .setState('counter', 1n)
        .send();

      expect(tx.txid).toBeDefined();

      const covenantUtxos = await provider.getUtxos(dataNftAddress);
      const updatedDataNft = covenantUtxos.find(
        (u) => u.token?.nft?.capability === 'mutable' && u.txid === tx.txid,
      )!;

      const reader = new StateReader(stateLayout);
      const newState = reader.readState([updatedDataNft]);
      expect(newState.marketplace).toEqual(newMarketplaceLbc);
      expect(newState.escrow).toEqual(zeroAddr);
      expect(newState.counter).toBe(1n);
    });

    it('should update escrow and increment counter', async () => {
      // Fetch current UTXOs from the provider (previous test consumed the originals)
      const contractUtxos = await saltedContract.getUtxos();
      const covenantUtxos = await provider.getUtxos(dataNftAddress);

      const currentMaster = contractUtxos.find(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      )!;
      expect(currentMaster).toBeDefined();

      const currentDataNft = covenantUtxos.find(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'mutable'
          && u.token?.nft?.commitment && u.token?.nft?.commitment.length > 0,
      )!;
      expect(currentDataNft).toBeDefined();

      // Verify previous state: marketplace was set, counter was incremented
      const prevMarketplaceLbc = hexToBin('a914' + 'ff'.repeat(20) + '87');
      const reader = new StateReader(stateLayout);
      const prevState = reader.readState([currentDataNft]);
      expect(prevState.marketplace).toEqual(prevMarketplaceLbc);
      expect(prevState.counter).toBe(1n);

      const newEscrowLbc = hexToBin('a914' + 'ee'.repeat(20) + '87');

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout,
        categoryId,
        masterUtxo: {
          ...currentMaster,
          unlocker: saltedContract.unlock.setEscrow(alicePub, new SignatureTemplate(alicePriv), newEscrowLbc),
        },
        dataNftUtxos: [{
          ...currentDataNft,
          unlocker: createDataNftUnlocker(saltedContract, 0, categoryId),
        }],
      })
        .setState('marketplace', prevMarketplaceLbc)
        .setState('escrow', newEscrowLbc)
        .setState('counter', 2n)
        .send();

      expect(tx.txid).toBeDefined();

      const updatedCovenantUtxos = await provider.getUtxos(dataNftAddress);
      const updatedDataNft = updatedCovenantUtxos.find(
        (u) => u.token?.nft?.capability === 'mutable' && u.txid === tx.txid,
      )!;

      const newState = reader.readState([updatedDataNft]);
      expect(newState.marketplace).toEqual(prevMarketplaceLbc);
      expect(newState.escrow).toEqual(newEscrowLbc);
      expect(newState.counter).toBe(2n);
    });
  });

  // -- Interface-typed state variable -----------------------------------

  describe('interface-typed state variable', () => {
    const artifact = compileString(INTERFACE_TYPED_CONTRACT);
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;

    const zeroAddr = new Uint8Array(25);

    let categoryId: string;
    let saltedContract: Contract;
    let dataNftAddress: string;
    let masterUtxo: Utxo;
    let dataNftUtxo: Utxo;

    beforeAll(async () => {
      const setup = await setupStatefulUtxos(
        provider, contract, stateLayout, { token: zeroAddr }, { saltContract: true },
      );
      categoryId = setup.categoryId;
      saltedContract = contract.withCategory(hexToBin(categoryId));
      dataNftAddress = getDataNftAddress(saltedContract, categoryId);
      masterUtxo = setup.masterUtxo;
      dataNftUtxo = setup.dataNftUtxos[0];
    });

    it('should have contractType set to interface name', () => {
      expect(stateLayout.variables[0].contractType).toBe('IToken');
    });

    it('should read initial state', () => {
      const reader = new StateReader(stateLayout);
      const state = reader.readState([dataNftUtxo]);
      expect(state.token).toEqual(zeroAddr);
    });

    it('should update token address via transaction', async () => {
      const newTokenLbc = hexToBin('76a914' + 'ab'.repeat(20) + '88ac');

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout,
        categoryId,
        masterUtxo: {
          ...masterUtxo,
          unlocker: saltedContract.unlock.setToken(alicePub, new SignatureTemplate(alicePriv), newTokenLbc),
        },
        dataNftUtxos: [{ ...dataNftUtxo, unlocker: createDataNftUnlocker(saltedContract, 0, categoryId) }],
      })
        .setState('token', newTokenLbc)
        .send();

      expect(tx.txid).toBeDefined();

      const covenantUtxos = await provider.getUtxos(dataNftAddress);
      const updatedDataNft = covenantUtxos.find(
        (u) => u.token?.nft?.capability === 'mutable' && u.txid === tx.txid,
      )!;

      const reader = new StateReader(stateLayout);
      const newState = reader.readState([updatedDataNft]);
      expect(newState.token).toEqual(newTokenLbc);
    });
  });

  // -- Visibility-first order -------------------------------------------

  describe('visibility-first order', () => {
    it('should compile and produce identical artifact to type-first order', () => {
      const typeFirst = compileWithImports(TYPED_STATE_VAR_CONTRACT);
      const visFirst = compileWithImports(VISIBILITY_FIRST_CONTRACT);

      // Both should have the same state layout structure
      expect(visFirst.stateLayout!.variables[0].type).toBe('address');
      expect(visFirst.stateLayout!.variables[0].contractType).toBe('MarketplaceV1');
      expect(typeFirst.stateLayout!.variables[0].type).toBe(visFirst.stateLayout!.variables[0].type);
      expect(typeFirst.stateLayout!.variables[0].contractType).toBe(
        visFirst.stateLayout!.variables[0].contractType,
      );
    });
  });
});
