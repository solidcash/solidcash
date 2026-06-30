import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { ResolvedImport, parsePushdataCommitment } from '@solidcash/utils';
import {
  Contract, MockNetworkProvider, TransactionBuilder, SignatureTemplate,
  FailedRequireError, StatefulContract,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos, getTxOutputs } from '../test-util.js';
import {
  alicePriv, alicePub, alicePkh,
  bobPkh,
} from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// --- Helpers -------------------------------------------------------------

function normalizePath(p: string): string {
  const parts = p.split('/');
  const result: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..' && result.length > 0 && result[result.length - 1] !== '..') {
      result.pop();
    } else {
      result.push(part);
    }
  }
  return result.join('/');
}

function createMapResolver(files: Record<string, string>) {
  return (importPath: string, currentFile: string): ResolvedImport | undefined => {
    const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
    let resolved = normalizePath(dir + importPath);
    if (!resolved.endsWith('.scash')) resolved += '.scash';
    const source = files[resolved];
    if (source === undefined) return undefined;
    return { source, id: resolved };
  };
}

async function addUtxos(provider: MockNetworkProvider, address: string, count: number = 3): void {
  for (let i = 0; i < count; i++) {
    await provider.addUtxo(address, randomUtxo({ satoshis: 10000n }));
  }
}

// --- Contract Source Code ------------------------------------------------

const targetSource = `
  contract Target(bytes20 pkh) {
    function spend(pubkey pk, sig s) {
      require(hash160(pk) == pkh);
      require(checkSig(s, pk));
    }
  }
`;

const noArgsTargetSource = `
  contract NoArgsTarget() {
    function spend(pubkey pk, sig s) {
      require(checkSig(s, pk));
    }
  }
`;

const deployerSource = `
  import "./target.scash";
  contract Deployer(pubkey owner) {
    function verifyDeployment(sig s, bytes20 targetPkh, bytes expectedLbc) {
      require(checkSig(s, owner));
      bytes computedLbc = new Target(targetPkh);
      require(computedLbc == expectedLbc);
    }
  }
`;

const noArgsDeployerSource = `
  import "./no_args_target.scash";
  contract NoArgsDeployer(pubkey owner) {
    function verifyDeployment(sig s, bytes expectedLbc) {
      require(checkSig(s, owner));
      bytes computedLbc = new NoArgsTarget();
      require(computedLbc == expectedLbc);
    }
  }
`;

const saltedDeployerSource = `
  import "./target.scash";
  contract SaltedDeployer(pubkey owner) {
    function verifyDeployment(sig s, bytes20 targetPkh, bytes salt, bytes expectedLbc) {
      require(checkSig(s, owner));
      bytes computedLbc = new Target{salt: salt}(targetPkh);
      require(computedLbc == expectedLbc);
    }
  }
`;

// --- Tests ---------------------------------------------------------------

describe('Contract Deployment (new Contract(...))', () => {
  const files: Record<string, string> = {
    '/target.scash': targetSource,
    '/no_args_target.scash': noArgsTargetSource,
  };

  describe('bytecode-only deployment (no value, no salt)', () => {
    it('computed locking bytecode matches SDK Contract class', async () => {
      // Compile the target contract via SDK and get its locking bytecode
      const targetArtifact = compileString(targetSource);
      const targetProvider = createTestProvider();
      const targetContract = new Contract(
        targetArtifact, [bobPkh], { provider: targetProvider, addressType: 'p2sh32' },
      );
      const expectedLbc = hexToBin(targetContract.lockingBytecode);

      // Compile the deployer contract (imports target)
      const deployerArtifact = compileString(deployerSource, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      const provider = createTestProvider();
      const deployerContract = new Contract(
        deployerArtifact, [alicePub], { provider },
      );
      await addUtxos(provider, deployerContract.address);

      // Execute: deployer computes target's lbc at runtime and verifies it matches
      const to = deployerContract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(
        await deployerContract.getUtxos(), { amount },
      );

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, deployerContract.unlock.verifyDeployment(
          new SignatureTemplate(alicePriv),
          bobPkh,
          expectedLbc,
        ))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('fails when expected lbc does not match (wrong constructor args)', async () => {
      // Compile target with Alice's pkh but pass Bob's pkh to deployer
      const targetArtifact = compileString(targetSource);
      const targetProvider = createTestProvider();
      const wrongTargetContract = new Contract(
        targetArtifact, [alicePkh], { provider: targetProvider, addressType: 'p2sh32' },
      );
      const wrongLbc = hexToBin(wrongTargetContract.lockingBytecode);

      const deployerArtifact = compileString(deployerSource, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      const provider = createTestProvider();
      const deployerContract = new Contract(
        deployerArtifact, [alicePub], { provider },
      );
      await addUtxos(provider, deployerContract.address);

      const to = deployerContract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(
        await deployerContract.getUtxos(), { amount },
      );

      // Bob's pkh != Alice's pkh, so the computed lbc won't match
      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, deployerContract.unlock.verifyDeployment(
          new SignatureTemplate(alicePriv),
          bobPkh,
          wrongLbc,
        ))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('zero-arg deployment', () => {
    it('computed locking bytecode matches SDK for zero-arg contract', async () => {
      const targetArtifact = compileString(noArgsTargetSource);
      const targetProvider = createTestProvider();
      const targetContract = new Contract(
        targetArtifact, [], { provider: targetProvider, addressType: 'p2sh32' },
      );
      const expectedLbc = hexToBin(targetContract.lockingBytecode);

      const deployerArtifact = compileString(noArgsDeployerSource, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      const provider = createTestProvider();
      const deployerContract = new Contract(
        deployerArtifact, [alicePub], { provider },
      );
      await addUtxos(provider, deployerContract.address);

      const to = deployerContract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(
        await deployerContract.getUtxos(), { amount },
      );

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, deployerContract.unlock.verifyDeployment(
          new SignatureTemplate(alicePriv),
          expectedLbc,
        ))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });
  });

  describe('salt is honored for deployment (create2)', () => {
    const saltA = hexToBin('deadbeef01020304');
    const saltB = hexToBin('ffffffffffffffff');

    it('salt is honored - compiled lbc matches the SDK Contract salt address', async () => {
      // The salted on-chain lbc should match the SDK's Contract class constructed WITH the same salt.
      const targetArtifact = compileString(targetSource);
      const targetProvider = createTestProvider();
      const saltedTarget = new Contract(
        targetArtifact, [bobPkh],
        { provider: targetProvider, addressType: 'p2sh32', salt: saltA },
      );
      const expectedLbc = hexToBin(saltedTarget.lockingBytecode);

      const deployerArtifact = compileString(saltedDeployerSource, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      const provider = createTestProvider();
      const deployerContract = new Contract(deployerArtifact, [alicePub], { provider });
      await addUtxos(provider, deployerContract.address);

      const to = deployerContract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await deployerContract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, deployerContract.unlock.verifyDeployment(
          new SignatureTemplate(alicePriv), bobPkh, saltA, expectedLbc,
        ))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('different salts produce DIFFERENT locking bytecode (a mismatched salt fails the on-chain check)', async () => {
      const targetArtifact = compileString(targetSource);
      const targetProvider = createTestProvider();
      // Expected address is for saltA, but the deployer is given saltB - the salted lbc differs, so the
      // on-chain `new T{saltB}() == expectedLbc(saltA)` fails.
      const saltedTargetA = new Contract(
        targetArtifact, [bobPkh],
        { provider: targetProvider, addressType: 'p2sh32', salt: saltA },
      );
      const expectedLbc = hexToBin(saltedTargetA.lockingBytecode);

      const deployerArtifact = compileString(saltedDeployerSource, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      const provider = createTestProvider();
      const deployerContract = new Contract(deployerArtifact, [alicePub], { provider });
      await addUtxos(provider, deployerContract.address);

      const to = deployerContract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await deployerContract.getUtxos(), { amount });

      await expect(new TransactionBuilder({ provider })
        .addInputs(utxos, deployerContract.unlock.verifyDeployment(
          new SignatureTemplate(alicePriv), bobPkh, saltB, expectedLbc,
        ))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send()).rejects.toThrow();
    });
  });

  describe('output targeting with locking bytecode', () => {
    it('can use deployed lbc to target transaction outputs', async () => {
      // This tests that the locking bytecode produced by `new Contract(args)`
      // can be used to verify transaction outputs (a common deployment pattern)
      const outputVerifierSource = `
        import "./target.scash";
        contract OutputVerifier(pubkey owner) {
          function sendToDeployed(sig s, bytes20 targetPkh) {
            require(checkSig(s, owner));
            bytes deployedLbc = new Target(targetPkh);
            require(tx.outputs[0].lockingBytecode == deployedLbc);
          }
        }
      `;

      const targetArtifact = compileString(targetSource);
      const targetProvider = createTestProvider();
      const targetContract = new Contract(
        targetArtifact, [bobPkh], { provider: targetProvider, addressType: 'p2sh32' },
      );

      const deployerArtifact = compileString(outputVerifierSource, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      const provider = createTestProvider();
      const deployerContract = new Contract(
        deployerArtifact, [alicePub], { provider },
      );
      await addUtxos(provider, deployerContract.address);

      const { utxos, changeAmount } = gatherUtxos(
        await deployerContract.getUtxos(), { amount: 2000n },
      );

      // Output 0 must match the target contract's address
      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, deployerContract.unlock.sendToDeployed(
          new SignatureTemplate(alicePriv),
          bobPkh,
        ))
        .addOutput({ to: targetContract.address, amount: 2000n })
        .addOutput({ to: deployerContract.address, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('create2: a salted new Target{salt}() matches the SDK Contract salt address', async () => {
      // EVM create2: `new T{salt}(args)` yields a deterministic, salt-distinguished p2sh address. The on-chain
      // salted locking bytecode the compiler builds must equal the address the SDK Contract derives for the
      // same (artifact, args, salt). Output 0 is sent to the SDK-salted address; the covenant requires it to
      // equal the compiler-computed `new Target{salt}(targetPkh)`, so a passing send proves the parity.
      const salt = hexToBin('ab'.repeat(32));
      const saltVerifierSource = `
        import "./target.scash";
        contract SaltVerifier(pubkey owner) {
          function sendToSalted(sig s, bytes20 targetPkh, bytes32 salt) {
            require(checkSig(s, owner));
            bytes deployedLbc = new Target{salt: salt}(targetPkh);
            require(tx.outputs[0].lockingBytecode == deployedLbc);
          }
        }
      `;

      const targetArtifact = compileString(targetSource);
      const targetProvider = createTestProvider();
      const targetContract = new Contract(
        targetArtifact, [bobPkh], { provider: targetProvider, addressType: 'p2sh32', salt },
      );

      const deployerArtifact = compileString(saltVerifierSource, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      const provider = createTestProvider();
      const deployerContract = new Contract(deployerArtifact, [alicePub], { provider });
      await addUtxos(provider, deployerContract.address);

      const { utxos, changeAmount } = gatherUtxos(
        await deployerContract.getUtxos(), { amount: 2000n },
      );

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, deployerContract.unlock.sendToSalted(
          new SignatureTemplate(alicePriv), bobPkh, salt,
        ))
        .addOutput({ to: targetContract.address, amount: 2000n }) // SDK-salted address
        .addOutput({ to: deployerContract.address, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });
  });
});

// --- Stateful Deployment with Auto-Derivation -----------------------------

const factoryTargetSource = `
  contract FactoryTarget(bytes20 pkh) {
    function spend(pubkey pk, sig s) {
      require(hash160(pk) == pkh);
      require(checkSig(s, pk));
    }
  }
`;

const factorySource = `
  import "./factory_target.scash";
  contract Factory(pubkey owner) {
    int deployCount;
    function deployChild(sig s, bytes20 targetPkh, int amount) {
      require(checkSig(s, owner));
      bytes deployedLbc = new FactoryTarget{value: amount}(targetPkh);
      require(deployedLbc.length == 35);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

describe('Stateful Contract Deployment (auto-derivation)', () => {
  const factoryFiles: Record<string, string> = {
    '/factory_target.scash': factoryTargetSource,
  };

  const factoryArtifact = compileString(factorySource, {
    importResolver: createMapResolver(factoryFiles),
    rootFileId: '/main.scash',
  });

  describe('ABI metadata', () => {
    it('should have transferCount=1 for deployChild', () => {
      const deployChildAbi = factoryArtifact.abi.find((f) => f.name === 'deployChild');
      expect(deployChildAbi).toBeDefined();
      expect(deployChildAbi!.transferCount).toBe(1);
    });

    it('should be a stateful contract with stateLayout', () => {
      expect(factoryArtifact.stateLayout).toBeDefined();
      expect(factoryArtifact.stateLayout!.variables).toHaveLength(1);
      expect(factoryArtifact.stateLayout!.variables[0].name).toBe('deployCount');
    });
  });

  describe('auto-derived deployment transfer', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    it('should deploy the factory contract with satoshi container', async () => {
      const fundingUtxo: Utxo = {
        txid: 'f1cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(factoryArtifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { deployCount: 0n },
        changeAddress: p2pkh.address,
        initialBalance: 50000n,
      });

      factory = result.contract;
      expect(await factory.satoshiContainer.getBalance()).toBe(50000n);
    });

    it('should auto-derive deployment transfer output', async () => {
      // Call deployChild WITHOUT manual .transfer() - auto-derivation handles it
      const tx = await factory.call
        .deployChild(new SignatureTemplate(alicePriv), bobPkh, 10000n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Master NFT output preserved (output 0)
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');

      // Data NFT commitment updated (output 1, deployCount -> 1)
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, factoryArtifact.stateLayout!, 0,
      );
      expect(parsed.deployCount).toBe(1n);

      // Satoshi container balance reduced (50000 - 10000 = 40000)
      const containerOutput = txOutputs.find(
        (o) => !o.token && o.amount === 40000n,
      );
      expect(containerOutput).toBeDefined();

      // Transfer output: deployed contract's P2SH32 locking bytecode with 10000 sats
      const transferOutput = txOutputs.find(
        (o) => !o.token && o.amount === 10000n,
      );
      expect(transferOutput).toBeDefined();
      expect(transferOutput!.token).toBeUndefined();

      // Verify the transfer output's address matches the SDK-compiled target contract
      const compiledTarget = compileString(factoryTargetSource);
      const targetContract = new Contract(
        compiledTarget, [bobPkh],
        { provider: createTestProvider(), addressType: 'p2sh32' },
      );
      expect(transferOutput!.to).toBe(targetContract.address);
    });

    it('should support a second deployment with updated state', async () => {
      // Deploy again with different amount
      const tx = await factory.call
        .deployChild(new SignatureTemplate(alicePriv), bobPkh, 5000n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // State updated to deployCount=2 (data NFT at output 1)
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, factoryArtifact.stateLayout!, 0,
      );
      expect(parsed.deployCount).toBe(2n);

      // Satoshi container balance reduced further (40000 - 5000 = 35000)
      const containerOutput = txOutputs.find(
        (o) => !o.token && o.amount === 35000n,
      );
      expect(containerOutput).toBeDefined();

      // Transfer output with 5000 sats to deployed contract
      const transferOutput = txOutputs.find(
        (o) => !o.token && o.amount === 5000n,
      );
      expect(transferOutput).toBeDefined();
    });
  });
});

// --- Stateful Child Deployment via deployFrom -----------------------------

const statefulChildSource = `
  contract StatefulChild(bytes20 owner) {
    int counter;

    function increment(pubkey pk, sig s) {
      require(hash160(pk) == owner);
      require(checkSig(s, pk));
      this.counter = this.counter + 1;
    }
  }
`;

const statefulFactorySource = `
  import "./stateful_child.scash";
  contract StatefulFactory(pubkey factoryOwner) {
    int deployCount;

    function deployChild(sig s, bytes20 childOwner) deploy {
      require(checkSig(s, factoryOwner));
      bytes childLbc = new StatefulChild(childOwner);
      require(childLbc.length == 35);
      this.deployCount = this.deployCount + 1;
    }
  }
`;

describe('Stateful Child Deployment (deployFrom)', () => {
  const deployFiles: Record<string, string> = {
    '/stateful_child.scash': statefulChildSource,
  };

  const childArtifact = compileString(statefulChildSource);
  const factoryArtifact2 = compileString(statefulFactorySource, {
    importResolver: createMapResolver(deployFiles),
    rootFileId: '/main.scash',
  });

  describe('ABI metadata', () => {
    it('should have deployTargets in the deployChild ABI', () => {
      const deployFn = factoryArtifact2.abi.find((f) => f.name === 'deployChild');
      expect(deployFn).toBeDefined();
      expect(deployFn!.deployTargets).toBeDefined();
      expect(deployFn!.deployTargets).toHaveLength(1);
      expect(deployFn!.deployTargets![0].contractName).toBe('StatefulChild');
      expect(deployFn!.deployTargets![0].dataNftCount).toBe(1);
    });

    it('child artifact should be stateful', () => {
      expect(childArtifact.stateLayout).toBeDefined();
      expect(childArtifact.stateLayout!.variables).toHaveLength(1);
      expect(childArtifact.stateLayout!.variables[0].name).toBe('counter');
    });
  });

  describe('deployFrom()', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let factory2: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    it('should deploy the factory', async () => {
      const fundingUtxo: Utxo = {
        txid: 'a1cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(factoryArtifact2, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { deployCount: 0n },
        changeAddress: p2pkh.address,
      });

      factory2 = result.contract;
      expect(factory2.categoryId).toBeDefined();
    });

    it('should deploy a stateful child via deployFrom()', async () => {
      // Fund the deployment with a vout-0 UTXO (required for token genesis)
      const fundingUtxo: Utxo = {
        txid: 'b2cd'.repeat(16),
        vout: 0,
        satoshis: 50000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deployFrom({
        provider,
        factory: factory2,
        deployFunctionName: 'deployChild',
        deployFunctionArgs: [new SignatureTemplate(alicePriv), bobPkh],
        childArtifact,
        childConstructorArgs: [bobPkh],
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });

      expect(result.tx.txid).toBeDefined();
      expect(result.childCategoryId).toBe(fundingUtxo.txid);
      expect(result.child).toBeDefined();

      const txOutputs = getTxOutputs(result.tx);

      // Factory outputs: master NFT + data NFT (factory state updated)
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');

      // Factory state updated: deployCount -> 1
      const factoryState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, factoryArtifact2.stateLayout!, 0,
      );
      expect(factoryState.deployCount).toBe(1n);

      // Child outputs: child master NFT + child data NFT
      // Child master should have minting capability with child category
      const childMasterOutput = txOutputs.find(
        (o) => o.token?.category === fundingUtxo.txid && o.token?.nft?.capability === 'minting',
      );
      expect(childMasterOutput).toBeDefined();

      // Child data NFT should have mutable capability with default state
      const childDataOutput = txOutputs.find(
        (o) => o.token?.category === fundingUtxo.txid && o.token?.nft?.capability === 'mutable',
      );
      expect(childDataOutput).toBeDefined();

      // Default commitment should have counter=0
      if (childDataOutput?.token?.nft?.commitment) {
        const childState = parsePushdataCommitment(
          childDataOutput.token.nft.commitment, childArtifact.stateLayout!, 0,
        );
        expect(childState.counter).toBe(0n);
      }
    });
  });
});
