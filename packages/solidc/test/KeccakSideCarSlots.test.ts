import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

/**
 * keccak256 side-car slot accounting:
 * 1. A stateful route's row loop is a transport loop (codegen reads fixed slots under it), so a hashing handler
 *    inlined there must not flag the route keccakInLoop and drop the fixed slots its clones read. The ladder must
 *    also publish the artifact it returns against that artifact's own admission analysis.
 * 2. Straight-line calls beside a runtime keccak loop reserve one fixed slot each, at their emission index.
 */

interface AbiRow {
  name: string;
  keccakInLoop?: boolean;
  keccakPreimageParams?: (string | null)[];
  blockLayout?: { blockSize: number; slots: { kind: string; slotIndex?: number }[] };
}

interface BusArtifact {
  abi: AbiRow[];
  messageBus?: {
    route: AbiRow;
    handlers: { name: string; eligible?: boolean }[];
    admittedHandlerIds?: readonly string[];
  };
}

const sideCarSlots = (row: AbiRow | undefined): (number | undefined)[] => (row?.blockLayout?.slots ?? [])
  .filter((slot) => slot.kind === 'keccakSideCar').map((slot) => slot.slotIndex);

/**
 * The default-on message-bus route, as a bench compile gets it (direct-compile disables it by default). Auto mode
 * keeps the route only for a contract with a graph edge, hence the low-level value call in each route fixture.
 */
const compileWithRoute = (source: string): BusArtifact => compileString(source, {
  evmCompat: true, messageBus: undefined,
}) as unknown as BusArtifact;

const ROUTE_HASHING_HELPER = `
pragma solidity ^0.8.26;
contract Ledger {
    address[2] public keepers;

    constructor(address[2] memory _keepers) payable {
        keepers = _keepers;
    }

    function topUp() external payable {}

    function record(address to, uint256 amount) external {
        bytes32 digest = digestOf(to, amount);
        require(digest != bytes32(0), "zero digest");
        (bool sent,) = to.call{value: amount}("");
        require(sent, "send failed");
    }

    function digestOf(address to, uint256 amount) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(to, amount));
    }
}
`;

const ROUTE_HASHING_LOOP = `
pragma solidity ^0.8.26;
contract Vault {
    address public keeper;

    constructor(address _keeper) {
        keeper = _keeper;
    }

    function topUp() external payable {}

    function pay(address to, uint256 amount) external {
        (bool sent,) = to.call{value: amount}("");
        require(sent, "send failed");
    }

    function fold(bytes32[] memory leaves) public pure returns (bytes32 acc) {
        for (uint256 i = 0; i < leaves.length; i++) {
            acc = keccak256(abi.encodePacked(acc, leaves[i]));
        }
    }
}
`;

const FIXED_AND_RUNTIME_LOOP = `
pragma solidity ^0.8.26;
contract DigestTree {
    bytes32[] public nodes;

    constructor() {
        string[2] memory leaves = ["left leaf", "right leaf"];
        for (uint256 i = 0; i < leaves.length; i++) {
            nodes.push(keccak256(abi.encodePacked(leaves[i])));
        }
        uint256 n = leaves.length;
        uint256 offset = 0;
        while (n > 1) {
            for (uint256 i = 0; i < n; i += 2) {
                bytes32 left = nodes[offset + i];
                bytes32 right;
                if (i + 1 < n) {
                    right = nodes[offset + i + 1];
                } else {
                    right = left;
                }
                nodes.push(keccak256(abi.encodePacked(left, right)));
            }
            offset += n;
            n = (n + 1) / 2;
        }
    }

    function root() public view returns (bytes32) {
        return nodes[nodes.length - 1];
    }
}
`;

/** Every handler the route publishes as eligible must be in the admission analysis it was stamped with. */
function expectPublishedMatchesAdmission(artifact: BusArtifact): void {
  const bus = artifact.messageBus;
  if (bus === undefined) return;
  for (const handler of bus.handlers) {
    if (handler.eligible === true) expect(bus.admittedHandlerIds ?? []).toContain(handler.name);
  }
}

describe('keccak256 side-car slots: a stateful route row loop is a transport loop', () => {
  it('a hashing public helper called from an external handler compiles, and the route keeps fixed slots', () => {
    const artifact = compileWithRoute(ROUTE_HASHING_HELPER);
    expectPublishedMatchesAdmission(artifact);
    const bus = artifact.messageBus;
    expect(bus, 'the route was dropped').toBeDefined();
    const eligible = bus!.handlers.filter((handler) => handler.eligible === true).map((handler) => handler.name);
    expect(eligible).toEqual(expect.arrayContaining(['topUp', 'digestOf']));
    expect(bus!.route.keccakInLoop).toBeFalsy();
    expect(sideCarSlots(bus!.route).length).toBeGreaterThan(0);
  });

  it('a refused hashing handler leaves the effect-free external handler consistent with the admission stamp', () => {
    const artifact = compileWithRoute(ROUTE_HASHING_LOOP);
    expect(artifact.messageBus, 'the route was dropped').toBeDefined();
    expectPublishedMatchesAdmission(artifact);
  });
});

describe('keccak256 side-car slots: straight-line calls beside a runtime keccak loop', () => {
  it('the unrolled calls reserve fixed slots at their emission indices; the loop call takes none', () => {
    const artifact = compileString(FIXED_AND_RUNTIME_LOOP, { evmCompat: true }) as unknown as BusArtifact;
    const constructor = artifact.abi.find((row) => row.name === '__construct');
    expect(constructor?.keccakInLoop).toBe(true);
    expect(constructor?.keccakPreimageParams).toHaveLength(3);
    expect(sideCarSlots(constructor)).toEqual([0, 1]);
  });
});
