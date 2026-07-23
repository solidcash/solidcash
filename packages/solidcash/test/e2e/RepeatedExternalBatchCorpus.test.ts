import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { alicePkh, bobPkh, carolPkh } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const TOKEN_INTERFACE = `
interface ICorpusToken {
  function transfer(bytes20 recipient, bigint amount);
  function mint(bytes20 recipient, bigint amount);
}
`;

const TOKEN = `pragma solidcash >=0.8.0;
${TOKEN_INTERFACE}
contract CorpusToken() is ICorpusToken {
  bigint transferred;
  bigint minted;
  bigint calls;

  function transfer(bytes20 recipient, bigint amount) public {
    this.transferred = this.transferred + amount;
    this.calls = this.calls + 1;
    require(recipient.length == 20 && amount >= 0);
  }

  function mint(bytes20 recipient, bigint amount) public {
    this.minted = this.minted + amount;
    this.calls = this.calls + 1;
    require(recipient.length == 20 && amount >= 0);
  }

  function check(bigint expectedTransferred, bigint expectedMinted, bigint expectedCalls) public {
    require(
      this.transferred == expectedTransferred
      && this.minted == expectedMinted
      && this.calls == expectedCalls
    );
  }
}
`;

async function deployCorpus(callerSource: string, functionName: string, args: unknown[]) {
  const provider = createTestProvider();
  const tokenArtifact = compileString(TOKEN, {
    forceStateful: true,
    experimentalHiddenBatch: true,
  });
  const tokenInner = new Contract(tokenArtifact, [], { provider });
  const { categoryId: tokenCategory } = await setupStatefulUtxos(
    provider,
    tokenInner,
    tokenArtifact.stateLayout!,
    { transferred: 0n, minted: 0n, calls: 0n },
    { saltContract: true },
  );
  const token = StatefulContract.withCategory(tokenInner, tokenCategory);

  const callerArtifact = compileString(callerSource, {
    forceStateful: true,
    experimentalRepeatedExternalBatch: true,
  });
  const tokenAddress = tokenInner.withCategory(hexToBin(tokenCategory)).lockingBytecode;
  const callerInner = new Contract(callerArtifact, [tokenAddress], { provider });
  const { categoryId: callerCategory } = await setupStatefulUtxos(
    provider, callerInner, callerArtifact.stateLayout!, { runs: 0n }, { saltContract: true },
  );
  const caller = StatefulContract.withCategory(callerInner, callerCategory, {
    externals: { ICorpusToken: token },
  });
  const call = caller.getFunction(functionName)(...args);
  const builder = await call.build();
  expect(builder.inputs.filter((input) =>
    input.token?.category === tokenCategory && input.token.nft?.capability === 'minting'))
    .toHaveLength(1);
  await call.send();
  return { caller, token };
}

describe('Release 5 surveyed repeated-callee corpus', () => {
  it('fails closed before construction for a mapping-backed ERC-20 transfer shape', async () => {
    const provider = createTestProvider();
    const interfaceSource = `
      interface IMappingToken {
        function transferFrom(bytes20 from, bytes20 to, bytes20 spender, bigint amount);
      }
    `;
    const tokenArtifact = compileString(`pragma solidcash >=0.8.0;
      ${interfaceSource}
      contract MappingToken() is IMappingToken {
        mapping(bytes20 => bigint) balances;
        mapping(bytes20 => mapping(bytes20 => bigint)) allowances;

        function transferFrom(
          bytes20 from, bytes20 to, bytes20 spender, bigint amount
        ) public {
          require(this.allowances[from][spender] >= amount);
          require(this.balances[from] >= amount);
          this.allowances[from][spender] = this.allowances[from][spender] - amount;
          this.balances[from] = this.balances[from] - amount;
          this.balances[to] = this.balances[to] + amount;
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    expect(tokenArtifact.hiddenBatch).toBeUndefined();

    const tokenInner = new Contract(tokenArtifact, [], { provider });
    const { categoryId: tokenCategory } = await setupStatefulUtxos(
      provider, tokenInner, tokenArtifact.stateLayout!, {}, { saltContract: true },
    );
    const token = StatefulContract.withCategory(tokenInner, tokenCategory);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      ${interfaceSource}
      contract TokenRouter(bytes tokenAddress) {
        bigint runs;
        function route(
          bytes20 from, bytes20 first, bytes20 second, bytes20 spender,
          bigint firstAmount, bigint secondAmount
        ) public {
          IMappingToken(tokenAddress).transferFrom(from, first, spender, firstAmount);
          IMappingToken(tokenAddress).transferFrom(from, second, spender, secondAmount);
          this.runs = this.runs + 1;
          require(firstAmount >= 0 && secondAmount >= 0);
        }
      }
    `, { forceStateful: true, experimentalRepeatedExternalBatch: true });
    const tokenAddress = tokenInner.withCategory(hexToBin(tokenCategory)).lockingBytecode;
    const callerInner = new Contract(callerArtifact, [tokenAddress], { provider });
    const { categoryId: callerCategory } = await setupStatefulUtxos(
      provider, callerInner, callerArtifact.stateLayout!, { runs: 0n }, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(callerInner, callerCategory, {
      externals: { IMappingToken: token },
    });

    await expect(caller.getFunction('route')(
      alicePkh, bobPkh, carolPkh, carolPkh, 10n, 20n,
    ).build()).rejects.toThrow(/does not advertise.*SCB1/);
  });

  it('constructs TreasurySplit.split with two token transfers and one token owner', async () => {
    const source = `pragma solidcash >=0.8.0;
      ${TOKEN_INTERFACE}
      contract TreasurySplit(bytes tokenAddress) {
        bigint runs;
        function split(
          bytes20 operations, bigint operationsAmount,
          bytes20 grants, bigint grantsAmount
        ) public {
          ICorpusToken(tokenAddress).transfer(operations, operationsAmount);
          ICorpusToken(tokenAddress).transfer(grants, grantsAmount);
          this.runs = this.runs + 1;
          require(operationsAmount >= 0 && grantsAmount >= 0);
        }
        function checkRuns(bigint expected) public { require(this.runs == expected); }
      }
    `;
    const { caller, token } = await deployCorpus(
      source, 'split', [alicePkh, 40n, bobPkh, 60n],
    );
    await caller.checkRuns(1n).send();
    await token.check(100n, 0n, 2n).send();
  });

  it('constructs Marketplace reward distribution with three ordered transfers', async () => {
    const source = `pragma solidcash >=0.8.0;
      ${TOKEN_INTERFACE}
      contract MarketplaceRewards(bytes tokenAddress) {
        bigint runs;
        function distribute(
          bytes20 worker, bigint workerReward,
          bytes20 arbitrator, bigint arbitratorReward,
          bytes20 treasury, bigint treasuryReward
        ) public {
          ICorpusToken(tokenAddress).transfer(worker, workerReward);
          ICorpusToken(tokenAddress).transfer(arbitrator, arbitratorReward);
          ICorpusToken(tokenAddress).transfer(treasury, treasuryReward);
          this.runs = this.runs + 1;
          require(workerReward >= 0 && arbitratorReward >= 0 && treasuryReward >= 0);
        }
        function checkRuns(bigint expected) public { require(this.runs == expected); }
      }
    `;
    const { caller, token } = await deployCorpus(
      source,
      'distribute',
      [alicePkh, 50n, bobPkh, 30n, carolPkh, 20n],
    );
    await caller.checkRuns(1n).send();
    await token.check(100n, 0n, 3n).send();
  });

  it('constructs MasterChef.updatePool with two mints and one supply transition', async () => {
    const source = `pragma solidcash >=0.8.0;
      ${TOKEN_INTERFACE}
      contract MasterChefSlice(bytes tokenAddress) {
        bigint runs;
        function updatePool(
          bytes20 dev, bigint devReward,
          bytes20 pool, bigint poolReward
        ) public {
          ICorpusToken(tokenAddress).mint(dev, devReward);
          ICorpusToken(tokenAddress).mint(pool, poolReward);
          this.runs = this.runs + 1;
          require(devReward >= 0 && poolReward >= 0);
        }
        function checkRuns(bigint expected) public { require(this.runs == expected); }
      }
    `;
    const { caller, token } = await deployCorpus(
      source, 'updatePool', [alicePkh, 10n, carolPkh, 90n],
    );
    await caller.checkRuns(1n).send();
    await token.check(0n, 100n, 2n).send();
  });
});
