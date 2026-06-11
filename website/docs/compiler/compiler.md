---
title: Compiler
---

The SolidCash compiler is called `solidc` and is used to compile SolidCash `.scash` contract files into `.json` (or `.ts`) artifact files.
These artifact files can be used to instantiate a SolidCash contract with the help of the SolidCash SDK. For more information on this artifact format refer to [Artifacts](/docs/compiler/artifacts).

:::info
Because of the separation of the compiler and the SDK, SolidCash contracts can be integrated into other programming languages in the future.
:::

## Command Line Interface

The `solidc` command line interface is used to compile SolidCash `.scash` files into `.json` (or `.ts`) artifact files.

### Installation
You can use `npm` to install the `solidc` command line tool globally.

```bash
npm install -g solidc
```

### CLI Usage
The `solidc` CLI tool can be used to compile `.scash` files to JSON (or `.ts`) artifact files.

```bash
Usage: solidc [options] [source_file]

Options:
  -V, --version          Output the version number.
  -o, --output <path>    Specify a file to output the generated artifact.
  -h, --hex              Compile the contract to hex format rather than a full artifact.
  -A, --asm              Compile the contract to ASM format rather than a full artifact.
  -c, --opcount          Display the number of opcodes in the compiled bytecode.
  -s, --size             Display the size in bytes of the compiled bytecode.
  -f, --format <format>  Specify the format of the output. (choices: "json", "ts", default: "json")
  -?, --help             Display help
```

:::tip
To have the best TypeScript integration, we recommend generating the artifact in the `.ts` format and importing it into your TypeScript project from that `.ts` file.
:::

#### Example
```bash
solidc ./Contract.scash --output ./artifact.ts --format ts
```

```bash
solidc ./Contract.scash --size --opcount
```

:::info
The size outputs of the `solidc` compiler are based on the bytecode without constructor arguments. This means they are always an underestimate, as the contract hasn't been initialized with contract arguments.
:::

## JavaScript Compilation
Generally SolidCash contracts are compiled to an Artifact JSON file using the CLI compiler. As an alternative to this, SolidCash contracts can be compiled from within JavaScript apps using the `solidc` package. This package exports two compilation functions.

```bash
npm install solidc
```

### compileFile()
```ts
compileFile(sourceFile: PathLike): Artifact
```

Compiles a SolidCash contract from a source file. This compile method is handy when using Node.js with the contract source file available but you are doing quick compilations (for example for contract size comparisons) and you don't need the contract artifact file to be generated.

:::note
`compileFile()` only works from a Node.js context because it uses the file-system so it's not available in browser setting.
:::

#### Example
```ts
const P2PKH = compileFile(new URL('p2pkh.scash', import.meta.url));
```

### compileString()
```ts
compileString(sourceCode: string): Artifact
```

Compiles a SolidCash contract from a source code string. This compile method is handy in a browser compilation setting like the [SolidCash Playground](https://playground.solidcash.org/) where testing contracts can be quickly compiled and discarded. The method is also useful if no source file is locally available (e.g. the source code is retrieved with a REST API).

```ts
const baseUrl = 'https://raw.githubusercontent.com/CashScript/cashscript'
const result = await fetch(`${baseUrl}/master/examples/p2pkh.scash`);
const source = await result.text();

const P2PKH = compileString(source);
```
