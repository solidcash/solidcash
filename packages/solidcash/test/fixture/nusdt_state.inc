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

    address owner;
    int totalSupply;
    mapping(address => int) balances;
    int basisPointsRate;
    int maximumFee;
    int feeAccrued;
    mapping(address => mapping(address => int)) allowed;
    bool paused;
    mapping(address => bool) isBlackListed;
    bytes32 name;
    bytes32 symbol;
    uint8 decimals;
    bool deprecated;
    address upgradedAddress;
    mapping(address => bool) frozen;
    mapping(address => int) pendingAmount;
    mapping(address => int) pendingUnlockAt;
    int quarantineBlocks;
    bytes32 backingCategory;
    bool backingSet;
    int containerSeen;
    int backedSupply;
    int clock;
