import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be yyyy-mm-dd');

export const createPayrollRunSchema = z.object({
  periodStart: dateString,
  periodEnd: dateString
});

export const listRunsSchema = z.object({
  status: z.enum(['DRAFT', 'CALCULATED', 'FINALIZED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const listPayslipsSchema = z.object({
  runId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
