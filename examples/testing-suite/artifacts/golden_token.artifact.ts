export default {
  contractName: 'GoldenToken',
  constructorInputs: [
    {
      name: 'owner',
      type: 'pubkey',
    },
  ],
  abi: [
    {
      name: 'mint',
      selector: '86a6f222',
      inputs: [
        {
          name: 'amount',
          type: 'bigint',
        },
        {
          name: 's',
          type: 'sig',
        },
      ],
      writesState: true,
      requiredNftIndices: [
        0,
      ],
      sourceEffectOrder: 'linear',
      emits: [
        {
          eventName: 'Mint',
          eventSignature: 'Mint(bigint,bigint)',
          emitIndex: 0,
        },
      ],
      signatureGuard: {
        key: {
          kind: 'constructorArg',
          name: 'owner',
        },
      },
      blockLayout: {
        blockSize: 3,
        slots: [
          {
            kind: 'master',
            offset: 0,
          },
          {
            kind: 'dataNft',
            offset: 1,
            nftIndex: 0,
          },
          {
            kind: 'event',
            offset: 2,
            slotIndex: 0,
          },
        ],
      },
    },
    {
      name: 'burn',
      selector: 'b37fd68f',
      inputs: [
        {
          name: 'amount',
          type: 'bigint',
        },
        {
          name: 's',
          type: 'sig',
        },
      ],
      writesState: true,
      requiredNftIndices: [
        0,
      ],
      sourceEffectOrder: 'linear',
      signatureGuard: {
        key: {
          kind: 'constructorArg',
          name: 'owner',
        },
      },
      blockLayout: {
        blockSize: 2,
        slots: [
          {
            kind: 'master',
            offset: 0,
          },
          {
            kind: 'dataNft',
            offset: 1,
            nftIndex: 0,
          },
        ],
      },
    },
  ],
  bytecode: '76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68686868 OP_1 OP_DEFINE c0ce598a6576009f6375516776d18201219c6353798767750068637c8c7c688c00686600a26975 85 OP_DEFINE c0c6c0cc88c0d0c0d3a169 86 OP_DEFINE 01207f75c0ce01207f7588 87 OP_DEFINE c08bcf548a75 OP_3 OP_DEFINE c08bcf548a77548a75 OP_2 OP_DEFINE c08bc7c08bcd88c08bcec08bd188 OP_5 OP_DEFINE 527a517aac69007900a069538a517993518a528a527993518a527a518a5279548a75518a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c05193ce01878a537953797ec05193d288558a537a75527a757452947600a063657692637c758c00675168666875517a6b6c0079c05293d288c0ce01207f7506c0ce01207f7c0120527a7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f7c750088c05293d30088c05293cc02b004a169005a8a6576009f6375516776d153798763578a63765279945253a56968688c006866757501868a588a 86a6f222 OP_DEFINE 527a517aac690079528aa169538a517994518a528a527a94518ac05193ce01878a517951797ec05193d288558a515a8a6576009f6375516776d153798763578a63006968688c006866757501868a588a b37fd68f OP_DEFINE 8263517f7c760100876375007c6776014f8763754f7c677681760151a27c0160a19a63810150947c6776014c876375517f7c01007e817f7c817c6776014d876375527f7c01007e817f7c817c67817f7c817c686868686867007c68 OP_4 OP_DEFINE c0ce01207f75517e598a6576009f6375516776d1537987637c8c7c688c006866009d75c0ce01207f75c0c48c OP_6 OP_DEFINE 76d3009c78d28277929a78d204000000007e547f75045343494487919a78cd015187919a OP_7 OP_DEFINE c05193c6c05193cc88c05193d0c05193d3a16951 OP_8 OP_DEFINE 00c38c6576009f6375516776ce537987637c8b7c688c006866c48c OP_9 OP_DEFINE 7a75007a75c0c7c0cd88c0cec0d18801858a568a OP_10 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
  source: 'contract GoldenToken(pubkey owner) {\n  bigint totalSupply;\n  bigint ownerBalance;\n\n  event Mint(bigint amount, bigint totalSupply);\n\n  function mint(bigint amount, sig s) {\n    require(checkSig(s, owner));\n    require(amount > 0, "Amount must be positive");\n    this.totalSupply = this.totalSupply + amount;\n    this.ownerBalance = this.ownerBalance + amount;\n    emit Mint(amount, this.totalSupply);\n  }\n\n  function burn(bigint amount, sig s) {\n    require(checkSig(s, owner));\n    require(amount <= this.ownerBalance, "Insufficient balance");\n    this.totalSupply = this.totalSupply - amount;\n    this.ownerBalance = this.ownerBalance - amount;\n  }\n}\n',
  debug: {
    bytecode: '4c5b76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68686868518927c0ce598a6576009f6375516776d18201219c6353798767750068637c8c7c688c00686600a269750185890bc0c6c0cc88c0d0c0d3a1690186890b01207f75c0ce01207f758801878906c08bcf548a75538909c08bcf548a77548a7552890ec08bc7c08bcd88c08bcec08bd18855894cec527a517aac69007900a069538a517993518a528a527993518a527a518a5279548a75518a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c05193ce01878a537953797ec05193d288558a537a75527a757452947600a063657692637c758c00675168666875517a6b6c0079c05293d288c0ce01207f7506c0ce01207f7c0120527a7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f7c750088c05293d30088c05293cc02b004a169005a8a6576009f6375516776d153798763578a63765279945253a56968688c006866757501868a588a0486a6f222894c50527a517aac690079528aa169538a517994518a528a527a94518ac05193ce01878a517951797ec05193d288558a515a8a6576009f6375516776d153798763578a63006968688c006866757501868a588a04b37fd68f894c5b8263517f7c760100876375007c6776014f8763754f7c677681760151a27c0160a19a63810150947c6776014c876375517f7c01007e817f7c817c6776014d876375527f7c01007e817f7c817c67817f7c817c686868686867007c6854892cc0ce01207f75517e598a6576009f6375516776d1537987637c8c7c688c006866009d75c0ce01207f75c0c48c56892476d3009c78d28277929a78d204000000007e547f75045343494487919a78cd015187919a578914c05193c6c05193cc88c05193d0c05193d3a1695158891b00c38c6576009f6375516776ce537987637c8b7c688c006866c48c5989147a75007a75c0c7c0cd88c0cec0d18801858a568a5a89748c7a82549d8a',
    sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;7:2:13:3;;;15::20;;;1:0:21:1;;;;;;;;;;;;;;;;;;;;;;;;',
    logs: [],
    requires: [],
    functionDebug: {
      '86a6f222': {
        requires: [
          {
            ip: 5,
            line: 8,
          },
          {
            ip: 10,
            line: 9,
            message: 'Amount must be positive',
          },
        ],
        logs: [],
        sourceMap: '8:21:8:22;;:24::29;;:12::30:1;:4::32;9:12:9:18:0;;:21::22;:12:::1;:4::51;10:23:10:39:0;;:42::48;;:23:::1;:4::49;;11:24:11:41:0;;:44::50;;:24:::1;:4::51;;12:14:12:20:0;;:4::40:1;;:22::38:0;;;;;:4::40:1;;;;7:2:13:3:0;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      b37fd68f: {
        requires: [
          {
            ip: 5,
            line: 16,
          },
          {
            ip: 11,
            line: 17,
            message: 'Insufficient balance',
          },
        ],
        logs: [],
        sourceMap: '16:21:16:22;;:24::29;;:12::30:1;:4::32;17:12:17:18:0;;:22::39;;:12:::1;:4::65;18:23:18:39:0;;:42::48;;:23:::1;:4::49;;19:24:19:41:0;;:44::50;;:24:::1;:4::51;;15:2:20:3:0;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
    },
    invokeDebug: {
      '1': {
        bytecode: '76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68686868',
        name: 'compiler helper 1',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '2': {
        bytecode: 'c08bcf548a77548a75',
        name: 'compiler helper 2',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;',
      },
      '3': {
        bytecode: 'c08bcf548a75',
        name: 'compiler helper 3',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;',
      },
      '4': {
        bytecode: '8263517f7c760100876375007c6776014f8763754f7c677681760151a27c0160a19a63810150947c6776014c876375517f7c01007e817f7c817c6776014d876375527f7c01007e817f7c817c67817f7c817c686868686867007c68',
        name: 'outlined source span 4',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '5': {
        bytecode: 'c08bc7c08bcd88c08bcec08bd188',
        name: 'compiler helper 5',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;',
      },
      '6': {
        bytecode: 'c0ce01207f75517e598a6576009f6375516776d1537987637c8c7c688c006866009d75c0ce01207f75c0c48c',
        name: 'outlined source span 6',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '7': {
        bytecode: '76d3009c78d28277929a78d204000000007e547f75045343494487919a78cd015187919a',
        name: 'outlined source span 7',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '8': {
        bytecode: 'c05193c6c05193cc88c05193d0c05193d3a16951',
        name: 'outlined source span 8',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;;;',
      },
      '9': {
        bytecode: '00c38c6576009f6375516776ce537987637c8b7c688c006866c48c',
        name: 'outlined source span 9',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '10': {
        bytecode: '7a75007a75c0c7c0cd88c0cec0d18801858a568a',
        name: 'outlined source span 10',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;;',
      },
      '-5': {
        bytecode: 'c0ce598a6576009f6375516776d18201219c6353798767750068637c8c7c688c00686600a26975',
        name: 'compiler helper -5',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '-6': {
        bytecode: 'c0c6c0cc88c0d0c0d3a169',
        name: 'compiler helper -6',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;',
      },
      '-7': {
        bytecode: '01207f75c0ce01207f7588',
        name: 'compiler helper -7',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;',
      },
    },
  },
  functionBodies: {
    '86a6f222': '527a517aac69007900a069538a517993518a528a527993518a527a518a5279548a75518a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c05193ce01878a537953797ec05193d288558a537a75527a757452947600a063657692637c758c00675168666875517a6b6c0079c05293d288c0ce01207f7506c0ce01207f7c0120527a7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f7c750088c05293d30088c05293cc02b004a169005a8a6576009f6375516776d153798763578a63765279945253a56968688c006866757501868a588a',
    b37fd68f: '527a517aac690079528aa169538a517994518a528a527a94518ac05193ce01878a517951797ec05193d288558a515a8a6576009f6375516776d153798763578a63006968688c006866757501868a588a',
  },
  fingerprint: '043538c1c7e8311a31d5ae7a455eb5becebe2934cc7bd46c141ebbf72798d525',
  stateLayout: {
    variables: [
      {
        name: 'totalSupply',
        type: 'bigint',
        nftIndex: 0,
        fieldIndex: 0,
      },
      {
        name: 'ownerBalance',
        type: 'bigint',
        nftIndex: 0,
        fieldIndex: 1,
      },
    ],
    dataNftCount: 1,
    commitmentLimit: 128,
  },
  events: [
    {
      name: 'Mint',
      signature: 'Mint(bigint,bigint)',
      parameters: [
        {
          name: 'amount',
          type: 'bigint',
        },
        {
          name: 'totalSupply',
          type: 'bigint',
        },
      ],
    },
  ],
  compiler: {
    name: 'solidc',
    version: '0.13.1',
    options: {
      enforceFunctionParameterTypes: true,
      enforceLocktimeGuard: true,
      enforceFinalRequire: true,
      allowUnsafeOperations: false,
      commitmentLimit: 128,
      messageBus: false,
    },
  },
  updatedAt: '2026-10-02T20:58:32.287Z',
  invocationAnalysis: {
    version: 1,
    protocolVersions: [
      1,
    ],
    functions: [
      {
        id: 0,
        name: 'mint',
        arity: 2,
        entryPoint: true,
        selector: '86a6f222',
        calls: [],
        closure: [
          0,
        ],
        component: 0,
        recursive: false,
        reads: [
          'state:ownerBalance',
          'state:totalSupply',
        ],
        writes: [
          'state:ownerBalance',
          'state:totalSupply',
        ],
        effects: [
          'events',
        ],
        unknown: false,
        bounded: true,
        maximumDirectInvocations: 0,
        emits: [
          {
            eventName: 'Mint',
            eventSignature: 'Mint(bigint,bigint)',
            emitIndex: 0,
          },
        ],
        blockLayout: {
          blockSize: 3,
          slots: [
            {
              kind: 'master',
              offset: 0,
            },
            {
              kind: 'dataNft',
              offset: 1,
              nftIndex: 0,
            },
            {
              kind: 'event',
              offset: 2,
              slotIndex: 0,
            },
          ],
        },
      },
      {
        id: 1,
        name: 'burn',
        arity: 2,
        entryPoint: true,
        selector: 'b37fd68f',
        calls: [],
        closure: [
          1,
        ],
        component: 1,
        recursive: false,
        reads: [
          'state:ownerBalance',
          'state:totalSupply',
        ],
        writes: [
          'state:ownerBalance',
          'state:totalSupply',
        ],
        effects: [],
        unknown: false,
        bounded: true,
        maximumDirectInvocations: 0,
        blockLayout: {
          blockSize: 2,
          slots: [
            {
              kind: 'master',
              offset: 0,
            },
            {
              kind: 'dataNft',
              offset: 1,
              nftIndex: 0,
            },
          ],
        },
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
      {
        id: 1,
        functions: [
          1,
        ],
        recursive: false,
      },
    ],
  },
} as const;
