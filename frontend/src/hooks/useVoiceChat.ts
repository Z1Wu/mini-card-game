import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VoiceChatService, isVoiceChatSupported } from '../services/voiceChat';
import { wsService } from '../services/websocket';

interface UseVoiceChatOptions {
  /** 仅在牌局内启用；禁用时不订阅转发消息并释放麦克风。 */
  enabled: boolean;
  /** 一段录音就绪后的上行回调（通常发送 voice_chunk 消息）。 */
  onSendChunk: (base64: string) => void;
}

export interface UseVoiceChatResult {
  supported: boolean;
  talking: boolean;
  micError: string | null;
  speakingPlayerId: string | null;
  startTalking: () => void;
  stopTalking: () => void;
  clearMicError: () => void;
}

/** 把按住说话服务接进 React：状态镜像 + voice_chunk 转发订阅 + 资源释放。 */
export function useVoiceChat({ enabled, onSendChunk }: UseVoiceChatOptions): UseVoiceChatResult {
  const supported = useMemo(() => isVoiceChatSupported(), []);
  const [talking, setTalking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [speakingPlayerId, setSpeakingPlayerId] = useState<string | null>(null);

  const sendChunkRef = useRef(onSendChunk);
  useEffect(() => {
    sendChunkRef.current = onSendChunk;
  }, [onSendChunk]);

  const serviceRef = useRef<VoiceChatService | null>(null);
  if (supported && serviceRef.current === null) {
    serviceRef.current = new VoiceChatService(
      base64 => sendChunkRef.current(base64),
      {
        onTalkingChange: setTalking,
        onRemoteSpeakingChange: setSpeakingPlayerId,
        onError: message => setMicError(message),
      },
    );
  }

  useEffect(() => {
    if (!enabled || !supported) return undefined;
    const handler = (message: { from_player_id?: string; data?: unknown }) => {
      if (message?.from_player_id && typeof message.data === 'string') {
        serviceRef.current?.enqueueIncoming(message.from_player_id, message.data);
      }
    };
    wsService.on('voice_chunk', handler);
    return () => {
      wsService.off('voice_chunk', handler);
    };
  }, [enabled, supported]);

  // 禁用或卸载时释放麦克风、停止播放并清空队列。
  useEffect(() => {
    if (!enabled || !supported) {
      serviceRef.current?.dispose();
      setTalking(false);
      setSpeakingPlayerId(null);
    }
  }, [enabled, supported]);

  useEffect(() => () => {
    serviceRef.current?.dispose();
  }, []);

  const startTalking = useCallback(() => {
    setMicError(null);
    void serviceRef.current?.startTalking();
  }, []);

  const stopTalking = useCallback(() => {
    serviceRef.current?.stopTalking();
  }, []);

  const clearMicError = useCallback(() => setMicError(null), []);

  return { supported, talking, micError, speakingPlayerId, startTalking, stopTalking, clearMicError };
}
