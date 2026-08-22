import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { HttpError } from '../lib/http.js';
import { buildLoginId } from '../lib/login-id.js';
import { generateTemporaryPassword, hashPassword } from '../lib/passwords.js';
import { deriveSalaryComponents } from '../lib/salary.js';
import { prisma } from '../lib/prisma.js';
import type { createEmployeeSchema } from '../validators/employee.js';

type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

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
