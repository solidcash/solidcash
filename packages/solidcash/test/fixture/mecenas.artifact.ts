export default {
  contractName: 'Mecenas',
  constructorInputs: [
    {
      name: 'recipient',
      type: 'bytes20',
    },
    {
      name: 'funder',
      type: 'bytes20',
    },
    {
      name: 'pledge',
      type: 'int',
    },
  ],
  abi: [
    {
      name: 'recvFunds',
      selector: 'e8e62fca',
      inputs: [],
    },
    {
      name: 'reclaim',
      selector: '2f7ef34c',
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
  ],
  bytecode: '00cd0376a9147b7e0288ac7e8802e803c0c676547994527994765579547993a16300cc707c949d6700cc55799d51cdc0c78851cc789d686d6d7551 e8e62fca OP_DEFINE 5379a97b8872ac7777 2f7ef34c OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE',
  source: 'pragma solidcash >=0.8.0;\n\n/* This is an unofficial SolidCash port of Licho\'s Mecenas contract. It is\n * not compatible with Licho\'s EC plugin, but rather meant as a demonstration\n * of covenants in SolidCash.\n * The time checking has been removed so it can be tested without time requirements.\n */\ncontract Mecenas(bytes20 recipient, bytes20 funder, int pledge/*, int period */) {\n    function recvFunds() {\n        // require(this.age >= period);\n\n        // Check that the first output sends to the recipient\n        require(tx.outputs[0].lockingBytecode == new LockingBytecodeP2PKH(recipient));\n\n        int minerFee = 1000;\n        int currentValue = tx.inputs[this.activeInputIndex].value;\n        int changeValue = currentValue - pledge - minerFee;\n\n        // If there is not enough left for *another* pledge after this one, we send the remainder to the recipient\n        // Otherwise we send the remainder to the recipient and the change back to the contract\n        if (changeValue <= pledge + minerFee) {\n            require(tx.outputs[0].value == currentValue - minerFee);\n        } else {\n            require(tx.outputs[0].value == pledge);\n            require(tx.outputs[1].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);\n            require(tx.outputs[1].value == changeValue);\n        }\n    }\n\n    function reclaim(pubkey pk, sig s) {\n        require(hash160(pk) == funder);\n        require(checkSig(s, pk));\n    }\n}\n',
  debug: {
    bytecode: '3b00cd0376a9147b7e0288ac7e8802e803c0c676547994527994765579547993a16300cc707c949d6700cc55799d51cdc0c78851cc789d686d6d755104e8e62fca89095379a97b8872ac7777042f7ef34c89748c7a8a',
    sourceMap: '9:4:28:5;;;30::33;;;8:0:34:1;;;',
    logs: [],
    requires: [],
    functionDebug: {
      'e8e62fca': {
        requires: [
          {
            ip: 7,
            line: 13,
          },
          {
            ip: 31,
            line: 22,
          },
          {
            ip: 37,
            line: 24,
          },
          {
            ip: 42,
            line: 25,
          },
          {
            ip: 46,
            line: 26,
          },
        ],
        sourceMap: '13:27:13:28;:16::45:1;:49::84:0;:74::83;:49::84:1;;;:8::86;15:23:15:27:0;16:37:16:58;:27::65:1;17:26:17:38:0;:41::47;;:26:::1;:50::58:0;;:26:::1;21:12:21:23:0;:27::33;;:36::44;;:27:::1;:12;:46:23:9:0;22:31:22:32;:20::39:1;:43::66:0;;::::1;:12::68;23:15:27:9:0;24:31:24:32;:20::39:1;:43::49:0;;:12::51:1;25:31:25:32:0;:20::49:1;:63::84:0;:53::101:1;:12::103;26:31:26:32:0;:20::39:1;:43::54:0;:12::56:1;23:15:27:9;9:4:28:5;;;',
        logs: [],
      },
      '2f7ef34c': {
        requires: [
          {
            ip: 4,
            line: 31,
          },
          {
            ip: 7,
            line: 32,
          },
        ],
        sourceMap: '31:24:31:26;;:16::27:1;:31::37:0;:8::39:1;32:25:32:30:0;:8::33:1;30:4:33:5;',
        logs: [],
      },
    },
  },
  functionBodies: {
    'e8e62fca': '00cd0376a9147b7e0288ac7e8802e803c0c676547994527994765579547993a16300cc707c949d6700cc55799d51cdc0c78851cc789d686d6d7551',
    '2f7ef34c': '5379a97b8872ac7777',
  },
  compiler: {
    name: 'solidc',
    version: '0.13.0-next.3',
    options: {
      enforceFunctionParameterTypes: true,
      commitmentLimit: 128,
    },
  },
  updatedAt: '2026-02-28T17:46:16.974Z',
} as const;
