import { create } from 'zustand';
import { adminApi } from '../services/adminApi';

interface AdminState {
  token: string | null;
  username: string | null;
  name: string | null;
  isAuthenticated: boolean;
  setSession: (token: string, username: string, name: string) => void;
  clearSession: () => void;
  logout: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  token: adminApi.getToken(),
  username: null,
  name: null,
  isAuthenticated: adminApi.isAuthenticated(),
  setSession: (token, username, name) =>
    set({ token, username, name, isAuthenticated: true }),
  clearSession: () => {
    adminApi.clearToken();
    set({ token: null, username: null, name: null, isAuthenticated: false });
  },
  logout: async () => {
    await adminApi.logout();
    set({ token: null, username: null, name: null, isAuthenticated: false });
  },
}));
