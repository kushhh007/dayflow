import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as opsService from '../services/ops.service.js';

export const opsRouter = Router();

opsRouter.get(
  '/daily-brief',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    res.json(await opsService.dailyBrief(req.user!));
  })
);

opsRouter.get(
  '/attention',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    res.json(await opsService.attentionQueue(req.user!));
  })
);
