/**
 * 按住说话语音服务（Issue #131）。
 *
 * 采集：按下时 getUserMedia + MediaRecorder 录一整段（松开结束），整段编码为
 * base64 后经回调交给上层发送 `voice_chunk` 消息；不使用 timeslice 分片，
 * 保证每个分片都是自包含可独立解码的录音。
 * 播放：收到的分片进入 FIFO 队列顺序播放，同一时间只播一条，避免多人重叠；
 * 当前播放者 id 通过事件通知 UI 显示“正在说话”。
 */

export interface VoiceChatEvents {
  onTalkingChange?: (talking: boolean) => void;
  onRemoteSpeakingChange?: (playerId: string | null) => void;
  onError?: (message: string) => void;
}

/** 单条录音上限，超过自动截断（与服务端 voice_too_large 上限留有余量）。 */
export const MAX_RECORD_MS = 30_000;

const RECORD_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4', // Safari / iOS
];

function pickRecordMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of RECORD_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported?.(mime)) return mime;
  }
  return null;
}

/** 环境是否支持按住说话；不支持的环境由 UI 隐藏入口。 */
export function isVoiceChatSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined' &&
    pickRecordMimeType() !== null
  );
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** 读取 Blob 字节：优先原生 arrayBuffer()，老环境/测试环境回退 FileReader。 */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Blob read failed'));
    reader.readAsArrayBuffer(blob);
  });
}

interface QueuedClip {
  fromPlayerId: string;
  blob: Blob;
}

export class VoiceChatService {
  private readonly events: VoiceChatEvents;
  /** 采集完成回调：上层负责把 base64 通过 WebSocket 发出。 */
  private readonly onChunkReady: (base64: string) => void;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];
  private recordMimeType: string | null = null;
  private autoStopTimer: ReturnType<typeof setTimeout> | null = null;
  private talking = false;
  private clipQueue: QueuedClip[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private playingFrom: string | null = null;

  constructor(onChunkReady: (base64: string) => void, events: VoiceChatEvents = {}) {
    this.onChunkReady = onChunkReady;
    this.events = events;
  }

  isTalking(): boolean {
    return this.talking;
  }

  speakingPlayerId(): string | null {
    return this.playingFrom;
  }

  /** 开始采集一段语音。失败（拒绝授权等）返回 false 并触发 onError。 */
  async startTalking(): Promise<boolean> {
    if (this.talking) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      this.events.onError?.('无法访问麦克风，请检查浏览器权限');
      return false;
    }

    this.recordMimeType = pickRecordMimeType();
    this.recordedChunks = [];
    try {
      this.recorder = new MediaRecorder(this.stream, this.recordMimeType
        ? { mimeType: this.recordMimeType }
        : undefined);
    } catch {
      this.releaseStream();
      this.events.onError?.('当前浏览器不支持语音录制');
      return false;
    }
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.recordedChunks.push(event.data);
    };
    this.recorder.onstop = () => this.finishRecording();
    this.recorder.start();
    this.talking = true;
    this.events.onTalkingChange?.(true);
    // 超长自动截断，防止忘记松开一直占用连接带宽。
    this.autoStopTimer = setTimeout(() => {
      if (this.talking) this.stopTalking();
    }, MAX_RECORD_MS);
    return true;
  }

  /** 结束采集并产出分片；未在录音时为空操作。 */
  stopTalking(): void {
    if (!this.talking) return;
    this.clearAutoStop();
    this.talking = false;
    this.events.onTalkingChange?.(false);
    try {
      this.recorder?.stop(); // onstop → finishRecording 异步完成
    } catch {
      this.finishRecording();
    }
  }

  /** 收到其他玩家的语音分片：解码入队并按序播放。 */
  enqueueIncoming(playerId: string, base64: string): void {
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = base64ToBytes(base64);
    } catch {
      this.events.onError?.('收到无法解析的语音分片');
      return;
    }
    const mimeType = this.recordMimeType ?? 'audio/webm';
    this.clipQueue.push({ fromPlayerId: playerId, blob: new Blob([bytes], { type: mimeType }) });
    if (!this.currentAudio && !this.playingFrom) this.playNext();
  }

  /** 停止播放与采集并释放资源（离开页面/组件卸载时调用）。 */
  dispose(): void {
    if (this.talking) {
      this.talking = false;
      this.events.onTalkingChange?.(false);
    }
    this.clearAutoStop();
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      try { this.recorder.stop(); } catch { /* 已停止 */ }
    }
    this.recorder = null;
    this.recordedChunks = [];
    this.clipQueue = [];
    this.stopPlayback();
    this.releaseStream();
  }

  private finishRecording(): void {
    const mimeType = this.recordMimeType ?? 'audio/webm';
    const blob = new Blob(this.recordedChunks, { type: mimeType });
    this.recordedChunks = [];
    this.releaseStream();
    this.recorder = null;
    if (blob.size === 0) return; // 误触：太短没有内容
    blobToArrayBuffer(blob).then((buffer) => {
      this.onChunkReady(bytesToBase64(new Uint8Array(buffer)));
    }).catch(() => {
      this.events.onError?.('语音编码失败，请重试');
    });
  }

  private playNext(): void {
    const clip = this.clipQueue.shift();
    if (!clip) {
      this.playingFrom = null;
      this.events.onRemoteSpeakingChange?.(null);
      return;
    }
    this.playingFrom = clip.fromPlayerId;
    this.events.onRemoteSpeakingChange?.(clip.fromPlayerId);
    const audio = new Audio();
    this.currentUrl = URL.createObjectURL(clip.blob);
    this.currentAudio = audio;
    const advance = () => {
      if (this.currentAudio === audio) {
        this.currentAudio = null;
        if (this.currentUrl) {
          URL.revokeObjectURL(this.currentUrl);
          this.currentUrl = null;
        }
      }
      this.playNext();
    };
    audio.onended = advance;
    audio.onerror = advance;
    audio.src = this.currentUrl;
    audio.play().catch(advance);
  }

  private stopPlayback(): void {
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      try { this.currentAudio.pause(); } catch { /* 忽略 */ }
      this.currentAudio = null;
    }
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
    if (this.playingFrom !== null) {
      this.playingFrom = null;
      this.events.onRemoteSpeakingChange?.(null);
    }
  }

  private clearAutoStop(): void {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }
}
