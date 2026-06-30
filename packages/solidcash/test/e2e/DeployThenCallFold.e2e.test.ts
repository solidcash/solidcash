import { compileString } from 'solidc';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { ResolvedImport, parsePushdataCommitment } from '@solidcash/utils';
import {
  Contract, SignatureTemplate, StatefulContract, Signer,
} from '../../src/index.js';
import type { ConnectedStatefulContract } from '../../src/index.js';
import {
  alicePriv, alicePub, alicePkh, bobPkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import foldChildArtifact from '../fixture/fold_child.artifact.js';
import foldFactoryArtifact from '../fixture/fold_factory.artifact.js';

// A same-tx `child.configure(args)` on a freshly-deployed local is folded into the deploy genesis: the
// child is born already-configured in ONE transaction, with no co-spend. The covenant computes the
// post-configure genesis on-chain; the SDK reads it from the deploy probe trace (no childInitialState).
// See docs/deploy-then-call-fold.md.

// FoldChild / FoldFactory are compiled to typed `.ts` artifacts (test/fixture/fold_{child,factory}.artifact.ts,
// `as const`) so that `factory.deployConfigured(...)` is typed - a deploy-modifier function maps to a thenable
// DeployFunctionCall - with no cast. The contract sources are embedded in the artifacts' `source` field.
describe('deploy-then-call fold (deployFrom e2e)', () => {
  const childArtifact = foldChildArtifact;
  const factoryArtifact = foldFactoryArtifact;

  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  let factory: ConnectedStatefulContract<typeof factoryArtifact>;

  it('the configure call is folded into the deploy genesis (no co-spend external call)', () => {
    const make = factoryArtifact.abi.find((f) => f.name === 'deployConfigured')!;
    // constructorArgs records that new FoldChild(childOwner) forwards the 'childOwner' deploy param, so the
    // SDK can derive childConstructorArgs from the deploy args.
    expect(make.deployTargets).toEqual([{ contractName: 'FoldChild', dataNftCount: 1, constructorArgs: ['childOwner'] }]);
    expect((make as { externalCalls?: unknown[] }).externalCalls).toBeUndefined();
  });

  it('deploys the factory', async () => {
    const fundingUtxo: Utxo = { txid: 'fa1d'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);

    const result = await StatefulContract.deploy(factoryArtifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });
    factory = result.contract;
    expect(factory.categoryId).toBeDefined();
  });

  it('deploys the child already-configured in one tx (counter=c0, admin=a0)', async () => {
    const c0 = 42n;
    // Full ethers-style flow: a connected signer encapsulates funding (it picks a genesis-valid vout-0 UTXO
    // from its address), spending and change; the child artifact is registered and its constructor args
    // (new FoldChild(childOwner) -> the childOwner deploy arg) are derived. So the deploy is a single terminal,
    // TYPED call - `await signed.deployConfigured(...)` - no cast, since the typed artifact maps the
    // deploy-modifier function to a thenable DeployFunctionCall. Its funding UTXO txid becomes the child
    // category, so the child address derives forward.
    const signer = new Signer(alicePriv, provider);
    const fundingUtxo: Utxo = { txid: 'fb2d'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(signer.getAddress(), fundingUtxo);

    const signed = factory.registerChild(childArtifact).connect(signer);
    const result = await signed.deployConfigured(new SignatureTemplate(alicePriv), alicePkh, c0, bobPkh);

    // send() ran the deploy covenant: a successful tx means the covenant accepted the SDK-supplied
    // post-configure child genesis. (A wrong genesis - e.g. default counter=0 - would fail the covenant.)
    expect(result.tx.txid).toBeDefined();
    expect(result.childCategoryId).toBe(fundingUtxo.txid);

    const txOutputs = getTxOutputs(result.tx);

    // Factory state advanced.
    const factoryState = parsePushdataCommitment(
      txOutputs[1].token!.nft!.commitment, factoryArtifact.stateLayout!, 0,
    );
    expect(factoryState.deployCount).toBe(1n);

    // Child data NFT carries the POST-configure state, not the default.
    const childDataOutput = txOutputs.find(
      (o) => o.token?.category === fundingUtxo.txid && o.token?.nft?.capability === 'mutable',
    );
    expect(childDataOutput).toBeDefined();
    const childState = parsePushdataCommitment(
      childDataOutput!.token!.nft!.commitment, childArtifact.stateLayout!, 0,
    );
    expect(childState.counter).toBe(c0);
  });
});

// A folded callee may COMPUTE each field from its params (arithmetic / cast / ternary over params + literals,
// no state reads), not just assign a param directly. The deploy covenant evaluates the expression on the
// child's default state, so the child is born in the computed post-call state. See tryFoldDeployCall.
const computedChildSource = `
  contract ComputedChild(bytes20 owner) {
    int total;
    int half;

    function configure(int supply, int amount) {
      this.total = supply * 2;
      this.half = amount / 2 + 1;
      require(true);
    }
  }
`;

const computedFactorySource = `
  import "./computed_child.scash";
  contract ComputedFactory(pubkey factoryOwner) {
    int deployCount;

    function deployComputed(sig s, bytes20 childOwner, int sup, int amt) deploy {
      require(checkSig(s, factoryOwner));
      ComputedChild child = new ComputedChild(childOwner);
      child.configure(sup, amt);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

describe('deploy-then-call fold with a computed callee (deployFrom e2e)', () => {
  const childArtifact = compileString(computedChildSource);
  const factoryArtifact = compileString(computedFactorySource, {
    importResolver: (importPath: string, currentFile: string): ResolvedImport | undefined => {
      const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
      let resolved = dir + importPath.replace('./', '');
      if (!resolved.endsWith('.scash')) resolved += '.scash';
      return resolved === '/computed_child.scash' ? { source: computedChildSource, id: resolved } : undefined;
    },
    rootFileId: '/main.scash',
  });

  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

  it('deploys the factory', async () => {
    const fundingUtxo: Utxo = { txid: 'da1d'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const result = await StatefulContract.deploy(factoryArtifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });
    factory = result.contract;
  });

  it('deploys the child in its computed post-call state (total=sup*2, half=amt/2+1) in one tx', async () => {
    const fundingUtxo: Utxo = { txid: 'db2d'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);

    const sup = 21n;
    const amt = 100n;
    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'deployComputed',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh, sup, amt],
      childArtifact,
      childConstructorArgs: [alicePkh],
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    // send() ran the covenant, which evaluated supply*2 and amount/2+1 on-chain.
    const childDataOutput = getTxOutputs(result.tx).find(
      (o) => o.token?.category === result.childCategoryId && o.token?.nft?.capability === 'mutable',
    );
    const childState = parsePushdataCommitment(
      childDataOutput!.token!.nft!.commitment, childArtifact.stateLayout!, 0,
    );
    expect(childState.total).toBe(sup * 2n); // 42
    expect(childState.half).toBe(amt / 2n + 1n); // 51
  });
});

// A folded callee may also be a straight-line sequence using LOCAL variables, reads of fields written
// EARLIER in the call, and reads of fields not yet written (which resolve to the child's default state).
// The deploy covenant evaluates the whole sequence on-chain. See foldGenesisExpr.
const seqChildSource = `
  contract SeqChild(bytes20 owner) {
    int a;
    int b;
    int c;

    function init(int sup) {
      int x = sup * 2;        // local
      this.a = x;             // a = sup*2
      this.b = this.a + 1;    // read field written earlier -> sup*2 + 1
      this.c = this.c + 5;    // read field at default (0) -> 5
      require(true);
    }
  }
`;

const seqFactorySource = `
  import "./seq_child.scash";
  contract SeqFactory(pubkey factoryOwner) {
    int deployCount;

    function deploySeq(sig s, bytes20 childOwner, int sup) deploy {
      require(checkSig(s, factoryOwner));
      SeqChild child = new SeqChild(childOwner);
      child.init(sup);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

describe('deploy-then-call fold with locals + state reads (deployFrom e2e)', () => {
  const childArtifact = compileString(seqChildSource);
  const factoryArtifact = compileString(seqFactorySource, {
    importResolver: (importPath: string, currentFile: string): ResolvedImport | undefined => {
      const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
      let resolved = dir + importPath.replace('./', '');
      if (!resolved.endsWith('.scash')) resolved += '.scash';
      return resolved === '/seq_child.scash' ? { source: seqChildSource, id: resolved } : undefined;
    },
    rootFileId: '/main.scash',
  });

  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

  it('deploys the factory', async () => {
    const fundingUtxo: Utxo = { txid: 'ea1d'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const result = await StatefulContract.deploy(factoryArtifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });
    factory = result.contract;
  });

  it('evaluates the local + sequential field reads on-chain (a=sup*2, b=a+1, c=default+5)', async () => {
    const fundingUtxo: Utxo = { txid: 'eb2d'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);

    const sup = 10n;
    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'deploySeq',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh, sup],
      childArtifact,
      childConstructorArgs: [alicePkh],
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    const childDataOutput = getTxOutputs(result.tx).find(
      (o) => o.token?.category === result.childCategoryId && o.token?.nft?.capability === 'mutable',
    );
    const st = parsePushdataCommitment(
      childDataOutput!.token!.nft!.commitment, childArtifact.stateLayout!, 0,
    );
    expect(st.a).toBe(sup * 2n); // 20
    expect(st.b).toBe(sup * 2n + 1n); // 21
    expect(st.c).toBe(5n); // default 0 + 5
  });
});

// A child whose fixed-size state spans more than one data NFT prepends a verifiable nftIndex tag to every
// commitment (so a higher-index NFT can't be substituted for a lower one - they share one covenant address).
// The deploy covenant's genesis builder must stamp the same tag the child's own covenant + the SDK do, else
// the child is born in a state its own covenant can't read. These tests pin that parity for plain and folded
// multi-NFT deploys.

const multiChildSource = `
  contract MultiChild(bytes20 owner) {
    bytes32 a;
    bytes32 b;
    bytes32 c;
    bytes32 d;

    function configure(bytes32 va, bytes32 vb, bytes32 vc, bytes32 vd) {
      this.a = va; this.b = vb; this.c = vc; this.d = vd;
      require(true);
    }
  }
`;

const plainMultiFactorySource = `
  import "./multi_child.scash";
  contract PlainMultiFactory(pubkey factoryOwner) {
    int deployCount;
    function deployPlain(sig s, bytes20 childOwner) deploy {
      require(checkSig(s, factoryOwner));
      MultiChild child = new MultiChild(childOwner);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

const foldMultiFactorySource = `
  import "./multi_child.scash";
  contract FoldMultiFactory(pubkey factoryOwner) {
    int deployCount;
    function deployConfigured(sig s, bytes20 childOwner, bytes32 va, bytes32 vb, bytes32 vc, bytes32 vd) deploy {
      require(checkSig(s, factoryOwner));
      MultiChild child = new MultiChild(childOwner);
      child.configure(va, vb, vc, vd);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

describe('multi-data-NFT child deploy (nftIndex tag parity)', () => {
  const multiResolver = (importPath: string, currentFile: string): ResolvedImport | undefined => {
    const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
    let resolved = dir + importPath.replace('./', '');
    if (!resolved.endsWith('.scash')) resolved += '.scash';
    return resolved === '/multi_child.scash' ? { source: multiChildSource, id: resolved } : undefined;
  };

  const childArtifact = compileString(multiChildSource);
  const plainFactoryArtifact = compileString(plainMultiFactorySource, {
    importResolver: multiResolver, rootFileId: '/main.scash',
  });
  const multiFactoryArtifact = compileString(foldMultiFactorySource, {
    importResolver: multiResolver, rootFileId: '/main.scash',
  });

  it('the child spans two data NFTs', () => {
    expect(childArtifact.stateLayout!.dataNftCount).toBe(2);
  });

  // Find the child's two data NFT outputs in tx order (master, then NFT 0, then NFT 1).
  const childDataNfts = (txOutputs: ReturnType<typeof getTxOutputs>, categoryId: string): string[] =>
    txOutputs
      .filter((o) => o.token?.category === categoryId && o.token?.nft?.capability === 'mutable')
      .map((o) => o.token!.nft!.commitment);

  it('plain deploy lands the multi-NFT child at tagged defaults (one tx)', async () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    const factoryFunding: Utxo = { txid: 'ca1d'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, factoryFunding);
    const { contract: factory } = await StatefulContract.deploy(plainFactoryArtifact, [alicePub], {
      provider,
      fundingUtxo: factoryFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });

    const childFunding: Utxo = { txid: 'cb2d'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, childFunding);
    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'deployPlain',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh],
      childArtifact,
      childConstructorArgs: [alicePkh],
      fundingUtxo: childFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    // send() ran the covenant: success proves the genesis stamped the same tag the child covenant expects.
    const commits = childDataNfts(getTxOutputs(result.tx), result.childCategoryId);
    expect(commits).toHaveLength(2);
    // parsePushdataCommitment verifies the leading nftIndex tag and throws on mismatch.
    const nft0 = parsePushdataCommitment(commits[0], childArtifact.stateLayout!, 0);
    const nft1 = parsePushdataCommitment(commits[1], childArtifact.stateLayout!, 1);
    expect(binToHex(nft0.a as Uint8Array)).toBe('00'.repeat(32));
    expect(binToHex(nft1.d as Uint8Array)).toBe('00'.repeat(32));
  });

  it('folded deploy configures the multi-NFT child across both NFTs (one tx)', async () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    const factoryFunding: Utxo = { txid: 'cc1d'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, factoryFunding);
    const { contract: factory } = await StatefulContract.deploy(multiFactoryArtifact, [alicePub], {
      provider,
      fundingUtxo: factoryFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });

    const va = hexToBin('11'.repeat(32));
    const vb = hexToBin('22'.repeat(32));
    const vc = hexToBin('33'.repeat(32));
    const vd = hexToBin('44'.repeat(32));

    const childFunding: Utxo = { txid: 'cd2d'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, childFunding);
    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'deployConfigured',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh, va, vb, vc, vd],
      childArtifact,
      childConstructorArgs: [alicePkh],
      fundingUtxo: childFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    // Both NFTs land in their post-configure state, carrying the correct per-NFT tag (verified on send()
    // and re-verified by parsePushdataCommitment). NFT 1 proves the iterative child extraction reached it.
    const commits = childDataNfts(getTxOutputs(result.tx), result.childCategoryId);
    expect(commits).toHaveLength(2);
    const nft0 = parsePushdataCommitment(commits[0], childArtifact.stateLayout!, 0);
    const nft1 = parsePushdataCommitment(commits[1], childArtifact.stateLayout!, 1);
    expect(binToHex(nft0.a as Uint8Array)).toBe('11'.repeat(32));
    expect(binToHex(nft0.b as Uint8Array)).toBe('22'.repeat(32));
    expect(binToHex(nft0.c as Uint8Array)).toBe('33'.repeat(32));
    expect(binToHex(nft1.d as Uint8Array)).toBe('44'.repeat(32));
  });
});

// create2 for a STATEFUL child: `new C{salt}()` composes the salt with the category self-pin
// (<salt> OP_DROP | <self-pin> | base). The compiler records the salt mapping; deployFrom derives it and
// builds the child Contract with the salt, so the address matches the deploy covenant. A successful deploy
// proves the SDK-supplied salt-composed address equals the covenant's. See docs/contract-creation.md.
const saltChildSource = `
  contract SaltChild(bytes20 owner) {
    int counter;
    function bump() { this.counter = this.counter + 1; require(true); }
  }
`;

const saltFactorySource = `
  import "./salt_child.scash";
  contract SaltFactory(pubkey factoryOwner) {
    int deployCount;

    function deploySalted(sig s, bytes20 childOwner, bytes32 salt) deploy {
      require(checkSig(s, factoryOwner));
      SaltChild child = new SaltChild{salt: salt}(childOwner);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

describe('create2: stateful deploy with a salt (composed with the self-pin)', () => {
  const childArtifact = compileString(saltChildSource);
  const factoryArtifact = compileString(saltFactorySource, {
    importResolver: (importPath: string, currentFile: string): ResolvedImport | undefined => {
      const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
      let resolved = dir + importPath.replace('./', '');
      if (!resolved.endsWith('.scash')) resolved += '.scash';
      return resolved === '/salt_child.scash' ? { source: saltChildSource, id: resolved } : undefined;
    },
    rootFileId: '/main.scash',
  });

  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

  it('records the salt mapping in the deploy target', () => {
    const make = factoryArtifact.abi.find((f) => f.name === 'deploySalted')!;
    expect(make.deployTargets![0]).toMatchObject({ contractName: 'SaltChild', salt: { param: 'salt' } });
  });

  it('deploys the factory', async () => {
    const fundingUtxo: Utxo = { txid: 'fc1d'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const result = await StatefulContract.deploy(factoryArtifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { deployCount: 0n },
      changeAddress: p2pkh.address,
    });
    factory = result.contract;
  });

  it('deploys a salted child; the address composes the salt with the self-pin', async () => {
    const salt = hexToBin('cd'.repeat(32));
    const fundingUtxo: Utxo = { txid: 'fd2d'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);

    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'deploySalted',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), alicePkh, salt],
      childArtifact,
      childConstructorArgs: [alicePkh],
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });

    // send() ran the deploy covenant: success means the SDK-supplied salt-composed child address equals the
    // covenant's. Cross-check: it equals an SDK Contract built with the same (args, category, salt).
    expect(result.tx.txid).toBeDefined();
    const expected = new Contract(childArtifact, [alicePkh], {
      provider, addressType: 'p2sh32', category: hexToBin(result.childCategoryId), salt,
    });
    expect(result.child.address).toBe(expected.address);

    // And it differs from the unsalted address (the salt is actually applied).
    const unsalted = new Contract(childArtifact, [alicePkh], {
      provider, addressType: 'p2sh32', category: hexToBin(result.childCategoryId),
    });
    expect(result.child.address).not.toBe(unsalted.address);
  });
});
