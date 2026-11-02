import { api } from './client';
import type { AuthResponse } from './types';

export type RegisterBody = {
  name: string;
  email: string;
  password: string;
  timezone: string;
  currency: string;
  locale: string;
  device_name: string;
};

export const authApi = {
  register: (body: RegisterBody) => api<AuthResponse>('/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string; device_name: string }) =>
    api<AuthResponse>('/auth/login', { method: 'POST', body }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) => api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (body: { token: string; email: string; password: string }) =>
    api<{ message: string }>('/auth/reset-password', { method: 'POST', body }),
  resendVerification: () => api<void>('/auth/email/resend', { method: 'POST' }),
};
