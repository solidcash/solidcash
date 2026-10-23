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
  bytecode: '76014c9c636d517f7c01007e817f6776014d9c636d527f7c01007e817f6776014e9c636d547f7c01007e817f67014f9d754f7c686868 91 OP_DEFINE 8263517f7c76817601510161a5630150945180777c6776014c9f63777f6701918a686867007c68 OP_1NEGATE OP_DEFINE 4f8a7c817c OP_1 OP_DEFINE 8276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e6868 82 OP_DEFINE 01207f75 OP_3 OP_DEFINE c0c6c0cc88c0d0c0d3a169 86 OP_DEFINE 01207f75c0ce01207f7588 87 OP_DEFINE c0c77c01207c7e7c01237c7e7c036376c752797e5e8a787e4c5588c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cc009dd3009d6867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e5f8a 88 OP_DEFINE 01207c7e7c01207c7e7cc0c701237c7e7b7b04519d76c753797e5e8a52797e2688c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cc009dd3009d687e787e0275517e775f8a 89 OP_DEFINE c08bcf518a77518a75 OP_4 OP_DEFINE c0ce01207f75517e4f6bc3658c76ce52798763766b6876009c667500656c76009f6375516776c0765293a56476cd78c78876d278cf8876d178ce8868758b006866c47663658c76d1537987637c8c7c6876009c666875009d75 OP_8 OP_DEFINE c0ce76538a7601888a78517e006b0000c365658c76ce827778c75679879b78919b6676c75579876376c6537a937b7b6876ce5779877b937c76ce76557987917c82779a636c7853807e6b68769166756c826365537f7c817c6b76c7827701239c6376ce82777601209c7c01219c9b6376ce01207f7576577987637576ce827701209c578a67bc56797c01898a7c76c77b87578a686868756c8291666875 OP_9 OP_DEFINE 0000c465658c76d159798778cd5879879b78919b6676cd5779876376cc537a937b7b6876d15979877b937c769166757ba169726d726d OP_10 OP_DEFINE 7b7cad7600a069c08bcf518a75789301938a548a52799301938a7b01938a5279518a7501938a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c08bce01878ac076c77cce538a528a88707ec08bd288c076c77cce538a528a5b8a537a757b757452947600a06365769263778c006751686668757c6b6c76c05293d288c0ce01207f7506c0ce01207f7c01207b7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f770088c05293d30088c05293cc02b004a1696dc0c7c0cd88c0cec0d188588a598a5a8aa169c0ce01207f75c0c465608a63568a63765279945253a56968687691666d7501868a5c8a 86a6f222 OP_DEFINE 7b7cad76548aa169c08bcf518a75789401938a548a7b9401938ac08bce01878ac076c77cce538a528a886e7ec08bd288c076c77cce538a528a5b8a7c6dc0c7c0cd88c0cec0d188588a598a5a8aa169c0ce01207f75c0c465608a63568a63006968687691666d7501868a5c8a b37fd68f OP_DEFINE 01207c7e7c01237c7e7c0876539c63757c76c75d8a1f8876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c637576c77e5d8a0d88c0c49f63c0d1826301207f757e787e0c8791696775686851676376c77e52797e5e8a787e127d88c0ce01207f75886775c0ce01207f51887e787e1e88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc8768687e5f8ac08bc7 OP_2 OP_DEFINE 764f87636d014f6776817651a27c60a19a63758101509351806775517c7e6868 OP_5 OP_DEFINE 76d3009c78d28277929a78d27682770128a26376557f7505534349440187637682770123947f775379c7876775006867750068919a78cd015187919a OP_6 OP_DEFINE 6376cd78c78876d178ce8876d378d0a26976d278cf8876ce76827701219c6301207f775287916967756868 OP_7 OP_DEFINE 788875c08bc7c08bcd88c08bcec08bd188 OP_11 OP_DEFINE c08bc6c08bcc88c08bd0c08bd3a16951 OP_12 OP_DEFINE 52797e0788ce01207f52887e787e0888c0ce01207f51887e787e OP_13 OP_DEFINE 0788ce01207f52887e OP_14 OP_DEFINE 7777aa02aa207c7e01877e OP_15 OP_DEFINE 658c76d153798778919b6676d1537987 OP_16 OP_DEFINE 76820087636d01006782518763558a677501828a6868 93 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
  source: 'contract GoldenToken(pubkey owner) {\n  bigint totalSupply;\n  bigint ownerBalance;\n\n  event Mint(bigint amount, bigint totalSupply);\n\n  function mint(bigint amount, sig s) {\n    require(checkSig(s, owner));\n    require(amount > 0, "Amount must be positive");\n    this.totalSupply = this.totalSupply + amount;\n    this.ownerBalance = this.ownerBalance + amount;\n    emit Mint(amount, this.totalSupply);\n  }\n\n  function burn(bigint amount, sig s) {\n    require(checkSig(s, owner));\n    require(amount <= this.ownerBalance, "Insufficient balance");\n    this.totalSupply = this.totalSupply - amount;\n    this.ownerBalance = this.ownerBalance - amount;\n  }\n}\n',
  debug: {
    bytecode: '3676014c9c636d517f7c01007e817f6776014d9c636d527f7c01007e817f6776014e9c636d547f7c01007e817f67014f9d754f7c686868019189278263517f7c76817601510161a5630150945180777c6776014c9f63777f6701918a686867007c684f89054f8a7c817c51892a8276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68680182890401207f7553890bc0c6c0cc88c0d0c0d3a1690186890b01207f75c0ce01207f75880187894c78c0c77c01207c7e7c01237c7e7c036376c752797e5e8a787e4c5588c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cc009dd3009d6867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e5f8a0188894c5001207c7e7c01207c7e7cc0c701237c7e7b7b04519d76c753797e5e8a52797e2688c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cc009dd3009d687e787e0275517e775f8a01898909c08bcf518a77518a7554894c59c0ce01207f75517e4f6bc3658c76ce52798763766b6876009c667500656c76009f6375516776c0765293a56476cd78c78876d278cf8876d178ce8868758b006866c47663658c76d1537987637c8c7c6876009c666875009d7558894c9dc0ce76538a7601888a78517e006b0000c365658c76ce827778c75679879b78919b6676c75579876376c6537a937b7b6876ce5779877b937c76ce76557987917c82779a636c7853807e6b68769166756c826365537f7c817c6b76c7827701239c6376ce82777601209c7c01219c9b6376ce01207f7576577987637576ce827701209c578a67bc56797c01898a7c76c77b87578a686868756c82916668755989360000c465658c76d159798778cd5879879b78919b6676cd5779876376cc537a937b7b6876d15979877b937c769166757ba169726d726d5a894d03017b7cad7600a069c08bcf518a75789301938a548a52799301938a7b01938a5279518a7501938a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c08bce01878ac076c77cce538a528a88707ec08bd288c076c77cce538a528a5b8a537a757b757452947600a06365769263778c006751686668757c6b6c76c05293d288c0ce01207f7506c0ce01207f7c01207b7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f770088c05293d30088c05293cc02b004a1696dc0c7c0cd88c0cec0d188588a598a5a8aa169c0ce01207f75c0c465608a63568a63765279945253a56968687691666d7501868a5c8a0486a6f222894c6c7b7cad76548aa169c08bcf518a75789401938a548a7b9401938ac08bce01878ac076c77cce538a528a886e7ec08bd288c076c77cce538a528a5b8a7c6dc0c7c0cd88c0cec0d188588a598a5a8aa169c0ce01207f75c0c465608a63568a63006968687691666d7501868a5c8a04b37fd68f894c9901207c7e7c01237c7e7c0876539c63757c76c75d8a1f8876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c637576c77e5d8a0d88c0c49f63c0d1826301207f757e787e0c8791696775686851676376c77e52797e5e8a787e127d88c0ce01207f75886775c0ce01207f51887e787e1e88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc8768687e5f8ac08bc7528920764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686855893c76d3009c78d28277929a78d27682770128a26376557f7505534349440187637682770123947f775379c7876775006867750068919a78cd015187919a56892b6376cd78c78876d178ce8876d378d0a26976d278cf8876ce76827701219c6301207f775287916967756868578911788875c08bc7c08bcd88c08bcec08bd1885b8910c08bc6c08bcc88c08bd0c08bd3a169515c891a52797e0788ce01207f52887e787e0888c0ce01207f51887e787e5d89090788ce01207f52887e5e890b7777aa02aa207c7e01877e5f8910658c76d153798778919b6676d153798760891676820087636d01006782518763558a677501828a6868019389748c7a82549d8a',
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
        sourceMap: '8:21:8:22;:24::29;:4::32:1;9:12:9:18:0;:21::22;:12:::1;:4::51;10:23:10:39:0;;;;;;:42::48;:23:::1;:4::49;;11:24:11:41:0;;:44::50;;:24:::1;:4::51;;12:14:12:20:0;:4::40:1;;:22::38:0;;;;;:4::40:1;;;;7:2:13:3:0;;;;;;;;;;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
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
        sourceMap: '16:21:16:22;:24::29;:4::32:1;17:12:17:18:0;:22::39;;:12:::1;:4::65;18:23:18:39:0;;;;;;:42::48;:23:::1;:4::49;;19:24:19:41:0;;:44::50;:24:::1;:4::51;;15:2:20:3:0;;;;;;;;;;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
    },
    invokeDebug: {
      '2': {
        bytecode: '01207c7e7c01237c7e7c0876539c63757c76c75d8a1f8876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c637576c77e5d8a0d88c0c49f63c0d1826301207f757e787e0c8791696775686851676376c77e52797e5e8a787e127d88c0ce01207f75886775c0ce01207f51887e787e1e88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc8768687e5f8ac08bc7',
        name: 'outlined source span 2',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
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
        bytecode: '6376cd78c78876d178ce8876d378d0a26976d278cf8876ce76827701219c6301207f775287916967756868',
        name: 'outlined source span 7',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '8': {
        bytecode: 'c0ce01207f75517e4f6bc3658c76ce52798763766b6876009c667500656c76009f6375516776c0765293a56476cd78c78876d278cf8876d178ce8868758b006866c47663658c76d1537987637c8c7c6876009c666875009d75',
        name: 'compiler helper 8',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '9': {
        bytecode: 'c0ce76538a7601888a78517e006b0000c365658c76ce827778c75679879b78919b6676c75579876376c6537a937b7b6876ce5779877b937c76ce76557987917c82779a636c7853807e6b68769166756c826365537f7c817c6b76c7827701239c6376ce82777601209c7c01219c9b6376ce01207f7576577987637576ce827701209c578a67bc56797c01898a7c76c77b87578a686868756c8291666875',
        name: 'compiler helper 9',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '10': {
        bytecode: '0000c465658c76d159798778cd5879879b78919b6676cd5779876376cc537a937b7b6876d15979877b937c769166757ba169726d726d',
        name: 'compiler helper 10',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '11': {
        bytecode: '788875c08bc7c08bcd88c08bcec08bd188',
        name: 'outlined source span 11',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;',
      },
      '12': {
        bytecode: 'c08bc6c08bcc88c08bd0c08bd3a16951',
        name: 'outlined source span 12',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;',
      },
      '13': {
        bytecode: '52797e0788ce01207f52887e787e0888c0ce01207f51887e787e',
        name: 'outlined source span 13',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3;;;;;;;;;;',
      },
      '14': {
        bytecode: '0788ce01207f52887e',
        name: 'outlined source span 14',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;',
      },
      '15': {
        bytecode: '7777aa02aa207c7e01877e',
        name: 'outlined source span 15',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;',
      },
      '16': {
        bytecode: '658c76d153798778919b6676d1537987',
        name: 'outlined source span 16',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;',
      },
      '-2': {
        bytecode: '8276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e6868',
        name: 'compiler helper -2',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
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
        bytecode: 'c0c77c01207c7e7c01237c7e7c036376c752797e5e8a787e4c5588c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cc009dd3009d6867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e5f8a',
        name: 'compiler helper -8',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '-9': {
        bytecode: '01207c7e7c01207c7e7cc0c701237c7e7b7b04519d76c753797e5e8a52797e2688c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cc009dd3009d687e787e0275517e775f8a',
        name: 'compiler helper -9',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '-19': {
        bytecode: '76820087636d01006782518763558a677501828a6868',
        name: 'outlined source span -19',
        requires: [],
        logs: [],
        sourceMap: '10:4:10:49:1;;;;;;;;;;;;;;;;;;;',
      },
    },
  },
  functionBodies: {
    '86a6f222': '7b7cad7600a069c08bcf518a75789301938a548a52799301938a7b01938a5279518a7501938a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c08bce01878ac076c77cce538a528a88707ec08bd288c076c77cce538a528a5b8a537a757b757452947600a06365769263778c006751686668757c6b6c76c05293d288c0ce01207f7506c0ce01207f7c01207b7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f770088c05293d30088c05293cc02b004a1696dc0c7c0cd88c0cec0d188588a598a5a8aa169c0ce01207f75c0c465608a63568a63765279945253a56968687691666d7501868a5c8a',
    b37fd68f: '7b7cad76548aa169c08bcf518a75789401938a548a7b9401938ac08bce01878ac076c77cce538a528a886e7ec08bd288c076c77cce538a528a5b8a7c6dc0c7c0cd88c0cec0d188588a598a5a8aa169c0ce01207f75c0c465608a63568a63006968687691666d7501868a5c8a',
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
    commitmentLimit: 1000000,
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
    version: '0.14.0-beta.1',
    options: {
      enforceFunctionParameterTypes: true,
      enforceLocktimeGuard: true,
      enforceFinalRequire: true,
      allowUnsafeOperations: false,
      commitmentLimit: 1000000,
      messageBus: false,
    },
  },
  updatedAt: '2026-10-23T08:18:14.851Z',
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
