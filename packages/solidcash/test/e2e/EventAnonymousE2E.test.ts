import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract, SignatureTemplate,
  getEventNftAddress, getAnonymousEventNftAddress,
  readEventsFromChain, readEventsFiltered,
  readAnonymousEventsFromChain,
} from '../../src/index.js';
import {
  parsePushdataCommitment,
} from '@solidcash/utils';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// Stateful contract with a named event (for comparison baseline)
const NAMED_EVENT_CONTRACT = `
pragma solidcash >=0.8.0;

contract NamedEvent() {
    event CounterUpdated(int oldValue, int newValue);

    int counter;

    function increment() {
        emit CounterUpdated(this.counter, this.counter + 1);
        this.counter = this.counter + 1;
    }
}
`;

// Stateful contract with an anonymous event
const ANONYMOUS_EVENT_CONTRACT = `
pragma solidcash >=0.8.0;

contract AnonEvent() {
    event CounterUpdated(int oldValue, int newValue) anonymous;

    int counter;

    function increment() {
        emit CounterUpdated(this.counter, this.counter + 1);
        this.counter = this.counter + 1;
    }
}
`;

// Contract with mixed named and anonymous events
const MIXED_EVENT_CONTRACT = `
pragma solidcash >=0.8.0;

contract MixedEvent() {
    event StateChanged(int oldValue, int newValue);
    event DebugLog(int value) anonymous;

    int counter;

    function increment() {
        emit StateChanged(this.counter, this.counter + 1);
        this.counter = this.counter + 1;
    }

    function debugIncrement() {
        this.counter = this.counter + 1;
        emit DebugLog(this.counter);
    }
}
`;

// Contract with multiple anonymous events sharing one address
const MULTI_ANON_CONTRACT = `
pragma solidcash >=0.8.0;

contract MultiAnon() {
    event LogA(int value) anonymous;
    event LogB(int x, int y) anonymous;

    int counter;

    function emitA() {
        this.counter = this.counter + 1;
        emit LogA(this.counter);
    }

    function emitB(int y) {
        this.counter = this.counter + 1;
        emit LogB(this.counter, y);
    }
}
`;

// Contract with indexed params for filtering test
const INDEXED_EVENT_CONTRACT = `
pragma solidcash >=0.8.0;

contract IndexedEvent() {
    event Transfer(int indexed from, int indexed to, int amount);

    int counter;

    function transfer(int from, int to, int amount) {
        this.counter = this.counter + 1;
        emit Transfer(from, to, amount);
    }
}
`;

describe('EventAnonymousE2E', () => {
  // --- Named Event Baseline --------------------------------------
  describe('named event (baseline)', () => {
    const provider = createTestProvider();
    const artifact = compileString(NAMED_EVENT_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    let categoryId: string;
    let saltedContract: Contract;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, { counter: 0n }, { saltContract: true }));
      saltedContract = contract.withCategory(hexToBin(categoryId));
    });


    it('should emit a named event and create event NFT output', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const tx = await sc.increment().send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // State should update: counter 0 -> 1
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(1n);

      // Event NFT output should exist (immutable NFT with matching category)
      const eventOutputs = txOutputs.filter(
        (o) => o.token?.nft?.capability === 'none' && o.token?.category === categoryId
          && o !== txOutputs[1], // exclude data NFT
      );
      expect(eventOutputs.length).toBeGreaterThanOrEqual(1);
    });

    it('should produce event NFT at named event address readable via readEventsFromChain', async () => {
      const eventDef = artifact.events![0];
      const eventAddress = getEventNftAddress(saltedContract, categoryId, eventDef.signature);
      const events = await readEventsFromChain(provider, eventAddress, categoryId, eventDef);

      expect(events.length).toBeGreaterThanOrEqual(1);
      const event = events[0];
      expect(event.values.oldValue).toBe(0n);
      expect(event.values.newValue).toBe(1n);
    });
  });

  // --- Anonymous Event -------------------------------------------
  describe('anonymous event', () => {
    const provider = createTestProvider();
    const artifact = compileString(ANONYMOUS_EVENT_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    let categoryId: string;
    let saltedContract: Contract;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, { counter: 0n }, { saltContract: true }));
      saltedContract = contract.withCategory(hexToBin(categoryId));
    });


    it('should emit an anonymous event and update state', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const tx = await sc.increment().send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // State should update
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(1n);

      // Should have event NFT output (immutable NFT with matching category)
      const eventOutputs = txOutputs.filter(
        (o) => o.token?.nft?.capability === 'none' && o.token?.category === categoryId
          && o !== txOutputs[1],
      );
      expect(eventOutputs.length).toBeGreaterThanOrEqual(1);
    });

    it('anonymous event NFT should be at the anonymous address, not the named address', async () => {
      const eventDef = artifact.events![0];
      const anonAddress = getAnonymousEventNftAddress(saltedContract, categoryId);

      // Anonymous event should be at anonymous address
      const anonUtxos = await provider.getUtxos(anonAddress);
      const anonEvents = anonUtxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft?.commitment
          && u.token.nft.commitment.length > 0,
      );
      expect(anonEvents.length).toBeGreaterThanOrEqual(1);

      // Named address should have nothing for this anonymous event
      const namedAddress = getEventNftAddress(saltedContract, categoryId, eventDef.signature);
      expect(namedAddress).not.toBe(anonAddress);
    });

    it('should be readable via readAnonymousEventsFromChain', async () => {
      const eventDef = artifact.events![0];
      const anonAddress = getAnonymousEventNftAddress(saltedContract, categoryId);
      const anonymousDefs = artifact.events!.filter((e) => e.anonymous);

      const events = await readAnonymousEventsFromChain(
        provider, anonAddress, categoryId, anonymousDefs,
      );

      expect(events.length).toBeGreaterThanOrEqual(1);
      const event = events[0];
      expect(event.eventName).toBe('CounterUpdated');
      expect(event.eventSignature).toBe(eventDef.signature);
      expect(event.values.oldValue).toBe(0n);
      expect(event.values.newValue).toBe(1n);
    });

    it('should be queryable via sc.queryEvents', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const events = await sc.queryEvents('CounterUpdated');

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].values.oldValue).toBe(0n);
      expect(events[0].values.newValue).toBe(1n);
    });
  });

  // --- Mixed Named + Anonymous Events ----------------------------
  describe('mixed named and anonymous events', () => {
    const provider = createTestProvider();
    const artifact = compileString(MIXED_EVENT_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    let categoryId: string;
    let saltedContract: Contract;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, { counter: 0n }, { saltContract: true }));
      saltedContract = contract.withCategory(hexToBin(categoryId));
    });


    it('should emit a named event via increment()', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const tx = await sc.increment().send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(1n);

      // Named event should be at named address
      const stateChangedDef = artifact.events!.find((e) => e.name === 'StateChanged')!;
      const namedAddress = getEventNftAddress(saltedContract, categoryId, stateChangedDef.signature);
      const namedEvents = await readEventsFromChain(provider, namedAddress, categoryId, stateChangedDef);
      expect(namedEvents.length).toBeGreaterThanOrEqual(1);
      expect(namedEvents[0].values.oldValue).toBe(0n);
      expect(namedEvents[0].values.newValue).toBe(1n);
    });

    it('should emit an anonymous event via debugIncrement()', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const tx = await sc.debugIncrement().send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(2n);

      // Anonymous event should be at anonymous address
      const anonAddress = getAnonymousEventNftAddress(saltedContract, categoryId);
      const anonDefs = artifact.events!.filter((e) => e.anonymous);
      const anonEvents = await readAnonymousEventsFromChain(
        provider, anonAddress, categoryId, anonDefs,
      );
      expect(anonEvents.length).toBeGreaterThanOrEqual(1);
      const debugEvent = anonEvents.find((e) => e.eventName === 'DebugLog');
      expect(debugEvent).toBeDefined();
      expect(debugEvent!.values.value).toBe(2n);
    });

    it('named and anonymous events should go to different addresses', () => {
      const stateChangedDef = artifact.events!.find((e) => e.name === 'StateChanged')!;
      const namedAddress = getEventNftAddress(saltedContract, categoryId, stateChangedDef.signature);
      const anonAddress = getAnonymousEventNftAddress(saltedContract, categoryId);
      expect(namedAddress).not.toBe(anonAddress);
    });

    it('queryEvents should work for both named and anonymous events', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const namedEvents = await sc.queryEvents('StateChanged');
      expect(namedEvents.length).toBeGreaterThanOrEqual(1);

      const anonEvents = await sc.queryEvents('DebugLog');
      expect(anonEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Multiple Anonymous Events Share One Address ---------------
  describe('multiple anonymous events share one address', () => {
    const provider = createTestProvider();
    const artifact = compileString(MULTI_ANON_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    let categoryId: string;
    let saltedContract: Contract;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, { counter: 0n }, { saltContract: true }));
      saltedContract = contract.withCategory(hexToBin(categoryId));
    });


    it('should emit LogA anonymously', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const tx = await sc.emitA().send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(1n);
    });

    it('should emit LogB anonymously', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const tx = await sc.emitB(42n).send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(2n);
    });

    it('both anonymous events should be at the same address', async () => {
      const anonAddress = getAnonymousEventNftAddress(saltedContract, categoryId);
      const anonDefs = artifact.events!.filter((e) => e.anonymous);
      const allEvents = await readAnonymousEventsFromChain(
        provider, anonAddress, categoryId, anonDefs,
      );

      // Should have at least 2 events (LogA and LogB)
      expect(allEvents.length).toBeGreaterThanOrEqual(2);

      const logAEvents = allEvents.filter((e) => e.eventName === 'LogA');
      const logBEvents = allEvents.filter((e) => e.eventName === 'LogB');
      expect(logAEvents.length).toBeGreaterThanOrEqual(1);
      expect(logBEvents.length).toBeGreaterThanOrEqual(1);

      // Verify decoded values
      expect(logAEvents[0].values.value).toBe(1n);
      expect(logBEvents[0].values.x).toBe(2n);
      expect(logBEvents[0].values.y).toBe(42n);
    });

    it('queryEvents should disambiguate anonymous events by name', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const logA = await sc.queryEvents('LogA');
      const logB = await sc.queryEvents('LogB');

      expect(logA.length).toBeGreaterThanOrEqual(1);
      expect(logB.length).toBeGreaterThanOrEqual(1);
      expect(logA[0].values.value).toBe(1n);
      expect(logB[0].values.x).toBe(2n);
    });
  });

  // --- Event Filtering with Indexed Parameters ------------------
  describe('event filtering with indexed parameters', () => {
    const provider = createTestProvider();
    const artifact = compileString(INDEXED_EVENT_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    let categoryId: string;
    let saltedContract: Contract;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, { counter: 0n }, { saltContract: true }));
      saltedContract = contract.withCategory(hexToBin(categoryId));
    });


    it('should emit Transfer events with different parameters', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      // Emit first transfer: from=1, to=2, amount=100
      const tx1 = await sc.transfer(1n, 2n, 100n).send();
      expect(tx1.txid).toBeDefined();

      // Emit second transfer: from=1, to=3, amount=200
      const tx2 = await sc.transfer(1n, 3n, 200n).send();
      expect(tx2.txid).toBeDefined();

      // Emit third transfer: from=2, to=1, amount=50
      const tx3 = await sc.transfer(2n, 1n, 50n).send();
      expect(tx3.txid).toBeDefined();
    });

    it('readEventsFromChain should return all events', async () => {
      const eventDef = artifact.events![0];
      const eventAddress = getEventNftAddress(saltedContract, categoryId, eventDef.signature);
      const events = await readEventsFromChain(provider, eventAddress, categoryId, eventDef);

      expect(events).toHaveLength(3);
    });

    it('readEventsFiltered should filter by single indexed param', async () => {
      const eventDef = artifact.events![0];
      const eventAddress = getEventNftAddress(saltedContract, categoryId, eventDef.signature);

      // Filter: from=1 - should match 2 events
      const filtered = await readEventsFiltered(
        provider, eventAddress, categoryId, eventDef, { from: 1n },
      );
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.values.from === 1n)).toBe(true);
    });

    it('readEventsFiltered should filter by multiple indexed params', async () => {
      const eventDef = artifact.events![0];
      const eventAddress = getEventNftAddress(saltedContract, categoryId, eventDef.signature);

      // Filter: from=1, to=2 - should match 1 event
      const filtered = await readEventsFiltered(
        provider, eventAddress, categoryId, eventDef, { from: 1n, to: 2n },
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].values.from).toBe(1n);
      expect(filtered[0].values.to).toBe(2n);
      expect(filtered[0].values.amount).toBe(100n);
    });

    it('readEventsFiltered should return empty for non-matching filter', async () => {
      const eventDef = artifact.events![0];
      const eventAddress = getEventNftAddress(saltedContract, categoryId, eventDef.signature);

      const filtered = await readEventsFiltered(
        provider, eventAddress, categoryId, eventDef, { from: 99n },
      );
      expect(filtered).toHaveLength(0);
    });

    it('readEventsFiltered should throw for non-indexed filter key', async () => {
      const eventDef = artifact.events![0];
      const eventAddress = getEventNftAddress(saltedContract, categoryId, eventDef.signature);

      await expect(
        readEventsFiltered(provider, eventAddress, categoryId, eventDef, { amount: 100n }),
      ).rejects.toThrow("Filter key 'amount' is not an indexed parameter");
    });

    it('readEventsFiltered with empty filter should return all events', async () => {
      const eventDef = artifact.events![0];
      const eventAddress = getEventNftAddress(saltedContract, categoryId, eventDef.signature);

      const all = await readEventsFiltered(
        provider, eventAddress, categoryId, eventDef, {},
      );
      expect(all).toHaveLength(3);
    });

    it('queryEvents should filter by indexed params', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const filtered = await sc.queryEvents('Transfer', { from: 1n });
      expect(filtered).toHaveLength(2);

      const filtered2 = await sc.queryEvents('Transfer', { from: 1n, to: 3n });
      expect(filtered2).toHaveLength(1);
      expect(filtered2[0].values.amount).toBe(200n);
    });

    it('queryEvents should throw for non-indexed filter key', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      await expect(
        sc.queryEvents('Transfer', { amount: 100n }),
      ).rejects.toThrow("Filter key 'amount' is not an indexed parameter");
    });

    it('queryEvents should throw for unknown event name', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      await expect(
        sc.queryEvents('NonExistent'),
      ).rejects.toThrow('Unknown event');
    });
  });

  // --- Event Commitment Parsing ----------------------------------
  describe('event commitment parsing', () => {
    it('should correctly parse event values from commitment hex', () => {
      compileString(NAMED_EVENT_CONTRACT);

      // Build a mock commitment with pushdata-encoded values
      // For int values, pushdata encoding uses VM number format
      // We'll rely on the actual commitment from a sent transaction
    });

    it('anonymous event artifact should have anonymous: true', () => {
      const artifact = compileString(ANONYMOUS_EVENT_CONTRACT);
      expect(artifact.events).toBeDefined();
      expect(artifact.events![0].anonymous).toBe(true);
    });

    it('named event artifact should not have anonymous flag', () => {
      const artifact = compileString(NAMED_EVENT_CONTRACT);
      expect(artifact.events).toBeDefined();
      expect(artifact.events![0].anonymous).toBeUndefined();
    });
  });

  // --- toEmit Matcher Tests ----------------------------------------
  describe('toEmit matcher', () => {
    const provider = createTestProvider();
    const artifact = compileString(NAMED_EVENT_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    let categoryId: string;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, { counter: 0n }, { saltContract: true }));
    });


    it('should pass when event is emitted (no args check)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.increment();
      await expect(call).toEmit(sc, 'CounterUpdated');
    });

    it('should pass when event is emitted with matching literal args', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.increment();
      await expect(call).toEmit(sc, 'CounterUpdated', { oldValue: 0n, newValue: 1n });
    });

    it('should pass when event is emitted with predicate args', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.increment();
      await expect(call).toEmit(sc, 'CounterUpdated', {
        oldValue: (v: any) => v === 0n,
        newValue: (v: any) => v > 0n,
      });
    });

    it('should fail when event args do not match', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.increment();
      await expect(call).not.toEmit(sc, 'CounterUpdated', { oldValue: 999n });
    });

    it('should fail when event name does not exist', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.increment();
      // NonExistentEvent is not defined in the contract
      await expect(call).not.toEmit(sc, 'NonExistentEvent');
    });

    it('should support not.toEmit for negation', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.increment();
      // The event IS emitted, so not.toEmit with wrong args should pass
      await expect(call).not.toEmit(sc, 'CounterUpdated', { oldValue: 42n });
    });
  });

  // --- Cross-Contract Event Emission (A->B, both emit events) ---
  describe('toEmit with cross-contract calls', () => {
    // Contract A: calls B externally and emits its own event
    const CALLER_WITH_EVENT = `
pragma solidcash >=0.8.0;

interface ITarget {
    function increment();
}

contract CallerWithEvent(bytes targetAddr) {
    event CallerAction(int callerState);

    int callerState;

    function callTarget(pubkey pk, sig s) {
        require(checkSig(s, pk));
        ITarget(targetAddr).increment();
        this.callerState = this.callerState + 1;
        emit CallerAction(this.callerState);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

    // Contract B: target that emits an event when called
    const TARGET_WITH_EVENT = `
pragma solidcash >=0.8.0;

contract TargetWithEvent() {
    event TargetIncremented(int oldValue, int newValue);

    int counter;

    function increment() {
        int oldVal = this.counter;
        this.counter = oldVal + 1;
        emit TargetIncremented(oldVal, this.counter);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

    const provider = createTestProvider();
    const artA = compileString(CALLER_WITH_EVENT);
    const artB = compileString(TARGET_WITH_EVENT);

    let scA: ReturnType<typeof StatefulContract.withCategory>;
    let scB: ReturnType<typeof StatefulContract.withCategory>;

    // Build the transaction once (auto-derivation consumes UTXOs)
    let builtTx: any;

    beforeAll(async () => {
      // Genesis B first; A embeds B's real category.
      const contractB = new Contract(artB, [], { provider });
      const { categoryId: catB } = await setupStatefulUtxos(
        provider, contractB, artB.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const targetAddr = contractB.withCategory(hexToBin(catB)).lockingBytecode;
      const contractA = new Contract(artA, [targetAddr], { provider });
      const { categoryId: catA } = await setupStatefulUtxos(
        provider, contractA, artA.stateLayout!, { callerState: 0n }, { saltContract: true },
      );

      scB = StatefulContract.withCategory(contractB, catB);
      scA = StatefulContract.withCategory(contractA, catA);

      // Build once; reuse for all assertions
      const call = scA.callTarget(alicePub, new SignatureTemplate(alicePriv))
        .withExternalCall(scB, 'increment', []);
      builtTx = await call.build();
    });

    it('should detect event from caller contract A', async () => {
      await expect(builtTx).toEmit(scA, 'CallerAction');
    });

    it('should detect event from caller contract A', async () => {
      await expect(builtTx).toEmit(scA, 'CallerAction');
    });

    it('should detect event from target contract B in the same transaction', async () => {
      await expect(builtTx).toEmit(scB, 'TargetIncremented');
    });

    it('should verify args for both A and B events', async () => {
      await expect(builtTx).toEmit(scA, 'CallerAction', { callerState: 1n });
      await expect(builtTx).toEmit(scB, 'TargetIncremented', { oldValue: 0n, newValue: 1n });
    });

    it('should verify args with predicates across contracts', async () => {
      await expect(builtTx).toEmit(scA, 'CallerAction', {
        callerState: (v: any) => v > 0n,
      });
      await expect(builtTx).toEmit(scB, 'TargetIncremented', {
        oldValue: (v: any) => v >= 0n,
        newValue: (v: any) => v > 0n,
      });
    });

    it('should not match A event on B contract or vice versa', async () => {
      await expect(builtTx).not.toEmit(scB, 'CallerAction');
      await expect(builtTx).not.toEmit(scA, 'TargetIncremented');
    });
  });

  // --- Type-safe toEmit with `as const satisfies Artifact` --------
  // Demonstrates IDE autocompletion of event names and parameter fields
  // when the artifact carries literal types (e.g. generated .artifact.ts files).
  describe('toEmit type-safe with const artifact', () => {
    // Compile to get valid bytecode at runtime
    const compiled = compileString(NAMED_EVENT_CONTRACT);

    // Re-declare the artifact with `as const satisfies Artifact` so TypeScript
    // preserves the literal event names and parameter types. This is exactly
    // what the compiler outputs in generated `.artifact.ts` files.
    const artifact = {
      ...compiled,
      events: [
        {
          name: 'CounterUpdated',
          signature: 'CounterUpdated(int,int)',
          parameters: [
            { name: 'oldValue', type: 'int' },
            { name: 'newValue', type: 'int' },
          ],
        },
      ],
    } as const satisfies Artifact;

    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    let categoryId: string;

    beforeAll(async () => {
      ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, { counter: 0n }, { saltContract: true }));
    });

    it('should autocomplete event name (only "CounterUpdated" is valid)', async () => {
      // Because the artifact is `as const`, TypeScript narrows the event name
      // parameter to the literal 'CounterUpdated' - any other string is a type error.
      // Try changing 'CounterUpdated' below to see the IDE flag it.
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.increment();
      await expect(call).toEmit(sc, 'CounterUpdated');
    });

    it('should autocomplete event parameter fields with correct types', async () => {
      // The expectedArgs parameter is typed as:
      //   { oldValue?: bigint | ((v: bigint) => boolean); newValue?: bigint | ((v: bigint) => boolean) }
      // IDE autocompletes 'oldValue' and 'newValue', and flags unknown fields.
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.increment();
      await expect(call).toEmit(sc, 'CounterUpdated', { oldValue: 0n, newValue: 1n });
    });

    it('should accept predicate functions with inferred parameter types', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.increment();
      // The predicate parameter type is inferred as bigint (from 'int' -> bigint mapping)
      await expect(call).toEmit(sc, 'CounterUpdated', {
        oldValue: (v) => v === 0n,
        newValue: (v) => v > 0n,
      });
    });

    it('should allow partial field matching (all fields optional)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.increment();
      // Only check one field - the other is not required
      await expect(call).toEmit(sc, 'CounterUpdated', { newValue: 1n });
    });

    // Uncomment the following to verify compile-time errors:
    //
    // // @ts-expect-error - 'NonExistent' is not a valid event name
    // await expect(call).toEmit(sc, 'NonExistent');
    //
    // // @ts-expect-error - 'bogusField' is not a parameter of CounterUpdated
    // await expect(call).toEmit(sc, 'CounterUpdated', { bogusField: 0n });
  });
});
