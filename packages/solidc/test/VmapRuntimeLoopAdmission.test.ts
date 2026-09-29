import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const OPTIONS = {
  forceStateful: true,
  solidityImportCompat: true,
  messageBus: true,
  messageBusGraphContext: true,
  optimizeForCompilationSpeed: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('verified-mapping runtime-loop graph admission', () => {
  it('refuses a graph handler whose loop key array is a locally constructed array', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
interface IHub { function ping() external; }
contract Store {
  IHub hub;
  mapping(uint => mapping(address => bool)) whitelistWorkers;
  function refund(uint jobId_) public {
    address[] memory disallowedWorkers_ = new address[](1);
    disallowedWorkers_[0] = msg.sender;
    for (uint i = 0; i < disallowedWorkers_.length; i++) {
      whitelistWorkers[jobId_][disallowedWorkers_[i]] = false;
    }
    hub.ping();
    require(true);
  }
}
    `, OPTIONS);
    expect(artifact.abi.some((fn) => fn.name === 'refund')).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'refund')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });

  it('refuses the marketplace refund shape after the whitelist helper is in the closure', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
interface IHub { function ping() external; }
contract Store {
  IHub hub;
  mapping(uint => mapping(address => bool)) whitelistWorkers;
  function _updateJobWhitelist(uint jobId_, address[] allowedWorkers_, address[] disallowedWorkers_) internal {
    for (uint i = 0; i < allowedWorkers_.length; i++) {
      whitelistWorkers[jobId_][allowedWorkers_[i]] = true;
    }
    for (uint j = 0; j < disallowedWorkers_.length; j++) {
      whitelistWorkers[jobId_][disallowedWorkers_[j]] = false;
    }
  }
  function refund(uint jobId_) public {
    address[] memory disallowedWorkers_ = new address[](1);
    disallowedWorkers_[0] = msg.sender;
    _updateJobWhitelist(jobId_, new address[](0), disallowedWorkers_);
    hub.ping();
    require(true);
  }
}
    `, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'refund')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });

  it('still publishes a verifier program when cheap admission skips throwaway outlining', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
interface IHub { function ping() external; }
contract Store {
  IHub hub;
  uint256 public x;
  function set(uint256 v) public {
    this.x = v;
    hub.ping();
    require(true);
  }
}
    `, OPTIONS);
    expect(artifact.messageBus?.verifierProgram).toBeDefined();
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!].length).toBeGreaterThan(0);
    const delegate = artifact.delegateArtifact;
    expect(delegate).toBeDefined();
    const delegateSelector = delegate!.abi.find((fn) => fn.name === 'set')?.selector;
    expect(delegateSelector).toBeDefined();
    expect(delegate!.functionBodies?.[delegateSelector!]).toBeTypeOf('string');
    expect(delegate!.functionBodies![delegateSelector!].length).toBeGreaterThan(0);
  });

  it('keeps a graph handler whose loop key array is a parameter', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
interface IHub { function ping() external; }
contract Store {
  IHub hub;
  mapping(uint => mapping(address => bool)) whitelistWorkers;
  function publish(uint jobId_, address[] allowedWorkers_) public {
    for (uint i = 0; i < allowedWorkers_.length; i++) {
      whitelistWorkers[jobId_][allowedWorkers_[i]] = true;
    }
    hub.ping();
    require(true);
  }
}
    `, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'publish'))
      .toEqual(expect.objectContaining({ eligible: true }));
    const selector = artifact.abi.find((fn) => fn.name === 'publish')?.selector;
    expect(selector).toBeDefined();
    // Cheap admission skips ordinary entry-point bodies; the binder pass must still emit them.
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!].length).toBeGreaterThan(0);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).not.toBe(true);
    const delegate = artifact.delegateArtifact;
    expect(delegate).toBeDefined();
    const delegateSelector = delegate!.abi.find((fn) => fn.name === 'publish')?.selector;
    expect(delegateSelector).toBeDefined();
    expect(delegate!.functionBodies?.[delegateSelector!]).toBeTypeOf('string');
    expect(delegate!.functionBodies![delegateSelector!].length).toBeGreaterThan(0);
    expect(delegate!.compiler.options?.__cheapAdmissionCodegen).not.toBe(true);
  });
});
