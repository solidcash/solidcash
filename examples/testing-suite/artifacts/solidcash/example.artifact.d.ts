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
    readonly bytecode: "OP_DUP OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_DROP OP_1 OP_NUMEQUAL";
    readonly source: "contract Example() {\n  function test(int value) {\n    console.log(value, \"test\");\n    require(value == 1, \"Wrong value passed\");\n  }\n}\n";
    readonly debug: {
        readonly bytecode: "767621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa16975519c";
        readonly sourceMap: "2:16:2:25;;;;;;;;;;4:21:4:22;:4::46:1";
        readonly logs: readonly [{
            readonly ip: 10;
            readonly line: 3;
            readonly data: readonly [{
                readonly stackIndex: 0;
                readonly type: "int256";
                readonly ip: 10;
            }, "test"];
        }];
        readonly requires: readonly [{
            readonly ip: 12;
            readonly line: 4;
            readonly message: "Wrong value passed";
        }];
    };
    readonly fingerprint: "cc889908d163cb6aefaf4a3e5a19c86dc78f8a18333aca7638817541fe692b5d";
    readonly compiler: {
        readonly name: "solidc";
        readonly version: "0.13.1";
        readonly options: {
            readonly enforceFunctionParameterTypes: true;
            readonly enforceLocktimeGuard: true;
            readonly commitmentLimit: 1000000;
            readonly messageBus: true;
        };
    };
    readonly updatedAt: "2026-08-05T14:46:56.569Z";
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
    readonly diagnostics: readonly [{
        readonly severity: "error";
        readonly code: "message-bus-route-not-synthesized";
        readonly message: "No message-bus route was synthesized for 'Example': it has no message-bus batch entry point and cannot participate in a message bus. Only the direct per-function route exists. Rejected entry points - 'test': not-examined-by-route-synthesis.";
    }];
};
export default _default;
