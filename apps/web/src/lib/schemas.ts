import { z } from 'zod';

// Error messages are i18next translation keys (namespace "validation"), not literal
// text — Zod schemas are created once at module load, before the user's language is
// known, so the actual text is resolved at render time via t(errors.field.message).
export const emailSchema = z
  .string()
  .min(1, 'validation:email_required')
  .email('validation:email_invalid');

export const passwordSchema = z
  .string()
  .min(6, 'validation:password_min');

export const nicknameSchema = z
  .string()
  .min(3, 'validation:nickname_min')
  .max(20, 'validation:nickname_max')
  .regex(/^[a-zA-Z0-9_]+$/, 'validation:nickname_pattern');

export const registerSchema = z.object({
  name: z.string().min(2, 'validation:name_min').max(50, 'validation:name_max'),
  nickname: nicknameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'validation:confirm_password_required'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'validation:passwords_dont_match',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'validation:password_required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'validation:confirm_password_required'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'validation:passwords_dont_match',
  path: ['confirmPassword'],
});

export const editProfileSchema = z.object({
  name: z.string().min(2, 'validation:name_min').max(50, 'validation:name_max'),
  nickname: nicknameSchema,
  bio: z.string().max(200, 'validation:bio_max').optional(),
});

export const changeEmailSchema = z.object({
  email: emailSchema,
  currentPassword: z.string().min(1, 'validation:current_password_required'),
});

export const supportTicketSchema = z.object({
  title: z.string().min(5, 'validation:ticket_title_min').max(100, 'validation:ticket_title_max'),
  description: z.string().min(10, 'validation:ticket_description_min').max(2000, 'validation:ticket_description_max'),
});

export const withdrawSchema = z.object({
  amount: z
    .string()
    .min(1, 'validation:amount_required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 10, 'validation:amount_min'),
});

export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
export type EditProfileSchema = z.infer<typeof editProfileSchema>;
export type ChangeEmailSchema = z.infer<typeof changeEmailSchema>;
export type SupportTicketSchema = z.infer<typeof supportTicketSchema>;
export type WithdrawSchema = z.infer<typeof withdrawSchema>;
