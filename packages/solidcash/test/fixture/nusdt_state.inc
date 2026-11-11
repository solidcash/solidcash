// SHARED STATE LAYOUT - authoritative copy.
//
// Every facet library and the proxy master MUST declare these state variables in
// exactly this order. A delegate library writes the CALLER's state by slot, so a
// divergent layout writes the wrong field; the SDK refuses to build a
// delegatecall whose layouts differ (see LibraryDelegate.test.ts "rejects a
// caller whose state layout does not match the library"). NativeUsdt.test.ts
// asserts every facet's stateLayout is identical to the master's, so a future
// edit to one file that is not mirrored into the others fails the suite rather
// than corrupting state at runtime.
//
// This file is documentation, not an include directive - SolidCash libraries
// cannot inherit (`library X is Base` is not grammatical; only contracts can
// inherit), so the block below is duplicated verbatim into each .scash file.
//
// The order is a size decision, measured across the master and facets: the fields the
// reserve paths read pack into one data NFT, so those entries co-spend fewer of them.

    bool paused;
    bool deprecated;
    bool backingSet;
    bytes32 backingCategory;
    int containerSeen;
    int backedSupply;
    int clock;
    int quarantineBlocks;
    address owner;
    uint8 decimals;
    int totalSupply;
    bytes32 name;
    bytes32 symbol;
    address upgradedAddress;
    bool initialized;
    mapping(address => int) balances;
    mapping(address => mapping(address => uint256)) allowed;
    mapping(address => bool) isBlackListed;
    mapping(address => bool) frozen;
    mapping(address => int) pendingAmount;
    mapping(address => int) pendingUnlockAt;
