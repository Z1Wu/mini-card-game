import { WS_URL } from '../utils/constants';
import { WebSocketMessage } from '../types/message';
import { logUnexpectedError } from '../utils/logger';

class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, Set<(message: any) => void>> = new Map();
  private connectionHandlers = new Set<(connected: boolean) => void>();
  private sessionExpiredHandlers = new Set<() => void>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionPromise: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect = false;
  private session: { roomCode: string; username: string; reconnectToken: string } | null = null;

  constructor() {
    try {
      const saved = window.sessionStorage.getItem('card-game-session');
      if (saved) this.session = JSON.parse(saved);
    } catch {
      this.session = null;
    }
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.manualDisconnect = false;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(WS_URL);
        this.ws = socket;

        const timeout = setTimeout(() => {
          if (socket.readyState !== WebSocket.OPEN) {
            socket.close();
            reject(new Error('Connection timeout'));
          }
        }, 5000);

        socket.onopen = () => {
          clearTimeout(timeout);
          this.reconnectAttempts = 0;
          this.connectionPromise = null;
          this.emitConnection(true);
          if (this.session) {
            // Detect room-not-found during session replay so we can clear stale state.
            let sessionReplayDone = false;
            const errorCheck = (event: MessageEvent) => {
              if (sessionReplayDone) return;
              try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'error' && msg.code === 'room_not_found') {
                  sessionReplayDone = true;
                  socket.removeEventListener('message', errorCheck);
                  this.clearSession();
                  this.emitSessionExpired();
                }
              } catch { /* ignore parse errors */ }
            };
            socket.addEventListener('message', errorCheck);
            // Stop listening after the initial replay window.
            setTimeout(() => {
              sessionReplayDone = true;
              socket.removeEventListener('message', errorCheck);
            }, 2000);

            if (this.session.roomCode !== 'default') {
              socket.send(JSON.stringify({ type: 'join_room', room_code: this.session.roomCode }));
            }
            socket.send(JSON.stringify({
              type: 'reconnect',
              username: this.session.username,
              reconnect_token: this.session.reconnectToken,
            }));
          }
          resolve();
        };

        socket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            const handlers = this.messageHandlers.get(message.type);
            if (handlers) {
              handlers.forEach(handler => handler(message));
            }
          } catch (error) {
            logUnexpectedError('WebSocket message could not be parsed', error);
          }
        };

        socket.onerror = (error) => {
          logUnexpectedError('WebSocket connection error', error);
          clearTimeout(timeout);
          this.connectionPromise = null;
          reject(new Error('WebSocket connection failed'));
        };

        socket.onclose = () => {
          clearTimeout(timeout);
          if (this.ws === socket) this.ws = null;
          this.connectionPromise = null;
          this.emitConnection(false);
          if (!this.manualDisconnect) this.attemptReconnect();
        };
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.clearSession();
    this.emitConnection(false);
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(messageType: string, handler: (message: any) => void): void {
    const handlers = this.messageHandlers.get(messageType) ?? new Set();
    handlers.add(handler);
    this.messageHandlers.set(messageType, handlers);
  }

  off(messageType: string, handler?: (message: any) => void): void {
    if (!handler) {
      this.messageHandlers.delete(messageType);
      return;
    }
    const handlers = this.messageHandlers.get(messageType);
    handlers?.delete(handler);
    if (handlers?.size === 0) this.messageHandlers.delete(messageType);
  }

  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectionHandlers.add(handler);
    handler(this.isConnected());
    return () => this.connectionHandlers.delete(handler);
  }

  setSession(roomCode: string, username: string, reconnectToken: string): void {
    this.session = { roomCode, username, reconnectToken };
    window.sessionStorage.setItem('card-game-session', JSON.stringify(this.session));
  }

  clearSession(): void {
    this.session = null;
    window.sessionStorage.removeItem('card-game-session');
  }

  getSessionRoomCode(): string {
    return this.session?.roomCode ?? 'default';
  }

  private emitConnection(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  onSessionExpired(handler: () => void): () => void {
    this.sessionExpiredHandlers.add(handler);
    return () => this.sessionExpiredHandlers.delete(handler);
  }

  private emitSessionExpired(): void {
    this.sessionExpiredHandlers.forEach(handler => handler());
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect().catch((error) => logUnexpectedError('WebSocket reconnection failed', error));
      }, delay);
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();
