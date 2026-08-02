import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import {
  blockhashOracleLockingBytecode, buildBlockhashCommitment,
} from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3, resolveBlockhashCoSpend,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const CALLER = `pragma solidcash >=0.8.0;
interface IBlockhashTarget { function accept(bytes32 value); }
contract GraphBlockhashCaller() {
  function call(address target, int height) public {
    bytes32 value = blockhash(height - 1);
    IBlockhashTarget(target).accept(value);
    require(height > 0);
  }
}`;

const TARGET = `pragma solidcash >=0.8.0;
contract GraphBlockhashTarget() {
  function accept(bytes32 value) public { require(value.length == 32); }
}`;

async function createGraphAuthority(provider: ReturnType<typeof createTestProvider>): Promise<{
  projection: Contract; controller: Contract; categoryId: string; genesisUtxo: any;
}> {
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  return {
    projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0],
  };
}

async function initializeGraphAuthority(
  provider: ReturnType<typeof createTestProvider>, controller: Contract, genesisUtxo: any,
  categoryId: string, root: string, p2pkh: Contract,
): Promise<any> {
  const fee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(root), alicePub, signature()));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(tx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  if (!rooted) throw new Error('graph controller initialization did not create the rooted authority');
  return rooted;
}

type Mutation = 'honest' | 'wrong-index' | 'wrong-hash' | 'wrong-category' | 'omitted' |
'wrong-recreation' | 'missing-recreation';

const emptyOracleSlotFailure = new RegExp(
  'error in evaluating input index 0: Program called an OP_SPLIT operation with an invalid index\\. '
  + 'stack item length: 0; requested split index: 32\\.',
);

const failures: Record<Exclude<Mutation, 'honest'>, RegExp> = {
  'wrong-index': emptyOracleSlotFailure,
  'wrong-hash': /error in evaluating input index 0: Program failed an OP_VERIFY operation\./,
  'wrong-category': /error in evaluating input index 0: Program failed an OP_VERIFY operation\./,
  omitted: emptyOracleSlotFailure,
  'wrong-recreation': /error in evaluating input index 1: Program failed an OP_VERIFY operation\./,
  'missing-recreation': /error in evaluating input index 1: Program failed an OP_VERIFY operation\./,
};

async function attempt(mutation: Mutation): Promise<string> {
  const provider = createTestProvider();
  const before = await provider.getBlockHeight();
  await provider.mine(1);
  const n = before + 1;
  const hash = hexToBin(await provider.getBlockHash(n));
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: controllerCategory,
  };
  const callerArtifact = compileString(CALLER, options);
  const targetArtifact = compileString(TARGET, options);
  const callerBase = new Contract(callerArtifact, [], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {}, {
    saltContract: true,
    extraOutputs: (category: string) => [{
      address: binToHex(blockhashOracleLockingBytecode(hexToBin(category), BigInt(n))),
      satoshis: 1000n,
      token: {
        nft: {
          capability: 'none',
          commitment: binToHex(buildBlockhashCommitment(
            BigInt(n), mutation === 'wrong-hash' ? hexToBin('33'.repeat(32)) : hash,
          )),
        },
      },
    }],
  });
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));
  const targetBase = new Contract(targetArtifact, [], { provider });
  const targetSetup = await setupStatefulUtxos(provider, targetBase, targetArtifact.stateLayout!, {});
  const target = targetBase.withCategory(hexToBin(targetSetup.categoryId));
  const plan = layer3.planCompiledGraph([
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: targetArtifact, lockingBytecode: target.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'call', args: [target.lockingBytecode, BigInt(n + 1)] },
    { parent: 0, callee: 1, function: 'accept', args: [hash] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  expect(layout.participantInputs).toEqual([0, 9]);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const oracle = await resolveBlockhashCoSpend(provider, callerSetup.categoryId, BigInt(n));
  if (!oracle) throw new Error('fixture did not create the caller-branded blockhash oracle');
  let selectedOracle = oracle;
  if (mutation === 'wrong-category') {
    const foreign = await (provider as any).addTokenUtxosDynamic((category: string) => [{
      address: binToHex(blockhashOracleLockingBytecode(hexToBin(category), BigInt(n))),
      satoshis: 1000n,
      token: { nft: { capability: 'none', commitment: binToHex(buildBlockhashCommitment(BigInt(n), hash)) } },
    }]);
    const foreignOracle = await resolveBlockhashCoSpend(provider, foreign.categoryId, BigInt(n));
    if (!foreignOracle) throw new Error('fixture did not create the foreign oracle');
    selectedOracle = foreignOracle;
  }
  const funders = Array.from({ length: 8 }, () => randomUtxo({ satoshis: 1000n }));
  for (const funder of funders) await provider.addUtxo(p2pkh.address, funder);
  const projections = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  const fee = randomUtxo({ satoshis: 100_000n });
  await provider.addUtxo(p2pkh.address, fee);
  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const targetRoute = target.createCompilerRouteUnlocker(
    targetArtifact.hiddenBatch!.route, hexToBin(targetArtifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(callerSetup.masterUtxo, callerRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  const omit = mutation === 'omitted';
  const wrongIndex = mutation === 'wrong-index';
  if (omit || wrongIndex) tx.addInput(funders.shift()!, p2pkh.unlock.spend(alicePub, signature()));
  else tx.addInput(selectedOracle.utxo, selectedOracle.unlocker);
  if (wrongIndex) tx.addInput(selectedOracle.utxo, selectedOracle.unlocker);
  while (tx.inputs.length < 9) tx.addInput(funders.shift()!, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(targetSetup.masterUtxo, targetRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: caller.tokenAddress, amount: callerSetup.masterUtxo.satoshis,
    token: { category: callerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  if (mutation === 'missing-recreation') {
    tx.addOutput({ to: p2pkh.address, amount: selectedOracle.utxo.satoshis });
  } else {
    tx.addOutput(mutation === 'wrong-recreation' ? {
      ...selectedOracle.recreateOutput,
      token: {
        ...selectedOracle.recreateOutput.token!,
        nft: {
          ...selectedOracle.recreateOutput.token!.nft!,
          commitment: binToHex(buildBlockhashCommitment(BigInt(n), hexToBin('44'.repeat(32)))),
        },
      },
    } : selectedOracle.recreateOutput);
  }
  while (tx.outputs.length < 9) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({
    to: target.tokenAddress, amount: targetSetup.masterUtxo.satoshis,
    token: { category: targetSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 40_000n });
  tx.setLocktime(n);
  const transaction = raw(tx);
  layer3.assertFinalizedTransactionBytes(decodeTransactionUnsafe(hexToBin(transaction)));
  return provider.sendRawTransaction(transaction);
}

describe('SCB1 graph blockhash route (BCH-2026 VM)', () => {
  it('settles with an authenticated oracle in the active row slot and inactive row funders', async () => {
    await expect(attempt('honest')).resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 120_000);

  for (const mutation of [
    'wrong-index', 'wrong-hash', 'wrong-category', 'omitted', 'wrong-recreation', 'missing-recreation',
  ] as const) {
    it(`rejects ${mutation}`, async () => {
      await expect(attempt(mutation)).rejects.toThrow(failures[mutation]);
    }, 120_000);
  }
});
