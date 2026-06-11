interface Fixture {
  fn: string,
  fnWithLogs: string,
}

export const fixtures: Fixture[] = [
  {
    fn: 'p2pkh.scash',
    fnWithLogs: 'p2pkh-logs.scash',
  },
  {
    fn: 'if_statement_number_units.scash',
    fnWithLogs: 'if_statement_number_units-logs.scash',
  },
  {
    fn: 'deeply_nested.scash',
    fnWithLogs: 'deeply_nested-logs.scash',
  },
];
