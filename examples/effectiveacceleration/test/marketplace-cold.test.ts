import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Config } from '../src/utils/config';
import {
  decodeCustomJobEvent,
  decodeJobArbitratedEvent,
  decodeJobDisputedEvent,
  decodeJobMessageEvent,
  decodeJobRatedEvent,
  decodeJobSignedEvent,
} from '../src/utils/decodeEvents';
import { JobEventType } from '../src/interfaces';

const ETHER = 10n ** 18n;

// Mirrors MarketplaceV2.approveResult and the upstream suite's
// calculateExpectedReward helper, including Solidity's intermediate truncation.
const calculateExpectedReward = (
  jobAmount: bigint,
  rewardRate: bigint,
  eaccTokensPerToken: bigint,
): bigint => jobAmount * rewardRate / ETHER * eaccTokensPerToken / ETHER;

const lengthPrefixed = (...values: number[]): number[] => [values.length, 0, ...values];
const uint256 = (value: bigint): number[] => {
  const hex = value.toString(16).padStart(64, '0');
  return hex.match(/../g)!.map((byte) => Number.parseInt(byte, 16));
};

describe('marketplace cold paths', () => {
  describe('MarketplaceV2 reward calculation', () => {
    it('calculates the exact reward used for each recipient', () => {
      const reward = calculateExpectedReward(
        ethers.parseEther('100'),
        ethers.parseEther('0.05'),
        ethers.parseEther('2'),
      );

      expect(reward).to.equal(ethers.parseEther('10'));
      expect(reward * 3n).to.equal(ethers.parseEther('30'));
    });

    it('scales proportionally across the upstream job amount vectors', () => {
      const rate = ethers.parseEther('0.05');
      const tokensPerToken = ethers.parseEther('2');
      const amounts = ['50', '100', '200'].map(ethers.parseEther);

      expect(amounts.map((amount) => calculateExpectedReward(amount, rate, tokensPerToken)))
        .to.deep.equal(['5', '10', '20'].map(ethers.parseEther));
    });

    it('returns no reward when the token reward rate is disabled', () => {
      expect(calculateExpectedReward(ethers.parseEther('100'), 0n, ethers.parseEther('2')))
        .to.equal(0n);
    });

    it('preserves Solidity intermediate-division truncation', () => {
      const amount = 1n;
      const rate = 501n * ETHER / 1_000n;
      const tokensPerToken = 1_997n * ETHER / 1_000n;
      const contractOrder = amount * rate / ETHER * tokensPerToken / ETHER;
      const divideOnce = amount * rate * tokensPerToken / ETHER / ETHER;

      expect(calculateExpectedReward(amount, rate, tokensPerToken)).to.equal(contractOrder);
      expect(contractOrder).to.equal(0n);
      expect(divideOnce).to.equal(1n);
    });
  });

  describe('event decoding', () => {
    it('decodes signed events and dispatches them by event type', () => {
      const raw = Uint8Array.from([0, 42, 0xaa, 0xbb]);

      expect(decodeJobSignedEvent(raw)).to.deep.equal({ revision: 42, signatire: '0xaabb' });
      expect(decodeCustomJobEvent(JobEventType.Signed, raw))
        .to.deep.equal({ revision: 42, signatire: '0xaabb' });
    });

    it('decodes ratings with UTF-8 review text', () => {
      const raw = Uint8Array.from([5, ...new TextEncoder().encode('Great work ✓')]);

      expect(decodeJobRatedEvent(raw)).to.deep.equal({ rating: 5, review: 'Great work ✓' });
    });

    it('decodes encrypted dispute payloads', () => {
      const raw = Uint8Array.from([
        ...lengthPrefixed(0x01, 0x02, 0x03),
        ...lengthPrefixed(0xaa, 0xbb),
      ]);

      expect(decodeJobDisputedEvent(raw)).to.deep.equal({
        encryptedSessionKey: '0x010203',
        encryptedContent: '0xaabb',
      });
    });

    it('decodes message hashes and recipient addresses', () => {
      const hash = Array(32).fill(0x11);
      const recipient = '1234567890abcdef1234567890abcdef12345678';
      const raw = Uint8Array.from([...hash, ...recipient.match(/../g)!.map((byte) => Number.parseInt(byte, 16))]);

      expect(decodeJobMessageEvent(raw)).to.deep.equal({
        contentHash: `0x${'11'.repeat(32)}`,
        recipientAddress: ethers.getAddress(`0x${recipient}`),
      });
    });

    it('decodes arbitration shares, amounts, reason, and worker', () => {
      const worker = '1234567890abcdef1234567890abcdef12345678';
      const workerBytes = worker.match(/../g)!.map((byte) => Number.parseInt(byte, 16));
      const raw = Uint8Array.from([
        0, 60,
        ...uint256(600n),
        0, 40,
        ...uint256(400n),
        ...Array(32).fill(0xaa),
        ...workerBytes,
        ...uint256(25n),
      ]);

      expect(decodeJobArbitratedEvent(raw)).to.deep.equal({
        creatorShare: 60,
        creatorAmount: 600n,
        workerShare: 40,
        workerAmount: 400n,
        reasonHash: `0x${'aa'.repeat(32)}`,
        workerAddress: ethers.getAddress(`0x${worker}`),
        arbitratorAmount: 25n,
      });
    });

    it('returns undefined for event types without a custom payload', () => {
      expect(decodeCustomJobEvent(JobEventType.Completed, '0x')).to.equal(undefined);
    });
  });

  describe('network configuration', () => {
    it('loads the Hardhat marketplace configuration', () => {
      expect(Config('Hardhat').marketplaceFeeAddress)
        .to.equal('0x000000000000000000000000000000000000beef');
    });

    it('rejects unknown networks', () => {
      expect(() => Config('Chipnet')).to.throw('Config not found for network: Chipnet');
    });
  });
});
