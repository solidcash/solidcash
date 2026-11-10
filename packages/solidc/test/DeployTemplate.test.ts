import { createHash } from 'crypto';
import { describe, it, expect } from 'vitest';
import { compileStringMulti } from './direct-compile.js';

// `new C{code: c}(...)` deploys a child whose code is the bytes `c` instead of C's compiled body embedded in the
// deploying contract. The deploying contract checks `sha256(c)` against the template the child runs: C's own
// compiled code when no template is named, or `t` in `new C{code: c, template: t}(...)`. Everything else about the
// child (its constructor arguments, state layout and genesis) is C's.

const CHILD = `
contract Child(int limit) {
    int counter;

    function bump(int n) public {
        require(n < limit, "limit");
        this.counter = this.counter + n;
    }
}`;

const compile = (factory: string, options = {}): Record<string, any> => compileStringMulti(
  `pragma solidcash ^0.14.0;\n${CHILD}\n${factory}`, options,
) as Record<string, any>;

const sha256 = (hex: string): string => createHash('sha256').update(Buffer.from(hex, 'hex')).digest('hex');

const occurrences = (haystack: string, needle: string): number => {
  let count = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    if (at % 2 === 0) count += 1;
  }
  return count;
};

const deployTarget = (artifact: any, name: string): any => artifact.abi
  .find((entry: any) => entry.name === name).deployTargets[0];

describe('new C{code: c}: the child\'s code checked against C\'s compiled code', () => {
  const artifacts = compile(`
contract Factory() {
    int created;

    function create(int limit, bytes code) public {
        new Child{code: code}(limit);
        this.created += 1;
    }
}`);
  const body: string = artifacts.Child.debug.bytecode;

  it('does not embed the child\'s code', () => {
    expect(occurrences(artifacts.Factory.debug.bytecode, body)).toBe(0);
  });

  it('holds the hash of the child\'s compiled code instead', () => {
    expect(occurrences(artifacts.Factory.debug.bytecode, sha256(body))).toBe(1);
  });

  it('publishes the template and where the code comes from', () => {
    const target = deployTarget(artifacts.Factory, 'create');
    expect(target.creationBytecode).toBe(body);
    expect(target.template).toEqual({ kind: 'compiled', hash: sha256(body) });
    expect(target.code).toEqual({ kind: 'parameter', name: 'code', index: 1 });
  });

  it('is smaller than a factory that embeds the child', () => {
    const embedded = compile(`
contract Factory() {
    int created;

    function create(int limit) public {
        new Child(limit);
        this.created += 1;
    }
}`);
    // It saves the child's body, less the check: a 32-byte hash push, OP_DUP OP_SHA256 OP_EQUALVERIFY, OP_SWAP.
    const saved = (embedded.Factory.debug.bytecode.length - artifacts.Factory.debug.bytecode.length) / 2;
    expect(saved).toBeGreaterThan(body.length / 2 - 40);
  });
});

describe('new C{code: c, template: t}: a template chosen at run time', () => {
  it('compiles when the template is published in an event', () => {
    const artifacts = compile(`
contract Registry() {
    int created;
    event Created(bytes32 template, int limit);

    function create(bytes32 template, int limit, bytes code) public {
        new Child{code: code, template: template}(limit);
        emit Created(template, limit);
        this.created += 1;
    }
}`);
    const target = deployTarget(artifacts.Registry, 'create');
    expect(target.template).toEqual({ kind: 'parameter', name: 'template', index: 0 });
    expect(target.code).toEqual({ kind: 'parameter', name: 'code', index: 2 });
    expect(occurrences(artifacts.Registry.debug.bytecode, artifacts.Child.debug.bytecode)).toBe(0);
  });

  it('compiles when the template is a constructor argument', () => {
    expect(() => compile(`
contract Factory(bytes32 template) {
    int created;

    function create(int limit, bytes code) public {
        new Child{code: code, template: template}(limit);
        this.created += 1;
    }
}`)).not.toThrow();
  });

  it('refuses a caller-chosen template that nothing publishes', () => {
    expect(() => compile(`
contract Factory() {
    int created;

    function create(bytes32 template, int limit, bytes code) public {
        new Child{code: code, template: template}(limit);
        this.created += 1;
    }
}`)).toThrow(/a template must be a constant, a constructor argument, a state variable, or a parameter/);
  });

  it('refuses a caller-chosen template published only on one branch', () => {
    expect(() => compile(`
contract Factory() {
    int created;
    event Created(bytes32 template);

    function create(bytes32 template, int limit, bytes code) public {
        new Child{code: code, template: template}(limit);
        if (limit > 5) {
            emit Created(template);
        }
        this.created += 1;
    }
}`)).toThrow(/a template must be a constant, a constructor argument, a state variable, or a parameter/);
  });

  it('refuses a caller-chosen template that is reassigned', () => {
    expect(() => compile(`
contract Factory() {
    int created;
    event Created(bytes32 template);

    function create(bytes32 template, int limit, bytes code, bytes32 other) public {
        emit Created(template);
        template = other;
        new Child{code: code, template: template}(limit);
        this.created += 1;
    }
}`)).toThrow(/a template must be a constant, a constructor argument, a state variable, or a parameter/);
  });
});

describe('a template the function could change after publishing it', () => {
  it('refuses a template the function deletes', () => {
    expect(() => compile(`
contract Factory() {
    int created;
    event Created(bytes32 template);

    function create(bytes32 template, int limit, bytes code) public {
        emit Created(template);
        delete template;
        new Child{code: code, template: template}(limit);
        this.created += 1;
    }
}`)).toThrow(/a template must be a constant, a constructor argument, a state variable, or a parameter/);
  });

  it('refuses a template the function computes into a local, even one it publishes', () => {
    expect(() => compile(`
contract Factory() {
    int created;
    event Created(bytes32 template);

    function create(bytes32 chosen, int limit, bytes code) public {
        bytes32 local = chosen;
        emit Created(local);
        new Child{code: code, template: local}(limit);
        this.created += 1;
    }
}`)).toThrow(/a template must be a constant, a constructor argument, a state variable, or a parameter/);
  });

  it('compiles a literal template, which no caller chooses', () => {
    expect(() => compile(`
contract Factory() {
    int created;

    function create(int limit, bytes code) public {
        new Child{code: code, template: 0x${'ab'.repeat(32)}}(limit);
        this.created += 1;
    }
}`)).not.toThrow();
  });
});

describe('code and template are refused where they cannot be checked', () => {
  it('refuses a template without code', () => {
    expect(() => compile(`
contract Factory(bytes32 template) {
    int created;

    function create(int limit) public {
        new Child{template: template}(limit);
        this.created += 1;
    }
}`)).toThrow(/no 'code' is given/);
  });

  it('refuses code that is not bytes', () => {
    expect(() => compile(`
contract Factory() {
    int created;

    function create(int limit, int code) public {
        new Child{code: code}(limit);
        this.created += 1;
    }
}`)).toThrow();
  });

  it('refuses a template that is not bytes32', () => {
    expect(() => compile(`
contract Factory() {
    int created;
    event Created(bytes template);

    function create(bytes template, int limit, bytes code) public {
        new Child{code: code, template: template}(limit);
        emit Created(template);
        this.created += 1;
    }
}`)).toThrow();
  });

  it('keeps a deploy with code off the message-bus route', () => {
    const artifacts = compile(`
contract Factory() {
    int created;

    function create(int limit, bytes code) public {
        new Child{code: code}(limit);
        this.created += 1;
    }
}`, { messageBus: true, messageBusKernel: true, suppressWarnings: true });
    const handler = artifacts.Factory.messageBus?.handlers?.find((entry: any) => entry.name === 'create');
    expect(handler?.eligible === true).toBe(false);
  });
});
