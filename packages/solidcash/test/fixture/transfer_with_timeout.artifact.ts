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
      type: 'int',
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
  bytecode: '537a7bac7777 3486e360 OP_DEFINE 537a7cad7cb16d51 2203057b OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE',
  source: 'contract TransferWithTimeout(\n    pubkey sender,\n    pubkey recipient,\n    int timeout\n) {\n    // Require recipient\'s signature to match\n    function transfer(sig recipientSig) {\n        require(checkSig(recipientSig, recipient));\n    }\n\n    // Require timeout time to be reached and sender\'s signature to match\n    function timeout(sig senderSig) {\n        require(checkSig(senderSig, sender));\n        require(tx.time >= timeout);\n    }\n}\n',
  debug: {
    bytecode: '06537a7bac7777043486e3608908537a7cad7cb16d51042203057b89748c7a8a',
    sourceMap: '7:4:9:5;;;12::15;;;1:0:16:1;;;',
    logs: [],
    requires: [],
    functionDebug: {
      '3486e360': {
        requires: [
          {
            ip: 4,
            line: 8,
          },
        ],
        sourceMap: '8:25:8:37;;:39::48;:8::51:1;7:4:9:5;',
        logs: [],
      },
      '2203057b': {
        requires: [
          {
            ip: 3,
            line: 13,
          },
          {
            ip: 5,
            line: 14,
          },
        ],
        sourceMap: '13:25:13:34;;:36::42;:8::45:1;14:27:14:34:0;:8::36:1;12:4:15:5;',
        logs: [],
      },
    },
  },
  functionBodies: {
    '3486e360': '537a7bac7777',
    '2203057b': '537a7cad7cb16d51',
  },
  compiler: {
    name: 'solidc',
    version: '0.13.0-next.3',
    options: {
      enforceFunctionParameterTypes: true,
      commitmentLimit: 128,
    },
  },
  updatedAt: '2026-02-03T11:06:41.243Z',
} as const;
