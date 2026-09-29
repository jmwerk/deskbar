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
    expect(result.current.track?.title).toBe('Heads Down');
    expect(result.current.track?.artist).toBe('The Standups');
    expect(result.current.playing).toBe(true);
    expect(result.current.durationMs).toBe(244_000);
  });

  it('follows snapshots for toggle and skip', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track).not.toBeNull());

    await act(async () => result.current.toggle());
    expect(result.current.playing).toBe(false);

    await act(async () => result.current.skip(1));
    expect(result.current.track?.title).toBe('Five More Minutes (Calendar Invite Declined Remix)');
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

  it('moves the playhead on seek before the phone confirms it', async () => {
    const silent = { ...mockClient, player: { ...mockClient.player, seekTo: vi.fn(async () => {}) } };
    const { result } = renderHook(() => usePlayer(silent));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    await act(async () => result.current.toggle());

    act(() => result.current.seekTo(100_000));
    expect(result.current.positionMs).toBe(100_000);
    expect(silent.player.seekTo).toHaveBeenCalledWith({ positionMs: 100_000 });
  });

  it('reuses cached artwork when skipping back to a recent track', async () => {
    const get = vi.spyOn(mockClient.asset, 'get');
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track?.artUrl).toBe('blob:mock-art'));

    await act(async () => result.current.skip(1));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await act(async () => result.current.skip(-1));

    await waitFor(() => expect(result.current.track?.title).toBe('Heads Down'));
    expect(result.current.track?.artUrl).not.toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
    get.mockRestore();
  });

  it('caches a cover that finishes loading after the track changed', async () => {
    const get = vi.spyOn(mockClient.asset, 'get');
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    // Skip before the first cover resolves, then come straight back to it.
    await act(async () => result.current.skip(1));
    await act(async () => result.current.skip(-1));

    await waitFor(() => expect(result.current.track?.artUrl).toBe('blob:mock-art'));
    expect(get.mock.calls.map(([req]) => req.id)).toEqual(['mock-art-0', 'mock-art-1']);
    get.mockRestore();
  });

  it('extrapolates the playhead between snapshots while playing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    const start = result.current.positionMs;

    await act(async () => vi.advanceTimersByTime(2000));
    expect(result.current.positionMs).toBeGreaterThanOrEqual(start + 1900);
  });

  it('toggles like on the current track and keeps it per track', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    expect(result.current.liked).toBe(false);

    await act(async () => result.current.toggleLike());
    expect(result.current.liked).toBe(true);

    await act(async () => result.current.skip(1));
    expect(result.current.liked).toBe(false);

    await act(async () => result.current.skip(-1));
    expect(result.current.liked).toBe(true);

    await act(async () => result.current.toggleLike());
    expect(result.current.liked).toBe(false);
  });

  it('shows a like made elsewhere', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track).not.toBeNull());

    await act(async () =>
      mockClient.library.favoritesToggle({
        item: { uri: 'spotify:track:mock-0', kind: 'track', persistentId: null },
      }),
    );
    expect(result.current.liked).toBe(true);
  });

  it('reports no track when the phone stops reporting playback', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track).not.toBeNull());

    act(() => setMockNowPlaying(false));
    expect(result.current.track).toBeNull();
    expect(result.current.playing).toBe(false);
  });
});
