import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be yyyy-mm-dd');

export const createLeaveRequestSchema = z.object({
  typeCode: z.enum(['PAID', 'SICK', 'UNPAID']),
  startDate: dateString,
  endDate: dateString,
  reason: z.string().min(1),
  attachmentUrl: z.string().url().optional()
});

export const listLeaveRequestsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  employeeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
