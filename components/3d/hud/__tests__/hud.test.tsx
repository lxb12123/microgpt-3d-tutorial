import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayPauseScrubber } from '../PlayPauseScrubber';
import { ModeSelector } from '../ModeSelector';
import { ParamSlider } from '../ParamSlider';

describe('PlayPauseScrubber', () => {
  it('toggles play/pause and reports state', () => {
    const onToggle = vi.fn();
    render(<PlayPauseScrubber duration={5} position={1} onSeek={() => {}} onTogglePlay={onToggle} />);
    fireEvent.click(screen.getByLabelText(/Play|Pause/));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});

describe('ModeSelector', () => {
  it('emits value on click', () => {
    const onChange = vi.fn();
    render(
      <ModeSelector
        items={[{ value: 'forward', label: 'Forward' }, { value: 'backward', label: 'Backward' }] as const}
        value="forward"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText('Backward'));
    expect(onChange).toHaveBeenCalledWith('backward');
  });
});

describe('ParamSlider', () => {
  it('emits new numeric value on slide', () => {
    const onChange = vi.fn();
    render(<ParamSlider label="LR" min={0} max={10} value={3} onChange={onChange} />);
    const slider = screen.getByLabelText(/LR/);
    fireEvent.change(slider, { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith(7);
  });
});
