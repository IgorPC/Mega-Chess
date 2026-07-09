import { z } from 'zod';

export const emailSchema = z
  .string()
  .min(1, 'E-mail é obrigatório')
  .email('E-mail inválido');

export const passwordSchema = z
  .string()
  .min(6, 'Senha deve ter pelo menos 6 caracteres');

export const nicknameSchema = z
  .string()
  .min(3, 'Apelido deve ter pelo menos 3 caracteres')
  .max(20, 'Apelido pode ter no máximo 20 caracteres')
  .regex(/^[a-zA-Z0-9_]+$/, 'Apenas letras, números e _');

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(50, 'Nome muito longo'),
  nickname: nicknameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirme sua senha'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirme sua senha'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export const editProfileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(50, 'Nome muito longo'),
  nickname: nicknameSchema,
  bio: z.string().max(200, 'Bio pode ter no máximo 200 caracteres').optional(),
});

export const changeEmailSchema = z.object({
  email: emailSchema,
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
});

export const supportTicketSchema = z.object({
  title: z.string().min(5, 'Título deve ter pelo menos 5 caracteres').max(100, 'Título muito longo'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres').max(2000, 'Descrição muito longa'),
});

export const withdrawSchema = z.object({
  amount: z
    .string()
    .min(1, 'Informe o valor')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 10, 'Valor mínimo: 10 CC'),
});

export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
export type EditProfileSchema = z.infer<typeof editProfileSchema>;
export type ChangeEmailSchema = z.infer<typeof changeEmailSchema>;
export type SupportTicketSchema = z.infer<typeof supportTicketSchema>;
export type WithdrawSchema = z.infer<typeof withdrawSchema>;
