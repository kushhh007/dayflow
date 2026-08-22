import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { HttpError } from '../lib/http.js';

function buildAuthResponse(
  user: {
    id: string;
    companyId: string;
    loginId: string;
    role: 'ADMIN' | 'EMPLOYEE';
    tokenVersion: number;
    mustChangePassword: boolean;
  },
  employeeId: string | null
) {
  const token = signToken({
    sub: user.id,
    companyId: user.companyId,
    role: user.role,
    tv: user.tokenVersion
  });
  return {
    token,
    user: {
      id: user.id,
      loginId: user.loginId,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      employeeId
    }
  };
}

export async function login(loginId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { loginId },
    include: { employee: { select: { id: true, status: true } } }
  });
  if (!user) throw new HttpError(401, 'Invalid credentials');

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'Invalid credentials');

  if (user.employee?.status === 'INACTIVE') {
    throw new HttpError(403, 'Employee is inactive and cannot log in');
  }

  return buildAuthResponse(user, user.employee?.id ?? null);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, 'Invalid credentials');

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw new HttpError(401, 'Current password is incorrect');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      tokenVersion: { increment: 1 }
    },
    include: { employee: { select: { id: true } } }
  });

  return buildAuthResponse(updated, updated.employee?.id ?? null);
}
