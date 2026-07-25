import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
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
  it('settles two mapping-backed ERC-20 transferFrom rows through one token owner', async () => {
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

        function mint(bytes20 to, bigint amount) public {
          this.balances[to] = this.balances[to] + amount;
          require(amount >= 0);
        }
        function approve(bytes20 owner, bytes20 spender, bigint amount) public {
          this.allowances[owner][spender] = amount;
          require(amount >= 0);
        }
        function transferFrom(
          bytes20 from, bytes20 to, bytes20 spender, bigint amount
        ) public {
          require(this.allowances[from][spender] >= amount);
          require(this.balances[from] >= amount);
          this.allowances[from][spender] = this.allowances[from][spender] - amount;
          this.balances[from] = this.balances[from] - amount;
          this.balances[to] = this.balances[to] + amount;
        }
        function checkBalance(bytes20 owner, bigint expected) public {
          require(this.balances[owner] == expected);
        }
        function checkAllowance(bytes20 owner, bytes20 spender, bigint expected) public {
          require(this.allowances[owner][spender] == expected);
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    // This five-function mapping ERC-20 used to compile past BCH's 10,000-byte input-script limit and carry a
    // `contract-size-limit` error. Sharing repeated spans across its OP_DEFINE'd bodies brings it well inside.
    expect(tokenArtifact.diagnostics?.some((entry) => entry.code === 'contract-size-limit') ?? false).toBe(false);
    expect(tokenArtifact.debug!.bytecode.length / 2).toBeLessThan(10_000);
    expect(tokenArtifact.hiddenBatch).toMatchObject({
      minimumRows: 2,
      maximumRows: 2,
    });
    expect(tokenArtifact.hiddenBatch?.handlers.find((handler) =>
      handler.name === 'transferFrom')).toMatchObject({
      eligible: true,
      batchKeyWitnesses: [
        { routeInput: '__scb_key_transferFrom_from_global', inputIndex: 0 },
        { routeInput: '__scb_key_transferFrom_to_row', inputIndex: 1, perRow: true },
        { routeInput: '__scb_key_transferFrom_spender_global', inputIndex: 2 },
      ],
    });

    const tokenInner = new Contract(tokenArtifact, [], { provider });
    const { categoryId: tokenCategory } = await setupStatefulUtxos(
      provider, tokenInner, tokenArtifact.stateLayout!, {}, { saltContract: true },
    );
    const token = StatefulContract.withCategory(tokenInner, tokenCategory);
    await token.getFunction('mint')(alicePkh, 100n).send();
    await token.getFunction('mint')(bobPkh, 0n).send();
    await token.getFunction('mint')(carolPkh, 0n).send();
    await token.getFunction('approve')(alicePkh, carolPkh, 50n).send();
    await token.batch([
      { function: 'transferFrom', args: [alicePkh, bobPkh, carolPkh, 10n] },
      { function: 'transferFrom', args: [alicePkh, carolPkh, carolPkh, 20n] },
    ]).send();
    await token.getFunction('mint')(alicePkh, 30n).send();
    await token.getFunction('approve')(alicePkh, carolPkh, 50n).send();

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

    const call = caller.getFunction('route')(
      alicePkh, bobPkh, carolPkh, carolPkh, 10n, 20n,
    );
    const builder = await call.build();
    expect(builder.inputs.filter((input) =>
      input.token?.category === tokenCategory && input.token.nft?.capability === 'minting'))
      .toHaveLength(1);
    await call.send();

    await token.getFunction('checkBalance')(alicePkh, 70n).send();
    await token.getFunction('checkBalance')(bobPkh, 20n).send();
    await token.getFunction('checkBalance')(carolPkh, 40n).send();
    await token.getFunction('checkAllowance')(alicePkh, carolPkh, 20n).send();

    // Bypass the SDK's physical-alias gate after construction. Replacing the
    // second recipient predecessor with the first creates a duplicate input
    // outpoint; BCH consensus rejects it, while the untouched transaction is
    // accepted. This locks the on-chain/consensus half of the alias argument.
    const aliasProbe = caller.getFunction('route')(
      alicePkh, bobPkh, carolPkh, carolPkh, 1n, 1n,
    );
    const aliasBuilder = await aliasProbe.build();
    const sendRaw = provider.sendRawTransaction.bind(provider);
    let captured = '';
    (provider as any).sendRawTransaction = async (transactionHex: string): Promise<string> => {
      captured = transactionHex;
      throw new Error('capture-only');
    };
    try {
      await expect(aliasProbe.send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = sendRaw;
    }
    const aliased = decodeTransactionUnsafe(hexToBin(captured));
    const entryInputIndices = aliasBuilder.inputs
      .map((input, index) => ({ input, index }))
      .filter(({ input }) => input.token?.category === tokenCategory
        && input.token.nft?.capability === 'mutable')
      .map(({ index }) => index);
    expect(entryInputIndices.length).toBeGreaterThanOrEqual(4);
    const firstRecipient = entryInputIndices.at(-2)!;
    const secondRecipient = entryInputIndices.at(-1)!;
    aliased.inputs[secondRecipient].outpointTransactionHash =
      aliased.inputs[firstRecipient].outpointTransactionHash.slice();
    aliased.inputs[secondRecipient].outpointIndex =
      aliased.inputs[firstRecipient].outpointIndex;
    await expect(sendRaw(binToHex(encodeTransaction(aliased)))).rejects.toThrow();

    const forgedLateEntry = decodeTransactionUnsafe(hexToBin(captured));
    const mutableOutputs = forgedLateEntry.outputs.filter((output) =>
      output.token?.nft?.capability === 'mutable'
      && binToHex(output.token.category) === tokenCategory);
    expect(mutableOutputs.length).toBeGreaterThanOrEqual(4);
    mutableOutputs.at(-1)!.token!.nft!.commitment[0] ^= 1;
    await expect(sendRaw(binToHex(encodeTransaction(forgedLateEntry)))).rejects.toThrow();

    await expect(sendRaw(captured)).resolves.toBeTypeOf('string');

    await expect(caller.getFunction('route')(
      alicePkh, bobPkh, bobPkh, carolPkh, 1n, 1n,
    ).build()).rejects.toThrow(/resource shape aliases entry slots/);
    await expect(caller.getFunction('route')(
      alicePkh, alicePkh, bobPkh, carolPkh, 1n, 1n,
    ).build()).rejects.toThrow(/resource shape aliases entry slots/);

    const coldFirst = new Uint8Array(20).fill(0x44);
    const coldSecond = new Uint8Array(20).fill(0x55);
    await expect(caller.getFunction('route')(
      alicePkh, coldFirst, coldSecond, carolPkh, 1n, 1n,
    ).build()).rejects.toThrow(/cold-entry predecessor planning is not yet supported/);
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
