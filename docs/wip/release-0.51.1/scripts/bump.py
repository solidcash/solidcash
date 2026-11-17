#!/usr/bin/env python3
"""Move every live 0.51.0 version in the release worktree to 0.51.1, a patch release of all six packages.

Adapted from ../../release-0.51.0/scripts/bump.py. A patch release keeps every pragma (`^0.51.0` admits 0.51.1) and
every page that describes 0.51.0 itself; it moves the six package versions, their internal dependency ranges (so a
package of 0.51.1 pulls the fixed SDK), the compiler's version and the copies of it that tests pin. Prose that names
0.51.0 is listed for review, not changed.

usage: python3 -I bump.py <worktree> [--dry]
"""
import re
import subprocess
import sys

root = sys.argv[1]
dry = '--dry' in sys.argv

KEEP_PREFIXES = ('docs/', 'research/', 'website/', 'CHANGELOG.md', 'vscode-solidcash/')

files = subprocess.run(
    ['git', '-C', root, 'grep', '-l', '-I', '-F', '0.51.0'],
    capture_output=True, text=True, check=True,
).stdout.split()
files = [f for f in files if not f.startswith(KEEP_PREFIXES) and not f.endswith('.lock')]

RULES = [
    # internal dependency ranges
    (re.compile(r'("@solidcash/[a-z-]+":\s*)"\^0\.51\.0"'), r'\1"^0.51.1"'),
    # package versions and artifact compiler versions, in every quoting the tree uses
    (re.compile(r'("version":\s*)"0\.51\.0"'), r'\1"0.51.1"'),
    (re.compile(r"('version':\s*)'0\.51\.0'"), r"\g<1>'0.51.1'"),
    (re.compile(r"(\bversion:\s*)'0\.51\.0'"), r"\g<1>'0.51.1'"),
    (re.compile(r"(export const version = )'0\.51\.0'"), r"\g<1>'0.51.1'"),
    (re.compile(r"solidhat-mock/0\.51\.0"), 'solidhat-mock/0.51.1'),
    (re.compile(r"(compilerVersion !== )'0\.51\.0'"), r"\g<1>'0.51.1'"),
]

changed = []
residual = []
for f in files:
    path = f'{root}/{f}'
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    new = text
    for pattern, repl in RULES:
        new = pattern.sub(repl, new)
    for m in re.finditer(r'.{0,50}(?<![\^>=~\d.])0\.51\.0(?![\d]).{0,20}', new):
        residual.append(f'{f}: {m.group(0).strip()}')
    if new != text:
        changed.append(f)
        if not dry:
            with open(path, 'w', encoding='utf-8') as fh:
                fh.write(new)

print(f'files considered {len(files)}, changed {len(changed)}{" (dry run)" if dry else ""}')
for f in changed:
    print('  changed', f)
print(f'residual 0.51.0 references outside pragmas and ranges: {len(residual)}')
for line in residual[:80]:
    print('  ', line)
