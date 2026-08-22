import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as employeeService from '../services/employee.service.js';
import {
  createEmployeeSchema,
  listEmployeesSchema,
  statusTransitionSchema
} from '../validators/employee.js';

export const employeeRouter = Router();

const uuidParam = z.string().uuid();

employeeRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listEmployeesSchema.parse(req.query);
    res.json(await employeeService.listEmployees(req.user!, query));
  })
);

employeeRouter.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = createEmployeeSchema.parse(req.body);
    res.status(201).json(await employeeService.createEmployee(body));
  })
);

employeeRouter.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json({ employee: await employeeService.getEmployeeProfile(id, req.user!) });
  })
);

employeeRouter.patch(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json({
      employee: await employeeService.updateEmployee(id, req.user!, req.body ?? {})
    });
  })
);

employeeRouter.post(
  '/:id/status',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    const body = statusTransitionSchema.parse(req.body);
    res.json(await employeeService.transitionStatus(id, req.user!, body));
  })
);

employeeRouter.post(
  '/:id/reset-password',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json(await employeeService.resetPassword(id));
  })
);
