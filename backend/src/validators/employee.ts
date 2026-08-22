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

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  personalEmail: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  profilePictureUrl: z.string().nullable().optional(),
  dateOfBirth: dateString.nullable().optional(),
  gender: z.string().nullable().optional(),
  maritalStatus: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  bankAccountNo: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  ifscCode: z.string().nullable().optional(),
  pan: z.string().nullable().optional(),
  uan: z.string().nullable().optional(),
  departmentId: z.string().uuid().optional(),
  jobPositionId: z.string().uuid().optional(),
  managerId: z.string().uuid().nullable().optional()
});

export const statusTransitionSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
  employmentEndDate: dateString.optional()
});

export const listEmployeesSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  departmentId: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;
export type ListEmployeesInput = z.infer<typeof listEmployeesSchema>;
