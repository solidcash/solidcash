import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  decryptBinaryData,
  decryptUtf8Data,
  encryptBinaryData,
  encryptUtf8Data,
} from '../src/utils/encryption';
import {
  decodeAddress,
  decodeAddressArray,
  decodeBool,
  decodeBytes,
  decodeBytes32,
  decodeString,
  decodeStringArray,
  decodeUint16,
  decodeUint32,
  decodeUint256,
} from '../src/utils/decodeData';
import { decryptJobDisputedEvent } from '../src/utils/decodeEvents';
import type { JobDisputedEvent } from '../src/interfaces';

const sessionKey = `0x${'11'.repeat(32)}`;
const arbitrationKey = `0x${'22'.repeat(32)}`;
const unrelatedKey = `0x${'33'.repeat(32)}`;

describe('encryption cold paths', () => {
  describe('binary and UTF-8 encryption', () => {
    it('round-trips plaintext through the no-key wire format', () => {
      const data = Uint8Array.from([0, 1, 2, 0xff]);
      const encoded = encryptBinaryData(data, undefined);

      expect(encoded.slice(0, 24)).to.deep.equal(new Uint8Array(24));
      expect(encoded.slice(24)).to.deep.equal(data);
      expect(decryptBinaryData(encoded, undefined)).to.deep.equal(data);
    });

    it('round-trips authenticated ciphertext with a session key', () => {
      const data = Uint8Array.from([1, 2, 3, 4, 5]);
      const encrypted = encryptBinaryData(data, sessionKey);

      expect(encrypted.length).to.equal(24 + data.length + 16);
      expect(encrypted.slice(0, 24)).not.to.deep.equal(new Uint8Array(24));
      expect(decryptBinaryData(encrypted, sessionKey)).to.deep.equal(data);
    });

    it('round-trips Unicode messages', () => {
      const encrypted = encryptUtf8Data('Bitcoin Cash ⛏️', sessionKey);
      expect(decryptUtf8Data(encrypted, sessionKey)).to.equal('Bitcoin Cash ⛏️');
    });

    it('rejects empty input', () => {
      expect(() => encryptBinaryData(new Uint8Array(), sessionKey)).to.throw('empty data');
    });

    it('requires the correct key for authenticated ciphertext', () => {
      const encrypted = encryptUtf8Data('secret', sessionKey);

      expect(() => decryptUtf8Data(encrypted, undefined))
        .to.throw('Session key is required to decrypt the message');
      expect(() => decryptUtf8Data(encrypted, unrelatedKey)).to.throw('invalid tag');
    });
  });

  describe('dispute decryption roles', () => {
    const encryptedDispute = (keyForWrappedSession: string): JobDisputedEvent => ({
      encryptedSessionKey: ethers.hexlify(encryptBinaryData(ethers.getBytes(sessionKey), keyForWrappedSession)),
      encryptedContent: ethers.hexlify(encryptUtf8Data('Private dispute details', sessionKey)),
    });

    it('unwraps the shared content key for an arbitrator', () => {
      const event = encryptedDispute(arbitrationKey);
      decryptJobDisputedEvent(event, arbitrationKey);

      expect(event.sessionKey).to.equal(sessionKey);
      expect(event.content).to.equal('Private dispute details');
    });

    it('falls back to the direct owner-worker key', () => {
      const event = encryptedDispute(arbitrationKey);
      decryptJobDisputedEvent(event, sessionKey);

      expect(event.sessionKey).to.equal(undefined);
      expect(event.content).to.equal('Private dispute details');
    });

    it('returns a stable placeholder when neither decryption path works', () => {
      const event = encryptedDispute(arbitrationKey);
      decryptJobDisputedEvent(event, unrelatedKey);

      expect(event.sessionKey).to.equal(undefined);
      expect(event.content).to.equal('<encrypted message>');
    });
  });

  describe('SolidCash packed-data primitives', () => {
    it('decodes strings, bytes, and string arrays while advancing the cursor', () => {
      const stringPtr = { bytes: Uint8Array.from([3, 0, 0x62, 0x63, 0x68]), index: 0 };
      expect(decodeString(stringPtr)).to.equal('bch');
      expect(stringPtr.index).to.equal(5);

      const bytesPtr = { bytes: Uint8Array.from([2, 0, 0xaa, 0xbb]), index: 0 };
      expect(decodeBytes(bytesPtr)).to.equal('0xaabb');
      expect(bytesPtr.index).to.equal(4);

      const arrayPtr = {
        bytes: Uint8Array.from([2, 0, 3, 0, 0x6f, 0x6e, 0x65, 3, 0, 0x74, 0x77, 0x6f]),
        index: 0,
      };
      expect(decodeStringArray(arrayPtr)).to.deep.equal(['one', 'two']);
      expect(arrayPtr.index).to.equal(12);
    });

    it('decodes address arrays with native sign padding', () => {
      const first = '1111111111111111111111111111111111111111';
      const second = '2222222222222222222222222222222222222222';
      const bytes = [
        2, 0,
        ...first.match(/../g)!.map((byte) => Number.parseInt(byte, 16)), 0,
        ...second.match(/../g)!.map((byte) => Number.parseInt(byte, 16)), 0,
      ];
      const ptr = { bytes: Uint8Array.from(bytes), index: 0 };

      expect(decodeAddressArray(ptr)).to.deep.equal([
        ethers.getAddress(`0x${first}`), ethers.getAddress(`0x${second}`),
      ]);
      expect(ptr.index).to.equal(44);
    });

    it('decodes zero addresses in explicit and minimal VM-number forms', () => {
      const explicit = { bytes: Uint8Array.from([0]), index: 0 };
      const minimal = { bytes: new Uint8Array(), index: 0 };

      expect(decodeAddress(explicit)).to.equal(ethers.ZeroAddress);
      expect(explicit.index).to.equal(1);
      expect(decodeAddress(minimal)).to.equal(ethers.ZeroAddress);
      expect(minimal.index).to.equal(0);
    });

    it('decodes fixed-width values with their native byte order and widths', () => {
      const bytes32 = { bytes: Uint8Array.from(Array(32).fill(0xaa)), index: 0 };
      expect(decodeBytes32(bytes32)).to.equal(`0x${'aa'.repeat(32)}`);
      expect(bytes32.index).to.equal(32);

      const uint256 = { bytes: Uint8Array.from([0x34, 0x12, ...Array(30).fill(0)]), index: 0 };
      expect(decodeUint256(uint256)).to.equal(0x1234n);
      expect(uint256.index).to.equal(32);

      const uint32 = { bytes: Uint8Array.from([0x78, 0x56, 0x34, 0x12, 0]), index: 0 };
      expect(decodeUint32(uint32)).to.equal(0x12345678);
      expect(uint32.index).to.equal(5);

      const uint16 = { bytes: Uint8Array.from([0x34, 0x12, 0, 0]), index: 0 };
      expect(decodeUint16(uint16)).to.equal(0x1234);
      expect(uint16.index).to.equal(4);
    });

    it('decodes booleans strictly from one', () => {
      const truthy = { bytes: Uint8Array.from([1]), index: 0 };
      const nonCanonical = { bytes: Uint8Array.from([2]), index: 0 };
      expect(decodeBool(truthy)).to.equal(true);
      expect(decodeBool(nonCanonical)).to.equal(false);
    });
  });
});
