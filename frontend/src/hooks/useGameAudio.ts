import { useEffect, useRef, useState } from 'react';
import { Game } from '../types/game';
import { GameAudio, readSoundPreference } from '../services/gameAudio';
import { wsService } from '../services/websocket';

export function useGameAudio(game: Game | null) {
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference);
  const audio = useRef<GameAudio | null>(null);

  useEffect(() => {
    const controller = new GameAudio(readSoundPreference());
    audio.current = controller;
    const visibility = () => controller.setVisible(!document.hidden);
    const unsubscribe = wsService.onConnectionChange(connected => {
      if (!connected) controller.resetHistory();
    });
    wsService.on('reconnect_success', controller.resetHistory);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('pointerdown', controller.resume);
    document.addEventListener('keydown', controller.resume);
    return () => {
      unsubscribe();
      wsService.off('reconnect_success', controller.resetHistory);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerdown', controller.resume);
      document.removeEventListener('keydown', controller.resume);
      controller.dispose();
      audio.current = null;
    };
  }, []);

  useEffect(() => { audio.current?.update(game); }, [game]);

  const toggleSound = () => {
    const next = !soundEnabled;
    audio.current?.setEnabled(next);
    setSoundEnabled(next);
  };
  return { soundEnabled, toggleSound };
}
