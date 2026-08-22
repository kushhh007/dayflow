import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as payrollService from '../services/payroll.service.js';
import {
  createPayrollRunSchema,
  listPayslipsSchema,
  listRunsSchema
} from '../validators/payroll.js';

export const payrollRouter = Router();

const uuidParam = z.string().uuid();

payrollRouter.post(
  '/runs',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = createPayrollRunSchema.parse(req.body);
    res.status(201).json({ run: await payrollService.createRun(req.user!, body) });
  })
);

payrollRouter.get(
  '/runs',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const query = listRunsSchema.parse(req.query);
    res.json(await payrollService.listRuns(query));
  })
);

payrollRouter.get(
  '/runs/:id',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json(await payrollService.getRun(id));
  })
);

payrollRouter.post(
  '/runs/:id/calculate',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    const run = await payrollService.calculateRun(id);
    res.json({ run });
  })
);

payrollRouter.post(
  '/runs/:id/finalize',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json(await payrollService.finalizeRun(id, req.user!));
  })
);

export const payslipRouter = Router();

payslipRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listPayslipsSchema.parse(req.query);
    res.json(await payrollService.listPayslips(req.user!, query));
  })
);

payslipRouter.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json({ payslip: await payrollService.getPayslip(id, req.user!) });
  })
);
