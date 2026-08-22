/**
 * Utility functions for exact integer paise monetary calculations.
 * 1 Rupee = 100 Paise.
 * Prevents floating-point precision issues in payroll calculations.
 */

export function rupeesToPaise(rupees: number): bigint {
  return BigInt(Math.round(rupees * 100));
}

export function paiseToRupees(paise: bigint | number | string): number {
  return Number(paise) / 100;
}

/**
 * Calculates a percentage of an amount in integer paise using exact integer rounding.
 */
export function calculatePercentagePaise(basePaise: bigint | number, percentage: number): bigint {
  const base = BigInt(basePaise);
  const pct = BigInt(percentage);
  // (base * pct + 50) / 100 for half-up rounding
  return (base * pct + 50n) / 100n;
}

/**
 * Pro-rates an amount in integer paise according to payableDays / workingDays.
 * payableDays can have .5 half-day increments, so we scale by 2 to keep integer operations.
 */
export function proratePaise(
  fullAmountPaise: bigint | number,
  payableDays: number,
  workingDays: number
): bigint {
  if (workingDays <= 0) return 0n;
  if (payableDays <= 0) return 0n;

  const amount = BigInt(fullAmountPaise);
  // Scale by 10 to handle 0.5 without float precision loss: payableUnits = round(payableDays * 10)
  const payableUnits = BigInt(Math.round(payableDays * 10));
  const workingUnits = BigInt(Math.round(workingDays * 10));

  // Half-up integer rounding: (amount * payableUnits + workingUnits / 2) / workingUnits
  return (amount * payableUnits + workingUnits / 2n) / workingUnits;
}
