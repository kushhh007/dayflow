import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as leaveService from '../services/leave.service.js';
import { createLeaveRequestSchema, listLeaveRequestsSchema } from '../validators/leave.js';

export const leaveRouter = Router();

const uuidParam = z.string().uuid();

leaveRouter.get(
  '/types',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json({ types: await leaveService.getTypes() });
  })
);

leaveRouter.get(
  '/balances',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        employeeId: z.string().uuid().optional(),
        year: z.coerce.number().int().min(2000).max(2100).optional()
      })
      .parse(req.query);
    res.json(await leaveService.balances(req.user!, query.employeeId, query.year));
  })
);

leaveRouter.post(
  '/requests',
  authenticate,
  asyncHandler(async (req, res) => {
    const body = createLeaveRequestSchema.parse(req.body);
    res.status(201).json({ request: await leaveService.createRequest(req.user!, body) });
  })
);

leaveRouter.get(
  '/requests',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listLeaveRequestsSchema.parse(req.query);
    res.json(await leaveService.listRequests(req.user!, query));
  })
);

leaveRouter.post(
  '/requests/:id/cancel',
  authenticate,
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json({ request: await leaveService.cancelRequest(req.user!, id) });
  })
);

leaveRouter.post(
  '/requests/:id/approve',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json({ request: await leaveService.approveRequest(req.user!, id) });
  })
);

leaveRouter.post(
  '/requests/:id/reject',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json({ request: await leaveService.rejectRequest(req.user!, id) });
  })
);
