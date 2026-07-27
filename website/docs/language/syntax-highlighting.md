---
title: Syntax Highlighting
---

When developing smart contracts for SolidCash it is useful to have the proper syntax highlighting in your code editor / IDE. If you use Visual Studio Code, there is a dedicated SolidCash extension. For other editors it is recommended to install a Solidity highlighting plugin and associate it with `.scash` files in your editor, since the syntaxes of the two languages are very similar.

## Visual Studio Code (Recommended)
For Visual Studio Code (and derived editors like Cursor) we have an official [SolidCash extension](https://marketplace.visualstudio.com/items?itemName=SolidCash.solidcash-vscode). This extension works with `.scash` files and supports syntax highlighting, autocompletion, snippets and linting. Because of the first-class SolidCash support, Visual Studio Code with this SolidCash extension is the recommended way to develop SolidCash contracts.

It also provides editor intelligence for the language itself:

- **Hover documentation** on keywords, modifiers, types, global functions, introspection variables (`tx.outputs[0].value`, `msg.sender`, `this.age`), member operations, units, Bitcoin Script opcodes and the Yul builtins, each linking to the matching page in these docs. Hovering your own declarations shows their signature and doc comment.
- **Go to definition** (Cmd+click, F12) on functions, modifiers, events, errors, structs, enums, contracts, interfaces, libraries, state variables, parameters and locals, following inheritance and imports. Import paths are clickable links and resolve the same way the compiler resolves them, including npm-style paths.
- **Outline, breadcrumbs and workspace symbol search** for contracts and their members.

Inside `assembly { ... }` blocks the supported Yul builtins are highlighted as functions, and the ones the compiler rejects (`create`, `create2`, `verbatim_*`, `pc`, `leave`, ...) are scoped as invalid, so they read as errors before you compile.

To have the extension automatically suggested for any developer looking at your SolidCash contract in VScode, add the following configuration in a `.vscode/extensions.json` file:

```json title="&#126;/.vscode/extensions.json"
{
  "recommendations": [
    "solidcash.solidcash-vscode",
  ]
}
```

## Cursor

Cursor and other VS Code forks can use the VS Code extension mentioned above. This extension should be findable in the extensions menu within the editor. If it is not, you can manually install it from the [Open VSX Registry](https://open-vsx.org/extension/SolidCash/solidcash-vscode).

## Sublime Text
The most popular Solidity plugin for Sublime Text is [Ethereum](https://packagecontrol.io/packages/Ethereum). Install this plugin with [Package Control](https://packagecontrol.io/), open a `.scash` file and set Solidity as the syntax language in the Sublime menu bar:

> View -> Syntax -> Open all with current extension as ... -> Solidity

This associates `.scash` files with Solidity, and enables syntax highlighting for your SolidCash files.

## Vim
The most popular Solidity plugin for Vim is [vim-solidity](https://github.com/TovarishFin/vim-solidity). Install this plugin and add the following snippet to your `.vimrc`:

```bash title=".vimrc"
au BufRead,BufNewFile *.scash setfiletype solidity
```

This associates `.scash` files with Solidity, and enables syntax highlighting for your SolidCash files.

## GitHub
GitHub has highlighting for Solidity built in. To associate `.scash` files with Solidity highlighting, add a `.gitattributes` file to your repository with the following contents:

```python title=".gitattributes"
*.scash linguist-language=Solidity # GitHub
```

Unfortunately Gitlab does not have properly working Solidity highlighting through the `gitattributes` for now...

## Others
If your editor is not mentioned above, the steps are likely very similar. Try to find a Solidity syntax highlighting plugin for your editor of choice and find a method to associate `.scash` files with this Solidity highlighting.
