import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be yyyy-mm-dd');
const isoTimestamp = z.string().datetime({ offset: true });

export const listAttendanceSchema = z.object({
  employeeId: z.string().uuid().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(31),
  offset: z.coerce.number().int().min(0).default(0)
});

export const submitCorrectionSchema = z.object({
  workDate: dateString,
  correctedStatus: z.enum(['PRESENT', 'HALF_DAY']),
  requestedCheckIn: isoTimestamp,
  requestedCheckOut: isoTimestamp,
  reason: z.string().min(1)
});

export const correctionDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']).default('APPROVED')
});
