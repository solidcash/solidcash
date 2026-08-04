import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, TransactionBuilder, StatefulContract } from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import {
  alicePkh,
  alicePriv,
  alicePub,
  aliceAddress,
} from '../fixture/vars.js';
import {
  createTestProvider, getLargestUtxo, getTxOutputs, verifyTransaction, setupStatefulUtxos,
} from '../test-util.js';
import { FailedRequireError } from '../../src/Errors.js';
import { randomUtxo } from '../../src/utils.js';
import fallbackReceiveArtifact from '../fixture/fallback_receive.artifact.js';

describe('FallbackReceive', () => {
  const provider = createTestProvider();
  const contract = new Contract(fallbackReceiveArtifact, [alicePkh], { provider });

  beforeAll(async () => {
    console.log(contract.address);
    await provider.addUtxo(contract.address, randomUtxo());
    await provider.addUtxo(contract.address, randomUtxo());
    await provider.addUtxo(contract.address, randomUtxo());
  });

  describe('contract creation', () => {
    it('should create contract with fallback and receive unlockers', () => {
      expect(typeof contract.address).toBe('string');
      expect(typeof contract.unlock.transfer).toBe('function');
      expect(typeof contract.unlock.fallback).toBe('function');
      expect(typeof contract.unlock.receive).toBe('function');
      expect(contract.name).toEqual(fallbackReceiveArtifact.contractName);
    });

    it('should have correct ABI entries', () => {
      const abi = contract.artifact.abi;
      expect(abi).toHaveLength(3);

      const transferFn = abi.find((f) => f.name === 'transfer');
      expect(transferFn).toBeDefined();
      expect(transferFn!.inputs).toHaveLength(2);

      const fallbackFn = abi.find((f) => f.name === '__fallback');
      expect(fallbackFn).toBeDefined();
      expect(fallbackFn!.isFallback).toBe(true);
      expect(fallbackFn!.inputs).toHaveLength(0);

      const receiveFn = abi.find((f) => f.name === '__receive');
      expect(receiveFn).toBeDefined();
      expect(receiveFn!.isReceive).toBe(true);
      expect(receiveFn!.inputs).toHaveLength(0);
    });
  });

  describe('transfer (regular function)', () => {
    it('should succeed when calling transfer with correct args', async () => {
      const contractUtxo = getLargestUtxo(await contract.getUtxos());

      const tx = await new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.transfer(alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to: aliceAddress, amount: 1000n })
        .addOutput({ to: contract.address, amount: contractUtxo.satoshis - 2000n })
        .send();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toEqual(expect.arrayContaining([{ to: aliceAddress, amount: 1000n }]));
    });
  });

  describe('receive (no selector, no args)', () => {
    it('should succeed when output value meets minimum', async () => {
      const contractUtxo = getLargestUtxo(await contract.getUtxos());

      const builder = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.receive())
        .addOutput({ to: aliceAddress, amount: 546n })
        .addOutput({ to: contract.address, amount: contractUtxo.satoshis - 1546n });

      // Verify the transaction is valid at the VM level
      verifyTransaction(builder);

      const tx = await builder.send();
      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toEqual(expect.arrayContaining([{ to: aliceAddress, amount: 546n }]));
    });

    it('should fail when receive() contract require is not met', async () => {
      // The receive body requires tx.outputs[0].value >= 546
      // We use a valid dust amount but exploit a different scenario:
      // The contract checks output[0] value, so we set it to 0 using OP_RETURN
      const contractUtxo = getLargestUtxo(await contract.getUtxos());

      // Send to OP_RETURN (value 0) as first output - fails require(tx.outputs[0].value >= 546)
      const txPromise = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.receive())
        .addOutput({ to: new Uint8Array([0x6a, 0x00]), amount: 0n })
        .addOutput({ to: contract.address, amount: contractUtxo.satoshis - 1000n })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('fallback (unknown selector routing)', () => {
    it('should succeed when output value meets minimum', async () => {
      const contractUtxo = getLargestUtxo(await contract.getUtxos());

      const tx = await new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.fallback())
        .addOutput({ to: aliceAddress, amount: 1000n })
        .addOutput({ to: contract.address, amount: contractUtxo.satoshis - 2000n })
        .send();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toEqual(expect.arrayContaining([{ to: aliceAddress, amount: 1000n }]));
    });

    it('should fail when output value is below minimum', async () => {
      const contractUtxo = getLargestUtxo(await contract.getUtxos());

      const txPromise = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.fallback())
        .addOutput({ to: aliceAddress, amount: 999n })
        .addOutput({ to: contract.address, amount: contractUtxo.satoshis - 1999n })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });
});

// ============================================================
// M-NEW-3: Stateful fallback/receive ABI metadata in SDK
// ============================================================
describe('Stateful fallback/receive ABI metadata (M-NEW-3)', () => {
  const STATEFUL_PROXY = `
    pragma solidcash >=0.8.0;
    contract StatefulProxy() {
      int counter;
      function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
      }
      fallback(bytes input) external {
        address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
        impl.delegatecall(input);
        require(input.length > 0);
      }
    }
  `;

  const STATEFUL_RECEIVE = `
    pragma solidcash >=0.8.0;
    contract StatefulReceive() {
      int counter;
      function increment() {
        this.counter = this.counter + 1;
      }
      receive() external payable {
        require(tx.outputs[0].value >= 546);
      }
    }
  `;

  describe('stateful fallback with delegatecall', () => {
    const artifact = compileString(STATEFUL_PROXY);

    it('should have lowLevelCalls metadata on fallback ABI entry', () => {
      const fallback = artifact.abi.find((f) => f.name === '__fallback');
      expect(fallback).toBeDefined();
      expect(fallback!.isFallback).toBe(true);
      // The alias `address impl = address(0x76a9..)` resolves through the cast to the hex literal it wraps.
      expect(fallback!.lowLevelCalls).toEqual([{ callMode: 'delegatecall', target: { kind: 'literal' } }]);
    });

    it('should have ALL data NFT indices for delegatecall fallback', () => {
      const fallback = artifact.abi.find((f) => f.name === '__fallback');
      // Delegatecall fallbacks get all data NFT indices because the delegate
      // implementation may access any state on the proxy's behalf.
      expect(fallback!.requiredNftIndices).toEqual([0]);
    });

    it('SDK should fetch all data NFTs when calling fallback on stateful contract', async () => {
      const provider = createTestProvider();
      const baseContract = new Contract(artifact, [], { provider });

      // Real genesis at the salted addresses withCategory expects.
      const { categoryId: catId } = await setupStatefulUtxos(
        provider, baseContract, artifact.stateLayout!, { counter: 5n }, { saltContract: true },
      );

      const sc = StatefulContract.withCategory(baseContract, catId);

      // Calling __fallback on a stateful contract should succeed and include data NFTs
      // (delegatecall fallback has requiredNftIndices: [0] -> SDK fetches all data NFTs)
      const state = await sc.getFullState();
      expect(state.masterUtxo).toBeDefined();
      expect(state.dataNftUtxos.length).toBe(1);
      expect(state.state.counter).toBe(5n);
    });
  });

  describe('stateful receive', () => {
    const artifact = compileString(STATEFUL_RECEIVE);

    it('should have isReceive and payable on receive ABI entry', () => {
      const receive = artifact.abi.find((f) => f.name === '__receive');
      expect(receive).toBeDefined();
      expect(receive!.isReceive).toBe(true);
      expect(receive!.modifiers).toContain('payable');
    });

    it('should have empty requiredNftIndices on receive (no state access)', () => {
      const receive = artifact.abi.find((f) => f.name === '__receive');
      // receive() doesn't access state, so it gets [] (empty) - not undefined
      expect(receive!.requiredNftIndices).toEqual([]);
    });

    it('should have requiredNftIndices on regular increment function', () => {
      const increment = artifact.abi.find((f) => f.name === 'increment');
      expect(increment).toBeDefined();
      expect(increment!.requiredNftIndices).toBeDefined();
      expect(increment!.requiredNftIndices).toEqual([0]);
    });

    it('SDK should auto-derive state for regular function on contract with receive', async () => {
      const provider = createTestProvider();
      const baseContract = new Contract(artifact, [], { provider });

      // Real genesis at the salted addresses withCategory expects.
      const { categoryId: catId } = await setupStatefulUtxos(
        provider, baseContract, artifact.stateLayout!, { counter: 10n }, { saltContract: true },
      );

      const sc = StatefulContract.withCategory(baseContract, catId);
      const tx = await sc.call.increment().send();

      expect(tx.txid).toBeDefined();

      // Verify counter was incremented from 10 to 11
      const txOutputs = getTxOutputs(tx);
      const dataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === catId,
      );
      expect(dataNftOutput).toBeDefined();

      const parsed = parsePushdataCommitment(
        dataNftOutput!.token!.nft!.commitment, artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(11n);
    });
  });
});
