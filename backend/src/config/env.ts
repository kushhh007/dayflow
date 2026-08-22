import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default('postgresql://dayflow:dayflow@localhost:5432/dayflow'),
  JWT_SECRET: z.string().default('dayflow-dev-secret')
});

export const env = envSchema.parse(process.env);
