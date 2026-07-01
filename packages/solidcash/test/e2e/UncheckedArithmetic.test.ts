import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// --- Helpers -------------------------------------------------------------

// Compiled with { forceStateful: true } so each spend is the short `await sc.call.check(args)` self-poke
// covenant (no dummy state, no manual UTXO gathering).
async function spend(code: string, ...args: bigint[]): Promise<any> {
  const sc = await deployStateful(compileString(code, { forceStateful: true }));
  return sc.call.check(...args); // thenable: the caller awaits, which sends
}

// --- Tests ---------------------------------------------------------------

describe('Unchecked Arithmetic - SDK e2e', () => {
  describe('unsigned overflow wrapping', () => {
    it('uint8(255) + uint8(1) wraps to 0', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              uint8 y = uint8(255) + uint8(1);
              require(y == 0);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });

    it('uint16(65535) + uint16(1) wraps to 0', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              uint16 y = uint16(65535) + uint16(1);
              require(y == 0);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('unsigned underflow wrapping', () => {
    it('uint8(0) - uint8(1) wraps to 255', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              uint8 y = uint8(0) - uint8(1);
              require(y == 255);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });

    it('uint16(0) - uint16(1) wraps to 65535', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              uint16 y = uint16(0) - uint16(1);
              require(y == 65535);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('signed overflow wrapping', () => {
    it('int8(127) + int8(1) wraps to -128', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              int8 y = int8(127) + int8(1);
              require(y == -128);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });

    it('int16(32767) + int16(1) wraps to -32768', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              int16 y = int16(32767) + int16(1);
              require(y == -32768);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('signed underflow wrapping', () => {
    it('int8(-128) - int8(1) wraps to 127', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              int8 y = int8(-128) - int8(1);
              require(y == 127);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('unchecked cast wrapping', () => {
    it('uint8(int(256)) wraps to 0', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              uint8 y = uint8(256);
              require(y == 0);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });

    it('int8(int(128)) wraps to -128', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              int8 y = int8(128);
              require(y == -128);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('multiplication wrapping', () => {
    it('uint8(200) * uint8(2) wraps to 144', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              uint8 y = uint8(200) * uint8(2);
              require(y == 144);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('mixed checked and unchecked', () => {
    it('checked code outside unchecked block still enforces bounds', async () => {
      const code = `
        contract Test() {
          function check(uint8 a) {
            require(a <= 200);

            unchecked {
              uint8 b = a + uint8(100);
              require(b >= 0);
            }
          }
        }
      `;

      const tx = await spend(code, 100n);
      expect(tx.txid).toBeDefined();
    });

    it('checked overflow outside unchecked block still fails', async () => {
      const code = `
        contract Test() {
          function check(uint8 a) {
            uint8 b = a + uint8(1);
            require(b > 0);
          }
        }
      `;

      // 255 + 1 overflows in checked mode -> should fail (bounds check OP_VERIFY)
      const txPromise = spend(code, 255n);
      await expect(txPromise).rejects.toThrow();
    });
  });

  describe('runtime args wrapping', () => {
    it('runtime uint8 addition wraps correctly', async () => {
      const code = `
        contract Test() {
          function check(uint8 a, uint8 b, uint8 expected) {
            unchecked {
              uint8 result = a + b;
              require(result == expected);
            }
          }
        }
      `;

      // 200 + 100 = 300, wraps to 300 % 256 = 44
      const tx = await spend(code, 200n, 100n, 44n);
      expect(tx.txid).toBeDefined();
    });

    it('runtime int8 subtraction wraps correctly', async () => {
      const code = `
        contract Test() {
          function check(int8 a, int8 b, int8 expected) {
            unchecked {
              int8 result = a - b;
              require(result == expected);
            }
          }
        }
      `;

      // -100 - 100 = -200, wraps: (-200 - (-128)) = -72, (-72 % 256 + 256) % 256 = 184, 184 + (-128) = 56
      const tx = await spend(code, -100n, 100n, 56n);
      expect(tx.txid).toBeDefined();
    });

    it('runtime wrong expected value fails require', async () => {
      const code = `
        contract Test() {
          function check(uint8 a, uint8 b, uint8 expected) {
            unchecked {
              uint8 result = a + b;
              require(result == expected);
            }
          }
        }
      `;

      // 200 + 100 wraps to 44, but we pass 45 -> should fail
      const txPromise = spend(code, 200n, 100n, 45n);
      await expect(txPromise).rejects.toThrow();
    });
  });

  describe('negation wrapping', () => {
    it('negation of int8(-128) wraps to -128', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              int8 y = -int8(-128);
              require(y == -128);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('nested unchecked blocks', () => {
    it('nested unchecked blocks both wrap correctly', async () => {
      const code = `
        contract Test() {
          function check() {
            unchecked {
              uint8 a = uint8(255) + uint8(1);
              unchecked {
                uint8 b = uint8(0) - uint8(1);
                require(b == 255);
              }
              require(a == 0);
            }
          }
        }
      `;

      const tx = await spend(code);
      expect(tx.txid).toBeDefined();
    });
  });
});
