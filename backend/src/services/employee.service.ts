import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { HttpError } from '../lib/http.js';
import { buildLoginId } from '../lib/login-id.js';
import { generateTemporaryPassword, hashPassword } from '../lib/passwords.js';
import { deriveSalaryComponents } from '../lib/salary.js';
import { prisma } from '../lib/prisma.js';
import { writeAudit, type AuditEntry } from '../lib/audit.js';
import { projectEmployee, type ProjectableEmployee } from '../lib/employee-projection.js';
import type { AuthedUser } from '../middleware/auth.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  statusTransitionSchema,
  type ListEmployeesInput,
  type StatusTransitionInput,
  type UpdateEmployeeInput
} from '../validators/employee.js';

type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

const salaryInclude = {
  department: { select: { id: true, name: true } },
  jobPosition: { select: { id: true, title: true } },
  salaryStructure: { select: { wagePaise: true, standardAllowancePaise: true } }
};

function toProjected(
  row: Prisma.EmployeeGetPayload<{ include: typeof salaryInclude }>,
  viewer: AuthedUser
) {
  const record = row as unknown as ProjectableEmployee;
  return projectEmployee(record, viewer.role, row.id === viewer.employeeId);
}

export async function listEmployees(viewer: AuthedUser, query: ListEmployeesInput) {
  const where: Prisma.EmployeeWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.q) {
    where.OR = [
      { firstName: { contains: query.q, mode: 'insensitive' } },
      { lastName: { contains: query.q, mode: 'insensitive' } }
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: salaryInclude,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: query.limit,
      skip: query.offset
    })
  ]);

  return {
    employees: rows.map((row) => toProjected(row, viewer)),
    meta: { total, limit: query.limit, offset: query.offset }
  };
}

function toDate(dateString?: string | null): Date | null {
  return dateString ? new Date(`${dateString}T00:00:00.000Z`) : null;
}

export async function createEmployee(input: CreateEmployeeInput) {
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new HttpError(400, 'Company not initialized');
  }

  if (input.wagePaise !== undefined) {
    deriveSalaryComponents(input.wagePaise, input.standardAllowancePaise);
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const joinDate = new Date(`${input.joinDate}T00:00:00.000Z`);
  const joinYear = joinDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(joinYear, 0, 1));
  const yearEnd = new Date(Date.UTC(joinYear + 1, 0, 1));

  return prisma.$transaction(async (tx) => {
    let serial =
      (
        await tx.user.count({
          where: { companyId: company.id, createdAt: { gte: yearStart, lt: yearEnd } }
        })
      ) + 1;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const loginId = buildLoginId(
        company.initials,
        input.firstName,
        input.lastName,
        joinYear,
        serial
      );

      try {
        const user = await tx.user.create({
          data: { companyId: company.id, loginId, passwordHash, role: 'EMPLOYEE' }
        });

        const employee = await tx.employee.create({
          data: {
            userId: user.id,
            companyId: company.id,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            personalEmail: input.personalEmail,
            dateOfBirth: toDate(input.dateOfBirth),
            gender: input.gender,
            maritalStatus: input.maritalStatus,
            nationality: input.nationality,
            address: input.address,
            bankAccountNo: input.bankAccountNo,
            bankName: input.bankName,
            ifscCode: input.ifscCode,
            pan: input.pan,
            uan: input.uan,
            departmentId: input.departmentId,
            jobPositionId: input.jobPositionId,
            managerId: input.managerId ?? null,
            status: 'ACTIVE',
            joinDate
          }
        });

        const employmentPeriod = await tx.employmentPeriod.create({
          data: { employeeId: employee.id, startDate: joinDate }
        });

        let salaryStructure = null;
        if (input.wagePaise !== undefined) {
          salaryStructure = await tx.salaryStructure.create({
            data: {
              employeeId: employee.id,
              wagePaise: input.wagePaise,
              standardAllowancePaise: input.standardAllowancePaise
            }
          });
        }

        return {
          employee: { ...employee, loginId },
          employmentPeriod,
          salaryStructure,
          credentials: { temporaryPassword }
        };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          serial += 1;
          continue;
        }
        throw err;
      }
    }

    throw new HttpError(409, 'Could not generate a unique Login ID after retries');
  });
}

export async function resetPassword(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, userId: true }
  });
  if (!employee) throw new HttpError(404, 'Employee not found');

  const temporaryPassword = generateTemporaryPassword();
  await prisma.user.update({
    where: { id: employee.userId },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      tokenVersion: { increment: 1 }
    }
  });

  return { credentials: { temporaryPassword } };
}

export async function getEmployeeProfile(id: string, viewer: AuthedUser) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: salaryInclude
  });
  if (!employee) throw new HttpError(404, 'Employee not found');
  return toProjected(employee, viewer);
}

const EMPLOYEE_EDITABLE_FIELDS = ['phone', 'personalEmail', 'address', 'profilePictureUrl'];

export async function updateEmployee(
  id: string,
  viewer: AuthedUser,
  body: Record<string, unknown>
) {
  if (viewer.role === 'EMPLOYEE') {
    if (viewer.employeeId !== id) {
      throw new HttpError(403, 'Employees can only edit their own profile');
    }
    const forbidden = Object.keys(body).filter(
      (key) => !EMPLOYEE_EDITABLE_FIELDS.includes(key)
    );
    if (forbidden.length > 0) {
      throw new HttpError(403, `Fields not editable by employees: ${forbidden.join(', ')}`);
    }
  }

  const data: UpdateEmployeeInput = updateEmployeeSchema.parse(body);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.employee.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Employee not found');

    const auditEntries: AuditEntry[] = [];
    for (const [field, newValue] of Object.entries(data)) {
      if (newValue === undefined) continue;
      const rawOld = (existing as unknown as Record<string, unknown>)[field];
      const oldStr =
        rawOld instanceof Date ? rawOld.toISOString().slice(0, 10) : rawOld == null ? null : String(rawOld);
      const newStr = newValue == null ? null : String(newValue);
      if (oldStr !== newStr) {
        auditEntries.push({
          actorId: viewer.id,
          entityType: 'Employee',
          entityId: id,
          field,
          oldValue: oldStr,
          newValue: newStr
        });
      }
    }

    const { dateOfBirth, ...rest } = data;
    const payload: Prisma.EmployeeUncheckedUpdateInput = { ...rest };
    if (dateOfBirth !== undefined) {
      payload.dateOfBirth = dateOfBirth
        ? new Date(`${dateOfBirth}T00:00:00.000Z`)
        : null;
    }

    const updated = await tx.employee.update({
      where: { id },
      data: payload,
      include: salaryInclude
    });

    await writeAudit(tx, auditEntries);

    return toProjected(updated, viewer);
  });
}

export async function transitionStatus(
  id: string,
  viewer: AuthedUser,
  input: StatusTransitionInput
) {
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({
      where: { id },
      include: { employmentPeriods: { where: { endDate: null } } }
    });
    if (!employee) throw new HttpError(404, 'Employee not found');
    if (employee.status === input.status) {
      throw new HttpError(409, `Employee is already ${input.status}`);
    }

    let period:
      | { startDate: Date; endDate: Date | null }
      | undefined;

    if (input.status === 'INACTIVE') {
      const endString =
        input.employmentEndDate ?? new Date().toISOString().slice(0, 10);
      const end = new Date(`${endString}T00:00:00.000Z`);
      if (end < employee.joinDate) {
        throw new HttpError(400, 'Employment end date cannot precede join date');
      }

      const closed = await tx.employmentPeriod.updateMany({
        where: { employeeId: id, endDate: null },
        data: { endDate: end }
      });
      if (closed.count !== 1) {
        throw new HttpError(409, 'No open employment period to close');
      }
      period = { startDate: employee.joinDate, endDate: end };
    } else {
      if (employee.employmentPeriods.length > 0) {
        throw new HttpError(409, 'An open employment period already exists');
      }
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
      period = await tx.employmentPeriod.create({
        data: { employeeId: id, startDate: today }
      });
      period = { startDate: period.startDate, endDate: null };
    }

    const updated = await tx.employee.update({
      where: { id },
      data: { status: input.status },
      include: salaryInclude
    });

    await writeAudit(tx, [
      {
        actorId: viewer.id,
        entityType: 'Employee',
        entityId: id,
        field: 'status',
        oldValue: employee.status,
        newValue: input.status
      }
    ]);

    return { employee: toProjected(updated, viewer), employmentPeriod: period };
  });
}
