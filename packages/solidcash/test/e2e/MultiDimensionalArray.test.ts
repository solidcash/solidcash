import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, TransactionBuilder, FailedRequireError,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos, verifyTransaction } from '../test-util.js';

// --- Helpers -------------------------------------------------------------

function setupContract(source: string, constructorArgs: any[] = []): {
  provider: MockNetworkProvider;
  contract: Contract;
} {
  const provider = createTestProvider();
  const artifact = compileString(source);
  const contract = new Contract(artifact, constructorArgs, { provider });
  return { provider, contract };
}

async function sendTx(
  provider: MockNetworkProvider,
  contract: Contract,
  unlocker: ReturnType<Contract['unlock'][string]>,
): Promise<any> {
  const to = contract.address;
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount, fee: 25000n });

  const builder = new TransactionBuilder({ provider })
    .addInputs(utxos, unlocker)
    .addOutput({ to, amount })
    .addOutput({ to, amount: changeAmount });

  verifyTransaction(builder);
  return builder.send();
}

async function sendTxExpectFail(
  provider: MockNetworkProvider,
  contract: Contract,
  unlocker: ReturnType<Contract['unlock'][string]>,
): Promise<any> {
  const to = contract.address;
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount, fee: 25000n });

  return new TransactionBuilder({ provider })
    .addInputs(utxos, unlocker)
    .addOutput({ to, amount })
    .addOutput({ to, amount: changeAmount })
    .send();
}

async function addUtxos(provider: MockNetworkProvider, address: string, count: number): void {
  for (let i = 0; i < count; i++) {
    await provider.addUtxo(address, randomUtxo({ satoshis: 100000n }));
  }
}

// --- Contract sources (kept small to avoid exceeding bytecode limit) -----

const LITERAL_ACCESS_SOURCE = `
pragma solidcash ^0.13.0;
contract LiteralAccess() {
    function testAccess(int row, int col) {
        int[3][] matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        int val = matrix[row][col];
        require(val >= 0);
    }

    function testConstants() {
        int[3][] matrix = [[10, 20, 30], [40, 50, 60]];
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
        int[3][] rows = [[10, 20, 30]];
        rows.push([40, 50, 60]);
        require(rows.length == 2);
        require(rows[1][0] == 40);
        require(rows[1][2] == 60);
        rows.pop();
        require(rows.length == 1);
        require(rows[0][0] == 10);
    }

    function testMultiplePush() {
        int[2][] arr = [];
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
        int[3][] matrix = [[1, 2, 3], [4, 5, 6]];
        int[] row0 = matrix[0];
        require(row0.length == 3);
        require(row0[0] == 1);
        require(row0[1] == 2);
        require(row0[2] == 3);
        int[] row1 = matrix[1];
        require(row1[0] == 4);
        require(row1[2] == 6);
    }

    function testOuterLength() {
        int[3][] matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
        require(matrix.length == 3);
    }
}
`;

const DIAGONAL_SOURCE = `
pragma solidcash ^0.13.0;
contract Diagonal() {
    function testDiagonal(int n) {
        int[3][] matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        require(matrix[n][n] == 1);
    }
}
`;

const DELETE_SOURCE = `
pragma solidcash ^0.13.0;
contract Delete2D() {
    function testDelete() {
        int[2][] pairs = [[1, 2], [3, 4], [5, 6]];
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
        int[2][] pairs = [[1, 2], [3, 4]];
        pairs[0] = [10, 20];
        require(pairs[0][0] == 10);
        require(pairs[0][1] == 20);
        require(pairs[1][0] == 3);
    }

    function testPushThenAssign() {
        int[2][] arr = [[0, 0]];
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
        int[3][2] grid = [[1, 2, 3], [4, 5, 6]];
        require(grid[0][0] == 1);
        require(grid[0][2] == 3);
        require(grid[1][0] == 4);
        require(grid[1][2] == 6);
        require(grid.length == 2);
    }

    function testAssign() {
        int[3][2] grid = [[1, 2, 3], [4, 5, 6]];
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
        int[3][2] grid = [[10, 20, 30], [40, 50, 60]];
        int[] row = grid[0];
        require(row.length == 3);
    }
}
`;

const FAILURE_VALUE_SOURCE = `
pragma solidcash ^0.13.0;
contract FailureValue() {
    function testWrongValue() {
        int[2][] pairs = [[10, 20], [30, 40]];
        require(pairs[0][0] == 999);
    }
}
`;

const FAILURE_LENGTH_SOURCE = `
pragma solidcash ^0.13.0;
contract FailureLength() {
    function testWrongLength() {
        int[2][] pairs = [[1, 2]];
        require(pairs.length == 5);
    }
}
`;

const FAILURE_PUSH_SOURCE = `
pragma solidcash ^0.13.0;
contract FailurePush() {
    function testWrongAfterPush() {
        int[2][] pairs = [[1, 2]];
        pairs.push([3, 4]);
        require(pairs[1][0] == 99);
    }
}
`;

// --- Tests ---------------------------------------------------------------

describe('Multi-Dimensional Arrays', () => {
  // -- 2D literal and chained access -----------------------------------
  describe('2D literal and chained access', () => {
    const { provider, contract } = setupContract(LITERAL_ACCESS_SOURCE);
    beforeAll(() => addUtxos(provider, contract.address, 6));

    it('should compile with correct ABI', () => {
      expect(contract.artifact.abi).toHaveLength(2);
    });

    it('access identity matrix diagonal (0,0)=1', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testAccess(0n, 0n));
      expect(tx.txid).toBeDefined();
    });

    it('access identity matrix off-diagonal (0,1)=0', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testAccess(0n, 1n));
      expect(tx.txid).toBeDefined();
    });

    it('access identity matrix last element (2,2)=1', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testAccess(2n, 2n));
      expect(tx.txid).toBeDefined();
    });

    it('access identity matrix bottom-left (2,0)=0', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testAccess(2n, 0n));
      expect(tx.txid).toBeDefined();
    });

    it('verify all constant-indexed values', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testConstants());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- push and pop ----------------------------------------------------
  describe('push and pop', () => {
    const { provider, contract } = setupContract(PUSH_POP_SOURCE);
    beforeAll(() => addUtxos(provider, contract.address, 4));

    it('push row, verify, pop, verify original intact', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testPushPop());
      expect(tx.txid).toBeDefined();
    });

    it('push 3 rows to empty array, verify all values', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testMultiplePush());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- inner row extraction --------------------------------------------
  describe('inner row extraction', () => {
    const { provider, contract } = setupContract(INNER_EXTRACT_SOURCE);
    beforeAll(() => addUtxos(provider, contract.address, 4));

    it('extract row0 and row1, verify all elements', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testExtractRow());
      expect(tx.txid).toBeDefined();
    });

    it('outer length of 3-row matrix == 3', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testOuterLength());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- diagonal pattern with parameterized index -----------------------
  describe('diagonal access with parameterized index', () => {
    const { provider, contract } = setupContract(DIAGONAL_SOURCE);
    beforeAll(() => addUtxos(provider, contract.address, 5));

    it('matrix[0][0] == 1', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testDiagonal(0n));
      expect(tx.txid).toBeDefined();
    });

    it('matrix[1][1] == 1', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testDiagonal(1n));
      expect(tx.txid).toBeDefined();
    });

    it('matrix[2][2] == 1', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testDiagonal(2n));
      expect(tx.txid).toBeDefined();
    });
  });

  // -- delete ----------------------------------------------------------
  describe('delete from 2D array', () => {
    const { provider, contract } = setupContract(DELETE_SOURCE);
    beforeAll(() => addUtxos(provider, contract.address, 2));

    it('delete middle row, verify remaining rows', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testDelete());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- outer assign ----------------------------------------------------
  describe('outer row assignment', () => {
    const { provider, contract } = setupContract(ASSIGN_SOURCE);
    beforeAll(() => addUtxos(provider, contract.address, 4));

    it('replace row[0] with new values, other row unchanged', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testOuterAssign());
      expect(tx.txid).toBeDefined();
    });

    it('push then assign - build array then overwrite rows', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testPushThenAssign());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- bool 2D arrays --------------------------------------------------
  describe('bool 2D arrays', () => {
    const { provider, contract } = setupContract(BOOL_2D_SOURCE);
    beforeAll(() => addUtxos(provider, contract.address, 4));

    it('bool 2D literal - verify all true/false values', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testLiteral());
      expect(tx.txid).toBeDefined();
    });

    it('bool 2D push - push new bool row', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testPush());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- bytes4 2D arrays ------------------------------------------------
  describe('bytes4 2D arrays', () => {
    const { provider, contract } = setupContract(BYTES_2D_SOURCE);
    beforeAll(() => addUtxos(provider, contract.address, 4));

    it('bytes4 2D literal - verify hex values', async () => {
      const tx = await sendTx(
        provider, contract,
        contract.unlock.testLiteral(new Uint8Array([0x00, 0x00, 0x00, 0x00])),
      );
      expect(tx.txid).toBeDefined();
    });

    it('bytes4 2D push - push new bytes pair', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testPush());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- fixed-size 2D arrays (both dimensions bounded) ------------------
  describe('fixed-size 2D arrays - int[3][2]', () => {
    const { provider, contract } = setupContract(FIXED_2D_SOURCE);
    beforeAll(() => addUtxos(provider, contract.address, 4));

    it('access all corners of 2x3 grid', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testAccess());
      expect(tx.txid).toBeDefined();
    });

    it('assign - replace a row', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testAssign());
      expect(tx.txid).toBeDefined();
    });
  });

  describe('fixed-size 2D - inner row extraction', () => {
    const { provider, contract } = setupContract(FIXED_INNER_SOURCE);
    beforeAll(() => addUtxos(provider, contract.address, 2));

    it('extract inner row and check length', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.testInnerLength());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- failure paths ---------------------------------------------------
  describe('failure paths - wrong assertions verify correctness', () => {
    it('wrong value - pairs[0][0] != 999', async () => {
      const { provider, contract } = setupContract(FAILURE_VALUE_SOURCE);
      await addUtxos(provider, contract.address, 2);
      await expect(
        sendTxExpectFail(provider, contract, contract.unlock.testWrongValue()),
      ).rejects.toThrow(FailedRequireError);
    });

    it('wrong length - pairs.length != 5', async () => {
      const { provider, contract } = setupContract(FAILURE_LENGTH_SOURCE);
      await addUtxos(provider, contract.address, 2);
      await expect(
        sendTxExpectFail(provider, contract, contract.unlock.testWrongLength()),
      ).rejects.toThrow(FailedRequireError);
    });

    it('wrong after push - pushed value != 99', async () => {
      const { provider, contract } = setupContract(FAILURE_PUSH_SOURCE);
      await addUtxos(provider, contract.address, 2);
      await expect(
        sendTxExpectFail(provider, contract, contract.unlock.testWrongAfterPush()),
      ).rejects.toThrow(FailedRequireError);
    });
  });
});
