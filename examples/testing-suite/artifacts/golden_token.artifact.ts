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
  bytecode: '76014c9c636d517f7c01007e817f6776014d9c636d527f7c01007e817f67014f9d754f7c6868 91 OP_DEFINE 8263517f7c76817601510161a5630150945180777c6776014c9f63777f6701918a686867007c68 OP_1NEGATE OP_DEFINE 4f8a7c817c OP_1 OP_DEFINE 8276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e6868 82 OP_DEFINE 01207f75 OP_3 OP_DEFINE c0ce00c3658c76ce5379877b937c76916675c47663658c76d15379877b7c947c769166687500a26975 85 OP_DEFINE c0c6c0cc88c0d0c0d3a169 86 OP_DEFINE 01207f75c0ce01207f7588 87 OP_DEFINE c0c77c01207c7e7c01237c7e7c036376c752797e5c8a787e308867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e5d8a 88 OP_DEFINE 01207c7e7c01207c7e7cc0c701237c7e7b7b036376c753797e5c8a52797e308867767676cdc0c788ccc0c6a269d3c0d0a269d1c0ce88c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e775d8a 89 OP_DEFINE c08bcf518a77518a75 OP_4 OP_DEFINE c0ce538a01888a00c3658c76c75379876376c67b937c68769166757c00c4658c76cd5379876376cc7b937c68769166757ba26975 OP_8 OP_DEFINE c0ce538a76517e00c3658c76ce76547987917c82779a637653807b7c7e7c687691667577826365537f7c817c6b76c7827701239c6376ce82777601209c7c01219c9b6376ce01207f7576537987637576ce827701209c578a67bc52797c01898a7c76c77b87578a686868756c829166686d OP_9 OP_DEFINE 7b7cad7600a069c08bcf518a757893608a548a527993608a7b608a5279518a75608a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c08bce01878a707ec08bd288c076c77cce538a528a537a757b757452947600a06365769263778c006751686668757c6b6c76c05293d288c0ce01207f7506c0ce01207f7c01207b7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f770088c05293d30088c05293cc02b004a1695f8a635e8a6875009d75588a598ac0ce01207f75c0c48c6576009f6375516776d153798763568a63765279945253a56968688c0068666d01868a5a8a 86a6f222 OP_DEFINE 7b7cad76548aa169c08bcf518a757894608a548a7b94608ac08bce01878a6e7ec08bd288c076c77cce538a528a7c5f8a635e8a6875009d75588a598ac0ce01207f75c0c48c6576009f6375516776d153798763568a63006968688c0068666d01868a5a8a b37fd68f OP_DEFINE 01207c7e7c01237c7e7c0876539c63757c76c75b8a1f8876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c637576c77e5b8a0d88c0c49f63c0d1826301207f757e787e0c8791696775686851676376c77e52797e5c8a787e127d88c0ce01207f75886775c0ce01207f51887e787e1e88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc8768687e5d8ac08bc7788875c08bc7c08bcd88c08bcec08bd188 OP_2 OP_DEFINE 764f87636d014f6776817651a27c60a19a63758101509351806775517c7e6868 OP_5 OP_DEFINE 76d3009c78d28277929a78d27682770128a26376557f7505534349440187637682770123947f775379c7876775006867750068919a78cd015187919a OP_6 OP_DEFINE 6376cd78c78876d178ce8876d378d0a26968 OP_7 OP_DEFINE c08bc6c08bcc88c08bd0c08bd3a16951 OP_10 OP_DEFINE 52797e0788ce01207f52887e787e0888c0ce01207f51887e787e OP_11 OP_DEFINE 0788ce01207f52887e OP_12 OP_DEFINE 7777aa02aa207c7e01877e OP_13 OP_DEFINE 658c76d1537987637c8c7c6876009c66 OP_14 OP_DEFINE 6dc0c7c0cd88c0cec0d18801858ac0ce01207f75517e00c3658c76ce537987637c8b7c6876009c6675c476 OP_15 OP_DEFINE 76820087636d01006782518763558a677501828a6868 OP_16 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
  source: 'contract GoldenToken(pubkey owner) {\n  bigint totalSupply;\n  bigint ownerBalance;\n\n  event Mint(bigint amount, bigint totalSupply);\n\n  function mint(bigint amount, sig s) {\n    require(checkSig(s, owner));\n    require(amount > 0, "Amount must be positive");\n    this.totalSupply = this.totalSupply + amount;\n    this.ownerBalance = this.ownerBalance + amount;\n    emit Mint(amount, this.totalSupply);\n  }\n\n  function burn(bigint amount, sig s) {\n    require(checkSig(s, owner));\n    require(amount <= this.ownerBalance, "Insufficient balance");\n    this.totalSupply = this.totalSupply - amount;\n    this.ownerBalance = this.ownerBalance - amount;\n  }\n}\n',
  debug: {
    bytecode: '2676014c9c636d517f7c01007e817f6776014d9c636d527f7c01007e817f67014f9d754f7c6868019189278263517f7c76817601510161a5630150945180777c6776014c9f63777f6701918a686867007c684f89054f8a7c817c51892a8276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68680182890401207f75538929c0ce00c3658c76ce5379877b937c76916675c47663658c76d15379877b7c947c769166687500a269750185890bc0c6c0cc88c0d0c0d3a1690186890b01207f75c0ce01207f75880187894c52c0c77c01207c7e7c01237c7e7c036376c752797e5c8a787e308867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e5d8a0188894c5901207c7e7c01207c7e7cc0c701237c7e7b7b036376c753797e5c8a52797e308867767676cdc0c788ccc0c6a269d3c0d0a269d1c0ce88c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e775d8a01898909c08bcf518a77518a75548934c0ce538a01888a00c3658c76c75379876376c67b937c68769166757c00c4658c76cd5379876376cc7b937c68769166757ba2697558894c71c0ce538a76517e00c3658c76ce76547987917c82779a637653807b7c7e7c687691667577826365537f7c817c6b76c7827701239c6376ce82777601209c7c01219c9b6376ce01207f7576537987637576ce827701209c578a67bc52797c01898a7c76c77b87578a686868756c829166686d59894cf97b7cad7600a069c08bcf518a757893608a548a527993608a7b608a5279518a75608a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c08bce01878a707ec08bd288c076c77cce538a528a537a757b757452947600a06365769263778c006751686668757c6b6c76c05293d288c0ce01207f7506c0ce01207f7c01207b7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f770088c05293d30088c05293cc02b004a1695f8a635e8a6875009d75588a598ac0ce01207f75c0c48c6576009f6375516776d153798763568a63765279945253a56968688c0068666d01868a5a8a0486a6f222894c647b7cad76548aa169c08bcf518a757894608a548a7b94608ac08bce01878a6e7ec08bd288c076c77cce538a528a7c5f8a635e8a6875009d75588a598ac0ce01207f75c0c48c6576009f6375516776d153798763568a63006968688c0068666d01868a5a8a04b37fd68f894caa01207c7e7c01237c7e7c0876539c63757c76c75b8a1f8876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c637576c77e5b8a0d88c0c49f63c0d1826301207f757e787e0c8791696775686851676376c77e52797e5c8a787e127d88c0ce01207f75886775c0ce01207f51887e787e1e88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc8768687e5d8ac08bc7788875c08bc7c08bcd88c08bcec08bd188528920764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686855893c76d3009c78d28277929a78d27682770128a26376557f7505534349440187637682770123947f775379c7876775006867750068919a78cd015187919a5689126376cd78c78876d178ce8876d378d0a26968578910c08bc6c08bcc88c08bd0c08bd3a169515a891a52797e0788ce01207f52887e787e0888c0ce01207f51887e787e5b89090788ce01207f52887e5c890b7777aa02aa207c7e01877e5d8910658c76d1537987637c8c7c6876009c665e892b6dc0c7c0cd88c0cec0d18801858ac0ce01207f75517e00c3658c76ce537987637c8b7c6876009c6675c4765f891676820087636d01006782518763558a677501828a68686089748c7a82549d8a',
    sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;7:2:13:3;;;15::20;;;1:0:21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
    logs: [],
    requires: [],
    functionDebug: {
      '86a6f222': {
        requires: [
          {
            ip: 2,
            line: 8,
          },
          {
            ip: 6,
            line: 9,
            message: 'Amount must be positive',
          },
        ],
        logs: [],
        sourceMap: '8:21:8:22;:24::29;:4::32:1;9:12:9:18:0;:21::22;:12:::1;:4::51;10:23:10:39:0;;;;;;:42::48;:23:::1;:4::49;;11:24:11:41:0;;:44::50;;:24:::1;:4::51;;12:14:12:20:0;:4::40:1;;:22::38:0;;;;;:4::40:1;;;;7:2:13:3:0;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      b37fd68f: {
        requires: [
          {
            ip: 2,
            line: 16,
          },
          {
            ip: 7,
            line: 17,
            message: 'Insufficient balance',
          },
        ],
        logs: [],
        sourceMap: '16:21:16:22;:24::29;:4::32:1;17:12:17:18:0;:22::39;;:12:::1;:4::65;18:23:18:39:0;;;;;;:42::48;:23:::1;:4::49;;19:24:19:41:0;;:44::50;:24:::1;:4::51;;15:2:20:3:0;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
    },
    invokeDebug: {
      '2': {
        bytecode: '01207c7e7c01237c7e7c0876539c63757c76c75b8a1f8876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c637576c77e5b8a0d88c0c49f63c0d1826301207f757e787e0c8791696775686851676376c77e52797e5c8a787e127d88c0ce01207f75886775c0ce01207f51887e787e1e88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc8768687e5d8ac08bc7788875c08bc7c08bcd88c08bcec08bd188',
        name: 'outlined source span 2',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '3': {
        bytecode: '01207f75',
        name: 'compiler helper 3',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;',
      },
      '4': {
        bytecode: 'c08bcf518a77518a75',
        name: 'compiler helper 4',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;',
      },
      '5': {
        bytecode: '764f87636d014f6776817651a27c60a19a63758101509351806775517c7e6868',
        name: 'outlined source span 5',
        requires: [],
        logs: [],
        sourceMap: '10:4:10:49:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '6': {
        bytecode: '76d3009c78d28277929a78d27682770128a26376557f7505534349440187637682770123947f775379c7876775006867750068919a78cd015187919a',
        name: 'outlined source span 6',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '7': {
        bytecode: '6376cd78c78876d178ce8876d378d0a26968',
        name: 'outlined source span 7',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;',
      },
      '8': {
        bytecode: 'c0ce538a01888a00c3658c76c75379876376c67b937c68769166757c00c4658c76cd5379876376cc7b937c68769166757ba26975',
        name: 'compiler helper 8',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '9': {
        bytecode: 'c0ce538a76517e00c3658c76ce76547987917c82779a637653807b7c7e7c687691667577826365537f7c817c6b76c7827701239c6376ce82777601209c7c01219c9b6376ce01207f7576537987637576ce827701209c578a67bc52797c01898a7c76c77b87578a686868756c829166686d',
        name: 'compiler helper 9',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '10': {
        bytecode: 'c08bc6c08bcc88c08bd0c08bd3a16951',
        name: 'outlined source span 10',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;',
      },
      '11': {
        bytecode: '52797e0788ce01207f52887e787e0888c0ce01207f51887e787e',
        name: 'outlined source span 11',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;',
      },
      '12': {
        bytecode: '0788ce01207f52887e',
        name: 'outlined source span 12',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;',
      },
      '13': {
        bytecode: '7777aa02aa207c7e01877e',
        name: 'outlined source span 13',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;',
      },
      '14': {
        bytecode: '658c76d1537987637c8c7c6876009c66',
        name: 'outlined source span 14',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;',
      },
      '15': {
        bytecode: '6dc0c7c0cd88c0cec0d18801858ac0ce01207f75517e00c3658c76ce537987637c8b7c6876009c6675c476',
        name: 'outlined source span 15',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '16': {
        bytecode: '76820087636d01006782518763558a677501828a6868',
        name: 'outlined source span 16',
        requires: [],
        logs: [],
        sourceMap: '10:4:10:49:1;;;;;;;;;;;;;;;;;;;',
      },
      '-2': {
        bytecode: '8276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e6868',
        name: 'compiler helper -2',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '-5': {
        bytecode: 'c0ce00c3658c76ce5379877b937c76916675c47663658c76d15379877b7c947c769166687500a26975',
        name: 'compiler helper -5',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
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
      '-8': {
        bytecode: 'c0c77c01207c7e7c01237c7e7c036376c752797e5c8a787e308867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e5d8a',
        name: 'compiler helper -8',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '-9': {
        bytecode: '01207c7e7c01207c7e7cc0c701237c7e7b7b036376c753797e5c8a52797e308867767676cdc0c788ccc0c6a269d3c0d0a269d1c0ce88c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e775d8a',
        name: 'compiler helper -9',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
    },
  },
  functionBodies: {
    '86a6f222': '7b7cad7600a069c08bcf518a757893608a548a527993608a7b608a5279518a75608a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c08bce01878a707ec08bd288c076c77cce538a528a537a757b757452947600a06365769263778c006751686668757c6b6c76c05293d288c0ce01207f7506c0ce01207f7c01207b7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f770088c05293d30088c05293cc02b004a1695f8a635e8a6875009d75588a598ac0ce01207f75c0c48c6576009f6375516776d153798763568a63765279945253a56968688c0068666d01868a5a8a',
    b37fd68f: '7b7cad76548aa169c08bcf518a757894608a548a7b94608ac08bce01878a6e7ec08bd288c076c77cce538a528a7c5f8a635e8a6875009d75588a598ac0ce01207f75c0c48c6576009f6375516776d153798763568a63006968688c0068666d01868a5a8a',
  },
  fingerprint: '65030fca114bf485411abb5c156c09ed4c4aa27826bf209dafe162c4ceda46b0',
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
  updatedAt: '2026-10-13T14:25:48.601Z',
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
