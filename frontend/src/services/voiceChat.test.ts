import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_RECORD_MS,
  VoiceChatEvents,
  VoiceChatService,
  base64ToBytes,
  bytesToBase64,
  isVoiceChatSupported,
} from './voiceChat';

type RecordingHandler = (() => void) | null;

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  static instances: FakeMediaRecorder[] = [];

  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: RecordingHandler = null;
  chunkToEmit: Blob | null = null;
  started = false;

  constructor(public stream: MediaStream, public options?: MediaRecorderOptions) {
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.started = true;
    this.state = 'recording';
  }

  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    if (this.chunkToEmit) this.ondataavailable?.({ data: this.chunkToEmit });
    this.onstop?.();
  }
}

class FakeAudio {
  static instances: FakeAudio[] = [];

  src = '';
  onended: RecordingHandler = null;
  onerror: RecordingHandler = null;
  played = 0;

  play() {
    this.played += 1;
    FakeAudio.instances.push(this);
    return Promise.resolve();
  }

  pause() { /* no-op */ }
}

const fakeStream = () => ({ getTracks: vi.fn(() => []) }) as unknown as MediaStream;

function installSupportedBrowser() {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(async () => fakeStream()) },
    configurable: true,
  });
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
}

async function makeStartedService(onChunkReady: (base64: string) => void = vi.fn()) {
  const service = new VoiceChatService(onChunkReady);
  const ok = await service.startTalking();
  return { service, ok };
}

describe('voice chat support detection', () => {
  it('reports unsupported when media devices are unavailable', () => {
    expect(isVoiceChatSupported()).toBe(false);
  });

  it('reports supported when capture APIs and a codec exist', () => {
    installSupportedBrowser();
    expect(isVoiceChatSupported()).toBe(true);
  });
});

describe('VoiceChatService push-to-talk capture', () => {
  beforeEach(() => {
    FakeMediaRecorder.instances = [];
    installSupportedBrowser();
  });

  it('emits one self-contained base64 chunk per press-release cycle', async () => {
    const onChunkReady = vi.fn();
    const { service, ok } = await makeStartedService(onChunkReady);
    expect(ok).toBe(true);
    expect(service.isTalking()).toBe(true);

    const recorder = FakeMediaRecorder.instances[FakeMediaRecorder.instances.length - 1]!;
    recorder.chunkToEmit = new Blob([new Uint8Array([1, 2, 3])]);
    service.stopTalking();

    // 编码经 FileReader 异步完成，轮询等待回调。
    await vi.waitFor(() => expect(onChunkReady).toHaveBeenCalledTimes(1));
    expect(Array.from(base64ToBytes(onChunkReady.mock.calls[0][0] as string))).toEqual([1, 2, 3]);
    expect(service.isTalking()).toBe(false);
  });

  it('does not emit anything for an empty accidental tap', async () => {
    const onChunkReady = vi.fn();
    const { service } = await makeStartedService(onChunkReady);
    const recorder = FakeMediaRecorder.instances[FakeMediaRecorder.instances.length - 1]!;
    recorder.chunkToEmit = new Blob([]);
    service.stopTalking();

    await new Promise(resolve => { setTimeout(resolve, 5); });
    expect(onChunkReady).not.toHaveBeenCalled();
  });

  it('surfaces a mic error instead of starting when permission is denied', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new DOMException('denied', 'NotAllowedError'),
    );
    const onError = vi.fn();
    const service = new VoiceChatService(vi.fn(), { onError });

    const ok = await service.startTalking();

    expect(ok).toBe(false);
    expect(service.isTalking()).toBe(false);
    expect(onError).toHaveBeenCalledWith('无法访问麦克风，请检查浏览器权限');
  });

  it('auto-stops a recording that exceeds the maximum duration', async () => {
    vi.useFakeTimers();
    try {
      const { service } = await makeStartedService(vi.fn());
      expect(service.isTalking()).toBe(true);

      vi.advanceTimersByTime(MAX_RECORD_MS + 1);

      expect(service.isTalking()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('VoiceChatService playback queue', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
  });

  function makeService(events: VoiceChatEvents = {}) {
    return new VoiceChatService(vi.fn(), events);
  }

  it('plays incoming clips strictly in order and reports who is speaking', () => {
    const onSpeakingChange = vi.fn();
    const service = makeService({ onRemoteSpeakingChange: onSpeakingChange });

    service.enqueueIncoming('p2', bytesToBase64(new Uint8Array([1])));
    service.enqueueIncoming('p3', bytesToBase64(new Uint8Array([2])));

    // 第一条立即播放，第二条排队。
    expect(FakeAudio.instances).toHaveLength(1);
    expect(service.speakingPlayerId()).toBe('p2');
    expect(onSpeakingChange).toHaveBeenLastCalledWith('p2');

    FakeAudio.instances[0].onended?.();

    expect(FakeAudio.instances).toHaveLength(2);
    expect(service.speakingPlayerId()).toBe('p3');

    FakeAudio.instances[1].onended?.();
    expect(service.speakingPlayerId()).toBeNull();
    expect(onSpeakingChange).toHaveBeenLastCalledWith(null);
  });

  it('keeps playing through clips that fail to decode', () => {
    const onError = vi.fn();
    const service = makeService({ onError });

    service.enqueueIncoming('p2', '!!!not-base64!!!');
    service.enqueueIncoming('p3', bytesToBase64(new Uint8Array([9])));

    expect(onError).toHaveBeenCalledWith('收到无法解析的语音分片');
    expect(FakeAudio.instances).toHaveLength(1);
    expect(service.speakingPlayerId()).toBe('p3');
  });
});

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes including zero bytes', () => {
    const bytes = new Uint8Array([0, 255, 7, 128]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual([0, 255, 7, 128]);
  });
});
