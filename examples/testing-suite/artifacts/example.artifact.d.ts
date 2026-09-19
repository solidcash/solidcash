declare const _default: {
    readonly contractName: "Example";
    readonly constructorInputs: readonly [];
    readonly abi: readonly [{
        readonly name: "test";
        readonly selector: "78cae886";
        readonly inputs: readonly [{
            readonly name: "value";
            readonly type: "int256";
        }];
    }];
    readonly bytecode: "OP_DUP OP_DUP OP_1 ff00 OP_LSHIFTNUM OP_ADD 21 OP_NUM2BIN 20 OP_SPLIT OP_NIP 00 OP_EQUALVERIFY OP_DROP OP_1 OP_NUMEQUAL";
    readonly source: "contract Example() {\n  function test(int value) {\n    console.log(value, \"test\");\n    require(value == 1, \"Wrong value passed\");\n  }\n}\n";
    readonly debug: {
        readonly bytecode: "76765102ff008d9301218001207f7701008875519c";
        readonly sourceMap: "2:16:2:25;;;;;;;;;;;;;;4:21:4:22;:4::46:1";
        readonly logs: readonly [{
            readonly ip: 14;
            readonly line: 3;
            readonly data: readonly [{
                readonly stackIndex: 0;
                readonly type: "int256";
                readonly ip: 14;
            }, "test"];
        }];
        readonly requires: readonly [{
            readonly ip: 16;
            readonly line: 4;
            readonly message: "Wrong value passed";
        }];
    };
    readonly fingerprint: "94e416504230dbd4ab77bfbe23a6518120a6575169e598e6ed4e864fa417f8e4";
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
    readonly updatedAt: "2026-09-02T19:07:39.104Z";
    readonly invocationAnalysis: {
        readonly version: 1;
        readonly protocolVersions: readonly [1];
        readonly functions: readonly [{
            readonly id: 0;
            readonly name: "test";
            readonly arity: 1;
            readonly entryPoint: true;
            readonly selector: "78cae886";
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
        }];
        readonly components: readonly [{
            readonly id: 0;
            readonly functions: readonly [0];
            readonly recursive: false;
        }];
    };
};
export default _default;
