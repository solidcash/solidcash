#!/usr/bin/env python3
"""Move every live 0.50.x reference in the release worktree to 0.51.0.

Mirrors e3a0499ea (the 0.50.0 bump): all six packages, their internal dependencies, the compiler's version,
every live pragma and the docs that describe the current release move; what describes the past keeps its number
(docs/release, docs/wip, docs/security, research, the changelog's and release notes' earlier entries).

usage: python3 -I bump.py <worktree> [--dry]   (edit the version pair in RULES for the next release)
"""
import re
import subprocess
import sys

root = sys.argv[1]
dry = '--dry' in sys.argv

KEEP_PREFIXES = ('docs/', 'research/', 'website/docs/releases/', 'CHANGELOG.md')

files = subprocess.run(
    ['git', '-C', root, 'grep', '-l', '-I', '-E', r'0\.50\.[01]'],
    capture_output=True, text=True, check=True,
).stdout.split()
files = [f for f in files if not f.startswith(KEEP_PREFIXES) and not f.endswith('.lock')]

RULES = [
    # pragmas
    (re.compile(r'pragma solidcash \^0\.50\.0'), 'pragma solidcash ^0.51.0'),
    (re.compile(r'pragma solidcash >=0\.50\.0 <0\.15\.0'), 'pragma solidcash >=0.51.0 <0.52.0'),
    # internal dependency ranges
    (re.compile(r'("@solidcash/[a-z-]+":\s*)"\^0\.50\.[01]"'), r'\1"^0.51.0"'),
    # package versions and artifact compiler versions, in every quoting the tree uses
    (re.compile(r'("version":\s*)"0\.50\.[01]"'), r'\1"0.51.0"'),
    (re.compile(r"('version':\s*)'0\.50\.0'"), r"\g<1>'0.51.0'"),
    (re.compile(r"(\bversion:\s*)'0\.50\.0'"), r"\g<1>'0.51.0'"),
    (re.compile(r"(export const version = )'0\.50\.0'"), r"\g<1>'0.51.0'"),
    (re.compile(r"solidhat-mock/0\.50\.0"), 'solidhat-mock/0.51.0'),
    (re.compile(r"(compilerVersion !== )'0\.50\.0'"), r"\g<1>'0.51.0'"),
]
# Prose that names the current release (website pages, the served AGENTS.md, the reference generator).
PROSE_FILES = re.compile(r'^(website/(docs|static|scripts)/|vscode-solidcash/src/)')
PROSE = re.compile(r'(?<![\d.^>=~])0\.50\.0(?![\d])')

changed = 0
residual = []
for f in files:
    path = f'{root}/{f}'
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    new = text
    for pattern, repl in RULES:
        new = pattern.sub(repl, new)
    if PROSE_FILES.match(f):
        new = PROSE.sub('0.51.0', new)
    for m in re.finditer(r'.{0,40}0\.50\.[01].{0,20}', new):
        residual.append(f'{f}: {m.group(0)}')
    if new != text:
        changed += 1
        if not dry:
            with open(path, 'w', encoding='utf-8') as fh:
                fh.write(new)

print(f'files considered {len(files)}, changed {changed}{" (dry run)" if dry else ""}')
print(f'residual 0.50.x references: {len(residual)}')
for line in residual[:60]:
    print('  ', line)
