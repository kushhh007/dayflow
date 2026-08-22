import { PrismaClient } from '@prisma/client';
import { buildLoginId } from '../src/lib/login-id.js';
import { hashPassword } from '../src/lib/passwords.js';

const prisma = new PrismaClient();

const DEV_PASSWORD = 'Dayflow@2026';
const YEAR = new Date().getUTCFullYear();
const DAY_MS = 86_400_000;

function utc(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function dayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function lastWeekday(date: Date): Date {
  let d = new Date(date);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d = shiftDays(d, -1);
  }
  return d;
}

async function main() {
  console.log('Seeding Dayflow demo data...');
  const passwordHash = await hashPassword(DEV_PASSWORD);

  const company = await prisma.company.upsert({
    where: { name: 'Dayflow Technologies' },
    update: {},
    create: { name: 'Dayflow Technologies', initials: 'DF', timezone: 'Asia/Kolkata' }
  });

  const departmentNames = ['Engineering', 'Human Resources', 'Finance', 'Sales'];
  const departments: Record<string, { id: string }> = {};
  for (const name of departmentNames) {
    departments[name] = await prisma.department.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: {},
      create: { companyId: company.id, name }
    });
  }

  const jobTitles = [
    'Software Engineer',
    'Engineering Manager',
    'HR Officer',
    'Accountant',
    'Sales Executive'
  ];
  const jobPositions: Record<string, { id: string }> = {};
  for (const title of jobTitles) {
    jobPositions[title] = await prisma.jobPosition.upsert({
      where: { companyId_title: { companyId: company.id, title } },
      update: {},
      create: { companyId: company.id, title }
    });
  }

  const paidType = await prisma.leaveType.upsert({
    where: { code: 'PAID' },
    update: {},
    create: { code: 'PAID', requiresAllocation: true, requiresAttachment: false, payable: true }
  });
  const sickType = await prisma.leaveType.upsert({
    where: { code: 'SICK' },
    update: {},
    create: { code: 'SICK', requiresAllocation: true, requiresAttachment: true, payable: true }
  });
  await prisma.leaveType.upsert({
    where: { code: 'UNPAID' },
    update: {},
    create: { code: 'UNPAID', requiresAllocation: false, requiresAttachment: false, payable: false }
  });

  let serial = await prisma.user.count({
    where: { companyId: company.id, createdAt: { gte: utc(`${YEAR}-01-01`) } }
  });

  interface StaffInput {
    firstName: string;
    lastName: string;
    role?: 'ADMIN' | 'EMPLOYEE';
    department: string;
    title: string;
    wagePaise: number;
    joinDate: string;
    status?: 'ACTIVE' | 'INACTIVE';
  }

  const accounts: Array<{ name: string; role: string; loginId: string; active: boolean }> = [];

  async function upsertStaff(input: StaffInput) {
    serial += 1;
    const loginId = buildLoginId(company.initials, input.firstName, input.lastName, YEAR, serial);
    const role = input.role ?? 'EMPLOYEE';

    const existingUser = await prisma.user.findUnique({ where: { loginId } });
    if (existingUser) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { userId: existingUser.id }
      });
      accounts.push({
        name: `${input.firstName} ${input.lastName}`,
        role,
        loginId,
        active: input.status !== 'INACTIVE'
      });
      return { user: existingUser, employee: existingEmployee };
    }

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        loginId,
        passwordHash,
        role,
        mustChangePassword: false
      }
    });

    accounts.push({
      name: `${input.firstName} ${input.lastName}`,
      role,
      loginId,
      active: input.status !== 'INACTIVE'
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        companyId: company.id,
        firstName: input.firstName,
        lastName: input.lastName,
        status: input.status ?? 'ACTIVE',
        joinDate: utc(input.joinDate),
        departmentId: departments[input.department].id,
        jobPositionId: jobPositions[input.title].id
      }
    });

    const inactiveEnd =
      input.status === 'INACTIVE' ? lastWeekday(shiftDays(new Date(), -7)) : null;

    await prisma.employmentPeriod.create({
      data: { employeeId: employee.id, startDate: utc(input.joinDate), endDate: inactiveEnd }
    });

    if (input.status !== 'INACTIVE') {
      await prisma.salaryStructure.create({
        data: {
          employeeId: employee.id,
          wagePaise: input.wagePaise,
          standardAllowancePaise: 416700
        }
      });

      await prisma.leaveAllocation.createMany({
        data: [
          {
            employeeId: employee.id,
            leaveTypeId: paidType.id,
            year: YEAR,
            allocatedDays: 18,
            approvedOrUsedDays: 0
          },
          {
            employeeId: employee.id,
            leaveTypeId: sickType.id,
            year: YEAR,
            allocatedDays: 12,
            approvedOrUsedDays: 0
          }
        ]
      });
    }

    return { user, employee };
  }

  const admin = await upsertStaff({
    firstName: 'Asha',
    lastName: 'Rao',
    role: 'ADMIN',
    department: 'Human Resources',
    title: 'HR Officer',
    wagePaise: 9_000_000,
    joinDate: `${YEAR}-01-05`
  });

  const meera = await upsertStaff({
    firstName: 'Meera',
    lastName: 'Pillai',
    department: 'Human Resources',
    title: 'HR Officer',
    wagePaise: 5_500_000,
    joinDate: `${YEAR}-01-05`
  });

  const john = await upsertStaff({
    firstName: 'John',
    lastName: 'Doe',
    department: 'Engineering',
    title: 'Engineering Manager',
    wagePaise: 9_000_000,
    joinDate: `${YEAR}-01-05`
  });

  const priya = await upsertStaff({
    firstName: 'Priya',
    lastName: 'Nair',
    department: 'Engineering',
    title: 'Software Engineer',
    wagePaise: 6_500_000,
    joinDate: `${YEAR}-01-05`
  });

  const arjun = await upsertStaff({
    firstName: 'Arjun',
    lastName: 'Mehta',
    department: 'Engineering',
    title: 'Software Engineer',
    wagePaise: 5_000_000,
    joinDate: `${YEAR}-01-05`
  });

  const sara = await upsertStaff({
    firstName: 'Sara',
    lastName: 'Iyer',
    department: 'Engineering',
    title: 'Software Engineer',
    wagePaise: 5_500_000,
    joinDate: `${YEAR}-01-05`
  });

  const vikram = await upsertStaff({
    firstName: 'Vikram',
    lastName: 'Shah',
    department: 'Engineering',
    title: 'Software Engineer',
    wagePaise: 4_800_000,
    joinDate: `${YEAR}-01-05`
  });

  const neha = await upsertStaff({
    firstName: 'Neha',
    lastName: 'Kapoor',
    department: 'Engineering',
    title: 'Software Engineer',
    wagePaise: 6_200_000,
    joinDate: `${YEAR}-07-13`
  });

  const karan = await upsertStaff({
    firstName: 'Karan',
    lastName: 'Malhotra',
    department: 'Finance',
    title: 'Accountant',
    wagePaise: 5_800_000,
    joinDate: `${YEAR}-01-05`
  });

  const divya = await upsertStaff({
    firstName: 'Divya',
    lastName: 'Menon',
    department: 'Sales',
    title: 'Sales Executive',
    wagePaise: 5_200_000,
    joinDate: `${YEAR}-02-16`
  });

  await upsertStaff({
    firstName: 'Ravi',
    lastName: 'Kumar',
    department: 'Engineering',
    title: 'Software Engineer',
    wagePaise: 4_200_000,
    joinDate: `${YEAR}-01-05`,
    status: 'INACTIVE'
  });

  const demoDate = lastWeekday(new Date());
  const demoDateStr = dayString(demoDate);

  async function markAttendance(
    employeeId: string,
    data: { status: 'PRESENT' | 'ABSENT' | 'LEAVE'; checkIn?: Date; checkOut?: Date }
  ) {
    await prisma.attendance.upsert({
      where: { employeeId_workDate: { employeeId, workDate: demoDate } },
      update: {},
      create: { employeeId, workDate: demoDate, ...data }
    });
  }

  await markAttendance(john!.employee!.id, {
    status: 'PRESENT',
    checkIn: new Date(`${demoDateStr}T03:45:00.000Z`),
    checkOut: new Date(`${demoDateStr}T12:30:00.000Z`)
  });

  await markAttendance(priya!.employee!.id, { status: 'PRESENT' });
  await markAttendance(arjun!.employee!.id, { status: 'ABSENT' });
  await markAttendance(meera!.employee!.id, {
    status: 'PRESENT',
    checkIn: new Date(`${demoDateStr}T04:10:00.000Z`),
    checkOut: new Date(`${demoDateStr}T12:45:00.000Z`)
  });
  await markAttendance(neha!.employee!.id, {
    status: 'PRESENT',
    checkIn: new Date(`${demoDateStr}T03:55:00.000Z`),
    checkOut: new Date(`${demoDateStr}T12:35:00.000Z`)
  });
  await markAttendance(karan!.employee!.id, {
    status: 'PRESENT',
    checkIn: new Date(`${demoDateStr}T04:00:00.000Z`),
    checkOut: new Date(`${demoDateStr}T12:40:00.000Z`)
  });
  await markAttendance(divya!.employee!.id, {
    status: 'PRESENT',
    checkIn: new Date(`${demoDateStr}T04:20:00.000Z`),
    checkOut: new Date(`${demoDateStr}T13:00:00.000Z`)
  });

  async function approveLeave(
    staff: Awaited<ReturnType<typeof upsertStaff>>,
    leaveTypeId: string
  ) {
    if (!staff.employee) return;
    const startDate = shiftDays(demoDate, -2);
    const endDate = demoDate;
    const totalDays = 3;

    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: staff.employee.id,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      }
    });
    if (overlap) return;

    await prisma.leaveRequest.create({
      data: {
        employeeId: staff.employee.id,
        leaveTypeId,
        year: endDate.getUTCFullYear(),
        startDate,
        endDate,
        totalDays,
        reason: 'Demo approved leave',
        status: 'APPROVED'
      }
    });

    await prisma.leaveAllocation.updateMany({
      where: {
        employeeId: staff.employee.id,
        leaveTypeId,
        year: endDate.getUTCFullYear()
      },
      data: { approvedOrUsedDays: { increment: totalDays } }
    });

    for (let t = startDate.getTime(); t <= endDate.getTime(); t += DAY_MS) {
      const d = new Date(t);
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
      await prisma.attendance.upsert({
        where: { employeeId_workDate: { employeeId: staff.employee.id, workDate: d } },
        update: {},
        create: { employeeId: staff.employee.id, workDate: d, status: 'LEAVE' }
      });
    }
  }

  await approveLeave(sara, paidType.id);
  await approveLeave(vikram, paidType.id);

  if (priya?.employee) {
    await prisma.leaveAllocation.updateMany({
      where: { employeeId: priya.employee.id, leaveTypeId: paidType.id, year: YEAR },
      data: { approvedOrUsedDays: 17 }
    });
  }

  const now = new Date();
  const firstOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevPeriodEnd = new Date(firstOfCurrentMonth.getTime() - DAY_MS);
  const prevPeriodStart = new Date(
    Date.UTC(prevPeriodEnd.getUTCFullYear(), prevPeriodEnd.getUTCMonth(), 1)
  );

  const existingRun = await prisma.payrollRun.findFirst({
    where: {
      companyId: company.id,
      periodStart: prevPeriodStart,
      periodEnd: prevPeriodEnd
    }
  });
  let draftRunId: string;
  if (existingRun) {
    draftRunId = existingRun.id;
  } else {
    const run = await prisma.payrollRun.create({
      data: {
        companyId: company.id,
        periodStart: prevPeriodStart,
        periodEnd: prevPeriodEnd,
        status: 'DRAFT',
        createdById: admin!.user!.id
      }
    });
    draftRunId = run.id;
  }

  console.log(`
Seed complete.
Company: ${company.name} (initials ${company.initials})
Staff: ${accounts.length} accounts (1 INACTIVE)
Demo date used for attendance/leave signals: ${demoDateStr}
Ops Intelligence flags expected on Daily Brief:
  - UNEXPLAINED_ABSENCE: Arjun Mehta
  - ATTENDANCE_ANOMALY: Priya Nair (PRESENT without check-in)
  - COVERAGE_RISK HIGH: Engineering 2/6 on approved leave (~33%)
  - LOW_BALANCE_WARNING: Priya Nair PAID 17/18 (94%)
Draft payroll run ready to calculate: ${draftRunId} (${dayString(prevPeriodStart)} - ${dayString(prevPeriodEnd)})

Demo credentials — password for every account: ${DEV_PASSWORD}
`);
  for (const account of accounts) {
    console.log(
      `  ${account.role.padEnd(8)} ${account.loginId.padEnd(20)} ${account.name}${account.active ? '' : ' (INACTIVE)'}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
