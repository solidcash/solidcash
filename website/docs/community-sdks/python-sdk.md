---
title: Python SDK
---

SolidCash has no Python SDK. To deploy, call and test SolidCash contracts, use the [TypeScript SDK][typescript-sdk]
(`solidcash`), for example from a small Node.js service next to your Python code.

:::info
[`cashscript-py`][pypi] is a community-maintained Python port of the CashScript TypeScript SDK. SolidCash started as
a fork of CashScript but is not backwards compatible with it: a SolidCash contract with several functions dispatches
on 4-byte function selectors, and stateful contracts need the SolidCash SDK's covenant transaction builders.
`cashscript-py` is built for CashScript artifacts, and the SolidCash project does not test or support it with
SolidCash artifacts.
:::

## When to use cashscript-py

Use `cashscript-py` for contracts written in CashScript and compiled with its `cashc` compiler, when you want to
build and send their transactions from a Python codebase. See its own documentation for installation and usage.

## Documentation

- **Documentation:** [cashscript-py.readthedocs.io][readthedocs]
- **PyPI package:** [cashscript-py][pypi]
- **Source code:** [gitlab.com/cashscript-py/cashscript-py][source]

[pypi]: https://pypi.org/project/cashscript-py/
[typescript-sdk]: /docs/sdk/typescript-sdk
[readthedocs]: https://cashscript-py.readthedocs.io/
[source]: https://gitlab.com/cashscript-py/cashscript-py
