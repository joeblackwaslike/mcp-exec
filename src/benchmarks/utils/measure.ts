export const EXEC_THRESHOLD = 0.05;
export const FULL_STACK_THRESHOLD = 0.1;

export function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

export function reportSavings(scenario: string, baselineBytes: number, resultBytes: number): void {
  const ratio = resultBytes / baselineBytes;
  process.stdout.write(
    `  [bench] ${scenario}: ${resultBytes.toLocaleString()}B / ${baselineBytes.toLocaleString()}B = ${(ratio * 100).toFixed(2)}%\n`,
  );
}
