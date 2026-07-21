import { WS_URL } from '../utils/constants';
import { WebSocketMessage } from '../types/message';

class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (message: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionPromise: Promise<void> | null = null;
  private intentionalDisconnect = false;
  private roomCode: string | null = this.readStoredRoomCode();
  private sessionCredentials: { username: string; password: string } | null = null;
  private pendingRoomRestore: {
    roomCode: string;
    complete: () => void;
    fail: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null = null;

  private readStoredRoomCode(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    const stored = sessionStorage.getItem('mini-card-game-room');
    return stored ? stored.trim().toUpperCase() : null;
  }

  getRoomCode(): string | null {
    return this.roomCode;
  }

  setRoomCode(roomCode: string): string {
    const normalized = roomCode.trim().toUpperCase();
    this.roomCode = normalized;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('mini-card-game-room', normalized);
    }
    return normalized;
  }

  clearRoomCode(): void {
    this.roomCode = null;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('mini-card-game-room');
    }
  }

  setSessionCredentials(username: string, password: string): void {
    this.sessionCredentials = { username, password };
  }

  clearSessionCredentials(): void {
    this.sessionCredentials = null;
  }

  simulateUnexpectedDisconnect(): void {
    this.intentionalDisconnect = false;
    this.ws?.close();
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN && !this.pendingRoomRestore) {
      return Promise.resolve();
    }
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.intentionalDisconnect = false;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        console.log('Attempting to connect to:', WS_URL);
        this.ws = new WebSocket(WS_URL);

        const timeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            reject(new Error('Connection timeout'));
          }
        }, 5000);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          clearTimeout(timeout);
          const shouldRestoreSession = this.reconnectAttempts > 0;
          const completeConnection = () => {
            this.pendingRoomRestore = null;
            this.reconnectAttempts = 0;
            this.connectionPromise = null;
            resolve();
            if (shouldRestoreSession && this.sessionCredentials && this.ws?.readyState === WebSocket.OPEN) {
              this.send({
                type: 'reconnect',
                username: this.sessionCredentials.username,
                password: this.sessionCredentials.password,
              });
            }
          };

          if (this.roomCode) {
            const roomCode = this.roomCode;
            const roomTimeout = setTimeout(() => {
              this.pendingRoomRestore = null;
              this.connectionPromise = null;
              reject(new Error('Room restore timeout'));
            }, 5000);
            this.pendingRoomRestore = {
              roomCode,
              timeout: roomTimeout,
              complete: () => {
                clearTimeout(roomTimeout);
                completeConnection();
              },
              fail: (error) => {
                clearTimeout(roomTimeout);
                this.pendingRoomRestore = null;
                this.connectionPromise = null;
                reject(error);
              },
            };
            this.ws?.send(JSON.stringify({ type: 'join_room', room_code: roomCode }));
          } else {
            completeConnection();
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            if (this.pendingRoomRestore) {
              if (message.type === 'room_joined' && message.room_code === this.pendingRoomRestore.roomCode) {
                this.pendingRoomRestore.complete();
              } else if (message.type === 'error') {
                if (message.code === 'room_not_found') this.clearRoomCode();
                this.pendingRoomRestore.fail(new Error(message.message));
              }
            }
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              handler(message);
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          clearTimeout(timeout);
          this.connectionPromise = null;
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          clearTimeout(timeout);
          if (this.pendingRoomRestore) clearTimeout(this.pendingRoomRestore.timeout);
          this.pendingRoomRestore = null;
          this.ws = null;
          this.connectionPromise = null;
          if (!this.intentionalDisconnect) this.attemptReconnect();
        };
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  on(messageType: string, handler: (message: any) => void): void {
    this.messageHandlers.set(messageType, handler);
  }

  off(messageType: string): void {
    this.messageHandlers.delete(messageType);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(`Attempting to reconnect in ${delay}ms...`);
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();
