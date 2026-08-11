/* eslint-disable */
// AUTO-GENERATED - do not edit by hand. Regenerate from DEFAULT_PROXY_SOURCE via compileString + JSON.stringify
// (see packages/solidc/docs/upgrades.md "Regenerating").
//
// The default upgradeable proxy is layout-independent: deployProxy grafts the implementation state layout and
// bakes the implementation locking bytecode. Keep bytecode, debug.bytecode, fingerprint, ABI, and debug metadata
// from the same compiler invocation; never patch only one generated field.
import { Artifact } from '@solidcash/utils';

export const DEFAULT_PROXY_SOURCE = "pragma solidcash >=0.8.0;\ncontract SolidCashProxy(address implementation) {\n  bigint __proxySlot;\n  function __forward(bytes input) {\n    implementation.delegatecall(input);\n    require(input.length > 0);\n  }\n}\n";

export const defaultProxyArtifact: Artifact = {
  "contractName": "SolidCashProxy",
  "constructorInputs": [
    {
      "name": "implementation",
      "type": "address"
    }
  ],
  "abi": [
    {
      "name": "__forward",
      "selector": "88b357fe",
      "inputs": [
        {
          "name": "input",
          "type": "bytes"
        },
        {
          "name": "__internal__delegateInputIndex",
          "type": "bigint"
        }
      ],
      "writesState": true,
      "requiredNftIndices": [
        0
      ],
      "lowLevelCalls": [
        {
          "callMode": "delegatecall",
          "target": {
            "kind": "constructorArg",
            "name": "implementation"
          }
        }
      ],
      "blockLayout": {
        "blockSize": 3,
        "slots": [
          {
            "kind": "master",
            "offset": 0
          },
          {
            "kind": "dataNft",
            "offset": 1,
            "nftIndex": 0
          },
          {
            "kind": "lowLevelCall",
            "offset": 2,
            "slotIndex": 0
          }
        ]
      }
    }
  ],
  "bytecode": "00c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600 OP_1 OP_DEFINE 517f7c760100876375007c6776014f8763754f7c677681760151a27c0160a19a638101509451807c6776014c876375517f7c01007e817f6776014d876375527f7c01007e817f67817f6868686868 OP_1NEGATE OP_DEFINE OP_DEPTH OP_1SUB OP_PICK OP_UTXOBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_INPUTBYTECODE OP_1NEGATE OP_INVOKE OP_SWAP OP_BIN2NUM OP_DROP OP_1NEGATE OP_INVOKE OP_DROP OP_DEPTH OP_1SUB OP_PICK OP_INPUTBYTECODE OP_1 OP_SPLIT OP_NIP OP_OVER OP_SIZE OP_NIP OP_SPLIT OP_DROP OP_EQUALVERIFY OP_SIZE OP_NIP OP_0 OP_GREATERTHAN OP_VERIFY OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_1 OP_INVOKE OP_GREATERTHANOREQUAL OP_VERIFY OP_DROP OP_INPUTINDEX OP_UTXOVALUE OP_INPUTINDEX OP_OUTPUTVALUE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENAMOUNT OP_INPUTINDEX OP_OUTPUTTOKENAMOUNT OP_LESSTHANOREQUAL OP_VERIFY OP_INPUTINDEX OP_1ADD OP_UTXOVALUE OP_INPUTINDEX OP_1ADD OP_OUTPUTVALUE OP_EQUALVERIFY OP_INPUTINDEX OP_1ADD OP_UTXOTOKENAMOUNT OP_INPUTINDEX OP_1ADD OP_OUTPUTTOKENAMOUNT OP_LESSTHANOREQUAL OP_VERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY 20 OP_SPLIT OP_DROP OP_1 OP_CAT OP_1 OP_INVOKE OP_NUMEQUALVERIFY OP_2DROP OP_1",
  "source": "pragma solidcash >=0.8.0;\ncontract SolidCashProxy(address implementation) {\n  bigint __proxySlot;\n  function __forward(bytes input) {\n    implementation.delegatecall(input);\n    require(input.length > 0);\n  }\n}\n",
  "debug": {
    "bytecode": "3200c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c0068660051894c4e517f7c760100876375007c6776014f8763754f7c677681760151a27c0160a19a638101509451807c6776014c876375517f7c01007e817f6776014d876375527f7c01007e817f67817f68686868684f89748c79c788c0ca4f8a7c81754f8a75748c79ca517f777882777f7588827700a069c0c7c0cd88c0cec0d188c0ce518aa26975c0c6c0cc88c0d0c0d3a169c08bc6c08bcc88c08bd0c08bd3a169c0ce01207f75517e518a9d6d51",
    "sourceMap": "1::8:1;;;2;;;5:4:5:38;;;;;;;;;;;;;;;;;;;;;;;;;;;;6:12:6:24:1;;:27::28:0;:12:::1;:4::30;4:2:7:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;",
    "logs": [],
    "requires": [
      {
        "ip": 39,
        "line": 6
      }
    ]
  },
  "fingerprint": "5d27ce20dab072c9fad6b0a2a666398764b033b567fe42e360596e9c16b47efa",
  "stateLayout": {
    "variables": [
      {
        "name": "__proxySlot",
        "type": "bigint",
        "nftIndex": 0,
        "fieldIndex": 0
      }
    ],
    "dataNftCount": 1,
    "commitmentLimit": 128
  },
  "compiler": {
    "name": "solidc",
    "version": "0.13.1",
    "options": {
      "enforceFunctionParameterTypes": true,
      "enforceLocktimeGuard": true,
      "enforceFinalRequire": true,
      "allowUnsafeOperations": false,
      "commitmentLimit": 128,
      "messageBus": false
    }
  },
  "invocationAnalysis": {
    "version": 1,
    "protocolVersions": [
      1
    ],
    "functions": [
      {
        "id": 0,
        "name": "__forward",
        "arity": 1,
        "entryPoint": true,
        "selector": "88b357fe",
        "calls": [],
        "closure": [
          0
        ],
        "component": 0,
        "recursive": false,
        "reads": [],
        "writes": [],
        "effects": [],
        "unknown": false,
        "bounded": true,
        "maximumDirectInvocations": 0,
        "blockLayout": {
          "blockSize": 3,
          "slots": [
            {
              "kind": "master",
              "offset": 0
            },
            {
              "kind": "dataNft",
              "offset": 1,
              "nftIndex": 0
            },
            {
              "kind": "lowLevelCall",
              "offset": 2,
              "slotIndex": 0
            }
          ]
        }
      }
    ],
    "components": [
      {
        "id": 0,
        "functions": [
          0
        ],
        "recursive": false
      }
    ]
  }
} as unknown as Artifact;
