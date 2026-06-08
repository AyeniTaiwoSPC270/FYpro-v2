// api/_lib/validate.js
import { z } from 'zod';

export const AuthLoginSchema = z.object({
  email:    z.string().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export const AuthSignupSchema = z.object({
  email:      z.string().email('Invalid email address.'),
  password:   z.string().min(8, 'Password must be at least 8 characters.'),
  full_name:  z.string().max(100).optional(),
  university: z.string().optional(),
});

export const AuthForgotSchema = z.object({
  email: z.string().email('Invalid email address.'),
});

export const PaymentInitiateSchema = z.object({
  tier: z.enum(['student_pack', 'defense_pack', 'project_reset']),
});

export const AiMessagesSchema = z.object({
  messages: z
    .array(
      z.object({
        role:    z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .min(1, 'At least one message is required.'),
});

/**
 * Returns { ok: true } or { ok: false, error: '<first Zod issue message>' }.
 * @param {import('zod').ZodTypeAny} schema
 * @param {unknown} data
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true };
  return {
    ok:    false,
    error: result.error.issues[0]?.message ?? 'Invalid request.',
  };
}
