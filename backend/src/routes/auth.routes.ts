import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';
import { changePasswordSchema, loginSchema } from '../validators/auth.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    res.json(await authService.login(body.loginId, body.password));
  })
);

authRouter.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const body = changePasswordSchema.parse(req.body);
    res.json(await authService.changePassword(req.user!.id, body.currentPassword, body.newPassword));
  })
);

authRouter.post('/logout', authenticate, (_req, res) => {
  res.status(204).send();
});
