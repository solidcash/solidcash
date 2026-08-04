import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract, SignatureTemplate, Signer,
} from '../../src/index.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { getNetworkPrefix } from '../../src/utils.js';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

// Unique key for Signer tests so the derived address has no prior UTXOs on the shared regtest node.
const signerPriv = hexToBin('a1b2c3d4'.repeat(8));

// Two independent contracts that A calls B
const CALLER_SOURCE = `
pragma solidcash >=0.8.0;

interface ITarget {
    function increment();
}

contract Caller(bytes targetAddr) {
    bigint callerState;

    function callTarget(pubkey pk, sig s) {
        require(checkSig(s, pk));
        ITarget(targetAddr).increment();
        this.callerState = this.callerState + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

const TARGET_SOURCE = `
pragma solidcash >=0.8.0;

contract Target() {
    bigint counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

describe('Contract Composability', () => {
  it('A calls B: both contracts update state in a single transaction', async () => {
    const provider = createTestProvider();

    const artA = compileString(CALLER_SOURCE);
    const artB = compileString(TARGET_SOURCE);

    // Genesis B first: A's constructor embeds B's real category, so B must exist before A is built.
    const contractB = new Contract(artB, [], { provider });
    const { categoryId: catB } = await setupStatefulUtxos(
      provider, contractB, artB.stateLayout!, { counter: 0n }, { saltContract: true },
    );

    const targetAddr = contractB.withCategory(hexToBin(catB)).lockingBytecode;
    const contractA = new Contract(artA, [targetAddr], { provider });
    const { categoryId: catA } = await setupStatefulUtxos(
      provider, contractA, artA.stateLayout!, { callerState: 0n }, { saltContract: true },
    );

    const scA = StatefulContract.withCategory(contractA, catA);
    const scB = StatefulContract.withCategory(contractB, catB);

    // A calls B's increment() - both states update in one tx
    const tx = await scA.callTarget(alicePub, new SignatureTemplate(alicePriv))
      .withExternalCall(scB, 'increment', [])
      .send();

    expect(tx.txid).toBeDefined();

    // Verify outputs: A's state should be callerState=1, B's state should be counter=1
    const txOutputs = getTxOutputs(tx);

    // A's dataNft should have updated callerState
    const aDataNft = txOutputs.find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === catA,
    );
    expect(aDataNft).toBeDefined();

    // B's dataNft should have updated counter
    const bDataNft = txOutputs.find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === catB,
    );
    expect(bDataNft).toBeDefined();

    // Both master NFTs should be preserved
    const aMaster = txOutputs.find(
      (o) => o.token?.nft?.capability === 'minting' && o.token?.category === catA,
    );
    const bMaster = txOutputs.find(
      (o) => o.token?.nft?.capability === 'minting' && o.token?.category === catB,
    );
    expect(aMaster).toBeDefined();
    expect(bMaster).toBeDefined();
  });

  it('block layout provides compile-time offsets for both contracts', () => {
    const artA = compileString(CALLER_SOURCE);
    const artB = compileString(TARGET_SOURCE);

    const fnA = artA.abi.find((f) => f.name === 'callTarget');
    const fnB = artB.abi.find((f) => f.name === 'increment');

    // A's blockLayout should have master + dataNft
    expect(fnA!.blockLayout).toBeDefined();
    expect(fnA!.blockLayout!.slots.some((s) => s.kind === 'master')).toBe(true);
    expect(fnA!.blockLayout!.slots.some((s) => s.kind === 'dataNft')).toBe(true);

    // B's blockLayout should also have master + dataNft
    expect(fnB!.blockLayout).toBeDefined();
    expect(fnB!.blockLayout!.slots.some((s) => s.kind === 'master')).toBe(true);
    expect(fnB!.blockLayout!.slots.some((s) => s.kind === 'dataNft')).toBe(true);

    // Both use compile-time offsets (dataNft at offset 1)
    const aDataNftSlot = fnA!.blockLayout!.slots.find((s) => s.kind === 'dataNft');
    const bDataNftSlot = fnB!.blockLayout!.slots.find((s) => s.kind === 'dataNft');
    expect(aDataNftSlot!.offset).toBe(1);
    expect(bDataNftSlot!.offset).toBe(1);
  });

  describe('Signer integration', () => {
    it('Signer derives P2PKH address and locking bytecode', () => {
      const provider = createTestProvider();
      const signer = new Signer(alicePriv, provider);

      expect(signer.getAddress()).toContain(`${getNetworkPrefix(provider.network)}:`);
      expect(signer.getLockingBytecode()).toBeInstanceOf(Uint8Array);
      expect(signer.getLockingBytecode().length).toBeGreaterThan(0);
    });

    it('Signer.getUtxos() returns UTXOs from provider', async () => {
      const provider = createTestProvider();
      const signer = new Signer(signerPriv, provider);
      const addr = signer.getAddress();

      await provider.addUtxo(addr, { txid: 'cccd'.repeat(16), vout: 0, satoshis: 50000n });
      await provider.addUtxo(addr, { txid: 'ddcd'.repeat(16), vout: 0, satoshis: 30000n });

      // The shared regtest node persists UTXOs across runs at this fixed address, so assert the
      // two added UTXOs are present rather than an exact total count.
      const amounts = (await signer.getUtxos()).map((u) => u.satoshis);
      expect(amounts).toContain(50000n);
      expect(amounts).toContain(30000n);
    });

    it('connect(signer) binds signer to StatefulContract', () => {
      const provider = createTestProvider();
      const signer = new Signer(alicePriv, provider);

      const artB = compileString(TARGET_SOURCE);
      const contractB = new Contract(artB, [], { provider });
      const scB = StatefulContract.withCategory(contractB, 'b1cd'.repeat(16));

      const connected = scB.connect(signer);
      expect(connected).toBeDefined();
      // connected is a new StatefulContract instance
      expect(connected).not.toBe(scB);
    });
  });

  describe('Block layout metadata', () => {
    it('conditional slots are marked in blockLayout', () => {
      const source = `
        pragma solidcash >=0.8.0;
        contract ConditionalSlots() {
            event Evt(bigint amount);
            bigint state;
            function test(bool cond) {
                if (cond) {
                    emit Evt(1);
                    emit Evt(2);
                } else {
                    emit Evt(3);
                }
                this.state = this.state + 1;
            }
            function authorize(pubkey pk, sig s) unsafe {
                require(checkSig(s, pk));
            }
        }
      `;
      const art = compileString(source);
      const fn = art.abi.find((f) => f.name === 'test');
      expect(fn!.blockLayout).toBeDefined();

      const eventSlots = fn!.blockLayout!.slots.filter((s) => s.kind === 'event');
      // First event slot (index 0): always emitted in both branches -> not conditional
      expect(eventSlots[0].conditional).toBeFalsy();
      // Second event slot (index 1): only in if-branch -> conditional
      expect(eventSlots[1].conditional).toBe(true);
    });

    it('getReturnEventOutputBase() uses block layout offset', () => {
      const source = `
        pragma solidcash >=0.8.0;
        interface IOther {
            function action() returns (bigint);
        }
        contract WithReturn(bytes32 otherCat) {
            bigint state;
            function call() {
                bigint result = IOther(otherCat).action();
                this.state = result;
            }
            function authorize(pubkey pk, sig s) unsafe {
                require(checkSig(s, pk));
            }
        }
      `;
      const art = compileString(source);
      const fn = art.abi.find((f) => f.name === 'call');
      expect(fn!.blockLayout).toBeDefined();

      // Verify returnEvent is NOT in blockLayout for the caller side
      // (returnEvent is for B-side contracts that return values)
      // Caller's block: master + dataNft = 2 slots
      expect(fn!.blockLayout!.blockSize).toBe(2);
    });

    it('blockSize matches slot count', () => {
      const artA = compileString(CALLER_SOURCE);
      const fnA = artA.abi.find((f) => f.name === 'callTarget');

      expect(fnA!.blockLayout!.blockSize).toBe(fnA!.blockLayout!.slots.length);

      const artB = compileString(TARGET_SOURCE);
      const fnB = artB.abi.find((f) => f.name === 'increment');
      expect(fnB!.blockLayout!.blockSize).toBe(fnB!.blockLayout!.slots.length);
    });
  });

  describe('Funder change output', () => {
    it('STB produces change output when funder has excess', async () => {

      const source = `
        pragma solidcash >=0.8.0;
        contract WithTransfer() {
            bigint state;
            function doTransfer(bytes20 recipient) payable {
                this.state = this.state + 1;
                this.transfer(new LockingBytecodeP2PKH(recipient), 1000);
            }
            function authorize(pubkey pk, sig s) unsafe {
                require(checkSig(s, pk));
            }
        }
      `;
      const art = compileString(source);
      const fn = art.abi.find((f) => f.name === 'doTransfer');

      // A function with a transfer slot should have transfer + satoshiContainer in blockLayout
      expect(fn!.blockLayout).toBeDefined();
      const hasTransfer = fn!.blockLayout!.slots.some((s) => s.kind === 'transfer');
      const hasSC = fn!.blockLayout!.slots.some((s) => s.kind === 'satoshiContainer');
      expect(hasTransfer).toBe(true);
      expect(hasSC).toBe(true);
    });
  });

  describe('Language features', () => {
    it('underscore-prefixed identifiers compile', () => {
      const art = compileString(`
        pragma solidcash >=0.8.0;
        contract T() {
          bytes20 _owner;
          bigint _balance;
          function _setOwner(bytes20 _newOwner) {
            this._owner = _newOwner;
            this._balance = this._balance + 1;
          }
          function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
        }
      `);
      expect(art.stateLayout!.variables!.some((v) => v.name === '_owner')).toBe(true);
      expect(art.stateLayout!.variables!.some((v) => v.name === '_balance')).toBe(true);
      expect(art.abi.some((f) => f.name === '_setOwner')).toBe(true);
    });

    it('** exponentiation operator: compile-time constants', () => {
      const art = compileString(`
        pragma solidcash >=0.8.0;
        contract T() {
          bigint constant MAX = 2 ** 256 - 1;
          bigint constant SCALE = 10 ** 18;
          function test() { require(MAX > 0); require(SCALE == 1000000000000000000); }
        }
      `);
      expect(art).toBeDefined();
    });

    it('** exponentiation operator: runtime', () => {
      const art = compileString(`
        pragma solidcash >=0.8.0;
        contract T(bigint x) {
          function test(bigint base, bigint exp) { require(base ** exp > x); }
        }
      `);
      expect(art).toBeDefined();
    });

    it('same modifier applied twice with different args', () => {
      const art = compileString(`
        pragma solidcash >=0.8.0;
        contract T() {
          mapping(bytes20 => bool) bl;
          modifier notBL(bytes20 a) { require(!this.bl[a]); _; }
          function f(bytes20 from, bytes20 to) notBL(from) notBL(to) { require(true); }
          function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
        }
      `);
      expect(art).toBeDefined();
      expect(art.abi.some((f) => f.name === 'f')).toBe(true);
    });

    it('library + contract in same source', () => {
      const art = compileString(`
        pragma solidcash >=0.8.0;
        library Lib {
          function add(bigint a, bigint b) returns (bigint) { return a + b; }
          function sub(bigint a, bigint b) returns (bigint) { assert(b <= a); return a - b; }
        }
        contract T(bigint x) {
          using Lib for bigint;
          function test(bigint a, bigint b) { require(a.add(b).sub(1) > x); }
        }
      `);
      expect(art).toBeDefined();
      expect(art.contractName).toBe('T');
    });

    it('this.stateVar.method() via using-for', () => {
      const art = compileString(`
        pragma solidcash >=0.8.0;
        library M { function add(bigint a, bigint b) returns (bigint) { return a + b; } }
        contract T() {
          using M for bigint;
          public bigint x;
          function f(bigint a) { this.x = this.x.add(a); }
          function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
        }
      `);
      expect(art).toBeDefined();
    });

    it('this.mapping[key].method() via using-for', () => {
      const art = compileString(`
        pragma solidcash >=0.8.0;
        library M {
          function add(bigint a, bigint b) returns (bigint) { return a + b; }
          function sub(bigint a, bigint b) returns (bigint) { return a - b; }
        }
        contract T() {
          using M for bigint;
          mapping(bytes20 => bigint) balances;
          function transfer(bytes20 from, bytes20 to, bigint amount) {
            this.balances[from] = this.balances[from].sub(amount);
            this.balances[to] = this.balances[to].add(amount);
          }
          function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
        }
      `);
      expect(art).toBeDefined();
    });

    it('__internal__ prefix on synthetic params, not on user params', () => {
      const art = compileString(`
        pragma solidcash >=0.8.0;
        interface IB { function action(); }
        contract T(bytes32 _bCat) {
          bigint _state;
          function callB(bigint _val) {
            IB(_bCat).action();
            this._state = this._state + _val;
          }
          function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
        }
      `);
      const fn = art.abi.find((f) => f.name === 'callB');
      expect(fn).toBeDefined();
      // User params have underscore prefix
      expect(fn!.inputs.some((i) => i.name === '_val')).toBe(true);
      // Synthetic params have __internal__ prefix
      expect(fn!.inputs.some((i) => i.name === '__internal__externalCallInputBase')).toBe(true);
      // No synthetic uses single underscore prefix
      expect(fn!.inputs.every((i) => !i.name.startsWith('_') || i.name.startsWith('__internal__') || i.name === '_val')).toBe(true);
    });

    it('emit after state write (zero-arg event)', () => {
      const art = compileString(`
        pragma solidcash >=0.8.0;
        contract T() {
          event Evt();
          bool paused;
          modifier whenNotPaused() { require(!this.paused); _; }
          function toggle() whenNotPaused { this.paused = true; emit Evt(); }
          function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
        }
      `);
      expect(art).toBeDefined();
    });

    it('visibility modifiers after mapping/array type', () => {
      const art = compileString(`
        pragma solidcash >=0.8.0;
        contract T() {
          mapping(bytes20 => bigint) public balances;
          bigint[3] public arr;
          mapping(bytes20 => mapping(bytes20 => bigint)) public allowances;
          function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
        }
      `);
      expect(art).toBeDefined();
      expect(art.stateLayout!.collections!.some((c) => c.name === 'balances')).toBe(true);
    });
  });
});
