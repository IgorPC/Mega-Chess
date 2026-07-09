import { useRef, useCallback, useState } from 'react';

export type SoundType = 'move' | 'capture' | 'check' | 'gameStart' | 'victory' | 'defeat' | 'countdown' | 'notification';

const MUTE_KEY = 'chess_muted';

type AudioCtx = AudioContext;

function playTone(
  ctx: AudioCtx,
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  vol = 0.25,
  delay = 0,
) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  gain.gain.setValueAtTime(0, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.05);
}

const SOUNDS: Record<SoundType, (ctx: AudioCtx) => void> = {
  // Clique suave — peça movida
  move: (ctx) => {
    playTone(ctx, 520, 0.07, 'sine', 0.18);
  },
  // Baque mais pesado — captura
  capture: (ctx) => {
    playTone(ctx, 280, 0.05, 'square', 0.25);
    playTone(ctx, 200, 0.12, 'sawtooth', 0.12, 0.03);
  },
  // Dois bipes de alerta — xeque
  check: (ctx) => {
    playTone(ctx, 880, 0.08, 'sine', 0.28);
    playTone(ctx, 880, 0.08, 'sine', 0.28, 0.16);
  },
  // Arpejo ascendente — início de partida
  gameStart: (ctx) => {
    const notes = [261, 329, 392, 523];
    notes.forEach((f, i) => playTone(ctx, f, 0.22, 'sine', 0.22, i * 0.12));
  },
  // Fanfarra de vitória
  victory: (ctx) => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => playTone(ctx, f, 0.28, 'sine', 0.28, i * 0.14));
  },
  // Descida melancólica — derrota
  defeat: (ctx) => {
    const notes = [392, 330, 277, 220];
    notes.forEach((f, i) => playTone(ctx, f, 0.28, 'sine', 0.2, i * 0.18));
  },
  // Tique de contagem regressiva
  countdown: (ctx) => {
    playTone(ctx, 660, 0.09, 'sine', 0.2);
  },
  // Bipe curto e suave — nova notificação
  notification: (ctx) => {
    playTone(ctx, 740, 0.06, 'sine', 0.16);
    playTone(ctx, 990, 0.09, 'sine', 0.16, 0.08);
  },
};

export function useSound() {
  const ctxRef  = useRef<AudioCtx | null>(null);
  const [muted, setMuted] = useState<boolean>(() => localStorage.getItem(MUTE_KEY) === 'true');
  // Ref espelha o state para que callbacks estables leiam o valor atual
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const getCtx = useCallback((): AudioCtx | null => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext ?? (window as any).webkitAudioContext)();
      }
      if (ctxRef.current.state === 'suspended') {
        ctxRef.current.resume();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  const play = useCallback((sound: SoundType) => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      SOUNDS[sound](ctx);
    } catch { /* AudioContext pode falhar em contextos restritos */ }
  }, [getCtx]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      mutedRef.current = next;
      localStorage.setItem(MUTE_KEY, String(next));
      return next;
    });
  }, []);

  return { play, muted, toggleMute };
}
