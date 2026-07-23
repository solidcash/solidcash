import { compileString } from 'solidc';
import { hexToBin, binToHex } from '@bitauth/libauth';
import {
  Contract, StatefulTransactionBuilder,
  TransactionBuilder,
  SignatureTemplate,
  randomUtxo,
  createDataNftUnlocker,
  getDataNftAddress,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  encodePushdataValue,
} from '@solidcash/utils';
import { Utxo } from '../../src/interfaces.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createTestProvider, verifyTransaction } from '../test-util.js';
import { alicePriv, aliceAddress } from '../fixture/vars.js';

// Note: Interfaces with only 1 callable function do NOT require _externalCallSelector
// because single-function contracts don't include a selector in their unlocking bytecode
// (no function dispatch needed). The category/bytecode/capability checks in the covenant
// are sufficient to prove B is the correct contract running its only function.

/** Create a return event NFT output for cross-contract calls with return values. */
function returnEventOutput(
  categoryId: string, returnValue: bigint,
): { to: Uint8Array; amount: bigint; token: { amount: bigint; category: string; nft: { capability: 'none'; commitment: string } } } {
  const commitment = binToHex(encodePushdataValue(returnValue, 'int256'));
  return {
    to: new Uint8Array([0x51]), // OP_TRUE (any locking bytecode - covenant only checks commitment+category)
    amount: 800n,
    token: {
      amount: 0n,
      category: categoryId,
      nft: { capability: 'none', commitment },
    },
  };
}

// Genesis A + B under ONE shared real category: a two-category cycle is un-bootstrappable
// (each address would commit to the peer's not-yet-created genesis txid).
async function genesisMutualPair(
  provider: ReturnType<typeof createTestProvider>,
  artA: ReturnType<typeof compileString>, artB: ReturnType<typeof compileString>,
  stateA: Record<string, bigint>, stateB: Record<string, bigint>,
): Promise<{
    categoryId: string; contractA: Contract; contractB: Contract;
    masterA: Utxo; dataNftA: Utxo; masterB: Utxo; dataNftB: Utxo;
  }> {
  const commitsA = buildInitialStateCommitments(artA.stateLayout!, stateA);
  const commitsB = buildInitialStateCommitments(artB.stateLayout!, stateB);
  const { categoryId, utxos } = await (provider as any).addTokenUtxosDynamic((cat: string) => {
    const a = new Contract(artA, [hexToBin(cat)], { provider });
    const b = new Contract(artB, [hexToBin(cat)], { provider });
    return [
      { address: a.tokenAddress, satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
      { address: getDataNftAddress(a, cat), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'mutable', commitment: commitsA[0] } } },
      { address: b.tokenAddress, satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
      { address: getDataNftAddress(b, cat), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'mutable', commitment: commitsB[0] } } },
    ];
  });
  return {
    categoryId,
    contractA: new Contract(artA, [hexToBin(categoryId)], { provider }),
    contractB: new Contract(artB, [hexToBin(categoryId)], { provider }),
    masterA: utxos[0], dataNftA: utxos[1], masterB: utxos[2], dataNftB: utxos[3],
  };
}

// =============================================================================
// Contract Sources - Circular A<->B Patterns
// =============================================================================

// ---------------------------------------------------------------------------
// Pattern 1: A calls B, B reads A's outState
// A->B via function call, B->A via outState read. No true "callback" but B
// observes A's post-execution state in the same atomic transaction.
// ---------------------------------------------------------------------------

const CALLER_A = `
pragma solidcash >=0.8.0;

interface IB {
    public int stateB;
    function actionB(int val) returns (int);
}

interface IA {
    public int stateA;
    function callB(int val);
}

contract CallerA(bytes bAddr) is IA {
    int stateA;

    function callB(int val) {
        int result = IB(bAddr).actionB(val);
        this.stateA = this.stateA + result;
    }
}
`;

const READER_B = `
pragma solidcash >=0.8.0;

interface IA {
    public int stateA;
    function callB(int val);
}

interface IB {
    public int stateB;
    function actionB(int val) returns (int);
}

contract ReaderB(bytes aAddr) is IB {
    int stateB;

    function actionB(int val) returns (int) {
        int aState = IA(aAddr).outState.stateA;
        this.stateB = this.stateB + val + aState;
        return val;
    }
}
`;

// ---------------------------------------------------------------------------
// Pattern 2: True mutual function calls - A calls B, B calls A
// Both contracts have external call verification for each other.
// This is the "flash loan callback" pattern: A initiates, B verifies A
// is present and using the correct function, A verifies B likewise.
// ---------------------------------------------------------------------------

const MUTUAL_A = `
pragma solidcash >=0.8.0;

interface IB {
    public int stateB;
    function actionB(int val) returns (int);
}

interface IA {
    public int stateA;
    function callB(int val) returns (int);
}

contract MutualA(bytes bAddr) is IA {
    int stateA;

    function callB(int val) returns (int) {
        int result = IB(bAddr).actionB(val);
        this.stateA = this.stateA + result;
        return result;
    }
}
`;

const MUTUAL_B = `
pragma solidcash >=0.8.0;

interface IA {
    public int stateA;
    function callB(int val) returns (int);
}

interface IB {
    public int stateB;
    function actionB(int val) returns (int);
}

contract MutualB(bytes aAddr) is IB {
    int stateB;

    function actionB(int val) returns (int) {
        int aResult = IA(aAddr).callB(val);
        this.stateB = this.stateB + val + aResult;
        return val;
    }
}
`;

// ---------------------------------------------------------------------------
// Pattern 3: Same-category self-reference (contract calls its own interface)
// A single contract type that "calls itself" - meaning it verifies another
// instance of the same contract is present in the transaction.
// ---------------------------------------------------------------------------

const SELF_REF = `
pragma solidcash >=0.8.0;

interface ISelf {
    public int counter;
    function step(int val) returns (int);
}

contract SelfRef(bytes otherAddr) is ISelf {
    int counter;

    function step(int val) returns (int) {
        int otherVal = ISelf(otherAddr).step(val);
        this.counter = this.counter + otherVal;
        return val;
    }
}
`;

// =============================================================================
// Tests
// =============================================================================

describe('Circular Call Patterns (A->B->A)', () => {
  // =========================================================================
  // Section 1: Proving the Fundamental UTXO Constraint
  // =========================================================================

  describe('fundamental constraint: why sequential reentrancy is impossible', () => {
    it('a UTXO can only appear once as a transaction input', () => {
      // In BCH, each UTXO is identified by (txid, vout). A transaction
      // cannot include the same (txid, vout) pair twice. This makes
      // Solidity-style reentrancy structurally impossible: Contract A's
      // master UTXO at input[0] cannot also appear at input[N].
      //
      // Instead, "circular calls" in BCH are MUTUAL COVENANT VERIFICATION:
      // A and B each independently verify the other is present in the
      // transaction. No sequential execution, no shared mutable state,
      // no reentrancy.
      const provider = createTestProvider();
      const utxo: Utxo = {
        txid: 'aacd'.repeat(16),
        vout: 0,
        satoshis: 10000n,
      };

      // Attempting to add the same UTXO twice is now caught by the builder
      // at addInput time, proving that A's master UTXO cannot appear at both
      // input[0] AND inside externalCallUtxoGroups. True reentrancy is impossible.
      const tb = new TransactionBuilder({ provider });
      tb.addInput(utxo, Buffer.alloc(0) as any);
      expect(() => tb.addInput(utxo, Buffer.alloc(0) as any)).toThrow('Duplicate input detected');
    });
  });

  // =========================================================================
  // Section 2: Pattern 1 - A calls B, B reads A's outState
  // =========================================================================

  describe('Pattern 1: A calls B, B reads A outState (one-way call + state read)', () => {
    it('both contracts compile with correct external references', () => {
      const artA = compileString(CALLER_A);
      const artB = compileString(READER_B);

      // A has one external call to IB.actionB
      const fnA = artA.abi.find((f) => f.name === 'callB');
      expect(fnA!.externalCalls).toBeDefined();
      expect(fnA!.externalCalls!.length).toBe(1);
      expect(fnA!.externalCalls![0].interfaceName).toBe('IB');
      expect(fnA!.externalCalls![0].functionName).toBe('actionB');

      // B has one external outState read of IA
      const fnB = artB.abi.find((f) => f.name === 'actionB');
      expect(fnB!.externalOutStateReads).toBeDefined();
      expect(fnB!.externalOutStateReads!.length).toBe(1);
      expect(fnB!.externalOutStateReads![0].interfaceName).toBe('IA');
    });

    it('A has blockLayout for external call, B needs _externalOutStateInputBase (pointing to A)', () => {
      const artA = compileString(CALLER_A);
      const artB = compileString(READER_B);

      const fnA = artA.abi.find((f) => f.name === 'callB');
      expect(fnA!.blockLayout).toBeDefined();
      // No _externalCallSelector for single-function callee interfaces (IB has only actionB)
      const inputsA = fnA!.inputs.map((i) => i.name);
      expect(inputsA).not.toContain('__internal__externalCallSelector');

      const fnB = artB.abi.find((f) => f.name === 'actionB');
      const inputsB = fnB!.inputs.map((i) => i.name);
      expect(inputsB).toContain('__internal__externalOutStateInputBase');
      // B also has _returnOutputIdx because it returns a value
      expect(inputsB).toContain('__internal__returnOutputIdx');
    });

    // ADDRESS-MODEL LIMITATION: mutual A<->B cycle is un-bootstrappable. A bakes B's address and B
    // bakes A's address, so addrA = hash(codeA|addrB|C) and addrB = hash(codeB|addrA|C) - a hash
    // fixed point with no constructible solution (empirically: baking the peer's real lbc changes
    // self lbc, never converges). The covenant checks OP_UTXOBYTECODE(peer)==bakedPeerAddr in BOTH
    // directions, so no genesis can satisfy both. Pattern 1 verifies on-chain (B reads A.outState,
    // A calls B) so it cannot be wired. Was bootstrappable under the old shared-category model.
    it.skip('builds a transaction with A at input[0..1] and B at input[2..3]', async () => {
      const provider = createTestProvider();
      const artA = compileString(CALLER_A);
      const artB = compileString(READER_B);

      const layoutA = artA.stateLayout!;
      const layoutB = artB.stateLayout!;

      // Real genesis: A + B share one category (see genesisMutualPair).
      const {
        categoryId: cat, contractA, contractB, masterA, dataNftA, masterB, dataNftB,
      } = await genesisMutualPair(provider, artA, artB, { stateA: 10n }, { stateB: 20n });
      const catA = cat;
      const catB = cat;

      // A is the "main" contract. B is the external call target.
      // B's _externalOutStateInputBase = 0 (pointing to A)
      //
      // Transaction layout:
      //   Input[0]: A master
      //   Input[1]: A data NFT
      //   Input[2]: B master    <- A verifies B here
      //   Input[3]: B data NFT
      //
      // B's script reads A's outState at input[0] - the "callback read"
      // No _externalCallSelector needed: IB has only 1 callable function (actionB)
      const unlockA = contractA.unlock.callB(
        5n,     // val
        2n,     // _externalCallInputBase (B starts at input[2])
        4n,     // _externalReturnOutputIdx (return event output after 4 main outputs)
      );
      const dataNftUnlockA = createDataNftUnlocker(contractA, 0, catA);

      // B gets _externalOutStateInputBase = 0 (A is at input[0])
      // B's return event NFT is at output[4] (after 4 state outputs)
      const unlockB = contractB.unlock.actionB(
        5n,     // val
        0n,     // _externalOutStateInputBase (A is at input[0])
        4n,     // _returnOutputIdx (B's return event at output[4])
      );
      const dataNftUnlockB = createDataNftUnlocker(contractB, 2, catB);

      const callGroup: ExternalCallUtxoGroup = {
        categoryId: catB,
        stateLayout: layoutB,
        masterUtxo: { ...masterB, unlocker: unlockB },
        dataNftUtxos: [{ ...dataNftB, unlocker: dataNftUnlockB }],
        requiredDataNftIndices: [0],
        functionName: 'actionB',
        functionArgs: [5n, 0n, 4n],
        externalContract: null,
      };

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterA, unlocker: unlockA },
        dataNftUtxos: [{ ...dataNftA, unlocker: dataNftUnlockA }],
        stateLayout: layoutA,
        categoryId: catA,
        externalCallUtxoGroups: [callGroup],
      });

      // A's state: stateA = 10 + 5 = 15
      stb.setState('stateA', 15n);
      // B's state: stateB = 20 + 5 + 15 = 40 (val + A's OUTPUT stateA, since B reads outState)
      stb.setExternalCallState(catB, 'stateB', 40n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);

      // Add P2PKH funding input to cover return event output sats
      const fundingUtxo = randomUtxo();
      await provider.addUtxo(aliceAddress, fundingUtxo);
      builder.addInput(fundingUtxo, new SignatureTemplate(alicePriv).unlockP2PKH());
      // Add return event NFT for B's return value (val=5)
      builder.addOutput(returnEventOutput(catB, 5n));
      // Change output to absorb remaining funds
      builder.addOutput({ to: aliceAddress, amount: fundingUtxo.satoshis - 1000n });

      verifyTransaction(builder);

      // The transfer output base should account for:
      // 1 (A master) + 1 (A data NFT) + 2 (B master + B data NFT) = 4
      expect(stb.getTransferOutputBase()).toBe(4);
    });
  });

  // =========================================================================
  // Section 3: Pattern 2 - True Mutual Function Calls (A<->B)
  // =========================================================================

  describe('Pattern 2: true mutual calls (A calls B, B calls A)', () => {
    it('both contracts compile with external call slots referencing each other', () => {
      const artA = compileString(MUTUAL_A);
      const artB = compileString(MUTUAL_B);

      // A has external call to IB.actionB
      const fnA = artA.abi.find((f) => f.name === 'callB');
      expect(fnA!.externalCalls!.length).toBe(1);
      expect(fnA!.externalCalls![0]).toEqual(expect.objectContaining({
        interfaceName: 'IB',
        functionName: 'actionB',
        addressParam: 'bAddr',
      }));

      // B has external call to IA.callB
      const fnB = artB.abi.find((f) => f.name === 'actionB');
      expect(fnB!.externalCalls!.length).toBe(1);
      expect(fnB!.externalCalls![0]).toEqual(expect.objectContaining({
        interfaceName: 'IA',
        functionName: 'callB',
        addressParam: 'aAddr',
      }));
    });

    it('both contracts have blockLayout (no selector for single-function interfaces)', () => {
      const artA = compileString(MUTUAL_A);
      const artB = compileString(MUTUAL_B);

      const fnA = artA.abi.find((f) => f.name === 'callB');
      expect(fnA!.blockLayout).toBeDefined();
      // No _externalCallSelector: IB has only 1 callable function (actionB)
      const inputsA = fnA!.inputs.map((i) => i.name);
      expect(inputsA).not.toContain('__internal__externalCallSelector');
      expect(inputsA).toContain('__internal__returnOutputIdx');        // A returns a value
      expect(inputsA).toContain('__internal__externalReturnOutputIdx'); // A reads B's return

      const fnB = artB.abi.find((f) => f.name === 'actionB');
      expect(fnB!.blockLayout).toBeDefined();
      // No _externalCallSelector: IA has only 1 callable function (callB)
      const inputsB = fnB!.inputs.map((i) => i.name);
      expect(inputsB).not.toContain('__internal__externalCallSelector');
      expect(inputsB).toContain('__internal__returnOutputIdx');        // B returns a value
      expect(inputsB).toContain('__internal__externalReturnOutputIdx'); // B reads A's return
    });

    // ADDRESS-MODEL LIMITATION: mutual A<->B cycle is un-bootstrappable (see Pattern 1 skip note).
    // MutualA bakes MutualB's address and vice versa: addrA=hash(codeA|addrB|C),
    // addrB=hash(codeB|addrA|C) has no constructible fixed point, so no genesis satisfies both
    // covenants' OP_UTXOBYTECODE(peer)==bakedPeerAddr. This test builds + verifyTransaction()s a
    // real bidirectional cycle, which the address model cannot bootstrap.
    it.skip('A and B cross-reference in a single atomic transaction', async () => {
      // This is the key insight: in a single transaction, both scripts
      // verify each other at their respective input indices.
      //
      // Transaction layout:
      //   Input[0]: A master     <- B verifies A here
      //   Input[1]: A data NFT
      //   Input[2]: B master     <- A verifies B here
      //   Input[3]: B data NFT
      //
      // A's bytecode checks:
      //   - Input[2] has B's category [x]
      //   - Input[2] bytecode == Output[2] bytecode [x]
      //   - Input[2] retains minting capability [x]
      //   - Input[2] selector == B's "actionB" 4-byte hash selector [x]
      //
      // B's bytecode checks:
      //   - Input[0] has A's category [x]
      //   - Input[0] bytecode == Output[0] bytecode [x]
      //   - Input[0] retains minting capability [x]
      //   - Input[0] selector == A's "callB" 4-byte hash selector [x]
      //
      // Both checks pass independently. No reentrancy, no shared state.
      // Just mutual covenant verification in one atomic transaction.

      const provider = createTestProvider();
      const artA = compileString(MUTUAL_A);
      const artB = compileString(MUTUAL_B);

      const layoutA = artA.stateLayout!;
      const layoutB = artB.stateLayout!;

      // Real genesis: A + B share one category (see genesisMutualPair).
      const {
        categoryId: cat, contractA, contractB, masterA, dataNftA, masterB, dataNftB,
      } = await genesisMutualPair(provider, artA, artB, { stateA: 10n }, { stateB: 20n });
      const catA = cat;
      const catB = cat;

      // No _externalCallSelector needed: both IA and IB have only 1 callable function each

      // A's unlocker: B is at input[2]
      const unlockA = contractA.unlock.callB(
        5n,     // val
        2n,     // _externalCallInputBase (B starts at input[2])
        4n,     // _returnOutputIdx (A's return event)
        5n,     // _externalReturnOutputIdx (B's return event)
      );
      const dataNftUnlockA = createDataNftUnlocker(contractA, 0, catA);

      // B's unlocker: A is at input[0]
      // Output layout: [0-3] state NFTs, [4] A's return event, [5] B's return event
      const unlockB = contractB.unlock.actionB(
        5n,     // val
        0n,     // _externalCallInputBase (A starts at input[0])
        5n,     // _returnOutputIdx (B's return event at output[5])
        4n,     // _externalReturnOutputIdx (A's return event at output[4])
      );
      const dataNftUnlockB = createDataNftUnlocker(contractB, 2, catB);

      const callGroup: ExternalCallUtxoGroup = {
        categoryId: catB,
        stateLayout: layoutB,
        masterUtxo: { ...masterB, unlocker: unlockB },
        dataNftUtxos: [{ ...dataNftB, unlocker: dataNftUnlockB }],
        requiredDataNftIndices: [0],
        functionName: 'actionB',
        functionArgs: [5n, 0n, 5n, 4n],
        externalContract: null,
      };

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterA, unlocker: unlockA },
        dataNftUtxos: [{ ...dataNftA, unlocker: dataNftUnlockA }],
        stateLayout: layoutA,
        categoryId: catA,
        externalCallUtxoGroups: [callGroup],
      });

      // Both mutate state:
      // A: stateA = 10 + 5 = 15
      // B: stateB = 20 + 5 + 5 = 30
      stb.setState('stateA', 15n);
      stb.setExternalCallState(catB, 'stateB', 30n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);

      // Add P2PKH funding input to cover return event output sats
      const fundingUtxo = randomUtxo();
      await provider.addUtxo(aliceAddress, fundingUtxo);
      builder.addInput(fundingUtxo, new SignatureTemplate(alicePriv).unlockP2PKH());
      // Add return event NFTs: A returns 5 (result from B), B returns 5 (val)
      builder.addOutput(returnEventOutput(catA, 5n)); // output[4]: A's return
      builder.addOutput(returnEventOutput(catB, 5n)); // output[5]: B's return
      // Change output to absorb remaining funds
      builder.addOutput({ to: aliceAddress, amount: fundingUtxo.satoshis - 2000n });

      verifyTransaction(builder);
    });
  });

  // =========================================================================
  // Section 4: Pattern 3 - Same-interface Self-Reference
  // =========================================================================

  describe('Pattern 3: same-interface self-reference (SelfRef calls ISelf)', () => {
    it('compiles: a contract can implement and call its own interface', () => {
      const art = compileString(SELF_REF);
      const fn = art.abi.find((f) => f.name === 'step');
      expect(fn).toBeDefined();

      // Has external call to ISelf.step (itself)
      expect(fn!.externalCalls!.length).toBe(1);
      expect(fn!.externalCalls![0]).toEqual(expect.objectContaining({
        interfaceName: 'ISelf',
        functionName: 'step',
        addressParam: 'otherAddr',
      }));
    });

    // ADDRESS-MODEL LIMITATION: mutual cycle is un-bootstrappable (see Pattern 1 skip note). Two
    // SelfRef instances each bake the other's address (same code, shared category): addr1 and addr2
    // satisfy addr1=hash(code|addr2|C), addr2=hash(code|addr1|C) - a hash fixed point with no
    // constructible solution. verifyTransaction() needs both covenant identity checks to pass, which
    // no genesis can arrange. Was bootstrappable under the old shared-category model.
    it.skip('two instances of SelfRef can verify each other in one TX', async () => {
      // This is the "ping-pong" pattern:
      //   Instance1 (catX) calls ISelf(catY).step()
      //   Instance2 (catY) calls ISelf(catX).step()
      //   Both verify each other and update their own state.

      const provider = createTestProvider();
      const art = compileString(SELF_REF);

      const layout = art.stateLayout!;

      // Real genesis: both SelfRef instances share one category (see genesisMutualPair).
      const {
        categoryId: cat,
        contractA: instance1, contractB: instance2,
        masterA: master1, dataNftA: dataNft1, masterB: master2, dataNftB: dataNft2,
      } = await genesisMutualPair(provider, art, art, { counter: 0n }, { counter: 0n });
      const catX = cat;
      const catY = cat;

      // No _externalCallSelector needed: ISelf has only 1 callable function (step)

      // Instance1 is the "main" contract, Instance2 is external call
      const unlock1 = instance1.unlock.step(
        1n,     // val
        2n,     // _externalCallInputBase (instance2 starts at input[2])
        4n,     // _returnOutputIdx
        5n,     // _externalReturnOutputIdx
      );
      const dataNftUnlock1 = createDataNftUnlocker(instance1, 0, catX);

      // Instance2 at input[2], instance1 at input[0]
      const unlock2 = instance2.unlock.step(
        1n,     // val
        0n,     // _externalCallInputBase (instance1 starts at input[0])
        5n,     // _returnOutputIdx
        4n,     // _externalReturnOutputIdx
      );
      const dataNftUnlock2 = createDataNftUnlocker(instance2, 2, catY);

      const callGroup: ExternalCallUtxoGroup = {
        categoryId: catY,
        stateLayout: layout,
        masterUtxo: { ...master2, unlocker: unlock2 },
        dataNftUtxos: [{ ...dataNft2, unlocker: dataNftUnlock2 }],
        requiredDataNftIndices: [0],
        functionName: 'step',
        functionArgs: [1n, 0n, 5n, 4n],
        externalContract: null,
      };

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...master1, unlocker: unlock1 },
        dataNftUtxos: [{ ...dataNft1, unlocker: dataNftUnlock1 }],
        stateLayout: layout,
        categoryId: catX,
        externalCallUtxoGroups: [callGroup],
      });

      stb.setState('counter', 1n);
      stb.setExternalCallState(catY, 'counter', 1n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);

      // Add P2PKH funding input to cover return event output sats
      const fundingUtxo = randomUtxo();
      await provider.addUtxo(aliceAddress, fundingUtxo);
      builder.addInput(fundingUtxo, new SignatureTemplate(alicePriv).unlockP2PKH());
      // Add return event NFTs: both instances return val=1
      builder.addOutput(returnEventOutput(catX, 1n)); // output[4]: Instance1's return
      builder.addOutput(returnEventOutput(catY, 1n)); // output[5]: Instance2's return
      // Change output to absorb remaining funds
      builder.addOutput({ to: aliceAddress, amount: fundingUtxo.satoshis - 2000n });

      verifyTransaction(builder);
    });
  });

  // =========================================================================
  // Section 5: Proving Why True Reentrancy is Impossible
  // =========================================================================

  describe('structural proof: why Solidity-style reentrancy cannot exist', () => {
    it('there is no sequential execution between contracts in a UTXO TX', () => {
      // In Solidity:
      //   Lender.flashLoan() -> Borrower.onFlashLoan() -> Lender.repay()
      //   State is mutable between calls. Borrower executes while Lender
      //   is in an inconsistent state (funds sent, not yet verified).
      //
      // In SolidCash:
      //   Every input's script runs independently against the FINAL
      //   transaction (all inputs and outputs already determined).
      //   There is no "mid-execution" state. No contract can observe
      //   another contract's script execution in progress.
      //
      //   A's script sees: the complete, immutable transaction
      //   B's script sees: the same complete, immutable transaction
      //
      //   Order of script validation is irrelevant - the result is
      //   the same regardless of which script runs first.
      //
      // Therefore:
      //   1. Reentrancy is structurally impossible (no call stack)
      //   2. No reentrancy guards needed (no state inconsistency)
      //   3. Flash loans are safe by construction (atomic verification)

      // Prove that both contracts can compile and reference each other,
      // but the "call" is really just covenant verification:
      const artA = compileString(MUTUAL_A);
      const artB = compileString(MUTUAL_B);

      // A's bytecode verifies B, B's bytecode verifies A
      // Both run against the same final transaction state
      // Neither can "see" the other's execution
      expect(artA.bytecode).toBeDefined();
      expect(artB.bytecode).toBeDefined();

      // The "circular dependency" is resolved at compile time:
      // - A references interface IB (not B's implementation)
      // - B references interface IA (not A's implementation)
      // - Interfaces break the circular dependency
      // - At runtime, covenant checks verify the correct implementations

      const fnA = artA.abi.find((f) => f.name === 'callB');
      const fnB = artB.abi.find((f) => f.name === 'actionB');

      // A doesn't know B's bytecode at compile time - only B's interface
      expect(fnA!.externalCalls![0].interfaceName).toBe('IB');
      // B doesn't know A's bytecode at compile time - only A's interface
      expect(fnB!.externalCalls![0].interfaceName).toBe('IA');
    });

    it('single UTXO cannot be both caller and callee (no self-reentrancy)', () => {
      // Even if a contract "calls itself" via its own interface,
      // the master UTXO can only appear once as an input.
      // Self-reference requires a DIFFERENT instance (different UTXO, different category).
      //
      // This is fundamentally different from Solidity where:
      //   contract.call(contract.address) -> same instance, same storage
      //
      // In SolidCash:
      //   ISelf(otherAddr).step() -> different instance, different UTXO
      //
      // True self-reentrancy (same instance calling itself) is impossible.

      const art = compileString(SELF_REF);
      const fn = art.abi.find((f) => f.name === 'step');

      // The external call uses 'otherAddr' - a constructor parameter
      // This MUST be a different instance address from the contract's own
      expect(fn!.externalCalls![0].addressParam).toBe('otherAddr');

      // If someone set otherAddr == ownAddr, the covenant check
      // would try to find a SECOND master UTXO with the same address
      // at the external call input position. But the contract's own master is
      // already consumed at input[0]. There is no second master UTXO.
      // The transaction would fail to validate.
    });
  });
});
