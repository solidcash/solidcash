/**
 * Tests for M-NEW-3: Fallback/receive ABI metadata.
 *
 * Verifies that fallback/receive ABI entries include critical metadata fields
 * (lowLevelCalls, unsafeTier, requiredNftIndices, etc.).
 * Delegatecall fallbacks get all data NFT indices; state-accessing fallbacks
 * get their specific indices; fallbacks with no state access get [].
 */

import { compileString } from '../direct-compile.js';

describe('Fallback/Receive ABI metadata', () => {
  describe('stateful contract with delegatecall fallback', () => {
    const source = `
      pragma solidcash >=0.8.0;
      contract ProxyWithFallback() {
        int counter;
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

    it('should include lowLevelCalls in fallback ABI', () => {
      const artifact = compileString(source);
      const fallback = artifact.abi.find((f) => f.name === '__fallback');
      expect(fallback).toBeDefined();
      expect(fallback!.isFallback).toBe(true);
      expect(fallback!.lowLevelCalls).toBeDefined();
      expect(fallback!.lowLevelCalls).toEqual([{
        callMode: 'delegatecall', dataParamIndex: 0, occurrence: 'once', target: { kind: 'literal' },
      }]);
    });

    it('should include ALL data NFT indices for delegatecall fallback', () => {
      const artifact = compileString(source);
      const fallback = artifact.abi.find((f) => f.name === '__fallback');
      // Delegatecall fallbacks get all data NFT indices because the delegate
      // implementation may access any state on the proxy's behalf.
      expect(fallback!.requiredNftIndices).toEqual([0]);
    });

    it('should have empty inputs for fallback (params are synthetic)', () => {
      const artifact = compileString(source);
      const fallback = artifact.abi.find((f) => f.name === '__fallback');
      expect(fallback!.inputs).toEqual([]);
    });

    it('should include requiredNftIndices on regular functions', () => {
      const artifact = compileString(source);
      const authorize = artifact.abi.find((f) => f.name === 'authorize');
      expect(authorize).toBeDefined();
      // authorize is unsafe, so it gets all NFT indices or empty depending on dataNftCount
      expect(authorize!.requiredNftIndices).toBeDefined();
    });
  });

  describe('stateful contract with receive', () => {
    const source = `
      pragma solidcash >=0.8.0;
      contract WithReceive() {
        int counter;
        function set(int newCounter) {
          this.counter = newCounter;
        }
        receive() external payable {
          require(tx.outputs[0].value >= 546);
        }
      }
    `;

    it('should have isReceive and payable modifier on receive ABI', () => {
      const artifact = compileString(source);
      const receive = artifact.abi.find((f) => f.name === '__receive');
      expect(receive).toBeDefined();
      expect(receive!.isReceive).toBe(true);
      expect(receive!.modifiers).toContain('payable');
    });

    it('should include empty requiredNftIndices in receive ABI', () => {
      const artifact = compileString(source);
      const receive = artifact.abi.find((f) => f.name === '__receive');
      expect(receive!.requiredNftIndices).toEqual([]);
    });

    it('should have empty inputs for receive', () => {
      const artifact = compileString(source);
      const receive = artifact.abi.find((f) => f.name === '__receive');
      expect(receive!.inputs).toEqual([]);
    });

    it('should include requiredNftIndices on regular set function', () => {
      const artifact = compileString(source);
      const set = artifact.abi.find((f) => f.name === 'set');
      expect(set).toBeDefined();
      expect(set!.requiredNftIndices).toBeDefined();
      expect(set!.requiredNftIndices).toEqual([0]);
    });
  });

  describe('non-stateful contract fallback/receive', () => {
    const source = `
      pragma solidcash ^0.14.0;
      contract Simple(bytes20 owner) {
        function transfer(pubkey pk, sig s) {
          require(hash160(pk) == owner);
          require(checkSig(s, pk));
        }
        fallback() external {
          require(tx.outputs[0].value >= 1000);
        }
        receive() external payable {
          require(tx.outputs[0].value >= 546);
        }
      }
    `;

    it('should have isFallback and isReceive flags', () => {
      const artifact = compileString(source);
      const fallback = artifact.abi.find((f) => f.name === '__fallback');
      const receive = artifact.abi.find((f) => f.name === '__receive');
      expect(fallback!.isFallback).toBe(true);
      expect(receive!.isReceive).toBe(true);
    });

    it('should not have requiredNftIndices on any function (non-stateful)', () => {
      const artifact = compileString(source);
      for (const fn of artifact.abi) {
        expect(fn.requiredNftIndices).toBeUndefined();
      }
    });
  });

  describe('fallback with .call() low-level call', () => {
    const source = `
      pragma solidcash >=0.8.0;
      contract ProxyWithCall() {
        int state;
        fallback(bytes input) external {
          address target = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
          target.call(input);
          require(input.length > 0);
        }
      }
    `;

    it('should include call mode in lowLevelCalls', () => {
      const artifact = compileString(source);
      const fallback = artifact.abi.find((f) => f.name === '__fallback');
      expect(fallback!.lowLevelCalls).toEqual([{
        callMode: 'call', dataParamIndex: 0, occurrence: 'once', target: { kind: 'literal' },
      }]);
    });
  });

  it('publishes the exact visible parameter carrying low-level calldata', () => {
    const artifact = compileString(`
      pragma solidcash >=0.8.0;
      contract ParameterizedCall() {
        function forward(address target, bytes payload) external {
          target.delegatecall(payload);
          require(payload.length > 0);
        }
      }
    `);
    const forward = artifact.abi.find((f) => f.name === 'forward');
    expect(forward!.lowLevelCalls).toEqual([{
      callMode: 'delegatecall', dataParamIndex: 1, occurrence: 'once',
      target: { kind: 'parameter', name: 'target' },
      targetSource: { kind: 'forward', paramIndex: 0 },
    }]);
  });

  it('does not mispublish a conditional delegate frame as singular', () => {
    const artifact = compileString(`
      pragma solidcash >=0.8.0;
      contract ConditionalCall() {
        function forward(address target, bytes payload, bool enabled) external {
          if (enabled) { target.delegatecall(payload); }
          require(payload.length > 0);
        }
      }
    `);
    const forward = artifact.abi.find((f) => f.name === 'forward');
    // The conditional row also publishes the guard that decides whether the edge is reached, in the same
    // expression vocabulary external calls use, so a spend can tell taken from not-taken before it settles.
    expect(forward!.lowLevelCalls).toEqual([{
      callMode: 'delegatecall', dataParamIndex: 1, occurrence: 'conditional', maximumOccurrences: 1,
      condition: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
      target: { kind: 'parameter', name: 'target' },
      targetSource: { kind: 'forward', paramIndex: 0 },
    }]);
  });

  it('serializes a negated guard and the conjunction of nested arms', () => {
    const artifact = compileString(`
      pragma solidcash >=0.8.0;
      contract GuardShapes() {
        function ifNot(address target, bytes payload, bool enabled) external {
          if (!enabled) { target.delegatecall(payload); }
          require(payload.length > 0);
        }
        function nested(address target, bytes payload, bool first, bool second) external {
          if (first) { if (second) { target.delegatecall(payload); } }
          require(payload.length > 0);
        }
      }
    `);
    const ifNot = artifact.abi.find((f) => f.name === 'ifNot');
    expect(ifNot!.lowLevelCalls![0].condition).toEqual({
      kind: 'unary', operator: '!', expression: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
    });
    const nested = artifact.abi.find((f) => f.name === 'nested');
    expect(nested!.lowLevelCalls![0].condition).toEqual({
      kind: 'binary',
      operator: '&&',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
      right: { kind: 'source', source: { kind: 'forward', paramIndex: 3 } },
    });
  });
});
