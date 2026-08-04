import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

const MEMORY_CALLDATA_CONTRACT = `
contract MemoryCalldata() {
    function test(bytes memory data, bigint value) {
        require(data.length > 0);
        require(value > 0);

        bigint localVar = 0;
        require(localVar == 0);
    }
}
`;

describe('MemoryCalldata', () => {
  const artifact = compileString(MEMORY_CALLDATA_CONTRACT);

  describe('test', () => {
    it('should succeed with valid data and positive value', async () => {
      const factory = getContractFactory(
        compileString(MEMORY_CALLDATA_CONTRACT, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      const tx = await sc.test(new Uint8Array([1, 2, 3]), 100n);
      expect(tx.txid).toBeDefined();
    });

    it('should fail with empty data (data.length > 0 fails)', async () => {
      const factory = getContractFactory(
        compileString(MEMORY_CALLDATA_CONTRACT, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      await expect(sc.test(new Uint8Array([]), 100n)).rejects.toThrow(verifyFailure);
    });

    it('should fail with non-positive value (value > 0 fails)', async () => {
      const factory = getContractFactory(
        compileString(MEMORY_CALLDATA_CONTRACT, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      await expect(sc.test(new Uint8Array([1]), 0n)).rejects.toThrow(verifyFailure);
    });

    it('should fail with negative value', async () => {
      const factory = getContractFactory(
        compileString(MEMORY_CALLDATA_CONTRACT, { forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      await expect(sc.test(new Uint8Array([1]), -5n)).rejects.toThrow(verifyFailure);
    });
  });

  describe('artifact', () => {
    it('should have correct ABI with memory/calldata parameters', () => {
      expect(artifact.abi).toHaveLength(1);
      expect(artifact.abi[0].name).toBe('test');
      expect(artifact.abi[0].inputs).toEqual([
        { name: 'data', type: 'bytes' },
        { name: 'value', type: 'bigint' },
      ]);
    });

    it('memory and calldata modifiers should not affect the compiled bytecode', () => {
      const withoutModifiers = compileString(`
        contract MemoryCalldata() {
            function test(bytes data, bigint value) {
                require(data.length > 0);
                require(value > 0);

                bigint localVar = 0;
                require(localVar == 0);
            }
        }
      `);

      expect(artifact.bytecode).toBe(withoutModifiers.bytecode);
    });

    it('memory modifier in return type should not affect bytecode', () => {
      const withReturnModifier = compileString(`
        contract Test() {
            function add(bytes memory a) internal pure returns (bytes memory) {
                return a;
            }
            function run(bytes memory a) {
                require(add(a).length > 0);
            }
        }
      `);

      const withoutReturnModifier = compileString(`
        contract Test() {
            function add(bytes a) internal pure returns (bytes) {
                return a;
            }
            function run(bytes a) {
                require(add(a).length > 0);
            }
        }
      `);

      expect(withReturnModifier.bytecode).toBe(withoutReturnModifier.bytecode);
    });

    it('calldata modifier in return type should not affect bytecode', () => {
      const withReturnModifier = compileString(`
        contract Test() {
            function getVal(bytes calldata x) internal pure returns (bytes calldata) {
                return x;
            }
            function run(bytes calldata x) {
                require(getVal(x).length > 0);
            }
        }
      `);

      const withoutReturnModifier = compileString(`
        contract Test() {
            function getVal(bytes x) internal pure returns (bytes) {
                return x;
            }
            function run(bytes x) {
                require(getVal(x).length > 0);
            }
        }
      `);

      expect(withReturnModifier.bytecode).toBe(withoutReturnModifier.bytecode);
    });
  });
});
