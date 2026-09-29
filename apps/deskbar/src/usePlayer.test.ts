import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { mockClient, resetMockState, setMockNowPlaying } from './mockClient';
import { usePlayer } from './usePlayer';

beforeEach(() => {
  resetMockState();
  URL.createObjectURL = vi.fn(() => 'blob:mock-art');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePlayer', () => {
  it('primes from stateGet and resolves artwork through asset.get', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));

    await waitFor(() => expect(result.current.track?.artUrl).toBe('blob:mock-art'));
    expect(result.current.track?.title).toBe('Midnight City');
    expect(result.current.track?.artist).toBe('M83');
    expect(result.current.playing).toBe(true);
    expect(result.current.durationMs).toBe(244_000);
  });

  it('follows snapshots for toggle and skip', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track).not.toBeNull());

    await act(async () => result.current.toggle());
    expect(result.current.playing).toBe(false);

    await act(async () => result.current.skip(1));
    expect(result.current.track?.title).toBe('Intro (Extended Mix, Remastered 2011)');
  });

  it('clamps seekBy to the track bounds', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    await act(async () => result.current.toggle());

    await act(async () => result.current.seekBy(-10 * 60_000));
    expect(result.current.positionMs).toBe(0);

    await act(async () => result.current.seekBy(10 * 60_000));
    expect(result.current.positionMs).toBe(244_000);
  });

  it('extrapolates the playhead between snapshots while playing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    const start = result.current.positionMs;

    await act(async () => vi.advanceTimersByTime(2000));
    expect(result.current.positionMs).toBeGreaterThanOrEqual(start + 1900);
  });

  it('reports no track when the phone stops reporting playback', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track).not.toBeNull());

    act(() => setMockNowPlaying(false));
    expect(result.current.track).toBeNull();
    expect(result.current.playing).toBe(false);
  });
});
