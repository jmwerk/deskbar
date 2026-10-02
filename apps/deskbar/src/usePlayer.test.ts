import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { mockClient, resetMockState, setMockNowPlaying } from './mockClient';
import { mergeQueue, usePlayer } from './usePlayer';

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

  it('fetches each cover once even when the track changes mid-load', async () => {
    const get = vi.spyOn(mockClient.asset, 'get');
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(get).toHaveBeenCalled());

    // Skip before the first covers resolve, then come straight back.
    await act(async () => result.current.skip(1));
    await act(async () => result.current.skip(-1));

    await waitFor(() => expect(result.current.track?.artUrl).toBe('blob:mock-art'));
    const ids = get.mock.calls.map(([req]) => req.id);
    expect(new Set(ids).size).toBe(ids.length);
    get.mockRestore();
  });

  it('reports the next tracks and the playing context', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.queue).toHaveLength(5));
    expect(result.current.queue.slice(0, 3).map(q => q.title)).toEqual([
      'Five More Minutes (Calendar Invite Declined Remix)',
      'Available',
      'Inbox Zero',
    ]);
    expect(result.current.context).toBe('Deep Work');
  });

  it('jumps to an upcoming track by its queue position', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.queue).toHaveLength(5));

    await act(async () => result.current.skipTo(2));
    expect(result.current.track?.title).toBe('Inbox Zero');
    expect(result.current.queue[0].title).toBe('Hard Stop');
  });

  it('adds to the end of the queue in the order added, before the playlist resumes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.queue).toHaveLength(5));

    const add = (n: number, title: string) =>
      result.current.addToQueue({
        uri: `spotify:track:mock-${n}`,
        title,
        artist: null,
        artistUri: null,
        artworkId: null,
      });
    act(() => add(3, 'Inbox Zero'));
    act(() => add(4, 'Hard Stop'));
    expect(result.current.track?.title).toBe('Heads Down');
    expect(result.current.queue.slice(0, 2).map(q => [q.title, q.queued])).toEqual([
      ['Inbox Zero', true],
      ['Hard Stop', true],
    ]);

    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.queue.filter(q => q.queued).map(q => q.title)).toEqual(['Inbox Zero', 'Hard Stop']);
    expect(result.current.queue).toHaveLength(7);

    await act(async () => result.current.skip(1));
    expect(result.current.track?.title).toBe('Inbox Zero');
    expect(result.current.queue.filter(q => q.queued).map(q => q.title)).toEqual(['Hard Stop']);
  });

  it('keeps a track added here until it plays, even when the phone never lists it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const silent = { ...mockClient, player: { ...mockClient.player, queue: vi.fn(async () => {}) } };
    const { result } = renderHook(() => usePlayer(silent));
    await waitFor(() => expect(result.current.queue).toHaveLength(5));

    act(() =>
      result.current.addToQueue({
        uri: 'spotify:track:mock-4',
        title: 'Hard Stop',
        artist: null,
        artistUri: null,
        artworkId: null,
      }),
    );
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(result.current.queue[0]).toMatchObject({ title: 'Hard Stop', queued: true, phoneIndex: null });
  });

  it('plays a track by uri within a context', async () => {
    const { result } = renderHook(() => usePlayer(mockClient));
    await waitFor(() => expect(result.current.track).not.toBeNull());

    await act(async () => result.current.play('spotify:track:mock-3', 'spotify:artist:mock-auto-reply'));
    expect(result.current.track?.title).toBe('Inbox Zero');
    expect(result.current.track?.artistUri).toBe('spotify:artist:mock-auto-reply');
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

describe('mergeQueue', () => {
  const q = (title: string, queued = false) => ({
    uri: `spotify:track:${title}`,
    title,
    artist: null,
    artworkId: null,
    queued,
  });

  it('takes tracks added here as queued even when the phone leaves them unflagged', () => {
    const merged = mergeQueue([q('a', true), q('mine'), q('p1'), q('p2')], [q('mine')]);
    expect(merged.map(m => [m.title, m.queued, m.phoneIndex])).toEqual([
      ['a', true, 0],
      ['mine', true, 1],
      ['p1', false, 2],
      ['p2', false, 3],
    ]);
  });

  it('lists tracks added here that the phone has not shown yet right after the queued run', () => {
    const merged = mergeQueue([q('a', true), q('p1')], [q('late')]);
    expect(merged.map(m => [m.title, m.queued, m.phoneIndex])).toEqual([
      ['a', true, 0],
      ['late', true, null],
      ['p1', false, 1],
    ]);
  });

  it("doesn't mistake a later playlist copy of a track added here for the queued one", () => {
    const merged = mergeQueue([q('p1'), q('mine')], [q('mine')]);
    expect(merged.map(m => [m.title, m.queued])).toEqual([
      ['mine', true],
      ['p1', false],
      ['mine', false],
    ]);
  });
});
