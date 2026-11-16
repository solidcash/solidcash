#!/usr/bin/env python3
"""Summarize vitest JSON reports: totals, then each failing file with its first failures.

usage: python3 -I summarize.py <report.json>...
"""
import json
import sys

for path in sys.argv[1:]:
    try:
        d = json.load(open(path))
    except Exception as e:  # a run that died leaves no report
        print(path, 'no report:', e)
        continue
    print(path.rsplit('/', 1)[-1], 'files', len(d['testResults']), 'tests', d['numTotalTests'],
          'passed', d['numPassedTests'], 'failed', d['numFailedTests'], 'pending', d['numPendingTests'],
          'todo', d.get('numTodoTests'))
    for tr in d['testResults']:
        fails = [a for a in tr.get('assertionResults', []) if a.get('status') == 'failed']
        if tr.get('status') == 'failed' or fails:
            print('  FAIL', tr['name'].split('/packages/')[-1], len(fails),
                  (tr.get('message') or '')[:120].replace('\n', ' '))
            for a in fails[:3]:
                print('     -', a['fullName'][:120], '::',
                      ' '.join((a.get('failureMessages') or [''])[0].split())[:180])
