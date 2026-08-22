import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { HttpError } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';

export interface AuthedUser {
  id: string;
  companyId: string;
  role: 'ADMIN' | 'EMPLOYEE';
  employeeId: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthedUser;
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Missing bearer token');
    }

    const claims = verifyToken(header.slice('Bearer '.length));

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        companyId: true,
        role: true,
        tokenVersion: true,
        employee: { select: { id: true, status: true } }
      }
    });

    if (!user || user.tokenVersion !== claims.tv) {
      throw new HttpError(401, 'Session expired or invalid');
    }

    if (user.employee && user.employee.status === 'INACTIVE') {
      throw new HttpError(403, 'Account is inactive');
    }

    req.user = {
      id: user.id,
      companyId: user.companyId,
      role: user.role,
      employeeId: user.employee?.id ?? null
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Array<'ADMIN' | 'EMPLOYEE'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, 'Unauthenticated'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, 'Forbidden for your role'));
      return;
    }
    next();
  };
}
