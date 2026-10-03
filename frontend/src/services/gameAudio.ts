import { Game, GameState } from '../types/game';

export const SOUND_PREFERENCE_KEY = 'mini-card-game-sound';
const musicUrl = `${import.meta.env.BASE_URL}audio/horror-suspense-loop.wav`;
const cardUrl = `${import.meta.env.BASE_URL}audio/card-play-dark.wav`;

export function readSoundPreference(): boolean {
  try { return localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'off'; }
  catch { return true; }
}

/** Audio consumes only the existing recipient-safe, server-confirmed history. */
export class GameAudio {
  private music = new Audio(musicUrl);
  private card = new Audio(cardUrl);
  private enabled: boolean;
  private active = false;
  private visible = !document.hidden;
  private disposed = false;
  private musicPending = false;
  private history: { gameId: string; count: number; signature: string } | null = null;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    this.music.loop = true;
    this.music.volume = 0.3;
    this.music.preload = 'none';
    this.card.volume = 0.65;
    this.card.preload = 'none';
  }

  private get canPlay() { return this.enabled && this.active && this.visible && !this.disposed; }

  private stopCard() {
    this.card.pause();
    this.card.currentTime = 0;
  }

  resume = () => {
    if (!this.canPlay || !this.music.paused || this.musicPending) return;
    this.musicPending = true;
    // Retried on the next user gesture if autoplay is blocked. Never throw into gameplay.
    void this.music.play().then(() => {
      if (!this.canPlay) this.music.pause();
    }).catch(() => {}).finally(() => { this.musicPending = false; });
  };

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    try { localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? 'on' : 'off'); }
    catch { /* A restricted browser may disable local storage. */ }
    if (enabled) this.resume();
    else { this.music.pause(); this.stopCard(); }
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (visible) this.resume();
    else { this.music.pause(); this.stopCard(); }
  }

  resetHistory = () => { this.history = null; };

  update(game: Game | null) {
    const wasActive = this.active;
    this.active = game?.state === GameState.PLAYING || game?.state === GameState.SPECIAL_PHASE;
    const actions = game?.public_actions ?? [];
    const signature = JSON.stringify(actions);
    const previous = this.history;
    const newAction = previous !== null && game?.id === previous.gameId &&
      actions.length > 0 && actions.length >= previous.count && signature !== previous.signature;
    this.history = game && game.state !== GameState.WAITING
      ? { gameId: game.id, count: actions.length, signature }
      : null;
    if (!this.active) {
      this.music.pause();
      this.music.currentTime = 0;
      this.stopCard();
      return;
    }
    this.resume();
    if (newAction && wasActive && this.canPlay) {
      this.card.currentTime = 0;
      void this.card.play().then(() => {
        if (!this.canPlay) this.stopCard();
      }).catch(() => {});
    }
  }

  dispose() {
    this.disposed = true;
    this.music.pause();
    this.stopCard();
    this.music.removeAttribute('src');
    this.card.removeAttribute('src');
    this.music.load();
    this.card.load();
  }
}
