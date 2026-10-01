import { CardUsageType } from '../types/game';

let context: AudioContext | null = null;

/** Browsers require a local gesture before any game sound may play. */
export function unlockPlaySounds() {
  try {
    if (!context && typeof AudioContext !== 'undefined') context = new AudioContext();
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
  } catch { /* Audio is optional on unsupported devices. */ }
}

export function playActionSound(usage: CardUsageType) {
  if (!context || context.state !== 'running') return;
  const patterns = {
    [CardUsageType.HARMONY]: { notes: [220, 330, 440], wave: 'sine' as OscillatorType, length: .4 },
    [CardUsageType.DOUBT]: { notes: [180, 120, 75], wave: 'triangle' as OscillatorType, length: .18 },
    [CardUsageType.SKILL]: { notes: [660, 440, 880], wave: 'sine' as OscillatorType, length: .32 },
  };
  const pattern = patterns[usage];
  pattern.notes.forEach((frequency, index) => {
    const start = context!.currentTime + index * .09;
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    oscillator.type = pattern.wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .85, start + pattern.length);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(.045, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + pattern.length);
    oscillator.connect(gain);
    gain.connect(context!.destination);
    oscillator.start(start);
    oscillator.stop(start + pattern.length + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
