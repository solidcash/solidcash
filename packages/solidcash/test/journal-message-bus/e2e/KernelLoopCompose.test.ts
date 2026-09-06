import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, hexToBin, sha256,
} from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, SignatureAlgorithm, SignatureTemplate, StatefulContract, messageBus,
} from '../../../src/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { decodeKernelEntryJournalAccesses } from '../../../src/stateful/KernelEntryJournal.js';
import {
  getEntryNftAddress, getSatoshiContainerAddress, getTokenContainerAddress,
} from '../../../src/stateful/covenant-helpers.js';
import {
  createBareP2pkhFeeFunder, createTestProvider, genesisFtContainer, setupStatefulUtxos,
} from '../../test-util.js';
import { alicePriv, alicePub, bobPriv, bobPub } from '../../fixture/vars.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;
const KERNEL_ROUTE_DENSITY_RESERVE_BYTES = 520;

const SOURCE = `pragma solidcash ^0.13.0;
contract KernelAcc() {
  int x;
  function bump(int n) internal { this.x = this.x + n; }
  function add(int n) public {
    bump(n);
    require(true);
  }
  function inspect() public {
    assembly {
      OP_TXVERSION OP_2 OP_NUMEQUALVERIFY
      OP_INPUTINDEX OP_DROP
      OP_TXOUTPUTCOUNT OP_DROP
      OP_0 OP_UTXOVALUE OP_DROP
      OP_7 OP_0 OP_PICK OP_NUMEQUALVERIFY
      OP_TXVERSION OP_2 OP_NUMEQUAL
      OP_IF OP_9 OP_DROP OP_ELSE OP_10 OP_DROP OP_ENDIF
      OP_3 OP_BEGIN OP_1SUB OP_DUP OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP
    }
    require(true);
  }
  function check(int expected) public { require(this.x == expected); }
}`;

const COUNTER_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMapping() {
  mapping(int => int) m;
  function write(int n, int value) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = value;
    }
    require(true);
  }
  function clear(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      delete this.m[i];
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const SAME_MAPPING_FIXED_READ_SOURCE = `pragma solidcash ^0.13.0;
contract KernelSameMappingFixedRead() {
  mapping(int => int) m;
  function seed(int key, int value) public { this.m[key] = value; require(true); }
  function write(int n, int source) public {
    int base = this.m[source];
    for (int i = 0; i < n; i = i + 1) { this.m[i] = base + i; }
    require(true);
  }
  function copy(int n, int offset) public {
    for (int i = 0; i < n; i = i + 1) { this.m[i] = this.m[i + offset] + 1; }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const COUNTER_MAPPING_ARRAY_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMappingArray() {
  mapping(int => int[]) values;
  function pushMany(int n, int value) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i].push(value); }
    require(true);
  }
  function setMany(int n, int index, int value) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i][index] = value; }
    require(true);
  }
}`;

const COUNTER_MAPPING_ARRAY_POP_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMappingArrayPop() {
  mapping(int => int[]) values;
  function pushMany(int n, int value) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i].push(value); }
    require(true);
  }
  function popMany(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i].pop(); }
    require(true);
  }
}`;

const COUNTER_MAPPING_ARRAY_CHUNK_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMappingArrayChunk() {
  mapping(int => bytes32[]) values;
  function pushMany(int n, bytes32 value) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i].push(value); }
    require(true);
  }
}`;

const COUNTER_MAPPING_ARRAY_VALUES_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMappingArrayValues() {
  mapping(int => int[]) values;
  function pushEach(int n, int[] additions) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i].push(additions[i]); }
    require(true);
  }
  function pushExpression(int n, int base) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i].push(base + i * 2); }
    require(true);
  }
}`;

const COUNTER_MAPPING_ARRAY_DUPLICATE_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMappingArrayDuplicate() {
  mapping(int => int[]) values;
  function pushAliased(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i % 2].push(i); }
    require(true);
  }
}`;

const COUNTER_MAPPING_ARRAY_DUPLICATE_CHUNK_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMappingArrayDuplicateChunk() {
  mapping(int => bytes32[]) values;
  function pushAliased(int n, bytes32 value) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i % 1].push(value); }
    require(true);
  }
}`;

const AFFINE_COUNTER_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelAffineCounterMapping() {
  mapping(int => int) m;
  function writeAffine(int n, int value) public {
    int requested = n;
    int intermediate = requested - 2;
    int limit = 1 + intermediate;
    for (int i = 1; i < limit; i = i + 2) { this.m[i] = value; }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const EXACT_COUNTER_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelExactCounterMapping() {
  mapping(int => int) m;
  function writeAscending(bool active, int bound, int stride, int value) public {
    if (active) {
      for (int i = 1; i != bound; i = i + stride) { this.m[i] = value; }
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const REASSIGNED_BOUND_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelReassignedBoundMapping() {
  mapping(int => int) m;
  function writeParam(int n, int value) public {
    n = n - 1;
    for (int i = 0; i < n; i = i + 1) { this.m[i] = value; }
    require(true);
  }
  function writeLocal(int n, int value) public {
    int limit = n;
    limit = limit - 2;
    for (int i = 0; i < limit; i = i + 1) { this.m[i] = value; }
    require(true);
  }
  function writeConditional(int n, int value, bool trim) public {
    if (trim) { n = n - 1; }
    for (int i = 0; i < n; i = i + 1) { this.m[i] = value; }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const AFFINE_COUNTER_VALUE_SOURCE = `pragma solidcash ^0.13.0;
contract KernelAffineCounterValue() {
  mapping(int => int) m;
  function write(int n, int amount) public {
    int running = 4;
    for (int i = 0; i < n; i = i + 1) {
      running = running + amount;
      running = running - 1;
      this.m[i] = running;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const EFFECTFUL_HELPER_VALUE_SOURCE = `pragma solidcash ^0.13.0;
contract KernelEffectfulHelperValue() {
  mapping(int => int) m;
  int calls;
  function next(int value) internal returns (int) {
    this.calls = this.calls + 1;
    return value;
  }
  function write(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.m[i] = next(i + 10); }
    require(true);
  }
  function check(int key, int expected, int expectedCalls) public {
    require(this.m[key] == expected && this.calls == expectedCalls);
  }
}`;

const DISJOINT_RUNTIME_VALUE_ROWS_SOURCE = `pragma solidcash ^0.13.0;
contract KernelDisjointRuntimeValueRows() {
  struct Pair { int first; int second; }
  mapping(int => Pair) left;
  mapping(int => Pair) right;
  mapping(int => Pair) shared;
  function seedLeft(int key, int first, int second) public {
    this.left[key] = Pair(first, second); require(true);
  }
  function seedRight(int key, int first, int second) public {
    this.right[key] = Pair(first, second); require(true);
  }
  function seedShared(int key, int first, int second) public {
    this.shared[key] = Pair(first, second); require(true);
  }
  function updateLeft(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      Pair value = this.left[i];
      value.first = value.first + 10;
      value.second = value.second + 20;
      this.left[i] = value;
    }
    require(true);
  }
  function updateRight(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      Pair value = this.right[i];
      value.first = value.first + 30;
      value.second = value.second + 40;
      this.right[i] = value;
    }
    require(true);
  }
  function updateSharedLow(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      Pair value = this.shared[i];
      value.first = value.first + 50;
      value.second = value.second + 60;
      this.shared[i] = value;
    }
    require(true);
  }
  function updateSharedHigh(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      Pair value = this.shared[i + 2];
      value.first = value.first + 70;
      value.second = value.second + 80;
      this.shared[i + 2] = value;
    }
    require(true);
  }
  function checkLeft(int key, int first, int second) public {
    require(this.left[key].first == first); require(this.left[key].second == second); require(true);
  }
  function checkRight(int key, int first, int second) public {
    require(this.right[key].first == first); require(this.right[key].second == second); require(true);
  }
  function checkShared(int key, int first, int second) public {
    require(this.shared[key].first == first); require(this.shared[key].second == second); require(true);
  }
}`;

const TRACED_COUNTER_VALUE_SOURCE = `pragma solidcash ^0.13.0;
contract KernelTracedCounterValue() {
  mapping(int => int) m;
  function writeRetained(int n, int base) public {
    int next = 0;
    for (int i = 0; i < n; i = i + 1) {
      if (i % 2 == 0) { next = base + i; }
      this.m[i] = next;
    }
    require(true);
  }
  function writeSelfDependent(int n, int base) public {
    int next = 0;
    for (int i = 0; i < n; i = i + 1) {
      if (i % 2 == 0) { next = next + 1; }
      else { next = base + i; }
      this.m[i] = next;
    }
    require(true);
  }
  function writeAfter(int n) public {
    int next = 2;
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = next;
      if (i % 2 == 0) { next = next + 3; }
    }
    require(true);
  }
  function writeSelected(int n) public {
    int next = 1;
    for (int i = 0; i < n; i = i + 1) {
      if (i % 2 == 0) { next = next + 2; }
      if (i % 3 != 0) { this.m[i] = next; }
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const COUNTER_MAPPING_READ_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMappingRead() {
  struct Rec { int left; bytes payload; }
  mapping(int => int) source;
  mapping(int => int) second;
  mapping(int => int) destination;
  mapping(int => bytes20) rawSource;
  mapping(int => bytes20) rawDestination;
  mapping(int => bytes) blobSource;
  mapping(int => bytes) blobDestination;
  mapping(int => Rec) recSource;
  mapping(int => Rec) recDestination;
  function seed(int key, int value) public { this.source[key] = value; require(true); }
  function seedSecond(int key, int value) public { this.second[key] = value; require(true); }
  function copy(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.destination[i] = this.source[i]; }
    require(true);
  }
  function combine(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.destination[i] = this.source[i] + this.second[i];
    }
    require(true);
  }
  function shifted(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.destination[i] = this.source[i + 1];
    }
    require(true);
  }
  function seedRaw(int key, bytes20 value) public { this.rawSource[key] = value; require(true); }
  function copyRaw(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.rawDestination[i] = this.rawSource[i]; }
    require(true);
  }
  function checkSource(int key, int expected) public { require(this.source[key] == expected); }
  function checkSecond(int key, int expected) public { require(this.second[key] == expected); }
  function checkDestination(int key, int expected) public { require(this.destination[key] == expected); }
  function checkRaw(int key, bytes20 expected) public { require(this.rawDestination[key] == expected); }
  function seedBlob(int key, bytes value) public { this.blobSource[key] = value; require(true); }
  function copyBlob(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.blobDestination[i] = this.blobSource[i + 1]; }
    require(true);
  }
  function checkBlob(int key, bytes expected) public {
    require(this.blobDestination[key] == expected && this.blobSource[key + 1] == expected);
  }
  function seedRec(int key, int left, bytes payload) public {
    this.recSource[key] = Rec(left, payload);
    require(true);
  }
  function copyRec(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.recDestination[i] = this.recSource[i + 1]; }
    require(true);
  }
  function checkRec(int key, int left, bytes payload) public {
    require(this.recDestination[key].left == left && this.recDestination[key].payload == payload);
    require(this.recSource[key + 1].left == left && this.recSource[key + 1].payload == payload);
  }
}`;

const PARAMETER_ARRAY_MAPPING_READ_SOURCE = `pragma solidcash ^0.13.0;
event Copied(int key);
contract KernelParameterArrayMappingRead() {
  mapping(int => int) source;
  mapping(int => int) destination;
  function seed(int key, int value) public { this.source[key] = value; require(true); }
  function copy(int[] keys) public {
    for (int i = 0; i < int(keys.length); i = i + 1) {
      this.destination[keys[i]] = this.source[keys[i]];
      emit Copied(keys[i]);
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.destination[key] == expected); }
}`;

const PARAMETER_ARRAY_VALUE_SOURCE = `pragma solidcash ^0.13.0;
event Applied(int key, bytes32 digest);
contract KernelParameterArrayValue() {
  mapping(int => bytes) values;
  function fill(int[] keys, bytes[] payloads) public {
    for (int i = 0; i < int(keys.length); i = i + 1) {
      this.values[keys[i]] = payloads[i];
      emit Applied(keys[i], sha256(payloads[i]));
    }
    require(true);
  }
  function check(int key, bytes expected) public { require(this.values[key] == expected); }
}`;

const AFFINE_COUNTER_STATE_VALUE_SOURCE = `pragma solidcash ^0.13.0;
contract KernelAffineCounterStateValue() {
  int total;
  mapping(int => int) m;
  function write(int n, int amount) public {
    for (int i = 0; i < n; i = i + 1) {
      this.total = this.total + amount;
      this.m[i] = this.total;
    }
    require(true);
  }
}`;

const COUNTER_MAPPING_RMW_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMappingRmw() {
  mapping(int => int) m;
  function credit(int n, int amount) public {
    int requested = n;
    int limit = requested;
    for (int i = 1; i < limit; i = i + 2) {
      this.m[i] = this.m[i] + amount;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const SOLE_FUNCTION_SOURCE = `pragma solidcash ^0.13.0;
contract KernelSoleFunction() {
  int x;
  function set(int value) public { this.x = value; require(true); }
}`;

const NESTED_MULTI_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelNestedMultiMapping() {
  mapping(int => mapping(int => int)) a;
  mapping(int => mapping(int => int)) b;
  function write(int aPrefix, int bPrefix, int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.a[aPrefix][i] = i + 10;
      this.b[bPrefix][i] = i + 20;
    }
    require(true);
  }
}`;

const SELECTED_MULTI_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelSelectedMultiMapping() {
  mapping(int => mapping(int => int)) a;
  mapping(int => mapping(int => int)) b;
  function write(int aPrefix, int bPrefix, int n) public {
    for (int i = 0; i < n; i = i + 1) {
      if (i % 2 == 0) this.a[aPrefix][i] = i + 10;
      if (i % 2 != 0) this.b[bPrefix][i] = i + 20;
    }
    require(true);
  }
}`;

const REPEATED_COUNTER_KEY_SOURCE = `pragma solidcash ^0.13.0;
contract KernelRepeatedCounterKey() {
  mapping(int => mapping(int => mapping(int => int))) nested;
  function write(int scope, int n) public {
    for (int i = 0; i < n; i = i + 1) { this.nested[i][scope][i] = i + 10; }
    require(true);
  }
  function transform(int scope, int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.nested[i][scope][i] = max(this.nested[i][scope][i] * 2, this.nested[i][scope][i] + i + 5);
    }
    require(true);
  }
}`;

const DERIVED_COUNTER_KEY_SOURCE = `pragma solidcash ^0.13.0;
contract KernelDerivedCounterKey() {
  mapping(int => mapping(int => int)) nested;
  function write(int bound) public {
    for (int i = 3; i < bound; i = i + 2) { this.nested[i + 1][i] = i + 10; }
    require(true);
  }
}`;

const SEQUENTIAL_MULTI_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelSequentialMultiMapping() {
  mapping(int => int) a;
  mapping(int => int) b;
  function writeBoth(int left, int right) public {
    for (int i = 0; i < left; i = i + 1) {
      this.a[i] = i + 10;
    }
    for (int j = 2; j < right; j = j + 2) {
      this.b[j] = j + 20;
    }
    require(true);
  }
  function checkA(int key, int expected) public { require(this.a[key] == expected); }
  function checkB(int key, int expected) public { require(this.b[key] == expected); }
}`;

const COUNTER_MAPPING_EVENT_SOURCE = `pragma solidcash ^0.13.0;
event Before(int i);
event Hit(int i);
event Echo(int i) anonymous;
event After(int i);
contract KernelCounterMappingEvent() {
  mapping(int => int) m;
  function write(int n) public {
    emit Before(n);
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 10;
      emit Hit(i);
      emit Echo(i);
    }
    emit After(n);
    require(true);
  }
}`;

const EFFECTFUL_EVENT_ARGUMENT_SOURCE = `pragma solidcash ^0.13.0;
event Hit(int value);
contract KernelEffectfulEventArgument() {
  int calls;
  mapping(int => int) values;
  function next(int value) internal returns (int) {
    this.calls = this.calls + 1;
    return value * 10 + this.calls;
  }
  function write(int count) public {
    for (int i = 0; i < count; i = i + 1) {
      this.values[i] = i + 10;
      emit Hit(next(i));
    }
    require(true);
  }
}`;

const EFFECTFUL_TRANSFER_ARGUMENT_SOURCE = `pragma solidcash ^0.13.0;
contract KernelEffectfulTransferArgument() {
  int calls;
  mapping(int => int) values;
  function nextAmount(int value) internal returns (int) {
    this.calls = this.calls + 1;
    return 2000 + value * 10 + this.calls;
  }
  function pay(int count, bytes recipient) public {
    for (int i = 0; i < count; i = i + 1) {
      this.values[i] = i + 10;
      this.transfer(recipient, nextAmount(i));
    }
    require(true);
  }
}`;

const CONDITIONAL_COUNTER_EVENT_SOURCE = `pragma solidcash ^0.13.0;
event Hit(int i);
contract KernelConditionalCounterEvent() {
  mapping(int => int) m;
  function write(int n, bool enabled, bool oddsOnly) public {
    if (enabled) emit Hit(-1);
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 10;
      if (enabled && (!oddsOnly || i % 2 == 1)) emit Hit(i);
    }
    if (!enabled) emit Hit(-2);
    require(true);
  }
}`;

const COUNTER_MAPPING_TRANSFER_SOURCE = `pragma solidcash ^0.13.0;
event Mark(int value);
contract KernelCounterMappingTransfer() {
  mapping(int => int) m;
  mapping(int => int) conditional;
  mapping(int => int) mixed;
  function pay(int n, bytes recipient) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 10;
      this.transfer(recipient, 2000 + i);
    }
    require(true);
  }
  function payPaths(int n, bytes recipient) public {
    for (int i = 0; i < n; i = i + 1) {
      this.conditional[i] = i + 20;
      if (i % 2 == 1) this.transfer(recipient, 3000 + i);
      this.transfer(recipient, 4000 + i);
    }
    require(true);
  }
  function payMixed(int n, bytes recipient) public {
    for (int i = 0; i < n; i = i + 1) {
      this.mixed[i] = i + 30;
      emit Mark(100 + i);
      this.transfer(recipient, 5000 + i);
      emit Mark(200 + i);
    }
    require(true);
  }
}`;

const RUNTIME_TOKEN_TRANSFER_SOURCE = `pragma solidcash ^0.13.0;
contract KernelRuntimeTokenTransfer() {
  mapping(int => int) rows;
  mapping(int => int) otherRows;
  function pay(int n, bytes32 category, bytes recipient) public {
    for (int i = 0; i < n; i = i + 1) {
      this.rows[i] = i + 1;
      this.tokens[category].transfer(recipient, 2 + i);
    }
    require(true);
  }
  function payAt(int base, int n, bytes32 category, bytes recipient) public {
    for (int i = 0; i < n; i = i + 1) {
      this.rows[base + i] = i + 1;
      this.tokens[category].transfer(recipient, 2 + i);
    }
    require(true);
  }
  function payOther(int n, bytes32 category, bytes recipient) public {
    for (int i = 0; i < n; i = i + 1) {
      this.otherRows[i] = i + 1;
      this.tokens[category].transfer(recipient, 2 + i);
    }
    require(true);
  }
}`;

const RUNTIME_NFT_TRANSFER_SOURCE = `pragma solidcash ^0.13.0;
contract KernelRuntimeNftTransfer() {
  mapping(int => int) rows;
  function send(int n, bytes32 category, bytes recipient, bytes commitment, int capability) public {
    for (int i = 0; i < n; i = i + 1) {
      this.rows[i] = i + 1;
      this.tokens[category].transferNft(recipient, commitment, capability);
    }
    require(true);
  }
}`;

const CONDITIONAL_RUNTIME_NFT_TRANSFER_SOURCE = `pragma solidcash ^0.13.0;
contract KernelConditionalRuntimeNftTransfer() {
  mapping(int => int) rows;
  function split(
    int n, bytes32 evenCategory, bytes32 oddCategory, bytes evenRecipient, bytes oddRecipient, bytes commitment
  ) public {
    for (int i = 0; i < n; i = i + 1) {
      this.rows[i] = i + 1;
      if (i % 2 == 0) this.tokens[evenCategory].transferNft(evenRecipient, commitment, 0);
      else this.tokens[oddCategory].transferNft(oddRecipient, commitment, 0);
    }
    require(true);
  }
}`;

const EFFECTFUL_TOKEN_TRANSFER_ARGUMENT_SOURCE = `pragma solidcash ^0.13.0;
contract KernelEffectfulTokenTransferArgument() {
  int calls;
  mapping(int => int) rows;
  function nextAmount(int value) internal returns (int) {
    this.calls = this.calls + 1;
    return 2 + value + this.calls;
  }
  function pay(int count, bytes32 category, bytes recipient) public {
    for (int i = 0; i < count; i = i + 1) {
      this.rows[i] = i + 1;
      this.tokens[category].transfer(recipient, nextAmount(i));
    }
    require(true);
  }
}`;

const CONDITIONAL_RUNTIME_TOKEN_TRANSFER_SOURCE = `pragma solidcash ^0.13.0;
contract KernelConditionalRuntimeTokenTransfer() {
  mapping(int => int) rows;
  function split(int n, bytes32 evenCategory, bytes32 oddCategory, bytes evenRecipient, bytes oddRecipient) public {
    for (int i = 0; i < n; i = i + 1) {
      this.rows[i] = i + 1;
      if (i % 2 == 0) {
        this.tokens[evenCategory].transfer(evenRecipient, i + 1);
      } else {
        this.tokens[oddCategory].transfer(oddRecipient, i + 1);
      }
    }
    require(true);
  }
}`;

const CONDITIONAL_COUNTER_LOOP_SOURCE = `pragma solidcash ^0.13.0;
event Hit(int i);
contract KernelConditionalCounterLoop() {
  bool gate;
  mapping(int => int) m;
  mapping(int => bool) scopedGate;
  mapping(int => int) scoped;
  function write(int n, bool enabled) public {
    if (enabled && this.gate) {
      for (int i = 0; i < n; i = i + 1) {
        this.m[i] = i + 10;
        emit Hit(i);
      }
    }
    require(true);
  }
  function setScopedGate(int scope, bool enabled) public {
    this.scopedGate[scope] = enabled;
    require(true);
  }
  function writeScoped(int n, int scope, bool enabled) public {
    if (enabled && this.scopedGate[scope]) {
      for (int i = 0; i < n; i = i + 1) { this.scoped[i] = scope + i; }
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
  function checkScoped(int key, int expected) public { require(this.scoped[key] == expected); }
}`;

const SELECTED_COUNTER_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
event Selected(int i);
event Visited(int i);
contract KernelSelectedCounterMapping() {
  mapping(int => int) m;
  mapping(int => int) whileRest;
  mapping(uint => uint) u;
  mapping(int => int) totals;
  mapping(bytes32 => int) hashedTotals;
  mapping(int => mapping(bytes32 => int)) nestedTotals;
  function write(int n, int ceiling) public {
    for (int i = 0; i < n; i = i + 1) {
      bool selected = i < ceiling;
      if (selected) {
        this.m[i] = i + 10;
        emit Selected(i);
      }
    }
    require(true);
  }
  function writeOdds(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      emit Visited(i + 100);
      if (i % 2 == 0) continue;
      this.m[i] = i + 30;
      emit Selected(i);
    }
    require(true);
  }
  function writeWhileSplit(int n) public {
    int i = 0;
    while (i < n) {
      if (i % 2 == 0) { this.m[i] = i + 130; i++; continue; }
      this.whileRest[i] = i + 230;
      i++;
    }
    require(true);
  }
  function writeDoWhileSplit(int n) public {
    int i = 0;
    do {
      if (i % 2 == 0) { this.m[i] = i + 330; ++i; continue; }
      this.whileRest[i] = i + 330;
      ++i;
    } while (i < n);
    require(true);
  }
  function writeUntil(int n, int stop) public {
    for (int i = 0; i < n; i = i + 1) {
      emit Visited(i + 200);
      this.m[i] = i + 40;
      if (i == stop) break;
    }
    require(true);
  }
  function writeVoidReturn(int n, int stop) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 60;
      if (i == stop) return;
    }
    require(true);
  }
  function writeReturn(int n, int stop) public returns (int) {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 70;
      if (i == stop) return i;
    }
    require(true);
    return n;
  }
  function writeSwitch(int n, int choice) public {
    switch (choice) {
      case 1: {
        for (int i = 0; i < n; i = i + 1) { this.m[i] = i + 80; }
        break;
      }
      default: {
        for (int j = 0; j < n; j = j + 1) { this.m[j] = j + 90; }
        break;
      }
    }
    require(true);
  }
  function writeInnerSwitch(int n, int choice) public {
    for (int i = 0; i < n; i = i + 1) {
      switch (choice) {
        case 1: this.m[i] = i + 100; emit Visited(i + 300); break;
        default: this.m[i] = i + 110; emit Visited(i + 400); break;
      }
    }
    require(true);
  }
  function writeUnsigned(uint n) public {
    for (uint i = 0; i < n; i = i + 1) { this.u[i] = i + 500; }
    require(true);
  }
  function writeComputed(int n, int scale) public {
    int limit = n * scale;
    for (int i = 0; i < limit; i = i + 1) { this.m[i] = i + 600; }
    require(true);
  }
  function writeMixed(int n, int owner) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 700;
      this.totals[owner] = i;
    }
    require(true);
  }
  function writeComputedKey(int n, bytes owner) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 800;
      this.hashedTotals[sha256(owner)] = i;
    }
    require(true);
  }
  function writeReassignedKey(int n, int owner) public {
    owner = owner + 5;
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 850;
      this.totals[owner] = i;
    }
    require(true);
  }
  function writeNestedInvariant(int n, int group, bytes owner) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 900;
      this.nestedTotals[group][sha256(owner)] = i;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
  function checkWhileRest(int key, int expected) public { require(this.whileRest[key] == expected); }
  function checkUnsigned(uint key, uint expected) public { require(this.u[key] == expected); }
  function checkTotal(int key, int expected) public { require(this.totals[key] == expected); }
  function checkHashedTotal(bytes owner, int expected) public {
    require(this.hashedTotals[sha256(owner)] == expected);
  }
  function checkNestedTotal(int group, bytes owner, int expected) public {
    require(this.nestedTotals[group][sha256(owner)] == expected);
  }
}`;

const INDEPENDENT_ROW_LOOP_SOURCE = `pragma solidcash ^0.13.0;
event ABefore(int n);
event AHit(int i);
event AAfter(int n);
event BBefore(int n);
event BHit(int i);
event BAfter(int n);
contract KernelIndependentRows() {
  mapping(int => int) a;
  mapping(int => int) b;
  function writeA(int n) public {
    emit ABefore(n);
    for (int i = 0; i < n; i = i + 1) { this.a[i] = i + 10; emit AHit(i); }
    emit AAfter(n);
    require(true);
  }
  function writeB(int n) public {
    emit BBefore(n);
    for (int i = 0; i < n; i = i + 1) { this.b[i] = i + 20; emit BHit(i); }
    emit BAfter(n);
    require(true);
  }
  function checkA(int key, int expected) public { require(this.a[key] == expected); }
  function checkB(int key, int expected) public { require(this.b[key] == expected); }
}`;

const DISJOINT_SAME_COLLECTION_ROWS_SOURCE = `pragma solidcash ^0.13.0;
contract KernelDisjointSameCollectionRows() {
  mapping(int => mapping(int => int)) values;
  event StepHit(int value);
  function seed(int group, int key, int value) public {
    this.values[group][key] = value;
    require(true);
  }
  function writeA(int n, int base) public {
    for (int i = 0; i < n; i = i + 1) { this.values[1][i] = base; }
    require(true);
  }
  function writeB(int n, int base) public {
    for (int i = 0; i < n; i = i + 1) { this.values[2][i] = base; }
    require(true);
  }
  function writeSequential(int left, int right) public {
    for (int i = 0; i < left; i = i + 1) { this.values[3][i] = 30; }
    for (int j = 10; j < right; j = j + 1) { this.values[3][j] = 31; }
    require(true);
  }
  function writeOverlap(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.values[4][i] = 40; }
    for (int j = 0; j < n; j = j + 1) { this.values[4][j] = 41; }
    require(true);
  }
  function writeDescending(int bound) public {
    for (int i = 3; i > bound; i = i - 1) { this.values[5][i] = i + 50; }
    require(true);
  }
  function writeAlias(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      int value = i + 60;
      this.values[6][i] = value;
    }
    require(true);
  }
  function transform(int group, int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.values[group][i] = max(this.values[group][i] * 2, this.values[group][i] + i + 5);
    }
    require(true);
  }
  function writeShapes(int n, int base) public {
    for (int i = 0; i < n; i = i + 1) {
      this.values[9][i * 2] = base + i;
      this.values[9][i * 2 + 1] = base + 10 + i;
    }
    require(true);
  }
  function writeConditionalLocal(int n, int base) public {
    int next = 0;
    bool take = false;
    for (int i = 0; i < n; i = i + 1) {
      if (i % 2 == 0) { next = base + i; take = true; }
      else { next = base + 10 + i; take = false; }
      if (take) this.values[10][i] = next;
    }
    require(true);
  }
  function writeNestedConditionalLocal(int n, int base) public {
    int next = 0;
    bool take = false;
    for (int i = 0; i < n; i = i + 1) {
      if (i % 2 == 0) {
        if (i % 4 == 0) { next = base + i; take = true; }
        else { next = base + 20 + i; take = false; }
      } else { next = base + 10 + i; take = true; }
      if (take) this.values[11][i] = next;
    }
    require(true);
  }
  function writeRuntimeStep(int n, int stride, int base) public {
    for (int i = 1; i < n; i = i + stride) {
      if (i % 3 != 0) { this.values[12][i] = base + i; }
      emit StepHit(i);
    }
    require(true);
  }
  function writeRuntimeStepDown(int n, int stride, int base) public {
    for (int i = 9; i > n; i = i - (stride + 1)) {
      this.values[13][i] = base + i;
    }
    require(true);
  }
  function writeInclusive(int bound, int base) public {
    for (int i = 1; bound >= i; i = 2 + i) { this.values[14][i] = base + i; }
    require(true);
  }
  function writeInclusiveDown(int bound, int base) public {
    for (int i = 5; bound <= i; i = i - 2) { this.values[15][i] = base + i; }
    require(true);
  }
  function writeWhile(int n, int stride, int base) public {
    int i = 1;
    while (n > i) { this.values[16][i] = base + i; i = stride + i; }
    require(true);
  }
  function check(int group, int key, int expected) public {
    require(this.values[group][key] == expected);
  }
}`;

const COUNTER_MAPPING_TYPED_CALLER_SOURCE = `pragma solidcash ^0.13.0;
interface IKernelCounterSink { function ping(int value); }
contract KernelCounterCaller(address sink) {
  mapping(int => int) m;
  function invoke(int n, int stride) public {
    stride = stride + 1;
    for (int i = 1; i < n; i = i + stride) {
      this.m[i] = i + 10;
      try IKernelCounterSink(sink).ping(i) { } catch { }
    }
    require(true);
  }
}`;

const COUNTER_MAPPING_TYPED_CALLEE_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterSink() {
  function ping(int value) public { require(value >= 0); }
}`;

const COUNTER_MAPPING_DO_TYPED_CALLER_SOURCE = `pragma solidcash ^0.13.0;
interface IKernelCounterSink { function ping(int value); }
contract KernelDoCounterCaller(address sink) {
  mapping(int => int) m;
  function invoke(int n) public {
    int i = 0;
    do {
      this.m[i] = i + 10;
      IKernelCounterSink(sink).ping(i);
      i = i + 1;
    } while (i < n);
    require(true);
  }
  function invokeRuntime(int n, int stride) public {
    int i = 1;
    do {
      this.m[i] = i + 10;
      IKernelCounterSink(sink).ping(i);
      i = stride + i;
    } while (i < n);
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const RANGED_DO_COUNTER_SOURCE = `pragma solidcash ^0.13.0;
contract KernelRangedDoCounter() {
  mapping(int => int) m;
  function write(int bound) public {
    int i = 5;
    do { this.m[i] = i + 20; i = i - 2; } while (i > bound);
    require(true);
  }
}`;

const COUNTER_STRUCT_RMW_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterStructRmw() {
  struct Inner { int left; }
  struct Pair { Inner inner; int right; }
  mapping(int => Pair) pairs;
  function seed(int key, int left, int right) public {
    this.pairs[key] = Pair(Inner(left), right);
    require(true);
  }
  function update(int count) public {
    for (int i = 0; i < count; i = i + 1) {
      Pair pair = this.pairs[i];
      pair.inner.left = pair.inner.left + 1;
      pair.right = pair.right + 2;
      this.pairs[i] = pair;
    }
    require(true);
  }
  function check(int key, int left, int right) public {
    require(this.pairs[key].inner.left == left);
    require(this.pairs[key].right == right);
    require(true);
  }
}`;

const COUNTER_DIRECT_STRUCT_RMW_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterDirectStructRmw() {
  struct Pair { int left; int right; }
  mapping(int => Pair) pairs;
  function seed(int key, int left, int right) public {
    this.pairs[key] = Pair(left, right);
    require(true);
  }
  function update(int count) public {
    for (int i = 0; i < count; i = i + 1) {
      this.pairs[i] = Pair(this.pairs[i].left + 1, this.pairs[i].right + 2);
    }
    require(true);
  }
}`;

const COUNTER_FIXED_MAPPING_READ_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterFixedMappingRead() {
  mapping(int => int) source;
  mapping(int => int) target;
  function seed(int value) public {
    this.source[0] = value;
    require(true);
  }
  function fill(int count) public {
    for (int i = 0; i < count; i = i + 1) {
      this.target[i] = this.source[0];
    }
    require(true);
  }
  function check(int key, int expected) public {
    require(this.target[key] == expected);
    require(true);
  }
}`;

const IMMUTABLE_DEFAULT_KEY_ARRAY_SOURCE = `pragma solidcash ^0.13.0;
contract KernelImmutableDefaultKeyArray() {
  mapping(int => int) slots;
  function write(int count) public {
    int[] keys = new int[](count);
    for (int i = 0; i < count; i = i + 1) { this.slots[keys[i]] = 1; }
    require(true);
  }
  function check(int expected) unsafe { require(this.slots[0] == expected); }
}`;

const DOMINATING_LOCAL_KEY_ARRAY_SOURCE = `pragma solidcash ^0.13.0;
contract KernelDominatingLocalKeyArray() {
  mapping(int => int) slots;
  function write(int count, int first, int second) public {
    int[] keys = new int[](count);
    keys[0] = first;
    keys[1] = second;
    for (int i = 0; i < count; i = i + 1) { this.slots[keys[i]] = i + 10; }
    require(true);
  }
  function check(int key, int expected) public { require(this.slots[key] == expected); }
}`;

const RESIZED_LOCAL_KEY_ARRAY_SOURCE = `pragma solidcash ^0.13.0;
contract KernelResizedLocalKeyArray() {
  mapping(int => int) slots;
  function write(int count, int first, int second) public {
    int[] keys = new int[](count);
    count = count + 2;
    keys.push(first);
    keys.push(999);
    keys.pop();
    keys.push(second);
    for (int i = 0; i < count; i = i + 1) { this.slots[keys[i]] = i + 1; }
    require(true);
  }
  function check(int key, int expected) public { require(this.slots[key] == expected); }
}`;

const SAME_ITERATION_LOCAL_KEY_ARRAY_SOURCE = `pragma solidcash ^0.13.0;
contract KernelSameIterationLocalKeyArray() {
  mapping(int => int) slots;
  function write(int count, int offset) public {
    int[] keys = new int[](count);
    for (int i = 0; i < count; i = i + 1) {
      keys[i] = offset + i;
      this.slots[keys[i]] = i + 20;
    }
    require(true);
  }
  function writeConditional(int count, int offset, bool take) public {
    int[] keys = new int[](count);
    for (int i = 0; i < count; i = i + 1) {
      if (take) { keys[i] = offset + i; }
      else { keys[i] = offset + count + i; }
      this.slots[keys[i]] = i + 30;
    }
    require(true);
  }
  function writeCaptured(int count, int key) public {
    int[] keys = new int[](count);
    keys[0] = key;
    key = key + 100;
    for (int i = 0; i < count; i = i + 1) { this.slots[keys[i]] = i + 40; }
    require(true);
  }
  function writeAfterAssignment(int count, int key) public {
    int[] keys = new int[](count);
    key = key + 1;
    keys[0] = key;
    for (int i = 0; i < count; i = i + 1) { this.slots[keys[i]] = i + 50; }
    require(true);
  }
  function writeAfterConditionalAssignment(int count, int key, bool take) public {
    int[] keys = new int[](count);
    if (take) { key = key + 1; }
    keys[0] = key;
    for (int i = 0; i < count; i = i + 1) { this.slots[keys[i]] = i + 60; }
    require(true);
  }
  function check(int key, int expected) public { require(this.slots[key] == expected); }
}`;

const DOMINATING_STATE_PREDICATE_SOURCE = `pragma solidcash ^0.13.0;
event Hit(int value);
contract KernelDominatingStatePredicate() {
  bool enabled;
  mapping(int => int) values;
  function eventWrite(int count, bool next) public {
    this.enabled = next;
    for (int i = 0; i < count; i = i + 1) {
      this.values[i] = i + 10;
      if (this.enabled) emit Hit(i);
    }
    require(true);
  }
  function conditionalWrite(int count, bool next) public {
    this.enabled = next;
    if (this.enabled) {
      for (int i = 0; i < count; i = i + 1) { this.values[i] = i + 20; }
    }
    require(true);
  }
  function conditionalStateWrite(int count, bool next, bool take) public {
    if (take) { this.enabled = next; }
    if (this.enabled) {
      for (int i = 0; i < count; i = i + 1) { this.values[i] = i + 30; }
    }
    require(true);
  }
  function switchStateWrite(int count, int choice, bool next) public {
    switch (choice) {
      case 1: this.enabled = next; break;
      case 2: this.enabled = !next; break;
      default: break;
    }
    if (this.enabled) {
      for (int i = 0; i < count; i = i + 1) { this.values[i] = i + 40; }
    }
    require(true);
  }
  function switchLocalWrite(int count, int base) public {
    int next = 0;
    bool take = false;
    for (int i = 0; i < count; i = i + 1) {
      switch (i % 3) {
        case 0: next = base + i; take = true; break;
        case 1: next = base + 10 + i; take = false; break;
        default: next = base + 20 + i; take = true; break;
      }
      if (take) { this.values[i] = next; }
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.values[key] == expected); }
}`;

const LOOP_CARRIED_GUARD_SOURCE = `pragma solidcash ^0.13.0;
event Phase(int value);
contract KernelLoopCarriedGuard() {
  mapping(int => int) values;
  mapping(int => int) beforeValues;
  mapping(int => int) afterValues;
  mapping(int => int) beforeAssignedValues;
  mapping(int => int) afterAssignedValues;
  mapping(int => int) breakValues;
  function write(int count) public {
    bool take = true;
    for (int i = 0; i < count; i = i + 1) {
      if (take) this.values[i] = i + 10;
      take = !take;
    }
    require(true);
  }
  function writeCounterDerived(int count) public {
    bool take = true;
    for (int i = 0; i < count; i = i + 1) {
      if (take) this.values[100 + i] = i + 20;
      take = i % 3 == 0;
    }
    require(true);
  }
  function writeCounterCurrent(int count) public {
    bool take = false;
    for (int i = 0; i < count; i = i + 1) {
      take = i % 3 == 0;
      if (take) this.values[200 + i] = i + 30;
      take = false;
    }
    require(true);
  }
  function writePhases(int count) public {
    bool take = true;
    for (int i = 0; i < count; i = i + 1) {
      if (take) { this.beforeValues[i] = i + 40; emit Phase(i); }
      take = i % 3 == 0;
      if (take) { this.afterValues[i] = i + 50; emit Phase(i + 100); }
    }
    require(true);
  }
  function writePhaseValues(int count) public {
    int next = 5;
    for (int i = 0; i < count; i = i + 1) {
      this.beforeAssignedValues[i] = next;
      next = i + 60;
      this.afterAssignedValues[i] = next;
    }
    require(true);
  }
  function writeBreakPhases(int count) public {
    bool stop = false;
    for (int i = 0; i < count; i = i + 1) {
      if (stop) break;
      stop = i == 2;
      if (stop) break;
      this.breakValues[i] = i + 70;
      emit Phase(i + 200);
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.values[key] == expected); }
  function checkBefore(int key, int expected) public { require(this.beforeValues[key] == expected); }
  function checkAfter(int key, int expected) public { require(this.afterValues[key] == expected); }
  function checkBeforeAssigned(int key, int expected) public {
    require(this.beforeAssignedValues[key] == expected);
  }
  function checkAfterAssigned(int key, int expected) public {
    require(this.afterAssignedValues[key] == expected);
  }
  function checkBreak(int key, int expected) public { require(this.breakValues[key] == expected); }
}`;

const BOOL_RMW_SOURCE = `pragma solidcash ^0.13.0;
contract KernelBoolRmw() {
  mapping(int => bool) flags;
  function flip(int count) public {
    for (int i = 0; i < count; i = i + 1) { this.flags[i] = !this.flags[i]; }
    require(true);
  }
  function check(int key, bool expected) public { require(this.flags[key] == expected); }
}`;

const FIXED_RMW_SOURCE = `pragma solidcash ^0.13.0;
contract KernelFixedRmw() {
  mapping(int => fixed128x18) values;
  function raise(int count, fixed128x18 floor) public {
    for (int i = 0; i < count; i = i + 1) {
      this.values[i] = this.values[i] > floor ? this.values[i] : floor;
    }
    require(true);
  }
  function check(int key, fixed128x18 expected) public { require(this.values[key] == expected); }
}`;

const DYNAMIC_BYTES_RMW_SOURCE = `pragma solidcash ^0.13.0;
contract KernelDynamicBytesRmw() {
  mapping(int => bytes) values;
  function append(int count, bytes suffix) public {
    for (int i = 0; i < count; i = i + 1) {
      this.values[i] = bytes.concat(this.values[i], suffix);
    }
    require(true);
  }
}`;

const DYNAMIC_BYTES_SCALAR_SOURCE = `pragma solidcash ^0.13.0;
contract KernelDynamicBytesScalar() {
  mapping(int => bytes) values;
  function set(int key, bytes value) public {
    this.values[key] = value;
    require(true);
  }
}`;

const MULTI_DYNAMIC_BYTES_SCALAR_SOURCE = `pragma solidcash ^0.13.0;
contract KernelMultiDynamicBytesScalar() {
  mapping(int => bytes) left;
  mapping(int => bytes) right;
  function set(int key, bytes leftValue, bytes rightValue) public {
    this.left[key] = leftValue;
    this.right[key] = rightValue;
    require(true);
  }
}`;

const DYNAMIC_STRING_RMW_SOURCE = `pragma solidcash ^0.13.0;
contract KernelDynamicStringRmw() {
  mapping(int => string) values;
  function append(int count, string suffix) public {
    for (int i = 0; i < count; i = i + 1) {
      this.values[i] = string.concat(this.values[i], suffix);
    }
    require(true);
  }
}`;

const DYNAMIC_STRUCT_RMW_SOURCE = `pragma solidcash ^0.13.0;
contract KernelDynamicStructRmw() {
  struct Record { bytes data; int revisions; }
  mapping(int => Record) records;
  function append(int count, bytes suffix) public {
    for (int i = 0; i < count; i = i + 1) {
      this.records[i] = Record(
        bytes.concat(this.records[i].data, suffix),
        this.records[i].revisions + 1
      );
    }
    require(true);
  }
}`;

const rawScalarRmwSource = (type: string): string => `pragma solidcash ^0.13.0;
contract KernelRawScalarRmw() {
  mapping(int => ${type}) values;
  function replace(int count, ${type} expected, ${type} replacement, ${type} fallbackValue) public {
    for (int i = 0; i < count; i = i + 1) {
      this.values[i] = this.values[i] == expected ? replacement : fallbackValue;
    }
    require(true);
  }
  function check(int key, ${type} expected) public { require(this.values[key] == expected); }
}`;

describe('kernel loop message-bus compose', () => {
  it('executes a normalized tail-recursive state transition through one row', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelTailRecursion() {
      int calls;
      function countDown(int value) public returns (int result) {
        this.calls = this.calls + 1;
        if (value == 0) { result = this.calls; }
        else { result = countDown(value - 1); }
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'countDown'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'countDown', args: [3n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).getState()).resolves.toMatchObject({ calls: 4n });
  }, 180_000);

  it('executes a homogeneous mutual tail-recursion cycle through one row', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelMutualTailRecursion() {
      int calls;
      modifier counted() { this.calls = this.calls + 1; _; }
      function evenStep(int remaining, int total) internal counted returns (int) {
        if (remaining == 0) return total;
        return oddStep(remaining - 1, total + 1);
      }
      function oddStep(int remaining, int total) internal counted returns (int) {
        if (remaining == 0) return total;
        return evenStep(remaining - 1, total + 1);
      }
      function run(int remaining) public returns (int) { return evenStep(remaining, 0); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'run', args: [4n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).getState()).resolves.toMatchObject({ calls: 5n });
  }, 180_000);

  it('executes resource-free non-tail recursion through one row', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelPureRecursion() {
      function sum(int remaining) internal pure returns (int) {
        if (remaining == 0) return 0;
        return remaining + sum(remaining - 1);
      }
      function total(int remaining) public pure returns (int) { return sum(remaining); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'total'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'total', args: [5n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('executes an unnamed tail-recursive result through one row', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelUnnamedTailRecursion() {
      int calls;
      function countDown(int value) public returns (int) {
        this.calls = this.calls + 1;
        if (value == 0) return this.calls;
        return countDown(value - 1);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'countDown'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((fn) => fn.name === 'countDown')?.outputs)
      .toEqual([{ type: 'int256' }]);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'countDown', args: [3n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).getState()).resolves.toMatchObject({ calls: 4n });
  }, 180_000);

  it('executes unnamed tail-recursive result tuples through one row', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelUnnamedTailTuple() {
      int calls;
      function pair(int value) public returns (int, bool) {
        this.calls = this.calls + 1;
        if (value == 0) return (this.calls, true);
        return pair(value - 1);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pair'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((fn) => fn.name === 'pair')?.outputs)
      .toEqual([{ type: 'int256' }, { type: 'bool' }]);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'pair', args: [3n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).getState()).resolves.toMatchObject({ calls: 4n });
  }, 180_000);

  it('executes a tail-recursive base return nested in a source loop', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelTailLoopReturn() {
      int calls;
      function find(int remaining) public returns (int result) {
        this.calls = this.calls + 1;
        for (int i = 0; i < 2; i = i + 1) {
          if (i == remaining) { result = this.calls * 10 + i; return; }
        }
        if (remaining == 0) return 99;
        return find(remaining - 1);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'find'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'find', args: [3n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).getState()).resolves.toMatchObject({ calls: 3n });
  }, 180_000);

  it('executes a normalized void tail-recursive helper through one row', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelVoidTailRecursion() {
      int calls;
      function countDown(int value) internal {
        this.calls = this.calls + 1;
        if (value > 0) { countDown(value - 1); }
      }
      function run(int value) public { countDown(value); require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'run', args: [3n] },
    ]);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).getState()).resolves.toMatchObject({ calls: 4n });
  }, 180_000);

  it('executes explicit value and void base-case returns in normalized tail recursion', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelTailReturn() {
      int calls;
      function value(int remaining) internal returns (int result) {
        if (remaining == 0) return 7;
        return value(remaining - 1);
      }
      function count(int remaining) internal {
        if (remaining == 0) return;
        this.calls = this.calls + 1;
        count(remaining - 1);
      }
      function run(int remaining) public returns (int result) {
        count(remaining);
        result = value(remaining);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'run', args: [1n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).getState()).resolves.toMatchObject({ calls: 1n });
  }, 180_000);

  it('executes isolated read-only transaction assembly inside a row handler', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'inspect')?.eligible).toBe(true);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([{ function: 'inspect', args: [] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `input ${inputIndex}`).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('evaluates two logical add rows on the kernel route', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    const routeBody = artifact.functionBodies?.['53434231'];
    expect(routeBody).toBeDefined();
    expect(bytecodeToAsm(hexToBin(routeBody!))).toMatch(/OP_UNTIL|OP_BEGIN/);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'add', args: [2n] }, { function: 'add', args: [3n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }))).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    // The route ABI includes the aligned signature array even when this batch selects only another handler.
    // Its neutral placeholder must not request or validate an unrelated signature.
    const unsignedCall = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'check', args: [5n] },
    ]);
    const unsignedBuilder = await unsignedCall.build();
    const unsignedTransaction = unsignedBuilder.buildLibauthTransaction();
    const unsignedSourceOutputs = generateLibauthSourceOutputs(unsignedBuilder.inputs);
    for (let inputIndex = 0; inputIndex < unsignedTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: unsignedSourceOutputs, transaction: unsignedTransaction,
      })), `unsigned input ${inputIndex}`).toBe(true);
    }
    await expect(unsignedCall.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);

  it('fails closed for an unknown row selector and for too many rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const add = artifact.messageBus!.handlers.find((handler) => handler.name === 'add')!;
    const encoded = encodeMessageBatch(artifact, [{ function: 'add', args: [1n] }]);
    const unknown = Uint8Array.from(encoded.blob);
    const selector = hexToBin(add.selector);
    const at = unknown.findIndex((_byte, index) => selector.every((value, offset) => unknown[index + offset] === value));
    expect(at).toBeGreaterThanOrEqual(0);
    unknown.set(hexToBin('deadbeef'), at);
    const unknownCall = contract._batchRaw(unknown, encoded.routeWitnesses);
    const unknownBuilder = await unknownCall.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const unknownTx = unknownBuilder.buildLibauthTransaction();
    const unknownSources = generateLibauthSourceOutputs(unknownBuilder.inputs);
    expect(unknownTx.inputs.some((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: unknownSources, transaction: unknownTx }))
      !== true)).toBe(true);

    expect(artifact.messageBus!.maximumRows).toBeGreaterThanOrEqual(2);
    const tooMany = Array.from({ length: artifact.messageBus!.maximumRows + 1 }, () => (
      { function: 'add', args: [1n] }
    ));
    expect(() => encodeMessageBatch(artifact, tooMany)).toThrow(/row count must be between/);

    const overflow = Uint8Array.from(encoded.blob);
    overflow[6] = artifact.messageBus!.maximumRows + 1;
    const overflowCall = contract._batchRaw(overflow, encoded.routeWitnesses);
    const overflowBuilder = await overflowCall.build();
    const overflowTx = overflowBuilder.buildLibauthTransaction();
    const overflowSources = generateLibauthSourceOutputs(overflowBuilder.inputs);
    expect(overflowTx.inputs.some((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: overflowSources, transaction: overflowTx }))
      !== true)).toBe(true);
  }, 180_000);
});

describe('kernel scalar-signature rows', () => {
  it('executes the synthesized block-oracle updater through the row loop', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelBlockOracle() {
      mapping(int => int) values;
      function seed(int key, int value) public {
        this.values[key] = value;
        require(true);
      }
      function readTimestamp(int expected) public {
        require(block.timestamp == expected);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) =>
      handler.name === '__updateBlockOracle')).toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider,
      inner,
      artifact.stateLayout!,
      { __block_timestamp: 0n, __blockOracleOwner: alicePub },
      { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{
      function: '__updateBlockOracle',
      args: [new SignatureTemplate(alicePriv), 1_700_000_000n],
    }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).getState()).resolves.toMatchObject({
      __block_timestamp: 1_700_000_000n,
    });
  }, 180_000);

  it('signs two aligned route-witness elements against the invoked handler body', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelSigned(pubkey owner) {
      int total;
      function add(sig authorization, int amount) public {
        require(checkSig(authorization, owner));
        this.total = this.total + amount;
        require(true);
      }
      function check(int expected) public { require(this.total == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[]',
    }));

    const inner = new Contract(artifact, [alicePub], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    expect(() => contract.batch([
      { function: 'add', args: [new Uint8Array(65), 1n] },
    ])).toThrow(/transaction signature argument 0 requires SignatureTemplate/);
    const call = contract.batch([
      { function: 'add', args: [new SignatureTemplate(alicePriv), 2n] },
      { function: 'add', args: [new SignatureTemplate(alicePriv), 3n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(
      StatefulContract.withCategory(inner, categoryId).check(5n).send(),
    ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);
});

describe('kernel composite-signature rows', () => {
  it('detaches and reconstructs nested struct and struct-array signature leaves', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelCompositeSigned() {
      struct Auth { sig signature; pubkey key; }
      struct Pair { Auth first; Auth second; }
      int total;
      function kill() selfdestruct { require(true); }
      function add(Pair authorization, Auth[] extras, int amount) public {
        require(checkSig(authorization.first.signature, authorization.first.key));
        require(checkSig(authorization.second.signature, authorization.second.key));
        require(extras.length == 1);
        require(checkSig(extras[0].signature, extras[0].key));
        this.total = this.total + amount;
        require(true);
      }
      function check(int expected) public { require(this.total == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'kill'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '__message_bus_sig_0_0_0_rows', type: 'sig[]' }),
      expect.objectContaining({ name: '__message_bus_sig_0_0_1_rows', type: 'sig[]' }),
      expect.objectContaining({ name: '__message_bus_sig_0_1_rows', type: 'sig[][]' }),
    ]));

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const auth = (key: Uint8Array, privateKey: Uint8Array): {
      signature: SignatureTemplate; key: Uint8Array;
    } => ({
      signature: new SignatureTemplate(privateKey), key,
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    expect(() => contract.batch([{
      function: 'add',
      args: [{
        first: { signature: new Uint8Array(65), key: alicePub },
        second: auth(bobPub, bobPriv),
      }, [auth(alicePub, alicePriv)], 1n],
    }])).toThrow(/transaction signature argument 0 requires SignatureTemplate/);
    const call = contract.batch([
      {
        function: 'add',
        args: [{ first: auth(alicePub, alicePriv), second: auth(bobPub, bobPriv) }, [auth(alicePub, alicePriv)], 2n],
      },
      {
        function: 'add',
        args: [{ first: auth(alicePub, alicePriv), second: auth(bobPub, bobPriv) }, [auth(bobPub, bobPriv)], 3n],
      },
    ]);
    const fee = await createBareP2pkhFeeFunder(provider);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).check(5n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);
});

describe('kernel signature-array rows', () => {
  it('signs each row of a nested route witness against the invoked handler body', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelMultiSigned() {
      int total;
      function add(sig[] authorizations, pubkey[] owners, int amount) public {
        require(checkMultiSig(authorizations, owners));
        this.total = this.total + amount;
        require(true);
      }
      function check(int expected) public { require(this.total == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[][]',
    }));

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const signatures = (): SignatureTemplate[] => [
      new SignatureTemplate(alicePriv, undefined, SignatureAlgorithm.ECDSA),
      new SignatureTemplate(bobPriv, undefined, SignatureAlgorithm.ECDSA),
    ];
    const contract = StatefulContract.withCategory(inner, categoryId);
    expect(() => contract.batch([
      { function: 'add', args: [[new Uint8Array(65)], [alicePub], 1n] },
    ])).toThrow(/transaction signature argument 0 requires SignatureTemplate/);
    const call = contract.batch([
      { function: 'add', args: [signatures(), [alicePub, bobPub], 2n] },
      { function: 'add', args: [signatures(), [alicePub, bobPub], 3n] },
    ]);
    const fee = await createBareP2pkhFeeFunder(provider);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const unsignedCall = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'check', args: [5n] },
    ]);
    const unsignedBuilder = await unsignedCall.build();
    const unsignedTransaction = unsignedBuilder.buildLibauthTransaction();
    const unsignedSourceOutputs = generateLibauthSourceOutputs(unsignedBuilder.inputs);
    for (let inputIndex = 0; inputIndex < unsignedTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: unsignedSourceOutputs, transaction: unsignedTransaction,
      })), `unsigned input ${inputIndex}`).toBe(true);
    }
  }, 180_000);

  it('recursively signs a deeper source array through one additional row dimension', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelNestedSigned(pubkey owner) {
      int total;
      function add(sig[][] authorizations, int amount) public {
        require(checkSig(authorizations[0][0], owner));
        this.total = this.total + amount;
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[][][]',
    }));

    const inner = new Contract(artifact, [alicePub], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'add', args: [[[new SignatureTemplate(alicePriv)]], 2n] },
      { function: 'add', args: [[[new SignatureTemplate(alicePriv)]], 3n] },
    ]);
    const fee = await createBareP2pkhFeeFunder(provider);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);
});

describe('kernel counter-key mapping loop compose', () => {
  it('settles a batched invariant key from its reassigned point-in-time value', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash ^0.13.0;
      contract KernelReassignedInvariantKey() {
        mapping(int => int) keyed;
        mapping(int => int) totals;
        function write(int n, int owner) public {
          owner = owner + 5;
          for (int i = 0; i < n; i = i + 1) {
            this.keyed[i] = i + 10;
            this.totals[owner] = i;
            this.totals[owner] = i + 100;
          }
          require(true);
        }
        function writeConditional(int n, int owner, bool take) public {
          if (take) { owner = owner + 5; } else { owner = owner - 2; }
          for (int i = 0; i < n; i = i + 1) {
            this.keyed[i] = i + 20;
            this.totals[owner] = i + 200;
          }
          require(true);
        }
        function check(int key, int expected) public { require(this.totals[key] == expected); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const batch = contract.batch([{ function: 'write', args: [3n, 30n] }]);
    await expect(batch.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(35n, 102n).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'writeConditional', args: [2n, 40n, true] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(45n, 201n).send()).resolves.toBeDefined();
    await expect(contract.call.writeConditional(2n, 50n, false).send()).resolves.toBeDefined();
    await expect(contract.call.check(48n, 201n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles exactly the iterations selected by a runtime predicate', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SELECTED_COUNTER_MAPPING_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    const writeHandler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    const oddsHandler = artifact.abi.find((candidate) => candidate.name === 'writeOdds')!;
    const whileSplitHandler = artifact.abi.find((candidate) => candidate.name === 'writeWhileSplit')!;
    const doWhileSplitHandler = artifact.abi.find((candidate) => candidate.name === 'writeDoWhileSplit')!;
    const untilHandler = artifact.abi.find((candidate) => candidate.name === 'writeUntil')!;
    const voidReturnHandler = artifact.abi.find((candidate) => candidate.name === 'writeVoidReturn')!;
    const returnHandler = artifact.abi.find((candidate) => candidate.name === 'writeReturn')!;
    const switchHandler = artifact.abi.find((candidate) => candidate.name === 'writeSwitch')!;
    const innerSwitchHandler = artifact.abi.find((candidate) => candidate.name === 'writeInnerSwitch')!;
    const unsignedHandler = artifact.abi.find((candidate) => candidate.name === 'writeUnsigned')!;
    const computedHandler = artifact.abi.find((candidate) => candidate.name === 'writeComputed')!;
    const mixedHandler = artifact.abi.find((candidate) => candidate.name === 'writeMixed')!;
    const computedKeyHandler = artifact.abi.find((candidate) => candidate.name === 'writeComputedKey')!;
    const reassignedKeyHandler = artifact.abi.find((candidate) => candidate.name === 'writeReassignedKey')!;
    const nestedInvariantHandler = artifact.abi.find((candidate) => candidate.name === 'writeNestedInvariant')!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(writeHandler.sortedUpsertLoopInfo?.[0].iterationCondition).toBeDefined();
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeOdds'))
      .toMatchObject({ eligible: true });
    expect(oddsHandler.sortedUpsertLoopInfo?.[0].iterationCondition).toBeDefined();
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeWhileSplit'))
      .toMatchObject({ eligible: true });
    expect(whileSplitHandler.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({ collection: 'm', iterationCondition: expect.anything() }),
      expect.objectContaining({ collection: 'whileRest', iterationCondition: expect.anything() }),
    ]);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeDoWhileSplit'))
      .toMatchObject({ eligible: true });
    expect(doWhileSplitHandler.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({
        collection: 'm', iterationCondition: expect.anything(), varyingArrayParam: expect.stringMatching(/_post$/),
      }),
      expect.objectContaining({
        collection: 'whileRest', iterationCondition: expect.anything(),
        varyingArrayParam: expect.stringMatching(/_post$/),
      }),
    ]);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeUntil'))
      .toMatchObject({ eligible: true });
    expect(untilHandler.sortedUpsertLoopInfo?.[0].iterationBreakCondition).toBeDefined();
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeVoidReturn'))
      .toMatchObject({ eligible: true });
    expect(voidReturnHandler.sortedUpsertLoopInfo?.[0].iterationBreakCondition).toBeDefined();
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeReturn'))
      .toMatchObject({ eligible: true });
    expect(returnHandler.sortedUpsertLoopInfo?.[0].iterationBreakCondition).toBeDefined();
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeSwitch'))
      .toMatchObject({ eligible: true });
    expect(switchHandler.sortedUpsertLoopInfo?.map((info) => info.condition)).toEqual([
      expect.objectContaining({ kind: 'binary', operator: '==' }),
      expect.objectContaining({ kind: 'unary', operator: '!' }),
    ]);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeInnerSwitch'))
      .toMatchObject({ eligible: true });
    expect(innerSwitchHandler.sortedUpsertLoopInfo?.[0].iterationCondition)
      .toMatchObject({ kind: 'binary', operator: '||' });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeUnsigned'))
      .toMatchObject({ eligible: true });
    expect(unsignedHandler.inputs).toContainEqual(expect.objectContaining({
      name: expect.stringMatching(/^__internal__vmapCounterPerm_/), type: 'uint256[]',
    }));
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeComputed'))
      .toMatchObject({ eligible: true });
    expect(computedHandler.sortedUpsertLoopInfo?.[0].iterationBound)
      .toMatchObject({ kind: 'binary', operator: '*' });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeMixed'))
      .toMatchObject({ eligible: true });
    expect(mixedHandler.sortedUpsertLoopInfo).toHaveLength(1);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeComputedKey'))
      .toMatchObject({ eligible: true });
    expect(computedKeyHandler.sortedUpsertLoopInfo).toHaveLength(1);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeReassignedKey'))
      .toMatchObject({ eligible: true });
    expect(reassignedKeyHandler.sortedUpsertLoopInfo).toHaveLength(1);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeNestedInvariant'))
      .toMatchObject({ eligible: true });
    expect(nestedInvariantHandler.sortedUpsertLoopInfo).toHaveLength(1);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    let contract = StatefulContract.withCategory(inner, categoryId);

    const direct = contract.call.write(5n, 2n);
    const directBuilder = await direct.build();
    const directInput = directBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === 'write');
    if (!directInput || !('params' in directInput.unlocker)) throw new Error('direct write input is missing');
    const directPermutationIndex = writeHandler.inputs.findIndex((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'));
    expect([...(directInput.unlocker.params[directPermutationIndex] as bigint[])]
      .sort((left, right) => Number(left - right))).toEqual([0n, 1n]);
    await expect(direct.send()).resolves.toMatchObject({
      events: [{ args: { i: 0n } }, { args: { i: 1n } }],
    });

    contract = StatefulContract.withCategory(inner, categoryId);
    const routed = contract.batch([{ function: 'write', args: [5n, 4n] }]);
    const builder = await routed.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const permutationName = writeHandler.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))!.name;
    const routePermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationName);
    const rowPermutations = routeUnlocker.params[routePermutationIndex] as bigint[][];
    expect([...rowPermutations[0]].sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n, 3n]);

    const routeSelector = artifact.messageBus!.route.selector!;
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const originalUnlocker = routeUnlocker;
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    for (const hostile of [rowPermutations[0].slice(1), [...rowPermutations[0], 0n]]) {
      const hostileParams = [...routeUnlocker.params];
      hostileParams[routePermutationIndex] = [hostile];
      builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      expect(hostileVm.stateSuccess(hostileVm.evaluate({
        inputIndex: routeInputIndex, sourceOutputs, transaction,
      })), `hostile selected-domain witness ${hostile.join(',')}`).not.toBe(true);
    }
    builder.inputs[routeInputIndex].unlocker = originalUnlocker;

    await expect(routed.send()).resolves.toMatchObject({
      events: [{ args: { i: 0n } }, { args: { i: 1n } }, { args: { i: 2n } }, { args: { i: 3n } }],
    });
    for (const [key, expected] of [[0n, 10n], [1n, 11n], [2n, 12n], [3n, 13n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const continued = StatefulContract.withCategory(inner, categoryId).call.writeOdds(6n);
    const continuedBuilder = await continued.build();
    const continuedInput = continuedBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === 'writeOdds');
    if (!continuedInput || !('params' in continuedInput.unlocker)) {
      throw new Error('direct writeOdds input is missing');
    }
    const oddsPermutationIndex = oddsHandler.inputs.findIndex((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'));
    expect([...(continuedInput.unlocker.params[oddsPermutationIndex] as bigint[])]
      .sort((left, right) => Number(left - right))).toEqual([1n, 3n, 5n]);
    await expect(continued.send()).resolves.toMatchObject({
      events: [
        { args: { i: 100n } },
        { args: { i: 101n } }, { args: { i: 1n } },
        { args: { i: 102n } },
        { args: { i: 103n } }, { args: { i: 3n } },
        { args: { i: 104n } },
        { args: { i: 105n } }, { args: { i: 5n } },
      ],
    });
    for (const [key, expected] of [[1n, 31n], [3n, 33n], [5n, 35n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const whileContinued = StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeWhileSplit', args: [6n] }]);
    const whileBuilder = await whileContinued.build();
    const whileInput = whileBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!whileInput || !('params' in whileInput.unlocker)) {
      throw new Error('message-bus writeWhileSplit input is missing');
    }
    const expectedWhileKeys = new Map([
      ['m', [0n, 2n, 4n]],
      ['whileRest', [1n, 3n, 5n]],
    ]);
    for (const info of whileSplitHandler.sortedUpsertLoopInfo ?? []) {
      const whilePermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
        input.name === info.varyingArrayParam);
      expect([...(whileInput.unlocker.params[whilePermutationIndex] as bigint[][])[0]]
        .sort((left, right) => Number(left - right))).toEqual(expectedWhileKeys.get(info.collection));
    }
    await expect(whileContinued.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const [key, expected] of [[0n, 130n], [2n, 132n], [4n, 134n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    for (const [key, expected] of [[1n, 231n], [3n, 233n], [5n, 235n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.checkWhileRest(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const doWhileContinued = StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeDoWhileSplit', args: [4n] }]);
    const doWhileBuilder = await doWhileContinued.build();
    const doWhileInput = doWhileBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!doWhileInput || !('params' in doWhileInput.unlocker)) {
      throw new Error('message-bus writeDoWhileSplit input is missing');
    }
    const expectedDoWhileKeys = new Map([
      ['m', [0n, 2n]],
      ['whileRest', [1n, 3n]],
    ]);
    for (const info of doWhileSplitHandler.sortedUpsertLoopInfo ?? []) {
      const permutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
        input.name === info.varyingArrayParam);
      expect([...(doWhileInput.unlocker.params[permutationIndex] as bigint[][])[0]]
        .sort((left, right) => Number(left - right))).toEqual(expectedDoWhileKeys.get(info.collection));
    }
    await expect(doWhileContinued.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const [key, expected] of [[0n, 330n], [2n, 332n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    for (const [key, expected] of [[1n, 331n], [3n, 333n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.checkWhileRest(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const broken = StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeUntil', args: [8n, 3n] }]);
    const brokenBuilder = await broken.build();
    const brokenInputIndex = brokenBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const brokenInput = brokenBuilder.inputs[brokenInputIndex];
    if (!brokenInput || !('params' in brokenInput.unlocker)) {
      throw new Error('routed writeUntil input is missing');
    }
    const untilPermutationName = untilHandler.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))!.name;
    const untilPermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === untilPermutationName);
    const terminatedPermutation = (brokenInput.unlocker.params[untilPermutationIndex] as bigint[][])[0];
    expect([...terminatedPermutation]
      .sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n, 3n]);
    const brokenRouteUnlocker = brokenInput.unlocker;
    const recreateBrokenUnlocker = brokenRouteUnlocker.contract.createCompilerRouteUnlocker(
      brokenRouteUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    );
    const brokenVm = createVirtualMachineBch2026ForProvider(provider);
    for (const hostile of [terminatedPermutation.slice(1), [...terminatedPermutation, 4n]]) {
      const hostileParams = [...brokenRouteUnlocker.params];
      hostileParams[untilPermutationIndex] = [hostile];
      brokenBuilder.inputs[brokenInputIndex].unlocker = recreateBrokenUnlocker(...hostileParams);
      const transaction = brokenBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(brokenBuilder.inputs);
      expect(brokenVm.stateSuccess(brokenVm.evaluate({
        inputIndex: brokenInputIndex, sourceOutputs, transaction,
      })), `hostile terminated-domain witness ${hostile.join(',')}`).not.toBe(true);
    }
    brokenBuilder.inputs[brokenInputIndex].unlocker = brokenRouteUnlocker;
    await expect(broken.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      events: [
        { args: { i: 200n } }, { args: { i: 201n } },
        { args: { i: 202n } }, { args: { i: 203n } },
      ],
    });
    for (const [key, expected] of [[0n, 40n], [1n, 41n], [2n, 42n], [3n, 43n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    const voidReturned = StatefulContract.withCategory(inner, categoryId).call.writeVoidReturn(7n, 2n);
    const voidBuilder = await voidReturned.build();
    const voidInput = voidBuilder.inputs.find((candidate) =>
      'abiFunction' in candidate.unlocker && candidate.unlocker.abiFunction.name === 'writeVoidReturn');
    if (!voidInput || !('params' in voidInput.unlocker)) {
      throw new Error('direct writeVoidReturn input is missing');
    }
    const voidPermutationIndex = voidReturnHandler.inputs.findIndex((candidate) =>
      candidate.name.startsWith('__internal__vmapCounterPerm_'));
    expect([...(voidInput.unlocker.params[voidPermutationIndex] as bigint[])]
      .sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n]);
    await expect(voidReturned.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 60n], [1n, 61n], [2n, 62n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    const returned = StatefulContract.withCategory(inner, categoryId).call.writeReturn(7n, 2n);
    const returnBuilder = await returned.build();
    const returnInput = returnBuilder.inputs.find((candidate) =>
      'abiFunction' in candidate.unlocker && candidate.unlocker.abiFunction.name === 'writeReturn');
    if (!returnInput || !('params' in returnInput.unlocker)) {
      throw new Error('direct writeReturn input is missing');
    }
    const returnPermutationIndex = returnHandler.inputs.findIndex((candidate) =>
      candidate.name.startsWith('__internal__vmapCounterPerm_'));
    expect([...(returnInput.unlocker.params[returnPermutationIndex] as bigint[])]
      .sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n]);
    await expect(returned.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 70n], [1n, 71n], [2n, 72n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeReturn(7n, 1n).emitReturn().send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeReturn', args: [7n, 1n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeSwitch(3n, 1n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 80n], [1n, 81n], [2n, 82n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeSwitch', args: [3n, 2n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 90n], [1n, 91n], [2n, 92n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeInnerSwitch(3n, 1n).send())
      .resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
        events: [{ args: { i: 300n } }, { args: { i: 301n } }, { args: { i: 302n } }],
      });
    for (const [key, expected] of [[0n, 100n], [1n, 101n], [2n, 102n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeInnerSwitch', args: [3n, 2n] }]).send())
      .resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
        events: [{ args: { i: 400n } }, { args: { i: 401n } }, { args: { i: 402n } }],
      });
    for (const [key, expected] of [[0n, 110n], [1n, 111n], [2n, 112n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeUnsigned(3n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 500n], [1n, 501n], [2n, 502n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.checkUnsigned(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeUnsigned', args: [3n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeComputed(2n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 600n], [1n, 601n], [2n, 602n], [3n, 603n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeComputed', args: [3n, 1n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeComputed(9n, 8n).build())
      .rejects.toThrow(/outside 0\.\.64/);
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeMixed(4n, 9n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkTotal(9n, 3n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeMixed', args: [3n, 9n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkTotal(9n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const owner = hexToBin('01020304');
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeComputedKey(4n, owner).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkHashedTotal(owner, 3n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeComputedKey', args: [3n, owner] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkHashedTotal(owner, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeReassignedKey(4n, 20n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkTotal(25n, 3n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeReassignedKey', args: [3n, 30n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkTotal(35n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(() => StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'writeComputedKey', args: [1n, owner] },
      { function: 'writeComputedKey', args: [1n, hexToBin('05060708')] },
    ])).toThrow(/computed route witness .* disagrees across batch rows/);
    await expect(StatefulContract.withCategory(inner, categoryId)
      .call.writeNestedInvariant(4n, 7n, owner).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkNestedTotal(7n, owner, 3n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeNestedInvariant', args: [3n, 7n, owner] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkNestedTotal(7n, owner, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('settles conditionally reached counter loops and plans inactive rows as empty', async () => {
    const provider = createTestProvider();
    const artifact = compileString(CONDITIONAL_COUNTER_LOOP_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    const handler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    const permutation = handler.inputs.find((input) => input.name.startsWith('__internal__vmapCounterPerm_'))!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(handler.sortedUpsertLoopInfo?.[0].condition).toEqual({
      kind: 'binary', operator: '&&',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      right: { kind: 'state', name: 'gate' },
    });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { gate: true }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    // The inactive path accepts a source bound above the active loop ceiling because its authenticated domain is
    // exactly empty. This catches unconditional off-chain permutation planning and unconditional on-chain bounds.
    const inactive = contract.call.write(100n, false);
    const inactiveBuilder = await inactive.build();
    const inactiveInput = inactiveBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === 'write');
    if (!inactiveInput || !('params' in inactiveInput.unlocker)) throw new Error('direct write input is missing');
    const directPermutationIndex = handler.inputs.findIndex((input) => input.name === permutation.name);
    expect(inactiveInput.unlocker.params[directPermutationIndex]).toEqual([]);
    const inactiveVm = createVirtualMachineBch2026ForProvider(provider);
    const inactiveTransaction = inactiveBuilder.buildLibauthTransaction();
    const inactiveSources = generateLibauthSourceOutputs(inactiveBuilder.inputs);
    for (let inputIndex = 0; inputIndex < inactiveTransaction.inputs.length; inputIndex += 1) {
      expect(inactiveVm.stateSuccess(inactiveVm.evaluate({
        inputIndex, sourceOutputs: inactiveSources, transaction: inactiveTransaction,
      })), `inactive input ${inputIndex}`).toBe(true);
    }
    await expect(contract.call.write(100n, false).send()).resolves.toMatchObject({ events: [] });

    const routed = contract.batch([
      { function: 'write', args: [100n, false] },
      { function: 'write', args: [3n, true] },
    ]);
    const routedBuilder = await routed.build();
    const routeInput = routedBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!routeInput || !('params' in routeInput.unlocker)) throw new Error('message-bus route input is missing');
    const routePermutation = artifact.messageBus!.route.inputs.findIndex((input) => input.name === permutation.name);
    const routedPermutation = routeInput.unlocker.params[routePermutation] as bigint[][];
    expect(routedPermutation[0]).toEqual([]);
    expect([...routedPermutation[1]].sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n]);
    const receipt = await routed.send();
    expect(receipt.events?.map((event) => event.args.i)).toEqual([0n, 1n, 2n]);
    for (const key of [0n, 1n, 2n]) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, key + 10n).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const scopedHandler = artifact.abi.find((candidate) => candidate.name === 'writeScoped')!;
    expect(scopedHandler.entryAccesses).toContainEqual(expect.objectContaining({
      collection: 'scopedGate', slotIndex: 1, operations: ['read'],
    }));
    expect(scopedHandler.sortedUpsertLoopInfo?.[0].condition).toMatchObject({
      kind: 'binary',
      operator: '&&',
      right: {
        kind: 'stateAccess',
        name: 'scopedGate',
        args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 1 } }],
      },
    });
    const missingGate = StatefulContract.withCategory(inner, categoryId).call.writeScoped(100n, 9n, true);
    const missingBuilder = await missingGate.build();
    const missingInput = missingBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === 'writeScoped');
    if (!missingInput || !('params' in missingInput.unlocker)) {
      throw new Error('direct writeScoped input is missing');
    }
    const scopedPermutation = scopedHandler.inputs.findIndex((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'));
    expect(missingInput.unlocker.params[scopedPermutation]).toEqual([]);
    await expect(missingGate.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    await expect(StatefulContract.withCategory(inner, categoryId).call.setScopedGate(7n, true).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const mappedRoute = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'writeScoped', args: [100n, 7n, false] },
      { function: 'writeScoped', args: [2n, 7n, true] },
    ]);
    const mappedBuilder = await mappedRoute.build();
    const mappedRouteInput = mappedBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!mappedRouteInput || !('params' in mappedRouteInput.unlocker)) {
      throw new Error('mapped message-bus route input is missing');
    }
    const scopedPermutationName = scopedHandler.inputs[scopedPermutation].name;
    const scopedRoutePermutation = artifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === scopedPermutationName,
    );
    expect(mappedRouteInput.unlocker.params[scopedRoutePermutation]).toEqual([
      [], expect.arrayContaining([0n, 1n]),
    ]);
    await expect(mappedRoute.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkScoped(0n, 7n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkScoped(1n, 8n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('derives immutable affine loop bounds for direct and routed calls', async () => {
    const provider = createTestProvider();
    const artifact = compileString(AFFINE_COUNTER_MAPPING_SOURCE, KERNEL);
    const handler = artifact.abi.find((candidate) => candidate.name === 'writeAffine')!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeAffine'))
      .toMatchObject({ eligible: true });
    const permutationInput = handler.inputs.find((input) =>
      /^__internal__vmapCounterPerm_n_\d+_bound_n1_from_p1_step_p2$/.test(input.name));
    expect(permutationInput).toMatchObject({ type: 'int256[]' });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const zeroTrip = StatefulContract.withCategory(inner, categoryId).call.writeAffine(0n, 5n);
    await expect(zeroTrip.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const direct = StatefulContract.withCategory(inner, categoryId).call.writeAffine(5n, 10n);
    await expect(direct.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const routedContract = StatefulContract.withCategory(inner, categoryId);
    const routed = routedContract.batch([{ function: 'writeAffine', args: [7n, 20n] }]);
    const routedBuilder = await routed.build();
    const routeInput = routedBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!routeInput || !('params' in routeInput.unlocker)) throw new Error('message-bus route input is missing');
    const permutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationInput!.name);
    expect(routeInput.unlocker.params[permutationIndex]).toEqual([[1n, 3n, 5n]]);
    await expect(routed.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    for (const key of [1n, 3n, 5n]) {
      await expect(StatefulContract.withCategory(inner, categoryId).check(key, 20n).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
  }, 180_000);

  it('settles exact-termination domains and rejects unreachable endpoints before construction', async () => {
    const provider = createTestProvider();
    const artifact = compileString(EXACT_COUNTER_MAPPING_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeAscending'))
      .toMatchObject({ eligible: true });
    const exactInfo = artifact.abi.find((candidate) =>
      candidate.name === 'writeAscending')?.sortedUpsertLoopInfo?.[0];
    expect(exactInfo).toMatchObject({ iterationExactBound: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    await expect(contract.call.writeAscending(true, 7n, 2n, 11n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(contract.call.writeAscending(true, 1n, 2n, 99n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    // Artifact metadata makes invalid domains fail early, but it is not trusted by the covenant. Simulate an
    // older/hostile planner which omits the exact-endpoint flag and verify that the generated route still refuses.
    exactInfo!.iterationExactBound = undefined;
    const hostile = contract.batch([{ function: 'writeAscending', args: [true, 6n, 2n, 44n] }]);
    const hostileBuilder = await hostile.build();
    exactInfo!.iterationExactBound = true;
    const hostileRouteIndex = hostileBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(hostileRouteIndex).toBeGreaterThanOrEqual(0);
    const hostileTransaction = hostileBuilder.buildLibauthTransaction();
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    expect(hostileVm.stateSuccess(
      hostileVm.evaluate({
        inputIndex: hostileRouteIndex,
        sourceOutputs: generateLibauthSourceOutputs(hostileBuilder.inputs),
        transaction: hostileTransaction,
      }),
    )).not.toBe(true);

    await expect(contract.batch([{
      function: 'writeAscending', args: [false, 6n, 0n, 99n],
    }]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const routed = contract.batch([{ function: 'writeAscending', args: [true, 7n, 2n, 22n] }]);
    const routedBuilder = await routed.build();
    const routeInput = routedBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!routeInput || !('params' in routeInput.unlocker)) throw new Error('message-bus route input is missing');
    const ascending = artifact.abi.find((candidate) => candidate.name === 'writeAscending')!;
    const permutationName = ascending.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))!.name;
    const permutationIndex = artifact.messageBus!.route.inputs.findIndex((input) => input.name === permutationName);
    const planned = routeInput.unlocker.params[permutationIndex];
    expect(Array.isArray(planned) && Array.isArray(planned[0])
      ? [...planned[0]].sort((left, right) => Number(BigInt(left) - BigInt(right))) : planned)
      .toEqual([1n, 3n, 5n]);
    await expect(routed.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const key of [1n, 3n, 5n]) {
      await expect(contract.call.check(key, 22n).send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    }
    expect(() => contract.batch([{ function: 'writeAscending', args: [true, 6n, 2n, 44n] }]))
      .toThrow(/exact bound 'bound' must be reachable by its step/);
    expect(() => contract.batch([{ function: 'writeAscending', args: [true, -1n, 2n, 44n] }]))
      .toThrow(/exact bound 'bound' must be in the direction of its step/);
    expect(() => contract.batch([{ function: 'writeAscending', args: [true, 7n, 0n, 44n] }]))
      .toThrow(/runtime step must advance toward its bound/);
  }, 180_000);

  it('replays straight-line public and local bound assignments for routed calls', async () => {
    const provider = createTestProvider();
    const artifact = compileString(REASSIGNED_BOUND_MAPPING_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeParam'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeLocal'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeConditional'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'writeParam', args: [4n, 10n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.check(2n, 10n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeLocal', args: [4n, 20n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.check(1n, 20n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.check(2n, 10n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.batch([{ function: 'writeConditional', args: [5n, 30n, true] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(3n, 30n).send()).resolves.toBeDefined();
    await expect(contract.call.writeConditional(3n, 40n, false).send()).resolves.toBeDefined();
    await expect(contract.call.check(2n, 40n).send()).resolves.toBeDefined();
    await expect(contract.call.check(3n, 30n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles an old-entry transition without a row-local fixed key witness', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_RMW_SOURCE, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'credit');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.batchKeyWitnesses).toBeUndefined();
    expect(artifact.abi.find((candidate) => candidate.name === 'credit')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ op: '+', valueScalarParam: 'amount' })]);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    expect(() => contract.batch([{ function: 'credit', args: [130n, 7n] }]))
      .toThrow(/iteration count outside 0\.\.64/);
    const call = contract.batch([{ function: 'credit', args: [8n, 7n] }]);
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const permutationInput = artifact.abi.find((candidate) => candidate.name === 'credit')!.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))!;
    expect(permutationInput.name).toMatch(/_from_p1_step_p2$/);
    const routePermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationInput.name);
    expect(routePermutationIndex).toBeGreaterThanOrEqual(0);
    const rowPermutations = routeUnlocker.params[routePermutationIndex];
    if (!Array.isArray(rowPermutations) || !Array.isArray(rowPermutations[0])) {
      throw new Error('expected row-indexed compiler-derived ranged permutations');
    }
    const originalPermutation = rowPermutations[0];
    if (!Array.isArray(originalPermutation) || originalPermutation.length !== 4) {
      throw new Error('expected a four-element compiler-derived ranged permutation');
    }
    expect([...originalPermutation].sort((left, right) => Number(BigInt(left) - BigInt(right))))
      .toEqual([1n, 3n, 5n, 7n]);

    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const malformedProgression = [...originalPermutation];
    malformedProgression[0] = 2n;
    const duplicate = [...originalPermutation];
    duplicate[0] = duplicate[1];
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    for (const hostilePermutation of [
      originalPermutation.slice(1),
      malformedProgression,
      duplicate,
      [...originalPermutation.slice(0, -1), 9n],
    ]) {
      const hostileRouteParams = [...routeUnlocker.params];
      hostileRouteParams[routePermutationIndex] = [hostilePermutation];
      builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileRouteParams);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      expect(hostileVm.stateSuccess(hostileVm.evaluate({
        inputIndex: routeInputIndex, sourceOutputs, transaction,
      })), `hostile ranged permutation ${hostilePermutation.join(',')}`).not.toBe(true);
    }
    builder.inputs[routeInputIndex].unlocker = routeUnlocker;

    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const key of [1n, 3n, 5n, 7n]) {
      await expect(
        StatefulContract.withCategory(inner, categoryId).check(key, 7n).send(),
      ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId).check(0n, 0n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.credit(10n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).check(9n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('finalizes and sends a counter-keyed mapping row with the authenticated permutation', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_SOURCE, KERNEL);
    const handler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    const permutationInput = handler.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'));
    expect(permutationInput).toBeDefined();

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([
      { function: 'write', args: [2n, 10n] },
      { function: 'write', args: [3n, 10n] },
    ]).build()).rejects.toThrow(/read-your-writes transition/);
    await expect(contract.batch([
      { function: 'write', args: [3n, 10n] },
      { function: 'write', args: [3n, 11n] },
    ]).build()).rejects.toThrow(/read-your-writes transition/);
    await expect(contract.batch([
      { function: 'write', args: [3n, 10n] },
      { function: 'write', args: [3n, 10n] },
    ]).build()).rejects.toThrow(/read-your-writes transition/);

    const zeroCall = contract.batch([{ function: 'write', args: [0n, 10n] }]);
    const zeroBuilder = await zeroCall.build();
    const zeroVm = createVirtualMachineBch2026ForProvider(provider);
    const zeroTransaction = zeroBuilder.buildLibauthTransaction();
    const zeroSourceOutputs = generateLibauthSourceOutputs(zeroBuilder.inputs);
    for (let inputIndex = 0; inputIndex < zeroTransaction.inputs.length; inputIndex += 1) {
      expect(zeroVm.stateSuccess(zeroVm.evaluate({
        inputIndex, sourceOutputs: zeroSourceOutputs, transaction: zeroTransaction,
      })), `zero-trip input ${inputIndex}`).toBe(true);
    }
    await expect(zeroCall.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const call = contract.batch([{ function: 'write', args: [3n, 10n] }]);

    for (let build = 0; build < 2; build += 1) {
      const builder = await call.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `build ${build}, input ${inputIndex}`).toBe(true);
      }
    }

    const hostileBuilder = await call.build();
    const routeInputIndex = hostileBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = hostileBuilder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const routePermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationInput!.name);
    expect(routePermutationIndex).toBeGreaterThanOrEqual(0);
    const routeJournalIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === '__internal__kernelJournalAccessStreams');
    expect(routeJournalIndex).toBeGreaterThanOrEqual(0);
    const routeRecordIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === '__internal__kernelJournalRecords');
    expect(routeRecordIndex).toBeGreaterThanOrEqual(0);
    const rowJournalVectors = routeUnlocker.params[routeJournalIndex];
    if (!Array.isArray(rowJournalVectors) || !Array.isArray(rowJournalVectors[0])
      || !(rowJournalVectors[0][0] instanceof Uint8Array)) {
      throw new Error('expected row-indexed compiler-derived journal access streams');
    }
    const journalRecords = routeUnlocker.params[routeRecordIndex];
    if (!Array.isArray(journalRecords) || !(journalRecords[0] instanceof Uint8Array)) {
      throw new Error('expected compiler-derived journal records');
    }
    expect(decodeKernelEntryJournalAccesses(rowJournalVectors[0][0])).toEqual([
      { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: true, mutates: true,
        authenticatesPredecessor: true },
      { targetRecordOrdinal: 2, predecessorRecordOrdinal: 1, presentBefore: false, presentAfter: true, mutates: true },
      { targetRecordOrdinal: 3, predecessorRecordOrdinal: 2, presentBefore: false, presentAfter: true, mutates: true },
    ]);
    const originalRouteUnlocker = routeUnlocker;
    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const rowPermutations = routeUnlocker.params[routePermutationIndex];
    if (!Array.isArray(rowPermutations) || !Array.isArray(rowPermutations[0])) {
      throw new Error('expected row-indexed compiler-derived permutations');
    }
    const originalPermutation = rowPermutations[0];
    if (!Array.isArray(originalPermutation) || originalPermutation.length !== 3) {
      throw new Error('expected a three-element compiler-derived permutation');
    }
    const validButWrongOrder = [...originalPermutation];
    [validButWrongOrder[0], validButWrongOrder[1]] = [validButWrongOrder[1], validButWrongOrder[0]];
    const hostilePermutations = [
      [0n, 1n], // wrong length
      [0n, 0n, 2n], // duplicate
      [0n, 1n, 3n], // out of range
      [0n, 1n, -1n], // negative
      validButWrongOrder, // a complete permutation which disagrees with the physical entry ordering
    ];
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    for (const hostilePermutation of hostilePermutations) {
      const hostileRouteParams = [...routeUnlocker.params];
      hostileRouteParams[routePermutationIndex] = [hostilePermutation];
      hostileBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileRouteParams);
      const transaction = hostileBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(hostileBuilder.inputs);
      expect(hostileVm.stateSuccess(hostileVm.evaluate({
        inputIndex: routeInputIndex, sourceOutputs, transaction,
      })), `hostile permutation ${hostilePermutation.join(',')}`).not.toBe(true);
    }
    const originalAccessStream = rowJournalVectors[0][0];
    const wrongTag = new Uint8Array(originalAccessStream);
    wrongTag[0] = 0x07;
    const wrongCollection = new Uint8Array(originalAccessStream);
    wrongCollection[2] ^= 0x01;
    const wrongCount = new Uint8Array(originalAccessStream);
    wrongCount[1] = 2;
    const truncated = originalAccessStream.slice(0, -1);
    const unknownFlags = new Uint8Array(originalAccessStream);
    unknownFlags[22] |= 0x80;
    const reservedTarget = new Uint8Array(originalAccessStream);
    reservedTarget[23] = 0xff;
    reservedTarget[24] = 0xff;
    const nonCanonicalPredecessor = new Uint8Array(originalAccessStream);
    nonCanonicalPredecessor[22] &= ~0x04;
    const aliasedPredecessor = new Uint8Array(originalAccessStream);
    aliasedPredecessor[25] = aliasedPredecessor[23];
    aliasedPredecessor[26] = aliasedPredecessor[24];
    const outOfRangeTarget = new Uint8Array(originalAccessStream);
    outOfRangeTarget[23] = journalRecords.length & 0xff;
    outOfRangeTarget[24] = journalRecords.length >>> 8;
    const wrongTargetRecord = new Uint8Array(originalAccessStream);
    wrongTargetRecord[23] = 2;
    wrongTargetRecord[24] = 0;
    const wrongPredecessorRecord = new Uint8Array(originalAccessStream);
    // The second insertion's real predecessor is the first pending target (record 1), not the HEAD (record 0).
    wrongPredecessorRecord[30] = 0;
    wrongPredecessorRecord[31] = 0;
    const falsePresentBefore = new Uint8Array(originalAccessStream);
    falsePresentBefore[22] |= 0x01;
    const falsePresentAfter = new Uint8Array(originalAccessStream);
    falsePresentAfter[22] &= ~0x02;
    const falseMutationIntent = new Uint8Array(originalAccessStream);
    falseMutationIntent[22] &= ~0x08;
    const missingPhysicalAuthentication = new Uint8Array(originalAccessStream);
    missingPhysicalAuthentication[22] &= ~0x20;
    const wrongPhysicalAuthentication = new Uint8Array(originalAccessStream);
    wrongPhysicalAuthentication[22] = (wrongPhysicalAuthentication[22] & ~0x20) | 0x10;
    const duplicatePhysicalAuthentication = new Uint8Array(originalAccessStream);
    duplicatePhysicalAuthentication[27] |= 0x20;
    const outOfRangePredecessor = new Uint8Array(originalAccessStream);
    outOfRangePredecessor[25] = journalRecords.length & 0xff;
    outOfRangePredecessor[26] = journalRecords.length >>> 8;
    for (const [label, hostileStream] of [
      ['wrong tag', wrongTag], ['wrong collection', wrongCollection],
      ['wrong count', wrongCount], ['truncated payload', truncated],
      ['unknown flags', unknownFlags], ['reserved target', reservedTarget],
      ['non-canonical predecessor', nonCanonicalPredecessor], ['aliased predecessor', aliasedPredecessor],
      ['wrong target record', wrongTargetRecord],
      ['wrong predecessor record', wrongPredecessorRecord],
      ['false present-before state', falsePresentBefore], ['false present-after state', falsePresentAfter],
      ['false mutation intent', falseMutationIntent],
      ['missing physical authentication', missingPhysicalAuthentication],
      ['wrong physical authentication', wrongPhysicalAuthentication],
      ['duplicate physical authentication', duplicatePhysicalAuthentication],
      ['out-of-range target', outOfRangeTarget], ['out-of-range predecessor', outOfRangePredecessor],
    ] as const) {
      const hostileRouteParams = [...routeUnlocker.params];
      hostileRouteParams[routeJournalIndex] = [[hostileStream]];
      hostileBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileRouteParams);
      const transaction = hostileBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(hostileBuilder.inputs);
      expect(hostileVm.stateSuccess(hostileVm.evaluate({
        inputIndex: routeInputIndex, sourceOutputs, transaction,
      })), `hostile journal stream: ${label}`).not.toBe(true);
    }
    const emptyAccessStream = originalAccessStream.slice(0, 22);
    emptyAccessStream[1] = 0;
    for (const [label, hostileStreams] of [
      ['missing stream', []],
      ['extra stream', [originalAccessStream, emptyAccessStream]],
    ] as const) {
      const hostileRouteParams = [...routeUnlocker.params];
      hostileRouteParams[routeJournalIndex] = [hostileStreams];
      hostileBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileRouteParams);
      const transaction = hostileBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(hostileBuilder.inputs);
      expect(hostileVm.stateSuccess(hostileVm.evaluate({
        inputIndex: routeInputIndex, sourceOutputs, transaction,
      })), `hostile journal vector: ${label}`).not.toBe(true);
    }
    const hostileRecord = (mutate: (record: Uint8Array) => Uint8Array): Uint8Array[] =>
      journalRecords.map((record, index) => index === 0
        ? mutate(new Uint8Array(record as Uint8Array)) : new Uint8Array(record as Uint8Array));
    const wrongTargetSlot = journalRecords.map((record, index) => {
      const copy = new Uint8Array(record as Uint8Array);
      if (index === 1) copy[22] ^= 0x01;
      return copy;
    });
    const wrongPredecessorSlot = hostileRecord((record) => { record[22] ^= 0x01; return record; });
    const oversizedRecord = new Uint8Array(151);
    oversizedRecord.set(journalRecords[0].slice(0, Math.min(journalRecords[0].length, 151)));
    const valueTombstone = new Uint8Array((journalRecords[0] as Uint8Array).length + 1);
    valueTombstone.set(journalRecords[0] as Uint8Array); valueTombstone[1] = 0x07;
    const nonzeroAbsentSuccessor = hostileRecord((record) => {
      record[1] = 0x0c; record[54] = 1; return record;
    });
    const wrongPhysicalSuccessor = hostileRecord((record) => { record[54] ^= 0x01; return record; });
    const wrongPhysicalValue = hostileRecord((record) => {
      const copy = new Uint8Array(record.length + 1); copy.set(record); copy[copy.length - 1] = 1; return copy;
    });
    for (const [label, hostileRecords] of [
      ['missing records', []],
      ['extra records', [...journalRecords, new Uint8Array(journalRecords[0] as Uint8Array)]],
      ['wrong tag', hostileRecord((record) => { record[0] = 0x04; return record; })],
      ['wrong collection', hostileRecord((record) => { record[2] ^= 0x01; return record; })],
      ['wrong target slot', wrongTargetSlot],
      ['wrong predecessor slot', wrongPredecessorSlot],
      ['truncated header', hostileRecord((record) => record.slice(0, 85))],
      ['oversized value', hostileRecord(() => oversizedRecord)],
      ['unknown flags', hostileRecord((record) => { record[1] |= 0x80; return record; })],
      ['authenticated synthetic', hostileRecord((record) => { record[1] = 0x09; return record; })],
      ['unauthenticated non-synthetic', hostileRecord((record) => { record[1] = 0; return record; })],
      ['physical record relabeled synthetic', hostileRecord((record) => { record[1] = 0x0a; return record; })],
      ['clean synthetic live', hostileRecord((record) => { record[1] = 0x08; return record; })],
      ['clean tombstone', hostileRecord((record) => { record[1] = 0x04; return record; })],
      ['value-bearing tombstone', hostileRecord(() => valueTombstone)],
      ['nonzero absent successor', nonzeroAbsentSuccessor],
      ['wrong physical successor', wrongPhysicalSuccessor],
      ['wrong physical value', wrongPhysicalValue],
    ] as const) {
      const hostileRouteParams = [...routeUnlocker.params];
      hostileRouteParams[routeRecordIndex] = hostileRecords;
      hostileBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileRouteParams);
      const transaction = hostileBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(hostileBuilder.inputs);
      expect(hostileVm.stateSuccess(hostileVm.evaluate({
        inputIndex: routeInputIndex, sourceOutputs, transaction,
      })), `hostile journal record: ${label}`).not.toBe(true);
    }
    const reorderedRecords = journalRecords.map((record) => new Uint8Array(record as Uint8Array));
    [reorderedRecords[1], reorderedRecords[2]] = [reorderedRecords[2], reorderedRecords[1]];
    const reorderedStream = new Uint8Array(originalAccessStream);
    // Rewrite every affected reference so record identities, slots, and topology remain coherent. Only the
    // carrier first-touch order is hostile: a verifier which merely trusts self-consistent ordinals accepts it.
    [reorderedStream[23], reorderedStream[24]] = [2, 0];
    [reorderedStream[28], reorderedStream[29]] = [1, 0];
    [reorderedStream[30], reorderedStream[31]] = [2, 0];
    [reorderedStream[35], reorderedStream[36]] = [1, 0];
    const reorderedParams = [...routeUnlocker.params];
    reorderedParams[routeJournalIndex] = [[reorderedStream]];
    reorderedParams[routeRecordIndex] = reorderedRecords;
    hostileBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...reorderedParams);
    const reorderedTransaction = hostileBuilder.buildLibauthTransaction();
    const reorderedSources = generateLibauthSourceOutputs(hostileBuilder.inputs);
    expect(hostileVm.stateSuccess(hostileVm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs: reorderedSources, transaction: reorderedTransaction,
    })), 'hostile journal execution order').not.toBe(true);
    hostileBuilder.inputs[routeInputIndex].unlocker = originalRouteUnlocker;

    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (let key = 0; key < 3; key += 1) {
      await expect(
        StatefulContract.withCategory(inner, categoryId).check(BigInt(key), 10n).send(),
      ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    // Mapping delete is a default-value write, not a linked-list splice. Its journal access must therefore retain
    // presence and select only the existing target record; inventing a predecessor here would give the future flush
    // protocol different topology from the verified mapping covenant which actually executes this row.
    const clearBuilder = await contract.batch([{ function: 'clear', args: [3n] }]).build();
    const clearRouteInput = clearBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!clearRouteInput || !('params' in clearRouteInput.unlocker)) {
      throw new Error('clear row has no compiler route parameters');
    }
    const clearJournalVectors = clearRouteInput.unlocker.params[routeJournalIndex];
    if (!Array.isArray(clearJournalVectors) || !Array.isArray(clearJournalVectors[0])
      || !(clearJournalVectors[0][0] instanceof Uint8Array)) {
      throw new Error('clear row has no compiler-derived journal access stream');
    }
    expect(decodeKernelEntryJournalAccesses(clearJournalVectors[0][0])).toEqual([
      expect.objectContaining({ presentBefore: true, presentAfter: true }),
      expect.objectContaining({ presentBefore: true, presentAfter: true }),
      expect.objectContaining({ presentBefore: true, presentAfter: true }),
    ]);
    expect(decodeKernelEntryJournalAccesses(clearJournalVectors[0][0])
      .every((access) => access.predecessorRecordOrdinal === undefined)).toBe(true);

    const repeatedClear = contract.batch([
      { function: 'clear', args: [3n] },
      { function: 'clear', args: [3n] },
    ]);
    await expect(repeatedClear.build()).rejects.toThrow(/read-your-writes transition/);
  }, 180_000);

  it('settles ascending and descending counter rows written with increment operators', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelIncrementLoops() {
      mapping(int => int) slots;
      function ascending(int n) public {
        for (int i = 0; i < n; i++) { this.slots[i] = i + 10; }
        require(true);
      }
      function descending(int n) public {
        for (int i = 5; i >= n; --i) { this.slots[i + 10] = i + 20; }
        require(true);
      }
      function check(int key, int expected) public { require(this.slots[key] == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'ascending'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'descending'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'ascending', args: [3n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(0n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.check(2n, 12n).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'descending', args: [3n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(15n, 25n).send()).resolves.toBeDefined();
    await expect(contract.call.check(13n, 23n).send()).resolves.toBeDefined();
  }, 180_000);

  it('reads disjoint fixed and runtime entries from the same mapping as a write stream', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SAME_MAPPING_FIXED_READ_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [0] });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
      .toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(100n, 7n).send();
    await expect(contract.call.write(3n, 100n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const [key, expected] of [[0n, 7n], [1n, 8n], [2n, 9n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    }

    const updated = StatefulContract.withCategory(inner, categoryId);
    await expect(updated.call.write(2n, 0n).build()).rejects
      .toThrow(/read-your-writes transition/);

    await contract.call.seed(101n, 8n).send();
    await contract.call.seed(102n, 9n).send();
    await expect(updated.call.copy(3n, 100n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const [key, expected] of [[0n, 8n], [1n, 9n], [2n, 10n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    }
    // Logical key disjointness is not enough for an absent source: its authenticated predecessor may be one of
    // the destination entries. Until pending-output journal transitions are available, that physical overlap
    // must fail closed even though none of the requested source keys equals a destination key.
    await expect(contract.call.copy(3n, 200n).build()).rejects
      .toThrow(/read-your-writes transition/);
    await expect(StatefulContract.withCategory(inner, categoryId).call.copy(2n, 1n).build()).rejects
      .toThrow(/read-your-writes transition/);
  }, 180_000);

  it('authenticates and persists counter-keyed mapping-array pushes and element writes', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_ARRAY_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    for (const [name, mutation] of [['pushMany', 'push'], ['setMany', 'setAt']] as const) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
      expect(artifact.abi.find((handler) => handler.name === name)?.sortedUpsertLoopInfo?.[0])
        .toMatchObject({ collection: 'values', mutation });
    }
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    await expect(contract.batch([{ function: 'pushMany', args: [3n, 7n] }]).send())
      .resolves.toBeDefined();
    const secondPush = contract.batch([{ function: 'pushMany', args: [3n, 8n] }]);
    const hostileBuilder = await secondPush.build();
    const routeInputIndex = hostileBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = hostileBuilder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const pushInfo = artifact.abi.find((handler) => handler.name === 'pushMany')!.sortedUpsertLoopInfo![0];
    const witnessRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === pushInfo.oldValuesWitnessParam);
    expect(witnessRouteIndex).toBeGreaterThanOrEqual(0);
    expect(routeUnlocker.params[witnessRouteIndex]).toEqual([[[7n], [7n], [7n]]]);
    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[witnessRouteIndex] = [[[999n], [7n], [7n]]];
    hostileBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    expect(hostileVm.stateSuccess(hostileVm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(hostileBuilder.inputs),
      transaction: hostileBuilder.buildLibauthTransaction(),
    }))).not.toBe(true);
    hostileBuilder.inputs[routeInputIndex].unlocker = routeUnlocker;
    await expect(secondPush.send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'setMany', args: [3n, 0n, 9n] }]).send())
      .resolves.toBeDefined();

    const entries = await contract.getEntries('values');
    const valueAt = (key: bigint): unknown => entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    for (let key = 0n; key < 3n; key += 1n) expect(valueAt(key)).toEqual([9n, 8n]);
  }, 180_000);

  it('authenticates and persists counter-keyed mapping-array pops', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_ARRAY_POP_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'popMany'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'popMany')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({ collection: 'values', mutation: 'pop' });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    await contract.batch([{ function: 'pushMany', args: [2n, 4n] }]).send();
    await contract.batch([{ function: 'pushMany', args: [2n, 5n] }]).send();
    await expect(contract.batch([{ function: 'popMany', args: [2n] }]).send())
      .resolves.toBeDefined();

    const entries = await contract.getEntries('values');
    const valueAt = (key: bigint): unknown => entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    for (let key = 0n; key < 2n; key += 1n) expect(valueAt(key)).toEqual([4n]);
    await expect(contract.batch([{ function: 'popMany', args: [3n] }]).build())
      .rejects.toThrow(/pop from empty array/);
  }, 180_000);

  it('moves counter-keyed mapping arrays across the inline/chunked boundary', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_ARRAY_CHUNK_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const first = hexToBin('11'.repeat(32));
    const second = hexToBin('22'.repeat(32));

    await expect(contract.batch([{ function: 'pushMany', args: [2n, first] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'pushMany', args: [2n, second] }]).send())
      .resolves.toBeDefined();

    const entries = await contract.getEntries('values');
    for (let key = 0n; key < 2n; key += 1n) {
      const value = entries.find((entry) =>
        binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
      expect((value as Uint8Array[]).map(binToHex)).toEqual([binToHex(first), binToHex(second)]);
    }
  }, 180_000);

  it('keeps public mutation operand arrays in logical source order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_ARRAY_VALUES_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    const push = artifact.abi.find((handler) => handler.name === 'pushEach')!;
    expect(push.sortedUpsertLoopInfo?.[0]).toMatchObject({
      mutation: 'push',
      mutationValueArrayParam: 'additions',
      mutationValueArrayIndexParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
    });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const additions = [101n, 202n, 303n, 404n];
    await expect(contract.batch([{ function: 'pushEach', args: [4n, additions] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'pushExpression', args: [4n, 500n] }]).send())
      .resolves.toBeDefined();

    const entries = await contract.getEntries('values');
    for (let key = 0n; key < 4n; key += 1n) {
      const value = entries.find((entry) =>
        binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
      expect(value).toEqual([additions[Number(key)], 500n + key * 2n]);
    }
  }, 180_000);

  it('chains repeated mapping-array keys through the pending row value', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_ARRAY_DUPLICATE_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pushAliased'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    await expect(contract.batch([{ function: 'pushAliased', args: [4n] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'pushAliased', args: [4n] }]).send())
      .resolves.toBeDefined();

    const third = contract.batch([{ function: 'pushAliased', args: [4n] }]);
    const hostileBuilder = await third.build();
    const routeInputIndex = hostileBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = hostileBuilder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const info = artifact.abi.find((handler) => handler.name === 'pushAliased')!.sortedUpsertLoopInfo![0];
    const witnessRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === info.oldValuesWitnessParam);
    expect(witnessRouteIndex).toBeGreaterThanOrEqual(0);
    const honestWitness = routeUnlocker.params[witnessRouteIndex] as bigint[][][];
    expect(honestWitness[0]).toEqual(expect.arrayContaining([
      [0n, 2n, 0n, 2n], [0n, 2n, 0n, 2n, 0n],
      [1n, 3n, 1n, 3n], [1n, 3n, 1n, 3n, 1n],
    ]));
    const hostileWitness = honestWitness.map((row) => row.map((value) => [...value]));
    hostileWitness[0][1] = [999n];
    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[witnessRouteIndex] = hostileWitness;
    hostileBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    expect(hostileVm.stateSuccess(hostileVm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(hostileBuilder.inputs),
      transaction: hostileBuilder.buildLibauthTransaction(),
    }))).not.toBe(true);
    hostileBuilder.inputs[routeInputIndex].unlocker = routeUnlocker;
    await expect(third.send()).resolves.toBeDefined();

    const entries = await contract.getEntries('values');
    const valueAt = (key: bigint): unknown => entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect(valueAt(0n)).toEqual([0n, 2n, 0n, 2n, 0n, 2n]);
    expect(valueAt(1n)).toEqual([1n, 3n, 1n, 3n, 1n, 3n]);
  }, 180_000);

  it('chains a repeated mapping-array key across its chunk threshold', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_ARRAY_DUPLICATE_CHUNK_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const value = hexToBin('5a'.repeat(32));

    await expect(contract.batch([{ function: 'pushAliased', args: [3n, value] }]).send())
      .resolves.toBeDefined();

    const entries = await contract.getEntries('values');
    expect(entries).toHaveLength(1);
    expect((entries[0].value as Uint8Array[]).map(binToHex))
      .toEqual([binToHex(value), binToHex(value), binToHex(value)]);
  }, 180_000);
});

describe('kernel direct-selector coexistence', () => {
  it('keeps the selector on a sole public function when the hidden route is also executable', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOLE_FUNCTION_SOURCE, KERNEL);
    expect(artifact.abi).toHaveLength(1);
    expect(artifact.messageBus?.available).toBe(true);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.call.set(7n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(StatefulContract.withCategory(inner, categoryId).getState()).resolves.toMatchObject({ x: 7n });

    const preAvailableArtifact = structuredClone(artifact);
    delete preAvailableArtifact.messageBus!.available;
    const preAvailableInner = new Contract(preAvailableArtifact, [], { provider });
    await expect(
      StatefulContract.withCategory(preAvailableInner, categoryId).call.set(9n).send(),
    ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(
      StatefulContract.withCategory(preAvailableInner, categoryId).getState(),
    ).resolves.toMatchObject({ x: 9n });
  }, 180_000);
});

describe('kernel composite counter-key settlement', () => {
  it('settles sequential counter loops over independent collection journals', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SEQUENTIAL_MULTI_MAPPING_SOURCE, KERNEL);
    const writeBoth = artifact.abi.find((candidate) => candidate.name === 'writeBoth')!;
    expect(writeBoth.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterPerm_')))
      .toHaveLength(2);
    expect(writeBoth.sortedUpsertLoopInfo?.map((info) => info.collection)).toEqual(['a', 'b']);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (let pass = 0; pass < 2; pass += 1) {
      const call = contract.batch([{ function: 'writeBoth', args: [3n, 8n] }]);
      const builder = await call.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `pass ${pass}, input ${inputIndex}`).toBe(true);
      }
      if (pass === 0) {
        const routeInputIndex = builder.inputs.findIndex((input) =>
          'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
        const outputWithValue = (value: number): number => transaction.outputs.findIndex((output) => {
          const commitment = output.token?.nft?.commitment;
          return commitment?.length === 65 && commitment.at(-1) === value;
        });
        const firstSegmentOutput = outputWithValue(10);
        const secondSegmentOutput = outputWithValue(22);
        expect(routeInputIndex).toBeGreaterThanOrEqual(0);
        expect(firstSegmentOutput).toBeGreaterThanOrEqual(0);
        expect(secondSegmentOutput).toBeGreaterThanOrEqual(0);
        const hostile = { ...transaction, outputs: [...transaction.outputs] };
        [hostile.outputs[firstSegmentOutput], hostile.outputs[secondSegmentOutput]] =
          [hostile.outputs[secondSegmentOutput], hostile.outputs[firstSegmentOutput]];
        expect(vm.stateSuccess(vm.evaluate({
          inputIndex: routeInputIndex, sourceOutputs, transaction: hostile,
        })), 'swapped disjoint journal segments').not.toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    const direct = StatefulContract.withCategory(inner, categoryId).call.writeBoth(3n, 8n);
    const directBuilder = await direct.build();
    const directVm = createVirtualMachineBch2026ForProvider(provider);
    const directTransaction = directBuilder.buildLibauthTransaction();
    const directSourceOutputs = generateLibauthSourceOutputs(directBuilder.inputs);
    for (let inputIndex = 0; inputIndex < directTransaction.inputs.length; inputIndex += 1) {
      expect(directVm.stateSuccess(directVm.evaluate({
        inputIndex, sourceOutputs: directSourceOutputs, transaction: directTransaction,
      })), `direct input ${inputIndex}`).toBe(true);
    }
    await expect(direct.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const key of [0n, 1n, 2n]) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.checkA(key, key + 10n).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    for (const key of [2n, 4n, 6n]) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.checkB(key, key + 20n).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
  }, 180_000);

  it('settles two nested counter-key collections for inserts and updates', async () => {
    const provider = createTestProvider();
    const artifact = compileString(NESTED_MULTI_MAPPING_SOURCE, KERNEL);
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(2);
    expect(write.sortedUpsertLoopInfo).toHaveLength(2);
    expect(new Set(write.sortedUpsertLoopInfo?.map((info) => info.varyingArrayParam)).size).toBe(2);
    expect(new Set(write.sortedUpsertLoopInfo?.map((info) => info.journalExecutionGroup)).size).toBe(1);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (let pass = 0; pass < 2; pass += 1) {
      const call = contract.batch([{ function: 'write', args: [41n, 42n, 3n] }]);
      const builder = await call.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const entryValues = transaction.outputs
        .map((output) => output.token?.nft?.commitment)
        .filter((commitment): commitment is Uint8Array => commitment?.length === 65)
        .map((commitment) => commitment.at(-1))
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(entryValues).toEqual([10, 11, 12, 20, 21, 22]);
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `pass ${pass}, input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
  }, 180_000);

  it('settles independently selected subsets across collections', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SELECTED_MULTI_MAPPING_SOURCE, KERNEL);
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(2);
    expect(write.sortedUpsertLoopInfo).toHaveLength(2);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (let pass = 0; pass < 2; pass += 1) {
      const call = contract.batch([{ function: 'write', args: [51n, 52n, 4n] }]);
      const builder = await call.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const entryValues = transaction.outputs
        .map((output) => output.token?.nft?.commitment)
        .filter((commitment): commitment is Uint8Array => commitment?.length === 65)
        .map((commitment) => commitment.at(-1))
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(entryValues).toEqual([10, 12, 21, 23]);
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `pass ${pass}, input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
  }, 180_000);

  it('settles a composite key with the counter in multiple positions', async () => {
    const provider = createTestProvider();
    const artifact = compileString(REPEATED_COUNTER_KEY_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({ varyingKeyIndices: [0, 2] }),
    ]);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (const functionName of ['write', 'transform']) {
      const call = contract.batch([{ function: functionName, args: [7n, 3n] }]);
      const builder = await call.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `${functionName}, input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    const valuesBySlot = new Map((await contract.getEntries('nested')).map((entry) => [
      binToHex(entry.slot), entry.value,
    ]));
    for (const [key, expected] of [[0n, 20n], [1n, 22n], [2n, 24n]]) {
      const slot = keyToSlotMulti([bigIntToVmNumber(key), bigIntToVmNumber(7n), bigIntToVmNumber(key)]);
      expect(valuesBySlot.get(binToHex(slot))).toBe(expected);
    }
  }, 180_000);

  it('settles a composite key component derived from the counter', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DERIVED_COUNTER_KEY_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const info = artifact.abi.find((candidate) => candidate.name === 'write')?.sortedUpsertLoopInfo?.[0];
    expect(info?.varyingKeyExpressions).toHaveLength(2);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'write', args: [8n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const valuesBySlot = new Map((await contract.getEntries('nested')).map((entry) => [
      binToHex(entry.slot), entry.value,
    ]));
    for (const [key, expected] of [[3n, 13n], [5n, 15n], [7n, 17n]]) {
      const slot = keyToSlotMulti([bigIntToVmNumber(key + 1n), bigIntToVmNumber(key)]);
      expect(valuesBySlot.get(binToHex(slot))).toBe(expected);
    }
  }, 180_000);

  it('settles repeated loop events in source order while mapping keys use the authenticated permutation', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_EVENT_SOURCE, KERNEL);
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.runtimeLoopEvents).toEqual([
      { repeatCount: 1, eventSignatures: ['Before(int256)'] },
      {
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_/),
        eventSignatures: ['Hit(int256)', 'Echo(int256)'],
      },
      { repeatCount: 1, eventSignatures: ['After(int256)'] },
    ]);
    expect(write.emits).toBeUndefined();
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(3 * 64 + 2);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible).toBe(true);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const eventCommitments = (
      builder: Awaited<ReturnType<ReturnType<typeof contract.call.write>['build']>>,
    ): string[] =>
      builder.buildLibauthTransaction().outputs
        .filter((output) => output.token?.nft?.capability === 'none')
        .map((output) => binToHex(output.token!.nft!.commitment));
    const assertEveryInput = (
      builder: Awaited<ReturnType<ReturnType<typeof contract.call.write>['build']>>,
    ): void => {
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `input ${inputIndex}`).toBe(true);
      }
    };

    // Sixteen iterations produce 32 records, which would exceed BCH's per-item size if the journal were one
    // concatenated vector. Keeping records as individual alt-stack items proves the representation scales past
    // that boundary.
    const directCount = 16;
    const direct = contract.call.write(BigInt(directCount));
    const directBuilder = await direct.build();
    expect(eventCommitments(directBuilder)).toHaveLength(directCount * 2 + 2);
    assertEveryInput(directBuilder);
    const directReceipt = await direct.send();
    expect(directReceipt).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(directReceipt.events?.map((event) => [event.event, event.args.i])).toEqual([
      ['Before', BigInt(directCount)],
      ...Array.from({ length: directCount }, (_unused, index) => [
        ['Hit', BigInt(index)], ['Echo', BigInt(index)],
      ]).flat(),
      ['After', BigInt(directCount)],
    ]);

    const zero = contract.batch([{ function: 'write', args: [0n] }]);
    const zeroBuilder = await zero.build();
    expect(eventCommitments(zeroBuilder)).toEqual(['00', '00']);
    assertEveryInput(zeroBuilder);

    const batch = contract.batch([{ function: 'write', args: [3n] }]);
    const batchBuilder = await batch.build();
    expect(eventCommitments(batchBuilder)).toEqual(['53', '00', '00', '51', '51', '52', '52', '53']);
    assertEveryInput(batchBuilder);

    const routeInputIndex = batchBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const hostileEvents = batchBuilder.outputs
      .map((output, index) => ({ output, index }))
      .filter(({ output }) => output.token?.nft?.capability === 'none');
    expect(hostileEvents).toHaveLength(8);
    [hostileEvents[1].output.token!.nft!.commitment, hostileEvents[3].output.token!.nft!.commitment] = [
      hostileEvents[3].output.token!.nft!.commitment,
      hostileEvents[1].output.token!.nft!.commitment,
    ];
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    const hostileTransaction = batchBuilder.buildLibauthTransaction();
    const hostileSources = generateLibauthSourceOutputs(batchBuilder.inputs);
    expect(hostileVm.stateSuccess(hostileVm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: hostileSources,
      transaction: hostileTransaction,
    }))).not.toBe(true);

    await expect(contract.batch([
      { function: 'write', args: [1n] },
      { function: 'write', args: [1n] },
    ]).build()).rejects.toThrow(/read-your-writes transition/);
  }, 180_000);

  it('evaluates an effectful repeated-event argument once in logical source order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(EFFECTFUL_EVENT_ARGUMENT_SOURCE, KERNEL);
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.runtimeLoopEvents).toEqual([
      {
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_count_/),
        eventSignatures: ['Hit(int256)'],
      },
    ]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    const direct = await contract.call.write(3n).send();
    expect(direct.events?.map((event) => [event.event, event.args.value])).toEqual([
      ['Hit', 1n], ['Hit', 12n], ['Hit', 23n],
    ]);
    await expect(contract.getState()).resolves.toMatchObject({ calls: 3n });

    const routed = await contract.batch([{ function: 'write', args: [2n] }]).send();
    expect(routed.events?.map((event) => [event.event, event.args.value])).toEqual([
      ['Hit', 4n], ['Hit', 15n],
    ]);
    await expect(contract.getState()).resolves.toMatchObject({ calls: 5n });
  }, 180_000);

  it('evaluates an effectful repeated-transfer argument once in logical source order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(EFFECTFUL_TRANSFER_ARGUMENT_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.runtimeLoopTransfers)
      .toEqual([expect.objectContaining({
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_count_/),
        siteCount: 1,
      })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay'))
      .toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const boundInner = inner.withCategory(hexToBin(categoryId));
    await provider.addUtxo(getSatoshiContainerAddress(boundInner, categoryId), {
      txid: 'bc'.repeat(32), vout: 1, satoshis: 50_000n,
    });
    const contract = StatefulContract.withCategory(boundInner, categoryId);
    const recipientFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const recipient = recipientFunder.unlocker.generateLockingBytecode();
    const paidAmounts = (builder: Awaited<ReturnType<ReturnType<typeof contract.call.pay>['build']>>): bigint[] =>
      builder.buildLibauthTransaction().outputs.filter((output) =>
        binToHex(output.lockingBytecode) === binToHex(recipient)).map((output) => output.valueSatoshis);

    const direct = contract.call.pay(2n, recipient);
    expect(paidAmounts(await direct.build())).toEqual([2001n, 2012n]);
    await direct.send();
    await expect(contract.getState()).resolves.toMatchObject({ calls: 2n });

    const routed = contract.batch([{ function: 'pay', args: [2n, recipient] }]);
    expect(paidAmounts(await routed.build())).toEqual([2003n, 2014n]);
    await routed.send();
    await expect(contract.getState()).resolves.toMatchObject({ calls: 4n });
  }, 180_000);

  it('settles repeated BCH transfers after the permuted mapping journal', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_TRANSFER_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const pay = artifact.abi.find((candidate) => candidate.name === 'pay')!;
    expect(pay.runtimeLoopTransfers).toEqual([
      { permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_/), siteCount: 1 },
    ]);
    const payPaths = artifact.abi.find((candidate) => candidate.name === 'payPaths')!;
    expect(payPaths.runtimeLoopTransfers).toEqual([
      expect.objectContaining({
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_/),
        siteCount: 2,
        conditions: [expect.any(Object), null],
      }),
    ]);
    const payMixed = artifact.abi.find((candidate) => candidate.name === 'payMixed')!;
    expect(payMixed.runtimeLoopEvents).toEqual([
      expect.objectContaining({ effectSequence: 0, effectOrder: [0, 2] }),
    ]);
    expect(payMixed.runtimeLoopTransfers).toEqual([
      expect.objectContaining({ effectSequence: 0, effectOrder: [1] }),
    ]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')?.eligible).toBe(true);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const boundInner = inner.withCategory(hexToBin(categoryId));
    await provider.addUtxo(getSatoshiContainerAddress(boundInner, categoryId), {
      txid: 'bd'.repeat(32), vout: 1, satoshis: 50_000n,
    });
    const contract = StatefulContract.withCategory(boundInner, categoryId);
    const recipientFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const recipient = recipientFunder.unlocker.generateLockingBytecode();

    const zeroBuilder = await contract.batch([{ function: 'pay', args: [0n, recipient] }]).build();
    const zeroTransaction = zeroBuilder.buildLibauthTransaction();
    expect(zeroTransaction.outputs.some((output) =>
      binToHex(output.lockingBytecode) === binToHex(recipient))).toBe(false);
    const zeroVm = createVirtualMachineBch2026ForProvider(provider);
    const zeroSources = generateLibauthSourceOutputs(zeroBuilder.inputs);
    for (let inputIndex = 0; inputIndex < zeroTransaction.inputs.length; inputIndex += 1) {
      expect(zeroVm.stateSuccess(zeroVm.evaluate({
        inputIndex, sourceOutputs: zeroSources, transaction: zeroTransaction,
      })), `zero input ${inputIndex}`).toBe(true);
    }

    const call = contract.batch([{ function: 'pay', args: [3n, recipient] }]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const payments = transaction.outputs.filter((output) =>
      binToHex(output.lockingBytecode) === binToHex(recipient));
    expect(payments.map((output) => output.valueSatoshis)).toEqual([2000n, 2001n, 2002n]);
    expect(transaction.outputs.some((output) =>
      binToHex(output.lockingBytecode)
        === binToHex(addressToLockScript(getSatoshiContainerAddress(boundInner, categoryId)))
      && output.valueSatoshis === 43_997n)).toBe(true);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }

    const hostile = await contract.batch([{ function: 'pay', args: [3n, recipient] }]).build();
    const hostileTransaction = hostile.buildLibauthTransaction();
    const hostilePayment = hostileTransaction.outputs.find((output) =>
      binToHex(output.lockingBytecode) === binToHex(recipient));
    expect(hostilePayment).toBeDefined();
    hostilePayment!.valueSatoshis += 1n;
    const hostileSources = generateLibauthSourceOutputs(hostile.inputs);
    const hostileRoute = hostile.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: hostileRoute, sourceOutputs: hostileSources, transaction: hostileTransaction,
    }))).not.toBe(true);

    const pathsBuilder = await contract.batch([{ function: 'payPaths', args: [3n, recipient] }]).build();
    const pathsTransaction = pathsBuilder.buildLibauthTransaction();
    const pathPayments = pathsTransaction.outputs.filter((output) =>
      binToHex(output.lockingBytecode) === binToHex(recipient));
    expect(pathPayments.map((output) => output.valueSatoshis)).toEqual([4000n, 3001n, 4001n, 4002n]);
    const pathSources = generateLibauthSourceOutputs(pathsBuilder.inputs);
    for (let inputIndex = 0; inputIndex < pathsTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: pathSources, transaction: pathsTransaction,
      })), `paths input ${inputIndex}`).toBe(true);
    }

    const zeroMixedBuilder = await contract.batch([
      { function: 'payMixed', args: [0n, recipient] },
    ]).build();
    const zeroMixedTransaction = zeroMixedBuilder.buildLibauthTransaction();
    expect(zeroMixedTransaction.outputs.filter((output) =>
      binToHex(output.lockingBytecode) === binToHex(recipient)
      || output.token?.nft?.capability === 'none')).toHaveLength(0);
    const zeroMixedSources = generateLibauthSourceOutputs(zeroMixedBuilder.inputs);
    for (let inputIndex = 0; inputIndex < zeroMixedTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: zeroMixedSources, transaction: zeroMixedTransaction,
      })), `zero mixed input ${inputIndex}`).toBe(true);
    }

    const mixedBuilder = await contract.batch([{ function: 'payMixed', args: [2n, recipient] }]).build();
    const mixedTransaction = mixedBuilder.buildLibauthTransaction();
    const mixedEffects = mixedTransaction.outputs.filter((output) =>
      binToHex(output.lockingBytecode) === binToHex(recipient)
      || output.token?.nft?.capability === 'none');
    expect(mixedEffects.map((output) =>
      binToHex(output.lockingBytecode) === binToHex(recipient)
        ? `pay:${output.valueSatoshis}` : 'event')).toEqual([
      'event', 'pay:5000', 'event', 'event', 'pay:5001', 'event',
    ]);
    const mixedSources = generateLibauthSourceOutputs(mixedBuilder.inputs);
    for (let inputIndex = 0; inputIndex < mixedTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: mixedSources, transaction: mixedTransaction,
      })), `mixed input ${inputIndex}`).toBe(true);
    }

    const hostileMixedTransaction = mixedBuilder.buildLibauthTransaction();
    const hostileMixedIndices = hostileMixedTransaction.outputs
      .map((output, index) => ({ output, index }))
      .filter(({ output }) => binToHex(output.lockingBytecode) === binToHex(recipient)
        || output.token?.nft?.capability === 'none')
      .map(({ index }) => index);
    expect(hostileMixedIndices).toHaveLength(6);
    const [firstEventIndex, firstPaymentIndex] = hostileMixedIndices;
    [hostileMixedTransaction.outputs[firstEventIndex], hostileMixedTransaction.outputs[firstPaymentIndex]] = [
      hostileMixedTransaction.outputs[firstPaymentIndex], hostileMixedTransaction.outputs[firstEventIndex],
    ];
    const hostileMixedRoute = mixedBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: hostileMixedRoute, sourceOutputs: mixedSources, transaction: hostileMixedTransaction,
    }))).not.toBe(true);

    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('settles repeated fungible-token transfers and container conservation', async () => {
    const provider = createTestProvider();
    const artifact = compileString(
      RUNTIME_TOKEN_TRANSFER_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 },
    );
    const pay = artifact.abi.find((candidate) => candidate.name === 'pay')!;
    expect(pay.runtimeLoopTransfers).toEqual([expect.objectContaining({
      siteCount: 1, siteKinds: ['token'], tokenContainerSlots: [0],
    })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')?.eligible).toBe(true);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const token = await genesisFtContainer(provider, inner, categoryId, [100n]);
    const contract = StatefulContract.withCategory(inner, categoryId);
    const recipientFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const recipient = recipientFunder.unlocker.generateLockingBytecode();

    const zeroBuilder = await contract.batch([{
      function: 'pay', args: [0n, hexToBin(token.category), recipient],
    }]).build();
    const zeroTransaction = zeroBuilder.buildLibauthTransaction();
    expect(zeroTransaction.outputs.filter((output) => output.token
      && binToHex(output.token.category) === token.category
      && typeof output.lockingBytecode !== 'string'
      && binToHex(output.lockingBytecode) === binToHex(recipient))).toHaveLength(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const zeroSources = generateLibauthSourceOutputs(zeroBuilder.inputs);
    for (let inputIndex = 0; inputIndex < zeroTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: zeroSources, transaction: zeroTransaction,
      })), `zero token input ${inputIndex}`).toBe(true);
    }

    const builder = await contract.batch([{
      function: 'pay', args: [3n, hexToBin(token.category), recipient],
    }]).build();
    const transaction = builder.buildLibauthTransaction();
    const transfers = transaction.outputs.filter((output) => output.token
      && binToHex(output.token.category) === token.category
      && binToHex(output.lockingBytecode) === binToHex(recipient));
    expect(transfers.map((output) => output.token!.amount)).toEqual([2n, 3n, 4n]);
    expect(transaction.outputs.some((output) => output.token
      && binToHex(output.token.category) === token.category
      && output.token.amount === 91n)).toBe(true);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `token input ${inputIndex}`)
        .toBe(true);
    }

    const hostileTransaction = builder.buildLibauthTransaction();
    const hostileTransfer = hostileTransaction.outputs.find((output) => output.token
      && binToHex(output.token.category) === token.category
      && binToHex(output.lockingBytecode) === binToHex(recipient));
    expect(hostileTransfer).toBeDefined();
    hostileTransfer!.token!.amount += 1n;
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs, transaction: hostileTransaction,
    }))).not.toBe(true);
  }, 180_000);

  it('settles repeated NFT transfers and preserves a zero-trip container NFT', async () => {
    const provider = createTestProvider();
    const artifact = compileString(
      RUNTIME_NFT_TRANSFER_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 },
    );
    expect(artifact.abi.find((candidate) => candidate.name === 'send')?.runtimeLoopTransfers)
      .toEqual([expect.objectContaining({
        siteCount: 1, siteKinds: ['nft'], tokenContainerSlots: [0],
      })]);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const connectedInner = inner.withCategory(hexToBin(categoryId));
    const seeded = await provider.addTokenUtxosDynamic((category) => [{
      address: getTokenContainerAddress(connectedInner, categoryId, category),
      satoshis: 1200n,
      token: { amount: 0n, nft: { capability: 'minting', commitment: 'a1' } },
    }]);
    const contract = StatefulContract.withCategory(connectedInner, categoryId);
    const recipientFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const recipient = recipientFunder.unlocker.generateLockingBytecode();
    const category = hexToBin(seeded.categoryId);

    const zeroBuilder = await contract.batch([{
      function: 'send', args: [0n, category, recipient, hexToBin('c0ffee'), 0n],
    }]).build();
    const zeroTransaction = zeroBuilder.buildLibauthTransaction();
    expect(zeroTransaction.outputs.some((output) => output.token
      && binToHex(output.token.category) === seeded.categoryId
      && output.token.nft?.capability === 'minting'
      && binToHex(output.token.nft.commitment) === 'a1')).toBe(true);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const zeroSources = generateLibauthSourceOutputs(zeroBuilder.inputs);
    for (let inputIndex = 0; inputIndex < zeroTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: zeroSources, transaction: zeroTransaction,
      })), `zero NFT input ${inputIndex}`).toBe(true);
    }
    const hostileZero = zeroBuilder.buildLibauthTransaction();
    const hostileZeroContainer = hostileZero.outputs.find((output) => output.token
      && binToHex(output.token.category) === seeded.categoryId
      && output.token.nft?.capability === 'minting');
    expect(hostileZeroContainer).toBeDefined();
    delete hostileZeroContainer!.token!.nft;
    const zeroRouteInputIndex = zeroBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: zeroRouteInputIndex, sourceOutputs: zeroSources, transaction: hostileZero,
    }))).not.toBe(true);

    const builder = await contract.batch([{
      function: 'send', args: [2n, category, recipient, hexToBin('c0ffee'), 0n],
    }]).build();
    const transaction = builder.buildLibauthTransaction();
    const transfers = transaction.outputs.filter((output) => output.token
      && binToHex(output.token.category) === seeded.categoryId
      && output.token.nft && binToHex(output.token.nft.commitment) === 'c0ffee'
      && binToHex(output.lockingBytecode) === binToHex(recipient));
    expect(transfers).toHaveLength(2);
    expect(transfers.every((output) => output.token?.nft?.capability === 'none')).toBe(true);
    expect(transaction.outputs.some((output) => output.token
      && binToHex(output.token.category) === seeded.categoryId
      && output.token.nft?.capability === 'minting')).toBe(true);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs, transaction,
      })), `NFT input ${inputIndex}`).toBe(true);
    }

    const hostile = builder.buildLibauthTransaction();
    const hostileOutput = hostile.outputs.find((output) => output.token
      && binToHex(output.token.category) === seeded.categoryId
      && output.token.nft && binToHex(output.token.nft.commitment) === 'c0ffee');
    expect(hostileOutput).toBeDefined();
    hostileOutput!.token!.nft!.commitment = hexToBin('bad0');
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs, transaction: hostile,
    }))).not.toBe(true);

    const immutable = await provider.addTokenUtxosDynamic((immutableCategory) => [{
      address: getTokenContainerAddress(connectedInner, categoryId, immutableCategory),
      satoshis: 1200n,
      token: { amount: 0n, nft: { capability: 'none', commitment: 'f1' } },
    }]);
    await expect(contract.batch([{
      function: 'send',
      args: [2n, hexToBin(immutable.categoryId), recipient, hexToBin('f2'), 0n],
    }]).build()).rejects.toThrow(/non-minting container .* more than once/);
  }, 180_000);

  it('tracks conditional runtime NFT occurrence independently for each container', async () => {
    const provider = createTestProvider();
    const artifact = compileString(
      CONDITIONAL_RUNTIME_NFT_TRANSFER_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 },
    );
    const split = artifact.abi.find((candidate) => candidate.name === 'split')!;
    expect(split.runtimeLoopTransfers).toEqual([expect.objectContaining({
      siteCount: 2, siteKinds: ['nft', 'nft'], tokenContainerSlots: [0, 1],
      conditions: [expect.anything(), expect.anything()],
    })]);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const connectedInner = inner.withCategory(hexToBin(categoryId));
    const even = await provider.addTokenUtxosDynamic((category) => [{
      address: getTokenContainerAddress(connectedInner, categoryId, category),
      satoshis: 1200n,
      token: { amount: 0n, nft: { capability: 'minting', commitment: 'e0' } },
    }]);
    const odd = await provider.addTokenUtxosDynamic((category) => [{
      address: getTokenContainerAddress(connectedInner, categoryId, category),
      satoshis: 1200n,
      token: { amount: 0n, nft: { capability: 'minting', commitment: '0d' } },
    }]);
    const contract = StatefulContract.withCategory(connectedInner, categoryId);
    const evenFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const oddFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const evenRecipient = evenFunder.unlocker.generateLockingBytecode();
    const oddRecipient = oddFunder.unlocker.generateLockingBytecode();
    const builder = await contract.batch([{
      function: 'split',
      args: [
        1n, hexToBin(even.categoryId), hexToBin(odd.categoryId),
        evenRecipient, oddRecipient, hexToBin('cafe'),
      ],
    }]).build();
    const transaction = builder.buildLibauthTransaction();
    expect(transaction.outputs.filter((output) => output.token
      && binToHex(output.token.category) === even.categoryId
      && output.token.nft && binToHex(output.token.nft.commitment) === 'cafe'
      && binToHex(output.lockingBytecode) === binToHex(evenRecipient))).toHaveLength(1);
    expect(transaction.outputs.filter((output) => output.token
      && binToHex(output.token.category) === odd.categoryId
      && output.token.nft && binToHex(output.token.nft.commitment) === 'cafe'
      && binToHex(output.lockingBytecode) === binToHex(oddRecipient))).toHaveLength(0);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `NFT input ${inputIndex}`)
        .toBe(true);
    }

    // The odd branch was not reached. Removing that unrelated container's NFT must therefore remain invalid;
    // a route-wide "some NFT site exists" flag would incorrectly authorize this burn.
    const hostile = builder.buildLibauthTransaction();
    const oddContainer = hostile.outputs.find((output) => output.token
      && binToHex(output.token.category) === odd.categoryId
      && output.token.nft?.capability === 'minting');
    expect(oddContainer).toBeDefined();
    delete oddContainer!.token!.nft;
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: routeInputIndex, sourceOutputs, transaction: hostile })))
      .not.toBe(true);
  }, 180_000);

  it('evaluates an effectful repeated-token amount once in logical source order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(EFFECTFUL_TOKEN_TRANSFER_ARGUMENT_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.runtimeLoopTransfers)
      .toEqual([expect.objectContaining({ siteCount: 1, siteKinds: ['token'] })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay'))
      .toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const token = await genesisFtContainer(provider, inner, categoryId, [100n]);
    const contract = StatefulContract.withCategory(inner, categoryId);
    const recipientFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const recipient = recipientFunder.unlocker.generateLockingBytecode();
    const transferredAmounts = (
      builder: Awaited<ReturnType<ReturnType<typeof contract.call.pay>['build']>>,
    ): bigint[] => builder.buildLibauthTransaction().outputs.filter((output) => output.token
      && binToHex(output.token.category) === token.category
      && binToHex(output.lockingBytecode) === binToHex(recipient)).map((output) => output.token!.amount);
    const args = [2n, hexToBin(token.category), recipient] as const;

    const first = contract.batch([{ function: 'pay', args: [...args] }]);
    expect(transferredAmounts(await first.build())).toEqual([3n, 5n]);
    await first.send();
    await expect(contract.getState()).resolves.toMatchObject({ calls: 2n });

    const second = contract.batch([{ function: 'pay', args: [...args] }]);
    expect(transferredAmounts(await second.build())).toEqual([5n, 7n]);
    await second.send();
    await expect(contract.getState()).resolves.toMatchObject({ calls: 4n });
  }, 180_000);

  it('composes a derived-key row and an independent row against one token-container remainder', async () => {
    const provider = createTestProvider();
    const artifact = compileString(
      RUNTIME_TOKEN_TRANSFER_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 },
    );
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const token = await genesisFtContainer(provider, inner, categoryId, [100n]);
    const contract = StatefulContract.withCategory(inner, categoryId);
    const recipientFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const recipient = recipientFunder.unlocker.generateLockingBytecode();

    const builder = await contract.batch([
      { function: 'payAt', args: [10n, 2n, hexToBin(token.category), recipient] },
      { function: 'payOther', args: [2n, hexToBin(token.category), recipient] },
    ]).build();
    const transaction = builder.buildLibauthTransaction();
    const transfers = transaction.outputs.filter((output) => output.token
      && binToHex(output.token.category) === token.category
      && binToHex(output.lockingBytecode) === binToHex(recipient));
    expect(transfers.map((output) => output.token!.amount)).toEqual([2n, 3n, 2n, 3n]);
    expect(transaction.outputs.some((output) => output.token
      && binToHex(output.token.category) === token.category && output.token.amount === 90n)).toBe(true);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `token input ${inputIndex}`)
        .toBe(true);
    }
  }, 180_000);

  it('settles conditional runtime token sites across independent containers in source order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(
      CONDITIONAL_RUNTIME_TOKEN_TRANSFER_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 },
    );
    const split = artifact.abi.find((candidate) => candidate.name === 'split')!;
    expect(split.runtimeLoopTransfers).toEqual([expect.objectContaining({
      siteCount: 2, siteKinds: ['token', 'token'], tokenContainerSlots: [0, 1],
      conditions: [expect.anything(), expect.anything()],
    })]);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const evenToken = await genesisFtContainer(provider, inner, categoryId, [100n]);
    const oddToken = await genesisFtContainer(provider, inner, categoryId, [100n]);
    const contract = StatefulContract.withCategory(inner, categoryId);
    const evenFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const oddFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const evenRecipient = evenFunder.unlocker.generateLockingBytecode();
    const oddRecipient = oddFunder.unlocker.generateLockingBytecode();

    const builder = await contract.batch([{
      function: 'split',
      args: [
        4n, hexToBin(evenToken.category), hexToBin(oddToken.category), evenRecipient, oddRecipient,
      ],
    }]).build();
    const transaction = builder.buildLibauthTransaction();
    const runtimeTransfers = transaction.outputs.filter((output) => output.token
      && ((binToHex(output.token.category) === evenToken.category
          && binToHex(output.lockingBytecode) === binToHex(evenRecipient))
        || (binToHex(output.token.category) === oddToken.category
          && binToHex(output.lockingBytecode) === binToHex(oddRecipient))));
    expect(runtimeTransfers.map((output) => ({
      category: binToHex(output.token!.category), amount: output.token!.amount,
    }))).toEqual([
      { category: evenToken.category, amount: 1n },
      { category: oddToken.category, amount: 2n },
      { category: evenToken.category, amount: 3n },
      { category: oddToken.category, amount: 4n },
    ]);
    expect(transaction.outputs.some((output) => output.token
      && binToHex(output.token.category) === evenToken.category && output.token.amount === 96n)).toBe(true);
    expect(transaction.outputs.some((output) => output.token
      && binToHex(output.token.category) === oddToken.category && output.token.amount === 94n)).toBe(true);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `token input ${inputIndex}`)
        .toBe(true);
    }
  }, 180_000);

  it('plans conditional event paths for direct and routed counter rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(CONDITIONAL_COUNTER_EVENT_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(handler.runtimeLoopEvents).toHaveLength(3);
    expect(handler.runtimeLoopEvents?.every((segment) => segment.conditions?.[0])).toBe(true);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const direct = await contract.call.write(4n, true, true).send();
    expect(direct.events?.map((event) => event.args.i)).toEqual([-1n, 1n, 3n]);

    const routed = contract.batch([{ function: 'write', args: [2n, false, false] }]);
    const builder = await routed.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    const receipt = await routed.send();
    expect(receipt.events?.map((event) => event.args.i)).toEqual([-2n]);
  }, 180_000);

  it('settles independent mapping journals and event streams in physical row order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(INDEPENDENT_ROW_LOOP_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.filter((handler) =>
      handler.name === 'writeA' || handler.name === 'writeB'))
      .toEqual([expect.objectContaining({ eligible: true }), expect.objectContaining({ eligible: true })]);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([
      { function: 'writeB', args: [2n] },
      { function: 'writeA', args: [3n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `independent-row input ${inputIndex}`).toBe(true);
    }
    const receipt = await call.send();
    expect(receipt.events?.map((event) => [event.event, event.args.n ?? event.args.i])).toEqual([
      ['BBefore', 2n], ['BHit', 0n], ['BHit', 1n], ['BAfter', 2n],
      ['ABefore', 3n], ['AHit', 0n], ['AHit', 1n], ['AHit', 2n], ['AAfter', 3n],
    ]);
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkB(1n, 21n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkA(2n, 12n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('settles repeated and zero-trip rows in one physical collection with a shared cardinality witness', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DISJOINT_SAME_COLLECTION_ROWS_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.filter((handler) => handler.name === 'writeA' || handler.name === 'writeB'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'writeA', eligible: true }),
        expect.objectContaining({ name: 'writeB', eligible: true }),
      ]));
    const cardinalityInputs = [
      '__internal__vmapRuntimeInputCount_values',
      '__internal__vmapRuntimeOutputCount_values',
    ];
    for (const name of ['writeA', 'writeB']) {
      const handler = artifact.abi.find((candidate) => candidate.name === name)!;
      expect(handler.inputs.map((input) => input.name)).toEqual(expect.arrayContaining(cardinalityInputs));
    }
    expect(artifact.messageBus!.route.inputs.map((input) => input.name))
      .toEqual(expect.arrayContaining(cardinalityInputs));
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (const group of [1n, 2n, 3n, 4n, 5n, 6n, 7n]) {
      const keys = group === 3n ? [0n, 1n, 10n, 11n] : [0n, 1n];
      if (group === 5n) keys.push(2n, 3n);
      for (const key of keys) {
        await contract.call.seed(group, key, 1n).send();
      }
    }
    for (const key of [0n, 1n, 2n, 3n, 4n, 5n]) {
      await contract.call.seed(9n, key, 1n).send();
    }
    const call = contract.batch([
      { function: 'writeB', args: [2n, 20n] },
      { function: 'writeA', args: [0n, 99n] },
      { function: 'writeA', args: [2n, 10n] },
    ]);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const updated = StatefulContract.withCategory(inner, categoryId);
    await expect(updated.call.check(2n, 1n, 20n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(1n, 0n, 10n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.writeSequential(2n, 12n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(3n, 1n, 30n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(3n, 11n, 31n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.writeOverlap(2n).build()).rejects.toThrow(/read-your-writes transition/);
    await expect(updated.call.writeDescending(-1n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(5n, 0n, 50n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(5n, 3n, 53n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.writeAlias(2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(6n, 0n, 60n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(6n, 1n, 61n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.transform(7n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(7n, 0n, 6n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(7n, 1n, 7n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const shapes = artifact.abi.find((candidate) => candidate.name === 'writeShapes')!;
    expect(shapes.sortedUpsertLoopInfo).toHaveLength(2);
    expect(new Set(shapes.sortedUpsertLoopInfo?.map((info) => info.varyingArrayParam)).size).toBe(2);
    expect(new Set(shapes.sortedUpsertLoopInfo?.map((info) => info.journalExecutionGroup)).size).toBe(1);
    const shapeCall = updated.call.writeShapes(3n, 80n);
    const shapeBuilder = await shapeCall.build();
    const shapeInput = shapeBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === 'writeShapes');
    if (!shapeInput || !('params' in shapeInput.unlocker)) throw new Error('shape input missing');
    for (const info of shapes.sortedUpsertLoopInfo ?? []) {
      const inputIndex = shapes.inputs.findIndex((input) => input.name === info.inputCountParam);
      const outputIndex = shapes.inputs.findIndex((input) => input.name === info.outputCountParam);
      expect(shapeInput.unlocker.params[inputIndex]).toBe(3n);
      expect(shapeInput.unlocker.params[outputIndex]).toBe(3n);
    }
    await expect(shapeCall.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const routedShapes = updated.batch([{ function: 'writeShapes', args: [3n, 100n] }]);
    const routedShapeBuilder = await routedShapes.build();
    const routedShapeInputIndex = routedShapeBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const routedShapeUnlocker = routedShapeBuilder.inputs[routedShapeInputIndex]?.unlocker;
    if (!routedShapeUnlocker || !('params' in routedShapeUnlocker)) throw new Error('shape route input missing');
    const firstCountName = shapes.sortedUpsertLoopInfo![0].inputCountParam!;
    const firstCountRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) => input.name === firstCountName);
    expect(routedShapeUnlocker.params[firstCountRouteIndex]).toEqual([3n]);
    const restoreRoutedShapeUnlocker = routedShapeUnlocker.contract.createCompilerRouteUnlocker(
      routedShapeUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    );
    const hostileShapeParams = [...routedShapeUnlocker.params];
    hostileShapeParams[firstCountRouteIndex] = [2n];
    routedShapeBuilder.inputs[routedShapeInputIndex].unlocker = restoreRoutedShapeUnlocker(...hostileShapeParams);
    const hostileShapeVm = createVirtualMachineBch2026ForProvider(provider);
    const hostileShapeTransaction = routedShapeBuilder.buildLibauthTransaction();
    expect(hostileShapeVm.stateSuccess(hostileShapeVm.evaluate({
      inputIndex: routedShapeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(routedShapeBuilder.inputs),
      transaction: hostileShapeTransaction,
    }))).not.toBe(true);
    routedShapeBuilder.inputs[routedShapeInputIndex].unlocker = routedShapeUnlocker;
    await expect(routedShapes.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (let i = 0n; i < 3n; i += 1n) {
      await expect(updated.call.check(9n, i * 2n, 100n + i).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
      await expect(updated.call.check(9n, i * 2n + 1n, 110n + i).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const conditionalLocal = artifact.abi.find((candidate) => candidate.name === 'writeConditionalLocal')!;
    expect(conditionalLocal.sortedUpsertLoopInfo?.[0]).toMatchObject({
      iterationCondition: { kind: 'ternary' }, valueRuntimeExpression: true,
    });
    await expect(updated.call.writeConditionalLocal(5n, 200n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.batch([{ function: 'writeConditionalLocal', args: [5n, 300n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const key of [0n, 2n, 4n]) {
      await expect(updated.call.check(10n, key, 300n + key).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const nestedConditional = artifact.abi.find((candidate) => candidate.name === 'writeNestedConditionalLocal')!;
    expect(nestedConditional.sortedUpsertLoopInfo?.[0]).toMatchObject({
      iterationCondition: { kind: 'ternary' }, valueRuntimeExpression: true,
    });
    await expect(updated.call.writeNestedConditionalLocal(5n, 400n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.batch([{ function: 'writeNestedConditionalLocal', args: [5n, 500n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 500n], [1n, 511n], [3n, 513n], [4n, 504n]]) {
      await expect(updated.call.check(11n, key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const runtimeStep = artifact.abi.find((candidate) => candidate.name === 'writeRuntimeStep')!;
    expect(runtimeStep.sortedUpsertLoopInfo?.[0]).toMatchObject({
      iterationStep: { kind: 'source' }, iterationCondition: { kind: 'binary' },
    });
    await expect(updated.call.writeRuntimeStep(8n, 2n, 600n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.batch([{ function: 'writeRuntimeStep', args: [8n, 2n, 700n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const key of [1n, 5n, 7n]) {
      await expect(updated.call.check(12n, key, 700n + key).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(updated.call.check(12n, 3n, 0n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.writeRuntimeStep(8n, 0n, 800n).send())
      .rejects.toThrow(/runtime step must advance toward its bound/);

    const runtimeStepDown = artifact.abi.find((candidate) => candidate.name === 'writeRuntimeStepDown')!;
    expect(runtimeStepDown.sortedUpsertLoopInfo?.[0]).toMatchObject({
      iterationStep: { kind: 'binary', operator: '-' },
    });
    await expect(updated.call.writeRuntimeStepDown(0n, 2n, 800n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.batch([{ function: 'writeRuntimeStepDown', args: [0n, 2n, 900n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const key of [9n, 6n, 3n]) {
      await expect(updated.call.check(13n, key, 900n + key).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    await expect(updated.call.writeInclusive(5n, 1_000n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.batch([{ function: 'writeInclusive', args: [5n, 1_100n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const key of [1n, 3n, 5n]) {
      await expect(updated.call.check(14n, key, 1_100n + key).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(updated.call.writeInclusiveDown(1n, 1_200n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.batch([{ function: 'writeInclusiveDown', args: [1n, 1_300n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const key of [5n, 3n, 1n]) {
      await expect(updated.call.check(15n, key, 1_300n + key).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(updated.call.writeWhile(6n, 2n, 1_400n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.batch([{ function: 'writeWhile', args: [6n, 2n, 1_500n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const key of [1n, 3n, 5n]) {
      await expect(updated.call.check(16n, key, 1_500n + key).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const repeated = updated.batch([{ function: 'transform', args: [7n, 2n] }]);
    const hostileBuilder = await repeated.build();
    const routeInputIndex = hostileBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = hostileBuilder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const oldValueInput = artifact.abi.find((candidate) => candidate.name === 'transform')!.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterOld_'))!;
    const oldValueRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === oldValueInput.name);
    expect(oldValueRouteIndex).toBeGreaterThanOrEqual(0);
    const transformAbi = artifact.abi.find((candidate) => candidate.name === 'transform')!;
    const permutationName = transformAbi.sortedUpsertLoopInfo?.[0].varyingArrayParam;
    const permutationRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationName);
    expect(permutationRouteIndex).toBeGreaterThanOrEqual(0);
    const rowPermutations = routeUnlocker.params[permutationRouteIndex] as bigint[][];
    // Old-value witnesses use the same physical settlement order as the authenticated key permutation.
    expect(routeUnlocker.params[oldValueRouteIndex]).toEqual([
      rowPermutations[0].map((key) => key + 6n),
    ]);
    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[oldValueRouteIndex] = [[999n, ...(routeUnlocker.params[oldValueRouteIndex] as bigint[][])[0]
      .slice(1)]];
    hostileBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    const hostileTransaction = hostileBuilder.buildLibauthTransaction();
    const hostileSourceOutputs = generateLibauthSourceOutputs(hostileBuilder.inputs);
    expect(hostileVm.stateSuccess(hostileVm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs: hostileSourceOutputs, transaction: hostileTransaction,
    }))).not.toBe(true);
    hostileBuilder.inputs[routeInputIndex].unlocker = routeUnlocker;

    await expect(repeated.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(7n, 0n, 12n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(7n, 1n, 14n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    await expect(updated.batch([{ function: 'transform', args: [8n, 2n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(8n, 0n, 5n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(8n, 1n, 6n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('settles source-order typed calls beside a permuted mapping loop', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sinkArtifact = compileString(COUNTER_MAPPING_TYPED_CALLEE_SOURCE, KERNEL);
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sinkInner = sinkBase.withCategory(hexToBin(sinkSetup.categoryId));
    const sink = StatefulContract.withCategory(sinkInner, sinkSetup.categoryId);

    const callerArtifact = compileString(COUNTER_MAPPING_TYPED_CALLER_SOURCE, KERNEL);
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'invoke')?.eligible).toBe(true);
    expect(callerArtifact.abi.find((entry) => entry.name === 'invoke')?.externalCalls?.[0])
      .toMatchObject({ occurrence: 'loop' });
    const callerBase = new Contract(callerArtifact, [sinkInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(6n, 1n), sink.call.ping(1n), sink.call.ping(3n), sink.call.ping(5n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const entryValues = transaction.outputs
      .map((output) => output.token?.nft?.commitment)
      .filter((commitment): commitment is Uint8Array => commitment?.length === 65)
      .map((commitment) => commitment.at(-1))
      .sort((left, right) => (left ?? 0) - (right ?? 0));
    expect(entryValues).toEqual([11, 13, 15]);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `input ${inputIndex}`).toBe(true);
    }

    const wrongOrder = messageBus.compose({
      calls: [caller.call.invoke(6n, 1n), sink.call.ping(3n), sink.call.ping(1n), sink.call.ping(5n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(wrongOrder.build()).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const updateFee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const update = messageBus.compose({
      calls: [caller.call.invoke(6n, 1n), sink.call.ping(1n), sink.call.ping(3n), sink.call.ping(5n)],
      funder: updateFee,
      changeAddress: updateFee.unlocker.generateLockingBytecode(),
    });
    const updateBuilder = await update.build();
    const updateTransaction = updateBuilder.buildLibauthTransaction();
    const updateSourceOutputs = generateLibauthSourceOutputs(updateBuilder.inputs);
    for (let inputIndex = 0; inputIndex < updateTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: updateSourceOutputs, transaction: updateTransaction,
      })), `update input ${inputIndex}`).toBe(true);
    }
    await expect(update.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('settles the mandatory first iteration of a do-while row at n=0', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sinkArtifact = compileString(COUNTER_MAPPING_TYPED_CALLEE_SOURCE, KERNEL);
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sinkInner = sinkBase.withCategory(hexToBin(sinkSetup.categoryId));
    const sink = StatefulContract.withCategory(sinkInner, sinkSetup.categoryId);

    const callerArtifact = compileString(COUNTER_MAPPING_DO_TYPED_CALLER_SOURCE, KERNEL);
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'invoke')?.eligible).toBe(true);
    expect(callerArtifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_') && input.name.endsWith('_post'))).toBe(true);
    const callerBase = new Contract(callerArtifact, [sinkInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const evaluateAndSend = async (n: bigint): Promise<void> => {
      const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
      const calls = Array.from({ length: Number(n > 0n ? n : 1n) }, (_unused, index) =>
        sink.call.ping(BigInt(index)));
      const composition = messageBus.compose({
        calls: [caller.call.invoke(n), ...calls],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
      });
      const builder = await composition.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `n=${n}, input ${inputIndex}`).toBe(true);
      }
      await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    };

    await evaluateAndSend(0n);
    await expect(caller.call.check(0n, 10n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await evaluateAndSend(3n);
    for (let key = 0; key < 3; key += 1) {
      await expect(caller.call.check(BigInt(key), BigInt(key + 10)).send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    }

    const runtimeHandler = callerArtifact.abi.find((candidate) => candidate.name === 'invokeRuntime')!;
    expect(runtimeHandler.sortedUpsertLoopInfo?.[0]?.iterationStep)
      .toMatchObject({ kind: 'source', source: { kind: 'forward', paramIndex: 1 } });
    expect(runtimeHandler.externalCalls?.[0].argSources?.[0]).toMatchObject({
      kind: 'loopIndex', initialValue: '1', stepExpression: { kind: 'source' },
    });
    const runtimeFee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const runtimeComposition = messageBus.compose({
      calls: [
        caller.call.invokeRuntime(6n, 2n),
        sink.call.ping(1n), sink.call.ping(3n), sink.call.ping(5n),
      ],
      funder: runtimeFee,
      changeAddress: runtimeFee.unlocker.generateLockingBytecode(),
    });
    const runtimeBuilder = await runtimeComposition.build();
    const runtimeVm = createVirtualMachineBch2026ForProvider(provider);
    const runtimeTransaction = runtimeBuilder.buildLibauthTransaction();
    const runtimeSources = generateLibauthSourceOutputs(runtimeBuilder.inputs);
    for (let inputIndex = 0; inputIndex < runtimeTransaction.inputs.length; inputIndex += 1) {
      expect(runtimeVm.stateSuccess(runtimeVm.evaluate({
        inputIndex, sourceOutputs: runtimeSources, transaction: runtimeTransaction,
      })), `runtime-step input ${inputIndex}`).toBe(true);
    }
    await expect(runtimeComposition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const key of [1n, 3n, 5n]) {
      await expect(caller.call.check(key, key + 10n).send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    }
  }, 180_000);

  it('settles a descending ranged do-while domain', async () => {
    const provider = createTestProvider();
    const artifact = compileString(RANGED_DO_COUNTER_SOURCE, KERNEL);
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.inputs.some((input) => /_from_p5_step_n2_post$/.test(input.name))).toBe(true);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'write', args: [0n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const valuesBySlot = new Map((await contract.getEntries('m')).map((entry) => [
      binToHex(entry.slot), entry.value,
    ]));
    for (const [key, expected] of [[5n, 25n], [3n, 23n], [1n, 21n]]) {
      expect(valuesBySlot.get(binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))).toBe(expected);
    }
  }, 180_000);

  it('authenticates old structs and persists counter-keyed row updates', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_STRUCT_RMW_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'update'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(0n, 10n, 20n).send();
    await contract.call.seed(1n, 30n, 40n).send();

    const call = contract.batch([{ function: 'update', args: [3n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      expect(vm.stateSuccess(state), `input ${inputIndex}`).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(0n, 11n, 22n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 31n, 42n).send()).resolves.toBeDefined();
    await expect(contract.call.check(2n, 1n, 2n).send()).resolves.toBeDefined();
  }, 180_000);

  it('authenticates direct structural expressions for present and absent counter keys', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_DIRECT_STRUCT_RMW_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'update'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(0n, 10n, 20n).send();

    const call = contract.batch([{ function: 'update', args: [2n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      expect(vm.stateSuccess(state), `input ${inputIndex}`).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const entries = await contract.getEntries('pairs');
    const valueAt = (key: bigint): unknown => entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect(valueAt(0n)).toEqual({ left: 11n, right: 22n });
    expect(valueAt(1n)).toEqual({ left: 1n, right: 2n });
  }, 180_000);

  it('keeps a fixed mapping read authenticated beside counter-keyed inserts', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_FIXED_MAPPING_READ_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.filter((handler) => ['seed', 'fill', 'check'].includes(handler.name)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'seed', eligible: true }),
        expect.objectContaining({ name: 'fill', eligible: true }),
        expect.objectContaining({ name: 'check', eligible: true }),
      ]));
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(42n).send();
    const call = contract.batch([{ function: 'fill', args: [3n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const key of [0n, 1n, 2n]) {
      await expect(contract.call.check(key, 42n).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it('coalesces immutable default-array keys into one authenticated entry update', async () => {
    const provider = createTestProvider();
    const artifact = compileString(IMMUTABLE_DEFAULT_KEY_ARRAY_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.call.write(0n).send()).resolves.toBeDefined();
    await expect(contract.call.write(3n).send()).resolves.toBeDefined();
    await expect(contract.call.write(0n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles runtime-sized local key arrays with dominating writes', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DOMINATING_LOCAL_KEY_ARRAY_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.call.write(2n, 5n, 3n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(contract.call.check(5n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.check(3n, 11n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles constructed keys after read-only array and value helper calls', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelReadOnlyArrayEscape() {
      mapping(int => int) slots;
      function inspect(int[] xs) internal pure returns (int) { return xs.length; }
      function inspectScalar(int value) internal pure returns (int) { return value; }
      function write(int n, int first) public {
        int[] xs = new int[](n);
        xs[0] = first;
        int observedLength = inspect(xs);
        int observedFirst = inspectScalar(xs[0]);
        for (int i = 0; i < n; i = i + 1) {
          this.slots[xs[i]] = observedLength + observedFirst;
        }
        require(true);
      }
      function check(int key, int expected) public { require(this.slots[key] == expected); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'write', args: [2n, 5n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(5n, 7n).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 7n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles fixed constructed-array push recurrences inside a ranged kernel loop', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelLoopArrayPush() {
      mapping(int => int) slots;
      function write(int n) public {
        int[] xs = new int[](0);
        for (int i = 1; i < n; i = i + 2) {
          xs.push(i + 10);
          this.slots[xs[((i - 1) / 2) * 2]] = i;
          xs.push(i + 20);
          this.slots[xs[((i - 1) / 2) * 2 + 1]] = i + 100;
        }
        require(true);
      }
      function prefix(int n) public {
        int[] xs = new int[](3);
        xs[0] = 31; xs[1] = 32; xs[2] = 33;
        for (int i = 0; i < n; i = i + 1) {
          this.slots[xs[i]] = i + 1;
          xs.push(i + 30);
        }
        require(true);
      }
      function defaultPrefix(int n) public {
        int[] xs = new int[](n);
        for (int i = 0; i < n; i = i + 1) {
          this.slots[xs[i]] = i + 1;
          xs.push(i + 40);
        }
        require(true);
      }
      function conditional(int n) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) xs.push(i + 50);
          else xs.push(i + 60);
          this.slots[xs[i]] = i + 1;
        }
        require(true);
      }
      function conditionalSwitch(int n) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          switch (i % 2) {
            case 0: xs.push(i + 70); break;
            default: xs.push(i + 80);
          }
          this.slots[xs[i]] = i + 1;
        }
        require(true);
      }
      function seed(int key) public { this.slots[key] = 0; require(true); }
      function check(int key, int expected) public { require(this.slots[key] == expected); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'prefix'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'defaultPrefix'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'conditional'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'conditionalSwitch'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (const key of [11n, 21n, 13n, 23n, 15n, 25n]) {
      await contract.call.seed(key).send();
    }
    const call = contract.batch([{ function: 'write', args: [6n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [
      [11n, 1n], [21n, 101n], [13n, 3n], [23n, 103n], [15n, 5n], [25n, 105n],
    ] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    for (const key of [31n, 32n, 33n]) await contract.call.seed(key).send();
    await expect(contract.batch([{ function: 'prefix', args: [3n] }]).send()).resolves.toBeDefined();
    for (const [key, expected] of [[31n, 1n], [32n, 2n], [33n, 3n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    await contract.call.seed(0n).send();
    await expect(contract.batch([{ function: 'defaultPrefix', args: [3n] }]).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 3n).send()).resolves.toBeDefined();
    for (const key of [50n, 61n, 52n, 63n]) await contract.call.seed(key).send();
    await expect(contract.batch([{ function: 'conditional', args: [4n] }]).send()).resolves.toBeDefined();
    for (const [key, expected] of [[50n, 1n], [61n, 2n], [52n, 3n], [63n, 4n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    for (const key of [70n, 81n, 72n, 83n]) await contract.call.seed(key).send();
    await expect(contract.batch([{ function: 'conditionalSwitch', args: [4n] }]).send()).resolves.toBeDefined();
    for (const [key, expected] of [[70n, 1n], [81n, 2n], [72n, 3n], [83n, 4n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it('preserves every occurrence when counter-derived keys repeat', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelRepeatedCounterKey() {
      mapping(int => int) slots;
      function write(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          this.slots[i % 2] = i + 10;
        }
        require(true);
      }
      function setInvariant(int n, int value) public {
        for (int i = 0; i < n; i = i + 1) { this.slots[i % 2] = value; }
        require(true);
      }
      function add(int n) public {
        for (int i = 0; i < n; i = i + 1) { this.slots[i % 2] += i + 1; }
        require(true);
      }
      function clear(int n) public {
        for (int i = 0; i < n; i = i + 1) { delete this.slots[i % 2]; }
        require(true);
      }
      function seed(int key) public { this.slots[key] = 0; require(true); }
      function check(int key, int expected) public { require(this.slots[key] == expected); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(0n).send();
    await contract.call.seed(1n).send();
    const call = contract.batch([{ function: 'write', args: [4n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(0n, 12n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 13n).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'setInvariant', args: [4n, 20n] }]).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'add', args: [4n] }]).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 24n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 26n).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'clear', args: [4n] }]).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 0n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 0n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles a constructed-array pop recurrence inside a kernel loop', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelLoopArrayPop() {
      mapping(int => int) slots;
      function write(int n) public {
        int[] xs = new int[](4);
        xs[0] = 11; xs[1] = 12; xs[2] = 13; xs[3] = 14;
        for (int i = 0; i < n; i = i + 1) {
          xs.pop();
          this.slots[xs[2 - i]] = i + 100;
        }
        require(true);
      }
      function conditionalPop(int n) public {
        int[] xs = new int[](6);
        xs[0] = 11; xs[1] = 12; xs[2] = 13; xs[3] = 14; xs[4] = 15; xs[5] = 16;
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) xs.pop();
          else xs.pop();
          this.slots[xs[4 - i]] = i + 200;
        }
        require(true);
      }
      function variablePop(int n, bool twice) public {
        int[] xs = new int[](8);
        xs[0] = 11; xs[1] = 12; xs[2] = 13; xs[3] = 14;
        xs[4] = 15; xs[5] = 16; xs[6] = 17; xs[7] = 18;
        for (int i = 0; i < n; i = i + 1) {
          if (twice) { xs.pop(); xs.pop(); }
          else xs.pop();
          this.slots[xs[twice ? 5 - i * 2 : 6 - i]] = i + 300;
        }
        require(true);
      }
      function optionalPop(int n, bool shrink) public {
        int[] xs = new int[](8);
        xs[0] = 21; xs[1] = 22; xs[2] = 23; xs[3] = 24;
        xs[4] = 25; xs[5] = 26; xs[6] = 27; xs[7] = 28;
        for (int i = 0; i < n; i = i + 1) {
          if (shrink) xs.pop();
          this.slots[xs[shrink ? 6 - i : i]] = i + 400;
        }
        require(true);
      }
      function variablePush(int n, bool twice) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          if (twice) { xs.push(i + 40); xs.push(i + 50); }
          else xs.push(i + 60);
          this.slots[xs[twice ? i * 2 + 1 : i]] = i + 500;
        }
        require(true);
      }
      function seed(int key) public { this.slots[key] = 0; require(true); }
      function check(int key, int expected) public { require(this.slots[key] == expected); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'conditionalPop'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'variablePop'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'optionalPop'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'variablePush'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (const key of [11n, 12n, 13n]) await contract.call.seed(key).send();
    const call = contract.batch([{ function: 'write', args: [3n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[13n, 100n], [12n, 101n], [11n, 102n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    for (const key of [13n, 14n, 15n]) await contract.call.seed(key).send();
    await expect(contract.batch([{ function: 'conditionalPop', args: [3n] }]).send()).resolves.toBeDefined();
    for (const [key, expected] of [[15n, 200n], [14n, 201n], [13n, 202n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    for (const key of [14n, 16n, 17n]) await contract.call.seed(key).send();
    await expect(contract.batch([{ function: 'variablePop', args: [2n, true] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [[16n, 300n], [14n, 301n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    await expect(contract.batch([{ function: 'variablePop', args: [2n, false] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [[17n, 300n], [16n, 301n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    for (const key of [21n, 22n, 26n, 27n]) await contract.call.seed(key).send();
    await expect(contract.batch([{ function: 'optionalPop', args: [2n, true] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'optionalPop', args: [2n, false] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [[27n, 400n], [26n, 401n], [21n, 400n], [22n, 401n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    await expect(contract.batch([{ function: 'variablePush', args: [2n, true] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'variablePush', args: [2n, false] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [[50n, 500n], [51n, 501n], [60n, 500n], [61n, 501n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it('settles symbolic push widths, ordinals, and historical branch predicates', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelVariablePushSwitch() {
      mapping(int => int) slots;
      function write(int n, int mode) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          switch (mode) {
            case 0: xs.push(i + 70); break;
            case 1: xs.push(i + 80); xs.push(i + 90); break;
            default: xs.push(i + 100); xs.push(i + 110); xs.push(i + 120);
          }
          this.slots[xs[mode == 0 ? i : mode == 1 ? i * 2 + 1 : i * 3 + 2]] = i + 600;
        }
        require(true);
      }
      function historical(int n) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) xs.push(i + 130);
          else xs.push(i + 140);
          if (i > 0) this.slots[xs[i - 1]] = i + 700;
        }
        require(true);
      }
      function locals(int n) public {
        int[] xs = new int[](0);
        int key = 0;
        for (int i = 0; i < n; i = i + 1) {
          key = i + 200;
          bool high = i % 2 == 0;
          if (high) xs.push(key + 10); else xs.push(key + 20);
          this.slots[xs[i]] = i + 800;
        }
        require(true);
      }
      function joined(int n) public {
        int[] xs = new int[](0);
        int key = 0;
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) key = i + 300; else key = i + 400;
          xs.push(key);
          this.slots[xs[i]] = i + 900;
        }
        require(true);
      }
      function optional(int n, bool grow) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          if (grow) {
            xs.push(i + 800);
            this.slots[xs[i]] = i + 1000;
          }
        }
        require(true);
      }
      function check(int key, int expected) public { require(this.slots[key] == expected); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (const mode of [0n, 1n, 2n]) {
      await expect(contract.batch([{ function: 'write', args: [2n, mode] }]).send())
        .resolves.toBeDefined();
    }
    for (const key of [70n, 90n, 120n]) {
      await expect(contract.call.check(key, 600n).send()).resolves.toBeDefined();
      await expect(contract.call.check(key + 1n, 601n).send()).resolves.toBeDefined();
    }
    await expect(contract.batch([{ function: 'historical', args: [4n] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [[130n, 701n], [141n, 702n], [132n, 703n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    await expect(contract.batch([{ function: 'locals', args: [3n] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [[210n, 800n], [221n, 801n], [212n, 802n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    await expect(contract.batch([{ function: 'joined', args: [3n] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [[300n, 900n], [401n, 901n], [302n, 902n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
    await expect(contract.batch([{ function: 'optional', args: [3n, false] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'optional', args: [3n, true] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [[800n, 1000n], [801n, 1001n], [802n, 1002n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it('settles straight-line resized local key arrays on a kernel row', async () => {
    const provider = createTestProvider();
    const artifact = compileString(RESIZED_LOCAL_KEY_ARRAY_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'write', args: [0n, 17n, 29n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(17n, 1n).send()).resolves.toBeDefined();
    await expect(contract.call.check(29n, 2n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles constructed-key mutations replayed through a pure helper alias', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelHelperLocalKeys() {
      mapping(int => int) slots;
      function mutate(int[] memory xs, int next, bool high, int mode) internal pure {
        int index = 0;
        if (high) {
          if (mode == 9) { xs[index] = next + 20; } else { xs[index] = next; }
        } else { xs[index] = next + 10; }
        switch (mode) {
          case 0: xs[index + 1] = next + 1; break;
          default: xs[index + 1] = next + 2;
        }
      }
      function write(int n, int next, bool high, int mode) public {
        int[] memory xs = new int[](n);
        mutate(xs, next, high, mode);
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = i + 10; }
        require(true);
      }
      function check(int key, int expected) public { require(this.slots[key] == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'write', args: [2n, 700n, true, 0n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(700n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.check(701n, 11n).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'write', args: [2n, 800n, false, 1n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(810n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.check(802n, 11n).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'write', args: [2n, 900n, true, 9n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(920n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.check(902n, 11n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles source-ordered cross-array reads through distinct memory aliases', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelDistinctHelperAliases() {
      mapping(int => int) leftSlots;
      mapping(int => int) rightSlots;
      function mutate(int[] memory left, int[] memory right, int a, int b) internal pure {
        right[0] = b;
        left[0] = right[0] + a;
      }
      function copyLength(int[] memory left, int[] memory right) internal pure {
        right.push(7);
        left[0] = right.length;
      }
      function inner(int[] memory left, int[] memory right, int next) internal pure {
        right[0] = next;
        left[0] = right[0] + 1;
      }
      function outer(int[] memory first, int[] memory second, int next) internal pure {
        inner(first, second, next);
        second.push(next + 2);
        first[1] = second.length;
      }
      function mutateCopy(int[] copied, int[] memory target, int next) internal pure {
        copied[0] = next;
        target[0] = copied[0] + 1;
      }
      function outerCopy(int[] memory values, int next) internal pure {
        mutateCopy(values, values, next);
      }
      function mutateReturning(int[] memory values, int next) internal pure returns (int) {
        values[0] = next;
        return next + 1;
      }
      function outerCaptured(int[] memory values, int next) internal pure {
        int observed = mutateReturning(values, next);
        values[1] = observed;
      }
      function write(int n, int a, int b) public {
        int[] memory left = new int[](n);
        int[] memory right = new int[](n);
        mutate(left, right, a, b);
        for (int i = 0; i < n; i = i + 1) {
          this.leftSlots[left[i]] = i + 10;
          this.rightSlots[right[i]] = i + 20;
        }
        require(true);
      }
      function writeDirect(int n, int a, int b) public {
        int[] memory left = new int[](n);
        int[] memory right = new int[](n);
        right[0] = b;
        left[0] = right[0] + a;
        for (int i = 0; i < n; i = i + 1) {
          this.leftSlots[left[i]] = i + 30;
          this.rightSlots[right[i]] = i + 40;
        }
        require(true);
      }
      function writeLength(int n) public {
        int[] memory left = new int[](n);
        int[] memory right = new int[](n);
        copyLength(left, right);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[left[i]] = i + 50; }
        require(true);
      }
      function writeAliased(int n, int a, int b) public {
        int[] memory keys = new int[](n);
        mutate(keys, keys, a, b);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[keys[i]] = i + 60; }
        require(true);
      }
      function writeTransitive(int n, int next) public {
        int[] memory left = new int[](n);
        int[] memory right = new int[](n);
        outer(left, right, next);
        for (int i = 0; i < n; i = i + 1) {
          this.leftSlots[left[i]] = i + 70;
          this.rightSlots[right[i]] = i + 80;
        }
        require(true);
      }
      function writeTransitiveCopy(int n, int next) public {
        int[] memory values = new int[](n);
        outerCopy(values, next);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[values[i]] = i + 90; }
        require(true);
      }
      function writeCapturedReturn(int n, int next) public {
        int[] memory values = new int[](n);
        int observed = mutateReturning(values, next);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[values[i]] = i + 100; }
        require(observed == next + 1);
      }
      function writeNestedCapturedReturn(int n, int next) public {
        int[] memory values = new int[](n);
        outerCaptured(values, next);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[values[i]] = i + 110; }
        require(true);
      }
      function checkLeft(int key, int expected) public { require(this.leftSlots[key] == expected); }
      function checkRight(int key, int expected) public { require(this.rightSlots[key] == expected); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'write', args: [2n, 700n, 800n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.batch([{ function: 'writeDirect', args: [2n, 900n, 1000n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.batch([{ function: 'writeLength', args: [2n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.batch([{ function: 'writeAliased', args: [2n, 1100n, 1200n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.batch([{ function: 'writeTransitive', args: [2n, 1300n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.batch([{ function: 'writeTransitiveCopy', args: [2n, 1400n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.batch([{ function: 'writeCapturedReturn', args: [2n, 1500n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.batch([{ function: 'writeNestedCapturedReturn', args: [2n, 1600n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.checkLeft(1900n, 30n).send()).resolves.toBeDefined();
    await expect(contract.call.checkLeft(2300n, 60n).send()).resolves.toBeDefined();
    await expect(contract.call.checkLeft(1301n, 70n).send()).resolves.toBeDefined();
    await expect(contract.call.checkLeft(3n, 71n).send()).resolves.toBeDefined();
    await expect(contract.call.checkLeft(1401n, 90n).send()).resolves.toBeDefined();
    await expect(contract.call.checkLeft(1500n, 100n).send()).resolves.toBeDefined();
    await expect(contract.call.checkLeft(0n, 101n).send()).resolves.toBeDefined();
    await expect(contract.call.checkLeft(1600n, 110n).send()).resolves.toBeDefined();
    await expect(contract.call.checkLeft(1601n, 111n).send()).resolves.toBeDefined();
    await expect(contract.call.checkRight(800n, 20n).send()).resolves.toBeDefined();
    await expect(contract.call.checkRight(1000n, 40n).send()).resolves.toBeDefined();
    await expect(contract.call.checkRight(1300n, 80n).send()).resolves.toBeDefined();
    await expect(contract.call.checkRight(0n, 81n).send()).resolves.toBeDefined();
  }, 180_000);

  it('retains constructed keys across mutations of a value-copied helper parameter', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelValueCopyArray() {
      mapping(int => int) records;
      function mutateCopy(int[] buffer, int next) internal pure { buffer[0] = next; }
      function apply(int count, int next) public {
        int[] buffer = new int[](count);
        mutateCopy(buffer, next);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[buffer[cursor]] = cursor + 10;
        }
        require(true);
      }
      function check(int key, int expected) public { require(this.records[key] == expected); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'apply', args: [3n, 700n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(0n, 12n).send()).resolves.toBeDefined();
    await expect(contract.call.check(700n, 0n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles constructed-key resizes through a pure memory helper alias', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelHelperResizeKeys() {
      mapping(int => int) slots;
      function resize(int[] memory xs, int key) internal pure {
        xs.push(key); xs.push(key + 1); xs.pop();
      }
      function write(int n, int key) public {
        int[] memory xs = new int[](0);
        resize(xs, key);
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = i + 10; }
        require(true);
      }
      function check(int key, int expected) public { require(this.slots[key] == expected); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'write', args: [1n, 700n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(700n, 10n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles path-balanced transient constructed-array resizes in each logical iteration', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelBalancedResizeKeys() {
      mapping(int => int) slots;
      function write(int n, bool high) public {
        int[] memory xs = new int[](n);
        for (int i = 0; i < n; i = i + 1) {
          if (high) {
            xs.push(i + 100); this.slots[xs[n]] = i + 10; xs.pop();
          } else {
            xs.push(i + 200); this.slots[xs[n]] = i + 20; xs.pop();
          }
        }
        require(true);
      }
      function check(int key, int expected) public { require(this.slots[key] == expected); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'write', args: [2n, true] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(100n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.check(101n, 11n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles stable-prefix keys across a counter-dependent append schedule', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelStableArrayPrefix() {
      mapping(int => int) records;
      function apply(int count) public {
        int[] memory buffer = new int[](count + 1);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          if (cursor > 0) {
            buffer.push(cursor + 100);
            buffer.push(cursor + 200);
          } else buffer.push(cursor + 300);
          this.records[buffer[cursor]] = cursor + 10;
        }
        require(true);
      }
      function check(int key, int expected) public { require(this.records[key] == expected); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'apply', args: [3n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(0n, 12n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles local array keys written earlier in the same logical iteration', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SAME_ITERATION_LOCAL_KEY_ARRAY_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.call.write(3n, 7n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(contract.call.check(7n, 20n).send()).resolves.toBeDefined();
    await expect(contract.call.check(8n, 21n).send()).resolves.toBeDefined();
    await expect(contract.call.check(9n, 22n).send()).resolves.toBeDefined();
    await expect(contract.call.writeConditional(3n, 10n, true).send()).resolves.toBeDefined();
    await expect(contract.call.check(10n, 30n).send()).resolves.toBeDefined();
    await expect(contract.call.check(11n, 31n).send()).resolves.toBeDefined();
    await expect(contract.call.check(12n, 32n).send()).resolves.toBeDefined();
    await expect(contract.call.writeConditional(3n, 10n, false).send()).resolves.toBeDefined();
    await expect(contract.call.check(13n, 30n).send()).resolves.toBeDefined();
    await expect(contract.call.check(14n, 31n).send()).resolves.toBeDefined();
    await expect(contract.call.check(15n, 32n).send()).resolves.toBeDefined();
    await expect(contract.call.writeCaptured(1n, 50n).send()).resolves.toBeDefined();
    await expect(contract.call.check(50n, 40n).send()).resolves.toBeDefined();
    await expect(contract.call.writeAfterAssignment(1n, 60n).send()).resolves.toBeDefined();
    await expect(contract.call.check(61n, 50n).send()).resolves.toBeDefined();
    await expect(contract.call.writeAfterConditionalAssignment(1n, 70n, true).send()).resolves.toBeDefined();
    await expect(contract.call.check(71n, 60n).send()).resolves.toBeDefined();
    await expect(contract.call.writeAfterConditionalAssignment(1n, 80n, false).send()).resolves.toBeDefined();
    await expect(contract.call.check(80n, 60n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles local array keys initialized by nested switch control', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelSwitchLocalKeys() {
      mapping(int => int) slots;
      function write(int n, int mode, bool take) public {
        int[] xs = new int[](n);
        for (int i = 0; i < n; i = i + 1) {
          switch (mode) {
            case 0: if (take) { xs[i] = 10 + i; } else { xs[i] = 20 + i; } break;
            case 1: xs[i] = 30 + i; break;
            default: xs[i] = 40 + i;
          }
          this.slots[xs[i]] = i + 1;
        }
        require(true);
      }
      function check(int key, int expected) public { require(this.slots[key] == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'write', args: [2n, 0n, true] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(10n, 1n).send()).resolves.toBeDefined();
    await expect(contract.call.check(11n, 2n).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'write', args: [2n, 0n, false] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(20n, 1n).send()).resolves.toBeDefined();
    await expect(contract.call.check(21n, 2n).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'write', args: [2n, 1n, false] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(30n, 1n).send()).resolves.toBeDefined();
    await expect(contract.call.check(31n, 2n).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'write', args: [2n, 9n, false] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(40n, 1n).send()).resolves.toBeDefined();
    await expect(contract.call.check(41n, 2n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles loop and event predicates from dominating scalar-state assignments', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DOMINATING_STATE_PREDICATE_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.filter((handler) =>
      ['eventWrite', 'conditionalWrite', 'conditionalStateWrite', 'switchStateWrite', 'switchLocalWrite']
        .includes(handler.name)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'eventWrite', eligible: true }),
        expect.objectContaining({ name: 'conditionalWrite', eligible: true }),
        expect.objectContaining({ name: 'conditionalStateWrite', eligible: true }),
        expect.objectContaining({ name: 'switchStateWrite', eligible: true }),
        expect.objectContaining({ name: 'switchLocalWrite', eligible: true }),
      ]));
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { enabled: false }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.call.eventWrite(2n, false).send()).resolves.toBeDefined();
    await expect(contract.call.eventWrite(2n, true).send()).resolves.toBeDefined();
    await expect(contract.call.conditionalWrite(2n, false).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.conditionalWrite(2n, true).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 20n).send()).resolves.toBeDefined();
    await expect(contract.batch([{
      function: 'conditionalStateWrite', args: [100n, false, true],
    }]).send()).resolves.toBeDefined();
    await expect(contract.batch([{
      function: 'conditionalStateWrite', args: [100n, true, false],
    }]).send()).resolves.toBeDefined();
    await expect(contract.batch([{
      function: 'conditionalStateWrite', args: [2n, true, true],
    }]).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 30n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 31n).send()).resolves.toBeDefined();
    await expect(contract.batch([{
      function: 'switchStateWrite', args: [100n, 1n, false],
    }]).send()).resolves.toBeDefined();
    await expect(contract.batch([{
      function: 'switchStateWrite', args: [100n, 0n, true],
    }]).send()).resolves.toBeDefined();
    await expect(contract.batch([{
      function: 'switchStateWrite', args: [2n, 2n, false],
    }]).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 40n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 41n).send()).resolves.toBeDefined();
    await expect(contract.batch([{
      function: 'switchLocalWrite', args: [3n, 50n],
    }]).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 50n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 41n).send()).resolves.toBeDefined();
    await expect(contract.call.check(2n, 72n).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles a toggled loop-carried write predicate in logical source order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(LOOP_CARRIED_GUARD_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.call.write(4n).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 0n).send()).resolves.toBeDefined();
    await expect(contract.call.check(2n, 12n).send()).resolves.toBeDefined();
    await expect(contract.call.check(3n, 0n).send()).resolves.toBeDefined();

    const counterDerived = contract.batch([{ function: 'writeCounterDerived', args: [5n] }]);
    await expect(counterDerived.send()).resolves.toBeDefined();
    for (const [key, expected] of [
      [100n, 20n], [101n, 21n], [102n, 0n], [103n, 0n], [104n, 24n],
    ] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }

    await expect(contract.batch([{ function: 'writeCounterCurrent', args: [5n] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [
      [200n, 30n], [201n, 0n], [202n, 0n], [203n, 33n], [204n, 0n],
    ] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }

    await expect(contract.batch([{ function: 'writePhases', args: [5n] }]).send())
      .resolves.toBeDefined();
    for (const [key, before, after] of [
      [0n, 40n, 50n], [1n, 41n, 0n], [2n, 0n, 0n], [3n, 0n, 53n], [4n, 44n, 0n],
    ] as const) {
      await expect(contract.call.checkBefore(key, before).send()).resolves.toBeDefined();
      await expect(contract.call.checkAfter(key, after).send()).resolves.toBeDefined();
    }

    await expect(contract.batch([{ function: 'writePhaseValues', args: [3n] }]).send())
      .resolves.toBeDefined();
    for (const [key, before, after] of [
      [0n, 5n, 60n], [1n, 60n, 61n], [2n, 61n, 62n],
    ] as const) {
      await expect(contract.call.checkBeforeAssigned(key, before).send()).resolves.toBeDefined();
      await expect(contract.call.checkAfterAssigned(key, after).send()).resolves.toBeDefined();
    }

    await expect(contract.batch([{ function: 'writeBreakPhases', args: [6n] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [[0n, 70n], [1n, 71n], [2n, 0n]] as const) {
      await expect(contract.call.checkBreak(key, expected).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it('settles affine loop-carried local mapping values in source order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(AFFINE_COUNTER_VALUE_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.call.write(3n, 3n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const [key, expected] of [[0n, 6n], [1n, 8n], [2n, 10n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    }
  }, 180_000);

  it('keeps effectful helper evaluation in source order while mapping its result to permuted keys', async () => {
    const provider = createTestProvider();
    const artifact = compileString(EFFECTFUL_HELPER_VALUE_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'write', args: [4n] }]).send()).resolves.toBeDefined();
    for (let key = 0n; key < 4n; key += 1n) {
      await expect(contract.call.check(key, key + 10n, 4n).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it('composes runtime-derived value rows over disjoint collection journals', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DISJOINT_RUNTIME_VALUE_ROWS_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    for (const name of ['updateLeft', 'updateRight', 'updateSharedLow', 'updateSharedHigh']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (let key = 0n; key < 2n; key += 1n) {
      await contract.call.seedLeft(key, key + 1n, key + 2n).send();
      await contract.call.seedRight(key, key + 3n, key + 4n).send();
    }
    for (let key = 0n; key < 4n; key += 1n) {
      await contract.call.seedShared(key, key + 5n, key + 6n).send();
    }
    await expect(contract.batch([
      { function: 'updateLeft', args: [2n] },
      { function: 'updateRight', args: [2n] },
    ]).send()).resolves.toBeDefined();
    for (let key = 0n; key < 2n; key += 1n) {
      await expect(contract.call.checkLeft(key, key + 11n, key + 22n).send()).resolves.toBeDefined();
      await expect(contract.call.checkRight(key, key + 33n, key + 44n).send()).resolves.toBeDefined();
    }
    await expect(contract.batch([
      { function: 'updateSharedLow', args: [2n] },
      { function: 'updateSharedLow', args: [0n] },
      { function: 'updateSharedHigh', args: [2n] },
    ]).send()).resolves.toBeDefined();
    for (let key = 0n; key < 4n; key += 1n) {
      const low = key < 2n;
      await expect(contract.call.checkShared(
        key, key + (low ? 55n : 75n), key + (low ? 66n : 86n),
      ).send()).resolves.toBeDefined();
    }
    await expect(contract.batch([
      { function: 'updateSharedLow', args: [2n] },
      { function: 'updateSharedLow', args: [2n] },
    ]).build()).rejects.toThrow(/read-your-writes transition/);
  }, 180_000);

  it('settles general loop-carried local values through an authenticated source-order trace', async () => {
    const provider = createTestProvider();
    const artifact = compileString(TRACED_COUNTER_VALUE_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    for (const name of ['writeRetained', 'writeSelfDependent', 'writeAfter', 'writeSelected']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    await expect(contract.call.writeRetained(5n, 10n).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [
      [0n, 10n], [1n, 10n], [2n, 12n], [3n, 12n], [4n, 14n],
    ] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }

    await expect(contract.batch([{ function: 'writeSelfDependent', args: [5n, 10n] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [
      [0n, 1n], [1n, 11n], [2n, 12n], [3n, 13n], [4n, 14n],
    ] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }

    await expect(contract.batch([{ function: 'writeAfter', args: [5n] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [
      [0n, 2n], [1n, 5n], [2n, 5n], [3n, 8n], [4n, 8n],
    ] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }

    await expect(contract.batch([{ function: 'writeSelected', args: [6n] }]).send())
      .resolves.toBeDefined();
    for (const [key, expected] of [
      [1n, 3n], [2n, 5n], [4n, 7n], [5n, 7n],
    ] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it('authenticates counter-keyed reads from another mapping without mutating their source entries', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_READ_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'copy')?.sortedUpsertLoopInfo)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'source', op: 'read' }),
        expect.objectContaining({ collection: 'destination', op: 'set' }),
      ]));
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const sourceCollection = artifact.stateLayout!.collections.find((collection) => collection.name === 'source')!;
    const sourceAddress = getEntryNftAddress(inner, categoryId, sourceCollection.signature);
    const emptySourceEntryCount = (await provider.getUtxos(sourceAddress)).filter((utxo) =>
      utxo.token?.category === categoryId && utxo.token.nft?.capability === 'mutable').length;
    // Every key is absent from the empty source mapping and therefore shares the sentinel predecessor. The
    // authenticated read stream must reproduce that predecessor once and reuse its gap proof for the other keys.
    await expect(contract.call.copy(4n).send()).resolves.toBeDefined();
    const absentCopyCall = contract.batch([{ function: 'copy', args: [4n] }]);
    const absentCopyBuilder = await absentCopyCall.build();
    const absentRouteInputIndex = absentCopyBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(absentRouteInputIndex).toBeGreaterThanOrEqual(0);
    const absentRouteUnlocker = absentCopyBuilder.inputs[absentRouteInputIndex].unlocker;
    if (!('params' in absentRouteUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const absentRead = artifact.abi.find((handler) => handler.name === 'copy')?.sortedUpsertLoopInfo
      ?.find((info) => info.collection === 'source');
    const absentWitnessIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === absentRead?.oldValuesWitnessParam);
    const absentJournalIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === '__internal__kernelJournalAccessStreams');
    const absentSelector = artifact.messageBus!.route.selector;
    if (absentWitnessIndex < 0 || absentJournalIndex < 0 || !absentSelector
      || absentRead?.journalAccessStreamIndex === undefined) {
      throw new Error('missing absent-read route witness');
    }
    const absentJournalRows = absentRouteUnlocker.params[absentJournalIndex];
    const absentRowStreams = Array.isArray(absentJournalRows) ? absentJournalRows[0] : undefined;
    const absentReadStream = Array.isArray(absentRowStreams)
      ? absentRowStreams[absentRead.journalAccessStreamIndex] : undefined;
    if (!(absentReadStream instanceof Uint8Array)) throw new Error('missing absent-read journal stream');
    const absentReadAccesses = decodeKernelEntryJournalAccesses(absentReadStream);
    expect(absentReadAccesses.every((access) => access.mutates === false)).toBe(true);
    expect(absentReadAccesses.map((access) => ({
      authenticatesTarget: access.authenticatesTarget,
      authenticatesPredecessor: access.authenticatesPredecessor,
    }))).toEqual([
      { authenticatesTarget: undefined, authenticatesPredecessor: true },
      { authenticatesTarget: undefined, authenticatesPredecessor: undefined },
      { authenticatesTarget: undefined, authenticatesPredecessor: undefined },
      { authenticatesTarget: undefined, authenticatesPredecessor: undefined },
    ]);
    const falseReadIntent = new Uint8Array(absentReadStream);
    falseReadIntent[22] |= 0x08;
    const hostileJournalParams = [...absentRouteUnlocker.params];
    const hostileJournalRows = absentJournalRows.map((row: Uint8Array[], rowIndex: number) =>
      rowIndex === 0 ? row.map((stream, streamIndex) =>
        streamIndex === absentRead.journalAccessStreamIndex ? falseReadIntent : stream) : row);
    hostileJournalParams[absentJournalIndex] = hostileJournalRows;
    absentCopyBuilder.inputs[absentRouteInputIndex].unlocker = absentRouteUnlocker.contract
      .createCompilerRouteUnlocker(absentRouteUnlocker.abiFunction, hexToBin(absentSelector))(...hostileJournalParams);
    const absentHostileVm = createVirtualMachineBch2026ForProvider(provider);
    expect(absentHostileVm.stateSuccess(absentHostileVm.evaluate({
      inputIndex: absentRouteInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(absentCopyBuilder.inputs),
      transaction: absentCopyBuilder.buildLibauthTransaction(),
    })), 'hostile read mutation intent').not.toBe(true);
    absentCopyBuilder.inputs[absentRouteInputIndex].unlocker = absentRouteUnlocker;
    const hostileAbsentParams = [...absentRouteUnlocker.params];
    const absentWitnessRows = absentRouteUnlocker.params[absentWitnessIndex] as bigint[][];
    hostileAbsentParams[absentWitnessIndex] = [[...absentWitnessRows[0].slice(0, 1), 1n,
      ...absentWitnessRows[0].slice(2)]];
    absentCopyBuilder.inputs[absentRouteInputIndex].unlocker = absentRouteUnlocker.contract
      .createCompilerRouteUnlocker(absentRouteUnlocker.abiFunction, hexToBin(absentSelector))(...hostileAbsentParams);
    expect(absentHostileVm.stateSuccess(absentHostileVm.evaluate({
      inputIndex: absentRouteInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(absentCopyBuilder.inputs),
      transaction: absentCopyBuilder.buildLibauthTransaction(),
    }))).not.toBe(true);
    absentCopyBuilder.inputs[absentRouteInputIndex].unlocker = absentRouteUnlocker;
    await expect(absentCopyCall.send()).resolves.toBeDefined();
    for (let key = 0n; key < 4n; key += 1n) {
      await expect(contract.call.checkDestination(key, 0n).send()).resolves.toBeDefined();
      await expect(contract.call.checkSource(key, 0n).send()).resolves.toBeDefined();
    }
    expect((await provider.getUtxos(sourceAddress)).filter((utxo) =>
      utxo.token?.category === categoryId && utxo.token.nft?.capability === 'mutable'))
      .toHaveLength(emptySourceEntryCount);

    // Exercise the other reusable interval shape with one deliberate hole. Making the highest hashed slot absent
    // guarantees that its immediate predecessor is a present node processed immediately before it.
    const proofValues = [17n, 29n, 43n, 61n, 71n, 73n, 79n, 83n];
    const proofSlots = proofValues.map((_value, key) => ({
      key: BigInt(key), value: bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(BigInt(key))])),
    }));
    const missingKey = proofSlots.sort((a, b) => a.value > b.value ? -1 : 1)[0].key;
    for (let key = 0; key < proofValues.length; key += 1) {
      if (BigInt(key) !== missingKey) await contract.call.seed(BigInt(key), proofValues[key]).send();
    }
    const sourceCountBeforeGapReuse = (await provider.getUtxos(sourceAddress)).filter((utxo) =>
      utxo.token?.category === categoryId && utxo.token.nft?.capability === 'mutable').length;
    await expect(contract.batch([{ function: 'copy', args: [BigInt(proofValues.length)] }]).send())
      .resolves.toBeDefined();
    await expect(contract.call.checkDestination(missingKey, 0n).send()).resolves.toBeDefined();
    expect((await provider.getUtxos(sourceAddress)).filter((utxo) =>
      utxo.token?.category === categoryId && utxo.token.nft?.capability === 'mutable'))
      .toHaveLength(sourceCountBeforeGapReuse);
    await contract.call.seed(missingKey, proofValues[Number(missingKey)]).send();

    const expected = proofValues.slice(0, 4);

    const copyCall = contract.batch([{ function: 'copy', args: [BigInt(expected.length)] }]);
    const copyBuilder = await copyCall.build();
    const routeInputIndex = copyBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = copyBuilder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const copyAbi = artifact.abi.find((handler) => handler.name === 'copy')!;
    const sourceRead = copyAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'source');
    expect(sourceRead).toMatchObject({ op: 'read' });
    const witnessRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === sourceRead!.oldValuesWitnessParam);
    const permutationRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === sourceRead!.varyingArrayParam);
    expect(witnessRouteIndex).toBeGreaterThanOrEqual(0);
    expect(permutationRouteIndex).toBeGreaterThanOrEqual(0);
    const rowPermutation = (routeUnlocker.params[permutationRouteIndex] as bigint[][])[0];
    expect(rowPermutation).toHaveLength(expected.length);
    expect(routeUnlocker.params[witnessRouteIndex]).toEqual([expected]);

    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[witnessRouteIndex] = [[999n, ...(routeUnlocker.params[witnessRouteIndex] as bigint[][])[0]
      .slice(1)]];
    copyBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    expect(hostileVm.stateSuccess(hostileVm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(copyBuilder.inputs),
      transaction: copyBuilder.buildLibauthTransaction(),
    }))).not.toBe(true);
    copyBuilder.inputs[routeInputIndex].unlocker = routeUnlocker;

    await expect(copyCall.send())
      .resolves.toBeDefined();
    for (let key = 0; key < expected.length; key += 1) {
      await expect(contract.call.checkDestination(BigInt(key), expected[key]).send()).resolves.toBeDefined();
      await expect(contract.call.checkSource(BigInt(key), expected[key]).send()).resolves.toBeDefined();
    }

    const second = [3n, 5n, 7n, 11n];
    for (let key = 0; key < second.length; key += 1) {
      await contract.call.seedSecond(BigInt(key), second[key]).send();
    }
    await expect(contract.batch([{ function: 'combine', args: [BigInt(expected.length)] }]).send())
      .resolves.toBeDefined();
    for (let key = 0; key < expected.length; key += 1) {
      await expect(contract.call.checkDestination(BigInt(key), expected[key] + second[key]).send())
        .resolves.toBeDefined();
      await expect(contract.call.checkSource(BigInt(key), expected[key]).send()).resolves.toBeDefined();
      await expect(contract.call.checkSecond(BigInt(key), second[key]).send()).resolves.toBeDefined();
    }

    await contract.call.seed(4n, 13n).send();
    const shiftedAbi = artifact.abi.find((handler) => handler.name === 'shifted')!;
    const shiftedSource = shiftedAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'source');
    const shiftedDestination = shiftedAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'destination');
    expect(shiftedSource).toMatchObject({ op: 'read', varyingKeyExpressions: expect.any(Array) });
    expect(shiftedSource?.varyingArrayParam).not.toBe(shiftedDestination?.varyingArrayParam);
    const shiftedExpected = [proofValues[1], proofValues[2], proofValues[3], 13n];
    const shiftedCall = contract.batch([{ function: 'shifted', args: [4n] }]);
    const shiftedBuilder = await shiftedCall.build();
    const shiftedRouteInputIndex = shiftedBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(shiftedRouteInputIndex).toBeGreaterThanOrEqual(0);
    const shiftedRouteUnlocker = shiftedBuilder.inputs[shiftedRouteInputIndex].unlocker;
    if (!('params' in shiftedRouteUnlocker)) throw new Error('shifted route input has no contract parameters');
    const shiftedWitnessIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === shiftedSource?.oldValuesWitnessParam);
    const shiftedSourcePermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === shiftedSource?.varyingArrayParam);
    const shiftedDestinationPermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === shiftedDestination?.varyingArrayParam);
    expect(shiftedWitnessIndex).toBeGreaterThanOrEqual(0);
    expect(shiftedSourcePermutationIndex).toBeGreaterThanOrEqual(0);
    expect(shiftedDestinationPermutationIndex).toBeGreaterThanOrEqual(0);
    expect(shiftedRouteUnlocker.params[shiftedWitnessIndex]).toEqual([shiftedExpected]);
    expect(shiftedRouteUnlocker.params[shiftedSourcePermutationIndex])
      .not.toEqual(shiftedRouteUnlocker.params[shiftedDestinationPermutationIndex]);
    const shiftedSelector = artifact.messageBus!.route.selector;
    if (!shiftedSelector) throw new Error('message-bus route has no selector');
    const hostileShiftedParams = [...shiftedRouteUnlocker.params];
    hostileShiftedParams[shiftedWitnessIndex] = [[999n, ...shiftedExpected.slice(1)]];
    const recreateShiftedRouteUnlocker = shiftedRouteUnlocker.contract.createCompilerRouteUnlocker(
      shiftedRouteUnlocker.abiFunction, hexToBin(shiftedSelector),
    );
    shiftedBuilder.inputs[shiftedRouteInputIndex].unlocker = recreateShiftedRouteUnlocker(...hostileShiftedParams);
    const hostileShiftedVm = createVirtualMachineBch2026ForProvider(provider);
    expect(hostileShiftedVm.stateSuccess(hostileShiftedVm.evaluate({
      inputIndex: shiftedRouteInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(shiftedBuilder.inputs),
      transaction: shiftedBuilder.buildLibauthTransaction(),
    }))).not.toBe(true);
    shiftedBuilder.inputs[shiftedRouteInputIndex].unlocker = shiftedRouteUnlocker;
    await expect(shiftedCall.send()).resolves.toBeDefined();
    for (const [key, value] of shiftedExpected.entries()) {
      await expect(contract.call.checkDestination(BigInt(key), value).send()).resolves.toBeDefined();
    }

    const raw = [
      hexToBin('00112233445566778899aabbccddeeff00112233'),
      hexToBin('ffeeddccbbaa99887766554433221100ffeeddcc'),
    ];
    for (let key = 0; key < raw.length; key += 1) {
      await contract.call.seedRaw(BigInt(key), raw[key]).send();
    }
    await expect(contract.batch([{ function: 'copyRaw', args: [BigInt(raw.length)] }]).send())
      .resolves.toBeDefined();
    for (let key = 0; key < raw.length; key += 1) {
      await expect(contract.call.checkRaw(BigInt(key), raw[key]).send()).resolves.toBeDefined();
    }

    const blobs = [new Uint8Array([1, 2, 3]), new Uint8Array(96).fill(0x5a)];
    for (let key = 0; key < blobs.length; key += 1) {
      await contract.call.seedBlob(BigInt(key + 1), blobs[key]).send();
    }
    const blobAbi = artifact.abi.find((handler) => handler.name === 'copyBlob')!;
    const blobSource = blobAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'blobSource');
    const blobDestination = blobAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'blobDestination');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copyBlob'))
      .toMatchObject({ eligible: true });
    expect(blobSource).toMatchObject({ op: 'read' });
    expect(blobSource?.varyingArrayParam).not.toBe(blobDestination?.varyingArrayParam);
    await expect(contract.batch([{ function: 'copyBlob', args: [BigInt(blobs.length)] }]).send())
      .resolves.toBeDefined();
    for (let key = 0; key < blobs.length; key += 1) {
      await expect(contract.call.checkBlob(BigInt(key), blobs[key]).send()).resolves.toBeDefined();
    }

    const recPayload = new Uint8Array(88).fill(0x3c);
    await contract.call.seedRec(1n, 41n, recPayload).send();
    const recAbi = artifact.abi.find((handler) => handler.name === 'copyRec')!;
    expect(recAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'recSource'))
      .toMatchObject({ op: 'read' });
    await expect(contract.batch([{ function: 'copyRec', args: [1n] }]).send()).resolves.toBeDefined();
    await expect(contract.call.checkRec(0n, 41n, recPayload).send()).resolves.toBeDefined();
  }, 180_000);

  it('orders parameter-array journals without reordering public arguments or effects', async () => {
    const provider = createTestProvider();
    const artifact = compileString(PARAMETER_ARRAY_MAPPING_READ_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    const copyAbi = artifact.abi.find((handler) => handler.name === 'copy')!;
    const sourceRead = copyAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'source');
    const destinationWrite = copyAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'destination');
    expect(sourceRead).toMatchObject({
      op: 'read',
      varyingArrayParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
      varyingKeyExpressions: expect.any(Array),
    });
    expect(destinationWrite).toMatchObject({
      op: 'set', varyingArrayParam: sourceRead!.varyingArrayParam,
    });
    expect(copyAbi.runtimeLoopEvents).toEqual([expect.objectContaining({
      permutationParam: sourceRead!.varyingArrayParam,
      eventSignatures: ['Copied(int256)'],
    })]);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const bySlot = (left: bigint, right: bigint): number => {
      const leftSlot = bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(left)]));
      const rightSlot = bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(right)]));
      return leftSlot < rightSlot ? -1 : leftSlot > rightSlot ? 1 : 0;
    };
    const physical = [91n, 4n].sort(bySlot);
    const keys = [...physical].reverse();
    expect(physical).not.toEqual(keys);
    for (const [index, key] of keys.entries()) await contract.call.seed(key, BigInt(index + 10)).send();

    const directReceipt = await contract.call.copy(keys).send();
    expect(directReceipt.events?.map((event) => [event.event, event.args.key])).toEqual(
      keys.map((key) => ['Copied', key]),
    );
    for (const [index, key] of keys.entries()) {
      await expect(contract.call.check(key, BigInt(index + 10)).send()).resolves.toBeDefined();
    }

    const call = contract.batch([{ function: 'copy', args: [keys] }]);
    const builder = await call.build();
    const routeInput = builder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!routeInput || !('params' in routeInput.unlocker)) throw new Error('message-bus route input is missing');
    const permutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === sourceRead!.varyingArrayParam);
    expect(permutationIndex).toBeGreaterThanOrEqual(0);
    const logicalPermutation = (routeInput.unlocker.params[permutationIndex] as bigint[][])[0];
    expect(logicalPermutation.map((logical) => keys[Number(logical)])).toEqual(physical);
    const routeInputIndex = builder.inputs.indexOf(routeInput);
    const routeInstructions = decodeAuthenticationInstructions(
      builder.buildLibauthTransaction().inputs[routeInputIndex].unlockingBytecode,
    );
    expect(routeInstructions[2]).toMatchObject({ data: expect.any(Uint8Array) });
    if (!('data' in routeInstructions[2])) throw new Error('kernel route density reserve is missing');
    expect(routeInstructions[2].data).toHaveLength(KERNEL_ROUTE_DENSITY_RESERVE_BYTES);

    const receipt = await call.send();
    expect(receipt.events?.map((event) => [event.event, event.args.key])).toEqual(
      keys.map((key) => ['Copied', key]),
    );
    for (const [index, key] of keys.entries()) {
      await expect(contract.call.check(key, BigInt(index + 10)).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it('settles chunked parameter-array values without reordering public arrays or effects', async () => {
    const provider = createTestProvider();
    const artifact = compileString(PARAMETER_ARRAY_VALUE_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    const fillAbi = artifact.abi.find((handler) => handler.name === 'fill')!;
    const write = fillAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'values');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill'))
      .toMatchObject({ eligible: true });
    expect(write).toMatchObject({
      op: 'set',
      varyingArrayParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
      valueArrayParam: 'payloads',
      valueArrayIndexParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
    });
    expect(artifact.abi.some((handler) => /^__message_bus_(graph|array|resource)_/.test(handler.name)))
      .toBe(false);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const short = hexToBin('010203');
    const long = Uint8Array.from({ length: 170 }, (_unused, index) => (index * 29 + 7) & 0xff);
    const keys = [91n, 4n];
    const receipt = await contract.batch([{ function: 'fill', args: [keys, [short, long]] }]).send();
    expect(receipt.events?.map((event) => [event.event, event.args.key, binToHex(event.args.digest)])).toEqual(
      keys.map((key, index) => ['Applied', key, binToHex(sha256.hash([short, long][index]))]),
    );
    await expect(contract.call.check(keys[0], short).send()).resolves.toBeDefined();
    await expect(contract.call.check(keys[1], long).send()).resolves.toBeDefined();

    const first = new Uint8Array(70).fill(0x11);
    const last = Uint8Array.from({ length: 170 }, (_unused, index) => (index * 11 + 9) & 0xff);
    await expect(contract.batch([{ function: 'fill', args: [[7n, 7n], [first, last]] }]).send())
      .resolves.toBeDefined();
    await expect(contract.call.check(7n, last).send()).resolves.toBeDefined();
  }, 180_000);

  it('settles boolean same-entry expressions with typed old-value witnesses', async () => {
    const provider = createTestProvider();
    const artifact = compileString(BOOL_RMW_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'flip'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'flip', args: [3n] }]).send()).resolves.toBeDefined();
    for (let key = 0n; key < 3n; key += 1n) {
      await expect(contract.call.check(key, true).send()).resolves.toBeDefined();
    }
    await expect(contract.batch([{ function: 'flip', args: [3n] }]).send()).resolves.toBeDefined();
    for (let key = 0n; key < 3n; key += 1n) {
      await expect(contract.call.check(key, false).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it('settles fixed-point same-entry expressions with scaled old-value witnesses', async () => {
    const provider = createTestProvider();
    const artifact = compileString(FIXED_RMW_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'raise'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const high = 2n * 10n ** 18n;
    const low = 1n * 10n ** 18n;
    await expect(contract.batch([{ function: 'raise', args: [2n, high] }]).send()).resolves.toBeDefined();
    await expect(contract.batch([{ function: 'raise', args: [2n, low] }]).send()).resolves.toBeDefined();
    for (let key = 0n; key < 2n; key += 1n) {
      await expect(contract.call.check(key, high).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it('settles chunked bytes same-entry expressions for present and absent keys', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DYNAMIC_BYTES_RMW_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const first = new Uint8Array(40).fill(0xaa);
    // Cross directly into a three-continuation value, then update it beside an inline key.
    const second = new Uint8Array(130).fill(0xbb);
    const third = hexToBin('ccdd');
    await expect(contract.batch([{ function: 'append', args: [2n, first] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'append', args: [1n, second] }]).send())
      .resolves.toBeDefined();

    const call = contract.batch([{ function: 'append', args: [2n, third] }]);
    await expect(call.send()).resolves.toBeDefined();

    const entries = await contract.getEntries('values');
    const valueAt = (key: bigint): unknown => entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect(valueAt(0n)).toEqual(new Uint8Array([...first, ...second, ...third]));
    expect(valueAt(1n)).toEqual(new Uint8Array([...first, ...third]));
  }, 180_000);

  it('settles routed and direct scalar insertions with chunked mapping values', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DYNAMIC_BYTES_SCALAR_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const value = new Uint8Array(130).fill(0x5a);
    const directValue = new Uint8Array(96).fill(0x6b);

    await expect(contract.batch([{ function: 'set', args: [7n, value] }]).send())
      .resolves.toBeDefined();
    await expect(contract.call.set(8n, directValue).send()).resolves.toBeDefined();

    const entries = await contract.getEntries('values');
    expect(entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(7n)])))?.value).toEqual(value);
    expect(entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(8n)])))?.value).toEqual(directValue);
  }, 180_000);

  it('places multiple chunkable mapping witnesses by ABI identity', async () => {
    const provider = createTestProvider();
    const artifact = compileString(MULTI_DYNAMIC_BYTES_SCALAR_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const left = new Uint8Array(130).fill(0x71);
    const right = new Uint8Array(190).fill(0x82);

    await expect(contract.call.set(3n, left, right).send()).resolves.toBeDefined();

    const [leftEntries, rightEntries] = await Promise.all([
      contract.getEntries('left'), contract.getEntries('right'),
    ]);
    const slot = binToHex(keyToSlotMulti([bigIntToVmNumber(3n)]));
    expect(leftEntries.find((entry) => binToHex(entry.slot) === slot)?.value).toEqual(left);
    expect(rightEntries.find((entry) => binToHex(entry.slot) === slot)?.value).toEqual(right);
  }, 180_000);

  it('settles string same-entry expressions for present and absent keys', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DYNAMIC_STRING_RMW_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const first = 'a'.repeat(40);
    const second = 'b'.repeat(130);
    const third = ' cd';
    await expect(contract.batch([{ function: 'append', args: [2n, first] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'append', args: [1n, second] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'append', args: [2n, third] }]).send())
      .resolves.toBeDefined();

    const entries = await contract.getEntries('values');
    const valueAt = (key: bigint): unknown => entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect(valueAt(0n)).toBe(first + second + third);
    expect(valueAt(1n)).toBe(first + third);
  }, 180_000);

  it('settles chunked dynamic-struct expressions for present and absent keys', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DYNAMIC_STRUCT_RMW_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const first = new Uint8Array(40).fill(0x11);
    const second = new Uint8Array(130).fill(0x22);
    const third = hexToBin('3344');
    await expect(contract.batch([{ function: 'append', args: [2n, first] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'append', args: [1n, second] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'append', args: [2n, third] }]).send())
      .resolves.toBeDefined();

    const entries = await contract.getEntries('records');
    const valueAt = (key: bigint): unknown => entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect(valueAt(0n)).toEqual({ data: new Uint8Array([...first, ...second, ...third]), revisions: 3n });
    expect(valueAt(1n)).toEqual({ data: new Uint8Array([...first, ...third]), revisions: 2n });
  }, 180_000);

  it.each([
    ['fixed bytes', 'bytes20', new Uint8Array(20).fill(0xaa),
      new Uint8Array(20).fill(0xbb), new Uint8Array(20).fill(0xcc)],
    ['address', 'address', hexToBin('51'), hexToBin('52'), hexToBin('53')],
    ['public key', 'pubkey', alicePub, bobPub, new Uint8Array(33).fill(0x03)],
    ['data signature', 'datasig', new Uint8Array(64).fill(0xaa),
      new Uint8Array(64).fill(0xbb), new Uint8Array(64).fill(0xcc)],
  ] as const)(
    'settles %s same-entry expressions with raw old-value witnesses',
    async (_label, type, firstValue, secondValue, unusedValue) => {
      const provider = createTestProvider();
      const artifact = compileString(rawScalarRmwSource(type), { ...KERNEL, maximumInputBytes: 1_000_000 });
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'replace'))
        .toMatchObject({ eligible: true });
      expect(artifact.abi.find((handler) => handler.name === 'replace')?.sortedUpsertLoopInfo?.[0])
        .toMatchObject({ valueRuntimeExpression: true, op: 'set' });
      const inner = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifact.stateLayout!, {}, { saltContract: true },
      );
      const contract = StatefulContract.withCategory(inner, categoryId);
      // Absent entries authenticate the type-specific default before insertion.
      await expect(contract.batch([{
        function: 'replace', args: [2n, firstValue, secondValue, firstValue],
      }]).send())
        .resolves.toBeDefined();
      // Existing entries authenticate their exact raw tail on both ternary paths.
      await expect(contract.batch([{
        function: 'replace', args: [2n, secondValue, unusedValue, firstValue],
      }]).send())
        .resolves.toBeDefined();
      await expect(contract.batch([{
        function: 'replace', args: [2n, firstValue, secondValue, unusedValue],
      }]).send())
        .resolves.toBeDefined();
      for (let key = 0n; key < 2n; key += 1n) {
        await expect(contract.call.check(key, secondValue).send()).resolves.toBeDefined();
      }
    }, 180_000,
  );

  it('settles affine loop-carried scalar state values from a pre-loop snapshot', async () => {
    const provider = createTestProvider();
    const artifact = compileString(AFFINE_COUNTER_STATE_VALUE_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.call.write(3n, 2n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const [key, expected] of [[0n, 2n], [1n, 4n], [2n, 6n]] as const) {
      await expect(contract.state.m(key)).resolves.toBe(expected);
    }
    await expect(contract.getState()).resolves.toMatchObject({ total: 6n });
  }, 180_000);
});
