import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { GameAudio, readSoundPreference, SOUND_PREFERENCE_KEY } from './gameAudio';
import { CardUsageType, Game, GameState, PublicAction } from '../types/game';

class FakeAudio {
  static instances: FakeAudio[] = [];
  paused = true;
  currentTime = 0;
  loop = false;
  volume = 1;
  preload = '';
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  removeAttribute = vi.fn();
  load = vi.fn();
  constructor(public src: string) { FakeAudio.instances.push(this); }
}

const action = (sequence: number): PublicAction => ({
  sequence, actor_id: 'player-1', actor_name: '玩家一', usage_type: CardUsageType.HARMONY,
  target_player_id: null, target_player_name: null, card_name: null,
});
const game = (actions: PublicAction[] = [], state = GameState.PLAYING): Game => ({
  id: 'room-a', state, players: [], harmony_area: [], current_player_index: 0,
  turn_count: 0, player_count: 3, required_harmony_value: 6, winner: null,
  public_actions: actions,
});
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('GameAudio', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    localStorage.clear();
    vi.stubGlobal('Audio', FakeAudio);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('loops quiet music in playing and special phases, stopping at settlement and disposal', async () => {
    const audio = new GameAudio(true);
    const [music, card] = FakeAudio.instances;
    audio.update(game());
    await settle();
    expect(music.loop).toBe(true);
    expect(music.volume).toBeLessThan(card.volume);
    expect(music.paused).toBe(false);
    audio.update(game([], GameState.SPECIAL_PHASE));
    expect(music.play).toHaveBeenCalledTimes(1);
    music.currentTime = 12;
    audio.update(game([], GameState.GAME_OVER));
    expect(music.paused).toBe(true);
    expect(music.currentTime).toBe(0);
    expect(card.paused).toBe(true);
    audio.dispose();
    expect(music.removeAttribute).toHaveBeenCalledWith('src');
    expect(card.load).toHaveBeenCalledOnce();
  });

  it('plays confirmed actions once, never initial history, duplicates or skill-only state updates', () => {
    const audio = new GameAudio(true);
    const [, card] = FakeAudio.instances;
    audio.update(game([action(1)]));
    expect(card.play).not.toHaveBeenCalled();
    audio.update(game([action(1), action(2)], GameState.SPECIAL_PHASE));
    expect(card.play).toHaveBeenCalledTimes(1);
    audio.update(game([action(1), action(2)]));
    audio.update({ ...game([action(1), action(2)]), turn_count: 2 });
    expect(card.play).toHaveBeenCalledTimes(1);
    audio.update(game([action(1), action(2), action(3)]));
    expect(card.play).toHaveBeenCalledTimes(2);
  });

  it('baselines restored history after reconnect, reset, or room change', () => {
    const audio = new GameAudio(true);
    const [, card] = FakeAudio.instances;
    audio.update(game([action(1)]));
    audio.resetHistory();
    audio.update(game([action(1), action(2), action(3)]));
    expect(card.play).not.toHaveBeenCalled();
    audio.update(game([], GameState.WAITING));
    audio.update(game());
    audio.update(game([action(1)]));
    expect(card.play).toHaveBeenCalledTimes(1);
    audio.update({ ...game([action(1), action(2)]), id: 'room-b' });
    expect(card.play).toHaveBeenCalledTimes(1);
  });

  it('does not queue hidden or muted actions, and persists the sound preference', async () => {
    const audio = new GameAudio(true);
    const [music, card] = FakeAudio.instances;
    audio.update(game());
    await settle();
    music.currentTime = 4;
    audio.setVisible(false);
    expect(music.paused).toBe(true);
    audio.update(game([action(1)]));
    audio.setVisible(true);
    await settle();
    expect(music.currentTime).toBe(4);
    expect(card.play).not.toHaveBeenCalled();
    audio.setEnabled(false);
    expect(readSoundPreference()).toBe(false);
    audio.update(game([action(1), action(2)]));
    audio.setEnabled(true);
    expect(card.play).not.toHaveBeenCalled();
    expect(localStorage.getItem(SOUND_PREFERENCE_KEY)).toBe('on');
    audio.update(game([action(1), action(2), action(3)]));
    expect(card.play).toHaveBeenCalledOnce();
  });

  it('recovers from autoplay rejection on the next gesture without breaking gameplay', async () => {
    const audio = new GameAudio(true);
    const [music, card] = FakeAudio.instances;
    music.play.mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'));
    audio.update(game());
    await settle();
    expect(music.paused).toBe(true);
    audio.resume();
    await settle();
    expect(music.paused).toBe(false);
    card.play.mockRejectedValueOnce(new Error('Unavailable'));
    audio.update(game([action(1)]));
    await settle();
    audio.update(game([action(1), action(2)]));
    expect(card.play).toHaveBeenCalledTimes(2);
  });

  it('pauses a late play promise after being muted or disposed', async () => {
    const audio = new GameAudio(true);
    const [music] = FakeAudio.instances;
    let resolve!: () => void;
    music.play.mockImplementationOnce(() => new Promise<void>(done => {
      resolve = () => { music.paused = false; done(); };
    }));
    audio.update(game());
    audio.dispose();
    resolve();
    await settle();
    expect(music.paused).toBe(true);
  });

  it('handles unavailable local storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(readSoundPreference()).toBe(true);
    const audio = new GameAudio(false);
    expect(() => audio.setEnabled(true)).not.toThrow();
  });

  it('starts silently with a saved mute preference and handles trimmed action history', () => {
    localStorage.setItem(SOUND_PREFERENCE_KEY, 'off');
    const audio = new GameAudio(readSoundPreference());
    const [music, card] = FakeAudio.instances;
    const history = Array.from({ length: 30 }, (_, index) => action(index + 1));
    audio.update(game(history));
    expect(music.play).not.toHaveBeenCalled();
    audio.setEnabled(true);
    audio.update(game([...history.slice(1), action(31)]));
    expect(card.play).toHaveBeenCalledOnce();
    audio.update(game([...history.slice(2), action(31), { ...action(31), actor_id: 'player-2' }]));
    expect(card.play).toHaveBeenCalledTimes(2);
  });
});
