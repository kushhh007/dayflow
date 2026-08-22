import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate } from '../middleware/auth.js';
import * as notificationsService from '../services/notifications.service.js';

export const notificationsRouter = Router();

const uuidParam = z.string().uuid();

notificationsRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        unreadOnly: z
          .enum(['true', 'false'])
          .default('false')
          .transform((value) => value === 'true'),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0)
      })
      .parse(req.query);
    res.json(await notificationsService.list(req.user!, query));
  })
);

notificationsRouter.post(
  '/read-all',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.markAllRead(req.user!));
  })
);

notificationsRouter.post(
  '/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json({ notification: await notificationsService.markRead(req.user!, id) });
  })
);
