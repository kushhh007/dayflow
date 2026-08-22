import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

export const metaRouter = Router();

metaRouter.get(
  '/departments',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    });
    res.json({ departments });
  })
);

metaRouter.get(
  '/job-positions',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const jobPositions = await prisma.jobPosition.findMany({
      orderBy: { title: 'asc' },
      select: { id: true, title: true }
    });
    res.json({ jobPositions });
  })
);
