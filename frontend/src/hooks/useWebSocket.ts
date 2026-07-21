import { useState, useCallback, useEffect } from 'react';
import { wsService } from '../services/websocket';
import { WebSocketMessage } from '../types/message';
import { usePlayerStore } from '../stores/playerStore';
import { logUnexpectedError } from '../utils/logger';

interface UseWebSocketReturn {
  connect: () => Promise<void>;
  disconnect: () => void;
  send: (message: WebSocketMessage) => void;
  isConnected: boolean;
  error: Error | null;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => wsService.onConnectionChange((connected) => {
    setIsConnected(connected);
    usePlayerStore.getState().setConnected(connected);
  }), []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      await wsService.connect();
      setIsConnected(true);
    } catch (err) {
      const error = err as Error;
      logUnexpectedError('WebSocket connection failed', error);
      setError(error);
      setIsConnected(false);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    wsService.disconnect();
    setIsConnected(false);
    setError(null);
  }, []);

  const send = useCallback((message: WebSocketMessage) => {
    wsService.send(message);
  }, []);

  // 移除自动断开连接的逻辑
  // useEffect(() => {
  //   return () => {
  //     disconnect();
  //   };
  // }, [disconnect]);

  return {
    connect,
    disconnect,
    send,
    isConnected,
    error,
  };
}
