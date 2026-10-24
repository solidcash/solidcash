// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface ITestPair {
    function initialize(address token0, address token1) external;
}

// Minimal factory used by tests. It deploys a fixed pair creation code so that
// CREATE2 addresses stay stable when coverage instrumentation rewrites the
// compiled production contracts.
contract TestFactory {
    bytes public pairCode;
    address public feeTo;
    address public migrator;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    constructor(bytes memory _pairCode) {
        pairCode = _pairCode;
        feeToSetter = msg.sender;
    }

    function factory() external view returns (address) {
        return address(this);
    }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    function pairCodeHash() external view returns (bytes32) {
        return keccak256(pairCode);
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, 'TestFactory: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setMigrator(address _migrator) external {
        require(msg.sender == feeToSetter, 'TestFactory: FORBIDDEN');
        migrator = _migrator;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'TestFactory: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'TestFactory: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'TestFactory: PAIR_EXISTS');

        bytes memory code = pairCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(code, 32), mload(code), salt)
        }
        require(pair != address(0), 'TestFactory: CREATE2_FAILED');
        ITestPair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
}
