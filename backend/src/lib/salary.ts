import { HttpError } from './http.js';

export interface DerivedSalary {
  basic: number;
  hra: number;
  performanceBonus: number;
  lta: number;
  fixedAllowance: number;
}

export function deriveSalaryComponents(
  wagePaise: number,
  standardAllowancePaise: number
): DerivedSalary {
  const basic = Math.round(wagePaise * 0.5);
  const hra = Math.round(basic * 0.5);
  const performanceBonus = Math.round(basic * 0.0833);
  const lta = Math.round(basic * 0.0833);
  const fixedAllowance =
    wagePaise - (basic + hra + standardAllowancePaise + performanceBonus + lta);

  if (fixedAllowance < 0) {
    throw new HttpError(422, 'Fixed Allowance would be negative for this configuration');
  }

  return { basic, hra, performanceBonus, lta, fixedAllowance };
}
