import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { getContractFactory, upgrades } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { getSigners } from '../test-util.js';
import { createMessageBusSemanticTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const TARGET = `
pragma solidity ^0.8.0;
contract SenderTarget {
    function balanceOf(address owner) public pure returns (uint256) {
        require(owner != address(0));
        return 1;
    }
    function observe(address subject) public pure {
        require(subject != address(0));
    }
}
`;

const CALLER = `
pragma solidity ^0.8.0;
interface ISenderTarget {
    function balanceOf(address owner) external returns (uint256);
    function observe(address subject) external;
}
contract SenderCaller {
    int public completed;
    function initialize() public { this.completed = 0; }
    function verify(address target) public {
        require(ISenderTarget(target).balanceOf(msg.sender) > 0);
        ISenderTarget(target).observe(address(this));
        this.completed = this.completed + 1;
    }
}
`;

describe('delegated root caller identity', () => {
  it('fills the root delegate sender-anchor witness while initializing a proxy', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const [deployer] = await getSigners(1, { provider, fundingUtxos: 4 });
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract RootDelegateInitializerSender {
        address public owner;
        function initialize() public { this.owner = msg.sender; }
      }
    `, {
      forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      solidityImportCompat: true,
    });
    expect(artifact.delegateArtifact?.abi.find((entry) => entry.name === 'initialize')?.inputs)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: '__internal__msgSenderAnchorIdx' }),
      ]));

    const caller = await upgrades.deployProxy(getContractFactory(artifact, deployer), []);
    expect(binToHex((await caller.proxy.getState()).owner as Uint8Array))
      .toBe(binToHex(addressToLockScript(deployer.getAddress())));
  }, 180_000);

  it('plans msg.sender from the authenticated invoker', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const [deployer, invoker] = await getSigners(2, { provider, fundingUtxos: 8 });
    const options = {
      forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      solidityImportCompat: true,
    } as const;
    const targetArtifact = compileString(TARGET, options);
    const callerArtifact = compileString(CALLER, options);
    expect(targetArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(callerArtifact.messageBus?.convention).toBe('kernel-row-loop');

    const target = await getContractFactory(targetArtifact, deployer).deploy();
    const caller = await upgrades.deployProxy(getContractFactory(callerArtifact, deployer), []);
    const connected = caller.connect(invoker);
    const tx = await (connected as any).verify(target.inner.lockingBytecode).send();

    expect(tx.txid).toBeDefined();
    expect((await connected.proxy.getState()).completed).toBe(1n);
  }, 180_000);
});
