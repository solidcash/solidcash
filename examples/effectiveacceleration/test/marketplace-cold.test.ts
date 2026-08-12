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
import { computeJobStateDiffs } from '../src/utils/ui';
import { Job, JobEvent, JobEventType, JobState } from '../src/interfaces';

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
const uint256Le = (value: bigint): number[] => uint256(value).reverse();
const addressField = (address: string): number[] => [
  ...address.slice(2).match(/../g)!.map((byte) => Number.parseInt(byte, 16)),
  0,
];
const stringField = (value: string): number[] => lengthPrefixed(...new TextEncoder().encode(value));

const createdEventData = (amount = 100n): Uint8Array => Uint8Array.from([
  ...stringField('Cold job'),
  ...Array(32).fill(0xab),
  0,
  1, 0, ...stringField('test'),
  ...addressField(worker),
  ...uint256Le(amount),
  0x10, 0x0e, 0, 0,
  ...stringField('ipfs'),
  ...addressField(arbitrator),
  1,
]);

const updatedEventData = (amount: bigint): Uint8Array => Uint8Array.from([
  ...stringField('Updated job'),
  ...Array(32).fill(0xcd),
  2, 0, ...stringField('typescript'), ...stringField('bitcoin-cash'),
  ...uint256Le(amount),
  0x20, 0x1c, 0, 0,
  ...addressField(creator),
  0,
]);

const creator = '0x1111111111111111111111111111111111111111';
const worker = '0x2222222222222222222222222222222222222222';
const arbitrator = '0x3333333333333333333333333333333333333333';

const jobFixture = (): Job => ({
  id: '7',
  title: 'Cold job',
  contentHash: ethers.ZeroHash,
  multipleApplicants: false,
  tags: ['test'],
  token: ethers.ZeroAddress,
  amount: 100n,
  maxTime: 3_600,
  deliveryMethod: 'ipfs',
  whitelistWorkers: true,
  collateralOwed: 0n,
  disputed: false,
  state: JobState.Open,
  escrowId: 0n,
  rating: 0,
  roles: { creator, worker: ethers.ZeroAddress, arbitrator },
  timestamp: 100,
  resultHash: ethers.ZeroHash,
  allowedWorkers: [],
  jobTimes: {
    createdAt: 100,
    openedAt: 100,
    assignedAt: 0,
    closedAt: 0,
    disputedAt: 0,
    arbitratedAt: 0,
    updatedAt: 0,
    lastEventAt: 100,
  },
} as Job);

const jobEvent = (
  type_: JobEventType,
  overrides: Partial<JobEvent> = {},
): JobEvent => ({
  jobId: 7n,
  type_,
  address_: '0x',
  data_: '0x',
  timestamp_: 101,
  ...overrides,
} as JobEvent);

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

  describe('client job state reconstruction', () => {
    it('constructs a job from its created event', () => {
      const [result] = computeJobStateDiffs([
        jobEvent(JobEventType.Created, {
          address_: creator,
          data_: createdEventData(),
          timestamp_: 100,
        }),
      ], '7');

      expect(result.id).to.equal('0');
      expect(result.job.title).to.equal('Cold job');
      expect(result.job.contentHash).to.equal(`0x${'ab'.repeat(32)}`);
      expect(result.job.tags).to.deep.equal(['test']);
      expect(result.job.token).to.equal(ethers.getAddress(worker));
      expect(result.job.amount).to.equal(100n);
      expect(result.job.maxTime).to.equal(3_600);
      expect(result.job.deliveryMethod).to.equal('ipfs');
      expect(result.job.roles.arbitrator).to.equal(ethers.getAddress(arbitrator));
      expect(ethers.hexlify(result.job.roles.creator as unknown as Uint8Array))
        .to.equal(`0x76a914${creator.slice(2)}88ac`);
      expect(result.job.state).to.equal(JobState.Open);
      expect(result.job.jobTimes!.lastEventAt).to.equal(100);
      expect(result.diffs.map((diff) => diff.field)).to.include('roles.creator');
    });

    it('updates job metadata and accrues collateral on a recent reduction', () => {
      const [result] = computeJobStateDiffs([
        jobEvent(JobEventType.Updated, {
          data_: updatedEventData(60n),
          timestamp_: 200,
        }),
      ], '7', jobFixture());

      expect(result.job.title).to.equal('Updated job');
      expect(result.job.tags).to.deep.equal(['typescript', 'bitcoin-cash']);
      expect(result.job.amount).to.equal(60n);
      expect(result.job.collateralOwed).to.equal(40n);
      expect(result.job.maxTime).to.equal(7_200);
      expect(result.job.roles.arbitrator).to.equal(ethers.getAddress(creator));
      expect(result.job.whitelistWorkers).to.equal(false);
      expect(result.job.jobTimes!.updatedAt).to.equal(200);
    });

    it('clears collateral when an update increases the job amount', () => {
      const job = jobFixture();
      job.collateralOwed = 25n;
      const [result] = computeJobStateDiffs([
        jobEvent(JobEventType.Updated, {
          data_: updatedEventData(150n),
          timestamp_: 200,
        }),
      ], '7', job);

      expect(result.job.amount).to.equal(150n);
      expect(result.job.collateralOwed).to.equal(0n);
    });

    it('takes a job and records meaningful old and new values', () => {
      const result = computeJobStateDiffs([
        jobEvent(JobEventType.Taken, {
          address_: worker,
          data_: ethers.toBeHex(42n),
          timestamp_: 200,
        }),
      ], '7', jobFixture());

      expect(result[0].job.state).to.equal(JobState.Taken);
      expect(result[0].job.roles.worker).to.equal(ethers.getAddress(worker));
      expect(result[0].job.escrowId).to.equal(42n);
      expect(result[0].job.jobTimes!.assignedAt).to.equal(200);
      expect(result[0].diffs).to.deep.equal([
        { field: 'state', oldValue: JobState.Open, newValue: JobState.Taken },
        { field: 'roles.worker', oldValue: ethers.ZeroAddress, newValue: ethers.getAddress(worker) },
        { field: 'escrowId', oldValue: 0n, newValue: 42n },
      ]);
    });

    it('tracks delivery, rating, and completion in event order', () => {
      const resultHash = `0x${'ab'.repeat(32)}`;
      const result = computeJobStateDiffs([
        jobEvent(JobEventType.Delivered, { data_: resultHash, timestamp_: 200 }),
        jobEvent(JobEventType.Rated, {
          data_: Uint8Array.from([5, ...new TextEncoder().encode('Excellent')]),
          timestamp_: 201,
        }),
        jobEvent(JobEventType.Completed, { timestamp_: 202 }),
      ], '7', jobFixture());

      expect(result.map((event) => event.id)).to.deep.equal(['0', '1', '2']);
      expect(result[0].job.resultHash).to.equal(resultHash);
      expect(result[1].job.rating).to.equal(5);
      expect(result[1].details).to.deep.equal({ rating: 5, review: 'Excellent' });
      expect(result[2].job.state).to.equal(JobState.Closed);
      expect(result[2].job.jobTimes!.closedAt).to.equal(202);
      expect(result[2].job.jobTimes!.lastEventAt).to.equal(202);
    });

    it('adds and removes whitelisted workers without aliasing diff snapshots', () => {
      const result = computeJobStateDiffs([
        jobEvent(JobEventType.WhitelistedWorkerAdded, { address_: worker }),
        jobEvent(JobEventType.WhitelistedWorkerRemoved, { address_: worker }),
      ], '7', jobFixture());

      expect(result[0].diffs[0]).to.deep.equal({
        field: 'allowedWorkers', oldValue: [], newValue: [ethers.getAddress(worker)],
      });
      expect(result[1].diffs[0]).to.deep.equal({
        field: 'allowedWorkers', oldValue: [ethers.getAddress(worker)], newValue: [],
      });
    });

    it('accounts for collateral when a recent job is closed and reopened', () => {
      const result = computeJobStateDiffs([
        jobEvent(JobEventType.Closed, { timestamp_: 200 }),
        jobEvent(JobEventType.Reopened, { timestamp_: 300 }),
      ], '7', jobFixture());

      expect(result[0].job.collateralOwed).to.equal(100n);
      expect(result[1].job.collateralOwed).to.equal(0n);
      expect(result[1].job.state).to.equal(JobState.Open);
      expect(result[1].job.timestamp).to.equal(300);
    });

    it('does not accrue collateral when a job closes after one day', () => {
      const result = computeJobStateDiffs([
        jobEvent(JobEventType.Closed, { timestamp_: 100 + 86_400 }),
      ], '7', jobFixture());

      expect(result[0].job.collateralOwed).to.equal(0n);
    });

    it('resets assignment state when a disputed job is refunded', () => {
      const job = jobFixture();
      job.state = JobState.Taken;
      job.disputed = true;
      job.escrowId = 42n;
      job.roles.worker = ethers.getAddress(worker);
      job.allowedWorkers = [ethers.getAddress(worker), ethers.getAddress(arbitrator)];

      const [result] = computeJobStateDiffs([
        jobEvent(JobEventType.Refunded, { timestamp_: 250 }),
      ], '7', job);

      expect(result.job.state).to.equal(JobState.Open);
      expect(result.job.disputed).to.equal(false);
      expect(result.job.escrowId).to.equal(0n);
      expect(result.job.roles.worker).to.equal(ethers.ZeroAddress);
      expect(result.job.allowedWorkers).to.deep.equal([ethers.getAddress(arbitrator)]);
    });

    it('applies dispute and arbitration outcomes', () => {
      const arbitration = Uint8Array.from([
        0, 60,
        ...uint256(60n),
        0, 40,
        ...uint256(40n),
        ...Array(32).fill(0xaa),
        ...worker.slice(2).match(/../g)!.map((byte) => Number.parseInt(byte, 16)),
        ...uint256(5n),
      ]);
      const result = computeJobStateDiffs([
        jobEvent(JobEventType.Disputed, {
          data_: Uint8Array.from([...lengthPrefixed(1), ...lengthPrefixed(2)]),
          timestamp_: 200,
        }),
        jobEvent(JobEventType.Arbitrated, { data_: arbitration, timestamp_: 300 }),
      ], '7', jobFixture());

      expect(result[0].job.disputed).to.equal(true);
      expect(result[1].job.disputed).to.equal(false);
      expect(result[1].job.state).to.equal(JobState.Closed);
      expect(result[1].job.collateralOwed).to.equal(60n);
      expect(result[1].job.jobTimes!.arbitratedAt).to.equal(300);
    });

    it('handles signature, message, refusal, and collateral withdrawal events', () => {
      const job = jobFixture();
      job.collateralOwed = 80n;
      const message = Uint8Array.from([
        ...Array(32).fill(0xee),
        ...worker.slice(2).match(/../g)!.map((byte) => Number.parseInt(byte, 16)),
      ]);
      const result = computeJobStateDiffs([
        jobEvent(JobEventType.Signed, { data_: Uint8Array.from([0, 3, 0xaa]) }),
        jobEvent(JobEventType.WorkerMessage, { data_: message }),
        jobEvent(JobEventType.ArbitrationRefused),
        jobEvent(JobEventType.CollateralWithdrawn),
      ], '7', job);

      expect(result[0].details).to.deep.equal({ revision: 3, signatire: '0xaa' });
      expect(result[1].details).to.deep.equal({
        contentHash: `0x${'ee'.repeat(32)}`,
        recipientAddress: ethers.getAddress(worker),
      });
      expect(result[2].job.roles.arbitrator).to.equal(ethers.ZeroAddress);
      expect(result[3].job.collateralOwed).to.equal(0n);
    });

    it('refuses state transitions before job creation', () => {
      expect(() => computeJobStateDiffs([
        jobEvent(JobEventType.Taken, { address_: worker, data_: '0x01' }),
      ], '7')).to.throw('Job must be created before it can be taken');
    });
  });
});
