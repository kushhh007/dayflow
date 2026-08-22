import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be yyyy-mm-dd');

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  personalEmail: z.string().email().optional(),
  dateOfBirth: dateString.optional(),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankName: z.string().optional(),
  ifscCode: z.string().optional(),
  pan: z.string().optional(),
  uan: z.string().optional(),
  departmentId: z.string().uuid(),
  jobPositionId: z.string().uuid(),
  managerId: z.string().uuid().nullish(),
  joinDate: dateString,
  wagePaise: z.number().int().positive().optional(),
  standardAllowancePaise: z.number().int().nonnegative().default(0)
});
