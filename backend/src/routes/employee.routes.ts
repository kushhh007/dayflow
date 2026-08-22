import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as employeeService from '../services/employee.service.js';
import { createEmployeeSchema } from '../validators/employee.js';

export const employeeRouter = Router();

employeeRouter.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = createEmployeeSchema.parse(req.body);
    res.status(201).json(await employeeService.createEmployee(body));
  })
);

employeeRouter.post(
  '/:id/reset-password',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    res.json(await employeeService.resetPassword(id));
  })
);
