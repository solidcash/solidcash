export default {
  contractName: 'TransferWithTimeout',
  constructorInputs: [
    {
      name: 'sender',
      type: 'pubkey',
    },
    {
      name: 'recipient',
      type: 'pubkey',
    },
    {
      name: 'timeout',
      type: 'int256',
    },
  ],
  abi: [
    {
      name: 'transfer',
      selector: '3486e360',
      inputs: [
        {
          name: 'recipientSig',
          type: 'sig',
        },
      ],
    },
    {
      name: 'timeout',
      selector: '2203057b',
      inputs: [
        {
          name: 'senderSig',
          type: 'sig',
        },
      ],
    },
  ],
  bytecode: '537a7bac7777 3486e360 OP_DEFINE 537a7cad7cb16d51 2203057b OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
  source: 'pragma solidcash ^0.13.0;\n\ncontract TransferWithTimeout(\n    pubkey sender,\n    pubkey recipient,\n    int timeout\n) {\n    // Require recipient\'s signature to match\n    function transfer(sig recipientSig) {\n        require(checkSig(recipientSig, recipient));\n    }\n\n    // Require timeout time to be reached and sender\'s signature to match\n    function timeout(sig senderSig) {\n        require(checkSig(senderSig, sender));\n        require(tx.time >= timeout);\n    }\n}\n',
  debug: {
    bytecode: '06537a7bac7777043486e3608908537a7cad7cb16d51042203057b89748c7a82549d8a',
    sourceMap: '9:4:11:5;;;14::17;;;3:0:18:1;;;;;;',
    logs: [],
    requires: [],
    functionDebug: {
      '3486e360': {
        requires: [
          {
            ip: 4,
            line: 10,
          },
        ],
        sourceMap: '10:25:10:37;;:39::48;:8::51:1;9:4:11:5;',
        logs: [],
      },
      '2203057b': {
        requires: [
          {
            ip: 3,
            line: 15,
          },
          {
            ip: 5,
            line: 16,
          },
        ],
        sourceMap: '15:25:15:34;;:36::42;:8::45:1;16:27:16:34:0;:8::36:1;14:4:17:5;',
        logs: [],
      },
    },
  },
  functionBodies: {
    '3486e360': '537a7bac7777',
    '2203057b': '537a7cad7cb16d51',
  },
  fingerprint: '938bd4e34785c264a20e3b08fca31283fd92dd76acad7c91e6e11fc15161189d',
  compiler: {
    name: 'solidc',
    version: '0.13.1',
    options: {
      enforceFunctionParameterTypes: true,
      enforceLocktimeGuard: true,
      commitmentLimit: 128,
    },
  },
  updatedAt: '2026-07-19T14:07:06.207Z',
} as const;
