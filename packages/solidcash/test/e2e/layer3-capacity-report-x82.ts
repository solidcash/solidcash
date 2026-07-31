import { writeFileSync } from 'fs';

export interface X82CostRow {
  input: number;
  bytes: number;
  cost: number;
  instructions: number;
  ratio: number;
}

export interface X82CapacityReport {
  transactionBytes: number;
  transcriptBytes: number;
  slots: number;
  rows: X82CostRow[];
  overBudget: number[];
}

export function createX82CapacityReport(
  costs: X82CostRow[], interestingInputs: number[], transactionBytes: number,
  transcriptBytes: number, slots: number,
): X82CapacityReport {
  const byInput = new Map(costs.map((row) => [row.input, row]));
  const rows = interestingInputs.map((input) => {
    const row = byInput.get(input);
    if (!row) throw new Error(`X82 measurement refusal: input ${input} has no run-to-completion row`);
    return row;
  });
  if (new Set(rows.map((row) => row.input)).size !== interestingInputs.length) {
    throw new Error('X82 measurement refusal: interesting-input manifest contains duplicates');
  }
  return { transactionBytes, transcriptBytes, slots, rows, overBudget: costs
    .filter((row) => row.ratio > 1).map((row) => row.input) };
}

export function writeX82CapacityReport(path: string, report: X82CapacityReport): void {
  if (!path.startsWith('/tmp/')) {
    throw new Error('X82 measurement refusal: L3_X82_OUT must be an absolute /tmp path; numeric pins are not '
      + 'updated by the measurement command');
  }
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}
