import { create } from 'zustand';
import { api, ApiError } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  nickname: string;
  avatarUrl?: string;
  bio?: string;
  rating: number;
  cpf?: string | null;
  billingName?: string | null;
  birthDate?: string | null;
  termsAcceptedAt?: string | null;
  termsVersion?: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; name: string; nickname: string; password: string; referralCode?: string }) => Promise<{ requiresEmailVerification: true }>;
  resendVerification: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutLocal: () => void;
  deleteAccount: (acknowledgeBalanceLoss?: boolean) => Promise<void>;
  acceptTerms: () => Promise<void>;
  fetchMe: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const data = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    const user = await api.get<User>('/users/me');
    set({ user });
  },

  register: async (body) => {
    await api.post<{ requiresEmailVerification: true }>('/auth/register', body);
    return { requiresEmailVerification: true };
  },

  resendVerification: async (email) => {
    await api.post('/auth/resend-verification', { email });
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {});
    localStorage.clear();
    set({ user: null });
  },

  logoutLocal: () => {
    localStorage.clear();
    set({ user: null });
  },

  deleteAccount: async (acknowledgeBalanceLoss?: boolean) => {
    await api.delete('/users/me', { acknowledgeBalanceLoss });
    localStorage.clear();
    set({ user: null });
  },

  acceptTerms: async () => {
    const user = await api.post<User>('/users/me/accept-terms');
    set({ user });
  },

  fetchMe: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ user: null, loading: false });
      return;
    }
    try {
      const user = await api.get<User>('/users/me');
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  updateUser: (data) => set((s) => ({ user: s.user ? { ...s.user, ...data } : null })),
}));
