import { z } from 'zod';

const emailSchema: z.ZodType<string> = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.email(),
);

export const sendEmailCodeBodySchema = z.object({
  email: emailSchema,
});

export const registerBodySchema = z.object({
  username: z.string().trim().min(3).max(32),
  email: emailSchema,
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(1).max(64),
  verificationCode: z.string().trim().regex(/^\d{6}$/),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});
