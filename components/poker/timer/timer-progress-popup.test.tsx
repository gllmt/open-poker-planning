// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nContext } from '@/lib/i18n/context';
import dictionary from '@/lib/i18n/dictionaries/en.json';
import { TimerProgress } from './timer-progress-popup';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nContext value={{ locale: 'en', dictionary }}>{children}</I18nContext>
  );
}
function setup(overrides: Partial<ComponentProps<typeof TimerProgress>> = {}) {
  const props = {
    isMod: true,
    startedAt: null,
    pausedAt: 0,
    totalSeconds: 300,
    soundOn: true,
    onTimerClose: vi.fn(),
    onTimerStateUpdate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const view = render(<TimerProgress {...props} />, { wrapper });
  return {
    ...view,
    update: props.onTimerStateUpdate,
    push: (next: Partial<typeof props>) =>
      view.rerender(<TimerProgress {...props} {...next} />),
  };
}
function minutes() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Minutes' });
}
function seconds() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Seconds' });
}
function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('timer draft', () => {
  it('releases an acknowledged local draft before a later remote duration', async () => {
    const pending = deferred();
    const update = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(undefined);
    const { push } = setup({ onTimerStateUpdate: update });
    click(dictionary.timer.addMinute);
    expect(Number(minutes().value)).toBe(6);
    push({ totalSeconds: 360 });
    await act(async () => pending.resolve());
    push({ totalSeconds: 600 });
    expect(minutes().value).toBe('10');
    click(dictionary.timer.startTitle);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ totalSeconds: 600, elapsedSeconds: 0 })
    );
    await act(async () => {});
  });

  it('restores the server duration after a rejected update', async () => {
    const pending = deferred();
    setup({ onTimerStateUpdate: () => pending.promise });
    click(dictionary.timer.addMinute);
    await act(async () => pending.reject(new Error('rejected')));
    expect(minutes().value).toBe('05');
  });

  it('keeps a newer edit when an older request settles', async () => {
    const first = deferred();
    const second = deferred();
    const update = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { push } = setup({ onTimerStateUpdate: update });
    click(dictionary.timer.addMinute);
    fireEvent.change(minutes(), { target: { value: '7' } });
    push({ totalSeconds: 360 });
    await act(async () => first.resolve());
    expect(minutes().value).toBe('7');
    act(() => vi.advanceTimersByTime(400));
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ totalSeconds: 420 })
    );
    push({ totalSeconds: 420 });
    await act(async () => second.resolve());
    expect(minutes().value).toBe('07');
  });

  it.each(['a', '-1', '1.5', 'Infinity', '1 2'])(
    'rejects invalid numeric text %s without sending NaN',
    async (text) => {
      const { update } = setup();
      fireEvent.change(minutes(), { target: { value: text } });
      await act(async () => vi.advanceTimersByTime(500));
      expect(minutes().value).toBe('05');
      expect(update).not.toHaveBeenCalled();
    }
  );

  it('allows an empty field and commits it once as zero on blur', async () => {
    const { update } = setup();
    fireEvent.change(minutes(), { target: { value: '' } });
    expect(minutes().value).toBe('');
    fireEvent.blur(minutes());
    await act(async () => vi.advanceTimersByTime(500));
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ totalSeconds: 0 })
    );
  });

  it('clamps pasted seconds and the total to the server limit', async () => {
    const { update } = setup();
    fireEvent.change(seconds(), { target: { value: '99' } });
    expect(seconds().value).toBe('59');
    fireEvent.change(minutes(), { target: { value: '99999' } });
    expect(minutes().value).toBe('1440');
    expect(seconds().value).toBe('00');
    await act(async () => vi.advanceTimersByTime(400));
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ totalSeconds: 86400 })
    );
  });

  it('cancels a pending duration edit when another moderator starts the timer', async () => {
    const { update, push } = setup();
    fireEvent.change(minutes(), { target: { value: '7' } });
    push({ startedAt: Date.now(), pausedAt: null, totalSeconds: 600 });
    await act(async () => vi.advanceTimersByTime(500));
    expect(update).not.toHaveBeenCalled();
    expect(minutes().disabled).toBe(true);
  });

  it('preserves elapsed time on pause and resume', async () => {
    const { update, push } = setup({
      startedAt: Date.now() - 65000,
      pausedAt: null,
    });
    click(dictionary.timer.pauseTitle);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ startedAt: null, pausedAt: 65 })
    );
    await act(async () => {});
    push({ startedAt: null, pausedAt: 65 });
    click(dictionary.timer.startTitle);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ elapsedSeconds: 65, pausedAt: null })
    );
    await act(async () => {});
  });
});
