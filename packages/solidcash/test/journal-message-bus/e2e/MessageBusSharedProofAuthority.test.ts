import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { aliceAddress, bobAddress } from '../../fixture/vars.js';
import { createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusSemanticTestProvider } from './message-bus-semantic-profile.js';

describe('message-bus shared sorted-proof authority', () => {
  it('promotes an earlier read proof when a later row writes through it', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract SharedProofRoute() {
        mapping(address => uint) balances;

        function mint(address to, uint amount) public {
          balances[to] = balances[to] + amount;
          require(amount >= 0);
        }
        function checkBalance(address owner, uint expected) public {
          require(balances[owner] == expected);
        }
        function move(address from, address to, uint amount) public {
          require(balances[from] >= amount);
          balances[from] = balances[from] - amount;
          balances[to] = balances[to] + amount;
          require(amount >= 0);
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 10_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.mint(aliceAddress, 100n).send();
    await contract.mint(bobAddress, 10n).send();

    const batch = encodeMessageBatch(artifact, [
      { function: 'checkBalance', args: [bobAddress, 10n] },
      { function: 'move', args: [aliceAddress, bobAddress, 30n] },
    ]);
    await contract._batchRaw(batch.blob, batch.routeWitnesses).send();

    await expect(contract.checkBalance(aliceAddress, 70n).send()).resolves.toBeDefined();
    await expect(contract.checkBalance(bobAddress, 40n).send()).resolves.toBeDefined();
  });

  it('preserves the promoted value when the route is an atomic graph participant', async () => {
    const provider = createTestProvider();
    const ledgerArtifact = compileString(`pragma solidity ^0.8.0;
      contract SharedProofLedger() {
        mapping(address => uint) balances;

        function mint(address to, uint amount) public {
          balances[to] = balances[to] + amount;
          require(amount >= 0);
        }
        function checkBalance(address owner, uint expected) public returns (bool) {
          require(balances[owner] == expected);
          return true;
        }
        function move(address from, address to, uint amount) public {
          require(balances[from] >= amount);
          balances[from] = balances[from] - amount;
          balances[to] = balances[to] + amount;
          require(amount >= 0);
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 10_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    const ledgerInner = new Contract(ledgerArtifact, [], { provider });
    const ledgerSetup = await setupStatefulUtxos(
      provider, ledgerInner, ledgerArtifact.stateLayout!, {},
    );
    const ledger = StatefulContract.withCategory(ledgerInner, ledgerSetup.categoryId);

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface ISharedProofLedger {
        function checkBalance(address owner, uint expected) external returns (bool);
        function move(address from, address to, uint amount) external;
      }
      contract SharedProofCaller(address ledger) {
        function settle(address owner, address receiver, uint amount) public {
          require(ISharedProofLedger(ledger).checkBalance(owner, 100));
          ISharedProofLedger(ledger).move(owner, receiver, amount);
          require(true);
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 10_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    const callerInner = new Contract(callerArtifact, [ledger.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerInner, callerArtifact.stateLayout!, {},
    );
    const caller = StatefulContract.withCategory(callerInner, callerSetup.categoryId);

    await ledger.mint(aliceAddress, 100n).send();
    await ledger.mint(bobAddress, 10n).send();
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [
        caller.call.settle(aliceAddress, bobAddress, 30n),
        ledger.call.checkBalance(aliceAddress, 100n),
        ledger.call.move(aliceAddress, bobAddress, 30n),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await composition.send();

    await expect(ledger.checkBalance(aliceAddress, 70n).send()).resolves.toBeDefined();
    await expect(ledger.checkBalance(bobAddress, 40n).send()).resolves.toBeDefined();
  });

  it('preserves independent promoted entries across one multi-collection writer', async () => {
    const provider = createTestProvider();
    const ledgerArtifact = compileString(`pragma solidity ^0.8.0;
      contract SharedProofDualLedger() {
        mapping(address => uint) balances;
        mapping(address => mapping(address => uint)) quotas;

        function mint(address to, uint amount) public {
          balances[to] = balances[to] + amount;
          require(amount >= 0);
        }
        function checkBalance(address owner, uint expected) public returns (bool) {
          require(balances[owner] == expected);
          return true;
        }
        function setQuota(address owner, address spender, uint amount) public returns (bool) {
          quotas[owner][spender] = amount;
          return true;
        }
        function move(address from, address to, address spender, uint amount) public returns (bool) {
          require(quotas[from][spender] >= amount);
          quotas[from][spender] = quotas[from][spender] - amount;
          require(balances[from] >= amount);
          balances[from] = balances[from] - amount;
          balances[to] = balances[to] + amount;
          return true;
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 10_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    const ledgerInner = new Contract(ledgerArtifact, [], { provider });
    const ledgerSetup = await setupStatefulUtxos(
      provider, ledgerInner, ledgerArtifact.stateLayout!, {},
    );
    const ledger = StatefulContract.withCategory(ledgerInner, ledgerSetup.categoryId);

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface ISharedProofDualLedger {
        function checkBalance(address owner, uint expected) external returns (bool);
        function setQuota(address owner, address spender, uint amount) external returns (bool);
        function move(address from, address to, address spender, uint amount) external returns (bool);
      }
      contract SharedProofDualCaller(address ledger) {
        function settle(address owner, address receiver, address spender, uint amount) public {
          require(ISharedProofDualLedger(ledger).checkBalance(owner, 100));
          require(ISharedProofDualLedger(ledger).setQuota(owner, spender, 100));
          require(ISharedProofDualLedger(ledger).move(owner, receiver, spender, amount));
          require(true);
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 10_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    const callerInner = new Contract(callerArtifact, [ledger.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerInner, callerArtifact.stateLayout!, {},
    );
    const caller = StatefulContract.withCategory(callerInner, callerSetup.categoryId);

    await ledger.mint(aliceAddress, 100n).send();
    await ledger.mint(bobAddress, 10n).send();
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    await messageBus.compose({
      calls: [
        caller.call.settle(aliceAddress, bobAddress, aliceAddress, 30n),
        ledger.call.checkBalance(aliceAddress, 100n),
        ledger.call.setQuota(aliceAddress, aliceAddress, 100n),
        ledger.call.move(aliceAddress, bobAddress, aliceAddress, 30n),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).send();

    await expect(ledger.checkBalance(aliceAddress, 70n).send()).resolves.toBeDefined();
    await expect(ledger.checkBalance(bobAddress, 40n).send()).resolves.toBeDefined();
  });

  it('keeps an earlier authenticated read as the value source while an eventful writer owns the transition', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract EventfulSharedProofLedger() {
        mapping(address => uint) balances;
        mapping(address => mapping(address => uint)) quotas;
        event Changed();

        function mint(address to, uint amount) public {
          balances[to] = balances[to] + amount;
          require(amount >= 0);
        }
        function quota(address owner, address spender) public view returns (uint) {
          return quotas[owner][spender];
        }
        function _setQuota(address owner, address spender, uint amount) internal {
          quotas[owner][spender] = amount;
          emit Changed();
        }
        function setQuota(address owner, address spender, uint amount) public returns (bool) {
          _setQuota(owner, spender, amount);
          return true;
        }
        function checkBalance(address owner, uint expected) public returns (bool) {
          require(balances[owner] == expected);
          return true;
        }
        function balanceOf(address owner) public view returns (uint) {
          return balances[owner];
        }
        function _spendQuota(address owner, address spender, uint amount) internal {
          uint currentQuota = quota(owner, spender);
          if (currentQuota != type(uint).max) {
            require(currentQuota >= amount);
            _setQuota(owner, spender, currentQuota - amount);
          }
        }
        function _move(address from, address to, uint amount) internal {
          require(balances[from] >= amount);
          balances[from] = balances[from] - amount;
          balances[to] = balances[to] + amount;
          emit Changed();
        }
        function transfer(address to, uint amount) public returns (bool) {
          _move(msg.sender, to, amount);
          return true;
        }
        function move(address from, address to, address spender, uint amount) public returns (bool) {
          _spendQuota(from, spender, amount);
          _move(from, to, amount);
          return true;
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 10_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    const ledger = StatefulContract.withCategory(inner, setup.categoryId);

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IEventfulSharedProofLedger {
        function balanceOf(address owner) external view returns (uint);
        function setQuota(address owner, address spender, uint amount) external returns (bool);
        function move(address from, address to, address spender, uint amount) external returns (bool);
      }
      contract EventfulSharedProofCaller(address ledger) {
        function settle(address owner, address receiver, address spender, uint amount) public {
          require(IEventfulSharedProofLedger(ledger).balanceOf(owner) == 100);
          require(IEventfulSharedProofLedger(ledger).setQuota(owner, spender, 100));
          require(IEventfulSharedProofLedger(ledger).move(owner, receiver, spender, amount));
          require(true);
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 10_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    const callerInner = new Contract(callerArtifact, [ledger.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerInner, callerArtifact.stateLayout!, {},
    );
    const caller = StatefulContract.withCategory(callerInner, callerSetup.categoryId);

    await ledger.mint(aliceAddress, 100n).send();
    await ledger.mint(bobAddress, 10n).send();
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    await messageBus.compose({
      calls: [
        caller.call.settle(aliceAddress, bobAddress, aliceAddress, 30n),
        ledger.call.balanceOf(aliceAddress),
        ledger.call.setQuota(aliceAddress, aliceAddress, 100n),
        ledger.call.move(aliceAddress, bobAddress, aliceAddress, 30n),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).send();

    await expect(ledger.checkBalance(aliceAddress, 70n).send()).resolves.toBeDefined();
    await expect(ledger.checkBalance(bobAddress, 40n).send()).resolves.toBeDefined();
  });
});
