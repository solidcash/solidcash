export default {
  contractName: 'Example',
  constructorInputs: [],
  abi: [
    {
      name: 'test',
      selector: '78cae886',
      inputs: [
        {
          name: 'value',
          type: 'int256',
        },
      ],
    },
  ],
  bytecode: 'OP_DUP OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_DROP OP_1 OP_NUMEQUAL',
  source: 'contract Example() {\n  function test(int value) {\n    console.log(value, "test");\n    require(value == 1, "Wrong value passed");\n  }\n}\n',
  debug: {
    bytecode: '767621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa16975519c',
    sourceMap: '2:16:2:25;;;;;;;;;;4:21:4:22;:4::46:1',
    logs: [
      {
        ip: 10,
        line: 3,
        data: [
          {
            stackIndex: 0,
            type: 'int256',
            ip: 10,
          },
          'test',
        ],
      },
    ],
    requires: [
      {
        ip: 12,
        line: 4,
        message: 'Wrong value passed',
      },
    ],
  },
  fingerprint: 'cc889908d163cb6aefaf4a3e5a19c86dc78f8a18333aca7638817541fe692b5d',
  compiler: {
    name: 'solidc',
    version: '0.13.1',
    options: {
      enforceFunctionParameterTypes: true,
      enforceLocktimeGuard: true,
      commitmentLimit: 128,
      messageBus: false,
    },
  },
  updatedAt: '2026-08-07T17:53:29.530Z',
  invocationAnalysis: {
    version: 1,
    protocolVersions: [
      1,
    ],
    functions: [
      {
        id: 0,
        name: 'test',
        arity: 1,
        entryPoint: true,
        selector: '78cae886',
        calls: [],
        closure: [
          0,
        ],
        component: 0,
        recursive: false,
        reads: [],
        writes: [],
        effects: [],
        unknown: false,
        bounded: true,
        maximumDirectInvocations: 0,
      },
    ],
    components: [
      {
        id: 0,
        functions: [
          0,
        ],
        recursive: false,
      },
    ],
  },
} as const;
