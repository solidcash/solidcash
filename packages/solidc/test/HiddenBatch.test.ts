import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti, compileStringSplit } from '../src/index.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract BatchCounter() {
  int counter;
  function add(int n) public { this.counter = this.counter + n; require(n >= 0); }
  function reset() public { this.counter = 0; require(true); }
  function signed(sig s, pubkey pk) public { require(checkSig(s, pk)); }
}`;

describe('Release 4 compiler-hidden local batch', () => {
  const graphOptions = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
    experimentalMessageBusControllerCategory: '22'.repeat(32),
  };

  it('advertises SCB1 without exposing a source ABI function', () => {
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    expect(artifact.hiddenBatch).toMatchObject({
      version: 1,
      selector: '53434231',
      maximumRows: 8,
      maximumBlobBytes: 223,
    });
    expect(artifact.abi.some((fn) => fn.name === '__scb1')).toBe(false);
    expect(artifact.hiddenBatch?.route.selector).toBe('53434231');
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'signed')).toMatchObject({
      eligible: false,
      rejectionReason: 'transaction-signature-route-binding-required',
    });

    const graphArtifact = compileString(SOURCE, graphOptions);
    expect(graphArtifact.hiddenBatch?.handlers.find((handler) => handler.name === 'signed')).toMatchObject({
      eligible: true,
    });
    expect(graphArtifact.hiddenBatch?.handlers.find((handler) => handler.name === 'signed')
      ?.signatureBytecode).toMatch(/^[0-9a-f]+$/);
    expect(graphArtifact.hiddenBatch?.route.inputs.filter((input) =>
      input.name.startsWith('__scb_sig_')).map((input) => input.name)).toEqual(
      Array.from({ length: 8 }, (_unused, row) => `__scb_sig_2_0_r${row}`),
    );
  });

  it('admits a uniform multi-event row width and rejects ambiguous flattened heterogeneous widths', () => {
    const uniform = compileString(`contract Events() {
      event E(bytes payload);
      function publish(bytes payload) public {
        emit E(payload);
        emit E(payload);
        require(payload.length > 0);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(uniform.hiddenBatch?.handlers.find((handler) => handler.name === 'publish')).toMatchObject({
      eligible: true,
      emits: [{ emitIndex: 0 }, { emitIndex: 1 }],
    });

    const heterogeneous = compileString(`contract Events() {
      event E(bytes payload);
      function once(bytes payload) public { emit E(payload); require(payload.length > 0); }
      function twice(bytes payload) public {
        emit E(payload);
        emit E(payload);
        require(payload.length > 0);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(heterogeneous.hiddenBatch).toBeUndefined();
  });

  it('enables the hidden-batch capability by default, identically to explicit true', () => {
    const defaultOn = compileString(SOURCE, { forceStateful: true });
    const explicitUndefined = compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: undefined,
    });
    const explicitOn = compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    expect(defaultOn.bytecode).toBe(explicitOn.bytecode);
    expect(explicitUndefined.bytecode).toBe(explicitOn.bytecode);
    expect(defaultOn.hiddenBatch).toEqual(explicitOn.hiddenBatch);
    expect(explicitUndefined.hiddenBatch).toEqual(explicitOn.hiddenBatch);
    expect(defaultOn.hiddenBatch?.version).toBe(1);
    expect(defaultOn.compiler.options.experimentalHiddenBatch).toBe(true);
    expect(explicitUndefined.compiler.options.experimentalHiddenBatch).toBe(true);
  });

  it('retains an explicit false legacy/off path with no hidden-batch route', () => {
    const defaultOn = compileString(SOURCE, { forceStateful: true });
    const explicitOff = compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: false,
    });
    expect(explicitOff.bytecode).not.toBe(defaultOn.bytecode);
    expect(explicitOff.hiddenBatch).toBeUndefined();
    expect(explicitOff.compiler.options.experimentalHiddenBatch).toBe(false);
    expect(explicitOff.diagnostics?.some((entry) => entry.code === 'hidden-batch-route-not-synthesized'))
      .not.toBe(true);
  });

  it('normalizes default-on and explicit-off behavior through multi-contract and split entry points', () => {
    const multiDefault = compileStringMulti(SOURCE, { forceStateful: true }).BatchCounter;
    const multiOn = compileStringMulti(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    }).BatchCounter;
    const multiOff = compileStringMulti(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: false,
    }).BatchCounter;
    expect(multiDefault.bytecode).toBe(multiOn.bytecode);
    expect(multiDefault.hiddenBatch).toEqual(multiOn.hiddenBatch);
    expect(multiOff.hiddenBatch).toBeUndefined();

    const splitDefault = compileStringSplit(SOURCE, { forceStateful: true });
    const splitOn = compileStringSplit(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    const splitOff = compileStringSplit(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: false,
    });
    expect(splitDefault.root.bytecode).toBe(splitOn.root.bytecode);
    expect(splitDefault.root.hiddenBatch).toEqual(splitOn.root.hiddenBatch);
    expect(splitOff.root.hiddenBatch).toBeUndefined();
  });

  it('fails closed on deferred caller context and forward-call semantics', () => {
    const artifact = compileString(`
      interface IDownstream { function ping(); }
      contract Guarded(address downstream) {
        int counter;
        function senderBound() public { this.counter = 1; require(msg.sender != tx.origin); }
        function forward() public {
          IDownstream(downstream).ping();
          this.counter = 2;
          require(true);
        }
        function plain(int n) public { this.counter = n; require(n >= 0); }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });

    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'senderBound')).toMatchObject({
      eligible: false,
      rejectionReason: 'direct-versus-batch-introspection-divergence',
      inputs: [],
    });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'forward')).toMatchObject({
      eligible: false,
      rejectionReason: 'batched-handler-forward-call-not-enabled',
      inputs: [],
    });
  });

  it('admits owner input index while conformingly rejecting active bytecode and unauthenticated tx.origin', () => {
    const artifact = compileString(`
      contract StableOwnerContext() {
        function stable(int expectedInput) public {
          require(this.activeInputIndex == expectedInput);
        }
        function bytecodeBound(bytes expectedBytecode) public {
          require(this.activeBytecode == expectedBytecode);
        }
        function originBound(address expected) public {
          require(tx.origin == expected);
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'stable'))
      .toMatchObject({ eligible: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'bytecodeBound'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'direct-versus-batch-introspection-divergence',
      });
    expect(artifact.hiddenBatch?.handlers.filter((handler) => handler.eligible)
      .map((handler) => handler.name)).not.toContain('bytecodeBound');
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'originBound'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'direct-versus-batch-introspection-divergence',
      });
  });

  it('admits tx.origin when the graph controller authenticates the carrier signer', () => {
    const artifact = compileString(`
      contract OriginContext() {
        function originBound(address expected) public { require(tx.origin == expected); }
      }
    `, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'originBound'))
      .toMatchObject({ eligible: true });
  });

  it('authenticates forwarded and compiler-evaluated graph call arguments', () => {
    const exact = compileString(`
      interface IB { function ping(int n); }
      contract A() {
        function start(address target, int n) public {
          IB(target).ping(n);
          require(true);
        }
      }
    `, graphOptions);
    expect(exact.hiddenBatch?.handlers.find((handler) => handler.name === 'start')?.eligible).toBe(true);

    const transformed = compileString(`
      interface IB { function ping(int n); }
      contract A() {
        function start(address target, int n) public {
          IB(target).ping(n + 1);
          require(true);
        }
      }
    `, graphOptions);
    expect(transformed.hiddenBatch?.handlers.find((handler) => handler.name === 'start')?.eligible)
      .toBe(true);
  });

  it('binds one parameter-keyed mapping entry into the physical SCB1 route', () => {
    const artifact = compileString(`contract MappingBatch() {
      mapping(bigint => bigint) values;
      function add(bigint key, bigint amount) public {
        this.values[key] = this.values[key] + amount;
        require(amount >= 0);
      }
      function check(bigint key, bigint expected) public {
        require(this.values[key] == expected);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });

    expect(artifact.hiddenBatch?.route.inputs).toEqual([
      { name: 'batchBlob', type: 'bytes' },
      { name: '__scb_key_values_0', type: 'bigint' },
    ]);
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(1);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'add'))
      .toMatchObject({
        eligible: true,
        batchKeyWitnesses: [{ routeInput: '__scb_key_values_0', inputIndex: 0 }],
      });
  });

  it('allocates one exact two-row resource shape for shared and row-local mapping keys', () => {
    const artifact = compileString(`contract MappingAliasBatch() {
      mapping(bigint => bigint) values;
      function move(bigint from, bigint to, bigint amount) public {
        this.values[from] = this.values[from] - amount;
        this.values[to] = this.values[to] + amount;
        require(amount >= 0);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch).toMatchObject({
      minimumRows: 2,
      maximumRows: 2,
    });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'move'))
      .toMatchObject({
        eligible: true,
        batchKeyWitnesses: [
          // Witnesses name the physical entry (collection, key position, shared-versus-row-local), never the
          // handler, so a second handler over the same entry resolves to the same route input.
          { routeInput: '__scb_key_values_0', inputIndex: 0 },
          { routeInput: '__scb_key_values_0_row', inputIndex: 1, perRow: true },
        ],
      });
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(3);
  });

  it('advertises the exact ERC-20 transferFrom resource shape', () => {
    const source = `contract MappingToken() {
      mapping(bytes20 => bigint) balances;
      mapping(bytes20 => mapping(bytes20 => bigint)) allowances;

      function transferFrom(
        bytes20 from, bytes20 to, bytes20 spender, bigint amount
      ) public {
        require(this.allowances[from][spender] >= amount);
        require(this.balances[from] >= amount);
        this.allowances[from][spender] = this.allowances[from][spender] - amount;
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
      }
    }`;
    const artifact = compileString(source, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });

    expect(artifact.hiddenBatch).toMatchObject({
      minimumRows: 2,
      maximumRows: 2,
    });
    expect(artifact.hiddenBatch?.handlers[0]).toMatchObject({
      name: 'transferFrom',
      eligible: true,
      batchKeyWitnesses: [
        { routeInput: '__scb_key_allowances_0', inputIndex: 0 },
        { routeInput: '__scb_key_allowances_1', inputIndex: 2 },
        { routeInput: '__scb_key_balances_0', inputIndex: 0 },
        { routeInput: '__scb_key_balances_0_row', inputIndex: 1, perRow: true },
      ],
    });
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(4);
    expect(artifact.bytecode.length / 2).toBeLessThan(10_000);
  });

  it('binds an ERC-20 allowance key to the authenticated graph msg.sender', () => {
    const artifact = compileString(`
      contract CallerAuthorizedToken() {
        mapping(address => bigint) balances;
        mapping(address => mapping(address => bigint)) allowances;

        function transferFrom(address from, address to, bigint amount) public {
          require(this.allowances[from][msg.sender] >= amount);
          require(this.balances[from] >= amount);
          this.allowances[from][msg.sender] = this.allowances[from][msg.sender] - amount;
          this.balances[from] = this.balances[from] - amount;
          this.balances[to] = this.balances[to] + amount;
        }
      }
    `, graphOptions);
    expect(artifact.hiddenBatch?.handlers.find((handler) =>
      handler.name === 'transferFrom')).toMatchObject({
      eligible: true,
      batchKeyWitnesses: expect.arrayContaining([
        expect.objectContaining({
          routeInput: '__scb_key_allowances_sender_1',
          inputIndex: -1,
          source: 'msgSender',
        }),
      ]),
    });
    expect(artifact.hiddenBatch?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__scb_key_allowances_sender_1',
      type: 'address',
    }));
  });

  it('journals a msg.sender-keyed resource handler behind one spender parameter', () => {
    const artifact = compileString(`
      contract CallerAuthorizedToken() {
        mapping(address => bigint) balances;
        mapping(address => mapping(address => bigint)) allowances;

        function transferFrom(address from, address to, bigint amount) public {
          require(this.allowances[from][msg.sender] >= amount);
          require(this.balances[from] >= amount);
          this.allowances[from][msg.sender] = this.allowances[from][msg.sender] - amount;
          this.balances[from] = this.balances[from] - amount;
          this.balances[to] = this.balances[to] + amount;
        }
      }
    `, graphOptions);
    // Both rows settle one physical allowance entry, so the batched clone has to become a value-threaded journal
    // handler: keying it on `msg.sender` instead would make each row read and flush that entry on its own, and
    // two rows would then demand two different post-states from the same output.
    expect(artifact.hiddenBatch?.route.inputs.map((input) => input.name))
      .toContain('__scb_key_allowances_sender_1');
    // One C2 batch group per distinct entry: allowance, balances[from], then balances[to] once per row.
    const batchGroups = artifact.hiddenBatch!.route.inputs
      .filter((input) => input.name.startsWith('__internal__c2BatchSlot_'));
    expect(batchGroups.map((input) => input.name)).toEqual([
      '__internal__c2BatchSlot_0',
      '__internal__c2BatchSlot_1',
      '__internal__c2BatchSlot_2',
      '__internal__c2BatchSlot_3',
    ]);
    // The direct entry point keeps reading msg.sender; only the batched clone takes the spender as an argument.
    expect(artifact.source).toContain('msg.sender');
    expect(artifact.abi.map((fn) => fn.name)).toContain('transferFrom');
  });

  it('synthesizes exactly one clone for a resource-shaped graph-tail handler', () => {
    const artifact = compileString(`
      interface ISink { function take(bigint amount); }
      contract SingleCloneToken(address sink) {
        mapping(address => bigint) balances;
        function move(address from, address to, bigint amount) public {
          this.balances[from] = this.balances[from] - amount;
          this.balances[to] = this.balances[to] + amount;
          ISink(sink).take(amount);
          require(true);
        }
      }
    `, graphOptions);
    // Two key alternatives on one collection make this resource-shaped, and the forwarded call makes it a graph
    // tail. Dispatch only ever reaches the resource clone, so cloning it a second time as `__scb_graph_move` left
    // a whole dead journal-handler body in the artifact.
    const functionNames = (artifact.invocationAnalysis?.functions ?? [])
      .map((fn) => fn.name);
    const cloneNames = functionNames.filter((name) => name.startsWith('__scb_resource_'));
    const transcriptCarriers = functionNames.filter((name) => name === '__scb_graph_transcript');
    // The exact-alias route has distinct stack arity and intentionally receives one compiler-owned clone.
    expect(cloneNames).toEqual(['__scb_resource_move', '__scb_resource_move_self_alias']);
    // The centralized graph transcript carrier is route infrastructure, not a second graph-tail clone.
    expect(transcriptCarriers).toEqual(['__scb_graph_transcript']);
  });

  it('keeps SCB1 row parsing exact once the parser is factored into helpers', () => {
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    // Shared `__scb_parse_row` / `__scb_parse_graph_caller` helpers must not relax the frame checks: row count,
    // blob exhaustion, positional call-site binding and unknown-selector rejection all still have to be emitted.
    const messages = (artifact.debug?.functionDebug?.['53434231']?.requires ?? [])
      .map((entry) => entry.message)
      .filter((message): message is string => message !== undefined);
    expect(messages).toContain('unknown batch selector');
    expect(artifact.hiddenBatch?.maximumRows).toBe(8);
    expect(artifact.hiddenBatch?.maximumBlobBytes).toBe(223);
    // The helpers are compiler-owned, so their parameters must not be able to collide with user identifiers.
    expect(() => compileString(`
      contract ParserNameCollision() {
        int total;
        function start(int n) public { this.total = this.total + n; require(n >= 0); }
        function blob(int n) public { this.total = this.total + n; require(n >= 0); }
      }
    `, graphOptions)).not.toThrow();
  });

  it('allocates one ordered conditional event slot per possible row', () => {
    const artifact = compileString(`contract EventBatch() {
      bigint current;
      event Changed(bigint next);
      function set(bigint next) public {
        this.current = next;
        emit Changed(next);
        require(next >= 0);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'set')?.eligible)
      .toBe(true);
    expect(artifact.hiddenBatch?.route.emits).toHaveLength(8);
    expect(artifact.hiddenBatch?.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'event')).toHaveLength(8);
    expect(artifact.bytecode.length / 2).toBeLessThan(10_000);
  });

  it('aggregates typed return fields per reached row into the route return event', () => {
    const artifact = compileString(`contract ResultBatch() {
      bigint total;
      function add(bigint amount) public returns (bigint) {
        this.total = this.total + amount;
        require(amount >= 0);
        return this.total;
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'add'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'bigint' }] });
    expect(artifact.hiddenBatch?.route.outputs).toEqual([{ type: 'bytes' }]);
    expect(artifact.hiddenBatch?.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'returnEvent')).toHaveLength(1);
    expect(artifact.bytecode.length / 2).toBeLessThan(10_000);
  });

  it('admits heterogeneous and tuple return schemas on one route', () => {
    const artifact = compileString(`contract HeterogeneousResults() {
      function number(bigint n) public pure returns (bigint) { return n + 1; }
      function flag(bool value) public pure returns (bool) { return !value; }
      function pair(bigint n) public pure returns (bigint, bool) { return (n, n > 0); }
      function touch() public pure { require(true); }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.map((handler) => ({
      name: handler.name, eligible: handler.eligible, outputs: handler.outputs,
    }))).toEqual([
      { name: 'number', eligible: true, outputs: [{ type: 'bigint' }] },
      { name: 'flag', eligible: true, outputs: [{ type: 'bool' }] },
      {
        name: 'pair', eligible: true,
        outputs: [{ type: 'bigint' }, { type: 'bool' }],
      },
      { name: 'touch', eligible: true, outputs: undefined },
    ]);
    expect(artifact.hiddenBatch?.route.outputs).toEqual([{ type: 'bytes' }]);
  });

  it('allocates one ordered conditional value-transfer slot per possible row', () => {
    const artifact = compileString(`contract ValueBatch() {
      function pay(bytes recipient, bigint amount) public {
        this.transfer(recipient, amount);
        require(amount >= 0);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'pay')?.eligible)
      .toBe(true);
    expect(artifact.hiddenBatch?.route.transferCount).toBe(8);
    expect(artifact.hiddenBatch?.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'transfer')).toHaveLength(8);
    expect(artifact.bytecode.length / 2).toBeLessThan(10_000);
  });

  it('admits bounded multi-row graph msg.value with compiler-authored effects', () => {
    const artifact = compileString(`contract ValueContext() {
      function pay(bytes recipient, bigint amount) public {
        this.transfer(recipient, amount);
        require(msg.value == -amount && amount >= 0);
      }
    }`, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: 'aa',
      experimentalMessageBusControllerCategory: '00'.repeat(32),
    });
    expect(artifact.hiddenBatch?.maximumRows).toBe(8);
    const handler = artifact.hiddenBatch?.handlers.find((candidate) => candidate.name === 'pay');
    expect(handler?.eligible).toBe(true);
    expect(handler?.usesMsgValue).toBe(true);
    expect(handler?.transfers?.[0].amount).toEqual({ kind: 'forward', paramIndex: 1 });
  });

  it('admits the caller-authorized ERC-20 handler set', () => {
    // Each of these is a normative ERC-20 handler. `transfer` and `approve` were rejected outright before the
    // caller-keyed-alternative and nested-collection fixes, so the batch surface could not express standard
    // ERC-20 semantics at all without a spender parameter.
    const admits = (
      source: string, name: string,
    ): NonNullable<ReturnType<typeof compileString>['hiddenBatch']>['handlers'][number] | undefined => {
      const artifact = compileString(source, graphOptions);
      return artifact.hiddenBatch?.handlers.find((handler) => handler.name === name);
    };

    expect(admits(`contract Erc20Transfer() {
      mapping(address => bigint) balances;
      function transfer(address to, bigint amount) public {
        require(this.balances[msg.sender] >= amount);
        this.balances[msg.sender] = this.balances[msg.sender] - amount;
        this.balances[to] = this.balances[to] + amount;
      }
    }`, 'transfer')).toMatchObject({
      eligible: true,
      batchKeyWitnesses: [
        { routeInput: '__scb_key_balances_sender_0', inputIndex: -1, source: 'msgSender' },
        { routeInput: '__scb_key_balances_0_row', inputIndex: 0, perRow: true },
      ],
    });

    expect(admits(`contract Erc20Approve() {
      mapping(address => mapping(address => bigint)) allowance;
      function approve(address spender, bigint amount) public {
        this.allowance[msg.sender][spender] = amount;
        require(amount >= 0);
      }
    }`, 'approve')?.eligible).toBe(true);

    expect(admits(`contract Erc20Mint() {
      mapping(address => bigint) balances;
      bigint supply;
      function mint(address to, bigint amount) public {
        this.balances[to] = this.balances[to] + amount;
        this.supply = this.supply + amount;
        require(amount >= 0);
      }
    }`, 'mint')?.eligible).toBe(true);

    expect(admits(`contract Erc20Burn() {
      mapping(address => bigint) balances;
      bigint supply;
      function burn(address from, bigint amount) public {
        require(this.balances[from] >= amount);
        this.balances[from] = this.balances[from] - amount;
        this.supply = this.supply - amount;
      }
    }`, 'burn')?.eligible).toBe(true);
  // Compiles nine message-bus contracts in one test. Measured 6.0s at the 5s default under the parallel-file
  // load this project runs with; the whole file is 35.7s here against 41.3s before G1, so this is the default
  // budget being too small for the test, not a cost regression.
  }, 60_000);

  /**
   * Only the shared alternative can be caller-keyed; a row-local one would need a witness per row. This must
   * fail closed with its own reason rather than be swept up by the check that used to catch `transfer`.
   *
   * VACUOUS AS WRITTEN, MEASURED. `drain` is this contract's ONLY entry point, so refusing it leaves no route
   * and `hiddenBatch` is `undefined` - there is no handlers list to read. The old assertion read
   * `hiddenBatch?.handlers.find(...)` (undefined), passed it through `?? false`, and put the reason string
   * behind `if (rejectionReason !== undefined)`, which never fired. `row-local-msg-sender-collection-key-not-
   * enabled` was never compared to anything: deleting it from `compiler.ts` left this test green.
   *
   * Both channels are now read, unconditionally. The absence channel is where this fixture states the reason;
   * the handlers channel is reached by a second fixture differing in exactly ONE field - an admitted sibling
   * handler that keeps the route alive - which is what turns route-erasure into a published refused row.
   */
  it('rejects a row-local caller-keyed collection instead of mis-binding it', () => {
    const artifact = compileString(`contract RowLocalSender() {
      mapping(address => bigint) balances;
      function drain(address from, bigint amount) public {
        this.balances[from] = this.balances[from] - amount;
        this.balances[msg.sender] = this.balances[msg.sender] + amount;
      }
    }`, graphOptions);
    expect(artifact.hiddenBatch, 'a route now survives, so the reason moved to the handlers channel')
      .toBeUndefined();
    const absence = (artifact.diagnostics ?? [])
      .filter((entry) => entry.code === 'hidden-batch-route-not-synthesized');
    expect(absence).toHaveLength(1);
    expect(absence[0].message).toContain("'drain': row-local-msg-sender-collection-key-not-enabled");
  });

  it('publishes the row-local refusal per handler when an admitted sibling keeps the route', () => {
    const artifact = compileString(`contract RowLocalSender() {
      mapping(address => bigint) balances;
      bigint total;
      function drain(address from, bigint amount) public {
        this.balances[from] = this.balances[from] - amount;
        this.balances[msg.sender] = this.balances[msg.sender] + amount;
      }
      function bump(bigint amount) public { this.total = this.total + amount; require(amount >= 0); }
    }`, graphOptions);
    const handlers = artifact.hiddenBatch!.handlers;
    // The admitted sibling is what makes this a REFUSED ROW rather than an absent route, so it is asserted
    // beside the refusal instead of being assumed.
    expect(handlers.map((entry) => `${entry.name}:${entry.eligible}`)).toEqual(['drain:false', 'bump:true']);
    expect(handlers.find((entry) => entry.name === 'drain')!.rejectionReason)
      .toBe('row-local-msg-sender-collection-key-not-enabled');
  });

  it('admits modifiers, reverts, custom errors, while loops and multi-argument events', () => {
    const eligible = (source: string, name: string): boolean | undefined =>
      compileString(source, graphOptions).hiddenBatch?.handlers
        .find((handler) => handler.name === name)?.eligible;

    expect(eligible(`contract WithModifier() {
      bigint total;
      modifier onlyPositive(bigint n) { require(n >= 0); _; }
      function act(bigint n) public onlyPositive(n) { this.total = this.total + n; require(true); }
    }`, 'act')).toBe(true);

    expect(eligible(`contract WithRevert() {
      bigint total;
      function act(bigint n) public {
        if (n < 0) { revert("negative"); }
        this.total = this.total + n;
        require(true);
      }
    }`, 'act')).toBe(true);

    expect(eligible(`contract WithCustomError() {
      bigint total;
      error TooSmall(bigint n);
      function act(bigint n) public {
        if (n < 0) { revert TooSmall(n); }
        this.total = this.total + n;
        require(true);
      }
    }`, 'act')).toBe(true);

    expect(eligible(`contract WithWhile() {
      bigint total;
      function act(bigint n) public {
        bigint i = 0;
        while (i < n) { this.total = this.total + 1; i = i + 1; }
        require(n >= 0);
      }
    }`, 'act')).toBe(true);

    expect(eligible(`contract WithEvent() {
      bigint total;
      event Moved(bigint a, bigint b);
      function go(bigint a, bigint b) public { this.total = a + b; emit Moved(a, b); require(a >= 0); }
    }`, 'go')).toBe(true);
  });

  it('admits a collection delete by journalling it as a write of the default', () => {
    // `delete m[k]` reached code generation raw and the C2 backend failed closed. The value-threaded journal
    // can represent it - as a write of the collection's default - but that lowering only applies to internal
    // handlers, so a delete-bearing handler is cloned even when nothing else on the route needs a clone.
    const artifact = compileString(`contract DeleteEntry() {
      mapping(address => bigint) values;
      function clear(address key) public { delete this.values[key]; require(true); }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'clear')?.eligible).toBe(true);
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(1);
  });

  it('shares one entry between a delete handler and a resource-shaped sibling', () => {
    const artifact = compileString(`contract DeleteBeside() {
      mapping(address => bigint) values;
      function move(address from, address to, bigint amount) public {
        this.values[from] = this.values[from] - amount;
        this.values[to] = this.values[to] + amount;
        require(amount >= 0);
      }
      function clear(address key) public { delete this.values[key]; require(true); }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.map((handler) => [handler.name, handler.eligible]))
      .toEqual([['move', true], ['clear', true]]);
    // The delete resolves onto the shared entry `move` already owns rather than adding a fourth slot.
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(3);
  });

  it('unions two handlers over one collection onto one set of entry slots', () => {
    const artifact = compileString(`contract MixedCollection() {
      mapping(address => bigint) balances;
      function move(address from, address to, bigint amount) public {
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        require(amount >= 0);
      }
      function bump(address who, bigint amount) public {
        this.balances[who] = this.balances[who] + amount;
        require(amount >= 0);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });

    // Both handlers are admitted, and `bump` resolves onto the entry `move` already owns rather than
    // allocating a second slot for it. Naming witnesses per handler is what used to force the duplicate.
    expect(artifact.hiddenBatch?.handlers.map((handler) => [handler.name, handler.eligible]))
      .toEqual([['move', true], ['bump', true]]);
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(3);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'bump'))
      .toMatchObject({
        batchKeyWitnesses: [{ routeInput: '__scb_key_balances_0', inputIndex: 0 }],
      });
    expect(artifact.hiddenBatch?.route.inputs.filter((input) => input.name.startsWith('__scb_key'))
      .map((input) => input.name))
      .toEqual(['__scb_key_balances_0', '__scb_key_balances_0_row_r0', '__scb_key_balances_0_row_r1']);
  });

  it('unions a cross-keyed handler with its siblings onto one entry set', () => {
    // `transferFrom`'s `from` addresses both allowances[from][spender] and balances[from]. One source parameter
    // cannot carry two canonical witness names, so identity cannot come from the call-site key expression;
    // each batch clone instead takes one synthetic parameter per physical entry key, named after that entry's
    // canonical route input. Every handler then resolves to the same four entries.
    const artifact = compileString(`contract CrossKeyedToken() {
      mapping(bytes20 => bigint) balances;
      mapping(bytes20 => mapping(bytes20 => bigint)) allowances;
      function mint(bytes20 to, bigint amount) public {
        this.balances[to] = this.balances[to] + amount;
        require(amount >= 0);
      }
      function approve(bytes20 owner, bytes20 spender, bigint amount) public {
        this.allowances[owner][spender] = amount;
        require(amount >= 0);
      }
      function transferFrom(bytes20 from, bytes20 to, bytes20 spender, bigint amount) public {
        require(this.allowances[from][spender] >= amount);
        require(this.balances[from] >= amount);
        this.allowances[from][spender] = this.allowances[from][spender] - amount;
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
      }
      function checkBalance(bytes20 owner, bigint expected) public {
        require(this.balances[owner] == expected);
      }
      function checkAllowance(bytes20 owner, bytes20 spender, bigint expected) public {
        require(this.allowances[owner][spender] == expected);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });

    expect(artifact.hiddenBatch?.handlers.every((handler) => handler.eligible)).toBe(true);
    expect(artifact.hiddenBatch?.handlers.map((handler) => handler.name))
      .toEqual(['mint', 'approve', 'transferFrom', 'checkBalance', 'checkAllowance']);
    // balances shared, allowances shared, balances row 0, balances row 1 - and nothing duplicated.
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(4);
    expect(artifact.hiddenBatch?.route.inputs.filter((input) => input.name.startsWith('__scb_key'))
      .map((input) => input.name))
      .toEqual([
        '__scb_key_balances_0',
        '__scb_key_allowances_0',
        '__scb_key_allowances_1',
        '__scb_key_balances_0_row_r0',
        '__scb_key_balances_0_row_r1',
      ]);
  });

  it('journals repeated writes to one fixed-array entry through one physical slot', () => {
    const artifact = compileString(`contract ArrayState() {
      bigint[3] slots;
      function set(bigint index, bigint value) public { this.slots[index] = value; require(value >= 0); }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'set')).toMatchObject({
      eligible: true,
      batchKeyWitnesses: [{ routeInput: '__scb_key_slots_0', inputIndex: 0 }],
    });
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(1);
  });

  /**
   * SEC-6 / X29. This route WAS admitted with 8 transfer slots, 8 event slots and a satoshi container - and its
   * outgoing edge was UNBOUND. `start` is a graph emission handler that also emits and transfers, so
   * InlineStoragePointerCalls flattened its clone into the route wrapper, after which the external call
   * generated with __scb1 as the current function and no emission row was ever recomputed and compared.
   * Measured on the semantic VM (packages/solidcash/test/e2e/Layer3EmissionEffectEscape.test.ts) an argument
   * substitution AND a selector substitution both settled on exactly this shape. SEC-6 refused it.
   *
   * X29 restores it: the clone stays behind OP_INVOKE, which is what binds the edge, and the route reserves the
   * SAME owner-local slots on its behalf - one event/transfer frame per dispatch site, selected at runtime by a
   * site ordinal the route pushes as hidden context. The block below is byte-for-byte the layout the flattened
   * form produced, so the route is settled with its effects and its edges recomputed, not one or the other.
   */
  const COMBINED_EFFECTS = `interface IPeer {
      function step(address callback, bytes recipient, bigint amount);
    }
    contract CombinedEffects() {
      bigint count;
      event Seen(bigint amount);
      function start(address peer, address callback, bytes recipient, bigint amount) public {
        this.count = this.count + amount;
        emit Seen(amount);
        this.transfer(recipient, amount);
        IPeer(peer).step(callback, recipient, amount);
        require(true);
      }
      function finish(address callback, bytes recipient, bigint amount) public {
        this.count = this.count + amount;
        emit Seen(amount);
        require(callback.length > 0 && recipient.length > 0);
      }
    }`;
  const BUS = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
    experimentalMessageBusControllerCategory: '22'.repeat(32),
  };

  const effectSlots = (source: string): Record<string, number> => {
    const artifact = compileString(source, BUS);
    const counts: Record<string, number> = {};
    for (const slot of artifact.hiddenBatch!.route.blockLayout!.slots) {
      counts[slot.kind] = (counts[slot.kind] ?? 0) + 1;
    }
    return counts;
  };
  const WITHOUT_EDGE = COMBINED_EFFECTS.replace(
    '        IPeer(peer).step(callback, recipient, amount);\n', '',
  );

  it('admits a uniform event route whose emitting handler also makes an outgoing call', () => {
    const artifact = compileString(COMBINED_EFFECTS, BUS);
    expect(artifact.hiddenBatch?.handlers.map((handler) => [handler.name, handler.eligible]))
      .toEqual([['start', true], ['finish', true]]);
    // X29's frames, and the discriminator against the silent-drop shape: an un-flattened handler whose route
    // reserved nothing would show ZERO event and transfer slots here while still publishing a route.
    expect(effectSlots(COMBINED_EFFECTS)).toEqual({
      master: 1, dataNft: 1, satoshiContainer: 1, transfer: 8, event: 8,
    });
  });

  // The same layout the FLATTENED (forgeable) form produced, so X29 changed what settles the effects, not
  // where they sit. Removing the outgoing edge keeps the handler on the established flattened path.
  it('gives the outgoing-call route the same block as the edge-free one', () => {
    expect(effectSlots(COMBINED_EFFECTS)).toEqual(effectSlots(WITHOUT_EDGE));
  });

  it('still admits a uniform event route with a sparse value-transfer effect and no outgoing call', () => {
    const artifact = compileString(WITHOUT_EDGE, BUS);
    expect(artifact.hiddenBatch?.handlers.map((handler) => [handler.name, handler.eligible]))
      .toEqual([['start', true], ['finish', true]]);
    const slots = artifact.hiddenBatch!.route.blockLayout!.slots;
    expect(slots.filter((slot) => slot.kind === 'transfer')).toHaveLength(8);
    expect(slots.filter((slot) => slot.kind === 'event')).toHaveLength(8);
    expect(slots.find((slot) => slot.kind === 'satoshiContainer')).toBeDefined();
  });
});
