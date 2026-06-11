export default {
  contractName: 'Bar',
  constructorInputs: [
    {
      name: 'pkh_bar',
      type: 'bytes20',
    },
  ],
  abi: [
    {
      name: 'funcA',
      selector: 'b8f031f1',
      inputs: [],
    },
    {
      name: 'funcB',
      selector: 'e1516928',
      inputs: [],
    },
    {
      name: 'execute',
      selector: '53f23b6b',
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
  bytecode: '52529c77 b8f031f1 OP_DEFINE 52529c77 e1516928 OP_DEFINE 78a988ac 53f23b6b OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE',
  source: 'pragma solidcash >=0.10.2;\n\ncontract Bar(bytes20 pkh_bar) {\n    function funcA() {\n        require(2==2);\n    }\n\n    function funcB() {\n        require(2==2);\n    }\n\n    function execute(pubkey pk, sig s) {\n        console.log("Bar \'execute\' function called.");\n        require(hash160(pk) == pkh_bar);\n        require(checkSig(s, pk));\n    }\n}\n',
  debug: {
    bytecode: '0452529c7704b8f031f1890452529c7704e1516928890478a988ac0453f23b6b89748c7a8a',
    sourceMap: '4:4:6:5;;;8::10;;;12::16;;;3:0:17:1;;;',
    logs: [],
    requires: [],
    functionDebug: {
      'b8f031f1': {
        requires: [
          {
            ip: 3,
            line: 5,
          },
        ],
        sourceMap: '5:16:5:17;:19::20;:8::22:1;4:4:6:5',
        logs: [],
      },
      'e1516928': {
        requires: [
          {
            ip: 3,
            line: 9,
          },
        ],
        sourceMap: '9:16:9:17;:19::20;:8::22:1;8:4:10:5',
        logs: [],
      },
      '53f23b6b': {
        requires: [
          {
            ip: 2,
            line: 14,
          },
          {
            ip: 4,
            line: 15,
          },
        ],
        sourceMap: '14:24:14:26;:16::27:1;:8::40;15::15:33',
        logs: [
          {
            ip: 0,
            line: 13,
            data: [
              'Bar \'execute\' function called.',
            ],
          },
        ],
      },
    },
  },
  functionBodies: {
    'b8f031f1': '52529c77',
    'e1516928': '52529c77',
    '53f23b6b': '78a988ac',
  },
  compiler: {
    name: 'solidc',
    version: '0.13.0-next.3',
    options: {
      enforceFunctionParameterTypes: true,
      commitmentLimit: 128,
    },
  },
  updatedAt: '2026-02-03T11:06:38.986Z',
} as const;
