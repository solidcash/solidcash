/* eslint-disable */
// AUTO-GENERATED - do not edit by hand. Regenerate from DEFAULT_PROXY_SOURCE via compileString + JSON.stringify
// (see packages/solidc/docs/upgrades.md "Regenerating").
//
// The default upgradeable proxy is layout-independent: deployProxy grafts the implementation state layout and
// bakes the implementation locking bytecode. Keep bytecode, debug.bytecode, fingerprint, ABI, and debug metadata
// from the same compiler invocation; never patch only one generated field.
import { Artifact } from '@solidcash/utils';

// No placeholder state var: one bytecode must serve event-only and state-holding implementations. The delegate
// authorizes grafted state via _proxyMasterIndex; forceStateful is supplied by the regenerate script.
export const DEFAULT_PROXY_SOURCE = "pragma solidcash >=0.8.0;\ncontract SolidCashProxy(address implementation) {\n  function __forward(bytes input) {\n    implementation.delegatecall(input);\n    require(input.length > 0);\n  }\n}\n";

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
      "sourceEffectOrder": "linear",
      "lowLevelCalls": [
        {
          "callMode": "delegatecall",
          "dataParamIndex": 0,
          "occurrence": "once",
          "target": {
            "kind": "constructorArg",
            "name": "implementation"
          }
        }
      ],
      "delegateForwarding": {
        "version": 1,
        "callIndex": 0,
        "payloadInput": 0,
        "target": {
          "kind": "constructorArg",
          "name": "implementation"
        },
        "targetBinding": {
          "kind": "constructorArg",
          "input": 0,
          "name": "implementation"
        },
        "frame": {
          "stateOwner": "participant",
          "executor": "target-input",
          "calldata": "payload-input",
          "outputOwner": "participant"
        },
        "terminalRequire": true
      },
      "blockLayout": {
        "blockSize": 2,
        "slots": [
          {
            "kind": "master",
            "offset": 0
          },
          {
            "kind": "lowLevelCall",
            "offset": 1,
            "slotIndex": 0
          }
        ]
      }
    }
  ],
  "bytecode": "00c38c6576009f6375516776ce537987637c8b7c688c006866c48c OP_2 OP_DEFINE 7681760151a27c0160a19a OP_3 OP_DEFINE OP_DEPTH OP_1SUB OP_PICK OP_UTXOBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_INPUTBYTECODE OP_SIZE OP_IF OP_1 OP_SPLIT OP_SWAP OP_DUP 00 OP_EQUAL OP_IF OP_DROP OP_0 OP_SWAP OP_ELSE OP_DUP 4f OP_EQUAL OP_IF OP_DROP OP_1NEGATE OP_SWAP OP_ELSE OP_3 OP_INVOKE OP_IF OP_BIN2NUM 50 OP_SUB OP_SWAP OP_ELSE OP_DUP 4c OP_EQUAL OP_IF OP_DROP OP_1 OP_SPLIT OP_SWAP 00 OP_CAT OP_BIN2NUM OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP OP_ELSE OP_DUP 4d OP_EQUAL OP_IF OP_DROP OP_2 OP_SPLIT OP_SWAP 00 OP_CAT OP_BIN2NUM OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP OP_ELSE OP_BIN2NUM OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP OP_ENDIF OP_ENDIF OP_ENDIF OP_ENDIF OP_ENDIF OP_ELSE OP_0 OP_SWAP OP_ENDIF OP_NIP OP_SIZE OP_IF OP_1 OP_SPLIT OP_SWAP OP_DUP 00 OP_EQUAL OP_IF OP_DROP OP_0 OP_SWAP OP_ELSE OP_DUP 4f OP_EQUAL OP_IF OP_DROP OP_1NEGATE OP_SWAP OP_ELSE OP_3 OP_INVOKE OP_IF OP_BIN2NUM 50 OP_SUB OP_1 OP_NUM2BIN OP_SWAP OP_ELSE OP_DUP 4c OP_EQUAL OP_IF OP_DROP OP_1 OP_SPLIT OP_SWAP 00 OP_CAT OP_BIN2NUM OP_SPLIT OP_ELSE OP_DUP 4d OP_EQUAL OP_IF OP_DROP OP_2 OP_SPLIT OP_SWAP 00 OP_CAT OP_BIN2NUM OP_SPLIT OP_ELSE OP_BIN2NUM OP_SPLIT OP_ENDIF OP_ENDIF OP_ENDIF OP_ENDIF OP_ENDIF OP_ELSE OP_0 OP_SWAP OP_ENDIF OP_DROP OP_DEPTH OP_1SUB OP_PICK OP_INPUTBYTECODE OP_1 OP_SPLIT OP_NIP OP_OVER OP_SIZE OP_NIP OP_SPLIT OP_DROP OP_EQUALVERIFY OP_SIZE OP_NIP OP_0 OP_GREATERTHAN OP_VERIFY OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_2 OP_INVOKE OP_BEGIN OP_DUP OP_0 OP_LESSTHAN OP_IF OP_DROP OP_1 OP_ELSE OP_DUP OP_OUTPUTTOKENCATEGORY OP_SIZE 21 OP_NUMEQUAL OP_IF OP_3 OP_PICK OP_EQUAL OP_ELSE OP_DROP OP_0 OP_ENDIF OP_IF OP_SWAP OP_1SUB OP_SWAP OP_ENDIF OP_1SUB OP_0 OP_ENDIF OP_UNTIL OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_DROP OP_INPUTINDEX OP_UTXOVALUE OP_INPUTINDEX OP_OUTPUTVALUE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENAMOUNT OP_INPUTINDEX OP_OUTPUTTOKENAMOUNT OP_LESSTHANOREQUAL OP_VERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY 20 OP_SPLIT OP_DROP OP_1 OP_CAT OP_2 OP_INVOKE OP_BEGIN OP_DUP OP_0 OP_LESSTHAN OP_IF OP_DROP OP_1 OP_ELSE OP_DUP OP_OUTPUTTOKENCATEGORY OP_3 OP_PICK OP_EQUAL OP_IF OP_SWAP OP_1SUB OP_SWAP OP_ENDIF OP_1SUB OP_0 OP_ENDIF OP_UNTIL OP_0 OP_NUMEQUALVERIFY OP_2DROP OP_1",
  "source": "pragma solidcash >=0.8.0;\ncontract SolidCashProxy(address implementation) {\n  function __forward(bytes input) {\n    implementation.delegatecall(input);\n    require(input.length > 0);\n  }\n}\n",
  "debug": {
    "bytecode": "1b00c38c6576009f6375516776ce537987637c8b7c688c006866c48c52890b7681760151a27c0160a19a5389748c79c788c0ca8263517f7c760100876375007c6776014f8763754f7c67538a63810150947c6776014c876375517f7c01007e817f7c817c6776014d876375527f7c01007e817f7c817c67817f7c817c686868686867007c68778263517f7c760100876375007c6776014f8763754f7c67538a638101509451807c6776014c876375517f7c01007e817f6776014d876375527f7c01007e817f67817f686868686867007c6875748c79ca517f777882777f7588827700a069c0c7c0cd88c0cec0d188c0ce528a6576009f6375516776d18201219c6353798767750068637c8c7c688c00686600a26975c0c6c0cc88c0d0c0d3a169c0ce01207f75517e528a6576009f6375516776d1537987637c8c7c688c006866009d6d51",
    "sourceMap": "1::7:1;;;;;;4:4:4:38;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;5:12:5:24:1;;:27::28:0;:12:::1;:4::30;3:2:6:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;",
    "logs": [],
    "requires": [
      {
        "ip": 176,
        "line": 5
      }
    ]
  },
  "fingerprint": "b74c27581de47217b2c5f04337d82984847e3920c1b12daf0c32c7f290e0a3e8",
  "stateLayout": {
    "variables": [],
    "dataNftCount": 0,
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
          "blockSize": 2,
          "slots": [
            {
              "kind": "master",
              "offset": 0
            },
            {
              "kind": "lowLevelCall",
              "offset": 1,
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
