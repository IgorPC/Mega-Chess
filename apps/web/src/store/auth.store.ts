import { create } from 'zustand';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  nickname: string;
  avatarUrl?: string;
  bio?: string;
  rating: number;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; name: string; nickname: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
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
    const data = await api.post<{ accessToken: string; refreshToken: string }>('/auth/register', body);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    const user = await api.get<User>('/users/me');
    set({ user });
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {});
    localStorage.clear();
    set({ user: null });
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
