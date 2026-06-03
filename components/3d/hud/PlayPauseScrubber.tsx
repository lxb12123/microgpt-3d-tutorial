'use client';

import { useState } from 'react';

export interface PlayPauseScrubberProps {
  /** Total duration in seconds. */
  duration: number;
  /** Current scrub position in seconds. */
  position: number;
  /** Called when the user drags the slider. */
  onSeek: (positionSeconds: number) => void;
  /** Called when play/pause is toggled. Caller manages actual playback. */
  onTogglePlay: (playing: boolean) => void;
  /** 'light' restyles for a light HUD (default 'dark' keeps the original look). */
  variant?: 'dark' | 'light';
}

export function PlayPauseScrubber({ duration, position, onSeek, onTogglePlay, variant = 'dark' }: PlayPauseScrubberProps) {
  const [playing, setPlaying] = useState(false);
  const light = variant === 'light';

  const handleToggle = () => {
    const next = !playing;
    setPlaying(next);
    onTogglePlay(next);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: light ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.5)', border: light ? '1px solid rgba(100,116,139,0.28)' : 'none', borderRadius: 6, color: light ? '#0f172a' : '#fff' }}>
      <button type="button" onClick={handleToggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.01}
        value={position}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ width: 200 }}
        aria-label="Scrub position"
      />
      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{position.toFixed(2)} / {duration.toFixed(2)}s</span>
    </div>
  );
}
