// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

// Token whose mutating methods return no data, like USDT-style tokens.
contract TestNoReturnERC20 {
    string public name = 'No Return Token';
    string public symbol = 'NRT';
    uint8 public constant decimals = 18;
    uint public totalSupply;
    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    function mint(address to, uint value) external {
        totalSupply += value;
        balanceOf[to] += value;
    }

    function approve(address spender, uint value) external {
        allowance[msg.sender][spender] = value;
    }

    function transfer(address to, uint value) external {
        require(balanceOf[msg.sender] >= value, 'NRT: BALANCE');
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
    }

    // BCH parity helpers: one call answers both the transfer and the caller's resulting balance.
    function transferAndBalance(address to, uint value) external returns (uint) {
        uint balance = balanceOf[msg.sender];
        require(balance >= value, 'NRT: BALANCE');
        balanceOf[msg.sender] = balance - value;
        balanceOf[to] += value;
        return balance - value;
    }

    function skimTo(address to, uint floor) external returns (uint excess) {
        uint balance = balanceOf[msg.sender];
        if (balance > floor) {
            excess = balance - floor;
            balanceOf[msg.sender] = balance - excess;
            balanceOf[to] += excess;
        }
    }

    function transferFrom(address from, address to, uint value) external {
        require(balanceOf[from] >= value, 'NRT: BALANCE');
        if (from != msg.sender && allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= value, 'NRT: ALLOWANCE');
            allowance[from][msg.sender] -= value;
        }
        balanceOf[from] -= value;
        balanceOf[to] += value;
    }
}
