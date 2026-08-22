import { z } from 'zod';

export const loginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});
