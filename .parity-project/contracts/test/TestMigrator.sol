// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface ITestPairForMigrator {
    function mint(address to) external returns (uint liquidity);
}

contract TestMigrator {
    uint public desired;

    function setDesired(uint _desired) external {
        desired = _desired;
    }

    function desiredLiquidity() external view returns (uint) {
        return desired;
    }

    function mint(address pair, address to) external returns (uint) {
        return ITestPairForMigrator(pair).mint(to);
    }
}
