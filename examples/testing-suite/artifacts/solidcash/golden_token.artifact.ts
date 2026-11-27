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
        {
          name: '__internal__genesisCall',
          type: 'bytes',
        },
        {
          name: '__internal__callRecordReader',
          type: 'bigint',
        },
        {
          name: '__internal__returnOutputIdx',
          type: 'bigint',
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
        blockSize: 4,
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
          {
            kind: 'returnEvent',
            offset: 3,
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
        {
          name: '__internal__genesisCall',
          type: 'bytes',
        },
        {
          name: '__internal__callRecordReader',
          type: 'bigint',
        },
        {
          name: '__internal__returnOutputIdx',
          type: 'bigint',
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
            kind: 'returnEvent',
            offset: 2,
          },
        ],
      },
    },
  ],
  bytecode: '76014c9c636d517f7c01007e817f6776014d9c636d527f7c01007e817f6776014e9c636d547f7c01007e817f67014f9d754f7c686868 91 OP_DEFINE 8263517f7c76817601510161a5630150945180777c6776014c9f63777f6701918a686867007c68 OP_1NEGATE OP_DEFINE 4f8a7c817c OP_2 OP_DEFINE 8276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e6868 82 OP_DEFINE 01207f75 OP_1 OP_DEFINE c0c6c0cc88c0d0c0d3a169 86 OP_DEFINE 01207f75c0ce01207f7588 87 OP_DEFINE c0c77c01207c7e7c01237c7e7c036376c752797e0788ce01207f52887e787e4c7888c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cd23aa20c42c11d1b80f1eae4c024fc765dd0c57701ca3a974579f9bbe600079e059b4f58788d100886867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e01938a 88 OP_DEFINE 01207c7e7c01207c7e7cc0c701237c7e7b7b04519d76c753797e0788ce01207f52887e52797e4988c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cd23aa20c42c11d1b80f1eae4c024fc765dd0c57701ca3a974579f9bbe600079e059b4f58788d10088687e787e0275517e7701938a 89 OP_DEFINE c08bcf528a77528a75 OP_4 OP_DEFINE 74529476798263778201249d7601227f7701007e8176c9009dc87801207f758801227f7502ffff7c7e7c527f777e67757952807e68 OP_8 OP_DEFINE 7ba8011f7f757b820160a1635167a852687c7e7e7c7600a2637dd28876d1c0ce518a8876d3008876cd015188cc02b004a1676d0068c0ce8263518a5e8a676d68 OP_10 OP_DEFINE c0ce01207f75517e4f6bc3658c76ce52798763766b6876009c667500656c76009f6375516776c0765293a56476cd78c78876d278cf8876d178ce8868758b006866c47663658c76d1537987637c8c7c6876009c666875009d75 OP_11 OP_DEFINE c0ce76518a7601888a78517e006b0000c365658c76ce827778c75679879b78919b6676c75579876376c6537a937b7b6876ce5779877b937c76ce76557987917c82779a636c7853807e6b68769166756c826365537f7c817c6b76c7827701239c6376ce82777601209c7c01219c9b6376ce01207f7576577987637576ce827701209c578a67bc56797c01898a7c76c77b87578a686868756c8291666875 OP_12 OP_DEFINE 0000c465658c76d159798778cd5879879b78919b6676cd5779876376cc537a937b7b6876d15979877b937c769166757ba169726d726d OP_13 OP_DEFINE 74569d06000086a6f222588a01958aad7800a069c08bcf528a7552799301968a548a53799301968a537a01968a5279528a7501968a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c08bce01878ac076c77cce518a538a88707ec08bd288c076c77cce518a538a608a537a757b757456947600a06365769263778c006751686668757c6b6c76c05293d288c0ce01207f7506c0ce01207f7c01207b7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f770088c05293d30088c05293cc02b004a1696d0054795a8ac0c7c0cd88c0cec0d1885b8a5c8a5d8aa169c0ce01207f75c0c46501948a63568a63765279945253a578748c799c9b6968687691666d7501868a5f8a 86a6f222 OP_DEFINE 74569d060000b37fd68f588a01958aad78548aa169c08bcf528a7552799401968a548a537a9401968ac08bce01878ac076c77cce518a538a886e7ec08bd288c076c77cce518a538a608a7c6d0054795a8ac0c7c0cd88c0cec0d1885b8a5c8a5d8aa169c0ce01207f75c0c46501948a63568a630078748c799c9b6968687691666d7501868a5f8a b37fd68f OP_DEFINE 01207c7e7c01237c7e7c032776c752797e04885189217e787e4ca2528976539c63757c518ace01207f5288528a88c0ce01207f5188528a8876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c6375518ace01207f5288528a88c0ce01207f5188528a88c0c49f63c0d1826301207f75528a87916967756868516763518ace01207f5288528a7d88c0ce01207f75886775c0ce01207f5188528a88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc8768687e01938ac08bc7 OP_3 OP_DEFINE 764f87636d014f6776817651a27c60a19a63758101509351806775517c7e6868 OP_5 OP_DEFINE 76d3009c78d28277929a78d27682770128a26376557f7505534349440187637682770123947f775379c7876775006867750068919a78cd015187919a OP_6 OP_DEFINE 6376cd78c78876d178ce8876d378d0a26976d278cf8876ce76827701219c6301207f775287916967756868 OP_7 OP_DEFINE 00c4658c76cd810200019701519c78d15479879a7b937c76916675779d OP_14 OP_DEFINE c08bc6c08bcc88c08bd0c08bd3a1696d7551 OP_15 OP_DEFINE 788875c08bc7c08bcd88c08bcec08bd188 OP_16 OP_DEFINE 7777aa02aa207c7e01877e 93 OP_DEFINE 658c76d153798778919b6676d1537987 94 OP_DEFINE 5279818252807c7e7e537a7b 95 OP_DEFINE 76820087636d01006782518763558a677501828a6868 96 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE 1744a65e30fda2209c561da7e1920101f44c313a02 OP_DROP',
  source: 'contract GoldenToken(pubkey owner) {\n  bigint totalSupply;\n  bigint ownerBalance;\n\n  event Mint(bigint amount, bigint totalSupply);\n\n  function mint(bigint amount, sig s) {\n    require(checkSig(s, owner));\n    require(amount > 0, "Amount must be positive");\n    this.totalSupply = this.totalSupply + amount;\n    this.ownerBalance = this.ownerBalance + amount;\n    emit Mint(amount, this.totalSupply);\n  }\n\n  function burn(bigint amount, sig s) {\n    require(checkSig(s, owner));\n    require(amount <= this.ownerBalance, "Insufficient balance");\n    this.totalSupply = this.totalSupply - amount;\n    this.ownerBalance = this.ownerBalance - amount;\n  }\n}\n',
  debug: {
    bytecode: '3676014c9c636d517f7c01007e817f6776014d9c636d527f7c01007e817f6776014e9c636d547f7c01007e817f67014f9d754f7c686868019189278263517f7c76817601510161a5630150945180777c6776014c9f63777f6701918a686867007c684f89054f8a7c817c52892a8276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68680182890401207f7551890bc0c6c0cc88c0d0c0d3a1690186890b01207f75c0ce01207f75880187894ca3c0c77c01207c7e7c01237c7e7c036376c752797e0788ce01207f52887e787e4c7888c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cd23aa20c42c11d1b80f1eae4c024fc765dd0c57701ca3a974579f9bbe600079e059b4f58788d100886867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e01938a0188894c7b01207c7e7c01207c7e7cc0c701237c7e7b7b04519d76c753797e0788ce01207f52887e52797e4988c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cd23aa20c42c11d1b80f1eae4c024fc765dd0c57701ca3a974579f9bbe600079e059b4f58788d10088687e787e0275517e7701938a01898909c08bcf528a77528a7554893574529476798263778201249d7601227f7701007e8176c9009dc87801207f758801227f7502ffff7c7e7c527f777e67757952807e685889407ba8011f7f757b820160a1635167a852687c7e7e7c7600a2637dd28876d1c0ce518a8876d3008876cd015188cc02b004a1676d0068c0ce8263518a5e8a676d685a894c59c0ce01207f75517e4f6bc3658c76ce52798763766b6876009c667500656c76009f6375516776c0765293a56476cd78c78876d278cf8876d178ce8868758b006866c47663658c76d1537987637c8c7c6876009c666875009d755b894c9dc0ce76518a7601888a78517e006b0000c365658c76ce827778c75679879b78919b6676c75579876376c6537a937b7b6876ce5779877b937c76ce76557987917c82779a636c7853807e6b68769166756c826365537f7c817c6b76c7827701239c6376ce82777601209c7c01219c9b6376ce01207f7576577987637576ce827701209c578a67bc56797c01898a7c76c77b87578a686868756c82916668755c89360000c465658c76d159798778cd5879879b78919b6676cd5779876376cc537a937b7b6876d15979877b937c769166757ba169726d726d5d894d1e0174569d06000086a6f222588a01958aad7800a069c08bcf528a7552799301968a548a53799301968a537a01968a5279528a7501968a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c08bce01878ac076c77cce518a538a88707ec08bd288c076c77cce518a538a608a537a757b757456947600a06365769263778c006751686668757c6b6c76c05293d288c0ce01207f7506c0ce01207f7c01207b7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f770088c05293d30088c05293cc02b004a1696d0054795a8ac0c7c0cd88c0cec0d1885b8a5c8a5d8aa169c0ce01207f75c0c46501948a63568a63765279945253a578748c799c9b6968687691666d7501868a5f8a0486a6f222894c8774569d060000b37fd68f588a01958aad78548aa169c08bcf528a7552799401968a548a537a9401968ac08bce01878ac076c77cce518a538a886e7ec08bd288c076c77cce518a538a608a7c6d0054795a8ac0c7c0cd88c0cec0d1885b8a5c8a5d8aa169c0ce01207f75c0c46501948a63568a630078748c799c9b6968687691666d7501868a5f8a04b37fd68f894cc401207c7e7c01237c7e7c032776c752797e04885189217e787e4ca2528976539c63757c518ace01207f5288528a88c0ce01207f5188528a8876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c6375518ace01207f5288528a88c0ce01207f5188528a88c0c49f63c0d1826301207f75528a87916967756868516763518ace01207f5288528a7d88c0ce01207f75886775c0ce01207f5188528a88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc8768687e01938ac08bc7538920764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686855893c76d3009c78d28277929a78d27682770128a26376557f7505534349440187637682770123947f775379c7876775006867750068919a78cd015187919a56892b6376cd78c78876d178ce8876d378d0a26976d278cf8876ce76827701219c6301207f77528791696775686857891d00c4658c76cd810200019701519c78d15479879a7b937c76916675779d5e8912c08bc6c08bcc88c08bd0c08bd3a1696d75515f8911788875c08bc7c08bcd88c08bcec08bd18860890b7777aa02aa207c7e01877e01938910658c76d153798778919b6676d15379870194890c5279818252807c7e7e537a7b0195891676820087636d01006782518763558a677501828a6868019689748c7a82549d8a151744a65e30fda2209c561da7e1920101f44c313a0275',
    sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;7:2:13:3;;;15::20;;;1:0:21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;',
    logs: [],
    requires: [],
    functionDebug: {
      '86a6f222': {
        requires: [
          {
            ip: 8,
            line: 8,
          },
          {
            ip: 12,
            line: 9,
            message: 'Amount must be positive',
          },
        ],
        logs: [],
        sourceMap: '7:2:13:3;;;;;;;;8:4:8:32:1;9:12:9:18:0;:21::22;:12:::1;:4::51;10:23:10:39:0;;;;;;:42::48;;:23:::1;:4::49;;11:24:11:41:0;;:44::50;;:24:::1;:4::51;;12:14:12:20:0;;:4::40:1;;:22::38:0;;;;;:4::40:1;;;;7:2:13:3:0;;;;;;;;;;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      b37fd68f: {
        requires: [
          {
            ip: 8,
            line: 16,
          },
          {
            ip: 13,
            line: 17,
            message: 'Insufficient balance',
          },
        ],
        logs: [],
        sourceMap: '15:2:20:3;;;;;;;;16:4:16:32:1;17:12:17:18:0;:22::39;;:12:::1;:4::65;18:23:18:39:0;;;;;;:42::48;;:23:::1;:4::49;;19:24:19:41:0;;:44::50;;:24:::1;:4::51;;15:2:20:3:0;;;;;;;;;;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
    },
    invokeDebug: {
      '1': {
        bytecode: '01207f75',
        name: 'compiler helper 1',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;',
      },
      '3': {
        bytecode: '01207c7e7c01237c7e7c032776c752797e04885189217e787e4ca2528976539c63757c518ace01207f5288528a88c0ce01207f5188528a8876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c6375518ace01207f5288528a88c0ce01207f5188528a88c0c49f63c0d1826301207f75528a87916967756868516763518ace01207f5288528a7d88c0ce01207f75886775c0ce01207f5188528a88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc8768687e01938ac08bc7',
        name: 'outlined source span 3',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3;;;;;;;;;;;;;;;;;;;;;;',
      },
      '4': {
        bytecode: 'c08bcf528a77528a75',
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
        bytecode: '74529476798263778201249d7601227f7701007e8176c9009dc87801207f758801227f7502ffff7c7e7c527f777e67757952807e68',
        name: 'compiler helper 8',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '9': {
        bytecode: 'c0ce8263518a5e8a676d68',
        name: 'compiler helper 9',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;',
      },
      '10': {
        bytecode: '7ba8011f7f757b820160a1635167a852687c7e7e7c7600a2637dd28876d1c0ce518a8876d3008876cd015188cc02b004a1676d0068c0ce8263518a5e8a676d68',
        name: 'compiler helper 10',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '11': {
        bytecode: 'c0ce01207f75517e4f6bc3658c76ce52798763766b6876009c667500656c76009f6375516776c0765293a56476cd78c78876d278cf8876d178ce8868758b006866c47663658c76d1537987637c8c7c6876009c666875009d75',
        name: 'compiler helper 11',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '12': {
        bytecode: 'c0ce76518a7601888a78517e006b0000c365658c76ce827778c75679879b78919b6676c75579876376c6537a937b7b6876ce5779877b937c76ce76557987917c82779a636c7853807e6b68769166756c826365537f7c817c6b76c7827701239c6376ce82777601209c7c01219c9b6376ce01207f7576577987637576ce827701209c578a67bc56797c01898a7c76c77b87578a686868756c8291666875',
        name: 'compiler helper 12',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '13': {
        bytecode: '0000c465658c76d159798778cd5879879b78919b6676cd5779876376cc537a937b7b6876d15979877b937c769166757ba169726d726d',
        name: 'compiler helper 13',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '14': {
        bytecode: '00c4658c76cd810200019701519c78d15479879a7b937c76916675779d',
        name: 'outlined source span 14',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '15': {
        bytecode: 'c08bc6c08bcc88c08bd0c08bd3a1696d7551',
        name: 'outlined source span 15',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;;',
      },
      '16': {
        bytecode: '788875c08bc7c08bcd88c08bcec08bd188',
        name: 'outlined source span 16',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;;',
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
        bytecode: 'c0c77c01207c7e7c01237c7e7c036376c752797e0788ce01207f52887e787e4c7888c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cd23aa20c42c11d1b80f1eae4c024fc765dd0c57701ca3a974579f9bbe600079e059b4f58788d100886867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f667575687e787e0275517e01938a',
        name: 'compiler helper -8',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '-9': {
        bytecode: '01207c7e7c01207c7e7cc0c701237c7e7b7b04519d76c753797e0788ce01207f52887e52797e4988c076cd78c7876376ce82776376d101207f757cce01207f75886775686776cd23aa20c42c11d1b80f1eae4c024fc765dd0c57701ca3a974579f9bbe600079e059b4f58788d10088687e787e0275517e7701938a',
        name: 'compiler helper -9',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
      '-19': {
        bytecode: '7777aa02aa207c7e01877e',
        name: 'outlined source span -19',
        requires: [],
        logs: [],
        sourceMap: '1::21:1;;;;;;;',
      },
      '-20': {
        bytecode: '658c76d153798778919b6676d1537987',
        name: 'outlined source span -20',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3:1;;;;;;;;;;;;;;;',
      },
      '-21': {
        bytecode: '5279818252807c7e7e537a7b',
        name: 'outlined source span -21',
        requires: [],
        logs: [],
        sourceMap: '7:2:13:3;;;;;;;;;8:21:8:22;;:24::29',
      },
      '-22': {
        bytecode: '76820087636d01006782518763558a677501828a6868',
        name: 'outlined source span -22',
        requires: [],
        logs: [],
        sourceMap: '10:4:10:49:1;;;;;;;;;;;;;;;;;;;',
      },
    },
  },
  callRecords: 'returning',
  callRecordReader: true,
  genesisCalls: true,
  recordSound: true,
  functionBodies: {
    '86a6f222': '74569d06000086a6f222588a01958aad7800a069c08bcf528a7552799301968a548a53799301968a537a01968a5279528a7501968a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c08bce01878ac076c77cce518a538a88707ec08bd288c076c77cce518a538a608a537a757b757456947600a06365769263778c006751686668757c6b6c76c05293d288c0ce01207f7506c0ce01207f7c01207b7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f770088c05293d30088c05293cc02b004a1696d0054795a8ac0c7c0cd88c0cec0d1885b8a5c8a5d8aa169c0ce01207f75c0c46501948a63568a63765279945253a578748c799c9b6968687691666d7501868a5f8a',
    b37fd68f: '74569d060000b37fd68f588a01958aad78548aa169c08bcf528a7552799401968a548a537a9401968ac08bce01878ac076c77cce518a538a886e7ec08bd288c076c77cce518a538a608a7c6d0054795a8ac0c7c0cd88c0cec0d1885b8a5c8a5d8aa169c0ce01207f75c0c46501948a63568a630078748c799c9b6968687691666d7501868a5f8a',
  },
  fingerprint: '798587d4d7c80b13ada90e54d0a18a848f1b94009df1d6b2877fee46570f2be6',
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
    version: '0.52.1',
    options: {
      enforceFunctionParameterTypes: true,
      enforceLocktimeGuard: true,
      enforceFinalRequire: true,
      allowUnsafeOperations: false,
      commitmentLimit: 1000000,
    },
  },
  updatedAt: '2026-11-25T16:11:17.728Z',
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
          blockSize: 4,
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
            {
              kind: 'returnEvent',
              offset: 3,
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
              kind: 'returnEvent',
              offset: 2,
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
