/* eslint-disable */
// AUTO-GENERATED - do not edit by hand. Regenerate from DEFAULT_PROXY_SOURCE via compileString + JSON.stringify
// (see docs/upgrades.md "Regenerating").
//
// The default upgradeable proxy: a layout-independent pinned forwarder (its bytecode never reads its own state
// fields), so one bytecode serves any implementation - deployProxy grafts the impl's stateLayout on and bakes
// `implementation` as an immutable constructor arg. Rationale in docs/upgrades.md.
//
// MANUAL BYTECODE ADJUSTMENT (reapply after any regenerate): the mutable proxy-category conservation check was
// relaxed from strict `in == out` (OP_0 OP_NUMEQUALVERIFY) to `out >= in` (OP_0 OP_LESSTHANOREQUAL OP_VERIFY).
// This still forbids DESTROYING the proxy's mutable state NFTs but ALLOWS the impl (trusted, deployed by the proxy
// owner) to MINT new mutable entry NFTs, so a delegate function can write a mapping (users[msg.sender]=v). The
// impl's own covenant + master preservation still enforce state integrity; the only new exposure is attacker-
// funded spam-dust NFTs (no state corruption; reads are by entry-address/position, not category-scan). To make a
// regenerate produce this, the compiler's delegatecall-forwarder covenant must emit the relaxed check.
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
      "requiredNftIndices": [
        0
      ],
      "lowLevelCalls": [
        {
          "callMode": "delegatecall"
        }
      ],
      "blockLayout": {
        "blockSize": 2,
        "slots": [
          {
            "kind": "master",
            "offset": 0
          },
          {
            "kind": "dataNft",
            "offset": 1,
            "nftIndex": 0
          }
        ]
      }
    }
  ],
  "bytecode": "OP_2 OP_PICK OP_UTXOBYTECODE OP_EQUALVERIFY OP_2DUP OP_SWAP OP_INPUTBYTECODE OP_1 OP_SPLIT OP_NIP OP_OVER OP_SIZE OP_NIP OP_SPLIT OP_DROP OP_EQUALVERIFY OP_SIZE OP_NIP OP_0 OP_GREATERTHAN OP_VERIFY OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_0 OP_TXINPUTCOUNT OP_1SUB OP_BEGIN OP_DUP OP_0 OP_LESSTHAN OP_IF OP_DROP OP_1 OP_ELSE OP_DUP OP_UTXOTOKENCATEGORY OP_3 OP_PICK OP_EQUAL OP_IF OP_SWAP OP_1ADD OP_SWAP OP_ENDIF OP_1SUB OP_0 OP_ENDIF OP_UNTIL OP_TXOUTPUTCOUNT OP_1SUB OP_BEGIN OP_DUP OP_0 OP_LESSTHAN OP_IF OP_DROP OP_1 OP_ELSE OP_DUP OP_OUTPUTTOKENCATEGORY OP_3 OP_PICK OP_EQUAL OP_IF OP_SWAP OP_1SUB OP_SWAP OP_ENDIF OP_1SUB OP_0 OP_ENDIF OP_UNTIL OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_DROP OP_INPUTINDEX OP_UTXOVALUE OP_INPUTINDEX OP_OUTPUTVALUE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENAMOUNT OP_INPUTINDEX OP_OUTPUTTOKENAMOUNT OP_LESSTHANOREQUAL OP_VERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY 20 OP_SPLIT OP_DROP OP_1 OP_CAT OP_0 OP_TXINPUTCOUNT OP_1SUB OP_BEGIN OP_DUP OP_0 OP_LESSTHAN OP_IF OP_DROP OP_1 OP_ELSE OP_DUP OP_UTXOTOKENCATEGORY OP_3 OP_PICK OP_EQUAL OP_IF OP_SWAP OP_1ADD OP_SWAP OP_ENDIF OP_1SUB OP_0 OP_ENDIF OP_UNTIL OP_TXOUTPUTCOUNT OP_1SUB OP_BEGIN OP_DUP OP_0 OP_LESSTHAN OP_IF OP_DROP OP_1 OP_ELSE OP_DUP OP_OUTPUTTOKENCATEGORY OP_3 OP_PICK OP_EQUAL OP_IF OP_SWAP OP_1SUB OP_SWAP OP_ENDIF OP_1SUB OP_0 OP_ENDIF OP_UNTIL OP_0 OP_LESSTHANOREQUAL OP_VERIFY OP_2DROP OP_1",
  "source": "pragma solidcash >=0.8.0;\ncontract SolidCashProxy(address implementation) {\n  bigint __proxySlot;\n  function __forward(bytes input) {\n    implementation.delegatecall(input);\n    require(input.length > 0);\n  }\n}\n",
  "debug": {
    "bytecode": "5279c7886e7cca517f777882777f7588827700a069c0c7c0cd88c0cec0d188c0ce00c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600a26975c0c6c0cc88c0d0c0d3a169c0ce01207f75517e00c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c006866009d6d51",
    "sourceMap": "5:4:5:38;;;;;;;;;;;;;;;;6:12:6:24:1;;:27::28:0;:12:::1;:4::30;4:2:7:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;",
    "logs": [],
    "requires": [
      {
        "ip": 21,
        "line": 6
      }
    ]
  },
  "fingerprint": "fa7ccccd86b9a8b2f88e97d1a642ed200a242f591f236d05c63c3c4e0d3de651",
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
      "commitmentLimit": 128
    }
  }
} as unknown as Artifact;
