export default {
  contractName: 'FallbackReceive',
  constructorInputs: [
    {
      name: 'owner',
      type: 'bytes20',
    },
  ],
  abi: [
    {
      name: 'transfer',
      selector: 'c4e6689f',
      inputs: [
        {
          name: 'pk',
          type: 'pubkey',
        },
        {
          name: 's',
          type: 'sig',
        },
      ],
    },
    {
      name: '__fallback',
      selector: '4d14b706',
      inputs: [],
      isFallback: true,
    },
    {
      name: '__receive',
      selector: '9bdc6ba1',
      inputs: [],
      isReceive: true,
      modifiers: ['payable'],
    },
  ],
  bytecode: '78a988ac c4e6689f OP_DEFINE 00cc02e803a277 4d14b706 OP_DEFINE 00cc022202a277 9bdc6ba1 OP_DEFINE OP_DEPTH OP_1 OP_NUMEQUAL OP_IF 9bdc6ba1 OP_INVOKE OP_ELSE OP_DEPTH OP_1SUB OP_ROLL OP_DUP c4e6689f OP_EQUAL OP_OVER 4d14b706 OP_EQUAL OP_BOOLOR OP_IF OP_INVOKE OP_ELSE OP_DROP 4d14b706 OP_INVOKE OP_ENDIF OP_ENDIF',
  source: 'pragma solidcash ^0.13.0;\n\ncontract FallbackReceive(bytes20 owner) {\n    function transfer(pubkey pk, sig s) {\n        require(hash160(pk) == owner);\n        require(checkSig(s, pk));\n    }\n\n    fallback() external {\n        require(tx.outputs[0].value >= 1000);\n    }\n\n    receive() external payable {\n        require(tx.outputs[0].value >= 546);\n    }\n}\n',
  debug: {
    bytecode: '0478a988ac04c4e6689f890700cc02e803a277044d14b706890700cc022202a277049bdc6ba18974519c63049bdc6ba18a67748c7a7604c4e6689f8778044d14b706879b638a6775044d14b7068a6868',
    sourceMap: '4:4:7:5;;;9::11;;;13::15;;;3:0:16:1;;;;;;;;;;;;;;;;;;;;;;;;',
    logs: [],
    requires: [],
    functionDebug: {
      'c4e6689f': {
        requires: [
          {
            ip: 2,
            line: 5,
          },
          {
            ip: 4,
            line: 6,
          },
        ],
        sourceMap: '5:24:5:26;:16::27:1;:8::38;6::6:33',
        logs: [],
      },
      '4d14b706': {
        requires: [
          {
            ip: 4,
            line: 10,
          },
        ],
        sourceMap: '10:27:10:28;:16::35:1;:39::43:0;:8::45:1;9:4:11:5',
        logs: [],
      },
      '9bdc6ba1': {
        requires: [
          {
            ip: 4,
            line: 14,
          },
        ],
        sourceMap: '14:27:14:28;:16::35:1;:39::42:0;:8::44:1;13:4:15:5',
        logs: [],
      },
    },
  },
  functionBodies: {
    'c4e6689f': '78a988ac',
    '4d14b706': '00cc02e803a277',
    '9bdc6ba1': '00cc022202a277',
  },
  compiler: {
    name: 'solidc',
    version: '0.13.0-next.3',
    options: {
      enforceFunctionParameterTypes: true,
      commitmentLimit: 128,
    },
  },
  updatedAt: '2026-02-28T17:58:53.003Z',
} as const;
