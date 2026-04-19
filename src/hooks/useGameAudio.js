import { useCallback, useEffect, useRef } from 'react';

const SOUND_PATHS = {
  cardClick: '/sounds/card-click.mp3',
  pointGain: '/sounds/point-gain.mp3'
};

export function useGameAudio() {
  const currentAudioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        const audio = currentAudioRef.current;
        audio.pause();
        audio.src = '';
        currentAudioRef.current = null;
      }
    };
  }, []);

  const playSound = useCallback((soundName) => {
    const soundPath = SOUND_PATHS[soundName];
    if (!soundPath) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
    }

    const audio = new Audio(soundPath);
    audio.preload = 'auto';
    currentAudioRef.current = audio;
    audio.play().catch(() => {});
  }, []);

  return {
    playCardClick: () => playSound('cardClick'),
    playPointGain: () => playSound('pointGain')
  };
}
