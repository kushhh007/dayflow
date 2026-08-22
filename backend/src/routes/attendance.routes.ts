import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as attendanceService from '../services/attendance.service.js';
import {
  listAttendanceSchema,
  submitCorrectionSchema
} from '../validators/attendance.js';

export const attendanceRouter = Router();

const uuidParam = z.string().uuid();

attendanceRouter.post(
  '/check-in',
  authenticate,
  asyncHandler(async (req, res) => {
    res.status(201).json({ attendance: await attendanceService.checkIn(req.user!) });
  })
);

attendanceRouter.post(
  '/check-out',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ attendance: await attendanceService.checkOut(req.user!) });
  })
);

attendanceRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listAttendanceSchema.parse(req.query);
    res.json(await attendanceService.list(req.user!, query));
  })
);

attendanceRouter.post(
  '/corrections',
  authenticate,
  asyncHandler(async (req, res) => {
    const body = submitCorrectionSchema.parse(req.body);
    res.status(201).json({ correction: await attendanceService.submitCorrection(req.user!, body) });
  })
);

attendanceRouter.get(
  '/corrections',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0)
      })
      .parse(req.query);
    res.json(await attendanceService.listCorrections(req.user!, query));
  })
);

attendanceRouter.post(
  '/corrections/:id/approve',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json(await attendanceService.decideCorrection(id, req.user!, 'APPROVED'));
  })
);

attendanceRouter.post(
  '/corrections/:id/reject',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json(await attendanceService.decideCorrection(id, req.user!, 'REJECTED'));
  })
);
