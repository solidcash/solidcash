declare const _default: {
    readonly contractName: "TransferWithTimeout";
    readonly constructorInputs: readonly [{
        readonly name: "sender";
        readonly type: "pubkey";
    }, {
        readonly name: "recipient";
        readonly type: "pubkey";
    }, {
        readonly name: "timeout";
        readonly type: "int256";
    }];
    readonly abi: readonly [{
        readonly name: "transfer";
        readonly selector: "3486e360";
        readonly inputs: readonly [{
            readonly name: "recipientSig";
            readonly type: "sig";
        }];
        readonly signatureGuard: {
            readonly key: {
                readonly kind: "constructorArg";
                readonly name: "recipient";
            };
        };
    }, {
        readonly name: "timeout";
        readonly selector: "2203057b";
        readonly inputs: readonly [{
            readonly name: "senderSig";
            readonly type: "sig";
        }];
        readonly signatureGuard: {
            readonly key: {
                readonly kind: "constructorArg";
                readonly name: "sender";
            };
        };
    }];
    readonly bytecode: "537a527aac7777 3486e360 OP_DEFINE 537a517aac69517ab1755177 2203057b OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE";
    readonly source: "pragma solidcash ^0.13.0;\n\ncontract TransferWithTimeout(\n    pubkey sender,\n    pubkey recipient,\n    int timeout\n) {\n    // Require recipient's signature to match\n    function transfer(sig recipientSig) {\n        require(checkSig(recipientSig, recipient));\n    }\n\n    // Require timeout time to be reached and sender's signature to match\n    function timeout(sig senderSig) {\n        require(checkSig(senderSig, sender));\n        require(tx.time >= timeout);\n    }\n}\n";
    readonly debug: {
        readonly bytecode: "07537a527aac7777043486e360890c537a517aac69517ab1755177042203057b89748c7a82549d8a";
        readonly sourceMap: "9:4:11:5;;;14::17;;;3:0:18:1;;;;;;";
        readonly logs: readonly [];
        readonly requires: readonly [];
        readonly functionDebug: {
            readonly '3486e360': {
                readonly requires: readonly [{
                    readonly ip: 5;
                    readonly line: 10;
                }];
                readonly sourceMap: "10:25:10:37;;:39::48;;:8::51:1;9:4:11:5;";
                readonly logs: readonly [];
            };
            readonly '2203057b': {
                readonly requires: readonly [{
                    readonly ip: 5;
                    readonly line: 15;
                }, {
                    readonly ip: 8;
                    readonly line: 16;
                }];
                readonly sourceMap: "15:25:15:34;;:36::42;;:16::43:1;:8::45;16:27:16:34:0;;:8::36:1;;14:4:17:5;";
                readonly logs: readonly [];
            };
        };
    };
    readonly functionBodies: {
        readonly '3486e360': "537a527aac7777";
        readonly '2203057b': "537a517aac69517ab1755177";
    };
    readonly fingerprint: "938bd4e34785c264a20e3b08fca31283fd92dd76acad7c91e6e11fc15161189d";
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
    readonly updatedAt: "2026-08-18T13:08:04.833Z";
    readonly invocationAnalysis: {
        readonly version: 1;
        readonly protocolVersions: readonly [1];
        readonly functions: readonly [{
            readonly id: 0;
            readonly name: "transfer";
            readonly arity: 1;
            readonly entryPoint: true;
            readonly selector: "3486e360";
            readonly calls: readonly [];
            readonly closure: readonly [0];
            readonly component: 0;
            readonly recursive: false;
            readonly reads: readonly [];
            readonly writes: readonly [];
            readonly effects: readonly [];
            readonly unknown: false;
            readonly bounded: true;
            readonly maximumDirectInvocations: 0;
        }, {
            readonly id: 1;
            readonly name: "timeout";
            readonly arity: 1;
            readonly entryPoint: true;
            readonly selector: "2203057b";
            readonly calls: readonly [];
            readonly closure: readonly [1];
            readonly component: 1;
            readonly recursive: false;
            readonly reads: readonly [];
            readonly writes: readonly [];
            readonly effects: readonly [];
            readonly unknown: false;
            readonly bounded: true;
            readonly maximumDirectInvocations: 0;
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
