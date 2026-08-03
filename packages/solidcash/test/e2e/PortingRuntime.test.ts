import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// Runtime (e2e) coverage for recent porting features: ++/-- on element lvalues, the empty-void function
// no-op synthesis, and `transient` state vars (lowered to zero-init locals). Each contract asserts its own
// behavior via require(), so a successful direct call proves the feature works end-to-end through the SDK
// (compile -> deploy -> VM-verify -> send). Compiled with { forceStateful: true } so each test can deploy +
// call directly (`await sc.<fn>(args)`).

describe('++ / -- on element lvalues (runtime)', () => {
  it('increments and decrements an array element correctly on chain', async () => {
    const artifact = compileString(`contract C() {
      function f() {
        int[3] a = [10, 20, 30];
        a[0]++;
        a[2]--;
        require(a[0] == 11);
        require(a[2] == 29);
      }
    }`, { forceStateful: true });
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.f()).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/),
    });
  });

  it('rejects when the post-increment value is wrong (the ++ really runs)', async () => {
    const artifact = compileString(`contract C() {
      function f() { int[2] a = [5, 5]; a[0]++; require(a[0] == 5); }
    }`, { forceStateful: true });
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.f()).rejects.toThrow(verifyFailure);
  });
});

describe('empty void functions (runtime; Solidity porting)', () => {
  it('spends a synthesized empty payable function', async () => {
    const artifact = compileString(
      'pragma solidity ^0.8.0; contract C { function ping() public payable {} }',
      { solidityImportCompat: true, forceStateful: true },
    );
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.ping()).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/),
    });
  });

  it('spends a contract whose only spend path is an empty receive()', async () => {
    const artifact = compileString(
      'pragma solidity ^0.8.0; contract C { receive() external payable {} }',
      { solidityImportCompat: true, forceStateful: true },
    );
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.__receive()).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/),
    });
  });
});

describe('hex literals as Solidity numbers (runtime)', () => {
  it('uses a hex literal as its big-endian integer value (0x0102 == 258)', async () => {
    const artifact = compileString(
      'pragma solidity ^0.8.0; contract C { function f() external { uint x = 0x0102; require(x == 258); } }',
      { solidityImportCompat: true, forceStateful: true },
    );
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.f()).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/),
    });
  });
});

describe('transient state variables (runtime; EIP-1153 porting)', () => {
  it('spends a transient zero-init guard (locked starts at 0 each spend)', async () => {
    const artifact = compileString(`pragma solidity ^0.8.24;
      contract C {
        uint256 transient locked;
        function enter() public {
          require(locked == 0);
          locked = 1;
          require(locked == 1);
        }
      }`, { solidityImportCompat: true, forceStateful: true });
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.enter()).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/),
    });
  });

  it('always reads 0 - transient does not persist, so code assuming persistence can never spend', async () => {
    const artifact = compileString(`pragma solidity ^0.8.24;
      contract C {
        uint256 transient flag;
        function checkPersisted() public { require(flag == 1); }
      }`, { solidityImportCompat: true, forceStateful: true });
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.checkPersisted()).rejects.toThrow(verifyFailure);
  });

  it('uses a transient var as scratch within a function', async () => {
    const artifact = compileString(`pragma solidity ^0.8.24;
      contract C {
        uint256 transient acc;
        function add(uint256 a, uint256 b) public {
          acc = a;
          acc = acc + b;
          require(acc == a + b);
        }
      }`, { solidityImportCompat: true, forceStateful: true });
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.add(3n, 4n)).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/),
    });
  });
});

describe('tuple ternary (runtime; Solidity porting)', () => {
  // `(x, y) = cond ? (1, 2) : (3, 4)` desugars to a hoisted cond temp + per-element ternaries; a successful
  // spend proves the right branch's tuple is selected end-to-end.
  const artifact = compileString(`contract C() {
    function check(int sel, int ex, int ey) {
      (int x, int y) = (sel == 1) ? (1, 2) : (3, 4);
      require(x == ex);
      require(y == ey);
    }
  }`, { forceStateful: true });

  it('selects the true-branch tuple (sel==1 -> (1, 2))', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.check(1n, 1n, 2n)).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/),
    });
  });

  it('selects the false-branch tuple (sel!=1 -> (3, 4))', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.check(0n, 3n, 4n)).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/),
    });
  });

  it('rejects when the wrong branch values are expected (the ternary really selects)', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.check(1n, 3n, 4n)).rejects.toThrow(verifyFailure);
  });
});
