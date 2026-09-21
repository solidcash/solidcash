declare const _default: {
    readonly contractName: "GoldenToken";
    readonly constructorInputs: readonly [{
        readonly name: "owner";
        readonly type: "pubkey";
    }];
    readonly abi: readonly [{
        readonly name: "mint";
        readonly selector: "86a6f222";
        readonly inputs: readonly [{
            readonly name: "amount";
            readonly type: "bigint";
        }, {
            readonly name: "s";
            readonly type: "sig";
        }];
        readonly writesState: true;
        readonly requiredNftIndices: readonly [0];
        readonly emits: readonly [{
            readonly eventName: "Mint";
            readonly eventSignature: "Mint(bigint,bigint)";
            readonly emitIndex: 0;
        }];
        readonly signatureGuard: {
            readonly key: {
                readonly kind: "constructorArg";
                readonly name: "owner";
            };
        };
        readonly blockLayout: {
            readonly blockSize: 3;
            readonly slots: readonly [{
                readonly kind: "master";
                readonly offset: 0;
            }, {
                readonly kind: "dataNft";
                readonly offset: 1;
                readonly nftIndex: 0;
            }, {
                readonly kind: "event";
                readonly offset: 2;
                readonly slotIndex: 0;
            }];
        };
    }, {
        readonly name: "burn";
        readonly selector: "b37fd68f";
        readonly inputs: readonly [{
            readonly name: "amount";
            readonly type: "bigint";
        }, {
            readonly name: "s";
            readonly type: "sig";
        }];
        readonly writesState: true;
        readonly requiredNftIndices: readonly [0];
        readonly signatureGuard: {
            readonly key: {
                readonly kind: "constructorArg";
                readonly name: "owner";
            };
        };
        readonly blockLayout: {
            readonly blockSize: 2;
            readonly slots: readonly [{
                readonly kind: "master";
                readonly offset: 0;
            }, {
                readonly kind: "dataNft";
                readonly offset: 1;
                readonly nftIndex: 0;
            }];
        };
    }];
    readonly bytecode: "76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68686868 OP_1 OP_DEFINE c0ce598a6576009f6375516776d18201219c6353798767750068637c8c7c688c00686600a26975 85 OP_DEFINE c0c6c0cc88c0d0c0d3a169 86 OP_DEFINE 01207f75c0ce01207f7588 87 OP_DEFINE c08bcf548a75 OP_3 OP_DEFINE c08bcf548a77548a75 OP_2 OP_DEFINE c08bc7c08bcd88c08bcec08bd188 OP_5 OP_DEFINE 527a517aac69007900a069538a517993518a528a527993518a527a518a5279548a75518a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c05193ce01878a537953797ec05193d288558a537a75527a757452947600a063657692637c758c00675168666875517a6b6c0079c05293d288c0ce01207f7506c0ce01207f7c0120527a7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f7c750088c05293d30088c05293cc02b004a169007a75007a75c0c7c0cd88c0cec0d18801858a568a6576009f6375516776d153798763578a63765279945253a56968688c006866757501868a588a 86a6f222 OP_DEFINE 527a517aac690079528aa169538a517994518a528a527a94518ac05193ce01878a517951797ec05193d288558a517a75007a75c0c7c0cd88c0cec0d18801858a568a6576009f6375516776d153798763578a63006968688c006866757501868a588a b37fd68f OP_DEFINE 8263517f7c760100876375007c6776014f8763754f7c677681760151a27c0160a19a63810150947c6776014c876375517f7c01007e817f7c817c6776014d876375527f7c01007e817f7c817c67817f7c817c686868686867007c68 OP_4 OP_DEFINE c0ce01207f75517e598a6576009f6375516776d1537987637c8c7c688c006866009d75c0ce01207f75c0c48c OP_6 OP_DEFINE 76d3009c78d28277929a78cd015187919a78d204000000007e547f75045343494487919a OP_7 OP_DEFINE c05193c6c05193cc88c05193d0c05193d3a16951 OP_8 OP_DEFINE 00c38c6576009f6375516776ce537987637c8b7c688c006866c48c OP_9 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE";
    readonly source: "contract GoldenToken(pubkey owner) {\n  bigint totalSupply;\n  bigint ownerBalance;\n\n  event Mint(bigint amount, bigint totalSupply);\n\n  function mint(bigint amount, sig s) {\n    require(checkSig(s, owner));\n    require(amount > 0, \"Amount must be positive\");\n    this.totalSupply = this.totalSupply + amount;\n    this.ownerBalance = this.ownerBalance + amount;\n    emit Mint(amount, this.totalSupply);\n  }\n\n  function burn(bigint amount, sig s) {\n    require(checkSig(s, owner));\n    require(amount <= this.ownerBalance, \"Insufficient balance\");\n    this.totalSupply = this.totalSupply - amount;\n    this.ownerBalance = this.ownerBalance - amount;\n  }\n}\n";
    readonly debug: {
        readonly bytecode: "4c5b76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68686868518927c0ce598a6576009f6375516776d18201219c6353798767750068637c8c7c688c00686600a269750185890bc0c6c0cc88c0d0c0d3a1690186890b01207f75c0ce01207f758801878906c08bcf548a75538909c08bcf548a77548a7552890ec08bc7c08bcd88c08bcec08bd18855894cfe527a517aac69007900a069538a517993518a528a527993518a527a518a5279548a75518a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c05193ce01878a537953797ec05193d288558a537a75527a757452947600a063657692637c758c00675168666875517a6b6c0079c05293d288c0ce01207f7506c0ce01207f7c0120527a7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f7c750088c05293d30088c05293cc02b004a169007a75007a75c0c7c0cd88c0cec0d18801858a568a6576009f6375516776d153798763578a63765279945253a56968688c006866757501868a588a0486a6f222894c62527a517aac690079528aa169538a517994518a528a527a94518ac05193ce01878a517951797ec05193d288558a517a75007a75c0c7c0cd88c0cec0d18801858a568a6576009f6375516776d153798763578a63006968688c006866757501868a588a04b37fd68f894c5b8263517f7c760100876375007c6776014f8763754f7c677681760151a27c0160a19a63810150947c6776014c876375517f7c01007e817f7c817c6776014d876375527f7c01007e817f7c817c67817f7c817c686868686867007c6854892cc0ce01207f75517e598a6576009f6375516776d1537987637c8c7c688c006866009d75c0ce01207f75c0c48c56892476d3009c78d28277929a78cd015187919a78d204000000007e547f75045343494487919a578914c05193c6c05193cc88c05193d0c05193d3a1695158891b00c38c6576009f6375516776ce537987637c8b7c688c006866c48c5989748c7a82549d8a";
        readonly sourceMap: "1::21:1;;;;;;;;;;;;;;;;;;;;;7:2:13:3;;;15::20;;;1:0:21:1;;;;;;;;;;;;;;;;;;;;;";
        readonly logs: readonly [];
        readonly requires: readonly [];
        readonly functionDebug: {
            readonly '86a6f222': {
                readonly requires: readonly [{
                    readonly ip: 5;
                    readonly line: 8;
                }, {
                    readonly ip: 10;
                    readonly line: 9;
                    readonly message: "Amount must be positive";
                }];
                readonly logs: readonly [];
                readonly sourceMap: "8:21:8:22;;:24::29;;:12::30:1;:4::32;9:12:9:18:0;;:21::22;:12:::1;:4::51;10:23:10:39:0;;:42::48;;:23:::1;:4::49;;11:24:11:41:0;;:44::50;;:24:::1;:4::51;;12:14:12:20:0;;:4::40:1;;:22::38:0;;;;;:4::40:1;;;;7:2:13:3:0;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;";
            };
            readonly b37fd68f: {
                readonly requires: readonly [{
                    readonly ip: 5;
                    readonly line: 16;
                }, {
                    readonly ip: 11;
                    readonly line: 17;
                    readonly message: "Insufficient balance";
                }];
                readonly logs: readonly [];
                readonly sourceMap: "16:21:16:22;;:24::29;;:12::30:1;:4::32;17:12:17:18:0;;:22::39;;:12:::1;:4::65;18:23:18:39:0;;:42::48;;:23:::1;:4::49;;19:24:19:41:0;;:44::50;;:24:::1;:4::51;;15:2:20:3:0;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;";
            };
        };
        readonly invokeDebug: {
            readonly '1': {
                readonly bytecode: "76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68686868";
                readonly name: "compiler helper 1";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;";
            };
            readonly '2': {
                readonly bytecode: "c08bcf548a77548a75";
                readonly name: "compiler helper 2";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "1::21:1;;;;;;;;";
            };
            readonly '3': {
                readonly bytecode: "c08bcf548a75";
                readonly name: "compiler helper 3";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "1::21:1;;;;;";
            };
            readonly '4': {
                readonly bytecode: "8263517f7c760100876375007c6776014f8763754f7c677681760151a27c0160a19a63810150947c6776014c876375517f7c01007e817f7c817c6776014d876375527f7c01007e817f7c817c67817f7c817c686868686867007c68";
                readonly name: "outlined source span 4";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "1::21:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;";
            };
            readonly '5': {
                readonly bytecode: "c08bc7c08bcd88c08bcec08bd188";
                readonly name: "compiler helper 5";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "1::21:1;;;;;;;;;;;;;";
            };
            readonly '6': {
                readonly bytecode: "c0ce01207f75517e598a6576009f6375516776d1537987637c8c7c688c006866009d75c0ce01207f75c0c48c";
                readonly name: "outlined source span 6";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;";
            };
            readonly '7': {
                readonly bytecode: "76d3009c78d28277929a78cd015187919a78d204000000007e547f75045343494487919a";
                readonly name: "outlined source span 7";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;";
            };
            readonly '8': {
                readonly bytecode: "c05193c6c05193cc88c05193d0c05193d3a16951";
                readonly name: "outlined source span 8";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "7:2:13:3:1;;;;;;;;;;;;;;;;;;;";
            };
            readonly '9': {
                readonly bytecode: "00c38c6576009f6375516776ce537987637c8b7c688c006866c48c";
                readonly name: "outlined source span 9";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;";
            };
            readonly '-5': {
                readonly bytecode: "c0ce598a6576009f6375516776d18201219c6353798767750068637c8c7c688c00686600a26975";
                readonly name: "compiler helper -5";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "7:2:13:3:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;";
            };
            readonly '-6': {
                readonly bytecode: "c0c6c0cc88c0d0c0d3a169";
                readonly name: "compiler helper -6";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "1::21:1;;;;;;;;;;";
            };
            readonly '-7': {
                readonly bytecode: "01207f75c0ce01207f7588";
                readonly name: "compiler helper -7";
                readonly requires: readonly [];
                readonly logs: readonly [];
                readonly sourceMap: "1::21:1;;;;;;;;";
            };
        };
    };
    readonly functionBodies: {
        readonly '86a6f222': "527a517aac69007900a069538a517993518a528a527993518a527a518a5279548a75518a7e1f880088142d6fc68fce23556114a77b20278e9dca11bb521f75029000b27551c05193ce01878a537953797ec05193d288558a537a75527a757452947600a063657692637c758c00675168666875517a6b6c0079c05293d288c0ce01207f7506c0ce01207f7c0120527a7e7e52797eaa02aa207c7e01877ec05293cd88c05293d101878ac05293d101207f7c750088c05293d30088c05293cc02b004a169007a75007a75c0c7c0cd88c0cec0d18801858a568a6576009f6375516776d153798763578a63765279945253a56968688c006866757501868a588a";
        readonly b37fd68f: "527a517aac690079528aa169538a517994518a528a527a94518ac05193ce01878a517951797ec05193d288558a517a75007a75c0c7c0cd88c0cec0d18801858a568a6576009f6375516776d153798763578a63006968688c006866757501868a588a";
    };
    readonly fingerprint: "79ddce5d87f94fc6aa8b0ee3e65b508d57ff84b1c03011dd986e3786053ed0dd";
    readonly stateLayout: {
        readonly variables: readonly [{
            readonly name: "totalSupply";
            readonly type: "bigint";
            readonly nftIndex: 0;
            readonly fieldIndex: 0;
        }, {
            readonly name: "ownerBalance";
            readonly type: "bigint";
            readonly nftIndex: 0;
            readonly fieldIndex: 1;
        }];
        readonly dataNftCount: 1;
        readonly commitmentLimit: 128;
    };
    readonly events: readonly [{
        readonly name: "Mint";
        readonly signature: "Mint(bigint,bigint)";
        readonly parameters: readonly [{
            readonly name: "amount";
            readonly type: "bigint";
        }, {
            readonly name: "totalSupply";
            readonly type: "bigint";
        }];
    }];
    readonly compiler: {
        readonly name: "solidc";
        readonly version: "0.13.1";
        readonly options: {
            readonly enforceFunctionParameterTypes: true;
            readonly enforceLocktimeGuard: true;
            readonly enforceFinalRequire: true;
            readonly allowUnsafeOperations: false;
            readonly commitmentLimit: 128;
            readonly messageBus: false;
        };
    };
    readonly updatedAt: "2026-09-02T19:07:39.229Z";
    readonly invocationAnalysis: {
        readonly version: 1;
        readonly protocolVersions: readonly [1];
        readonly functions: readonly [{
            readonly id: 0;
            readonly name: "mint";
            readonly arity: 2;
            readonly entryPoint: true;
            readonly selector: "86a6f222";
            readonly calls: readonly [];
            readonly closure: readonly [0];
            readonly component: 0;
            readonly recursive: false;
            readonly reads: readonly ["state:ownerBalance", "state:totalSupply"];
            readonly writes: readonly ["state:ownerBalance", "state:totalSupply"];
            readonly effects: readonly ["events"];
            readonly unknown: false;
            readonly bounded: true;
            readonly maximumDirectInvocations: 0;
            readonly emits: readonly [{
                readonly eventName: "Mint";
                readonly eventSignature: "Mint(bigint,bigint)";
                readonly emitIndex: 0;
            }];
            readonly blockLayout: {
                readonly blockSize: 3;
                readonly slots: readonly [{
                    readonly kind: "master";
                    readonly offset: 0;
                }, {
                    readonly kind: "dataNft";
                    readonly offset: 1;
                    readonly nftIndex: 0;
                }, {
                    readonly kind: "event";
                    readonly offset: 2;
                    readonly slotIndex: 0;
                }];
            };
        }, {
            readonly id: 1;
            readonly name: "burn";
            readonly arity: 2;
            readonly entryPoint: true;
            readonly selector: "b37fd68f";
            readonly calls: readonly [];
            readonly closure: readonly [1];
            readonly component: 1;
            readonly recursive: false;
            readonly reads: readonly ["state:ownerBalance", "state:totalSupply"];
            readonly writes: readonly ["state:ownerBalance", "state:totalSupply"];
            readonly effects: readonly [];
            readonly unknown: false;
            readonly bounded: true;
            readonly maximumDirectInvocations: 0;
            readonly blockLayout: {
                readonly blockSize: 2;
                readonly slots: readonly [{
                    readonly kind: "master";
                    readonly offset: 0;
                }, {
                    readonly kind: "dataNft";
                    readonly offset: 1;
                    readonly nftIndex: 0;
                }];
            };
        }];
        readonly components: readonly [{
            readonly id: 0;
            readonly functions: readonly [0];
            readonly recursive: false;
        }, {
            readonly id: 1;
            readonly functions: readonly [1];
            readonly recursive: false;
        }];
    };
};
export default _default;
