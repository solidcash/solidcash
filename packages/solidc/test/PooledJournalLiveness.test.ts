import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

describe('pooled collection journal liveness', () => {
  it('keeps a mapping value live through chained library calls and a later field read', () => {
    const source = `pragma solidity ^0.8.20;
      library Math {
        function mul(uint256 a, uint256 b) internal pure returns (uint256) { return a * b; }
        function div(uint256 a, uint256 b) internal pure returns (uint256) { return a / b; }
        function sub(uint256 a, uint256 b) internal pure returns (uint256) { return a - b; }
      }
      interface IAsset {
        function balanceOf(address owner) external view returns (uint256);
      }
      contract Journal {
        using Math for uint256;
        struct User { uint256 amount; uint256 debt; }
        mapping(uint256 => mapping(address => User)) public userInfo;
        address public asset;

        function initialize(address a) public { this.asset = a; }
        function pending(uint256 key, address who) public view returns (uint256) {
          User storage user = userInfo[key][who];
          uint256 supply = IAsset(asset).balanceOf(address(this));
          return user.amount.mul(supply).div(100).sub(user.debt);
        }
        function emergency(uint256 key) public {
          User storage user = userInfo[key][msg.sender];
          user.amount = 0;
          require(true);
        }
      }`;
    const artifact = compileString(source, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 100_000,
      suppressWarnings: true,
    });

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pending'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });
});
