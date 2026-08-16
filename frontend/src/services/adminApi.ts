import { ADMIN_API_URL } from '../utils/constants';

const TOKEN_KEY = 'admin-token';

interface AdminUser {
  username: string;
  name: string;
  role: string;
}

interface AdminRoom {
  code: string;
  state: string | null;
  players: Array<{
    id: string;
    name: string;
    hand_count: number;
    is_online: boolean;
  }>;
  player_count: number;
  client_count: number;
  empty_since: number | null;
}

interface AdminStats {
  total_users: number;
  admin_count: number;
  total_rooms: number;
  active_games: number;
  online_players: number;
}

class AdminApiService {
  private token: string | null = null;

  constructor() {
    try {
      this.token = localStorage.getItem(TOKEN_KEY);
    } catch {
      this.token = null;
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  private async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const resp = await fetch(`${ADMIN_API_URL}${path}`, { ...options, headers });
    if (resp.status === 401) {
      this.clearToken();
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || `HTTP ${resp.status}`);
    }
    return data as T;
  }

  setToken(token: string): void {
    this.token = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  }

  clearToken(): void {
    this.token = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }

  async login(username: string, password: string): Promise<{ token: string; username: string; name: string }> {
    const data = await this.request<{ token: string; username: string; name: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    this.clearToken();
  }

  async listUsers(): Promise<{ users: AdminUser[] }> {
    return this.request('/users');
  }

  async createUser(username: string, name: string, password: string, role: string): Promise<AdminUser> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify({ username, name, password, role }),
    });
  }

  async updateUser(username: string, data: { name?: string; role?: string; password?: string }): Promise<{ ok: boolean }> {
    return this.request(`/users/${encodeURIComponent(username)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(username: string): Promise<{ ok: boolean }> {
    return this.request(`/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
  }

  async listRooms(): Promise<{ rooms: AdminRoom[] }> {
    return this.request('/rooms');
  }

  async closeRoom(code: string): Promise<{ ok: boolean }> {
    return this.request(`/rooms/${encodeURIComponent(code)}`, { method: 'DELETE' });
  }

  async kickPlayer(code: string, playerId: string): Promise<{ ok: boolean }> {
    return this.request(`/rooms/${encodeURIComponent(code)}/players/${encodeURIComponent(playerId)}`, { method: 'DELETE' });
  }

  async getGameState(code: string): Promise<{ game_state: any }> {
    return this.request(`/rooms/${encodeURIComponent(code)}/game-state`);
  }

  async getStats(): Promise<AdminStats> {
    return this.request('/stats');
  }
}

export const adminApi = new AdminApiService();
export type { AdminUser, AdminRoom, AdminStats };
