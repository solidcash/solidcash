import {
  PrimitiveType, ArrayType, BytesType, AddressType, BUILTIN_LIBRARIES, parseTypeStrict,
} from '@solidcash/utils';
import { SymbolTable, Symbol } from './SymbolTable.js';

export const NumberUnit: { [index: string]: number } = {
  SATOSHIS: 1,
  SATS: 1,
  FINNEY: 10,
  BITS: 100,
  BITCOIN: 100000000,
  SECONDS: 1,
  MINUTES: 60,
  HOURS: 3600,
  DAYS: 86400,
  WEEKS: 604800,
  // Solidity value units (accepted for porting; nominal on BCH, which has no ETH denomination).
  WEI: 1,
  GWEI: 1e9,
  ETHER: 1e18,
};

export enum GlobalFunction {
  ABS = 'abs',
  MIN = 'min',
  MAX = 'max',
  WITHIN = 'within',
  ADDMOD = 'addmod',
  MULMOD = 'mulmod',
  RIPEMD160 = 'ripemd160',
  SHA1 = 'sha1',
  SHA256 = 'sha256',
  KECCAK256 = 'keccak256',
  HASH160 = 'hash160',
  HASH256 = 'hash256',
  CHECKSIG = 'checkSig',
  CHECKMULTISIG = 'checkMultiSig',
  CHECKDATASIG = 'checkDataSig',
  ECRECOVER = 'ecrecover',
  TO_PADDED_BYTES = 'toPaddedBytes',
  INT_TO_STRING = 'intToString',
  STRING_TO_INT = 'stringToInt',
  BLOCKHASH = 'blockhash',
  BLOBHASH = 'blobhash',
}

export enum TimeOp {
  CHECK_SEQUENCE = 'this.age',
  CHECK_LOCKTIME = 'tx.time',
}

export enum Class {
  LOCKING_BYTECODE_P2SH20 = 'LockingBytecodeP2SH20',
  LOCKING_BYTECODE_P2SH32 = 'LockingBytecodeP2SH32',
  LOCKING_BYTECODE_P2PKH = 'LockingBytecodeP2PKH',
  LOCKING_BYTECODE_NULLDATA = 'LockingBytecodeNullData',
}

export enum Modifier {
  CONSTANT = 'constant',
  PACKED = 'packed',
  MEMORY = 'memory',
  CALLDATA = 'calldata',
  STORAGE = 'storage',
  IMMUTABLE = 'immutable',
  TRANSIENT = 'transient',
}

export const GLOBAL_SYMBOL_TABLE = new SymbolTable();

// Classes
GLOBAL_SYMBOL_TABLE.set(
  Symbol.class(Class.LOCKING_BYTECODE_P2SH20, new BytesType(23), [new BytesType(20)]),
);
GLOBAL_SYMBOL_TABLE.set(
  Symbol.class(Class.LOCKING_BYTECODE_P2SH32, new BytesType(35), [new BytesType(32)]),
);
GLOBAL_SYMBOL_TABLE.set(
  Symbol.class(Class.LOCKING_BYTECODE_P2PKH, new BytesType(25), [new BytesType(20)]),
);
GLOBAL_SYMBOL_TABLE.set(
  Symbol.class(Class.LOCKING_BYTECODE_NULLDATA, new BytesType(), [new ArrayType(new BytesType())]),
);

// Global functions
GLOBAL_SYMBOL_TABLE.set(
  Symbol.function(GlobalFunction.ABS, PrimitiveType.BIGINT, [PrimitiveType.BIGINT]),
);
GLOBAL_SYMBOL_TABLE.set(
  Symbol.function(GlobalFunction.MIN, PrimitiveType.BIGINT, [PrimitiveType.BIGINT, PrimitiveType.BIGINT]),
);
GLOBAL_SYMBOL_TABLE.set(
  Symbol.function(GlobalFunction.MAX, PrimitiveType.BIGINT, [PrimitiveType.BIGINT, PrimitiveType.BIGINT]),
);
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.WITHIN, PrimitiveType.BOOL,
  [PrimitiveType.BIGINT, PrimitiveType.BIGINT, PrimitiveType.BIGINT],
));
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.ADDMOD, PrimitiveType.BIGINT,
  [PrimitiveType.BIGINT, PrimitiveType.BIGINT, PrimitiveType.BIGINT],
));
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.MULMOD, PrimitiveType.BIGINT,
  [PrimitiveType.BIGINT, PrimitiveType.BIGINT, PrimitiveType.BIGINT],
));
GLOBAL_SYMBOL_TABLE.set(
  Symbol.function(GlobalFunction.RIPEMD160, new BytesType(20), [PrimitiveType.ANY]),
);
GLOBAL_SYMBOL_TABLE.set(
  Symbol.function(GlobalFunction.SHA1, new BytesType(20), [PrimitiveType.ANY]),
);
GLOBAL_SYMBOL_TABLE.set(
  Symbol.function(GlobalFunction.SHA256, new BytesType(32), [PrimitiveType.ANY]),
);
GLOBAL_SYMBOL_TABLE.set(
  Symbol.function(GlobalFunction.HASH160, new BytesType(20), [PrimitiveType.ANY]),
);
GLOBAL_SYMBOL_TABLE.set(
  Symbol.function(GlobalFunction.HASH256, new BytesType(32), [PrimitiveType.ANY]),
);
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.CHECKSIG, PrimitiveType.BOOL,
  [PrimitiveType.SIG, PrimitiveType.PUBKEY],
));
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.CHECKMULTISIG, PrimitiveType.BOOL,
  [new ArrayType(PrimitiveType.SIG), new ArrayType(PrimitiveType.PUBKEY)],
));
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.CHECKDATASIG, PrimitiveType.BOOL,
  [PrimitiveType.DATASIG, new BytesType(), PrimitiveType.PUBKEY],
));
// ecrecover(hash, sig, pubKey): verify-with-pubkey form. Returns the signer's P2PKH locking bytecode (as an
// address) on success, or the zero address 0x on an empty signature. The 4-arg Solidity form is handled
// separately (warn + always 0x). See docs/ecrecover.md.
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.ECRECOVER, new AddressType(),
  [new BytesType(32), PrimitiveType.DATASIG, PrimitiveType.PUBKEY],
));
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.TO_PADDED_BYTES, new BytesType(),
  [PrimitiveType.BIGINT, PrimitiveType.BIGINT],
));
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.INT_TO_STRING, PrimitiveType.STRING,
  [PrimitiveType.BIGINT],
));
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.STRING_TO_INT, PrimitiveType.BIGINT,
  [PrimitiveType.STRING],
));
// EVM-parity block-hash builtins (see docs/block-and-transaction-properties.md s11). blobhash always returns 0 (no BCH
// blobs); blockhash(n) reads the project (n->hash) oracle.
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.BLOCKHASH, new BytesType(32), [PrimitiveType.INT],
));
GLOBAL_SYMBOL_TABLE.set(Symbol.function(
  GlobalFunction.BLOBHASH, new BytesType(32), [PrimitiveType.INT],
));

// External-library precompiles (keccak256, another hashing scheme, ...) are registered from the registry by
// name with their declared ABI signature, so `lib()` is a valid, type-checked call. User-supplied
// libraries are registered per-compilation in SymbolTableTraversal from the same shape.
for (const lib of Object.values(BUILTIN_LIBRARIES)) {
  GLOBAL_SYMBOL_TABLE.set(Symbol.function(
    lib.name,
    parseTypeStrict(lib.abi.outputs[0].type),
    lib.abi.inputs.map((input) => parseTypeStrict(input.type)),
  ));
}
