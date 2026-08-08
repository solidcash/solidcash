import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner, expectOverOperationCostBudget, densityReserve } from '../test-util.js';

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// --- Contract sources (kept small to avoid exceeding bytecode limit) -----

const LITERAL_ACCESS_SOURCE = `
pragma solidcash ^0.13.0;
contract LiteralAccess() {
    function testAccess(bigint row, bigint col) {
        bigint[3][] matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        bigint val = matrix[row][col];
        require(val >= 0);
    }

    function testConstants() {
        bigint[3][] matrix = [[10, 20, 30], [40, 50, 60]];
        require(matrix[0][0] == 10);
        require(matrix[0][2] == 30);
        require(matrix[1][0] == 40);
        require(matrix[1][1] == 50);
        require(matrix[1][2] == 60);
    }
}
`;

const PUSH_POP_SOURCE = `
pragma solidcash ^0.13.0;
contract PushPop() {
    function testPushPop() {
        bigint[3][] rows = [[10, 20, 30]];
        rows.push([40, 50, 60]);
        require(rows.length == 2);
        require(rows[1][0] == 40);
        require(rows[1][2] == 60);
        rows.pop();
        require(rows.length == 1);
        require(rows[0][0] == 10);
    }

    function testMultiplePush() {
        bigint[2][] arr = [];
        arr.push([1, 2]);
        arr.push([3, 4]);
        arr.push([5, 6]);
        require(arr.length == 3);
        require(arr[0][0] == 1);
        require(arr[1][1] == 4);
        require(arr[2][0] == 5);
    }
}
`;

const INNER_EXTRACT_SOURCE = `
pragma solidcash ^0.13.0;
contract InnerExtract() {
    function testExtractRow() {
        bigint[3][] matrix = [[1, 2, 3], [4, 5, 6]];
        bigint[] row0 = matrix[0];
        require(row0.length == 3);
        require(row0[0] == 1);
        require(row0[1] == 2);
        require(row0[2] == 3);
        bigint[] row1 = matrix[1];
        require(row1[0] == 4);
        require(row1[2] == 6);
    }

    function testOuterLength() {
        bigint[3][] matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
        require(matrix.length == 3);
    }
}
`;

const DIAGONAL_SOURCE = `
pragma solidcash ^0.13.0;
contract Diagonal() {
    function testDiagonal(bigint n) {
        bigint[3][] matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        require(matrix[n][n] == 1);
    }
}
`;

const DELETE_SOURCE = `
pragma solidcash ^0.13.0;
contract Delete2D() {
    function testDelete() {
        bigint[2][] pairs = [[1, 2], [3, 4], [5, 6]];
        require(pairs.length == 3);
        pairs.delete(1);
        require(pairs.length == 2);
        require(pairs[0][0] == 1);
        require(pairs[1][0] == 5);
        require(pairs[1][1] == 6);
    }
}
`;

const ASSIGN_SOURCE = `
pragma solidcash ^0.13.0;
contract Assign2D() {
    function testOuterAssign() {
        bigint[2][] pairs = [[1, 2], [3, 4]];
        pairs[0] = [10, 20];
        require(pairs[0][0] == 10);
        require(pairs[0][1] == 20);
        require(pairs[1][0] == 3);
    }

    function testPushThenAssign() {
        bigint[2][] arr = [[0, 0]];
        arr.push([0, 0]);
        arr[0] = [10, 20];
        arr[1] = [30, 40];
        require(arr[0][0] == 10);
        require(arr[1][1] == 40);
    }
}
`;

const BOOL_2D_SOURCE = `
pragma solidcash ^0.13.0;
contract Bool2D() {
    function testLiteral() {
        bool[2][] flags = [[true, false], [false, true]];
        require(flags[0][0] == true);
        require(flags[0][1] == false);
        require(flags[1][0] == false);
        require(flags[1][1] == true);
    }

    function testPush() {
        bool[3][] rows = [[true, true, false]];
        rows.push([false, false, true]);
        require(rows.length == 2);
        require(rows[1][2] == true);
        require(rows[0][2] == false);
    }
}
`;

const BYTES_2D_SOURCE = `
pragma solidcash ^0.13.0;
contract Bytes2D() {
    function testLiteral(bytes4 target) {
        bytes4[2][] pairs = [[0xdeadbeef, 0xcafebabe], [0x12345678, 0xaabbccdd]];
        require(pairs[0][0] == 0xdeadbeef);
        require(pairs[1][1] == 0xaabbccdd);
        require(pairs[0][1] != target);
    }

    function testPush() {
        bytes4[2][] pairs = [[0x11111111, 0x22222222]];
        pairs.push([0x33333333, 0x44444444]);
        require(pairs.length == 2);
        require(pairs[1][0] == 0x33333333);
    }
}
`;

const FIXED_2D_SOURCE = `
pragma solidcash ^0.13.0;
contract Fixed2D() {
    function testAccess() {
        bigint[3][2] grid = [[1, 2, 3], [4, 5, 6]];
        require(grid[0][0] == 1);
        require(grid[0][2] == 3);
        require(grid[1][0] == 4);
        require(grid[1][2] == 6);
        require(grid.length == 2);
    }

    function testAssign() {
        bigint[3][2] grid = [[1, 2, 3], [4, 5, 6]];
        grid[1] = [7, 8, 9];
        require(grid[1][0] == 7);
        require(grid[1][2] == 9);
        require(grid[0][0] == 1);
    }
}
`;

const FIXED_INNER_SOURCE = `
pragma solidcash ^0.13.0;
contract FixedInner() {
    function testInnerLength() {
        bigint[3][2] grid = [[10, 20, 30], [40, 50, 60]];
        bigint[] row = grid[0];
        require(row.length == 3);
    }
}
`;

const FAILURE_VALUE_SOURCE = `
pragma solidcash ^0.13.0;
contract FailureValue() {
    function testWrongValue() {
        bigint[2][] pairs = [[10, 20], [30, 40]];
        require(pairs[0][0] == 999);
    }
}
`;

const FAILURE_LENGTH_SOURCE = `
pragma solidcash ^0.13.0;
contract FailureLength() {
    function testWrongLength() {
        bigint[2][] pairs = [[1, 2]];
        require(pairs.length == 5);
    }
}
`;

const FAILURE_PUSH_SOURCE = `
pragma solidcash ^0.13.0;
contract FailurePush() {
    function testWrongAfterPush() {
        bigint[2][] pairs = [[1, 2]];
        pairs.push([3, 4]);
        require(pairs[1][0] == 99);
    }
}
`;

// --- Tests ---------------------------------------------------------------

describe('Multi-Dimensional Arrays', () => {
  // -- 2D literal and chained access -----------------------------------
  describe('2D literal and chained access', () => {
    it('should compile with correct ABI', () => {
      expect(compileString(LITERAL_ACCESS_SOURCE).abi).toHaveLength(2);
    });

    it('access identity matrix diagonal (0,0)=1', async () => {
      const factory = getContractFactory(
        compileString(LITERAL_ACCESS_SOURCE, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      const tx = await sc.testAccess(0n, 0n);
      expect(tx.txid).toBeDefined();
    });

    it('access identity matrix off-diagonal (0,1)=0', async () => {
      const factory = getContractFactory(
        compileString(LITERAL_ACCESS_SOURCE, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      const tx = await sc.testAccess(0n, 1n);
      expect(tx.txid).toBeDefined();
    });

    it('access identity matrix last element (2,2)=1', async () => {
      const factory = getContractFactory(
        compileString(LITERAL_ACCESS_SOURCE, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      const tx = await sc.testAccess(2n, 2n);
      expect(tx.txid).toBeDefined();
    });

    it('access identity matrix bottom-left (2,0)=0', async () => {
      const factory = getContractFactory(
        compileString(LITERAL_ACCESS_SOURCE, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      const tx = await sc.testAccess(2n, 0n);
      expect(tx.txid).toBeDefined();
    });

    // Exceeds the real BCH-2026 operation-cost budget at this contract's natural size, so the deploy reserves
    // density for it. See `densityReserve`.
    it('verify all constant-indexed values (with a density reserve)', async () => {
      const factory = getContractFactory(
        compileString(LITERAL_ACCESS_SOURCE, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy({ salt: densityReserve() });
      const tx = await sc.testConstants();
      expect(tx.txid).toBeDefined();
    });

    it('the same call without a density reserve is refused by the operation-cost budget', async () => {
      const factory = getContractFactory(
        compileString(LITERAL_ACCESS_SOURCE, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      await expectOverOperationCostBudget(sc.testConstants());
    });
  });

  // -- push and pop ----------------------------------------------------
  describe('push and pop', () => {
    it('push row, verify, pop, verify original intact', async () => {
      const factory = getContractFactory(compileString(PUSH_POP_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testPushPop();
      expect(tx.txid).toBeDefined();
    });

    it('push 3 rows to empty array, verify all values', async () => {
      const factory = getContractFactory(compileString(PUSH_POP_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testMultiplePush();
      expect(tx.txid).toBeDefined();
    });
  });

  // -- inner row extraction --------------------------------------------
  describe('inner row extraction', () => {
    it('extract row0 and row1, verify all elements', async () => {
      const factory = getContractFactory(compileString(INNER_EXTRACT_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testExtractRow();
      expect(tx.txid).toBeDefined();
    });

    it('outer length of 3-row matrix == 3', async () => {
      const factory = getContractFactory(compileString(INNER_EXTRACT_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testOuterLength();
      expect(tx.txid).toBeDefined();
    });
  });

  // -- diagonal pattern with parameterized index -----------------------
  describe('diagonal access with parameterized index', () => {
    it('matrix[0][0] == 1', async () => {
      const factory = getContractFactory(compileString(DIAGONAL_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testDiagonal(0n);
      expect(tx.txid).toBeDefined();
    });

    it('matrix[1][1] == 1', async () => {
      const factory = getContractFactory(compileString(DIAGONAL_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testDiagonal(1n);
      expect(tx.txid).toBeDefined();
    });

    it('matrix[2][2] == 1', async () => {
      const factory = getContractFactory(compileString(DIAGONAL_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testDiagonal(2n);
      expect(tx.txid).toBeDefined();
    });
  });

  // -- delete ----------------------------------------------------------
  describe('delete from 2D array', () => {
    it('delete middle row, verify remaining rows', async () => {
      const factory = getContractFactory(compileString(DELETE_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testDelete();
      expect(tx.txid).toBeDefined();
    });
  });

  // -- outer assign ----------------------------------------------------
  describe('outer row assignment', () => {
    it('replace row[0] with new values, other row unchanged', async () => {
      const factory = getContractFactory(compileString(ASSIGN_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testOuterAssign();
      expect(tx.txid).toBeDefined();
    });

    it('push then assign - build array then overwrite rows', async () => {
      const factory = getContractFactory(compileString(ASSIGN_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testPushThenAssign();
      expect(tx.txid).toBeDefined();
    });
  });

  // -- bool 2D arrays --------------------------------------------------
  describe('bool 2D arrays', () => {
    it('bool 2D literal - verify all true/false values', async () => {
      const factory = getContractFactory(compileString(BOOL_2D_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testLiteral();
      expect(tx.txid).toBeDefined();
    });

    it('bool 2D push - push new bool row', async () => {
      const factory = getContractFactory(compileString(BOOL_2D_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testPush();
      expect(tx.txid).toBeDefined();
    });
  });

  // -- bytes4 2D arrays ------------------------------------------------
  describe('bytes4 2D arrays', () => {
    it('bytes4 2D literal - verify hex values', async () => {
      const factory = getContractFactory(compileString(BYTES_2D_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testLiteral(new Uint8Array([0x00, 0x00, 0x00, 0x00]));
      expect(tx.txid).toBeDefined();
    });

    it('bytes4 2D push - push new bytes pair', async () => {
      const factory = getContractFactory(compileString(BYTES_2D_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testPush();
      expect(tx.txid).toBeDefined();
    });
  });

  // -- fixed-size 2D arrays (both dimensions bounded) ------------------
  describe('fixed-size 2D arrays - bigint[3][2]', () => {
    it('access all corners of 2x3 grid', async () => {
      const factory = getContractFactory(compileString(FIXED_2D_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testAccess();
      expect(tx.txid).toBeDefined();
    });

    it('assign - replace a row', async () => {
      const factory = getContractFactory(compileString(FIXED_2D_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testAssign();
      expect(tx.txid).toBeDefined();
    });
  });

  describe('fixed-size 2D - inner row extraction', () => {
    it('extract inner row and check length', async () => {
      const factory = getContractFactory(compileString(FIXED_INNER_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testInnerLength();
      expect(tx.txid).toBeDefined();
    });
  });

  // -- failure paths ---------------------------------------------------
  describe('failure paths - wrong assertions verify correctness', () => {
    it('wrong value - pairs[0][0] != 999', async () => {
      const factory = getContractFactory(compileString(FAILURE_VALUE_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      await expect(sc.testWrongValue()).rejects.toThrow(verifyFailure);
    });

    it('wrong length - pairs.length != 5', async () => {
      const factory = getContractFactory(
        compileString(FAILURE_LENGTH_SOURCE, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      await expect(sc.testWrongLength()).rejects.toThrow(verifyFailure);
    });

    it('wrong after push - pushed value != 99', async () => {
      const factory = getContractFactory(compileString(FAILURE_PUSH_SOURCE, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      await expect(sc.testWrongAfterPush()).rejects.toThrow(verifyFailure);
    });
  });
});
