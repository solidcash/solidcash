import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../src/compiler.js';

describe('message-bus compilation selection', () => {
  const STATEFUL_LEAF = `
    contract Leaf {
      int value;
      function set(int next) public { value = next; require(next >= 0); }
    }
  `;

  it('defaults a graph-free stateful contract to direct-only compilation', () => {
    const artifact = compileString(STATEFUL_LEAF);
    expect(artifact.messageBus).toBeUndefined();
    expect(artifact.compiler.options?.messageBus).toBe(false);
  });

  it('treats explicit true as an opt-in that skips narrowing and builds a graph-free leaf participant', () => {
    const artifact = compileString(STATEFUL_LEAF, { messageBus: true });
    expect(artifact.messageBus).toBeDefined();
    expect(artifact.compiler.options?.messageBus).toBe(true);
  });

  // Explicit true is a request, not an assertion: it opts out of graph-edge narrowing but keeps the direct-only
  // fallback, so a contract with no possible route still compiles. Only the internal verifier-program mode
  // (`required`) treats a missing route as fatal.
  it('falls back to direct-only when explicit true has no atomic participant route', () => {
    const artifact = compileString(`contract Stateless {
      function check(int value) public pure { require(value >= 0); }
    }`, { messageBus: true });
    expect(artifact.contractName).toBe('Stateless');
    expect(artifact.messageBus).toBeUndefined();
  });

  it('keeps direct mapping keys visible beside dynamic-array reads in explicit graph mode', () => {
    const artifact = compileString(`contract Marketplace {
      struct Job { bool whitelistWorkers; }
      Job[] jobs;
      mapping(uint => mapping(address => bool)) whitelistWorkers;
      function takeJob(uint jobId) public {
        require(!jobs[jobId].whitelistWorkers || whitelistWorkers[jobId][msg.sender]);
        jobs[jobId].whitelistWorkers = false;
        require(jobs[jobId].whitelistWorkers == false);
      }
    }`, { messageBus: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'takeJob')).toEqual(
      expect.objectContaining({ eligible: true }),
    );
  });

  it('binds a state-derived collection key while preserving a bounded graph result', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IToken { function balanceOf(address holder) external returns (uint); }
      contract Escrow(address token) {
        mapping(uint => uint) escrows;
        uint next;
        function readBalance(address currency) internal returns (uint) {
          return IToken(currency).balanceOf(address(this));
        }
        function pay(bool useToken) external returns (uint) {
          uint id = next;
          uint amount = 1;
          if (useToken) { amount = readBalance(token); }
          escrows[id] = amount;
          next = next + 1;
          return id;
        }
        // Keep an unrelated low-level return consumer in the expanded contract. It must not taint pay with a
        // contract-wide refusal once pay's own typed result graph has been proved finite.
        function raw(bytes payload) internal returns (bytes) {
          (bool success, bytes memory result) = address(token).call(payload);
          require(success);
          return result;
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toEqual(
      expect.objectContaining({
        eligible: true,
        batchKeyWitnesses: [expect.objectContaining({
          source: 'expression',
          expressionLabel: 'state:next',
        })],
      }),
    );
  });

  it('threads the logical caller into a no-argument delegate route handler', () => {
    const artifact = compileString(`contract Pausable {
      address _owner;
      bool paused;
      constructor() { _owner = msg.sender; }
      function pause() external {
        require(msg.sender == _owner);
        this.paused = true;
        require(this.paused);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'pause'))
      .toEqual(expect.objectContaining({ eligible: true }));
  });

  it('threads the logical caller through a modifier helper closure in a delegate journal handler', () => {
    const artifact = compileString(`contract Governed {
      address _owner;
      mapping(int => int) values;
      mapping(string => string) tags;
      event Changed(address nextOwner);
      function sender() internal view returns (address) { return msg.sender; }
      function checkOwner() internal view { require(sender() == _owner); }
      modifier onlyOwner() { checkOwner(); _; }
      function remove(int key) public onlyOwner { delete values[key]; }
      function update(string key, string value) public onlyOwner { tags[key] = value; }
      function renounce() public onlyOwner { this._owner = address(0); emit Changed(address(0)); }
    }`, {
      forceStateful: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'remove'))
      .toEqual(expect.objectContaining({ eligible: true }));
    expect(artifact.delegateArtifact).toBeDefined();
  });

  it('uses local sender context for a delegate route event-frame handler', () => {
    const artifact = compileString(`contract EventGoverned {
      address _owner;
      event Changed(address nextOwner);
      function sender() internal view returns (address) { return msg.sender; }
      function checkOwner() internal view { require(sender() == _owner); }
      modifier onlyOwner() { checkOwner(); _; }
      function renounce() public onlyOwner { this._owner = address(0); emit Changed(address(0)); }
    }`, {
      forceStateful: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'renounce'))
      .toEqual(expect.objectContaining({ eligible: true }));
  });

  it('automatically selects message-bus planning for an external call graph', () => {
    const artifact = compileString(`
      interface ISink { function set(int value) external; }
      contract Caller(address sink) {
        int calls;
        function run(int value) public {
          ISink(sink).set(value);
          calls = calls + 1;
          require(value >= 0);
        }
      }
    `);
    expect(artifact.compiler.options?.messageBus).toBe(true);
    expect(artifact.messageBus).toBeDefined();
  });

  it('selects independently for each primary contract in a multi-artifact compile', () => {
    const artifacts = compileStringMulti(`
      interface ISink { function set(int value) external; }
      contract Leaf { int value; function set(int next) public { value = next; require(next >= 0); } }
      contract Caller(address sink) {
        int calls;
        function run(int value) public {
          ISink(sink).set(value);
          calls = calls + 1;
          require(value >= 0);
        }
      }
    `);
    expect(artifacts.Leaf.messageBus).toBeUndefined();
    expect(artifacts.Caller.messageBus).toBeDefined();
  });
});
