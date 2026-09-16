import { installMockContracts } from '../src/mock-contracts/install.js';
import { MockContractModel } from '../src/mock-contracts/model.js';
import type { MockContractHandle } from '../src/mock-contracts/handle.js';

class TokenModel extends MockContractModel {
  static readonly viewMethods = ['balanceOf', 'symbol'] as const;
  static readonly events = { Transfer: ['from', 'to', 'value'] } as const;

  private readonly balances = new Map<string, bigint>();

  symbol(): string { return 'TST'; }

  balanceOf(account: string): bigint { return this.balances.get(account) ?? 0n; }

  initialize(owner: string): void { this.balances.set(owner, 1_000n); }

  transfer(to: string, value: bigint | number): boolean {
    const from = this.ctx.sender;
    const balance = this.balances.get(from) ?? 0n;
    if (balance < BigInt(value)) this.ctx.revert('ERC20InsufficientBalance');
    this.balances.set(from, balance - BigInt(value));
    this.balances.set(to, (this.balances.get(to) ?? 0n) + BigInt(value));
    this.ctx.emit('Transfer', { from, to, value: BigInt(value) });
    return true;
  }
}

/** Calls another mock contract the way a composed on-chain call would reach a second participant. */
class VaultModel extends MockContractModel {
  static readonly events = { Deposited: ['amount'] } as const;

  deposit(value: bigint): void {
    this.ctx.chain.callOn('Token', 'transfer', [this.ctx.address, value], this.ctx.sender);
    this.ctx.emit('Deposited', { amount: value });
  }
}

/**
 * Stand-in HRE carrying the same seams the ported runtime has: the contract entry points and the `upgrades` object a
 * suite imports. Any call that reaches the artifact-backed implementations is a bug in these tests.
 */
interface MockHost {
  ethers: Record<string, unknown>;
  upgrades: { deployProxy: (...args: unknown[]) => unknown };
}

const createHost = (): MockHost => ({
  ethers: {
    getContractFactory: (): never => { throw new Error('artifact factory used'); },
    getContractAt: (): never => { throw new Error('artifact lookup used'); },
    provider: {
      getBlockTime: (): number => 1_700_000_000,
      takeSnapshot: async (): Promise<{ restore: () => Promise<void> }> => ({ restore: async () => {} }),
    },
  },
  upgrades: { deployProxy: (): never => { throw new Error('real deployProxy used'); } },
}) as unknown as MockHost;

interface Harness {
  host: MockHost;
  installation: ReturnType<typeof installMockContracts>;
  deploy(name: string, args: unknown[]): Promise<MockContractHandle>;
}

const harness = (contracts: Record<string, { create: () => MockContractModel }> = {
  Token: { create: () => new TokenModel() },
}): Harness => {
  const host = createHost();
  const installation = installMockContracts(host, { upgrades: host.upgrades, contracts });
  return {
    host,
    installation,
    deploy: async (name: string, args: unknown[]): Promise<MockContractHandle> => {
      const deployProxy = host.upgrades.deployProxy as unknown as (
        factory: unknown, callArgs: unknown[],
      ) => Promise<MockContractHandle>;
      return deployProxy({ mockContractName: name }, args);
    },
  };
};

/** The handle methods a test drives. */
type TokenCalls = {
  transfer(to: string, value: bigint): Promise<{ events: unknown[]; wait(): Promise<unknown> }>;
};

describe('mock contract runtime', () => {
  it('deploys through upgrades.deployProxy and answers read-only calls', async () => {
    const { installation, deploy } = harness();
    const token = await deploy('Token', ['owner']);

    expect(await token.symbol()).toBe('TST');
    expect(await token.balanceOf('owner')).toBe(1_000n);
    expect(await token.getAddress()).toMatch(/^bchtest:/);
    expect(await token.waitForDeployment()).toBe(token);
    installation.restore();
  });

  it('answers state-changing calls with a decoded receipt', async () => {
    const { installation, deploy } = harness();
    const token = await deploy('Token', ['owner']);
    const receipt = await (token.connect({ address: 'owner' }).transfer as TokenCalls['transfer'])('bob', 400n);

    expect(receipt.events).toEqual([
      { event: 'Transfer', args: { from: 'owner', to: 'bob', value: 400n }, address: expect.any(String) },
    ]);
    expect(await receipt.wait()).toBe(receipt);
    expect(await token.balanceOf('bob')).toBe(400n);
    installation.restore();
  });

  it('rejects a refused call instead of throwing synchronously', async () => {
    const { installation, deploy } = harness();
    const token = await deploy('Token', ['owner']);
    const connected = token.connect({ address: 'nobody' }) as unknown as TokenCalls;

    await expect(connected.transfer('bob', 1n)).rejects.toThrow('ERC20InsufficientBalance');
    installation.restore();
  });

  it('exposes event parameter names so positional withArgs works', async () => {
    const { installation, deploy } = harness();
    const token = await deploy('Token', ['owner']);

    expect(token.artifact.events).toEqual([{
      name: 'Transfer',
      parameters: [{ name: 'from' }, { name: 'to' }, { name: 'value' }],
      inputs: [{ name: 'from' }, { name: 'to' }, { name: 'value' }],
    }]);
    installation.restore();
  });

  it('merges a nested contract call into the caller receipt', async () => {
    const { installation, deploy } = harness({
      Token: { create: () => new TokenModel() },
      Vault: { create: () => new VaultModel() },
    });
    await deploy('Token', ['owner']);
    const vault = await deploy('Vault', []);
    const deposit = vault.connect({ address: 'owner' }).deposit as (
      value: bigint,
    ) => Promise<{ events: { event: string; address: string }[] }>;

    const receipt = await deposit(25n);

    expect(receipt.events.map((emission) => emission.event)).toEqual(['Transfer', 'Deposited']);
    // The Transfer is attributed to the token, not to the vault that triggered it.
    expect(receipt.events[0].address).toBe(installation.chain.deployment('Token')?.address);
    installation.restore();
  });

  it('delivers events to addListener subscribers', async () => {
    const { installation, deploy } = harness();
    const token = await deploy('Token', ['owner']);
    const seen: unknown[][] = [];
    token.addListener('Transfer', (...args) => { seen.push(args); });

    await (token.connect({ address: 'owner' }).transfer as TokenCalls['transfer'])('bob', 5n);

    expect(seen).toEqual([['owner', 'bob', 5n]]);
    installation.restore();
  });

  it('refuses unregistered contract names instead of executing a compiled artifact', () => {
    const { installation } = harness();
    expect(() => installation.chain.preview('Missing')).toThrow('No mock contract registered');
    expect(() => installation.chain.model('Missing')).toThrow('not deployed');
    installation.restore();
  });

  it('restores the original contract entry points', () => {
    const host = createHost();
    const original = host.ethers.getContractFactory;
    const installation = installMockContracts(host, {
      upgrades: host.upgrades,
      contracts: { Token: { create: () => new TokenModel() } },
    });
    expect(host.ethers.getContractFactory).not.toBe(original);
    installation.restore();
    expect(host.ethers.getContractFactory).toBe(original);
  });
});
