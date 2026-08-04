import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  asmToBytecode,
  asmToScript,
  bytecodeToAsm,
  placeholder,
} from '@solidcash/utils';
import {
  scriptToAddress,
  createUnlockingBytecode,
  getInputSize,
  validateInput,
  validateOutput,
} from '../src/utils.js';
import { Network } from '../src/interfaces.js';
import { alicePkh, alicePub } from './fixture/vars.js';

describe('utils', () => {
  describe('getInputSize', () => {
    it('should calculate input size for small script', () => {
      const inputScript = new Uint8Array(100).fill(0);

      const size = getInputSize(inputScript);

      const expectedSize = 100 + 40 + 1;
      expect(size).toEqual(expectedSize);
    });

    it('should calculate input size for large script', () => {
      const inputScript = new Uint8Array(255).fill(0);

      const size = getInputSize(inputScript);

      const expectedSize = 255 + 40 + 3;
      expect(size).toEqual(expectedSize);
    });
  });

  describe('createUnlockingBytecode', () => {
    it('should create an input script without selector', () => {
      const asm = `${binToHex(alicePkh)} OP_OVER OP_HASH160 OP_EQUALVERIFY OP_CHECKSIG`;
      const contractBytecode = asmToBytecode(asm);
      const args = [alicePub, placeholder(1)];

      const inputScript = createUnlockingBytecode('p2sh32', contractBytecode, args);

      const expectedInputScriptAsm = `00 ${binToHex(alicePub)} ${binToHex(asmToBytecode(asm))}`;
      expect(bytecodeToAsm(inputScript)).toEqual(expectedInputScriptAsm);
    });

    it('should create an input script with selector', () => {
      const asm = `${binToHex(alicePkh)} OP_OVER OP_HASH160 OP_EQUALVERIFY OP_CHECKSIG`;
      const contractBytecode = asmToBytecode(asm);
      const args = [alicePub, placeholder(1)];
      const selector = hexToBin('aabbccdd');

      const inputScript = createUnlockingBytecode('p2sh32', contractBytecode, args, selector);

      const expectedInputScriptAsm = `aabbccdd 00 ${binToHex(alicePub)} ${binToHex(asmToBytecode(asm))}`;
      expect(bytecodeToAsm(inputScript)).toEqual(expectedInputScriptAsm);
    });

    it('should create an input script for a P2S contract', () => {
      const asm = `${binToHex(alicePkh)} OP_OVER OP_HASH160 OP_EQUALVERIFY OP_CHECKSIG`;
      const contractBytecode = asmToBytecode(asm);
      const args = [alicePub, placeholder(1)];

      const inputScript = createUnlockingBytecode('p2s', contractBytecode, args);

      const expectedInputScriptAsm = `00 ${binToHex(alicePub)}`;
      expect(bytecodeToAsm(inputScript)).toEqual(expectedInputScriptAsm);
    });
  });

  describe('validateInput', () => {
    it('should throw for undefined input', () => {
      expect(() => validateInput(undefined as any)).toThrow('Input is undefined');
    });

    it('should throw for non-hex txid', () => {
      expect(() => validateInput({ txid: 'zzzz', vout: 0, satoshis: 100n })).toThrow('Invalid input txid');
    });

    it('should throw for short txid', () => {
      expect(() => validateInput({ txid: 'aabb', vout: 0, satoshis: 100n })).toThrow('Invalid input txid');
    });

    it('should throw for negative vout', () => {
      expect(() => validateInput({ txid: 'aa'.repeat(32), vout: -1, satoshis: 100n })).toThrow('Invalid input vout');
    });

    it('should throw for fractional vout', () => {
      expect(() => validateInput({ txid: 'aa'.repeat(32), vout: 1.5, satoshis: 100n })).toThrow('Invalid input vout');
    });

    it('should throw for negative satoshis', () => {
      expect(() => validateInput({ txid: 'aa'.repeat(32), vout: 0, satoshis: -1n })).toThrow('Invalid input satoshis');
    });

    it('should accept zero satoshis', () => {
      const input = { txid: 'aa'.repeat(32), vout: 0, satoshis: 0n };
      validateInput(input);
      expect(input).toEqual({ txid: 'aa'.repeat(32), vout: 0, satoshis: 0n });
      expect(() => validateInput({ ...input, satoshis: -1n })).toThrow('Invalid input satoshis');
    });

    it('should throw for invalid token category', () => {
      expect(() => validateInput({
        txid: 'aa'.repeat(32), vout: 0, satoshis: 100n,
        token: { category: 'short', amount: 0n },
      })).toThrow('Invalid input token category');
    });

    it('should throw for negative token amount', () => {
      expect(() => validateInput({
        txid: 'aa'.repeat(32), vout: 0, satoshis: 100n,
        token: { category: 'bb'.repeat(32), amount: -1n },
      })).toThrow('Invalid input token amount');
    });

    it('should throw for non-hex NFT commitment', () => {
      expect(() => validateInput({
        txid: 'aa'.repeat(32), vout: 0, satoshis: 100n,
        token: { category: 'bb'.repeat(32), amount: 0n, nft: { capability: 'none', commitment: 'xyz' } },
      })).toThrow('Invalid input NFT commitment');
    });

    it('should accept a valid input with token and NFT', () => {
      const input = {
        txid: 'aa'.repeat(32), vout: 0, satoshis: 100n,
        token: { category: 'bb'.repeat(32), amount: 10n, nft: { capability: 'mutable', commitment: 'aabb' } },
      } as const;
      validateInput(input);
      expect(input.token).toMatchObject({ amount: 10n, nft: { capability: 'mutable', commitment: 'aabb' } });
      expect(() => validateInput({ ...input, token: { ...input.token, category: 'short' } }))
        .toThrow('Invalid input token category');
    });
  });

  describe('validateOutput', () => {
    it('should throw for negative amount on bytecode output', () => {
      expect(() => validateOutput({ to: new Uint8Array([0x00]), amount: -1n })).toThrow('Tried to add an output with -1 satoshis');
    });

    it('should throw for negative token amount on bytecode output', () => {
      expect(() => validateOutput({
        to: new Uint8Array([0x00]), amount: 1000n,
        token: { category: 'aa'.repeat(32), amount: -5n },
      })).toThrow('Tried to add an output with -5 tokens, which is invalid');
    });

    it('should accept zero amount bytecode output (OP_RETURN-like)', () => {
      const output = { to: new Uint8Array([0x6a]), amount: 0n };
      validateOutput(output);
      expect([...output.to]).toEqual([0x6a]);
      expect(output.amount).toBe(0n);
      expect(() => validateOutput({ ...output, amount: -1n }))
        .toThrow('Tried to add an output with -1 satoshis');
    });
  });

  describe('scriptToAddress', () => {
    it('should convert a redeem script to a cashaddress', () => {
      const asm = `${binToHex(alicePkh)} OP_OVER OP_HASH160 OP_EQUALVERIFY OP_CHECKSIG`;
      const contractBytecodeScript = asmToScript(asm);

      const mainnetAddressP2sh32 = scriptToAddress(contractBytecodeScript, Network.MAINNET, 'p2sh32', false);
      const testnetAddressP2sh32 = scriptToAddress(contractBytecodeScript, Network.TESTNET4, 'p2sh32', false);
      const regtestAddressP2sh32 = scriptToAddress(contractBytecodeScript, Network.REGTEST, 'p2sh32', false);
      const mainnetAddressP2sh20 = scriptToAddress(contractBytecodeScript, Network.MAINNET, 'p2sh20', false);
      const testnetAddressP2sh20 = scriptToAddress(contractBytecodeScript, Network.TESTNET4, 'p2sh20', false);
      const regtestAddressP2sh20 = scriptToAddress(contractBytecodeScript, Network.REGTEST, 'p2sh20', false);
      const mainnetAddressP2sh32Tokens = scriptToAddress(contractBytecodeScript, Network.MAINNET, 'p2sh32', true);
      const testnetAddressP2sh32Tokens = scriptToAddress(contractBytecodeScript, Network.TESTNET4, 'p2sh32', true);
      const regtestAddressP2sh32Tokens = scriptToAddress(contractBytecodeScript, Network.REGTEST, 'p2sh32', true);
      const mainnetAddressP2sh20Tokens = scriptToAddress(contractBytecodeScript, Network.MAINNET, 'p2sh20', true);
      const testnetAddressP2sh20Tokens = scriptToAddress(contractBytecodeScript, Network.TESTNET4, 'p2sh20', true);
      const regtestAddressP2sh20Tokens = scriptToAddress(contractBytecodeScript, Network.REGTEST, 'p2sh20', true);

      const expectedMainnetAddressP2sh32 = 'bitcoincash:pv6dnl7ws66dzdk2wn5akmmyx0f4fztx56lqvszjuu52fsw3d23629h20jd0s';
      const expectedTestnetAddressP2sh32 = 'bchtest:pv6dnl7ws66dzdk2wn5akmmyx0f4fztx56lqvszjuu52fsw3d2362xsm3276z';
      const expectedRegtestAddressP2sh32 = 'bchreg:pv6dnl7ws66dzdk2wn5akmmyx0f4fztx56lqvszjuu52fsw3d2362n6fmdfd2';
      const expectedMainnetAddressP2sh20 = 'bitcoincash:pr4wzdh0h9d7fpu890lq8xz0c84cpv3nvyc27hzc7y';
      const expectedTestnetAddressP2sh20 = 'bchtest:pr4wzdh0h9d7fpu890lq8xz0c84cpv3nvyuc6sq0ec';
      const expectedRegtestAddressP2sh20 = 'bchreg:pr4wzdh0h9d7fpu890lq8xz0c84cpv3nvyxyv3ru67';
      const expectedMainnetAddressP2sh32Tokens = 'bitcoincash:rv6dnl7ws66dzdk2wn5akmmyx0f4fztx56lqvszjuu52fsw3d2362hykwtvkm';
      const expectedTestnetAddressP2sh32Tokens = 'bchtest:rv6dnl7ws66dzdk2wn5akmmyx0f4fztx56lqvszjuu52fsw3d23625r8snlrf';
      const expectedRegtestAddressP2sh32Tokens = 'bchreg:rv6dnl7ws66dzdk2wn5akmmyx0f4fztx56lqvszjuu52fsw3d2362pf465g5p';
      const expectedMainnetAddressP2sh20Tokens = 'bitcoincash:rr4wzdh0h9d7fpu890lq8xz0c84cpv3nvylqdfv7ph';
      const expectedTestnetAddressP2sh20Tokens = 'bchtest:rr4wzdh0h9d7fpu890lq8xz0c84cpv3nvymjfwwfxt';
      const expectedRegtestAddressP2sh20Tokens = 'bchreg:rr4wzdh0h9d7fpu890lq8xz0c84cpv3nvypwl0d69d';

      expect(mainnetAddressP2sh32).toEqual(expectedMainnetAddressP2sh32);
      expect(testnetAddressP2sh32).toEqual(expectedTestnetAddressP2sh32);
      expect(regtestAddressP2sh32).toEqual(expectedRegtestAddressP2sh32);
      expect(mainnetAddressP2sh20).toEqual(expectedMainnetAddressP2sh20);
      expect(testnetAddressP2sh20).toEqual(expectedTestnetAddressP2sh20);
      expect(regtestAddressP2sh20).toEqual(expectedRegtestAddressP2sh20);
      expect(mainnetAddressP2sh32Tokens).toEqual(expectedMainnetAddressP2sh32Tokens);
      expect(testnetAddressP2sh32Tokens).toEqual(expectedTestnetAddressP2sh32Tokens);
      expect(regtestAddressP2sh32Tokens).toEqual(expectedRegtestAddressP2sh32Tokens);
      expect(mainnetAddressP2sh20Tokens).toEqual(expectedMainnetAddressP2sh20Tokens);
      expect(testnetAddressP2sh20Tokens).toEqual(expectedTestnetAddressP2sh20Tokens);
      expect(regtestAddressP2sh20Tokens).toEqual(expectedRegtestAddressP2sh20Tokens);
    });
  });
});
